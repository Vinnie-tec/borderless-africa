import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

import { and, eq } from "drizzle-orm";

import {
  contractPayments,
  contracts,
  paymentWebhookEvents,
} from "@/lib/db/schema";
import { revalidatePath } from "next/cache";

/**
 * Verify the modern Paystack-Signature header.
 *
 * Paystack signs: timestamp + "." + raw request body.
 */
function verifyModernSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): boolean {
  const parts = signatureHeader.split(",");

  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex === -1) continue;

    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();

    if (key === "t") {
      if (timestamp !== null || !/^\d+$/.test(value)) {
        return false;
      }

      timestamp = value;
    }

    if (key === "v1") {
      const colonIndex = value.indexOf(":");

      if (colonIndex === -1) continue;

      signatures.push(value.slice(colonIndex + 1));
    }
  }

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  // Reject signatures older than five minutes or dated too far in the future.
  const timestampSeconds = Number(timestamp);
  const currentSeconds = Math.floor(Date.now() / 1000);

  if (
    !Number.isSafeInteger(timestampSeconds) ||
    Math.abs(currentSeconds - timestampSeconds) > 300
  ) {
    return false;
  }

  const expected = createHmac("sha512", secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest();

  return signatures.some((signature) => {
    if (!/^[0-9a-f]{128}$/.test(signature)) {
      return false;
    }

    const received = Buffer.from(signature, "hex");

    return (
      received.length === expected.length && timingSafeEqual(expected, received)
    );
  });
}

/**
 * Verify the legacy X-Paystack-Signature header.
 */
function verifyLegacySignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!/^[0-9a-f]{128}$/.test(signature)) {
    return false;
  }

  const expected = createHmac("sha512", secret).update(rawBody).digest();

  const received = Buffer.from(signature, "hex");

  return (
    received.length === expected.length && timingSafeEqual(expected, received)
  );
}

function toSmallestCurrencyUnit(amount: string | number): number {
  const normalizedAmount = String(amount).trim();

  if (!/^\d+(\.\d{1,2})?$/.test(normalizedAmount)) {
    throw new Error("Invalid payment amount.");
  }

  const [whole, fraction = ""] = normalizedAmount.split(".");

  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(result) || result <= 0) {
    throw new Error("Payment amount is outside the supported range.");
  }

  return result;
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  const modernSignature = request.headers.get("paystack-signature");
  const legacySignature = request.headers.get("x-paystack-signature");

  const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
  const apiSecret = process.env.PAYSTACK_SECRET_KEY;

  let isValid = false;

  // Prefer the modern signing secret whenever its header is present.
  if (modernSignature) {
    if (!webhookSecret) {
      console.error("Paystack webhook signing secret is missing.");

      return NextResponse.json(
        { message: "Webhook configuration error." },
        { status: 500 },
      );
    }

    isValid = verifyModernSignature(rawBody, modernSignature, webhookSecret);
  } else if (legacySignature) {
    if (!apiSecret) {
      return NextResponse.json(
        { message: "Webhook configuration error." },
        { status: 500 },
      );
    }

    isValid = verifyLegacySignature(rawBody, legacySignature, apiSecret);
  }

  if (!isValid) {
    return NextResponse.json(
      { message: "Invalid webhook signature." },
      { status: 401 },
    );
  }

  // Only parse the request after its signature has been verified.
  let event: {
    event?: unknown;
    data?: {
      reference?: unknown;
    };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { message: "Invalid webhook payload." },
      { status: 400 },
    );
  }

  if (typeof event.event !== "string") {
    return NextResponse.json(
      { message: "Invalid webhook event." },
      { status: 400 },
    );
  }

  try {
    // Record the incoming event first.
    const [webhookEvent] = await db
      .insert(paymentWebhookEvents)
      .values({
        provider: "paystack",
        eventType: event.event,
        paymentReference:
          typeof event.data?.reference === "string"
            ? event.data.reference
            : null,
        payload: event,
        processingStatus: "received",
      })
      .returning({ id: paymentWebhookEvents.id });

    // We only activate contracts for successful charges.
    if (event.event !== "charge.success") {
      await db
        .update(paymentWebhookEvents)
        .set({
          processingStatus: "processed",
          processedAt: new Date(),
        })
        .where(eq(paymentWebhookEvents.id, webhookEvent.id));

      return NextResponse.json({ received: true });
    }

    const reference = event.data?.reference;

    if (typeof reference !== "string" || !reference) {
      await db
        .update(paymentWebhookEvents)
        .set({
          processingStatus: "failed",
          processingError: "Missing transaction reference.",
        })
        .where(eq(paymentWebhookEvents.id, webhookEvent.id));

      return NextResponse.json({ received: true });
    }

    // Find our local payment record.
    const [payment] = await db
      .select()
      .from(contractPayments)
      .where(
        and(
          eq(contractPayments.providerReference, reference),
          eq(contractPayments.provider, "paystack"),
        ),
      )
      .limit(1);

    if (!payment) {
      await db
        .update(paymentWebhookEvents)
        .set({
          processingStatus: "failed",
          processingError: "No matching payment record.",
        })
        .where(eq(paymentWebhookEvents.id, webhookEvent.id));

      return NextResponse.json({ received: true });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      throw new Error("Paystack secret key is missing.");
    }

    // Independently verify the transaction with Paystack.
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
        cache: "no-store",
      },
    );

    const verification = (await response.json()) as {
      status: boolean;
      data?: {
        status: string;
        reference: string;
        amount: number;
        currency: string;
      };
    };

    if (!response.ok || !verification.status || !verification.data) {
      throw new Error("Paystack transaction verification failed.");
    }

    const transaction = verification.data;

    // Compare the verified transaction with our local payment.
    if (
      transaction.status !== "success" ||
      transaction.reference !== payment.providerReference ||
      transaction.amount !== toSmallestCurrencyUnit(payment.amount) ||
      transaction.currency !== payment.currency
    ) {
      await db
        .update(paymentWebhookEvents)
        .set({
          processingStatus: "failed",
          processingError: "Verified transaction details do not match.",
        })
        .where(eq(paymentWebhookEvents.id, webhookEvent.id));

      return NextResponse.json({ received: true });
    }

    // Lock the contract first, then the payment.
    await db.transaction(async (tx) => {
      const [contract] = await tx
        .select()
        .from(contracts)
        .where(eq(contracts.id, payment.contractId))
        .for("update")
        .limit(1);

      const [lockedPayment] = await tx
        .select()
        .from(contractPayments)
        .where(eq(contractPayments.id, payment.id))
        .for("update")
        .limit(1);

      if (!contract || !lockedPayment) {
        throw new Error("Contract or payment record no longer exists.");
      }

      // Confirm the details again after acquiring the locks.
      if (
        lockedPayment.provider !== "paystack" ||
        lockedPayment.providerReference !== transaction.reference ||
        lockedPayment.currency !== transaction.currency ||
        toSmallestCurrencyUnit(lockedPayment.amount) !== transaction.amount
      ) {
        throw new Error("Payment details changed during verification.");
      }

      // Duplicate deliveries must not activate the contract twice.
      if (
        lockedPayment.status === "successful" &&
        contract.status === "active"
      ) {
        await tx
          .update(paymentWebhookEvents)
          .set({
            processingStatus: "processed",
            processedAt: new Date(),
            processingError: null,
          })
          .where(eq(paymentWebhookEvents.id, webhookEvent.id));

        return;
      }

      if (
        contract.status !== "awaiting_payment" ||
        (lockedPayment.status !== "initialized" &&
          lockedPayment.status !== "pending")
      ) {
        throw new Error("Contract or payment is not eligible for activation.");
      }

      const now = new Date();

      await tx
        .update(contractPayments)
        .set({
          status: "successful",
          paidAt: now,
          updatedAt: now,
        })
        .where(eq(contractPayments.id, lockedPayment.id));

      await tx
        .update(contracts)
        .set({
          status: "active",
          updatedAt: now,
        })
        .where(eq(contracts.id, contract.id));

      await tx
        .update(paymentWebhookEvents)
        .set({
          processingStatus: "processed",
          processedAt: now,
          processingError: null,
        })
        .where(eq(paymentWebhookEvents.id, webhookEvent.id));
    });

    revalidatePath(`/dashboard/contracts/${payment.contractId}`);
    revalidatePath("/dashboard/contracts");

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Paystack webhook processing failed:", error);

    return NextResponse.json(
      { message: "Webhook processing failed. Please retry." },
      { status: 500 },
    );
  }
}

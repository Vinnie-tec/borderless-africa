"use server";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireClient } from "@/lib/marketplace/authorization";
import { db } from "@/lib/db";
import { contractPayments, contracts, user } from "@/lib/db/schema";

type InitializePaymentResult =
  | {
      success: true;
      authorizationUrl: string;
      reference: string;
      message: string;
    }
  | {
      success: false;
      message: string;
    };

type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    reference: string;
  };
};

// Convert a decimal contract amount into the smallest currency unit.
// NGN = kobo, KES = cents, GHS = pesewas.

function toSmallestCurrencyUnit(amount: string): number {
  const normalizedAmount = amount.trim();

  if (!/^\d+(\.\d{1,2})?$/.test(normalizedAmount)) {
    throw new Error("Invalid contract amount.");
  }

  const [whole, fraction = ""] = normalizedAmount.split(".");

  const smallestUnit = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(smallestUnit) || smallestUnit <= 0) {
    throw new Error("Contract amount is outside the supported range.");
  }

  return smallestUnit;
}

export async function initializeContractPayment(
  contractId: unknown,
): Promise<InitializePaymentResult> {
  const session = await requireClient();

  if (
    typeof contractId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      contractId,
    )
  ) {
    return {
      success: false,
      message: "Invalid contract.",
    };
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    console.error("PAYSTACK_SECRET_KEY is not configured.");

    return {
      success: false,
      message: "Payment service is not configured.",
    };
  }

  try {
    // Reserve a payment attempt while holding the contract lock.
    const reservation = await db.transaction(async (tx) => {
      const [contract] = await tx
        .select()
        .from(contracts)
        .where(
          and(
            eq(contracts.id, contractId),
            eq(contracts.clientId, session.user.id),
          ),
        )
        .for("update")
        .limit(1);

      if (!contract) {
        return {
          success: false as const,
          message: "Contract not found or you do not have permission.",
        };
      }

      if (contract.status !== "awaiting_payment") {
        return {
          success: false as const,
          message: "This contract is not awaiting payment.",
        };
      }

      // A successful payment must never be charged again.
      const [successfulPayment] = await tx
        .select({ id: contractPayments.id })
        .from(contractPayments)
        .where(
          and(
            eq(contractPayments.contractId, contract.id),
            eq(contractPayments.status, "successful"),
          ),
        )
        .limit(1);

      if (successfulPayment) {
        return {
          success: false as const,
          message: "This contract has already been paid for.",
        };
      }

      // Reuse an existing active attempt instead of creating
      // another transaction that could charge the client twice.
      const [activePayment] = await tx
        .select()
        .from(contractPayments)
        .where(
          and(
            eq(contractPayments.contractId, contract.id),
            inArray(contractPayments.status, ["initialized", "pending"]),
          ),
        )
        .orderBy(desc(contractPayments.createdAt))
        .limit(1);

      if (activePayment) {
        if (activePayment.authorizationUrl) {
          return {
            success: true as const,
            authorizationUrl: activePayment.authorizationUrl,
            reference: activePayment.providerReference,
            existing: true as const,
          };
        }

        return {
          success: false as const,
          message:
            "A payment attempt is already being initialized. Please try again shortly.",
        };
      }

      const [client] = await tx
        .select({ email: user.email })
        .from(user)
        .where(eq(user.id, session.user.id))
        .limit(1);

      if (!client?.email) {
        return {
          success: false as const,
          message: "Your account must have an email address to make a payment.",
        };
      }

      const supportedCurrencies = ["NGN", "KES", "GHS"];

      if (!supportedCurrencies.includes(contract.currency)) {
        return {
          success: false as const,
          message: "This contract uses an unsupported payment currency.",
        };
      }

      const amount = toSmallestCurrencyUnit(String(contract.agreedPrice));

      const reference = `ba_${randomUUID().replaceAll("-", "")}`;

      const [payment] = await tx
        .insert(contractPayments)
        .values({
          contractId: contract.id,
          clientId: session.user.id,
          provider: "paystack",
          providerReference: reference,
          amount: String(contract.agreedPrice),
          currency: contract.currency,
          status: "initialized",
        })
        .returning({ id: contractPayments.id });

      return {
        success: true as const,
        paymentId: payment.id,
        reference,
        email: client.email,
        amount,
        currency: contract.currency,
        existing: false as const,
      };
    });

    if (!reservation.success) {
      return reservation;
    }

    // An existing pending attempt can be resumed.
    if (reservation.existing) {
      return {
        success: true,
        authorizationUrl: reservation.authorizationUrl,
        reference: reservation.reference,
        message: "Continue your existing payment.",
      };
    }

    // Initialize the transaction directly with Paystack.
    let response: Response;

    try {
      response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: reservation.email,
          amount: reservation.amount,
          currency: reservation.currency,
          reference: reservation.reference,
          callback_url: new URL(
            "/dashboard/contracts/payment/callback",
            process.env.NEXT_PUBLIC_APP_URL,
          ).toString(),
          metadata: {
            contractId,
            paymentId: reservation.paymentId,
          },
        }),
        cache: "no-store",
      });
    } catch {
      await db
        .update(contractPayments)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(contractPayments.id, reservation.paymentId));

      return {
        success: false,
        message: "Unable to contact the payment provider. Please try again.",
      };
    }

    const result = (await response.json()) as PaystackInitializeResponse;

    const authorizationUrl = result.data?.authorization_url;

    if (
      !response.ok ||
      !result.status ||
      result.data?.reference !== reservation.reference ||
      !authorizationUrl?.startsWith("https://checkout.paystack.com/")
    ) {
      await db
        .update(contractPayments)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(contractPayments.id, reservation.paymentId));

      console.error("Paystack initialization failed:", result.message);

      return {
        success: false,
        message: "We couldn't initialize your payment. Please try again.",
      };
    }

    // Store the checkout URL and mark the attempt as pending.
    await db
      .update(contractPayments)
      .set({
        status: "pending",
        authorizationUrl,
        updatedAt: new Date(),
      })
      .where(eq(contractPayments.id, reservation.paymentId));

    revalidatePath(`/dashboard/contracts/${contractId}`);

    return {
      success: true,
      authorizationUrl,
      reference: reservation.reference,
      message: "Payment initialized successfully.",
    };
  } catch (error) {
    console.error("Payment initialization failed:", error);

    return {
      success: false,
      message: "We couldn't initialize your payment. Please try again.",
    };
  }
}

export async function verifyContractPayment(reference: unknown) {
  const session = await requireClient();

  if (
    typeof reference !== "string" ||
    !reference.trim() ||
    reference.length > 100
  ) {
    return {
      success: false as const,
      message: "Invalid payment reference.",
    };
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    return {
      success: false as const,
      message: "Payment configuration is missing.",
    };
  }

  try {
    // Find the payment and ensure it belongs to this client.
    const [payment] = await db
      .select()
      .from(contractPayments)
      .where(
        and(
          eq(contractPayments.providerReference, reference),
          eq(contractPayments.clientId, session.user.id),
        ),
      )
      .limit(1);

    if (!payment || payment.provider !== "paystack") {
      return {
        success: false as const,
        message: "Payment record not found.",
      };
    }

    // Ask Paystack to verify the transaction.
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

    const result = (await response.json()) as {
      status: boolean;
      message?: string;
      data?: {
        status: string;
        reference: string;
        amount: number;
        currency: string;
      };
    };

    if (
      !response.ok ||
      !result.status ||
      !result.data
    ) {
      return {
        success: false as const,
        message: "Unable to verify this payment with Paystack.",
      };
    }

    const transaction = result.data;

    // Verify the actual transaction details.
    if (
      transaction.status !== "success" ||
      transaction.reference !== payment.providerReference ||
      transaction.amount !== toSmallestCurrencyUnit(payment.amount) ||
      transaction.currency !== payment.currency
    ) {
      return {
        success: false as const,
        message: "The payment details could not be verified.",
      };
    }

    // Lock the contract first, then the payment.
    // This keeps the locking order consistent with our payment workflow.
    const verification = await db.transaction(async (tx) => {
      const [contract] = await tx
        .select()
        .from(contracts)
        .where(
          and(
            eq(contracts.id, payment.contractId),
            eq(contracts.clientId, session.user.id),
          ),
        )
        .for("update")
        .limit(1);

      if (!contract) {
        return {
          success: false as const,
          message: "Contract not found.",
        };
      }

      const [lockedPayment] = await tx
        .select()
        .from(contractPayments)
        .where(eq(contractPayments.id, payment.id))
        .for("update")
        .limit(1);

      if (!lockedPayment) {
        return {
          success: false as const,
          message: "Payment record not found.",
        };
      }

      // Recheck the payment details after acquiring the locks.
      if (
        lockedPayment.clientId !== session.user.id ||
        lockedPayment.providerReference !== transaction.reference ||
        lockedPayment.provider !== "paystack" ||
        lockedPayment.currency !== transaction.currency ||
        toSmallestCurrencyUnit(lockedPayment.amount) !== transaction.amount
      ) {
        return {
          success: false as const,
          message: "Payment details no longer match.",
        };
      }

      // A repeated verification should be harmless.
      if (
        lockedPayment.status === "successful" &&
        contract.status === "active"
      ) {
        return {
          success: true as const,
          message: "Payment has already been verified.",
        };
      }

      if (contract.status !== "awaiting_payment") {
        return {
          success: false as const,
          message: "This contract is no longer awaiting payment.",
        };
      }

      if (
        lockedPayment.status !== "initialized" &&
        lockedPayment.status !== "pending"
      ) {
        return {
          success: false as const,
          message: "This payment attempt cannot be verified.",
        };
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

      return {
        success: true as const,
        message: "Payment verified successfully. Contract activated.",
      };
    });

    if (verification.success) {
      revalidatePath(`/dashboard/contracts/${payment.contractId}`);
      revalidatePath("/dashboard/contracts");
    }

    return verification;
  } catch (error) {
    console.error("Contract payment verification failed:", error);

    return {
      success: false as const,
      message: "Something went wrong while verifying payment.",
    };
  }
}
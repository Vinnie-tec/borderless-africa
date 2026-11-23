"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { verifyContractPayment } from "@/app/dashboard/contracts/actions";

type PaymentCallbackProps = {
  reference: string | null;
};

export function PaymentCallback({
  reference,
}: PaymentCallbackProps) {
  const [status, setStatus] = useState<
    "checking" | "success" | "error"
  >("checking");

  const [message, setMessage] = useState(
    "Verifying your payment with Paystack...",
  );

  useEffect(() => {
    let isActive = true;

    async function verifyPayment() {
      if (!reference) {
        setStatus("error");
        setMessage("No payment reference was provided.");
        return;
      }

      try {
        const result = await verifyContractPayment(reference);

        if (!isActive) return;

        setStatus(result.success ? "success" : "error");
        setMessage(result.message);
      } catch {
        if (!isActive) return;

        setStatus("error");
        setMessage(
          "We couldn't verify your payment. Please try again.",
        );
      }
    }

    verifyPayment();

    return () => {
      isActive = false;
    };
  }, [reference]);

  return (
    <main>
      <h1>
        {status === "checking"
          ? "Verifying payment"
          : status === "success"
            ? "Payment successful"
            : "Payment verification"}
      </h1>

      <p aria-live="polite">{message}</p>

      {status !== "checking" && (
        <Link href="/dashboard/contracts">
          Return to contracts
        </Link>
      )}
    </main>
  );
}
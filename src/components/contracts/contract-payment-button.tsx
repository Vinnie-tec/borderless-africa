"use client";

import { useState } from "react";
import { useToast } from "@/components/toast/toast-provider";
import { initializeContractPayment } from "@/app/dashboard/contracts/actions";

type ContractPaymentButtonProps = {
  contractId: string;
};

export function ContractPaymentButton({
  contractId,
}: ContractPaymentButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const toast = useToast();

  async function handlePayment() {
    setIsPending(true);

    try {
      const result = await initializeContractPayment(contractId);

      if (result.success === false) {
        toast.error("Payment initialization failed", {
          description: result.message,
        });
        return;
      }

      window.location.assign(result.authorizationUrl);

      // Redirect the client to Paystack's hosted checkout.
      window.location.assign(result.authorizationUrl);
    } catch {
      toast.error("Something went wrong", {
        description: "We couldn't initialize your payment. Please try again.",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button type="button" onClick={handlePayment} disabled={isPending}>
      {isPending ? "Preparing payment..." : "Pay for contract"}
    </button>
  );
}

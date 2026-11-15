
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { applyDisputeOutcome } from "@/lib/marketplace/contracts/admin-dispute-actions";
import { useToast } from "@/components/toast/toast-provider";

type Props = {
  disputeId: string;
};

export function DisputeOutcomeControls({ disputeId }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [pending, setPending] = useState<
    "cancel_contract" | "resume_contract" | null
  >(null);

  async function handleOutcome(
    outcome: "cancel_contract" | "resume_contract"
  ) {
    const confirmation =
      outcome === "cancel_contract"
        ? "Cancel this contract? This changes its status but does not issue a refund or payout."
        : "Resume this contract using its previous status?";

    if (!window.confirm(confirmation)) return;

    setPending(outcome);

    try {
      const result = await applyDisputeOutcome({
        disputeId,
        outcome,
      });

      if (!result.success) {
        toast.error("Unable to apply outcome", {
          description: result.message,
        });
        return;
      }

      toast.success("Contract outcome applied", {
        description:
          outcome === "cancel_contract"
            ? "The contract has been cancelled."
            : "The contract has been restored to its previous status.",
      });

      router.refresh();
    } catch {
      toast.error("Something went wrong", {
        description: "Please try again.",
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <section>
      <h3>Apply contract outcome</h3>

      <p>
        The dispute has been resolved. Choose what should happen to
        the contract based on the recorded decision.
      </p>

      <button
        type="button"
        disabled={pending !== null}
        onClick={() => handleOutcome("resume_contract")}
      >
        {pending === "resume_contract"
          ? "Restoring..."
          : "Resume contract"}
      </button>

      <button
        type="button"
        disabled={pending !== null}
        onClick={() => handleOutcome("cancel_contract")}
      >
        {pending === "cancel_contract"
          ? "Cancelling..."
          : "Cancel contract"}
      </button>
    </section>
  );
}

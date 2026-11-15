
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  startDisputeReview,
  resolveDispute,
} from "@/lib/marketplace/contracts/admin-dispute-actions";

import { useToast } from "@/components/toast/toast-provider";

type Props = {
  disputeId: string;
  status: "open" | "under_review" | "resolved";
};

export function DisputeReviewControls({
  disputeId,
  status,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const [pending, setPending] = useState(false);
  const [decision, setDecision] = useState("");
  const [resolution, setResolution] = useState("");

  async function handleStartReview() {
    setPending(true);

    try {
      const result = await startDisputeReview({ disputeId });

      if (!result.success) {
        toast.error("Unable to start review", {
          description: result.message,
        });
        return;
      }

      toast.success("Dispute moved into review");
      router.refresh();
    } catch {
      toast.error("Something went wrong", {
        description: "Please try again.",
      });
    } finally {
      setPending(false);
    }
  }

  async function handleResolve() {
    if (
      !window.confirm(
        "Resolve this dispute? Make sure your decision and reasoning are accurate."
      )
    ) {
      return;
    }

    setPending(true);

    try {
      const result = await resolveDispute({
        disputeId,
        decision,
        resolution,
      });

      if (!result.success) {
        toast.error("Unable to resolve dispute", {
          description: result.message,
        });
        return;
      }

      toast.success("Dispute resolved", {
        description: "The administrative decision has been recorded.",
      });

      router.refresh();
    } catch {
      toast.error("Something went wrong", {
        description: "Please try again.",
      });
    } finally {
      setPending(false);
    }
  }

  if (status === "resolved") {
    return (
      <section>
        <h3>Review completed</h3>
        <p>This dispute has already been resolved.</p>
      </section>
    );
  }

  if (status === "open") {
    return (
      <section>
        <h3>Begin administrative review</h3>

        <p>
          Move this dispute into review before recording a decision.
        </p>

        <button
          type="button"
          disabled={pending}
          onClick={handleStartReview}
        >
          {pending ? "Processing..." : "Start review"}
        </button>
      </section>
    );
  }

  return (
    <section>
      <h3>Record final decision</h3>

      <label htmlFor="dispute-decision">
        Decision
      </label>

      <input
        id="dispute-decision"
        value={decision}
        onChange={(event) => setDecision(event.target.value)}
        placeholder="e.g. Client's claim upheld"
        maxLength={100}
      />

      <label htmlFor="dispute-resolution">
        Reasoned explanation
      </label>

      <textarea
        id="dispute-resolution"
        value={resolution}
        onChange={(event) => setResolution(event.target.value)}
        placeholder="Explain the evidence considered and why this decision was reached..."
        rows={7}
      />

      <button
        type="button"
        disabled={
          pending ||
          decision.trim().length < 3 ||
          decision.trim().length > 100 ||
          resolution.trim().length < 20 ||
          resolution.trim().length > 5000
        }
        onClick={handleResolve}
      >
        {pending ? "Resolving..." : "Resolve dispute"}
      </button>
    </section>
  );
}

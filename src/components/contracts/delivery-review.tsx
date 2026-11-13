
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/toast/toast-provider";
import { reviewDelivery } from "@/lib/marketplace/contracts/review-actions";

type DeliveryReviewProps = {
  contractId: string;
  revisionsUsed: number;
  revisionAllowance: number;
};

export default function DeliveryReview({
  contractId,
  revisionsUsed,
  revisionAllowance,
}: DeliveryReviewProps) {
  const router = useRouter();
  const toast = useToast();

  const [message, setMessage] = useState("");
  const [isPending, setIsPending] = useState(false);

  const remainingRevisions = Math.max(
    revisionAllowance - revisionsUsed,
    0
  );

  async function handleReview(
    decision: "approve" | "request_revision"
  ) {
    if (isPending) return;

    if (decision === "request_revision" && message.trim().length < 10) {
      toast.error("More feedback needed", {
        description: "Explain the requested changes in at least 10 characters.",
      });
      return;
    }

    const confirmed = window.confirm(
      decision === "approve"
        ? "Approve this delivery and complete the contract?"
        : "Request a revision for this delivery?"
    );

    if (!confirmed) return;

    setIsPending(true);

    try {
      const result = await reviewDelivery({
        contractId,
        decision,
        message,
      });

      if (!result.success) {
        toast.error("Review not submitted", {
          description: result.message,
        });
        return;
      }

      toast.success(
        decision === "approve" ? "Delivery approved" : "Revision requested",
        { description: result.message }
      );

      setMessage("");
      router.refresh();
    } catch {
      toast.error("Something went wrong", {
        description: "Please try again in a moment.",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section>
      <h2>Review delivery</h2>

      <p>
        Revisions used: {revisionsUsed} of {revisionAllowance}
      </p>

      <p>Remaining revisions: {remainingRevisions}</p>

      <div>
        <label htmlFor={`review-message-${contractId}`}>
          Feedback (optional for approval, required for a revision)
        </label>

        <textarea
          id={`review-message-${contractId}`}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          minLength={0}
          maxLength={5000}
          rows={5}
          placeholder="Share your feedback about the submitted work..."
          disabled={isPending}
        />
      </div>

      <div>
        <button
          type="button"
          onClick={() => handleReview("approve")}
          disabled={isPending}
        >
          {isPending ? "Processing..." : "Approve delivery"}
        </button>

        <button
          type="button"
          onClick={() => handleReview("request_revision")}
          disabled={isPending || remainingRevisions === 0}
        >
          {remainingRevisions === 0
            ? "Revision allowance exhausted"
            : isPending
              ? "Processing..."
              : "Request revision"}
        </button>
      </div>
    </section>
  );
}

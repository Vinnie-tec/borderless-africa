
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { closeJob, cancelJob } from "@/app/admin/jobs/actions";
import { useToast } from "@/components/toast/toast-provider";

type JobModerationControlProps = {
  jobId: string;
  status: string;
  hasContract: boolean;
};

export function JobModerationControl({
  jobId,
  status,
  hasContract,
}: JobModerationControlProps) {
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const router = useRouter();
  const toast = useToast();

  const canClose = status === "open";
  const canCancel = ["draft", "open", "closed"].includes(status);

  if (hasContract) {
    return (
      <section>
        <h2>Job moderation</h2>
        <p>
          This job has an associated contract. Ordinary job moderation is
          unavailable. Use the contract and dispute workflows where necessary.
        </p>
      </section>
    );
  }

  if (!canClose && !canCancel) {
    return (
      <section>
        <h2>Job moderation</h2>
        <p>No moderation actions are available for this job&apos;s current status.</p>
      </section>
    );
  }

  function handleModeration(action: "close" | "cancel") {
    const trimmedReason = reason.trim();

    if (trimmedReason.length < 10 || trimmedReason.length > 500) {
      toast.error("Invalid moderation reason", {
        description: "Enter between 10 and 500 characters.",
      });
      return;
    }

    const actionLabel = action === "close" ? "close" : "cancel";

    if (
      !window.confirm(
        `Are you sure you want to ${actionLabel} this job? This action will be recorded in the admin audit log.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result =
        action === "close"
          ? await closeJob(jobId, trimmedReason)
          : await cancelJob(jobId, trimmedReason);

      if (!result.success) {
        toast.error("Moderation failed", {
          description: result.message,
        });
        return;
      }

      toast.success("Job moderated", {
        description: result.message,
      });

      setReason("");
      router.refresh();
    });
  }

  return (
    <section>
      <h2>Job moderation</h2>

      <p>
        Closing or cancelling a job preserves its proposals and negotiation
        history.
      </p>

      <label htmlFor="moderation-reason">
        Moderation reason
      </label>

      <textarea
        id="moderation-reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Explain why this job is being moderated..."
        minLength={10}
        maxLength={500}
        rows={4}
        disabled={isPending}
      />

      <p>{reason.trim().length}/500 characters</p>

      <div>
        {canClose && (
          <button
            type="button"
            disabled={isPending || reason.trim().length < 10}
            onClick={() => handleModeration("close")}
          >
            {isPending ? "Processing..." : "Close job"}
          </button>
        )}

        {canCancel && (
          <button
            type="button"
            disabled={isPending || reason.trim().length < 10}
            onClick={() => handleModeration("cancel")}
          >
            {isPending ? "Processing..." : "Cancel job"}
          </button>
        )}
      </div>
    </section>
  );
}

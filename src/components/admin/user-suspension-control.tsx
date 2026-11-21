
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  reactivateUser,
  suspendUser,
} from "@/app/admin/users/suspension-actions";
import { useToast } from "@/components/toast/toast-provider";

type UserSuspensionControlProps = {
  userId: string;
  isSuspended: boolean;
  banReason: string | null;
  isCurrentUser: boolean;
};

export function UserSuspensionControl({
  userId,
  isSuspended: initialSuspended,
  banReason,
  isCurrentUser,
}: UserSuspensionControlProps) {
  const [isSuspended, setIsSuspended] = useState(initialSuspended);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const router = useRouter();
  const toast = useToast();

  function handleSuspend() {
    const cleanReason = reason.trim();

    if (!cleanReason) {
      toast.error("A suspension reason is required.");
      return;
    }

    startTransition(async () => {
      const result = await suspendUser({
        userId,
        reason: cleanReason,
      });

      if (!result.success) {
        toast.error("Could not suspend account", {
          description: result.error,
        });
        return;
      }

      setIsSuspended(true);
      setShowReasonInput(false);
      setReason("");

      toast.success("Account suspended successfully.");
      router.refresh();
    });
  }

  function handleReactivate() {
    startTransition(async () => {
      const result = await reactivateUser(userId);

      if (!result.success) {
        toast.error("Could not reactivate account", {
          description: result.error,
        });
        return;
      }

      setIsSuspended(false);

      toast.success("Account reactivated successfully.");
      router.refresh();
    });
  }

  if (isCurrentUser) {
    return <span>Current account</span>;
  }

  return (
    <div>
      {isSuspended ? (
        <div>
          <span>Suspended</span>

          {banReason && <p>Reason: {banReason}</p>}

          <button
            type="button"
            onClick={handleReactivate}
            disabled={isPending}
          >
            {isPending ? "Reactivating..." : "Reactivate"}
          </button>
        </div>
      ) : (
        <div>
          {!showReasonInput ? (
            <button
              type="button"
              onClick={() => setShowReasonInput(true)}
              disabled={isPending}
            >
              Suspend account
            </button>
          ) : (
            <div>
              <label htmlFor={`suspension-reason-${userId}`}>
                Reason for suspension
              </label>

              <textarea
                id={`suspension-reason-${userId}`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Explain why this account is being suspended..."
                disabled={isPending}
              />

              <p>{reason.length}/500 characters</p>

              <button
                type="button"
                onClick={handleSuspend}
                disabled={isPending || !reason.trim()}
              >
                {isPending ? "Suspending..." : "Confirm suspension"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowReasonInput(false);
                  setReason("");
                }}
                disabled={isPending}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  requestContractCancellation,
  respondToCancellationRequest,
} from "@/lib/marketplace/contracts/cancellation-actions";

import { useToast } from "@/components/toast/toast-provider";

type PendingCancellationRequest = {
  id: string;
  requesterId: string;
  reason: string;
  responseDeadline: string;
};

type CancellationPanelProps = {
  contractId: string;
  currentUserId: string;
  clientId: string;
  freelancerId: string;
  contractStatus: string;
  pendingRequest: PendingCancellationRequest | null;
};

export function CancellationPanel({
  contractId,
  currentUserId,
  clientId,
  freelancerId,
  contractStatus,
  pendingRequest,
}: CancellationPanelProps) {
  const router = useRouter();
  const toast = useToast();

  const [reason, setReason] = useState("");
  const [responseMessage, setResponseMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<
    "request" | "accept" | "reject" | null
  >(null);

  const isParticipant =
    currentUserId === clientId || currentUserId === freelancerId;

  const isRequester = pendingRequest?.requesterId === currentUserId;

  const canRequestCancellation = [
    "awaiting_payment",
    "active",
    "delivered",
    "revision_requested",
  ].includes(contractStatus);

  async function handleRequestCancellation() {
    setPendingAction("request");

    try {
      const result = await requestContractCancellation({
        contractId,
        reason,
      });

      if (!result.success) {
        toast.error("Cancellation request failed", {
          description: result.message,
        });
        return;
      }

      toast.success("Cancellation request submitted", {
        description: "The other participant has three days to respond.",
      });

      setReason("");
      router.refresh();
    } catch {
      toast.error("Something went wrong", {
        description: "Please try again.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleResponse(decision: "accept" | "reject") {
    if (!pendingRequest) return;

    if (
      decision === "accept" &&
      !window.confirm(
        "Accept this cancellation request? The contract will be marked as cancelled.",
      )
    ) {
      return;
    }

    if (
      decision === "reject" &&
      !window.confirm(
        "Reject this cancellation request? This will open a dispute for admin review.",
      )
    ) {
      return;
    }

    setPendingAction(decision);

    try {
      const result = await respondToCancellationRequest({
        requestId: pendingRequest.id,
        decision,
        message: responseMessage,
      });

      if (!result.success) {
        toast.error("Unable to process response", {
          description: result.message,
        });
        return;
      }

      if (result.outcome === "accepted") {
        toast.success("Cancellation accepted", {
          description: "The contract has been marked as cancelled.",
        });
      } else {
        toast.success("Cancellation rejected", {
          description: "A dispute has been opened for admin review.",
        });
      }

      setResponseMessage("");
      router.refresh();
    } catch {
      toast.error("Something went wrong", {
        description: "Please try again.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  if (!isParticipant) return null;

  if (contractStatus === "cancelled") {
    return (
      <section>
        <h3>Contract cancelled</h3>
        <p>This contract has been marked as cancelled.</p>
      </section>
    );
  }

  if (contractStatus === "disputed") {
    return (
      <section>
        <h3>Contract under dispute</h3>
        <p>This contract is awaiting administrative review.</p>
      </section>
    );
  }

  if (pendingRequest) {
    return (
      <section>
        <h3>Cancellation request</h3>

        <p>Requested by: {isRequester ? "You" : "The other participant"}</p>

        <p>Reason: {pendingRequest.reason}</p>

        <p>
          Response deadline:{" "}
          {new Date(pendingRequest.responseDeadline).toLocaleString()}
        </p>

        {isRequester ? (
          <p>Your request is awaiting the other participant&apos;s response.</p>
        ) : (
          <>
            <p>You need to respond to this cancellation request.</p>

            <label htmlFor="cancellation-response">Response explanation</label>

            <textarea
              id="cancellation-response"
              value={responseMessage}
              onChange={(event) => setResponseMessage(event.target.value)}
              placeholder="Explain your response..."
              rows={4}
            />

            <button
              type="button"
              disabled={
                pendingAction !== null ||
                (responseMessage.trim().length > 0 &&
                  responseMessage.trim().length < 10) ||
                responseMessage.trim().length > 5000
              }
              onClick={() => handleResponse("accept")}
            >
              {pendingAction === "accept"
                ? "Processing..."
                : "Accept cancellation"}
            </button>

            <button
              type="button"
              disabled={
                pendingAction !== null ||
                responseMessage.trim().length < 10 ||
                responseMessage.trim().length > 5000
              }
              onClick={() => handleResponse("reject")}
            >
              {pendingAction === "reject"
                ? "Processing..."
                : "Reject and escalate"}
            </button>
          </>
        )}
      </section>
    );
  }

  if (!canRequestCancellation) return null;

  return (
    <section>
      <h3>Request contract cancellation</h3>

      <p>
        Either participant can request cancellation. The other participant will
        have three days to respond.
      </p>

      <label htmlFor="cancellation-reason">Reason for cancellation</label>

      <textarea
        id="cancellation-reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Explain why you want to cancel this contract..."
        rows={5}
      />

      <button
        type="button"
        disabled={
          pendingAction !== null ||
          reason.trim().length < 20 ||
          reason.trim().length > 5000
        }
        onClick={handleRequestCancellation}
      >
        {pendingAction === "request" ? "Submitting..." : "Request cancellation"}
      </button>
    </section>
  );
}

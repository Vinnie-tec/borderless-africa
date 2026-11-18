"use server";

import { revalidatePath } from "next/cache";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { contracts, cancellationRequests, disputes } from "@/lib/db/schema";
import { requireVerifiedUser } from "@/lib/auth-helpers";
import { createNotification } from "@/lib/notifications/service";

const THREE_DAYS_IN_MS = 3 * 24 * 60 * 60 * 1000;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CancellationActionResult =
  | {
      success: true;
      requestId: string;
      responseDeadline: Date;
    }
  | {
      success: false;
      message: string;
    };

type RespondToCancellationResult =
  | {
      success: true;
      outcome: "accepted" | "rejected";
      disputeId?: string;
    }
  | {
      success: false;
      message: string;
    };

export async function requestContractCancellation(
  input: unknown,
): Promise<CancellationActionResult> {
  try {
    // 1. Require an authenticated and verified account.
    const session = await requireVerifiedUser();
    const userId = session.user.id;

    // 2. Validate the incoming data.
    if (!input || typeof input !== "object") {
      return {
        success: false,
        message: "Invalid cancellation request.",
      };
    }

    const data = input as {
      contractId?: unknown;
      reason?: unknown;
    };

    const contractId =
      typeof data.contractId === "string" ? data.contractId.trim() : "";

    const reason = typeof data.reason === "string" ? data.reason.trim() : "";

    if (!UUID_REGEX.test(contractId)) {
      return {
        success: false,
        message: "Invalid contract ID.",
      };
    }

    if (reason.length < 20 || reason.length > 5000) {
      return {
        success: false,
        message: "Cancellation reason must be between 20 and 5000 characters.",
      };
    }

    // 3. Perform all database changes inside one transaction.
    const result = await db.transaction(async (tx) => {
      // Lock the contract row. This serializes cancellation requests
      // targeting the same contract.
      const [contract] = await tx
        .select({
          id: contracts.id,
          clientId: contracts.clientId,
          freelancerId: contracts.freelancerId,
          title: contracts.title,
          status: contracts.status,
        })
        .from(contracts)
        .where(eq(contracts.id, contractId))
        .for("update");

      if (!contract) {
        return {
          success: false as const,
          message: "Contract not found.",
        };
      }

      // 4. Only the contract's client or freelancer may request cancellation.
      const isParticipant =
        contract.clientId === userId || contract.freelancerId === userId;

      if (!isParticipant) {
        return {
          success: false as const,
          message: "You are not authorized to cancel this contract.",
        };
      }

      // 5. Only allow cancellation from valid contract states.
      const cancellableStatuses = [
        "awaiting_payment",
        "active",
        "delivered",
        "revision_requested",
      ] as const;

      if (
        !cancellableStatuses.includes(
          contract.status as (typeof cancellableStatuses)[number],
        )
      ) {
        return {
          success: false as const,
          message: "This contract cannot be cancelled in its current state.",
        };
      }

      // 6. Calculate the response deadline using server time.
      const now = new Date();
      const responseDeadline = new Date(now.getTime() + THREE_DAYS_IN_MS);

      // 7. Create the cancellation request.
      const [request] = await tx
        .insert(cancellationRequests)
        .values({
          contractId: contract.id,
          requesterId: userId,
          reason,
          previousContractStatus: contract.status,
          responseDeadline,
        })
        .returning({
          id: cancellationRequests.id,
        });

      // 8. Move the contract into its pending cancellation state.
      await tx
        .update(contracts)
        .set({
          status: "cancellation_pending",
          updatedAt: now,
        })
        .where(eq(contracts.id, contract.id));

      // Notify the other contract participant.
      const recipientId =
        userId === contract.clientId
          ? contract.freelancerId
          : contract.clientId;

      await createNotification(tx, {
        recipientId,
        actorId: userId,
        type: "cancellation_requested",
        title: "Contract cancellation requested",
        message: `The other participant has requested cancellation of "${contract.title}". Please respond within three days.`,
        href: `/dashboard/contracts/${contract.id}`,
        entityType: "contract",
        entityId: contract.id,
        metadata: {
          cancellationRequestId: request.id,
          responseDeadline: responseDeadline.toISOString(),
        },
        dedupeKey: `cancellation-requested:${request.id}`,
      });

      return {
        success: true as const,
        requestId: request.id,
        responseDeadline,
      };
    });

    if (!result.success) {
      return result;
    }

    // 9. Refresh the relevant server-rendered pages.
    revalidatePath("/dashboard/contracts");
    revalidatePath(`/dashboard/contracts/${contractId}`);

    return result;
  } catch (error) {
    console.error("Request contract cancellation error:", error);

    return {
      success: false,
      message: "Unable to submit the cancellation request. Please try again.",
    };
  }
}

export async function respondToCancellationRequest(
  input: unknown,
): Promise<RespondToCancellationResult> {
  try {
    const session = await requireVerifiedUser();
    const userId = session.user.id;

    if (!input || typeof input !== "object") {
      return {
        success: false,
        message: "Invalid response.",
      };
    }

    const data = input as {
      requestId?: unknown;
      decision?: unknown;
      message?: unknown;
    };

    const requestId =
      typeof data.requestId === "string" ? data.requestId.trim() : "";

    const decision = data.decision;

    const message = typeof data.message === "string" ? data.message.trim() : "";

    if (!UUID_REGEX.test(requestId)) {
      return {
        success: false,
        message: "Invalid cancellation request ID.",
      };
    }

    if (decision !== "accept" && decision !== "reject") {
      return {
        success: false,
        message: "Invalid cancellation decision.",
      };
    }

    if (
      decision === "reject" &&
      (message.length < 10 || message.length > 5000)
    ) {
      return {
        success: false,
        message:
          "Please provide a rejection reason between 10 and 5000 characters.",
      };
    }

    const result = await db.transaction(async (tx) => {
      // Find the contract ID associated with this request.
      const [initialRequest] = await tx
        .select({
          contractId: cancellationRequests.contractId,
        })
        .from(cancellationRequests)
        .where(eq(cancellationRequests.id, requestId))
        .limit(1);

      if (!initialRequest) {
        return {
          success: false as const,
          message: "Cancellation request not found.",
        };
      }

      // Always acquire locks in contract -> request order.
      // This keeps lock ordering consistent with the request action.
      const [contract] = await tx
        .select({
          id: contracts.id,
          clientId: contracts.clientId,
          freelancerId: contracts.freelancerId,
          title: contracts.title,
          status: contracts.status,
        })
        .from(contracts)
        .where(eq(contracts.id, initialRequest.contractId))
        .for("update");

      if (!contract) {
        return {
          success: false as const,
          message: "Contract not found.",
        };
      }

      const [request] = await tx
        .select()
        .from(cancellationRequests)
        .where(
          and(
            eq(cancellationRequests.id, requestId),
            eq(cancellationRequests.contractId, contract.id),
          ),
        )
        .for("update");

      if (!request || request.status !== "pending") {
        return {
          success: false as const,
          message: "This cancellation request is no longer pending.",
        };
      }

      // The person who requested cancellation cannot respond to it.
      if (request.requesterId === userId) {
        return {
          success: false as const,
          message: "You cannot respond to your own cancellation request.",
        };
      }

      const isParticipant =
        contract.clientId === userId || contract.freelancerId === userId;

      if (!isParticipant) {
        return {
          success: false as const,
          message: "You are not authorized to respond to this request.",
        };
      }

      if (contract.status !== "cancellation_pending") {
        return {
          success: false as const,
          message: "The contract is no longer awaiting cancellation.",
        };
      }

      const now = new Date();

      if (now > request.responseDeadline) {
        return {
          success: false as const,
          message:
            "The response deadline has passed. This request must be escalated for review.",
        };
      }

      if (decision === "accept") {
        await tx
          .update(cancellationRequests)
          .set({
            status: "accepted",
            responseMessage: message || null,
            respondedAt: now,
          })
          .where(eq(cancellationRequests.id, request.id));

        await tx
          .update(contracts)
          .set({
            status: "cancelled",
            updatedAt: now,
          })
          .where(eq(contracts.id, contract.id));
        await createNotification(tx, {
          recipientId: request.requesterId,
          actorId: userId,
          type: "cancellation_responded",
          title: "Cancellation request accepted",
          message: `Your cancellation request for "${contract.title}" was accepted.`,
          href: `/dashboard/contracts/${contract.id}`,
          entityType: "contract",
          entityId: contract.id,
          metadata: {
            cancellationRequestId: request.id,
            outcome: "accepted",
          },
          dedupeKey: `cancellation-responded:${request.id}`,
        });
        return {
          success: true as const,
          outcome: "accepted" as const,
          contractId: contract.id,
        };
      }

      // Rejection automatically opens a dispute.
      const [dispute] = await tx
        .insert(disputes)
        .values({
          contractId: contract.id,
          cancellationRequestId: request.id,
          openedById: request.requesterId,
          origin: "cancellation",
          reason: [
            `Cancellation request: ${request.reason}`,
            `Response from the other participant: ${message}`,
          ].join("\n\n"),
        })
        .returning({
          id: disputes.id,
        });

      await tx
        .update(cancellationRequests)
        .set({
          status: "rejected",
          responseMessage: message,
          respondedAt: now,
        })
        .where(eq(cancellationRequests.id, request.id));

      await tx
        .update(contracts)
        .set({
          status: "disputed",
          updatedAt: now,
        })
        .where(eq(contracts.id, contract.id));

      // Notify the requester that their cancellation request was rejected.
      await createNotification(tx, {
        recipientId: request.requesterId,
        actorId: userId,
        type: "cancellation_responded",
        title: "Cancellation request rejected",
        message: `Your cancellation request for "${contract.title}" was rejected. A dispute has been opened for review.`,
        href: `/dashboard/disputes/${dispute.id}`,
        entityType: "dispute",
        entityId: dispute.id,
        metadata: {
          cancellationRequestId: request.id,
          outcome: "rejected",
        },
        dedupeKey: `cancellation-responded:${request.id}`,
      });

      // Notify the requester that the dispute is now open.
      await createNotification(tx, {
        recipientId: request.requesterId,
        actorId: userId,
        type: "dispute_opened",
        title: "A dispute has been opened",
        message: `A dispute concerning "${contract.title}" is now open. You can provide your explanation and evidence.`,
        href: `/dashboard/disputes/${dispute.id}`,
        entityType: "dispute",
        entityId: dispute.id,
        metadata: {
          cancellationRequestId: request.id,
        },
        dedupeKey: `dispute-opened:${dispute.id}:${request.requesterId}`,
      });

      return {
        success: true as const,
        outcome: "rejected" as const,
        disputeId: dispute.id,
        contractId: contract.id,
      };
    });

    if (!result.success) {
      return result;
    }

    revalidatePath("/dashboard/contracts");
    revalidatePath(`/dashboard/contracts/${result.contractId}`);

    if (result.outcome === "rejected") {
      revalidatePath("/admin/disputes");
    }

    return {
      success: true,
      outcome: result.outcome,
      ...(result.outcome === "rejected" ? { disputeId: result.disputeId } : {}),
    };
  } catch (error) {
    console.error("Respond to cancellation request error:", error);

    return {
      success: false,
      message: "Unable to process your response. Please try again.",
    };
  }
}

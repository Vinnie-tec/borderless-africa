"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  disputes,
  disputeEvents,
  cancellationRequests,
  contracts,
} from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";

import { createNotification } from "@/lib/notifications/service";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AdminDisputeResult =
  | { success: true }
  | { success: false; message: string };

export async function startDisputeReview(
  input: unknown,
): Promise<AdminDisputeResult> {
  try {
    const session = await requireAdmin();

    if (!input || typeof input !== "object") {
      return { success: false, message: "Invalid request." };
    }

    const disputeId = (input as { disputeId?: unknown }).disputeId;

    if (typeof disputeId !== "string" || !UUID_REGEX.test(disputeId)) {
      return { success: false, message: "Invalid dispute ID." };
    }

    const result = await db.transaction(async (tx) => {
      const [dispute] = await tx
        .select({
          id: disputes.id,
          contractId: disputes.contractId,
          status: disputes.status,
        })
        .from(disputes)
        .where(eq(disputes.id, disputeId))
        .for("update");

      if (!dispute) {
        return {
          success: false as const,
          message: "Dispute not found.",
        };
      }

      if (dispute.status !== "open") {
        return {
          success: false as const,
          message: "Only open disputes can be moved into review.",
        };
      }

      const [contract] = await tx
        .select({
          id: contracts.id,
          clientId: contracts.clientId,
          freelancerId: contracts.freelancerId,
          title: contracts.title,
        })
        .from(contracts)
        .where(eq(contracts.id, dispute.contractId))
        .limit(1);

      if (!contract) {
        return {
          success: false as const,
          message: "Associated contract not found.",
        };
      }

      const now = new Date();

      await tx
        .update(disputes)
        .set({
          status: "under_review",
          updatedAt: now,
        })
        .where(eq(disputes.id, dispute.id));

      await tx.insert(disputeEvents).values({
        disputeId: dispute.id,
        actorId: session.user.id,
        action: "review_started",
        details: "An administrator moved the dispute into review.",
      });

      const participants = [contract.clientId, contract.freelancerId];

      for (const recipientId of participants) {
        await createNotification(tx, {
          recipientId,
          actorId: session.user.id,
          type: "dispute_review_started",
          title: "Dispute review started",
          message: `An administrator has started reviewing the dispute concerning "${contract.title}". You can follow its progress here.`,
          href: `/dashboard/disputes/${dispute.id}`,
          entityType: "dispute",
          entityId: dispute.id,
          dedupeKey: `dispute-review-started:${dispute.id}:${recipientId}`,
        });
      }

      return { success: true as const };
    });

    if (!result.success) return result;

    revalidatePath("/admin/disputes");
    revalidatePath(`/admin/disputes/${disputeId}`);

    return { success: true };
  } catch (error) {
    console.error("Start dispute review error:", error);

    return {
      success: false,
      message: "Unable to start dispute review.",
    };
  }
}

export async function resolveDispute(
  input: unknown,
): Promise<AdminDisputeResult> {
  try {
    const session = await requireAdmin();

    if (!input || typeof input !== "object") {
      return { success: false, message: "Invalid request." };
    }

    const data = input as {
      disputeId?: unknown;
      decision?: unknown;
      resolution?: unknown;
    };

    const disputeId =
      typeof data.disputeId === "string" ? data.disputeId.trim() : "";

    const decision =
      typeof data.decision === "string" ? data.decision.trim() : "";

    const resolution =
      typeof data.resolution === "string" ? data.resolution.trim() : "";

    if (!UUID_REGEX.test(disputeId)) {
      return { success: false, message: "Invalid dispute ID." };
    }

    if (decision.length < 3 || decision.length > 100) {
      return {
        success: false,
        message: "Decision must be between 3 and 100 characters.",
      };
    }

    if (resolution.length < 20 || resolution.length > 5000) {
      return {
        success: false,
        message: "Resolution must be between 20 and 5000 characters.",
      };
    }

    const result = await db.transaction(async (tx) => {
      const [dispute] = await tx
        .select({
          id: disputes.id,
          contractId: disputes.contractId,
          status: disputes.status,
        })
        .from(disputes)
        .where(eq(disputes.id, disputeId))
        .for("update");

      if (!dispute) {
        return {
          success: false as const,
          message: "Dispute not found.",
        };
      }

      if (dispute.status !== "under_review") {
        return {
          success: false as const,
          message: "Only disputes under review can be resolved.",
        };
      }

      const [contract] = await tx
  .select({
    id: contracts.id,
    clientId: contracts.clientId,
    freelancerId: contracts.freelancerId,
    title: contracts.title,
  })
  .from(contracts)
  .where(eq(contracts.id, dispute.contractId))
  .limit(1);

if (!contract) {
  return {
    success: false as const,
    message: "Associated contract not found.",
  };
}

      const now = new Date();

      await tx
        .update(disputes)
        .set({
          status: "resolved",
          decision,
          resolution,
          decidedById: session.user.id,
          decidedAt: now,
          updatedAt: now,
        })
        .where(eq(disputes.id, dispute.id));

      await tx.insert(disputeEvents).values({
        disputeId: dispute.id,
        actorId: session.user.id,
        action: "dispute_resolved",
        details: `Decision: ${decision}. Resolution: ${resolution}`,
      });

      const participants = [
  contract.clientId,
  contract.freelancerId,
];

for (const recipientId of participants) {
  await createNotification(tx, {
    recipientId,
    actorId: session.user.id,
    type: "dispute_resolved",
    title: "Dispute resolved",
    message: `An administrator has resolved the dispute concerning "${contract.title}". Decision: ${decision}. Resolution: ${resolution}`,
    href: `/dashboard/disputes/${dispute.id}`,
    entityType: "dispute",
    entityId: dispute.id,
    metadata: {
      decision,
    },
    dedupeKey: `dispute-resolved:${dispute.id}:${recipientId}`,
  });
}

      return {
        success: true as const,
        contractId: dispute.contractId,
      };
    });

    if (!result.success) return result;

    revalidatePath("/admin/disputes");
    revalidatePath(`/admin/disputes/${disputeId}`);
    revalidatePath(`/dashboard/disputes/${disputeId}`);
    revalidatePath(`/dashboard/contracts/${result.contractId}`);

    return { success: true };
  } catch (error) {
    console.error("Resolve dispute error:", error);

    return {
      success: false,
      message: "Unable to resolve dispute.",
    };
  }
}

export async function applyDisputeOutcome(
  input: unknown,
): Promise<AdminDisputeResult> {
  try {
    const session = await requireAdmin();

    if (!input || typeof input !== "object") {
      return {
        success: false,
        message: "Invalid request.",
      };
    }

    const data = input as {
      disputeId?: unknown;
      outcome?: unknown;
    };

    const disputeId =
      typeof data.disputeId === "string" ? data.disputeId.trim() : "";

    const outcome = data.outcome;

    if (!UUID_REGEX.test(disputeId)) {
      return {
        success: false,
        message: "Invalid dispute ID.",
      };
    }

    if (outcome !== "cancel_contract" && outcome !== "resume_contract") {
      return {
        success: false,
        message: "Invalid contract outcome.",
      };
    }

    const result = await db.transaction(async (tx) => {
      // Lock the dispute first so two administrators cannot
      // apply conflicting outcomes simultaneously.
      const [dispute] = await tx
        .select({
          id: disputes.id,
          contractId: disputes.contractId,
          cancellationRequestId: disputes.cancellationRequestId,
          origin: disputes.origin,
          status: disputes.status,
        })
        .from(disputes)
        .where(eq(disputes.id, disputeId))
        .for("update");

      if (!dispute) {
        return {
          success: false as const,
          message: "Dispute not found.",
        };
      }

      if (dispute.status !== "resolved") {
        return {
          success: false as const,
          message: "Resolve the dispute before applying a contract outcome.",
        };
      }

      if (dispute.origin !== "cancellation" || !dispute.cancellationRequestId) {
        return {
          success: false as const,
          message:
            "This outcome is currently supported only for cancellation disputes.",
        };
      }

      // Lock the contract before changing its status.
      const [contract] = await tx
        .select({
          id: contracts.id,
          status: contracts.status,
        })
        .from(contracts)
        .where(eq(contracts.id, dispute.contractId))
        .for("update");

      if (!contract) {
        return {
          success: false as const,
          message: "Associated contract not found.",
        };
      }

      if (contract.status !== "disputed") {
        return {
          success: false as const,
          message: "The contract is no longer awaiting a dispute outcome.",
        };
      }

      // Retrieve the original contract status saved when
      // cancellation was requested.
      const [cancellationRequest] = await tx
        .select({
          id: cancellationRequests.id,
          contractId: cancellationRequests.contractId,
          status: cancellationRequests.status,
          previousContractStatus: cancellationRequests.previousContractStatus,
        })
        .from(cancellationRequests)
        .where(eq(cancellationRequests.id, dispute.cancellationRequestId))
        .for("update");

      if (
        !cancellationRequest ||
        cancellationRequest.contractId !== contract.id ||
        cancellationRequest.status !== "rejected"
      ) {
        return {
          success: false as const,
          message: "The original cancellation request could not be verified.",
        };
      }

      const restorableStatuses = [
        "awaiting_payment",
        "active",
        "delivered",
        "revision_requested",
      ] as const;

      if (
        !restorableStatuses.includes(
          cancellationRequest.previousContractStatus as (typeof restorableStatuses)[number],
        )
      ) {
        return {
          success: false as const,
          message: "The original contract status cannot be restored safely.",
        };
      }

      const nextContractStatus =
        outcome === "cancel_contract"
          ? "cancelled"
          : cancellationRequest.previousContractStatus;

      const now = new Date();

      await tx
        .update(contracts)
        .set({
          status: nextContractStatus,
          updatedAt: now,
        })
        .where(eq(contracts.id, contract.id));

      await tx.insert(disputeEvents).values({
        disputeId: dispute.id,
        actorId: session.user.id,
        action: "contract_disposition_applied",
        details:
          outcome === "cancel_contract"
            ? "Administrator applied the dispute outcome: contract cancelled."
            : `Administrator applied the dispute outcome: contract restored to ${nextContractStatus}.`,
      });

      return {
        success: true as const,
        contractId: contract.id,
      };
    });

    if (!result.success) {
      return result;
    }

    revalidatePath("/admin/disputes");
    revalidatePath(`/admin/disputes/${disputeId}`);
    revalidatePath(`/dashboard/disputes/${disputeId}`);
    revalidatePath(`/dashboard/contracts/${result.contractId}`);
    revalidatePath("/dashboard/contracts");

    return { success: true };
  } catch (error) {
    console.error("Apply dispute outcome error:", error);

    return {
      success: false,
      message: "Unable to apply the dispute outcome.",
    };
  }
}

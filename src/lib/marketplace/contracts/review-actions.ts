"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireClient } from "@/lib/marketplace/authorization";
import { db } from "@/lib/db";
import { contracts, contractDeliveries } from "@/lib/db/schema";

import { createNotification } from "@/lib/notifications/service";

// type ReviewDeliveryInput = {
//   contractId: string;
//   decision: "approve" | "request_revision";
//   message?: string;
// };

type ReviewDeliveryResult =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      message: string;
    };

export async function reviewDelivery(
  input: unknown,
): Promise<ReviewDeliveryResult> {
  const session = await requireClient();

  if (!input || typeof input !== "object") {
    return {
      success: false,
      message: "Invalid review information.",
    };
  }

  const data = input as Record<string, unknown>;

  const { contractId, decision } = data;
  const message = typeof data.message === "string" ? data.message.trim() : "";

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (typeof contractId !== "string" || !uuidRegex.test(contractId)) {
    return {
      success: false,
      message: "Invalid contract.",
    };
  }

  if (decision !== "approve" && decision !== "request_revision") {
    return {
      success: false,
      message: "Invalid review decision.",
    };
  }

  if (
    decision === "request_revision" &&
    (message.length < 10 || message.length > 5000)
  ) {
    return {
      success: false,
      message: "Revision feedback must be between 10 and 5,000 characters.",
    };
  }

  if (decision === "approve" && message.length > 5000) {
    return {
      success: false,
      message: "Review feedback cannot exceed 5,000 characters.",
    };
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Lock the contract so simultaneous review requests cannot
      // approve and request revisions for the same delivery.
      const [contract] = await tx
        .select({
          id: contracts.id,
          clientId: contracts.clientId,
          freelancerId: contracts.freelancerId,
          title: contracts.title,
          status: contracts.status,
          revisionAllowance: contracts.revisionAllowance,
          revisionsUsed: contracts.revisionsUsed,
        })
        .from(contracts)
        .where(eq(contracts.id, contractId))
        .for("update")
        .limit(1);

      if (!contract || contract.clientId !== session.user.id) {
        return {
          success: false as const,
          message: "Contract not found.",
        };
      }

      if (contract.status !== "delivered") {
        return {
          success: false as const,
          message: "This contract has no delivery awaiting review.",
        };
      }

      // Find the latest submission.
      const [delivery] = await tx
        .select({
          id: contractDeliveries.id,
          submissionNumber: contractDeliveries.submissionNumber,
          status: contractDeliveries.status,
        })
        .from(contractDeliveries)
        .where(eq(contractDeliveries.contractId, contract.id))
        .orderBy(desc(contractDeliveries.submissionNumber))
        .limit(1);

      if (!delivery || delivery.status !== "submitted") {
        return {
          success: false as const,
          message: "No valid delivery is available for review.",
        };
      }

      const now = new Date();

      if (decision === "approve") {
        await tx
          .update(contractDeliveries)
          .set({
            status: "approved",
            reviewMessage: message || null,
            reviewedAt: now,
          })
          .where(eq(contractDeliveries.id, delivery.id));

        await tx
          .update(contracts)
          .set({
            status: "completed",
            updatedAt: now,
          })
          .where(eq(contracts.id, contract.id));

        await createNotification(tx, {
          recipientId: contract.freelancerId,
          actorId: session.user.id,
          type: "delivery_approved",
          title: "Delivery approved",
          message: `Your delivery for "${contract.title}" has been approved. The contract is now completed.`,
          href: `/dashboard/contracts/${contract.id}`,
          entityType: "contract",
          entityId: contract.id,
          metadata: {
            deliveryId: delivery.id,
            submissionNumber: delivery.submissionNumber,
          },
          dedupeKey: `delivery-approved:${delivery.id}`,
        });

        return {
          success: true as const,
          message: "Delivery approved. The contract is now completed.",
        };
      }

      // Do not allow more revision requests than the agreed allowance.
      if (contract.revisionsUsed >= contract.revisionAllowance) {
        return {
          success: false as const,
          message: "The agreed revision allowance has been exhausted.",
        };
      }

      await tx
        .update(contractDeliveries)
        .set({
          status: "revision_requested",
          reviewMessage: message,
          reviewedAt: now,
        })
        .where(eq(contractDeliveries.id, delivery.id));

      await tx
        .update(contracts)
        .set({
          status: "revision_requested",
          revisionsUsed: contract.revisionsUsed + 1,
          updatedAt: now,
        })
        .where(eq(contracts.id, contract.id));

      await createNotification(tx, {
        recipientId: contract.freelancerId,
        actorId: session.user.id,
        type: "revision_requested",
        title: "Revision requested",
        message: `The client requested changes to delivery ${delivery.submissionNumber} for "${contract.title}".`,
        href: `/dashboard/contracts/${contract.id}`,
        entityType: "contract",
        entityId: contract.id,
        metadata: {
          deliveryId: delivery.id,
          submissionNumber: delivery.submissionNumber,
        },
        dedupeKey: `revision-requested:${delivery.id}`,
      });

      return {
        success: true as const,
        message: "Revision requested. The freelancer can submit updated work.",
      };
    });

    if (!result.success) {
      return result;
    }

    revalidatePath(`/dashboard/contracts/${contractId}`);
    revalidatePath("/dashboard/contracts");

    return result;
  } catch (error) {
    console.error("Delivery review failed:", error);

    return {
      success: false,
      message: "We couldn't process this review. Please try again.",
    };
  }
}

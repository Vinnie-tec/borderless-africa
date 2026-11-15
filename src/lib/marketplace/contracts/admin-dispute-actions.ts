
"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  disputes,
  disputeEvents,
} from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AdminDisputeResult =
  | { success: true }
  | { success: false; message: string };

export async function startDisputeReview(
  input: unknown
): Promise<AdminDisputeResult> {
  try {
    const session = await requireAdmin();

    if (!input || typeof input !== "object") {
      return { success: false, message: "Invalid request." };
    }

    const disputeId = (input as { disputeId?: unknown }).disputeId;

    if (
      typeof disputeId !== "string" ||
      !UUID_REGEX.test(disputeId)
    ) {
      return { success: false, message: "Invalid dispute ID." };
    }

    const result = await db.transaction(async (tx) => {
      const [dispute] = await tx
        .select({
          id: disputes.id,
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
  input: unknown
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
      typeof data.disputeId === "string"
        ? data.disputeId.trim()
        : "";

    const decision =
      typeof data.decision === "string"
        ? data.decision.trim()
        : "";

    const resolution =
      typeof data.resolution === "string"
        ? data.resolution.trim()
        : "";

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

      return {
        success: true as const,
        contractId: dispute.contractId,
      };
    });

    if (!result.success) return result;

    revalidatePath("/admin/disputes");
    revalidatePath(`/admin/disputes/${disputeId}`);
    revalidatePath(
      `/dashboard/disputes/${disputeId}`
    );
    revalidatePath(
      `/dashboard/contracts/${result.contractId}`
    );

    return { success: true };
  } catch (error) {
    console.error("Resolve dispute error:", error);

    return {
      success: false,
      message: "Unable to resolve dispute.",
    };
  }
}

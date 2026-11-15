
"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  contracts,
  disputes,
  disputeMessages,
  disputeEvents,
} from "@/lib/db/schema";
import { requireVerifiedUser } from "@/lib/auth-helpers";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DisputeMessageResult =
  | {
      success: true;
      messageId: string;
    }
  | {
      success: false;
      message: string;
    };

export async function addDisputeMessage(
  input: unknown
): Promise<DisputeMessageResult> {
  try {
    const session = await requireVerifiedUser();
    const userId = session.user.id;

    if (!input || typeof input !== "object") {
      return {
        success: false,
        message: "Invalid dispute message.",
      };
    }

    const data = input as {
      disputeId?: unknown;
      message?: unknown;
      attachmentUrl?: unknown;
    };

    const disputeId =
      typeof data.disputeId === "string"
        ? data.disputeId.trim()
        : "";

    const message =
      typeof data.message === "string"
        ? data.message.trim()
        : "";

    const attachmentUrl =
      typeof data.attachmentUrl === "string"
        ? data.attachmentUrl.trim()
        : "";

    if (!UUID_REGEX.test(disputeId)) {
      return {
        success: false,
        message: "Invalid dispute ID.",
      };
    }

    if (message.length < 10 || message.length > 5000) {
      return {
        success: false,
        message: "Message must be between 10 and 5000 characters.",
      };
    }

    // Validate optional evidence URL.
    if (attachmentUrl) {
      try {
        const url = new URL(attachmentUrl);

        if (
          url.protocol !== "https:" ||
          attachmentUrl.length > 2048
        ) {
          throw new Error("Invalid URL");
        }
      } catch {
        return {
          success: false,
          message: "Evidence must be a valid HTTPS URL.",
        };
      }
    }

    const result = await db.transaction(async (tx) => {
      // Lock the dispute so messages cannot be added while
      // another transaction is resolving it.
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

      if (
        dispute.status !== "open" &&
        dispute.status !== "under_review"
      ) {
        return {
          success: false as const,
          message: "This dispute is no longer accepting messages.",
        };
      }

      // Verify that the sender belongs to this contract.
      const [contract] = await tx
        .select({
          id: contracts.id,
          clientId: contracts.clientId,
          freelancerId: contracts.freelancerId,
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

      const isParticipant =
        contract.clientId === userId ||
        contract.freelancerId === userId;

      if (!isParticipant) {
        return {
          success: false as const,
          message: "You are not authorized to participate in this dispute.",
        };
      }

      const [newMessage] = await tx
        .insert(disputeMessages)
        .values({
          disputeId: dispute.id,
          senderId: userId,
          message,
          attachmentUrl: attachmentUrl || null,
        })
        .returning({
          id: disputeMessages.id,
        });

      // Keep an audit trail of participant activity.
      await tx.insert(disputeEvents).values({
        disputeId: dispute.id,
        actorId: userId,
        action: "message_submitted",
        details: attachmentUrl
          ? "Participant submitted a dispute message with an evidence link."
          : "Participant submitted a dispute message.",
      });

      return {
        success: true as const,
        messageId: newMessage.id,
        contractId: contract.id,
      };
    });

    if (!result.success) {
      return result;
    }

    revalidatePath(`/dashboard/disputes/${disputeId}`);
    revalidatePath(
      `/dashboard/contracts/${result.contractId}`
    );
    revalidatePath("/admin/disputes");

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    console.error("Add dispute message error:", error);

    return {
      success: false,
      message: "Unable to submit your message. Please try again.",
    };
  }
}


"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireFreelancer } from "@/lib/marketplace/authorization";
import { db } from "@/lib/db";
import { contractDeliveries, contracts } from "@/lib/db/schema";

type SubmitDeliveryResult =
  | {
      success: true;
      message: string;
      deliveryId: string;
    }
  | {
      success: false;
      message: string;
    };

export async function submitDelivery(
  input: unknown
): Promise<SubmitDeliveryResult> {
  const session = await requireFreelancer();

  // Validate the input structure.
  if (!input || typeof input !== "object") {
    return {
      success: false,
      message: "Invalid delivery information.",
    };
  }

  const data = input as Record<string, unknown>;

  const { contractId } = data;
  const message =
    typeof data.message === "string" ? data.message.trim() : "";

  const attachmentUrl =
    typeof data.attachmentUrl === "string"
      ? data.attachmentUrl.trim()
      : "";

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (
    typeof contractId !== "string" ||
    !uuidRegex.test(contractId)
  ) {
    return {
      success: false,
      message: "Invalid contract.",
    };
  }

  if (message.length < 20 || message.length > 10000) {
    return {
      success: false,
      message: "Delivery message must be between 20 and 10,000 characters.",
    };
  }

  // Validate an optional delivery link.
  if (attachmentUrl) {
    if (attachmentUrl.length > 2048) {
      return {
        success: false,
        message: "The delivery link is too long.",
      };
    }

    try {
      const parsedUrl = new URL(attachmentUrl);

      if (parsedUrl.protocol !== "https:") {
        return {
          success: false,
          message: "Delivery links must use HTTPS.",
        };
      }
    } catch {
      return {
        success: false,
        message: "Please provide a valid delivery link.",
      };
    }
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Lock the contract to serialize submissions.
      const [contract] = await tx
        .select({
          id: contracts.id,
          freelancerId: contracts.freelancerId,
          status: contracts.status,
        })
        .from(contracts)
        .where(eq(contracts.id, contractId))
        .for("update")
        .limit(1);

      if (!contract || contract.freelancerId !== session.user.id) {
        return {
          success: false as const,
          message: "Contract not found.",
        };
      }

      if (
        contract.status !== "active" &&
        contract.status !== "revision_requested"
      ) {
        return {
          success: false as const,
          message:
            contract.status === "awaiting_payment"
              ? "This contract must be activated before you can submit work."
              : "This contract cannot receive a delivery right now.",
        };
      }

      // Find the previous submission number.
      const [latestDelivery] = await tx
        .select({
          submissionNumber: contractDeliveries.submissionNumber,
        })
        .from(contractDeliveries)
        .where(eq(contractDeliveries.contractId, contract.id))
        .orderBy(desc(contractDeliveries.submissionNumber))
        .limit(1);

      const submissionNumber =
        (latestDelivery?.submissionNumber ?? 0) + 1;

      // Preserve each submission as a separate record.
      const [delivery] = await tx
        .insert(contractDeliveries)
        .values({
          contractId: contract.id,
          submittedById: session.user.id,
          submissionNumber,
          message,
          attachmentUrl: attachmentUrl || null,
          status: "submitted",
        })
        .returning({ id: contractDeliveries.id });

      // Move the contract into client review.
      await tx
        .update(contracts)
        .set({
          status: "delivered",
          updatedAt: new Date(),
        })
        .where(eq(contracts.id, contract.id));

      return {
        success: true as const,
        deliveryId: delivery.id,
        contractId: contract.id,
      };
    });

    if (!result.success) {
      return result;
    }

    revalidatePath(`/dashboard/contracts/${result.contractId}`);
    revalidatePath("/dashboard/contracts");

    return {
      success: true,
      message: "Your work has been submitted successfully.",
      deliveryId: result.deliveryId,
    };
  } catch (error) {
    console.error("Delivery submission failed:", error);

    return {
      success: false,
      message: "We couldn't submit your delivery. Please try again.",
    };
  }
}

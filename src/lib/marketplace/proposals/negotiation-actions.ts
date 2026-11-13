"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireVerifiedUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { jobs, proposals, proposalOffers } from "@/lib/db/schema";

type CreateCounterofferInput = {
  proposalId: unknown;
  proposedPrice: unknown;
  deliveryDays: unknown;
  message: unknown;
};

export type CreateCounterofferResult =
  | {
      success: true;
      message: string;
      offerId: string;
    }
  | {
      success: false;
      message: string;
    };

function isValidUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

export async function createCounteroffer(
  input: CreateCounterofferInput,
): Promise<CreateCounterofferResult> {
  const session = await requireVerifiedUser();
  const userId = session.user.id;

  if (!isValidUUID(input.proposalId)) {
    return {
      success: false,
      message: "Invalid proposal.",
    };
  }

  const priceString = String(input.proposedPrice).trim();

  if (!/^\d{1,10}(\.\d{1,2})?$/.test(priceString)) {
    return {
      success: false,
      message: "Enter a valid price with no more than two decimal places.",
    };
  }

  const proposedPrice = Number(priceString);

  if (!Number.isFinite(proposedPrice) || proposedPrice <= 0) {
    return {
      success: false,
      message: "The proposed price must be greater than zero.",
    };
  }

  const deliveryDays = Number(input.deliveryDays);

  if (
    !Number.isInteger(deliveryDays) ||
    deliveryDays < 1 ||
    deliveryDays > 3650
  ) {
    return {
      success: false,
      message: "Delivery time must be between 1 and 3,650 days.",
    };
  }

  if (typeof input.message !== "string") {
    return {
      success: false,
      message: "Please provide a message explaining your counteroffer.",
    };
  }

  const message = input.message.trim();

  if (message.length < 10 || message.length > 2000) {
    return {
      success: false,
      message: "Your message must be between 10 and 2,000 characters.",
    };
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Serialize negotiation requests for this proposal.
      const [proposal] = await tx
        .select({
          id: proposals.id,
          jobId: proposals.jobId,
          freelancerId: proposals.freelancerId,
          proposedPrice: proposals.proposedPrice,
          deliveryDays: proposals.deliveryDays,
          currency: proposals.currency,
          status: proposals.status,
        })
        .from(proposals)
        .where(eq(proposals.id, input.proposalId as string))
        .for("update")
        .limit(1);

      if (!proposal) {
        return {
          success: false as const,
          message: "Proposal not found.",
        };
      }

      // Only the job owner and the applicant may negotiate.
      const [job] = await tx
        .select({
          id: jobs.id,
          clientId: jobs.clientId,
        })
        .from(jobs)
        .where(eq(jobs.id, proposal.jobId))
        .limit(1);

      if (
        !job ||
        (userId !== job.clientId && userId !== proposal.freelancerId)
      ) {
        return {
          success: false as const,
          message: "You are not authorized to negotiate this proposal.",
        };
      }

      if (proposal.status !== "pending" && proposal.status !== "negotiating") {
        return {
          success: false as const,
          message: "This proposal is no longer open for negotiation.",
        };
      }

      // The original proposal is the freelancer's opening offer.
      const [latestOffer] = await tx
        .select({
          senderId: proposalOffers.senderId,
          offerNumber: proposalOffers.offerNumber,
        })
        .from(proposalOffers)
        .where(eq(proposalOffers.proposalId, proposal.id))
        .orderBy(desc(proposalOffers.offerNumber))
        .limit(1);

      const lastSenderId = latestOffer?.senderId ?? proposal.freelancerId;

      // The same participant cannot make consecutive offers.
      if (lastSenderId === userId) {
        return {
          success: false as const,
          message: "Please wait for the other party to respond.",
        };
      }

      const [offer] = await tx
        .insert(proposalOffers)
        .values({
          proposalId: proposal.id,
          senderId: userId,
          proposedPrice: priceString,
          deliveryDays,
          message,
          offerNumber: (latestOffer?.offerNumber ?? 0) + 1,
        })
        .returning({
          id: proposalOffers.id,
        });

      await tx
        .update(proposals)
        .set({
          status: "negotiating",
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, proposal.id));

      return {
        success: true as const,
        offerId: offer.id,
        jobId: proposal.jobId,
      };
    });

    if (!result.success) {
      return result;
    }

    revalidatePath(`/dashboard/jobs/${result.jobId}/proposals`);
    revalidatePath(`/jobs/${result.jobId}`);

    return {
      success: true,
      message: "Your counteroffer has been sent.",
      offerId: result.offerId,
    };
  } catch (error) {
    console.error("Counteroffer submission failed:", error);

    return {
      success: false,
      message: "Something went wrong while sending your counteroffer.",
    };
  }
}

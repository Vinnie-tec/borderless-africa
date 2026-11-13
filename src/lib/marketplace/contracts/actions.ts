"use server";

import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireClient } from "@/lib/marketplace/authorization";
import { db } from "@/lib/db";
import { contracts, jobs, proposals, proposalOffers } from "@/lib/db/schema";

type AcceptProposalResult =
  | {
      success: true;
      message: string;
      contractId: string;
    }
  | {
      success: false;
      message: string;
    };

export async function acceptProposal(
  proposalId: unknown,
): Promise<AcceptProposalResult> {
  const session = await requireClient();

  // Never trust an ID supplied by the browser.
  if (
    typeof proposalId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      proposalId,
    )
  ) {
    return {
      success: false,
      message: "Invalid proposal.",
    };
  }

  try {
    // Find the job ID first. It is immutable on a proposal.
    const [proposalReference] = await db
      .select({ jobId: proposals.jobId })
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!proposalReference) {
      return {
        success: false,
        message: "Proposal not found.",
      };
    }

    const result = await db.transaction(async (tx) => {
      // Lock the job first. This serializes acceptance attempts
      // for every proposal belonging to the same job.
      const [job] = await tx
        .select({
          id: jobs.id,
          clientId: jobs.clientId,
          title: jobs.title,
          description: jobs.description,
          status: jobs.status,
        })
        .from(jobs)
        .where(
          and(
            eq(jobs.id, proposalReference.jobId),
            eq(jobs.clientId, session.user.id),
          ),
        )
        .for("update")
        .limit(1);

      if (!job) {
        return {
          success: false as const,
          message: "You cannot accept a proposal for this job.",
        };
      }

      if (job.status !== "open") {
        return {
          success: false as const,
          message: "This job is no longer accepting a proposal.",
        };
      }

      // Lock the selected proposal after locking its job.
      const [proposal] = await tx
        .select()
        .from(proposals)
        .where(and(eq(proposals.id, proposalId), eq(proposals.jobId, job.id)))
        .for("update")
        .limit(1);

      if (!proposal) {
        return {
          success: false as const,
          message: "Proposal not found.",
        };
      }

      if (proposal.status !== "pending" && proposal.status !== "negotiating") {
        return {
          success: false as const,
          message: "This proposal can no longer be accepted.",
        };
      }

      // Extra protection alongside the unique database constraint.
      const [existingContract] = await tx
        .select({ id: contracts.id })
        .from(contracts)
        .where(eq(contracts.jobId, job.id))
        .limit(1);

      if (existingContract) {
        return {
          success: false as const,
          message: "A contract already exists for this job.",
        };
      }

      // The latest counteroffer contains the current negotiated terms.
      const [latestOffer] = await tx
        .select({
          senderId: proposalOffers.senderId,
          proposedPrice: proposalOffers.proposedPrice,
          deliveryDays: proposalOffers.deliveryDays,
        })
        .from(proposalOffers)
        .where(eq(proposalOffers.proposalId, proposal.id))
        .orderBy(desc(proposalOffers.offerNumber))
        .limit(1);

      // The client cannot accept their own unanswered counteroffer.
      if (latestOffer?.senderId === session.user.id) {
        return {
          success: false as const,
          message: "Wait for the freelancer to respond before accepting.",
        };
      }

      const agreedPrice = latestOffer?.proposedPrice ?? proposal.proposedPrice;

      const deliveryDays = latestOffer?.deliveryDays ?? proposal.deliveryDays;

      // Record the acceptance.
      await tx
        .update(proposals)
        .set({
          status: "accepted",
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, proposal.id));

      // Reject other proposals that are still active.
      await tx
        .update(proposals)
        .set({
          status: "rejected",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(proposals.jobId, job.id),
            ne(proposals.id, proposal.id),
            inArray(proposals.status, ["pending", "negotiating"]),
          ),
        );

      // Close the job to prevent further applications.
      await tx
        .update(jobs)
        .set({
          status: "closed",
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, job.id));

      // Create an immutable snapshot of the agreed terms.
      const [contract] = await tx
        .insert(contracts)
        .values({
          jobId: job.id,
          proposalId: proposal.id,
          clientId: job.clientId,
          freelancerId: proposal.freelancerId,
          title: job.title,
          scope: job.description,
          agreedPrice,
          currency: proposal.currency,
          deliveryDays,
          // revisionAllowance uses its database default of 2.
          status: "awaiting_payment",
        })
        .returning({ id: contracts.id });

      return {
        success: true as const,
        contractId: contract.id,
        jobId: job.id,
      };
    });

    if (!result.success) {
      return result;
    }

    revalidatePath(`/dashboard/jobs/${result.jobId}/proposals`);
    revalidatePath("/dashboard/proposals");
    revalidatePath("/dashboard/jobs");
    revalidatePath("/jobs");

    return {
      success: true,
      message: "Proposal accepted and contract created.",
      contractId: result.contractId,
    };
  } catch (error) {
    console.error("Proposal acceptance failed:", error);

    return {
      success: false,
      message:
        "We couldn't accept this proposal. Please refresh and try again.",
    };
  }
}

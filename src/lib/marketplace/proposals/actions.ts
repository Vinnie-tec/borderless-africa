"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { requireFreelancer } from "@/lib/marketplace/authorization";
import { db } from "@/lib/db";
import { jobs, proposals } from "@/lib/db/schema";

type CreateProposalInput = {
  jobId: unknown;
  coverLetter: unknown;
  proposedPrice: unknown;
  deliveryDays: unknown;
};

export type CreateProposalResult =
  | {
      success: true;
      message: string;
      proposalId: string;
    }
  | {
      success: false;
      message: string;
    };

function isValidUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

export async function createProposal(
  input: CreateProposalInput
): Promise<CreateProposalResult> {
  const session = await requireFreelancer();

  // Validate the job ID.
  if (!isValidUUID(input.jobId)) {
    return {
      success: false,
      message: "Invalid job.",
    };
  }

  // Validate the cover letter.
  if (typeof input.coverLetter !== "string") {
    return {
      success: false,
      message: "Please provide a cover letter.",
    };
  }

  const coverLetter = input.coverLetter.trim();

  if (coverLetter.length < 50 || coverLetter.length > 5000) {
    return {
      success: false,
      message: "Your cover letter must be between 50 and 5,000 characters.",
    };
  }

  // Validate the proposed price.
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
      message: "Your proposed price must be greater than zero.",
    };
  }

  // Validate the delivery timeframe.
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

  try {
    const result = await db.transaction(async (tx) => {
      // Lock the job row so a simultaneous job closure or acceptance
      // cannot race with this proposal submission.
      const [job] = await tx
        .select({
          id: jobs.id,
          clientId: jobs.clientId,
          currency: jobs.currency,
          status: jobs.status,
          closingAt: jobs.closingAt,
        })
        .from(jobs)
        .where(eq(jobs.id, input.jobId as string))
        .for("update")
        .limit(1);

      if (!job || job.status !== "open") {
        return {
          success: false as const,
          message: "This job is no longer accepting proposals.",
        };
      }

      if (job.closingAt && job.closingAt <= new Date()) {
        return {
          success: false as const,
          message: "The application deadline for this job has passed.",
        };
      }

      // A client cannot apply to their own job.
      if (job.clientId === session.user.id) {
        return {
          success: false as const,
          message: "You cannot submit a proposal to your own job.",
        };
      }

      const [proposal] = await tx
        .insert(proposals)
        .values({
          jobId: job.id,
          freelancerId: session.user.id,
          coverLetter,
          proposedPrice: priceString,
          currency: job.currency,
          deliveryDays,
        })
        .returning({
          id: proposals.id,
        });

      return {
        success: true as const,
        proposalId: proposal.id,
      };
    });

    if (!result.success) {
      return result;
    }

    revalidatePath(`/jobs/${input.jobId}`);
    revalidatePath("/dashboard");

    return {
      success: true,
      message: "Your proposal has been submitted successfully.",
      proposalId: result.proposalId,
    };
  } catch (error) {
    // PostgreSQL unique-constraint violation.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return {
        success: false,
        message: "You already have an active proposal for this job.",
      };
    }

    console.error("Proposal submission failed:", error);

    return {
      success: false,
      message: "Something went wrong while submitting your proposal.",
    };
  }
}
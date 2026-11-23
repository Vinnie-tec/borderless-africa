
"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { adminAuditLogs, contracts, jobs } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";

type ModerationResult =
  | { success: true; message: string }
  | { success: false; message: string };

type ModerationAction = "close" | "cancel";

function isValidUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

async function moderateJob(
  jobId: unknown,
  reason: unknown,
  action: ModerationAction,
): Promise<ModerationResult> {
  const session = await requireAdmin();

  if (!isValidUUID(jobId)) {
    return { success: false, message: "Invalid job ID." };
  }

  if (typeof reason !== "string" || reason.trim().length < 10 || reason.trim().length > 500) {
    return {
      success: false,
      message: "Provide a moderation reason between 10 and 500 characters.",
    };
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Lock the job first, matching the marketplace transaction lock order.
      const [job] = await tx
        .select({
          id: jobs.id,
          status: jobs.status,
        })
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .for("update")
        .limit(1);

      if (!job) {
        return {
          success: false as const,
          message: "Job not found.",
        };
      }

      const [existingContract] = await tx
        .select({ id: contracts.id })
        .from(contracts)
        .where(eq(contracts.jobId, job.id))
        .limit(1);

      if (existingContract) {
        return {
          success: false as const,
          message:
            "This job has an associated contract and cannot be moderated through this action.",
        };
      }

      if (action === "close" && job.status !== "open") {
        return {
          success: false as const,
          message: "Only open jobs can be closed.",
        };
      }

      if (
        action === "cancel" &&
        !["draft", "open", "closed"].includes(job.status)
      ) {
        return {
          success: false as const,
          message: "This job cannot be cancelled in its current state.",
        };
      }

      const newStatus = action === "close" ? "closed" : "cancelled";

      if (job.status === newStatus) {
        return {
          success: false as const,
          message: "This job already has that status.",
        };
      }

      await tx
        .update(jobs)
        .set({
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(jobs.id, job.id),
            eq(jobs.status, job.status),
          ),
        );

      await tx.insert(adminAuditLogs).values({
        adminId: session.user.id,
        action: action === "close" ? "job_closed" : "job_cancelled",
        entityType: "job",
        entityId: job.id,
        details: {
          reason: reason.trim(),
          previousStatus: job.status,
          newStatus,
        },
      });

      return {
        success: true as const,
        message:
          action === "close"
            ? "Job closed successfully."
            : "Job cancelled successfully.",
      };
    });

    if (!result.success) {
      return result;
    }

    revalidatePath("/admin");
    revalidatePath("/admin/jobs");
    revalidatePath(`/admin/jobs/${jobId}`);
    revalidatePath("/jobs");
    revalidatePath("/dashboard");

    return result;
  } catch (error) {
    console.error("Admin job moderation failed:", error);

    return {
      success: false,
      message: "Could not moderate this job. Please try again.",
    };
  }
}

export async function closeJob(
  jobId: unknown,
  reason: unknown,
): Promise<ModerationResult> {
  return moderateJob(jobId, reason, "close");
}

export async function cancelJob(
  jobId: unknown,
  reason: unknown,
): Promise<ModerationResult> {
  return moderateJob(jobId, reason, "cancel");
}

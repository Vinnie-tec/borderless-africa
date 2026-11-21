"use server";

import { and, count, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  user,
  userCapabilities,
  jobs,
  proposals,
  contracts,
} from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminAuditLog } from "@/lib/admin/audit";

type Capability = "client" | "freelancer";

type ChangeCapabilityInput = {
  userId: string;
  capability: Capability;
  enabled: boolean;
};

const activeContractStatuses = [
  "awaiting_payment",
  "active",
  "delivered",
  "revision_requested",
  "cancellation_pending",
  "disputed",
] as const;

export async function changeUserCapability({
  userId,
  capability,
  enabled,
}: ChangeCapabilityInput) {
  const session = await requireAdmin();

  if (typeof userId !== "string" || !userId.trim() || userId.length > 255) {
    return { success: false, message: "Invalid user ID." };
  }

  if (capability !== "client" && capability !== "freelancer") {
    return { success: false, message: "Invalid marketplace capability." };
  }

  if (typeof enabled !== "boolean") {
    return { success: false, message: "Invalid capability setting." };
  }

  const result = await db.transaction(async (tx) => {
    // Use the same lock as role changes so administrative
    // account mutations are serialized.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(741852, 1)`);

    // Recheck the acting administrator's current role.
    const [actor] = await tx
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!actor || actor.role !== "admin") {
      return {
        success: false,
        message: "Your administrator access is no longer valid.",
      };
    }

    const [target] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!target) {
      return {
        success: false,
        message: "User account not found.",
      };
    }

    const [existing] = await tx
      .select({ capability: userCapabilities.capability })
      .from(userCapabilities)
      .where(
        and(
          eq(userCapabilities.userId, userId),
          eq(userCapabilities.capability, capability),
        ),
      )
      .limit(1);

    if (enabled && existing) {
      return {
        success: true,
        message: "The user already has this capability.",
      };
    }

    if (!enabled && !existing) {
      return {
        success: true,
        message: "The user does not have this capability.",
      };
    }

    if (!enabled && capability === "client") {
      // A client must retain access while managing draft/open jobs.
      const [jobCount] = await tx
        .select({ total: count() })
        .from(jobs)
        .where(
          and(
            eq(jobs.clientId, userId),
            inArray(jobs.status, ["draft", "open"]),
          ),
        );

      if (jobCount.total > 0) {
        return {
          success: false,
          message:
            "This user still has draft or open jobs. Close or cancel those jobs before removing client access.",
        };
      }
    }

    if (!enabled && capability === "freelancer") {
      // Do not remove freelancer access while proposals are
      // still awaiting a decision or being negotiated.
      const [proposalCount] = await tx
        .select({ total: count() })
        .from(proposals)
        .where(
          and(
            eq(proposals.freelancerId, userId),
            inArray(proposals.status, ["pending", "negotiating"]),
          ),
        );

      if (proposalCount.total > 0) {
        return {
          success: false,
          message:
            "This user still has active proposals. Resolve or withdraw them before removing freelancer access.",
        };
      }
    }

    if (!enabled) {
      // Both capabilities must be retained while the user has
      // ongoing contract obligations in either participant role.
      const contractCondition =
        capability === "client"
          ? eq(contracts.clientId, userId)
          : eq(contracts.freelancerId, userId);

      const [contractCount] = await tx
        .select({ total: count() })
        .from(contracts)
        .where(
          and(
            contractCondition,
            inArray(contracts.status, [...activeContractStatuses]),
          ),
        );

      if (contractCount.total > 0) {
        return {
          success: false,
          message:
            "This user has ongoing contracts. Complete or resolve those contracts before removing this capability.",
        };
      }
    }

    if (enabled) {
      await tx.insert(userCapabilities).values({
        userId,
        capability,
      });
    } else {
      await tx
        .delete(userCapabilities)
        .where(
          and(
            eq(userCapabilities.userId, userId),
            eq(userCapabilities.capability, capability),
          ),
        );
    }

    await createAdminAuditLog(tx, {
      adminId: session.user.id,
      action: enabled ? "user.capability_added" : "user.capability_removed",
      entityType: "user",
      entityId: userId,
      details: {
        capability,
        enabled,
      },
    });

    return {
      success: true,
      message: enabled
        ? `${capability} capability added successfully.`
        : `${capability} capability removed successfully.`,
    };
  });

  if (result.success) {
    revalidatePath("/admin/users");
    revalidatePath("/admin");
  }

  return result;
}

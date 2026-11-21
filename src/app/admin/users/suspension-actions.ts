
"use server";

import { count, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminAuditLog } from "@/lib/admin/audit";

type SuspensionResult =
  | { success: true }
  | { success: false; error: string };

type SuspendUserInput = {
  userId: string;
  reason: string;
};

export async function suspendUser({
  userId,
  reason,
}: SuspendUserInput): Promise<SuspensionResult> {
  const session = await requireAdmin();

  const cleanUserId = userId.trim();
  const cleanReason = reason.trim();

  if (!cleanUserId || !cleanReason) {
    return { success: false, error: "User and suspension reason are required." };
  }

  if (cleanReason.length > 500) {
    return { success: false, error: "The reason cannot exceed 500 characters." };
  }

  if (cleanUserId === session.user.id) {
    return { success: false, error: "You cannot suspend your own account." };
  }

  try {
    await db.transaction(async (tx) => {
      // Serialize administrative account-management operations.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(741852, 1)`);

      // Recheck the administrator's current database role.
      const [actor] = await tx
        .select({ role: user.role })
        .from(user)
        .where(eq(user.id, session.user.id))
        .limit(1);

      if (actor?.role !== "admin") {
        throw new Error("Administrator access is required.");
      }

      const [target] = await tx
        .select({
          id: user.id,
          role: user.role,
          banned: user.banned,
        })
        .from(user)
        .where(eq(user.id, cleanUserId))
        .limit(1);

      if (!target) {
        throw new Error("User not found.");
      }

      if (target.banned) {
        throw new Error("This account is already suspended.");
      }

      if (target.role === "admin") {
        const [result] = await tx
          .select({ total: count() })
          .from(user)
          .where(eq(user.role, "admin"));

        if (Number(result.total) <= 1) {
          throw new Error("The last administrator cannot be suspended.");
        }
      }

      // Better Auth handles the ban and revokes existing sessions.
      await auth.api.banUser({
        body: {
          userId: cleanUserId,
          banReason: cleanReason,
        },
        headers: await headers(),
      });

      await createAdminAuditLog(tx, {
        adminId: session.user.id,
        action: "user_suspended",
        entityType: "user",
        entityId: cleanUserId,
        details: {
          reason: cleanReason,
        },
      });
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin");

    return { success: true };
  } catch (error) {
    console.error("Failed to suspend user:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to suspend account.",
    };
  }
}

export async function reactivateUser(
  userId: string,
): Promise<SuspensionResult> {
  const session = await requireAdmin();

  const cleanUserId = userId.trim();

  if (!cleanUserId) {
    return { success: false, error: "A user ID is required." };
  }

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(741852, 1)`);

      const [actor] = await tx
        .select({ role: user.role })
        .from(user)
        .where(eq(user.id, session.user.id))
        .limit(1);

      if (actor?.role !== "admin") {
        throw new Error("Administrator access is required.");
      }

      const [target] = await tx
        .select({
          id: user.id,
          banned: user.banned,
        })
        .from(user)
        .where(eq(user.id, cleanUserId))
        .limit(1);

      if (!target) {
        throw new Error("User not found.");
      }

      if (!target.banned) {
        throw new Error("This account is not suspended.");
      }

      await auth.api.unbanUser({
        body: {
          userId: cleanUserId,
        },
        headers: await headers(),
      });

      await createAdminAuditLog(tx, {
        adminId: session.user.id,
        action: "user_reactivated",
        entityType: "user",
        entityId: cleanUserId,
      });
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin");

    return { success: true };
  } catch (error) {
    console.error("Failed to reactivate user:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to reactivate account.",
    };
  }
}

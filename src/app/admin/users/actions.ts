
"use server";

import { count, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAdminAuditLog } from "@/lib/admin/audit";

type UserRole = "user" | "admin";

type ChangeRoleInput = {
  userId: string;
  newRole: UserRole;
};

export async function changeUserRole({
  userId,
  newRole,
}: ChangeRoleInput) {
  const session = await requireAdmin();

  // Validate input before touching the database.
  if (
    typeof userId !== "string" ||
    !userId.trim() ||
    userId.length > 255
  ) {
    return { success: false, message: "Invalid user ID." };
  }

  if (newRole !== "user" && newRole !== "admin") {
    return { success: false, message: "Invalid account role." };
  }

  if (userId === session.user.id && newRole !== "admin") {
    return {
      success: false,
      message: "You cannot remove your own administrator role.",
    };
  }

  const result = await db.transaction(async (tx) => {
    // Serialize role changes to prevent concurrent last-admin demotions.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(741852, 1)`,
    );

    // Recheck the acting administrator's current database role.
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
      .select({
        id: user.id,
        role: user.role,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!target) {
      return {
        success: false,
        message: "User account not found.",
      };
    }

    if (target.role === newRole) {
      return {
        success: true,
        message: "The user already has this role.",
      };
    }

    // Never allow the last administrator to be demoted.
    if (target.role === "admin" && newRole === "user") {
      const [adminCount] = await tx
        .select({ total: count() })
        .from(user)
        .where(eq(user.role, "admin"));

      if (adminCount.total <= 1) {
        return {
          success: false,
          message: "The last administrator cannot be demoted.",
        };
      }
    }

    await tx
      .update(user)
      .set({
        role: newRole,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    // Record the change in the same transaction.
    await createAdminAuditLog(tx, {
      adminId: session.user.id,
      action: "user.role_changed",
      entityType: "user",
      entityId: userId,
      details: {
        previousRole: target.role,
        newRole,
      },
    });

    return {
      success: true,
      message: `User role changed to ${newRole}.`,
    };
  });

  if (result.success) {
    revalidatePath("/admin/users");
    revalidatePath("/admin");
  }

  return result;
}

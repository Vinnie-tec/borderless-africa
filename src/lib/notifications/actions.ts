"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { requireVerifiedUser } from "@/lib/auth-helpers";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function markNotificationAsRead(
  notificationId: string,
) {
  const session = await requireVerifiedUser();

  if (!UUID_REGEX.test(notificationId)) {
    throw new Error("Invalid notification ID.");
  }

  const [updated] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.recipientId, session.user.id),
        isNull(notifications.readAt),
      ),
    )
    .returning({ id: notifications.id });

  if (updated) {
    revalidatePath("/dashboard");
  }

  return { success: true, updated: Boolean(updated) };
}

export async function markAllNotificationsAsRead() {
  const session = await requireVerifiedUser();

  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.recipientId, session.user.id),
        isNull(notifications.readAt),
      ),
    )
    .returning({ id: notifications.id });

  revalidatePath("/dashboard");

  return {
    success: true,
    updatedCount: updated.length,
  };
}

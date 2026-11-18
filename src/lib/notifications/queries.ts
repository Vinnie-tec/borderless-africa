
import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { requireVerifiedUser } from "@/lib/auth-helpers";

const NOTIFICATION_LIMIT = 30;

export async function getNotifications() {
  const session = await requireVerifiedUser();

  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      message: notifications.message,
      href: notifications.href,
      entityType: notifications.entityType,
      entityId: notifications.entityId,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.recipientId, session.user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(NOTIFICATION_LIMIT);
}

export async function getUnreadNotificationCount() {
  const session = await requireVerifiedUser();

  const [result] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, session.user.id),
        isNull(notifications.readAt),
      ),
    );

  return result?.count ?? 0;
}

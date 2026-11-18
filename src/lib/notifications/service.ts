import "server-only";

import { db } from "@/lib/db";
import {
  notifications,
  notificationTypeEnum,
} from "@/lib/db/schema";

type NotificationType =
  (typeof notificationTypeEnum.enumValues)[number];

type CreateNotificationInput = {
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  href: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
};

export async function createNotification(
  input: CreateNotificationInput,
) {
  // Notifications must link to an internal application route.
  if (
    !input.href.startsWith("/") ||
    input.href.startsWith("//") ||
    input.href.includes("\\")
  ) {
    throw new Error("Invalid notification destination.");
  }

  if (input.dedupeKey && input.dedupeKey.length > 200) {
    throw new Error("Notification deduplication key is too long.");
  }

  const [created] = await db
    .insert(notifications)
    .values({
      recipientId: input.recipientId,
      actorId: input.actorId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      href: input.href,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? {},
      dedupeKey: input.dedupeKey ?? null,
    })
    .onConflictDoNothing({
      target: notifications.dedupeKey,
    })
    .returning({
      id: notifications.id,
    });

  return {
    created: Boolean(created),
    notificationId: created?.id ?? null,
  };
}

import { adminAuditLogs } from "@/lib/db/schema";

// Accept either the database connection or an existing transaction.
// For administrative mutations, pass the transaction.
type AuditExecutor = Parameters<
  Parameters<typeof import("@/lib/db").db.transaction>[0]
>[0];

type CreateAuditLogInput = {
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
};

export async function createAdminAuditLog(
  tx: AuditExecutor,
  input: CreateAuditLogInput,
) {
  await tx.insert(adminAuditLogs).values({
    adminId: input.adminId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    details: input.details ?? {},
  });
}


import { and, eq, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  cancellationRequests,
  contracts,
  disputeEvents,
  disputes,
  user,
} from "@/lib/db/schema";

// This internal user records automated actions in the audit trail.
const SYSTEM_ACTOR_ID = "borderless-africa-system";

const BATCH_SIZE = 50;

export async function escalateExpiredCancellations() {
  // Ensure the internal audit actor exists before processing anything.
  const [systemActor] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, SYSTEM_ACTOR_ID))
    .limit(1);

  if (!systemActor) {
    throw new Error("The internal system user does not exist.");
  }

  const now = new Date();

  // Find pending requests whose response deadline has passed.
  const expiredRequests = await db
    .select({ id: cancellationRequests.id })
    .from(cancellationRequests)
    .where(
      and(
        eq(cancellationRequests.status, "pending"),
        lt(cancellationRequests.responseDeadline, now),
      ),
    )
    .limit(BATCH_SIZE);

  let escalatedCount = 0;

  for (const candidate of expiredRequests) {
    const result = await db.transaction(async (tx) => {
      // First read the request to discover its contract.
      const [initialRequest] = await tx
        .select({ contractId: cancellationRequests.contractId })
        .from(cancellationRequests)
        .where(eq(cancellationRequests.id, candidate.id))
        .limit(1);

      if (!initialRequest) return false;

      // Always lock the contract before locking its cancellation request.
      const [contract] = await tx
        .select({
          id: contracts.id,
          status: contracts.status,
        })
        .from(contracts)
        .where(eq(contracts.id, initialRequest.contractId))
        .for("update");

      if (!contract) return false;

      const [request] = await tx
        .select()
        .from(cancellationRequests)
        .where(eq(cancellationRequests.id, candidate.id))
        .for("update");

      if (!request) return false;

      // Recheck everything after acquiring the locks.
      if (
        request.status !== "pending" ||
        request.responseDeadline > new Date() ||
        contract.status !== "cancellation_pending"
      ) {
        return false;
      }

      // The original requester is recorded as the dispute opener.
      const [dispute] = await tx
        .insert(disputes)
        .values({
          contractId: contract.id,
          cancellationRequestId: request.id,
          openedById: request.requesterId,
          origin: "cancellation",
          reason:
            `${request.reason}\n\n` +
            "Automatic escalation: the other participant did not respond " +
            "within the three-day cancellation response period.",
          status: "open",
        })
        .returning({ id: disputes.id });

      if (!dispute) {
        throw new Error("Failed to create the cancellation dispute.");
      }

      await tx
        .update(cancellationRequests)
        .set({ status: "escalated" })
        .where(eq(cancellationRequests.id, request.id));

      await tx
        .update(contracts)
        .set({
          status: "disputed",
          updatedAt: new Date(),
        })
        .where(eq(contracts.id, contract.id));

      await tx.insert(disputeEvents).values({
        disputeId: dispute.id,
        actorId: SYSTEM_ACTOR_ID,
        action: "cancellation_auto_escalated",
        details:
          "The cancellation request passed its response deadline " +
          "without a response and was automatically escalated.",
      });

      return true;
    });

    if (result) {
      escalatedCount++;

      // Refresh the relevant admin and participant pages.
      revalidatePath("/admin/disputes");
      revalidatePath(`/dashboard/disputes`);
      revalidatePath(`/dashboard/contracts`);
    }
  }

  return {
    checked: expiredRequests.length,
    escalated: escalatedCount,
  };
}


"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  contracts,
  cancellationRequests,
} from "@/lib/db/schema";
import { requireVerifiedUser } from "@/lib/auth-helpers";

const THREE_DAYS_IN_MS = 3 * 24 * 60 * 60 * 1000;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CancellationActionResult =
  | {
      success: true;
      requestId: string;
      responseDeadline: Date;
    }
  | {
      success: false;
      message: string;
    };

export async function requestContractCancellation(
  input: unknown
): Promise<CancellationActionResult> {
  try {
    // 1. Require an authenticated and verified account.
    const session = await requireVerifiedUser();
    const userId = session.user.id;

    // 2. Validate the incoming data.
    if (!input || typeof input !== "object") {
      return {
        success: false,
        message: "Invalid cancellation request.",
      };
    }

    const data = input as {
      contractId?: unknown;
      reason?: unknown;
    };

    const contractId =
      typeof data.contractId === "string"
        ? data.contractId.trim()
        : "";

    const reason =
      typeof data.reason === "string"
        ? data.reason.trim()
        : "";

    if (!UUID_REGEX.test(contractId)) {
      return {
        success: false,
        message: "Invalid contract ID.",
      };
    }

    if (reason.length < 20 || reason.length > 5000) {
      return {
        success: false,
        message: "Cancellation reason must be between 20 and 5000 characters.",
      };
    }

    // 3. Perform all database changes inside one transaction.
    const result = await db.transaction(async (tx) => {
      // Lock the contract row. This serializes cancellation requests
      // targeting the same contract.
      const [contract] = await tx
        .select({
          id: contracts.id,
          clientId: contracts.clientId,
          freelancerId: contracts.freelancerId,
          status: contracts.status,
        })
        .from(contracts)
        .where(eq(contracts.id, contractId))
        .for("update");

      if (!contract) {
        return {
          success: false as const,
          message: "Contract not found.",
        };
      }

      // 4. Only the contract's client or freelancer may request cancellation.
      const isParticipant =
        contract.clientId === userId ||
        contract.freelancerId === userId;

      if (!isParticipant) {
        return {
          success: false as const,
          message: "You are not authorized to cancel this contract.",
        };
      }

      // 5. Only allow cancellation from valid contract states.
      const cancellableStatuses = [
        "awaiting_payment",
        "active",
        "delivered",
        "revision_requested",
      ] as const;

      if (
        !cancellableStatuses.includes(
          contract.status as (typeof cancellableStatuses)[number]
        )
      ) {
        return {
          success: false as const,
          message: "This contract cannot be cancelled in its current state.",
        };
      }

      // 6. Calculate the response deadline using server time.
      const now = new Date();
      const responseDeadline = new Date(
        now.getTime() + THREE_DAYS_IN_MS
      );

      // 7. Create the cancellation request.
      const [request] = await tx
        .insert(cancellationRequests)
        .values({
          contractId: contract.id,
          requesterId: userId,
          reason,
          previousContractStatus: contract.status,
          responseDeadline,
        })
        .returning({
          id: cancellationRequests.id,
        });

      // 8. Move the contract into its pending cancellation state.
      await tx
        .update(contracts)
        .set({
          status: "cancellation_pending",
          updatedAt: now,
        })
        .where(eq(contracts.id, contract.id));

      return {
        success: true as const,
        requestId: request.id,
        responseDeadline,
      };
    });

    if (!result.success) {
      return result;
    }

    // 9. Refresh the relevant server-rendered pages.
    revalidatePath("/dashboard/contracts");
    revalidatePath(`/dashboard/contracts/${contractId}`);

    return result;
  } catch (error) {
    console.error("Request contract cancellation error:", error);

    return {
      success: false,
      message:
        "Unable to submit the cancellation request. Please try again.",
    };
  }
}

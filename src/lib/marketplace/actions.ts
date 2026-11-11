"use server";

import { db } from "@/lib/db";
import { userCapabilities, marketplaceCapabilityEnum } from "@/lib/db/schema";
import { requireVerifiedUser } from "@/lib/auth-helpers";
import type { MarketplaceCapability } from "./capabilities";

// Validate input at runtime because Server Action arguments
// must always be treated as untrusted.
function isMarketplaceCapability(
  value: unknown
): value is MarketplaceCapability {
  return marketplaceCapabilityEnum.enumValues.some(
    (capability) => capability === value
  );
}

// Activate a marketplace capability for the currently signed-in user.
export async function activateMarketplaceCapability(
  capability: unknown
) {
  // Require an authenticated and email-verified account.
  const session = await requireVerifiedUser();

  // Reject invalid values before touching the database.
  if (!isMarketplaceCapability(capability)) {
    return {
      success: false,
      message: "Invalid marketplace capability.",
    };
  }

  // Insert the capability for this user.
  // onConflictDoNothing makes repeated activation safe.
  await db
    .insert(userCapabilities)
    .values({
      userId: session.user.id,
      capability,
    })
    .onConflictDoNothing();

  return {
    success: true,
    message: `${capability} capability activated successfully.`,
  };
}
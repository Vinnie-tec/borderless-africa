import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  marketplaceCapabilityEnum,
  userCapabilities,
} from "@/lib/db/schema";

// Derive the TypeScript type directly from our Drizzle enum.
// This prevents invalid capability strings from being used.
export type MarketplaceCapability =
  (typeof marketplaceCapabilityEnum.enumValues)[number];

// Retrieve every marketplace capability assigned to a user.
export async function getMarketplaceCapabilities(userId: string) {
  const results = await db
    .select({
      capability: userCapabilities.capability,
    })
    .from(userCapabilities)
    .where(eq(userCapabilities.userId, userId));

  return results.map((result) => result.capability);
}

// Check whether a user has a particular capability.
export async function hasMarketplaceCapability(
  userId: string,
  capability: MarketplaceCapability
) {
  const results = await db
    .select({ capability: userCapabilities.capability })
    .from(userCapabilities)
    .where(eq(userCapabilities.userId, userId));

  return results.some((result) => result.capability === capability);
}
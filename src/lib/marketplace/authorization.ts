import { redirect } from "next/navigation";

import { requireVerifiedUser } from "@/lib/auth-helpers";
import { hasMarketplaceCapability } from "./capabilities";

import type { MarketplaceCapability } from "./capabilities";

// Require the signed-in user to have a specific marketplace capability.
export async function requireMarketplaceCapability(
  capability: MarketplaceCapability
) {
  // First, ensure the user is authenticated and email-verified.
  const session = await requireVerifiedUser();

  // Then, check their marketplace capability in PostgreSQL.
  const hasCapability = await hasMarketplaceCapability(
    session.user.id,
    capability
  );

  // Users without the required capability cannot proceed.
  if (!hasCapability) {
    redirect("/dashboard");
  }

  return session;
}

// Only clients can perform client-specific operations.
export async function requireClient() {
  return requireMarketplaceCapability("client");
}

// Only freelancers can perform freelancer-specific operations.
export async function requireFreelancer() {
  return requireMarketplaceCapability("freelancer");
}
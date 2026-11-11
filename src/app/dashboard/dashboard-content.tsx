import { requireAuth } from "@/lib/auth-helpers";
import { SignOutButton } from "@/components/auth/sign-out-button";

import MarketplaceSetup from "./marketplace-setup";
import { getMarketplaceCapabilities } from "@/lib/marketplace/capabilities";

export default async function DashboardContent() {
  const session = await requireAuth();

  // Only load marketplace capabilities for verified accounts.
  const capabilities = session.user.emailVerified
    ? await getMarketplaceCapabilities(session.user.id)
    : [];

  return (
    <main>
      <h1>Dashboard</h1>

      <p>Welcome, {session.user.name}!</p>
      <p>Email: {session.user.email}</p>

      <p>
        Email verification:{" "}
        {session.user.emailVerified ? "Verified" : "Not verified"}
      </p>

      {session.user.emailVerified ? (
        <MarketplaceSetup initialCapabilities={capabilities} />
      ) : (
        <p>
          Verify your email before activating marketplace capabilities.
          <a href="/verify-email"> Verify email</a>
        </p>
      )}

      <SignOutButton />
    </main>
  );
}
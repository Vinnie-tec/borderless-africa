import { requireAuth } from "@/lib/auth-helpers";
import { SignOutButton } from "@/components/auth/sign-out-button";
import Link from "next/link";

import MarketplaceSetup from "./marketplace-setup";
import { getMarketplaceCapabilities } from "@/lib/marketplace/capabilities";
import styles from "./dashboard-content.module.scss";

export default async function DashboardContent() {
  const session = await requireAuth();

  // Only load marketplace capabilities for verified accounts.
  const capabilities = session.user.emailVerified
    ? await getMarketplaceCapabilities(session.user.id)
    : [];

  return (
    <main className={styles.page}>
      <section className={styles.welcome}>
        <div className={styles.welcomeCopy}>
          <p className={styles.eyebrow}>Your workspace</p>
          <h1>
            Welcome back, <span>{session.user.name.split(" ")[0]}.</span>
          </h1>
          <p className={styles.description}>
            Find the right opportunity, build lasting partnerships, and move
            your work forward.
          </p>
        </div>
        <div className={styles.account}>
          <span>Signed in as</span>
          <strong>{session.user.email}</strong>
          <span>
            Email {session.user.emailVerified ? "verified" : "not verified"}
          </span>
        </div>
      </section>

      {session.user.emailVerified ? (
        <MarketplaceSetup initialCapabilities={capabilities} />
      ) : (
        <div className={styles.verification}>
          Verify your email before activating marketplace capabilities.
          <Link href="/verify-email">Verify email</Link>
        </div>
      )}

      <div className={styles.actions}>
        <Link href="/jobs">Explore available work</Link>
        <Link href="/dashboard/proposals">My proposals</Link>
        <SignOutButton />
      </div>
    </main>
  );
}
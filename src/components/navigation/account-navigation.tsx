import Link from "next/link";

import { getCurrentSession } from "@/lib/auth-helpers";
import styles from "./account-navigation.module.scss";

type AccountNavigationProps = {
  joinLabel: string;
};

export async function AccountNavigation({
  joinLabel,
}: AccountNavigationProps) {
  const session = await getCurrentSession();

  if (!session) {
    return <AccountNavigationFallback joinLabel={joinLabel} />;
  }

  const firstName = session.user.name.trim().split(/\s+/)[0] || session.user.name;

  return (
    <div className={styles.actions}>
      <span className={styles.greeting}>
        Hi, <strong>{firstName}</strong>
      </span>
      <Link className={styles.workspaceLink} href="/dashboard">
        Workspace
      </Link>
    </div>
  );
}

export function AccountNavigationFallback({
  joinLabel,
}: AccountNavigationProps) {
  return (
    <div className={styles.actions}>
      <Link className={styles.signInLink} href="/sign-in">
        Sign in
      </Link>
      <Link className={styles.joinLink} href="/sign-up">
        {joinLabel}
      </Link>
    </div>
  );
}

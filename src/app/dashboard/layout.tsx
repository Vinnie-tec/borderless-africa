import type { ReactNode } from "react";
import Link from "next/link";
import { Suspense } from "react";

import ThemeToggle from "@/app/theme-toggle";
import { WorkspaceNavigation } from "@/components/navigation/workspace-navigation";
import { workspaceNavigation } from "@/components/navigation/navigation-items";
import styles from "@/app/workspace.module.scss";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className={styles.workspace}>
      <aside className={styles.sidebar}>
        <Link aria-label="Borderless Africa home" className={styles.brand} href="/">
          <span aria-hidden="true" className={styles.brandMark}>
            BA
          </span>
          <span>Borderless Africa</span>
        </Link>

        <p className={styles.sectionLabel}>Workspace</p>
        <Suspense
          fallback={
            <nav aria-label="Workspace navigation" className={styles.navigation}>
              {workspaceNavigation.map((item) => (
                <Link href={item.href} key={item.href}>
                  <span aria-hidden="true" className={styles.navMark}>
                    {item.mark}
                  </span>
                  {item.label}
                </Link>
              ))}
            </nav>
          }
        >
          <WorkspaceNavigation />
        </Suspense>

        <div className={styles.sidebarFooter}>
          <Link href="/">Back to home</Link>
        </div>
      </aside>

      <div className={styles.workspaceMain}>
        <header className={styles.topbar}>
          <div className={styles.topbarCopy}>
            <p>Borderless Africa / Workspace</p>
            <strong>Make progress, together.</strong>
          </div>
          <div className={styles.topbarActions}>
            <Link className={styles.topbarLink} href="/jobs">
              Browse work
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <div className={styles.pageContent}>{children}</div>
      </div>
    </div>
  );
}

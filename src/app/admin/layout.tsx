
import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth-helpers";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { adminNavigation } from "@/components/navigation/navigation-items";
import styles from "@/app/workspace.module.scss";

type Props = {
  children: ReactNode;
};

export default function AdminLayout({ children }: Props) {
  return (
    <Suspense fallback={<p>Loading admin area...</p>}>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}

async function AdminLayoutContent({ children }: Props) {
  await connection();
  await requireAdmin();

  return (
    <div className={styles.workspace}>
      <Suspense
        fallback={
          <aside className={styles.sidebar}>
            <div className={styles.brandWrap}>
              <Link className={styles.brand} href="/admin">
                <span aria-hidden="true" className={styles.brandMark}>BA</span>
                <strong>Borderless Africa</strong>
              </Link>
              <p className={styles.sectionLabel}>Administration</p>
            </div>
            <nav aria-label="Admin navigation" className={styles.navigation}>
              {adminNavigation.map((item) => (
                <Link href={item.href} key={item.href}>
                  <span aria-hidden="true" className={styles.navMark}>
                    {item.mark}
                  </span>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className={styles.sidebarFooter}>
              <Link href="/">Back to marketplace</Link>
            </div>
          </aside>
        }
      >
        <AdminSidebar />
      </Suspense>

      <div className={styles.workspaceMain}>
        <AdminHeader />

        <div className={styles.pageContent}>{children}</div>
      </div>
    </div>
  );
}

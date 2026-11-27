
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "@/app/workspace.module.scss";
import { adminNavigation } from "@/components/navigation/navigation-items";

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brandWrap}>
        <Link className={styles.brand} href="/admin">
          <span aria-hidden="true" className={styles.brandMark}>
            BA
          </span>
          <strong>Borderless Africa</strong>
        </Link>
        <p className={styles.sectionLabel}>Administration</p>
      </div>

      <nav aria-label="Admin navigation" className={styles.navigation}>
        {adminNavigation.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === item.href
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
            >
              <span aria-hidden="true" className={styles.navMark}>
                {item.mark}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className={styles.sidebarFooter}>
        <Link href="/">Back to marketplace</Link>
      </div>
    </aside>
  );
}

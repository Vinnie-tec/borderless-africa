"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "@/app/workspace.module.scss";
import { workspaceNavigation } from "./navigation-items";

export function WorkspaceNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Workspace navigation" className={styles.navigation}>
      {workspaceNavigation.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

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
  );
}

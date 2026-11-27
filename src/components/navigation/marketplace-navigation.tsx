"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "@/app/workspace.module.scss";
import { marketplaceNavigation } from "./navigation-items";

export function MarketplaceNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Marketplace navigation" className={styles.marketplaceNav}>
      {marketplaceNavigation.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

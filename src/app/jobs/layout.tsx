import type { ReactNode } from "react";
import Link from "next/link";
import { Suspense } from "react";
import ThemeToggle from "@/app/theme-toggle";
import {
  AccountNavigation,
  AccountNavigationFallback,
} from "@/components/navigation/account-navigation";
import { MarketplaceNavigation } from "@/components/navigation/marketplace-navigation";
import { marketplaceNavigation } from "@/components/navigation/navigation-items";
import styles from "@/app/workspace.module.scss";

export default function JobsLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.marketplaceLayout}>
      <header className={styles.marketplaceHeader}>
        <Link aria-label="Borderless Africa home" className={styles.brand} href="/">
          <span aria-hidden="true" className={styles.brandMark}>
            BA
          </span>
          <span>Borderless Africa</span>
        </Link>
        <Suspense
          fallback={
            <nav aria-label="Marketplace navigation" className={styles.marketplaceNav}>
              {marketplaceNavigation.map((item) => (
                <Link href={item.href} key={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          }
        >
          <MarketplaceNavigation />
        </Suspense>
        <div className={styles.marketplaceActions}>
          <ThemeToggle />
          <Suspense fallback={<AccountNavigationFallback joinLabel="Join" />}>
            <AccountNavigation joinLabel="Join" />
          </Suspense>
        </div>
      </header>
      <div className={styles.publicContent}>{children}</div>
    </div>
  );
}


import Link from "next/link";
import { Suspense } from "react";
import styles from "./page.module.scss";
import ThemeToggle from "./theme-toggle";
import {
  AccountNavigation,
  AccountNavigationFallback,
} from "@/components/navigation/account-navigation";

export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link
            aria-label="Borderless Africa home"
            className={styles.wordmark}
            href="/"
          >
            <span aria-hidden="true" className={styles.monogram}>
              BA
            </span>
            <span>Borderless Africa</span>
          </Link>
          <nav aria-label="Main navigation" className={styles.navigation}>
            <Link href="/jobs">Explore work</Link>
            <Link href="/dashboard">Your workspace</Link>
          </nav>
          <div className={styles.headerActions}>
            <Suspense fallback={<AccountNavigationFallback joinLabel="Join" />}>
              <AccountNavigation joinLabel="Join" />
            </Suspense>
            <ThemeToggle />
          </div>
        </header>

        <section aria-labelledby="home-title" className={styles.hero}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>Made for work without borders</p>
            <h1 className={styles.title} id="home-title">
              Work without
              <span>borders.</span>
            </h1>
            <p className={styles.description}>
              Find meaningful work, connect with brilliant people, and bring
              your next idea to life across Africa and beyond.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryAction} href="/jobs">
                Explore opportunities <span aria-hidden="true">↗</span>
              </Link>
              <Link className={styles.secondaryAction} href="/sign-up">
                Create your account
              </Link>
            </div>
            <p className={styles.footnote}>Rooted here. Open everywhere.</p>
          </div>

          <div aria-hidden="true" className={styles.artwork}>
            <div className={styles.glassCard}>
              <div className={styles.cardTop}>
                <span className={styles.cardLabel}>Borderless Africa</span>
                <span className={styles.cardIndex}>BA — 01</span>
              </div>
              <div className={styles.orbital}>
                <span className={styles.orb} />
              </div>
              <div className={styles.cardBottom}>
                <p className={styles.cardTitle}>Your next chapter</p>
                <span className={styles.cardArrow}>↗</span>
              </div>
            </div>
          </div>
        </section>

        <footer className={styles.footer}>
          <p>Borderless Africa</p>
          <p>Clarity · Connection · Possibility</p>
        </footer>
      </div>
    </main>
  );
}
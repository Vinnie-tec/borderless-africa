
import Link from "next/link";
import styles from "./page.module.scss";
import ThemeToggle from "./theme-toggle";

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
          <div className={styles.headerActions}>
            <span className={styles.availability}>A fresh perspective</span>
            <ThemeToggle />
          </div>
        </header>

        <section aria-labelledby="home-title" className={styles.hero}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>A new point of view</p>
            <h1 className={styles.title} id="home-title">
              Hello, 

              <span>world.</span>
            </h1>
            <p className={styles.description}>
              A fresh canvas for ideas without borders. Thoughtful by design,
              open to what comes next.
            </p>
            <p className={styles.footnote}>Made with room to imagine</p>
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
                <p className={styles.cardTitle}>A world of possibility</p>
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
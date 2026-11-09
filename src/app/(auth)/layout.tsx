import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./auth-layout.module.scss";

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <aside aria-label="About Borderless Africa" className={styles.story}>
          <Link aria-label="Borderless Africa home" className={styles.brand} href="/">
            <span aria-hidden="true" className={styles.brandMark}>
              BA
            </span>
            <span>Borderless Africa</span>
          </Link>

          <div className={styles.storyCopy}>
            <p className={styles.eyebrow}>Built for what’s next</p>
            <h2>
              Go further,
              <span> together.</span>
            </h2>
            <p className={styles.storyDescription}>
              A space to find your people, discover new possibilities, and make
              progress without borders.
            </p>
          </div>

          <div aria-hidden="true" className={styles.artwork}>
            <div className={styles.artworkRing}>
              <span className={styles.artworkCore} />
              <span className={styles.artworkDot} />
            </div>
            <span className={styles.artworkCaption}>A wider world awaits</span>
          </div>

          <div className={styles.storyFooter}>
            <span className={styles.onlineMark} />
            <span>Rooted here. Open everywhere.</span>
          </div>
        </aside>

        <section aria-label="Account access" className={styles.content}>
          <Link aria-label="Borderless Africa home" className={styles.mobileBrand} href="/">
            <span aria-hidden="true" className={styles.brandMark}>
              BA
            </span>
            <span>Borderless Africa</span>
          </Link>
          <div className={styles.formContent}>{children}</div>
          <p className={styles.privacyNote}>
            By continuing, you agree to keep this a welcoming space for all.
          </p>
        </section>
      </div>
    </main>
  );
}

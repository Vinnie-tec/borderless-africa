
import ThemeToggle from "@/app/theme-toggle";
import styles from "@/app/workspace.module.scss";

export function AdminHeader() {
  return (
    <header className={styles.topbar}>
      <div className={styles.topbarCopy}>
        <p>Borderless Africa / Administration</p>
        <strong>Admin workspace</strong>
      </div>
      <div className={styles.topbarActions}>
        <ThemeToggle />
      </div>
    </header>
  );
}

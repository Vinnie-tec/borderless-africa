import Link from "next/link";
import SignupForm from "./signup-form";
import styles from "../auth-content.module.scss";

export default function SignupPage() {
  return (
    <div>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>Start with possibility</p>
        <h1 className={styles.title}>Make room for more.</h1>
        <p className={styles.description}>
          Create your account and connect with a world of opportunity.
        </p>
      </header>
      <SignupForm />
      <div className={styles.formFooter}>
        <span>Already have an account?</span>
        <Link href="/sign-in">Sign in</Link>
      </div>
      <p className={styles.policy}>
        By creating an account, you agree to our community guidelines.
      </p>
    </div>
  );
}
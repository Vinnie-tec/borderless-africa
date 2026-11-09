import Link from "next/link";
import SigninForm from "./signin-form";
import styles from "../auth-content.module.scss";

export default function SigninPage() {
  return (
    <div>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>Your next chapter</p>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.description}>
          Sign in to pick up right where you left off.
        </p>
      </header>

      <SigninForm />

      <div className={styles.formFooter}>
        <span>New to Borderless Africa?</span>
        <Link href="/sign-up">Create an account</Link>
      </div>
      <p className={styles.policy}>
        <Link href="/forgot-password">Forgot your password?</Link>
      </p>
    </div>
  );
}
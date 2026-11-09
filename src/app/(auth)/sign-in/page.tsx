import Link from "next/link";
import SigninForm from "./signin-form";

export default function SigninPage() {
  return (
    <main>
      <h1>Welcome back</h1>
      <p>Sign in to your Borderless Africa account.</p>

      <SigninForm />

      <p>
        Don&apos;t have an account?{" "}
        <Link href="/sign-up">Create an account</Link>
      </p>

      <p>
        <Link href="/forgot-password">Forgot your password?</Link>
      </p>
    </main>
  );
}
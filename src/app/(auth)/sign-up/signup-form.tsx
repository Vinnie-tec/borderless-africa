"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@/components/toast/toast-provider";
import styles from "./signup-form.module.scss";

export default function SignupForm() {
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords don’t match", {
        description: "Check both password fields and try again.",
      });
      return;
    }

    setIsPending(true);

    try {
      const { error } = await authClient.signUp.email({
        name,
        email,
        password,
        callbackURL: "/dashboard",
      });

      if (error) {
        toast.error("We couldn’t create your account", {
          description: error.message || "Please check your details and try again.",
        });
        return;
      }

      toast.success("Your account is ready", {
        description: "Check the development server terminal for your verification link.",
        duration: 7000,
      });

      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("Something went wrong", {
        description: "Please try creating your account again in a moment.",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form
      aria-busy={isPending}
      className={styles.form}
      onSubmit={handleSubmit}
    >
      <div className={styles.field}>
        <label htmlFor="name">Full name</label>
        <input
          id="name"
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          autoComplete="name"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        <p className={styles.passwordHint}>Use at least 8 characters.</p>
      </div>

      <div className={styles.field}>
        <label htmlFor="confirmPassword">Confirm password</label>
        <input
          id="confirmPassword"
          type="password"
          placeholder="Enter your password again"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <button className={styles.submit} type="submit" disabled={isPending}>
        {isPending ? (
          <>
            <span aria-hidden="true" className={styles.spinner} />
            Creating your account...
          </>
        ) : (
          <>
            Create account
            <span aria-hidden="true" className={styles.arrow}>
              →
            </span>
          </>
        )}
      </button>
    </form>
  );
}
"use client";

import {
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { FormField } from "@/components/forms/form-field";
import { useToast } from "@/components/toast/toast-provider";
import styles from "./signin-form.module.scss";

export default function SigninForm() {
  const router = useRouter();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tracks the pending navigation to the dashboard.
  const [isNavigating, startTransition] = useTransition();

  // The button stays pending during submission OR navigation.
  const isPending = isSubmitting || isNavigating;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);

    try {
      const { error } = await authClient.signIn.email({
        email,
        password,
      });

      if (error) {
        toast.error("We couldn’t sign you in", {
          description: error.message || "Check your details and try again.",
        });
        return;
      }

      // Authentication succeeded. Now begin navigation.
      startTransition(() => {
        router.replace("/dashboard");
      });
    } catch {
      toast.error("Something went wrong", {
        description: "Please try signing in again in a moment.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      aria-busy={isPending}
      className={styles.form}
      onSubmit={handleSubmit}
    >
      <FormField
        id="email"
        label="Email address"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        required
      />

      <FormField
        id="password"
        label="Password"
        type="password"
        placeholder="Enter your password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        required
      />

      <button className={styles.submit} type="submit" disabled={isPending}>
        {isPending ? (
          <>
            <span aria-hidden="true" className={styles.spinner} />
            {isSubmitting ? "Signing in..." : "Opening your space..."}
          </>
        ) : (
          <>
            Sign in
            <span aria-hidden="true" className={styles.arrow}>
              →
            </span>
          </>
        )}
      </button>
    </form>
  );
}
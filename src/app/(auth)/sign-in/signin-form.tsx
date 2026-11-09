"use client";

import {
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { FormField } from "@/components/forms/form-field";

export default function SigninForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tracks the pending navigation to the dashboard.
  const [isNavigating, startTransition] = useTransition();

  // The button stays pending during submission OR navigation.
  const isPending = isSubmitting || isNavigating;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    try {
      const { error } = await authClient.signIn.email({
        email,
        password,
      });

      if (error) {
        setError(error.message || "Unable to sign in.");
        return;
      }

      // Authentication succeeded. Now begin navigation.
      startTransition(() => {
        router.replace("/dashboard");
      });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FormField
        id="email"
        label="Email address"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        required
      />

      <FormField
        id="password"
        label="Password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        required
      />

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={isPending}>
        {isSubmitting
          ? "Signing in..."
          : isNavigating
            ? "Opening dashboard..."
            : "Sign in"}
      </button>
    </form>
  );
}
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { authClient } from "@/lib/auth-client";
import { FormField } from "@/components/forms/form-field";
import { useToast } from "@/components/toast/toast-provider";

export default function ForgotPasswordForm() {
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsPending(true);

    try {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });

      if (error) {
        toast.error("Unable to process your request", {
          description: "Please try again shortly.",
        });
        return;
      }

      // Use the same response regardless of whether the account exists.
      // This avoids revealing registered email addresses.
      setSubmitted(true);

      toast.success("Check your email", {
        description: "If an account exists, a password reset link will be sent.",
      });
    } catch {
      toast.error("Something went wrong", {
        description: "We couldn't process your request. Please try again.",
      });
    } finally {
      setIsPending(false);
    }
  }

  if (submitted) {
    return (
      <section>
        <h2>Check your inbox</h2>
        <p>
          If an account exists for {email}, you will receive instructions
          to reset your password.
        </p>

        <Link href="/sign-in">Back to sign in</Link>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <p>
        Enter the email address associated with your account. We&apos;ll send
        you instructions to reset your password.
      </p>

      <FormField
        id="email"
        label="Email address"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        required
      />

      <button type="submit" disabled={isPending}>
        {isPending ? "Sending instructions..." : "Send reset link"}
      </button>

      <p>
        Remember your password? <Link href="/sign-in">Sign in</Link>
      </p>
    </form>
  );
}
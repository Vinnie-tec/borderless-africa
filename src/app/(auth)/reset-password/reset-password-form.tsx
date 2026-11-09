"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { FormField } from "@/components/forms/form-field";
import { useToast } from "@/components/toast/toast-provider";

type ResetPasswordFormProps = {
  token: string;
  hasInvalidToken: boolean;
};

export default function ResetPasswordForm({
  token,
  hasInvalidToken,
}: ResetPasswordFormProps) {
  const router = useRouter();
  const toast = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, setIsPending] = useState(false);

  // Without a valid token, there is no reset request we can submit.
  if (!token || hasInvalidToken) {
    return (
      <section>
        <h2>Reset link unavailable</h2>
        <p>
          This password reset link is invalid or may have expired.
          Request a new one to continue.
        </p>

        <Link href="/forgot-password">
          Request another reset link
        </Link>
      </section>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      toast.error("Password is too short", {
        description: "Your password must contain at least 8 characters.",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match", {
        description: "Please make sure both passwords are identical.",
      });
      return;
    }

    setIsPending(true);

    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (error) {
        toast.error("Password reset failed", {
          description:
            "The reset link may have expired. Request a new one and try again.",
        });
        return;
      }

      toast.success("Password updated", {
        description: "Your password has been changed. Please sign in.",
      });

      router.replace("/sign-in");
    } catch {
      toast.error("Something went wrong", {
        description: "We couldn't update your password. Please try again.",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p>Choose a new password for your account.</p>

      <FormField
        id="password"
        label="New password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="new-password"
        minLength={8}
        required
      />

      <FormField
        id="confirm-password"
        label="Confirm new password"
        type="password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        autoComplete="new-password"
        minLength={8}
        required
      />

      <button type="submit" disabled={isPending}>
        {isPending ? "Updating password..." : "Update password"}
      </button>
    </form>
  );
}
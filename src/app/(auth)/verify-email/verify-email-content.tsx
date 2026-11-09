"use client";

import { useState } from "react";
import Link from "next/link";

import { authClient } from "@/lib/auth-client";
import { useToast } from "@/components/toast/toast-provider";

type VerifyEmailContentProps = {
  email: string;
  emailVerified: boolean;
};

export default function VerifyEmailContent({
  email,
  emailVerified,
}: VerifyEmailContentProps) {
  const toast = useToast();
  const [isPending, setIsPending] = useState(false);

  async function handleResend() {
    setIsPending(true);

    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: "/dashboard",
      });

      if (error) {
        toast.error("Could not send verification link", {
          description: "Please try again shortly.",
        });
        return;
      }

      toast.success("Verification link sent", {
        description: "Check your email for the new verification link.",
      });
    } catch {
      toast.error("Something went wrong", {
        description: "We couldn't send the verification link. Try again.",
      });
    } finally {
      setIsPending(false);
    }
  }

  if (emailVerified) {
    return (
      <section>
        <h2>Your email is verified</h2>
        <p>{email}</p>
        <p>You can now access verified-user features.</p>

        <Link href="/dashboard">Continue to dashboard</Link>
      </section>
    );
  }

  return (
    <section>
      <h2>Verify your email address</h2>

      <p>
        We haven&apos;t confirmed ownership of this email address yet:
        {" "}
        <strong>{email}</strong>
      </p>

      <p>
        Check your inbox for the verification link. If you can&apos;t find it,
        you can request another one.
      </p>

      <button
        type="button"
        onClick={handleResend}
        disabled={isPending}
      >
        {isPending ? "Sending..." : "Resend verification link"}
      </button>
    </section>
  );
}
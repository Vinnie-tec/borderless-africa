"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { useToast } from "@/components/toast/toast-provider";

export function SignOutButton() {
  const router = useRouter();
  const toast = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNavigating, startTransition] = useTransition();

  const isPending = isSubmitting || isNavigating;

  async function handleSignOut() {
    setIsSubmitting(true);

    try {
      const { error } = await authClient.signOut();

      if (error) {
        toast.error("Sign out failed", {
          description: error.message || "Please try again.",
        });
        return;
      }

      toast.success("Signed out successfully", {
        description: "You have safely signed out of your account.",
      });

      // Navigate only after the server confirms sign-out.
      startTransition(() => {
        router.replace("/sign-in");
      });
    } catch {
      toast.error("Something went wrong", {
        description: "We couldn't sign you out. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
    >
      {isSubmitting
        ? "Signing out..."
        : isNavigating
          ? "Redirecting..."
          : "Sign out"}
    </button>
  );
}
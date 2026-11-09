import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

// Retrieves the currently authenticated user and session.
export async function getCurrentSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

// Prevents unauthenticated users from accessing protected pages.
export async function requireAuth() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  return session;
}

export async function requireVerifiedUser() {
  const session = await requireAuth();

  if (!session.user.emailVerified) {
    redirect("/verify-email");
  }

  return session;
}

/**
 * Require an authenticated user with a verified email
 * and the administrator role.
 */
export async function requireAdmin() {
  const session = await requireVerifiedUser();

  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  return session;
}
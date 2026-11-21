
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

// Retrieves the currently authenticated user and session.
// Also checks the database for an active account suspension.
export async function getCurrentSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return null;
  }

  const [account] = await db
    .select({
      banned: user.banned,
      banExpires: user.banExpires,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!account) {
    return null;
  }

  const isCurrentlyBanned =
    account.banned &&
    (!account.banExpires || account.banExpires > new Date());

  if (isCurrentlyBanned) {
    return null;
  }

  return session;
}

// Prevents unauthenticated or suspended users from accessing protected pages.
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

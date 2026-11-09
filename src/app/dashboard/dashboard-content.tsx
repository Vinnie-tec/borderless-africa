import { requireAuth } from "@/lib/auth-helpers";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function DashboardContent() {
  const session = await requireAuth();

  return (
    <main>
      <h1>Dashboard</h1>

      <p>Welcome, {session.user.name}!</p>
      <p>Email: {session.user.email}</p>

      <p>
        Email verification:{" "}
        {session.user.emailVerified ? "Verified" : "Not verified"}
      </p>
      <SignOutButton />
    </main>
  );
}
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth-helpers";

// This component needs request-specific session information.
async function AdminContent() {
  const session = await requireAdmin();

  return (
    <main>
      <h1>Admin authorization successful</h1>
      <p>Signed in as: {session.user.email}</p>
      <p>Role: {session.user.role}</p>
    </main>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<p>Loading admin dashboard...</p>}>
      <AdminContent />
    </Suspense>
  );
}

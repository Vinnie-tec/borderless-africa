import { requireAuth } from "@/lib/auth-helpers";
import VerifyEmailContent from "./verify-email-content";

export default async function VerifyEmailPage() {
  const session = await requireAuth();

  return (
    <main>
      <h1>Email verification</h1>

      <VerifyEmailContent
        email={session.user.email}
        emailVerified={session.user.emailVerified}
      />
    </main>
  );
}
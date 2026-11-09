import { Suspense } from "react";
import { requireAuth } from "@/lib/auth-helpers";
import VerifyEmailContent from "./verify-email-content";

// Session access happens here, inside the Suspense boundary.
async function VerifyEmailPageContent() {
  const session = await requireAuth();

  return (
    <VerifyEmailContent
      email={session.user.email}
      emailVerified={session.user.emailVerified}
    />
  );
}

export default function VerifyEmailPage() {
  return (
    <main>
      <h1>Verify your email</h1>
      <p>
        Verify your email address to access all the features of Borderless
        Africa.
      </p>

      <Suspense fallback={<p>Loading verification status...</p>}>
        <VerifyEmailPageContent />
      </Suspense>
    </main>
  );
}
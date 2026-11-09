import { Suspense } from "react";
import ResetPasswordForm from "./reset-password-form";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    token?: string;
    error?: string;
  }>;
};

// This component accesses request-specific URL parameters.
async function ResetPasswordContent({
  searchParams,
}: ResetPasswordPageProps) {
  const params = await searchParams;

  return (
    <ResetPasswordForm
      token={params.token ?? ""}
      hasInvalidToken={params.error === "INVALID_TOKEN"}
    />
  );
}

export default function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  return (
    <main>
      <h1>Reset your password</h1>
      <p>Enter a new password to regain access to your account.</p>

      <Suspense fallback={<p>Loading password reset form...</p>}>
        <ResetPasswordContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
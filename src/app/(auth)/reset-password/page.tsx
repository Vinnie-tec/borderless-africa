import ResetPasswordForm from "./reset-password-form";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    token?: string;
    error?: string;
  }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const params = await searchParams;

  return (
    <main>
      <h1>Reset your password</h1>
      <p>Enter a new password to regain access to your account.</p>

      <ResetPasswordForm
        token={params.token ?? ""}
        hasInvalidToken={params.error === "INVALID_TOKEN"}
      />
    </main>
  );
}
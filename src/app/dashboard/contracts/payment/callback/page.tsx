
import { Suspense } from "react";
import { connection } from "next/server";

import { PaymentCallback } from "@/components/contracts/payment-callback";

type PaymentCallbackPageProps = {
  searchParams: Promise<{
    reference?: string | string[];
    trxref?: string | string[];
  }>;
};

function PaymentCallbackFallback() {
  return (
    <main>
      <h1>Loading payment status</h1>
      <p>Please wait while we prepare your payment verification.</p>
    </main>
  );
}

async function PaymentCallbackContent({
  searchParams,
}: PaymentCallbackPageProps) {
  // Wait for an actual request before accessing runtime search parameters.
  await connection();

  const params = await searchParams;

  const reference =
    typeof params.reference === "string"
      ? params.reference
      : typeof params.trxref === "string"
        ? params.trxref
        : null;

  return <PaymentCallback reference={reference} />;
}

export default function PaymentCallbackPage({
  searchParams,
}: PaymentCallbackPageProps) {
  return (
    <Suspense fallback={<PaymentCallbackFallback />}>
      <PaymentCallbackContent searchParams={searchParams} />
    </Suspense>
  );
}

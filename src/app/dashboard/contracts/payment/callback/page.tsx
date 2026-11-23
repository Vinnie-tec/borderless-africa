import { PaymentCallback } from "@/components/contracts/payment-callback";

type PaymentCallbackPageProps = {
  searchParams: Promise<{
    reference?: string | string[];
    trxref?: string | string[];
  }>;
};

export default async function PaymentCallbackPage({
  searchParams,
}: PaymentCallbackPageProps) {
  const params = await searchParams;

  const reference =
    typeof params.reference === "string"
      ? params.reference
      : typeof params.trxref === "string"
        ? params.trxref
        : null;

  return <PaymentCallback reference={reference} />;
}
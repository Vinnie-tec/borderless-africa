
import { Suspense } from "react";
import { connection } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { notFound } from "next/navigation";

import { requireVerifiedUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { contracts } from "@/lib/db/schema";

type ContractPageProps = {
  params: Promise<{
    contractId: string;
  }>;
};

async function ContractContent({
  params,
}: ContractPageProps) {
  await connection();

  const session = await requireVerifiedUser();
  const { contractId } = await params;

  // Validate the route parameter before querying the database.
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(contractId)) {
    notFound();
  }

  // Authorization is part of the database query.
  // Non-participants cannot access this contract.
  const [contract] = await db
    .select()
    .from(contracts)
    .where(
      and(
        eq(contracts.id, contractId),
        or(
          eq(contracts.clientId, session.user.id),
          eq(contracts.freelancerId, session.user.id)
        )
      )
    )
    .limit(1);

  if (!contract) {
    notFound();
  }

  const userRole =
    contract.clientId === session.user.id
      ? "Client"
      : "Freelancer";

  const formattedPrice = new Intl.NumberFormat("en", {
    style: "currency",
    currency: contract.currency,
  }).format(Number(contract.agreedPrice));

  return (
    <section>
      <a href="/dashboard/contracts">Back to contracts</a>

      <h1>{contract.title}</h1>

      <p>Contract ID: {contract.id}</p>
      <p>Your role: {userRole}</p>
      <p>Status: {contract.status.replaceAll("_", " ")}</p>

      <section>
        <h2>Agreed scope</h2>
        <p>{contract.scope}</p>
      </section>

      <section>
        <h2>Agreed terms</h2>

        <p>Price: {formattedPrice}</p>
        <p>Delivery time: {contract.deliveryDays} days</p>
        <p>Revision allowance: {contract.revisionAllowance}</p>
      </section>

      <section>
        <h2>Contract information</h2>

        <p>Client ID: {contract.clientId}</p>
        <p>Freelancer ID: {contract.freelancerId}</p>
        <p>Created: {contract.createdAt.toLocaleString()}</p>
        <p>Last updated: {contract.updatedAt.toLocaleString()}</p>
      </section>
    </section>
  );
}

export default function ContractDetailsPage(
  props: ContractPageProps
) {
  return (
    <Suspense fallback={<p>Loading contract...</p>}>
      <ContractContent params={props.params} />
    </Suspense>
  );
}

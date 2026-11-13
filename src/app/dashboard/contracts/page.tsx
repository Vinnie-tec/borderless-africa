
import { Suspense } from "react";
import { connection } from "next/server";
import { desc, eq, or } from "drizzle-orm";

import { requireVerifiedUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { contracts } from "@/lib/db/schema";

async function ContractsContent() {
  await connection();

  const session = await requireVerifiedUser();

  // Only retrieve contracts where the current user is a participant.
  const myContracts = await db
    .select({
      id: contracts.id,
      title: contracts.title,
      agreedPrice: contracts.agreedPrice,
      currency: contracts.currency,
      status: contracts.status,
      deliveryDays: contracts.deliveryDays,
      createdAt: contracts.createdAt,
      clientId: contracts.clientId,
      freelancerId: contracts.freelancerId,
    })
    .from(contracts)
    .where(
      or(
        eq(contracts.clientId, session.user.id),
        eq(contracts.freelancerId, session.user.id)
      )
    )
    .orderBy(desc(contracts.createdAt));

  if (myContracts.length === 0) {
    return (
      <section>
        <h1>My contracts</h1>
        <p>You don&apos;t have any contracts yet.</p>
      </section>
    );
  }

  return (
    <section>
      <h1>My contracts</h1>

      {myContracts.map((contract) => {
        const userRole =
          contract.clientId === session.user.id
            ? "Client"
            : "Freelancer";

        return (
          <article key={contract.id}>
            <h2>
              <a href={`/dashboard/contracts/${contract.id}`}>
                {contract.title}
              </a>
            </h2>

            <p>Role: {userRole}</p>
            <p>Status: {contract.status.replaceAll("_", " ")}</p>

            <p>
              Agreed price:{" "}
              {new Intl.NumberFormat("en", {
                style: "currency",
                currency: contract.currency,
              }).format(Number(contract.agreedPrice))}
            </p>

            <p>Delivery: {contract.deliveryDays} days</p>

            <small>
              Created: {contract.createdAt.toLocaleDateString()}
            </small>
          </article>
        );
      })}
    </section>
  );
}

export default function ContractsPage() {
  return (
    <Suspense fallback={<p>Loading contracts...</p>}>
      <ContractsContent />
    </Suspense>
  );
}

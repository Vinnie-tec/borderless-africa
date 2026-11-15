
import Link from "next/link";
import { connection } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { contracts, disputes } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";
import { Suspense } from "react";

export default function AdminDisputesPage() {
  return (
    <Suspense fallback={<p>Loading disputes...</p>}>
      <AdminDisputesContent />
    </Suspense>
  );
}

async function AdminDisputesContent() {
  await connection();
  await requireAdmin();

  const disputeList = await db
    .select({
      id: disputes.id,
      origin: disputes.origin,
      reason: disputes.reason,
      status: disputes.status,
      createdAt: disputes.createdAt,
      contractId: contracts.id,
      contractTitle: contracts.title,
    })
    .from(disputes)
    .innerJoin(
      contracts,
      eq(disputes.contractId, contracts.id)
    )
    .orderBy(desc(disputes.createdAt));

  const openCount = disputeList.filter(
    (item) => item.status === "open"
  ).length;

  const reviewCount = disputeList.filter(
    (item) => item.status === "under_review"
  ).length;

  const resolvedCount = disputeList.filter(
    (item) => item.status === "resolved"
  ).length;

  return (
    <main>
      <header>
        <h1>Dispute management</h1>
        <p>
          Review marketplace disputes and record administrative decisions.
        </p>
      </header>

      <section>
        <h2>Overview</h2>

        <div>
          <article>
            <h3>Open</h3>
            <p>{openCount}</p>
          </article>

          <article>
            <h3>Under review</h3>
            <p>{reviewCount}</p>
          </article>

          <article>
            <h3>Resolved</h3>
            <p>{resolvedCount}</p>
          </article>
        </div>
      </section>

      <section>
        <h2>All disputes</h2>

        {disputeList.length === 0 ? (
          <p>No disputes have been submitted yet.</p>
        ) : (
          disputeList.map((item) => (
            <article key={item.id}>
              <h3>{item.contractTitle}</h3>

              <p>
                Status: {item.status.replace("_", " ")}
              </p>

              <p>Origin: {item.origin}</p>

              <p>
                Reason:{" "}
                {item.reason.length > 180
                  ? `${item.reason.slice(0, 180)}...`
                  : item.reason}
              </p>

              <small>
                Created: {item.createdAt.toLocaleString()}
              </small>

              <p>
                <Link href={`/admin/disputes/${item.id}`}>
                  Review dispute
                </Link>
              </p>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

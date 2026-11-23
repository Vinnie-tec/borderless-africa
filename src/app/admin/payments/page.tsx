
import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";

import {
  and,
  count,
  desc,
  eq,
  ilike,
  or,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/lib/db";
import {
  contractPayments,
  contracts,
  jobs,
  user,
} from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";

const PAGE_SIZE = 20;

const paymentStatuses = [
  "initialized",
  "pending",
  "successful",
  "failed",
  "abandoned",
] as const;

type PaymentStatus = (typeof paymentStatuses)[number];

type PageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
  }>;
};

async function AdminPaymentsContent({ searchParams }: PageProps) {
  await connection();
  await requireAdmin();

  const params = await searchParams;

  const query =
    typeof params.q === "string"
      ? params.q.trim().slice(0, 100)
      : "";

  const status: PaymentStatus | undefined =
    paymentStatuses.includes(params.status as PaymentStatus)
      ? (params.status as PaymentStatus)
      : undefined;

  const requestedPage = Math.max(
    1,
    Number.parseInt(params.page ?? "1", 10) || 1,
  );

  const client = alias(user, "payment_client");

  const searchCondition = query
    ? or(
        ilike(contractPayments.providerReference, `%${query}%`),
        ilike(contracts.title, `%${query}%`),
        ilike(jobs.title, `%${query}%`),
        ilike(client.name, `%${query}%`),
        ilike(client.email, `%${query}%`),
      )
    : undefined;

  const statusCondition = status
    ? eq(contractPayments.status, status)
    : undefined;

  const whereCondition = and(searchCondition, statusCondition);

  const [countResult] = await db
    .select({ total: count() })
    .from(contractPayments)
    .innerJoin(
      contracts,
      eq(contractPayments.contractId, contracts.id),
    )
    .innerJoin(jobs, eq(contracts.jobId, jobs.id))
    .innerJoin(client, eq(contractPayments.clientId, client.id))
    .where(whereCondition);

  const total = countResult.total;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const currentPage = Math.min(
    requestedPage,
    Math.max(totalPages, 1),
  );

  const offset = (currentPage - 1) * PAGE_SIZE;

  const paymentRecords = await db
    .select({
      id: contractPayments.id,
      contractId: contracts.id,
      contractTitle: contracts.title,
      jobTitle: jobs.title,

      provider: contractPayments.provider,
      providerReference: contractPayments.providerReference,
      amount: contractPayments.amount,
      currency: contractPayments.currency,
      status: contractPayments.status,
      authorizationUrl: contractPayments.authorizationUrl,
      paidAt: contractPayments.paidAt,
      createdAt: contractPayments.createdAt,
      updatedAt: contractPayments.updatedAt,

      clientName: client.name,
      clientEmail: client.email,
    })
    .from(contractPayments)
    .innerJoin(
      contracts,
      eq(contractPayments.contractId, contracts.id),
    )
    .innerJoin(jobs, eq(contracts.jobId, jobs.id))
    .innerJoin(client, eq(contractPayments.clientId, client.id))
    .where(whereCondition)
    .orderBy(desc(contractPayments.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  function getPageUrl(page: number) {
    const search = new URLSearchParams();

    if (query) search.set("q", query);
    if (status) search.set("status", status);

    search.set("page", String(page));

    return `/admin/payments?${search.toString()}`;
  }

  return (
    <section>
      <header>
        <h1>Payment Management</h1>

        <p>
          Monitor payment attempts and payment activity across the marketplace.
        </p>

        <p>Total matching payments: {total}</p>
      </header>

      <form method="GET">
        <div>
          <label htmlFor="payment-search">
            Search payments
          </label>

          <input
            id="payment-search"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Reference, contract, job or client..."
            maxLength={100}
          />
        </div>

        <div>
          <label htmlFor="payment-status">
            Payment status
          </label>

          <select
            id="payment-status"
            name="status"
            defaultValue={status ?? ""}
          >
            <option value="">All statuses</option>

            {paymentStatuses.map((paymentStatus) => (
              <option key={paymentStatus} value={paymentStatus}>
                {paymentStatus.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <button type="submit">Apply filters</button>

        <Link href="/admin/payments">Clear filters</Link>
      </form>

      {paymentRecords.length === 0 ? (
        <p>No payments found matching these filters.</p>
      ) : (
        <>
          <div>
            {paymentRecords.map((payment) => (
              <article key={payment.id}>
                <header>
                  <h2>
                    <Link
                      href={`/admin/contracts/${payment.contractId}`}
                    >
                      {payment.contractTitle}
                    </Link>
                  </h2>

                  <p>
                    Status: {payment.status.replaceAll("_", " ")}
                  </p>
                </header>

                <dl>
                  <dt>Payment ID</dt>
                  <dd>{payment.id}</dd>

                  <dt>Payment reference</dt>
                  <dd>{payment.providerReference}</dd>

                  <dt>Original job</dt>
                  <dd>{payment.jobTitle}</dd>

                  <dt>Client</dt>
                  <dd>
                    {payment.clientName} — {payment.clientEmail}
                  </dd>

                  <dt>Provider</dt>
                  <dd>{payment.provider}</dd>

                  <dt>Amount</dt>
                  <dd>
                    {payment.currency}{" "}
                    {Number(payment.amount).toLocaleString()}
                  </dd>

                  <dt>Payment status</dt>
                  <dd>{payment.status.replaceAll("_", " ")}</dd>

                  <dt>Paid at</dt>
                  <dd>
                    {payment.paidAt
                      ? payment.paidAt.toLocaleString()
                      : "Not paid"}
                  </dd>

                  <dt>Created</dt>
                  <dd>{payment.createdAt.toLocaleString()}</dd>

                  <dt>Last updated</dt>
                  <dd>{payment.updatedAt.toLocaleString()}</dd>
                </dl>

                <Link
                  href={`/admin/contracts/${payment.contractId}`}
                >
                  Inspect contract
                </Link>
              </article>
            ))}
          </div>

          <nav aria-label="Payment pagination">
            <p>
              Page {currentPage} of {Math.max(totalPages, 1)}
            </p>

            {currentPage > 1 && (
              <Link href={getPageUrl(currentPage - 1)}>
                Previous
              </Link>
            )}

            {" "}

            {currentPage < totalPages && (
              <Link href={getPageUrl(currentPage + 1)}>
                Next
              </Link>
            )}
          </nav>
        </>
      )}
    </section>
  );
}

export default function AdminPaymentsPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<p>Loading payments...</p>}>
      <AdminPaymentsContent searchParams={searchParams} />
    </Suspense>
  );
}

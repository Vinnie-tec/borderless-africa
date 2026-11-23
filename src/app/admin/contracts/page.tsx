
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
import { contracts, jobs, user } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";

const PAGE_SIZE = 20;

const contractStatuses = [
  "awaiting_payment",
  "active",
  "delivered",
  "revision_requested",
  "cancellation_pending",
  "completed",
  "cancelled",
  "disputed",
] as const;

type ContractStatus = (typeof contractStatuses)[number];

type PageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
  }>;
};

async function AdminContractsContent({ searchParams }: PageProps) {
  await connection();
  await requireAdmin();

  const params = await searchParams;

  const query =
    typeof params.q === "string"
      ? params.q.trim().slice(0, 100)
      : "";

  const status: ContractStatus | undefined =
    contractStatuses.includes(params.status as ContractStatus)
      ? (params.status as ContractStatus)
      : undefined;

  const requestedPage = Math.max(
    1,
    Number.parseInt(params.page ?? "1", 10) || 1,
  );

  const client = alias(user, "contract_client");
  const freelancer = alias(user, "contract_freelancer");

  const searchCondition = query
    ? or(
        ilike(contracts.title, `%${query}%`),
        ilike(jobs.title, `%${query}%`),
        ilike(client.name, `%${query}%`),
        ilike(client.email, `%${query}%`),
        ilike(freelancer.name, `%${query}%`),
        ilike(freelancer.email, `%${query}%`),
      )
    : undefined;

  const statusCondition = status
    ? eq(contracts.status, status)
    : undefined;

  const whereCondition = and(searchCondition, statusCondition);

  const [countResult] = await db
    .select({ total: count() })
    .from(contracts)
    .innerJoin(jobs, eq(contracts.jobId, jobs.id))
    .innerJoin(client, eq(contracts.clientId, client.id))
    .innerJoin(freelancer, eq(contracts.freelancerId, freelancer.id))
    .where(whereCondition);

  const total = countResult.total;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const currentPage = Math.min(
    requestedPage,
    Math.max(totalPages, 1),
  );

  const offset = (currentPage - 1) * PAGE_SIZE;

  const contractRecords = await db
    .select({
      id: contracts.id,
      jobId: jobs.id,
      jobTitle: jobs.title,
      title: contracts.title,
      agreedPrice: contracts.agreedPrice,
      currency: contracts.currency,
      deliveryDays: contracts.deliveryDays,
      revisionAllowance: contracts.revisionAllowance,
      revisionsUsed: contracts.revisionsUsed,
      status: contracts.status,
      createdAt: contracts.createdAt,
      updatedAt: contracts.updatedAt,

      clientName: client.name,
      clientEmail: client.email,

      freelancerName: freelancer.name,
      freelancerEmail: freelancer.email,
    })
    .from(contracts)
    .innerJoin(jobs, eq(contracts.jobId, jobs.id))
    .innerJoin(client, eq(contracts.clientId, client.id))
    .innerJoin(freelancer, eq(contracts.freelancerId, freelancer.id))
    .where(whereCondition)
    .orderBy(desc(contracts.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  function getPageUrl(page: number) {
    const search = new URLSearchParams();

    if (query) search.set("q", query);
    if (status) search.set("status", status);

    search.set("page", String(page));

    return `/admin/contracts?${search.toString()}`;
  }

  return (
    <section>
      <header>
        <h1>Contract Management</h1>
        <p>
          Monitor agreements and contract activity across the marketplace.
        </p>
        <p>Total matching contracts: {total}</p>
      </header>

      <form method="GET">
        <div>
          <label htmlFor="contract-search">
            Search contracts
          </label>

          <input
            id="contract-search"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Contract, job, client or freelancer..."
            maxLength={100}
          />
        </div>

        <div>
          <label htmlFor="contract-status">
            Contract status
          </label>

          <select
            id="contract-status"
            name="status"
            defaultValue={status ?? ""}
          >
            <option value="">All statuses</option>

            {contractStatuses.map((contractStatus) => (
              <option key={contractStatus} value={contractStatus}>
                {contractStatus.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <button type="submit">Apply filters</button>

        <Link href="/admin/contracts">Clear filters</Link>
      </form>

      {contractRecords.length === 0 ? (
        <p>No contracts found matching these filters.</p>
      ) : (
        <>
          <div>
            {contractRecords.map((contract) => (
              <article key={contract.id}>
                <header>
                  <h2>
                    <Link href={`/admin/contracts/${contract.id}`}>
                      {contract.title}
                    </Link>
                  </h2>

                  <p>
                    Status: {contract.status.replaceAll("_", " ")}
                  </p>
                </header>

                <dl>
                  <dt>Contract ID</dt>
                  <dd>{contract.id}</dd>

                  <dt>Original job</dt>
                  <dd>
                    <Link href={`/admin/jobs/${contract.jobId}`}>
                      {contract.jobTitle}
                    </Link>
                  </dd>

                  <dt>Client</dt>
                  <dd>
                    {contract.clientName} — {contract.clientEmail}
                  </dd>

                  <dt>Freelancer</dt>
                  <dd>
                    {contract.freelancerName} — {contract.freelancerEmail}
                  </dd>

                  <dt>Agreed price</dt>
                  <dd>
                    {contract.currency}{" "}
                    {Number(contract.agreedPrice).toLocaleString()}
                  </dd>

                  <dt>Delivery timeframe</dt>
                  <dd>{contract.deliveryDays} days</dd>

                  <dt>Revisions</dt>
                  <dd>
                    {contract.revisionsUsed} of {contract.revisionAllowance} used
                  </dd>

                  <dt>Created</dt>
                  <dd>{contract.createdAt.toLocaleString()}</dd>

                  <dt>Last updated</dt>
                  <dd>{contract.updatedAt.toLocaleString()}</dd>
                </dl>

                <Link href={`/admin/contracts/${contract.id}`}>
                  Inspect contract
                </Link>
              </article>
            ))}
          </div>

          <nav aria-label="Contract pagination">
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

export default function AdminContractsPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<p>Loading contracts...</p>}>
      <AdminContractsContent searchParams={searchParams} />
    </Suspense>
  );
}

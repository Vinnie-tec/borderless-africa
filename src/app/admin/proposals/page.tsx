
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
  jobs,
  proposals,
  user,
} from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";

const PAGE_SIZE = 20;

const proposalStatuses = [
  "pending",
  "negotiating",
  "accepted",
  "rejected",
  "withdrawn",
  "expired",
] as const;

type ProposalStatus = (typeof proposalStatuses)[number];

type PageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
  }>;
};

async function AdminProposalsContent({
  searchParams,
}: PageProps) {
  await connection();
  await requireAdmin();

  const params = await searchParams;

  // Sanitize search input.
  const query =
    typeof params.q === "string"
      ? params.q.trim().slice(0, 100)
      : "";

  // Validate the requested status.
  const status: ProposalStatus | undefined =
    proposalStatuses.includes(params.status as ProposalStatus)
      ? (params.status as ProposalStatus)
      : undefined;

  // Validate the requested page.
  const requestedPage = Math.max(
    1,
    Number.parseInt(params.page ?? "1", 10) || 1,
  );

  // Alias user because each proposal has two different user relationships.
  const freelancer = alias(user, "freelancer");
  const client = alias(user, "client");

  const searchCondition = query
    ? or(
        ilike(jobs.title, `%${query}%`),
        ilike(freelancer.name, `%${query}%`),
        ilike(freelancer.email, `%${query}%`),
        ilike(client.name, `%${query}%`),
        ilike(client.email, `%${query}%`),
      )
    : undefined;

  const statusCondition = status
    ? eq(proposals.status, status)
    : undefined;

  const whereCondition = and(
    searchCondition,
    statusCondition,
  );

  // Count matching proposals before pagination.
  const [countResult] = await db
    .select({ total: count() })
    .from(proposals)
    .innerJoin(jobs, eq(proposals.jobId, jobs.id))
    .innerJoin(
      freelancer,
      eq(proposals.freelancerId, freelancer.id),
    )
    .innerJoin(client, eq(jobs.clientId, client.id))
    .where(whereCondition);

  const total = countResult.total;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const currentPage = Math.min(
    requestedPage,
    Math.max(totalPages, 1),
  );

  const offset = (currentPage - 1) * PAGE_SIZE;

  // Retrieve the current page of proposals.
  const proposalRecords = await db
    .select({
      id: proposals.id,
      jobId: jobs.id,
      jobTitle: jobs.title,
      jobStatus: jobs.status,

      freelancerId: freelancer.id,
      freelancerName: freelancer.name,
      freelancerEmail: freelancer.email,

      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,

      coverLetter: proposals.coverLetter,
      proposedPrice: proposals.proposedPrice,
      currency: proposals.currency,
      deliveryDays: proposals.deliveryDays,
      status: proposals.status,
      submittedAt: proposals.submittedAt,
      updatedAt: proposals.updatedAt,
    })
    .from(proposals)
    .innerJoin(jobs, eq(proposals.jobId, jobs.id))
    .innerJoin(
      freelancer,
      eq(proposals.freelancerId, freelancer.id),
    )
    .innerJoin(client, eq(jobs.clientId, client.id))
    .where(whereCondition)
    .orderBy(desc(proposals.submittedAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  // Preserve existing filters when navigating between pages.
  function getPageUrl(page: number) {
    const search = new URLSearchParams();

    if (query) search.set("q", query);
    if (status) search.set("status", status);

    search.set("page", String(page));

    return `/admin/proposals?${search.toString()}`;
  }

  return (
    <section>
      <header>
        <h1>Proposal Management</h1>
        <p>
          Monitor proposals and negotiation activity across the marketplace.
        </p>
        <p>Total matching proposals: {total}</p>
      </header>

      <form method="GET">
        <div>
          <label htmlFor="proposal-search">
            Search proposals
          </label>

          <input
            id="proposal-search"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Job, freelancer or client..."
            maxLength={100}
          />
        </div>

        <div>
          <label htmlFor="proposal-status">
            Proposal status
          </label>

          <select
            id="proposal-status"
            name="status"
            defaultValue={status ?? ""}
          >
            <option value="">All statuses</option>

            {proposalStatuses.map((proposalStatus) => (
              <option
                key={proposalStatus}
                value={proposalStatus}
              >
                {proposalStatus.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <button type="submit">Apply filters</button>

        <Link href="/admin/proposals">
          Clear filters
        </Link>
      </form>

      {proposalRecords.length === 0 ? (
        <p>No proposals found matching these filters.</p>
      ) : (
        <>
          <div>
            {proposalRecords.map((proposal) => (
              <article key={proposal.id}>
                <header>
                  <h2>
                    <Link href={`/admin/jobs/${proposal.jobId}`}>
                      {proposal.jobTitle}
                    </Link>
                  </h2>

                  <p>
                    Proposal status:{" "}
                    {proposal.status.replace("_", " ")}
                  </p>
                </header>

                <dl>
                  <dt>Proposal ID</dt>
                  <dd>{proposal.id}</dd>

                  <dt>Freelancer</dt>
                  <dd>
                    {proposal.freelancerName}
                    {" — "}
                    {proposal.freelancerEmail}
                  </dd>

                  <dt>Client</dt>
                  <dd>
                    {proposal.clientName}
                    {" — "}
                    {proposal.clientEmail}
                  </dd>

                  <dt>Proposed price</dt>
                  <dd>
                    {proposal.currency}{" "}
                    {Number(proposal.proposedPrice).toLocaleString()}
                  </dd>

                  <dt>Delivery timeframe</dt>
                  <dd>{proposal.deliveryDays} days</dd>

                  <dt>Job status</dt>
                  <dd>{proposal.jobStatus.replace("_", " ")}</dd>

                  <dt>Submitted</dt>
                  <dd>
                    {proposal.submittedAt.toLocaleString()}
                  </dd>

                  <dt>Last updated</dt>
                  <dd>
                    {proposal.updatedAt.toLocaleString()}
                  </dd>
                </dl>

                <details>
                  <summary>View cover letter</summary>
                  <p style={{ whiteSpace: "pre-wrap" }}>
                    {proposal.coverLetter}
                  </p>
                </details>
              </article>
            ))}
          </div>

          <nav aria-label="Proposal pagination">
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

export default function AdminProposalsPage({
  searchParams,
}: PageProps) {
  return (
    <Suspense fallback={<p>Loading proposals...</p>}>
      <AdminProposalsContent searchParams={searchParams} />
    </Suspense>
  );
}


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

import { db } from "@/lib/db";
import { jobs, user } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";

const PAGE_SIZE = 20;

const JOB_STATUSES = [
  "draft",
  "open",
  "closed",
  "cancelled",
] as const;

type JobStatus = (typeof JOB_STATUSES)[number];

type SearchParams = Promise<{
  q?: string;
  status?: string;
  page?: string;
}>;

// function AdminJobsContent({
//   searchParams,
// }: {
//   searchParams: SearchParams;
// }) {
//   return <></>;
// }

async function JobsList({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await connection();

  await requireAdmin();

  const params = await searchParams;

  const search = params.q?.trim().slice(0, 160) ?? "";

  const status = JOB_STATUSES.includes(
    params.status as JobStatus,
  )
    ? (params.status as JobStatus)
    : undefined;

  const requestedPage = Number(params.page ?? "1");

  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(jobs.title, `%${search}%`),
        ilike(jobs.description, `%${search}%`),
      ),
    );
  }

  if (status) {
    conditions.push(eq(jobs.status, status));
  }

  const where = and(...conditions);

  const [jobRows, totalResult] = await Promise.all([
    db
      .select({
        id: jobs.id,
        title: jobs.title,
        category: jobs.category,
        budget: jobs.budget,
        currency: jobs.currency,
        status: jobs.status,
        createdAt: jobs.createdAt,
        clientId: jobs.clientId,
        clientName: user.name,
        clientEmail: user.email,
      })
      .from(jobs)
      .innerJoin(user, eq(jobs.clientId, user.id))
      .where(where)
      .orderBy(desc(jobs.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),

    db
      .select({ total: count() })
      .from(jobs)
      .where(where),
  ]);

  const total = Number(totalResult[0]?.total ?? 0);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function pageHref(nextPage: number) {
    const query = new URLSearchParams();

    if (search) query.set("q", search);
    if (status) query.set("status", status);

    query.set("page", String(nextPage));

    return `/admin/jobs?${query.toString()}`;
  }

  return (
    <section>
      <header>
        <h1>Jobs</h1>
        <p>
          Review and monitor marketplace job listings.
        </p>
      </header>

      <form action="/admin/jobs" method="GET">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search job title or description..."
          maxLength={160}
        />

        <select name="status" defaultValue={status ?? ""}>
          <option value="">All statuses</option>

          {JOB_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item.replace("_", " ")}
            </option>
          ))}
        </select>

        <button type="submit">Filter jobs</button>

        <Link href="/admin/jobs">Clear filters</Link>
      </form>

      <p>
        {total} {total === 1 ? "job" : "jobs"} found
      </p>

      {jobRows.length === 0 ? (
        <p>No jobs match your filters.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Client</th>
              <th>Budget</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>

          <tbody>
            {jobRows.map((job) => (
              <tr key={job.id}>
                <td>
                  <Link href={`/admin/jobs/${job.id}`}>
                    {job.title}
                  </Link>
                  <p>{job.category}</p>
                </td>

                <td>
                  <p>{job.clientName}</p>
                  <p>{job.clientEmail}</p>
                </td>

                <td>
                  {job.currency}{" "}
                  {Number(job.budget).toLocaleString()}
                </td>

                <td>{job.status.replace("_", " ")}</td>

                <td>
                  {job.createdAt.toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalPages > 1 && (
        <nav aria-label="Job pagination">
          {page > 1 && (
            <Link href={pageHref(page - 1)}>
              Previous
            </Link>
          )}

          <span>
            {" "}Page {page} of {totalPages}{" "}
          </span>

          {page < totalPages && (
            <Link href={pageHref(page + 1)}>
              Next
            </Link>
          )}
        </nav>
      )}
    </section>
  );
}

export default function AdminJobsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<p>Loading jobs...</p>}>
      <JobsList searchParams={searchParams} />
    </Suspense>
  );
}

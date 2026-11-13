import { Suspense } from "react";
import { connection } from "next/server";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { notFound } from "next/navigation";
import Link from "next/link";

type JobDetailsPageProps = {
  params: Promise<{
    jobId: string;
  }>;
};

async function JobDetailsContent({ params }: JobDetailsPageProps) {
  await connection();

  const { jobId } = await params;

  // Validate the UUID before querying PostgreSQL.
  const isValidUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      jobId,
    );

  if (!isValidUUID) {
    notFound();
  }

  const now = new Date();

  const [job] = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      description: jobs.description,
      category: jobs.category,
      budget: jobs.budget,
      currency: jobs.currency,
      deliveryDays: jobs.deliveryDays,
      createdAt: jobs.createdAt,
      closingAt: jobs.closingAt,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.status, "open"),
        or(isNull(jobs.closingAt), gt(jobs.closingAt, now)),
      ),
    )
    .limit(1);

  // Do not expose drafts, closed jobs or expired jobs.
  if (!job) {
    notFound();
  }

  const formattedBudget = new Intl.NumberFormat("en", {
    style: "currency",
    currency: job.currency,
  }).format(Number(job.budget));

  return (
    <main>
      <Link href="/jobs">← Back to jobs</Link>

      <h1>{job.title}</h1>

      <p>{job.category}</p>

      <section>
        <h2>Project budget</h2>
        <p>{formattedBudget}</p>
      </section>

      <section>
        <h2>Project description</h2>
        <p>{job.description}</p>
      </section>

      <section>
        <h2>Delivery expectations</h2>
        <p>{job.deliveryDays} days</p>
      </section>

      <section>
        <h2>Posted</h2>
        <p>
          {new Intl.DateTimeFormat("en", {
            dateStyle: "medium",
          }).format(job.createdAt)}
        </p>
      </section>

      {job.closingAt && (
        <section>
          <h2>Application deadline</h2>
          <p>
            {new Intl.DateTimeFormat("en", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(job.closingAt)}
          </p>
        </section>
      )}

      <Link href={`/jobs/${job.id}/proposals/new`}>Submit a proposal</Link>
    </main>
  );
}

export default function JobDetailsPage({ params }: JobDetailsPageProps) {
  return (
    <Suspense fallback={<p>Loading job details...</p>}>
      <JobDetailsContent params={params} />
    </Suspense>
  );
}

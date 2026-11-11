import { Suspense } from "react";
import { connection } from "next/server";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import Link from "next/link";

import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";

async function PublicJobsContent() {
  // This page depends on live database data, not build-time data.
  await connection();

  const now = new Date();

  // Retrieve only published jobs whose proposal deadlines haven't passed.
  const availableJobs = await db
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
        eq(jobs.status, "open"),
        or(isNull(jobs.closingAt), gt(jobs.closingAt, now)),
      ),
    )
    .orderBy(desc(jobs.createdAt))
    .limit(50);

  return (
    <main>
      <h1>Find work</h1>
      <p>Explore opportunities from clients across Africa.</p>

      <p>
        {availableJobs.length} {availableJobs.length === 1 ? "job" : "jobs"}{" "}
        available
      </p>

      {availableJobs.length === 0 ? (
        <section>
          <h2>No jobs available yet</h2>
          <p>
            Check back later. New opportunities will appear here when clients
            publish them.
          </p>
        </section>
      ) : (
        <section aria-label="Available jobs">
          {availableJobs.map((job) => {
            const formattedBudget = new Intl.NumberFormat("en", {
              style: "currency",
              currency: job.currency,
            }).format(Number(job.budget));

            return (
              <article key={job.id}>
                <h2>
                  <Link href={`/jobs/${job.id}`}>{job.title}</Link>
                </h2>
                <p>{job.description}</p>

                <p>Category: {job.category}</p>

                <p>Budget: {formattedBudget}</p>

                <p>Expected delivery: {job.deliveryDays} days</p>

                <p>
                  Posted:{" "}
                  {job.createdAt.toLocaleDateString("en", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>

                {job.closingAt && (
                  <p>
                    Proposals close:{" "}
                    {job.closingAt.toLocaleDateString("en", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                )}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={<p>Loading available jobs...</p>}>
      <PublicJobsContent />
    </Suspense>
  );
}

import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { jobs, user } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";
import Link from "next/link";

import { contracts } from "@/lib/db/schema";
import { JobModerationControl } from "@/components/admin/job-moderation-control";

type PageProps = {
  params: Promise<{ jobId: string }>;
};

async function JobDetail({ params }: PageProps) {
  await connection();
  await requireAdmin();

  const { jobId } = await params;

  // Validate UUID before querying PostgreSQL.
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(jobId)) {
    notFound();
  }

  const [job] = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      description: jobs.description,
      category: jobs.category,
      budget: jobs.budget,
      currency: jobs.currency,
      deliveryDays: jobs.deliveryDays,
      status: jobs.status,
      closingAt: jobs.closingAt,
      createdAt: jobs.createdAt,
      updatedAt: jobs.updatedAt,

      clientId: user.id,
      clientName: user.name,
      clientEmail: user.email,
      clientJoinedAt: user.createdAt,
      emailVerified: user.emailVerified,
      clientRole: user.role,
      clientBanned: user.banned,
    })
    .from(jobs)
    .innerJoin(user, eq(jobs.clientId, user.id))
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (!job) {
    notFound();
  }

  const [existingContract] = await db
    .select({ id: contracts.id })
    .from(contracts)
    .where(eq(contracts.jobId, job.id))
    .limit(1);

  return (
    <section>
      <header>
        <div>
          <h1>{job.title}</h1>
          <p>Job ID: {job.id}</p>
        </div>

        <p>Status: {job.status.replace("_", " ")}</p>
      </header>

      <section>
        <h2>Job information</h2>

        <dl>
          <dt>Category</dt>
          <dd>{job.category}</dd>

          <dt>Budget</dt>
          <dd>
            {job.currency} {Number(job.budget).toLocaleString()}
          </dd>

          <dt>Expected delivery</dt>
          <dd>{job.deliveryDays} calendar days</dd>

          <dt>Proposal closing deadline</dt>
          <dd>
            {job.closingAt
              ? job.closingAt.toLocaleString()
              : "No deadline specified"}
          </dd>

          <dt>Created</dt>
          <dd>{job.createdAt.toLocaleString()}</dd>

          <dt>Last updated</dt>
          <dd>{job.updatedAt.toLocaleString()}</dd>
        </dl>
      </section>

      <section>
        <h2>Description</h2>
        <p style={{ whiteSpace: "pre-wrap" }}>{job.description}</p>
      </section>

      <section>
        <h2>Client information</h2>

        <dl>
          <dt>Name</dt>
          <dd>{job.clientName}</dd>

          <dt>Email</dt>
          <dd>{job.clientEmail}</dd>

          <dt>Email verified</dt>
          <dd>{job.emailVerified ? "Yes" : "No"}</dd>

          <dt>Account role</dt>
          <dd>{job.clientRole}</dd>

          <dt>Account status</dt>
          <dd>{job.clientBanned ? "Suspended" : "Active"}</dd>

          <dt>Joined</dt>
          <dd>{job.clientJoinedAt.toLocaleDateString()}</dd>
        </dl>
      </section>
      <JobModerationControl
        jobId={job.id}
        status={job.status}
        hasContract={Boolean(existingContract)}
      />
      <Link href="/admin/jobs">Back to jobs</Link>
    </section>
  );
}

export default function AdminJobDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={<p>Loading job details...</p>}>
      <JobDetail params={params} />
    </Suspense>
  );
}

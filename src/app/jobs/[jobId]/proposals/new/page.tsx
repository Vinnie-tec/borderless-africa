import { Suspense } from "react";
import { connection } from "next/server";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { requireFreelancer } from "@/lib/marketplace/authorization";
import ProposalForm from "./proposal-form";
import { notFound } from "next/navigation";

type NewProposalPageProps = {
  params: Promise<{
    jobId: string;
  }>;
};

async function NewProposalContent({
  params,
}: NewProposalPageProps) {
  await connection();

  // Require a verified freelancer.
  await requireFreelancer();

  const { jobId } = await params;

  const isValidUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      jobId
    );

  if (!isValidUUID) {
    notFound();
  }

  const now = new Date();

  const [job] = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      currency: jobs.currency,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.status, "open"),
        or(isNull(jobs.closingAt), gt(jobs.closingAt, now))
      )
    )
    .limit(1);

  if (!job) {
    notFound();
  }

  return (
    <main>
      <ProposalForm
        jobId={job.id}
        jobTitle={job.title}
        currency={job.currency}
      />
    </main>
  );
}

export default function NewProposalPage({
  params,
}: NewProposalPageProps) {
  return (
    <Suspense fallback={<p>Loading proposal form...</p>}>
      <NewProposalContent params={params} />
    </Suspense>
  );
}
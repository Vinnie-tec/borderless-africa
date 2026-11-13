import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";

import { requireClient } from "@/lib/marketplace/authorization";
import { db } from "@/lib/db";
import { jobs, proposals, user } from "@/lib/db/schema";

type ProposalInboxPageProps = {
  params: Promise<{
    jobId: string;
  }>;
};

async function ProposalInboxContent({
  params,
}: ProposalInboxPageProps) {
  await connection();

  const session = await requireClient();
  const { jobId } = await params;

  const isValidUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      jobId
    );

  if (!isValidUUID) {
    notFound();
  }

  // Only the owner of this job can access its proposal inbox.
  const [job] = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      status: jobs.status,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.clientId, session.user.id)
      )
    )
    .limit(1);

  if (!job) {
    notFound();
  }

  // Fetch proposals and the freelancer details.
  const incomingProposals = await db
    .select({
      id: proposals.id,
      coverLetter: proposals.coverLetter,
      proposedPrice: proposals.proposedPrice,
      currency: proposals.currency,
      deliveryDays: proposals.deliveryDays,
      status: proposals.status,
      submittedAt: proposals.submittedAt,
      freelancerName: user.name,
      freelancerEmail: user.email,
    })
    .from(proposals)
    .innerJoin(user, eq(proposals.freelancerId, user.id))
    .where(eq(proposals.jobId, job.id))
    .orderBy(desc(proposals.submittedAt));

  return (
    <main>
      <a href="/dashboard/jobs">← Back to my jobs</a>

      <h1>Proposals</h1>
      <h2>{job.title}</h2>

      <p>
        {incomingProposals.length} proposal
        {incomingProposals.length !== 1 ? "s" : ""} received
      </p>

      {incomingProposals.length === 0 ? (
        <p>No proposals have been submitted for this job yet.</p>
      ) : (
        <section>
          {incomingProposals.map((proposal) => {
            const formattedPrice = new Intl.NumberFormat("en", {
              style: "currency",
              currency: proposal.currency,
            }).format(Number(proposal.proposedPrice));

            return (
              <article key={proposal.id}>
                <h3>{proposal.freelancerName}</h3>

                <p>{proposal.freelancerEmail}</p>

                <p>
                  <strong>Proposed price:</strong> {formattedPrice}
                </p>

                <p>
                  <strong>Delivery:</strong>{" "}
                  {proposal.deliveryDays} days
                </p>

                <p>
                  <strong>Status:</strong> {proposal.status}
                </p>

                <h4>Cover letter</h4>
                <p>{proposal.coverLetter}</p>

                <p>
                  <small>
                    Submitted:{" "}
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(proposal.submittedAt)}
                  </small>
                </p>

                <hr />
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

export default function ProposalInboxPage({
  params,
}: ProposalInboxPageProps) {
  return (
    <Suspense fallback={<p>Loading proposals...</p>}>
      <ProposalInboxContent params={params} />
    </Suspense>
  );
}
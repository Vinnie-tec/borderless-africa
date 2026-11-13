import { Suspense } from "react";
import { connection } from "next/server";
import { asc, desc, eq, inArray } from "drizzle-orm";

import { requireFreelancer } from "@/lib/marketplace/authorization";
import { db } from "@/lib/db";
import {
  jobs,
  proposals,
  proposalOffers,
} from "@/lib/db/schema";

import OfferHistory from "@/components/proposals/offer-history";
import CounterofferForm from "@/components/proposals/counteroffer-form";
import Link from "next/link";

async function MyProposalsContent() {
  await connection();

  const session = await requireFreelancer();

  // Only retrieve proposals belonging to the signed-in freelancer.
  const myProposals = await db
    .select({
      id: proposals.id,
      jobId: proposals.jobId,
      freelancerId: proposals.freelancerId,
      coverLetter: proposals.coverLetter,
      proposedPrice: proposals.proposedPrice,
      currency: proposals.currency,
      deliveryDays: proposals.deliveryDays,
      status: proposals.status,
      submittedAt: proposals.submittedAt,

      clientId: jobs.clientId,
      jobTitle: jobs.title,
      jobStatus: jobs.status,
    })
    .from(proposals)
    .innerJoin(jobs, eq(proposals.jobId, jobs.id))
    .where(eq(proposals.freelancerId, session.user.id))
    .orderBy(desc(proposals.submittedAt));

  // Retrieve negotiation history for these proposals.
  const proposalIds = myProposals.map((proposal) => proposal.id);

  const allOffers =
    proposalIds.length > 0
      ? await db
          .select({
            id: proposalOffers.id,
            proposalId: proposalOffers.proposalId,
            offerNumber: proposalOffers.offerNumber,
            senderId: proposalOffers.senderId,
            proposedPrice: proposalOffers.proposedPrice,
            deliveryDays: proposalOffers.deliveryDays,
            message: proposalOffers.message,
            createdAt: proposalOffers.createdAt,
          })
          .from(proposalOffers)
          .where(inArray(proposalOffers.proposalId, proposalIds))
          .orderBy(asc(proposalOffers.offerNumber))
      : [];

  // Group offers by their proposal ID.
  const offersByProposal = new Map<
    string,
    (typeof allOffers)[number][]
  >();

  for (const offer of allOffers) {
    const existing = offersByProposal.get(offer.proposalId) ?? [];
    existing.push(offer);
    offersByProposal.set(offer.proposalId, existing);
  }

  if (myProposals.length === 0) {
    return (
      <section>
        <h1>My proposals</h1>
        <p>You haven&apos;t submitted any proposals yet.</p>
        <Link href="/jobs">Browse available jobs</Link>
      </section>
    );
  }

  return (
    <section>
      <h1>My proposals</h1>

      {myProposals.map((proposal) => {
        const offers = offersByProposal.get(proposal.id) ?? [];
        const latestOffer = offers[offers.length - 1];

        // Before any counteroffer, the original freelancer proposal
        // is treated as the latest offer.
        const lastSenderId =
          latestOffer?.senderId ?? proposal.freelancerId;

        const isFreelancersTurn =
          lastSenderId !== session.user.id;

        const canNegotiate =
          proposal.status === "pending" ||
          proposal.status === "negotiating";

        return (
          <article key={proposal.id}>
            <h2>
              <a href={`/jobs/${proposal.jobId}`}>
                {proposal.jobTitle}
              </a>
            </h2>

            <p>Status: {proposal.status}</p>
            <p>Job status: {proposal.jobStatus}</p>

            <p>
              Original proposed price:{" "}
              {new Intl.NumberFormat("en", {
                style: "currency",
                currency: proposal.currency,
              }).format(Number(proposal.proposedPrice))}
            </p>

            <p>Original delivery time: {proposal.deliveryDays} days</p>

            <p>{proposal.coverLetter}</p>

            <OfferHistory
              offers={offers}
              currentUserId={session.user.id}
              clientId={proposal.clientId}
              freelancerId={proposal.freelancerId}
              originalProposal={{
                proposedPrice: proposal.proposedPrice,
                currency: proposal.currency,
                deliveryDays: proposal.deliveryDays,
                submittedAt: proposal.submittedAt,
              }}
            />

            {canNegotiate && isFreelancersTurn && (
              <CounterofferForm
                proposalId={proposal.id}
                currentPrice={
                  latestOffer?.proposedPrice ?? proposal.proposedPrice
                }
                currentDeliveryDays={
                  latestOffer?.deliveryDays ?? proposal.deliveryDays
                }
              />
            )}

            {canNegotiate && !isFreelancersTurn && (
              <p>Waiting for the client to respond to your proposal.</p>
            )}
          </article>
        );
      })}
    </section>
  );
}

export default function MyProposalsPage() {
  return (
    <Suspense fallback={<p>Loading your proposals...</p>}>
      <MyProposalsContent />
    </Suspense>
  );
}
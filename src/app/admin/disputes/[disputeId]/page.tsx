import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { asc, eq } from "drizzle-orm";

import { DisputeOutcomeControls } from "@/components/admin/dispute-outcome-controls";

import { db } from "@/lib/db";
import {
  contracts,
  disputes,
  disputeMessages,
  disputeEvents,
  user,
} from "@/lib/db/schema";

import { requireAdmin } from "@/lib/auth-helpers";
import { DisputeReviewControls } from "@/components/admin/dispute-review-controls";

type Props = {
  params: Promise<{
    disputeId: string;
  }>;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminDisputeDetailsPage({ params }: Props) {
  await connection();
  await requireAdmin();

  const { disputeId } = await params;

  if (!UUID_REGEX.test(disputeId)) {
    notFound();
  }

  const [result] = await db
    .select({
      dispute: disputes,
      contract: contracts,
    })
    .from(disputes)
    .innerJoin(contracts, eq(disputes.contractId, contracts.id))
    .where(eq(disputes.id, disputeId))
    .limit(1);

  if (!result) {
    notFound();
  }

  const { dispute, contract } = result;

  const messages = await db
    .select({
      id: disputeMessages.id,
      message: disputeMessages.message,
      attachmentUrl: disputeMessages.attachmentUrl,
      createdAt: disputeMessages.createdAt,
      senderId: disputeMessages.senderId,
      senderName: user.name,
      senderEmail: user.email,
    })
    .from(disputeMessages)
    .innerJoin(user, eq(disputeMessages.senderId, user.id))
    .where(eq(disputeMessages.disputeId, dispute.id))
    .orderBy(asc(disputeMessages.createdAt));

  const events = await db
    .select({
      id: disputeEvents.id,
      action: disputeEvents.action,
      details: disputeEvents.details,
      createdAt: disputeEvents.createdAt,
      actorName: user.name,
      actorEmail: user.email,
    })
    .from(disputeEvents)
    .innerJoin(user, eq(disputeEvents.actorId, user.id))
    .where(eq(disputeEvents.disputeId, dispute.id))
    .orderBy(asc(disputeEvents.createdAt));

  return (
    <main>
      <header>
        <p>
          <Link href="/admin/disputes">Back to disputes</Link>
        </p>

        <h1>Dispute review</h1>

        <p>Status: {dispute.status.replace("_", " ")}</p>

        <p>Origin: {dispute.origin}</p>
        <p>Contract: {contract.title}</p>
        <p>Contract ID: {contract.id}</p>
      </header>

      <section>
        <h2>Dispute information</h2>

        <p>
          <strong>Opened by:</strong> {dispute.openedById}
        </p>

        <p>
          <strong>Client:</strong> {contract.clientId}
        </p>

        <p>
          <strong>Freelancer:</strong> {contract.freelancerId}
        </p>

        <p>
          <strong>Reason:</strong>
        </p>

        <p>{dispute.reason}</p>

        <p>
          <strong>Created:</strong> {dispute.createdAt.toLocaleString()}
        </p>
      </section>

      <section>
        <h2>Participant messages and evidence</h2>

        {messages.length === 0 ? (
          <p>No participant messages have been submitted.</p>
        ) : (
          messages.map((message) => (
            <article key={message.id}>
              <h3>{message.senderName}</h3>

              <p>{message.senderEmail}</p>
              <p>{message.message}</p>

              {message.attachmentUrl && (
                <p>
                  <a
                    href={message.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open evidence link
                  </a>
                </p>
              )}

              <small>{message.createdAt.toLocaleString()}</small>
            </article>
          ))
        )}
      </section>

      <DisputeReviewControls disputeId={dispute.id} status={dispute.status} />

      {dispute.status === "resolved" &&
        dispute.origin === "cancellation" &&
        contract.status === "disputed" && (
          <DisputeOutcomeControls disputeId={dispute.id} />
        )}

      {dispute.status === "resolved" && (
        <section>
          <h2>Final decision</h2>

          <p>
            <strong>Decision:</strong> {dispute.decision}
          </p>

          <p>
            <strong>Resolution:</strong> {dispute.resolution}
          </p>

          <p>
            <strong>Decided by:</strong> {dispute.decidedById}
          </p>

          {dispute.decidedAt && (
            <p>
              <strong>Decided at:</strong> {dispute.decidedAt.toLocaleString()}
            </p>
          )}
        </section>
      )}

      <section>
        <h2>Audit history</h2>

        {events.length === 0 ? (
          <p>No audit events recorded.</p>
        ) : (
          events.map((event) => (
            <article key={event.id}>
              <h3>{event.action.replaceAll("_", " ")}</h3>

              <p>{event.details}</p>

              <p>
                Actor: {event.actorName} ({event.actorEmail})
              </p>

              <small>{event.createdAt.toLocaleString()}</small>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

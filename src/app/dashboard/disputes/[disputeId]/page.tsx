
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  contracts,
  disputes,
  disputeMessages,
  user,
} from "@/lib/db/schema";

import { requireVerifiedUser } from "@/lib/auth-helpers";
import { DisputeMessageForm } from "@/components/contracts/dispute-message-form";

type Props = {
  params: Promise<{
    disputeId: string;
  }>;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DisputeDetailsPage({ params }: Props) {
  await connection();

  const session = await requireVerifiedUser();
  const { disputeId } = await params;

  if (!UUID_REGEX.test(disputeId)) {
    notFound();
  }

  // Load the dispute and its associated contract.
  const [result] = await db
    .select({
      dispute: disputes,
      contract: contracts,
    })
    .from(disputes)
    .innerJoin(
      contracts,
      eq(disputes.contractId, contracts.id)
    )
    .where(eq(disputes.id, disputeId))
    .limit(1);

  if (!result) {
    notFound();
  }

  const { dispute, contract } = result;

  // Only the contract participants may access this page.
  const isParticipant =
    contract.clientId === session.user.id ||
    contract.freelancerId === session.user.id;

  if (!isParticipant) {
    notFound();
  }

  // Load messages and sender information.
  const messages = await db
    .select({
      id: disputeMessages.id,
      message: disputeMessages.message,
      attachmentUrl: disputeMessages.attachmentUrl,
      createdAt: disputeMessages.createdAt,
      senderId: disputeMessages.senderId,
      senderName: user.name,
    })
    .from(disputeMessages)
    .innerJoin(
      user,
      eq(disputeMessages.senderId, user.id)
    )
    .where(eq(disputeMessages.disputeId, dispute.id))
    .orderBy(asc(disputeMessages.createdAt));

  const isResolved = dispute.status === "resolved";

  return (
    <main>
      <header>
        <h1>Dispute details</h1>

        <p>
          Status: {dispute.status.replace("_", " ")}
        </p>

        <p>
          Origin: {dispute.origin}
        </p>

        <p>
          Contract: {contract.title}
        </p>
      </header>

      <section>
        <h2>Reason for dispute</h2>
        <p>{dispute.reason}</p>
      </section>

      <section>
        <h2>Conversation and evidence</h2>

        {messages.length === 0 ? (
          <p>
            No messages have been submitted yet.
          </p>
        ) : (
          messages.map((item) => (
            <article key={item.id}>
              <p>
                <strong>
                  {item.senderId === session.user.id
                    ? "You"
                    : item.senderName}
                </strong>
              </p>

              <p>{item.message}</p>

              {item.attachmentUrl && (
                <p>
                  <a
                    href={item.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View submitted evidence
                  </a>
                </p>
              )}

              <small>
                {item.createdAt.toLocaleString()}
              </small>
            </article>
          ))
        )}
      </section>

      {isResolved ? (
        <section>
          <h2>Dispute resolved</h2>

          <p>
            Decision: {dispute.decision}
          </p>

          {dispute.resolution && (
            <p>{dispute.resolution}</p>
          )}
        </section>
      ) : (
        <DisputeMessageForm disputeId={dispute.id} />
      )}
    </main>
  );
}

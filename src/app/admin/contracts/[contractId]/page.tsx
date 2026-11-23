
import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/lib/db";
import {
  contracts,
  jobs,
  user,
  contractDeliveries,
  cancellationRequests,
  disputes,
} from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";

type PageProps = {
  params: Promise<{
    contractId: string;
  }>;
};

function formatDate(date: Date | null | undefined) {
  return date ? date.toLocaleString() : "—";
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

async function AdminContractDetailContent({ params }: PageProps) {
  await connection();
  await requireAdmin();

  const { contractId } = await params;

  // Validate the route parameter before querying PostgreSQL.
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(contractId)) {
    notFound();
  }

  const submittedBy = alias(user, "delivery_submitted_by");
  const requestedBy = alias(user, "cancellation_requested_by");
  const openedBy = alias(user, "dispute_opened_by");
  const decidedBy = alias(user, "dispute_decided_by");
  const client = alias(user, "admin_contract_client");
  const freelancer = alias(user, "admin_contract_freelancer");

  // Contract, original job and both participants.
  const [contract] = await db
    .select({
      id: contracts.id,
      title: contracts.title,
      scope: contracts.scope,
      agreedPrice: contracts.agreedPrice,
      currency: contracts.currency,
      deliveryDays: contracts.deliveryDays,
      revisionAllowance: contracts.revisionAllowance,
      revisionsUsed: contracts.revisionsUsed,
      status: contracts.status,
      createdAt: contracts.createdAt,
      updatedAt: contracts.updatedAt,

      jobId: jobs.id,
      jobTitle: jobs.title,
      jobStatus: jobs.status,

      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      clientBanned: client.banned,

      freelancerId: freelancer.id,
      freelancerName: freelancer.name,
      freelancerEmail: freelancer.email,
      freelancerBanned: freelancer.banned,
    })
    .from(contracts)
    .innerJoin(jobs, eq(contracts.jobId, jobs.id))
    .innerJoin(client, eq(contracts.clientId, client.id))
    .innerJoin(freelancer, eq(contracts.freelancerId, freelancer.id))
    .where(eq(contracts.id, contractId))
    .limit(1);

  if (!contract) {
    notFound();
  }

  // Delivery history.
  const deliveries = await db
    .select({
      id: contractDeliveries.id,
      submissionNumber: contractDeliveries.submissionNumber,
      message: contractDeliveries.message,
      attachmentUrl: contractDeliveries.attachmentUrl,
      status: contractDeliveries.status,
      submittedAt: contractDeliveries.submittedAt,
      reviewMessage: contractDeliveries.reviewMessage,
      reviewedAt: contractDeliveries.reviewedAt,

      submittedById: submittedBy.id,
      submittedByName: submittedBy.name,
      submittedByEmail: submittedBy.email,
    })
    .from(contractDeliveries)
    .innerJoin(
      submittedBy,
      eq(contractDeliveries.submittedById, submittedBy.id),
    )
    .where(eq(contractDeliveries.contractId, contractId))
    .orderBy(desc(contractDeliveries.submissionNumber));

  // Cancellation request history.
  const cancellationHistory = await db
    .select({
      id: cancellationRequests.id,
      reason: cancellationRequests.reason,
      previousContractStatus: cancellationRequests.previousContractStatus,
      status: cancellationRequests.status,
      responseMessage: cancellationRequests.responseMessage,
      responseDeadline: cancellationRequests.responseDeadline,
      respondedAt: cancellationRequests.respondedAt,
      createdAt: cancellationRequests.createdAt,

      requesterId: requestedBy.id,
      requesterName: requestedBy.name,
      requesterEmail: requestedBy.email,
    })
    .from(cancellationRequests)
    .innerJoin(
      requestedBy,
      eq(cancellationRequests.requesterId, requestedBy.id),
    )
    .where(eq(cancellationRequests.contractId, contractId))
    .orderBy(desc(cancellationRequests.createdAt));

  // Dispute history, including the admin's recorded decision.
  const disputeHistory = await db
    .select({
      id: disputes.id,
      cancellationRequestId: disputes.cancellationRequestId,
      origin: disputes.origin,
      reason: disputes.reason,
      status: disputes.status,
      decision: disputes.decision,
      resolution: disputes.resolution,
      createdAt: disputes.createdAt,
      updatedAt: disputes.updatedAt,
      decidedAt: disputes.decidedAt,

      openedById: openedBy.id,
      openedByName: openedBy.name,
      openedByEmail: openedBy.email,

      decidedById: decidedBy.id,
      decidedByName: decidedBy.name,
      decidedByEmail: decidedBy.email,
    })
    .from(disputes)
    .innerJoin(openedBy, eq(disputes.openedById, openedBy.id))
    .leftJoin(decidedBy, eq(disputes.decidedById, decidedBy.id))
    .where(eq(disputes.contractId, contractId))
    .orderBy(desc(disputes.createdAt));

  return (
    <section>
      <header>
        <p>
          <Link href="/admin/contracts">← Back to contracts</Link>
        </p>

        <h1>{contract.title}</h1>

        <p>
          Contract status: {formatStatus(contract.status)}
        </p>

        <p>Contract ID: {contract.id}</p>
      </header>

      <hr />

      <section>
        <h2>Contract information</h2>

        <dl>
          <dt>Agreed title</dt>
          <dd>{contract.title}</dd>

          <dt>Agreed scope</dt>
          <dd>{contract.scope}</dd>

          <dt>Agreed price</dt>
          <dd>
            {contract.currency}{" "}
            {Number(contract.agreedPrice).toLocaleString()}
          </dd>

          <dt>Delivery timeframe</dt>
          <dd>{contract.deliveryDays} days</dd>

          <dt>Revision allowance</dt>
          <dd>{contract.revisionAllowance}</dd>

          <dt>Revisions used</dt>
          <dd>{contract.revisionsUsed}</dd>

          <dt>Created</dt>
          <dd>{formatDate(contract.createdAt)}</dd>

          <dt>Last updated</dt>
          <dd>{formatDate(contract.updatedAt)}</dd>
        </dl>
      </section>

      <hr />

      <section>
        <h2>Original job</h2>

        <p>
          <Link href={`/admin/jobs/${contract.jobId}`}>
            {contract.jobTitle}
          </Link>
        </p>

        <p>Job status: {formatStatus(contract.jobStatus)}</p>
      </section>

      <hr />

      <section>
        <h2>Client</h2>

        <dl>
          <dt>Name</dt>
          <dd>{contract.clientName}</dd>

          <dt>Email</dt>
          <dd>{contract.clientEmail}</dd>

          <dt>Account ID</dt>
          <dd>{contract.clientId}</dd>

          <dt>Account status</dt>
          <dd>{contract.clientBanned ? "Suspended" : "Active"}</dd>
        </dl>
      </section>

      <hr />

      <section>
        <h2>Freelancer</h2>

        <dl>
          <dt>Name</dt>
          <dd>{contract.freelancerName}</dd>

          <dt>Email</dt>
          <dd>{contract.freelancerEmail}</dd>

          <dt>Account ID</dt>
          <dd>{contract.freelancerId}</dd>

          <dt>Account status</dt>
          <dd>{contract.freelancerBanned ? "Suspended" : "Active"}</dd>
        </dl>
      </section>

      <hr />

      <section>
        <h2>Delivery history ({deliveries.length})</h2>

        {deliveries.length === 0 ? (
          <p>No deliveries have been submitted.</p>
        ) : (
          deliveries.map((delivery) => (
            <article key={delivery.id}>
              <h3>Submission #{delivery.submissionNumber}</h3>

              <p>Status: {formatStatus(delivery.status)}</p>

              <p>
                Submitted by: {delivery.submittedByName} (
                {delivery.submittedByEmail})
              </p>

              <p>Submitted: {formatDate(delivery.submittedAt)}</p>

              <h4>Submission message</h4>
              <p>{delivery.message}</p>

              {delivery.attachmentUrl && (
                <p>
                  <a
                    href={delivery.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View submitted work
                  </a>
                </p>
              )}

              {delivery.reviewMessage && (
                <>
                  <h4>Client review feedback</h4>
                  <p>{delivery.reviewMessage}</p>
                  <p>Reviewed: {formatDate(delivery.reviewedAt)}</p>
                </>
              )}
            </article>
          ))
        )}
      </section>

      <hr />

      <section>
        <h2>Cancellation history ({cancellationHistory.length})</h2>

        {cancellationHistory.length === 0 ? (
          <p>No cancellation requests have been made.</p>
        ) : (
          cancellationHistory.map((request) => (
            <article key={request.id}>
              <h3>Cancellation request</h3>

              <p>Status: {formatStatus(request.status)}</p>

              <p>
                Requested by: {request.requesterName} (
                {request.requesterEmail})
              </p>

              <p>Created: {formatDate(request.createdAt)}</p>

              <p>
                Response deadline: {formatDate(request.responseDeadline)}
              </p>

              <p>
                Previous contract status:{" "}
                {formatStatus(request.previousContractStatus)}
              </p>

              <h4>Reason</h4>
              <p>{request.reason}</p>

              {request.responseMessage && (
                <>
                  <h4>Response</h4>
                  <p>{request.responseMessage}</p>
                  <p>Responded: {formatDate(request.respondedAt)}</p>
                </>
              )}
            </article>
          ))
        )}
      </section>

      <hr />

      <section>
        <h2>Dispute history ({disputeHistory.length})</h2>

        {disputeHistory.length === 0 ? (
          <p>No disputes have been opened for this contract.</p>
        ) : (
          disputeHistory.map((dispute) => (
            <article key={dispute.id}>
              <h3>Dispute</h3>

              <p>Status: {formatStatus(dispute.status)}</p>

              <p>Origin: {formatStatus(dispute.origin)}</p>

              <p>
                Opened by: {dispute.openedByName} (
                {dispute.openedByEmail})
              </p>

              <p>Created: {formatDate(dispute.createdAt)}</p>

              <h4>Dispute reason</h4>
              <p>{dispute.reason}</p>

              {dispute.cancellationRequestId && (
                <p>
                  Related cancellation request:{" "}
                  {dispute.cancellationRequestId}
                </p>
              )}

              {dispute.decision && (
                <>
                  <h4>Admin decision</h4>
                  <p>{dispute.decision}</p>
                </>
              )}

              {dispute.resolution && (
                <>
                  <h4>Resolution explanation</h4>
                  <p>{dispute.resolution}</p>
                </>
              )}

              {dispute.decidedByName && (
                <p>
                  Decided by: {dispute.decidedByName} (
                  {dispute.decidedByEmail})
                </p>
              )}

              <p>Decision date: {formatDate(dispute.decidedAt)}</p>

              <p>
                <Link href={`/admin/disputes/${dispute.id}`}>
                  Inspect dispute
                </Link>
              </p>
            </article>
          ))
        )}
      </section>
    </section>
  );
}

export default function AdminContractDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={<p>Loading contract details...</p>}>
      <AdminContractDetailContent params={params} />
    </Suspense>
  );
}

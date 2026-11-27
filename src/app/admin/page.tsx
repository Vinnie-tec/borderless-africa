
import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  user,
  userCapabilities,
  jobs,
  proposals,
  contracts,
  disputes,
} from "@/lib/db/schema";
import styles from "./admin-overview.module.scss";

export default function AdminPage() {
  return (
    <Suspense fallback={<p>Loading dashboard...</p>}>
      <AdminDashboard />
    </Suspense>
  );
}

async function AdminDashboard() {
  // Keep database queries out of the build-time prerender.
  await connection();

  const [
    userCount,
    capabilityCounts,
    jobCounts,
    proposalCounts,
    contractCounts,
    disputeCounts,
    recentDisputes,
  ] = await Promise.all([
    // Total registered accounts.
    db.select({ total: count() }).from(user),

    // Number of users with each marketplace capability.
    db
      .select({
        capability: userCapabilities.capability,
        total: count(),
      })
      .from(userCapabilities)
      .groupBy(userCapabilities.capability),

    // Jobs grouped by status.
    db
      .select({ status: jobs.status, total: count() })
      .from(jobs)
      .groupBy(jobs.status),

    // Proposals grouped by status.
    db
      .select({ status: proposals.status, total: count() })
      .from(proposals)
      .groupBy(proposals.status),

    // Contracts grouped by lifecycle status.
    db
      .select({ status: contracts.status, total: count() })
      .from(contracts)
      .groupBy(contracts.status),

    // Disputes grouped by status.
    db
      .select({ status: disputes.status, total: count() })
      .from(disputes)
      .groupBy(disputes.status),

    // Latest five disputes, including their contract title.
    db
      .select({
        id: disputes.id,
        status: disputes.status,
        origin: disputes.origin,
        reason: disputes.reason,
        createdAt: disputes.createdAt,
        contractTitle: contracts.title,
      })
      .from(disputes)
      .innerJoin(contracts, eq(disputes.contractId, contracts.id))
      .orderBy(desc(disputes.createdAt))
      .limit(5),
  ]);

  const formatLabel = (value: string) => value.replaceAll("_", " ");

  const renderCounts = (items: { status: string; total: number }[]) => (
    <ul>
      {items.map((item) => (
        <li key={item.status}>
          <span>{formatLabel(item.status)}: </span>
          <strong>{item.total}</strong>
        </li>
      ))}
    </ul>
  );

  const capabilityTotal = (capability: string) =>
    capabilityCounts.find((item) => item.capability === capability)
      ?.total ?? 0;

  const metricCards = [
    {
      title: "Users",
      mark: "US",
      content: (
        <>
          <p>
            Total registered users: <strong>{userCount[0].total}</strong>
          </p>
          <ul>
            <li>
              Clients <strong>{capabilityTotal("client")}</strong>
            </li>
            <li>
              Freelancers <strong>{capabilityTotal("freelancer")}</strong>
            </li>
          </ul>
          <Link href="/admin/users">Manage users</Link>
        </>
      ),
    },
    { title: "Jobs", mark: "JB", content: renderCounts(jobCounts) },
    { title: "Proposals", mark: "PR", content: renderCounts(proposalCounts) },
    { title: "Contracts", mark: "CT", content: renderCounts(contractCounts) },
    {
      title: "Disputes",
      mark: "DS",
      content: (
        <>
          {renderCounts(disputeCounts)}
          <Link href="/admin/disputes">Manage disputes</Link>
        </>
      ),
    },
  ];

  return (
    <div className={styles.overview}>
      <header className={styles.heading}>
        <span>Operations / Overview</span>
        <h1>Dashboard overview</h1>
        <p>Live statistics from the Borderless Africa marketplace.</p>
      </header>

      <div className={styles.metrics}>
        {metricCards.map((card) => (
          <section aria-label={card.title} className={styles.metric} key={card.title}>
            <div className={styles.metricHeading}>
              <h2>{card.title}</h2>
              <span aria-hidden="true" className={styles.metricMark}>
                {card.mark}
              </span>
            </div>
            {card.content}
          </section>
        ))}
      </div>

      <section aria-labelledby="recent-disputes-heading" className={styles.recent}>
        <h2 id="recent-disputes-heading">Recent disputes</h2>

        {recentDisputes.length === 0 ? (
          <p>No disputes have been reported yet.</p>
        ) : (
          <ul>
            {recentDisputes.map((dispute) => (
              <li key={dispute.id}>
                <Link href={`/admin/disputes/${dispute.id}`}>
                  {dispute.contractTitle}
                </Link>
                <p>Status: {formatLabel(dispute.status)}</p>
                <p>Origin: {formatLabel(dispute.origin)}</p>
                <p>Reason: {dispute.reason}</p>
                <p>
                  Reported: {dispute.createdAt.toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

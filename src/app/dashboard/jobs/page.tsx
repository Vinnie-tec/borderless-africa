import { Suspense } from "react";
import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { requireClient } from "@/lib/marketplace/authorization";
import MyJobsList from "./my-jobs-list";

async function MyJobsContent() {
  const session = await requireClient();

  // Only retrieve jobs belonging to the currently signed-in client.
  const clientJobs = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      budget: jobs.budget,
      currency: jobs.currency,
      status: jobs.status,
      deliveryDays: jobs.deliveryDays,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .where(eq(jobs.clientId, session.user.id))
    .orderBy(desc(jobs.createdAt));

  return <MyJobsList jobs={clientJobs} />;
}

export default function MyJobsPage() {
  return (
    <main>
      <h1>My Jobs</h1>
      <p>Manage the jobs you&apos;ve created.</p>

      <Suspense fallback={<p>Loading your jobs...</p>}>
        <MyJobsContent />
      </Suspense>
    </main>
  );
}
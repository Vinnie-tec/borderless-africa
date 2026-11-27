"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { publishJob } from "@/lib/marketplace/jobs/actions";
import { useToast } from "@/components/toast/toast-provider";
import Link from "next/link";

type Job = {
  id: string;
  title: string;
  budget: string;
  currency: string;
  status: "draft" | "open" | "closed" | "cancelled";
  deliveryDays: number;
  createdAt: Date;
};

export default function MyJobsList({ jobs }: { jobs: Job[] }) {
  const [isPending, startTransition] = useTransition();
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [optimisticallyPublished, setOptimisticallyPublished] = useState<
    Set<string>
  >(() => new Set());

  const router = useRouter();
  const toast = useToast();

  function handlePublish(jobId: string) {
    setPublishingId(jobId);
    setOptimisticallyPublished((current) => new Set(current).add(jobId));

    startTransition(async () => {
      try {
        const result = await publishJob(jobId);

        if (!result.success) {
          setOptimisticallyPublished((current) => {
            const next = new Set(current);
            next.delete(jobId);
            return next;
          });
          toast.error(result.message);
          return;
        }

        toast.success(result.message);

        // Reload the server-side job data.
        router.refresh();
      } catch {
        setOptimisticallyPublished((current) => {
          const next = new Set(current);
          next.delete(jobId);
          return next;
        });
        toast.error("Could not publish this job.", {
          description: "Please try again.",
        });
      } finally {
        setPublishingId(null);
      }
    });
  }

  if (jobs.length === 0) {
    return <p>You haven&apos;t created any jobs yet.</p>;
  }

  return (
    <section>
      {jobs.map((job) => (
        <article key={job.id}>
          <h2>{job.title}</h2>

          <p>
            Budget: {job.currency} {job.budget}
          </p>

          <p>Delivery: {job.deliveryDays} days</p>

          <p>
            Status:{" "}
            {optimisticallyPublished.has(job.id) ? "open" : job.status}
          </p>

          {job.status === "draft" && !optimisticallyPublished.has(job.id) && (
            <button
              type="button"
              disabled={isPending || publishingId !== null}
              onClick={() => handlePublish(job.id)}
            >
              {publishingId === job.id ? "Publishing..." : "Publish job"}
            </button>
          )}
          <Link href={`/dashboard/jobs/${job.id}/proposals`}>
            View proposals
          </Link>
          <Link href="/dashboard/contracts">My contracts</Link>
        </article>
      ))}
    </section>
  );
}

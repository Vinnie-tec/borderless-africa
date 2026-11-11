
"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createJob } from "@/lib/marketplace/jobs/actions";
import { useToast } from "@/components/toast/toast-provider";

export default function CreateJobForm() {
  const [isPending, startTransition] = useTransition();

  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const toast = useToast();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    // Convert FormData into a plain object for the Server Action.
    const jobData = {
      title: formData.get("title"),
      description: formData.get("description"),
      category: formData.get("category"),
      budget: formData.get("budget"),
      currency: formData.get("currency"),
      deliveryDays: formData.get("deliveryDays"),
      closingAt: formData.get("closingAt"),
    };

    startTransition(async () => {
      try {
        const result = await createJob(jobData);

        if (!result.success) {
          toast.error(result.message);
          return;
        }

        toast.success(result.message, {
          description: `Job ID: ${result.jobId}`,
        });

        formRef.current?.reset();

        // Refresh server-rendered data after successful creation.
        router.refresh();
      } catch {
        toast.error("Something went wrong.", {
          description: "Please try creating your job again.",
        });
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div>
        <label htmlFor="title">Job title</label>
        <input
          id="title"
          name="title"
          type="text"
          minLength={5}
          maxLength={160}
          placeholder="e.g. Build a responsive business website"
          required
        />
      </div>

      <div>
        <label htmlFor="description">Job description</label>
        <textarea
          id="description"
          name="description"
          minLength={30}
          maxLength={10000}
          rows={8}
          placeholder="Describe the work, requirements and expected outcome..."
          required
        />
      </div>

      <div>
        <label htmlFor="category">Category</label>
        <input
          id="category"
          name="category"
          type="text"
          maxLength={100}
          placeholder="e.g. Web Development"
          required
        />
      </div>

      <div>
        <label htmlFor="budget">Budget</label>
        <input
          id="budget"
          name="budget"
          type="number"
          min="0.01"
          max="9999999999.99"
          step="0.01"
          placeholder="50000"
          required
        />
      </div>

      <div>
        <label htmlFor="currency">Currency</label>
        <select id="currency" name="currency" defaultValue="NGN">
          <option value="NGN">NGN — Nigerian Naira</option>
          <option value="KES">KES — Kenyan Shilling</option>
          <option value="GHS">GHS — Ghanaian Cedi</option>
        </select>
      </div>

      <div>
        <label htmlFor="deliveryDays">Expected delivery (days)</label>
        <input
          id="deliveryDays"
          name="deliveryDays"
          type="number"
          min="1"
          max="3650"
          placeholder="14"
          required
        />
      </div>

      <div>
        <label htmlFor="closingAt">
          Proposal closing date (optional)
        </label>
        <input
          id="closingAt"
          name="closingAt"
          type="datetime-local"
        />
      </div>

      <button type="submit" disabled={isPending}>
        {isPending ? "Saving job..." : "Save as draft"}
      </button>
    </form>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createProposal } from "@/lib/marketplace/proposals/actions";
import { useToast } from "@/components/toast/toast-provider";

type ProposalFormProps = {
  jobId: string;
  jobTitle: string;
  currency: string;
};

export default function ProposalForm({
  jobId,
  jobTitle,
  currency,
}: ProposalFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const toast = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isSubmitting || submitted) return;

    setIsSubmitting(true);
    setError("");

    const formData = new FormData(event.currentTarget);

    try {
      const result = await createProposal({
        jobId,
        coverLetter: formData.get("coverLetter"),
        proposedPrice: formData.get("proposedPrice"),
        deliveryDays: formData.get("deliveryDays"),
      });

      if (!result.success) {
        setError(result.message);
        toast.error("Proposal not submitted", {
          description: result.message,
        });
        return;
      }

      setSubmitted(true);

      toast.success("Proposal submitted", {
        description: "Your proposal has been sent to the client.",
      });

      formRef.current?.reset();
    } catch {
      setError("Something went wrong. Please try again.");

      toast.error("Submission failed", {
        description: "Please try again in a moment.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section>
      <h1>Submit a proposal</h1>
      <p>Applying for: {jobTitle}</p>

      {submitted ? (
        <div>
          <h2>Proposal submitted successfully!</h2>
          <p>Your proposal has been sent to the client.</p>

          <button
            type="button"
            onClick={() => router.push(`/jobs/${jobId}`)}
          >
            Return to job
          </button>
        </div>
      ) : (
        <form ref={formRef} onSubmit={handleSubmit}>
          <div>
            <label htmlFor="coverLetter">Cover letter</label>

            <textarea
              id="coverLetter"
              name="coverLetter"
              required
              minLength={50}
              maxLength={5000}
              rows={8}
              placeholder="Explain why you're a good fit for this project..."
              disabled={isSubmitting}
            />

            <p>Minimum 50 characters. Maximum 5,000 characters.</p>
          </div>

          <div>
            <label htmlFor="proposedPrice">
              Your proposed price ({currency})
            </label>

            <input
              id="proposedPrice"
              name="proposedPrice"
              type="number"
              min="0.01"
              max="9999999999.99"
              step="0.01"
              required
              placeholder="Enter your price"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="deliveryDays">
              Estimated delivery time (days)
            </label>

            <input
              id="deliveryDays"
              name="deliveryDays"
              type="number"
              min="1"
              max="3650"
              step="1"
              required
              placeholder="e.g. 7"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <p role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || submitted}
          >
            {isSubmitting ? "Submitting proposal..." : "Submit proposal"}
          </button>
        </form>
      )}
    </section>
  );
}
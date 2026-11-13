
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/toast/toast-provider";
import { submitDelivery } from "@/lib/marketplace/contracts/delivery-actions";

type DeliveryFormProps = {
  contractId: string;
};

export default function DeliveryForm({
  contractId,
}: DeliveryFormProps) {
  const router = useRouter();
  const toast = useToast();

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    const input = {
      contractId,
      message: formData.get("message"),
      attachmentUrl: formData.get("attachmentUrl"),
    };

    setError("");
    setIsPending(true);

    try {
      const result = await submitDelivery(input);

      if (!result.success) {
        setError(result.message);
        toast.error("Delivery not submitted", {
          description: result.message,
        });
        return;
      }

      toast.success("Work submitted", {
        description: result.message,
      });

      form.reset();
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      toast.error("Submission failed", {
        description: "Please try again in a moment.",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section>
      <h2>Submit your work</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor={`delivery-message-${contractId}`}>
            Delivery message
          </label>

          <textarea
            id={`delivery-message-${contractId}`}
            name="message"
            minLength={20}
            maxLength={10000}
            rows={6}
            placeholder="Explain what you've completed and provide any relevant instructions..."
            required
            disabled={isPending}
          />
        </div>

        <div>
          <label htmlFor={`delivery-link-${contractId}`}>
            Delivery link (optional)
          </label>

          <input
            id={`delivery-link-${contractId}`}
            name="attachmentUrl"
            type="url"
            maxLength={2048}
            placeholder="https://..."
            disabled={isPending}
          />
        </div>

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={isPending}>
          {isPending ? "Submitting work..." : "Submit delivery"}
        </button>
      </form>
    </section>
  );
}

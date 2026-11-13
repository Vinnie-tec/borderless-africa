"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/toast/toast-provider";
import { createCounteroffer } from "@/lib/marketplace/proposals/negotiation-actions";

type CounterofferFormProps = {
  proposalId: string;
  currentPrice: string;
  currentDeliveryDays: number;
};

export default function CounterofferForm({
  proposalId,
  currentPrice,
  currentDeliveryDays,
}: CounterofferFormProps) {
  const router = useRouter();
  const toast = useToast();

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isPending) return;

    const formData = new FormData(event.currentTarget);

    const input = {
      proposalId,
      proposedPrice: formData.get("proposedPrice"),
      deliveryDays: formData.get("deliveryDays"),
      message: formData.get("message"),
    };

    setError("");

    startTransition(async () => {
      try {
        const result = await createCounteroffer(input);

        if (!result.success) {
          setError(result.message);

          toast.error("Counteroffer not sent", {
            description: result.message,
          });

          return;
        }

        toast.success("Counteroffer sent", {
          description: result.message,
        });

        router.refresh();
      } catch {
        setError("Something went wrong. Please try again.");

        toast.error("Counteroffer failed", {
          description: "Please try again in a moment.",
        });
      }
    });
  }

  return (
    <section>
      <h4>Make a counteroffer</h4>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor={`price-${proposalId}`}>
            Proposed price
          </label>

          <input
            id={`price-${proposalId}`}
            name="proposedPrice"
            type="number"
            min="0.01"
            max="9999999999.99"
            step="0.01"
            defaultValue={currentPrice}
            required
            disabled={isPending}
          />
        </div>

        <div>
          <label htmlFor={`delivery-${proposalId}`}>
            Delivery time (days)
          </label>

          <input
            id={`delivery-${proposalId}`}
            name="deliveryDays"
            type="number"
            min="1"
            max="3650"
            step="1"
            defaultValue={currentDeliveryDays}
            required
            disabled={isPending}
          />
        </div>

        <div>
          <label htmlFor={`message-${proposalId}`}>
            Message
          </label>

          <textarea
            id={`message-${proposalId}`}
            name="message"
            minLength={10}
            maxLength={2000}
            rows={4}
            placeholder="Explain your proposed changes..."
            required
            disabled={isPending}
          />
        </div>

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={isPending}>
          {isPending ? "Sending counteroffer..." : "Send counteroffer"}
        </button>
      </form>
    </section>
  );
}
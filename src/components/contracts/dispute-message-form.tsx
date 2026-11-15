
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { addDisputeMessage } from "@/lib/marketplace/contracts/dispute-actions";
import { useToast } from "@/components/toast/toast-provider";

type Props = {
  disputeId: string;
};

export function DisputeMessageForm({ disputeId }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [message, setMessage] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit() {
    setPending(true);

    try {
      const result = await addDisputeMessage({
        disputeId,
        message,
        attachmentUrl,
      });

      if (!result.success) {
        toast.error("Message not submitted", {
          description: result.message,
        });
        return;
      }

      toast.success("Message submitted");

      setMessage("");
      setAttachmentUrl("");
      router.refresh();
    } catch {
      toast.error("Something went wrong", {
        description: "Please try again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h3>Submit your explanation</h3>

      <label htmlFor="dispute-message">
        Your message
      </label>

      <textarea
        id="dispute-message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Explain your position and provide relevant details..."
        rows={6}
      />

      <label htmlFor="dispute-evidence">
        Evidence link (optional)
      </label>

      <input
        id="dispute-evidence"
        type="url"
        value={attachmentUrl}
        onChange={(event) => setAttachmentUrl(event.target.value)}
        placeholder="https://example.com/evidence"
      />

      <button
        type="button"
        onClick={handleSubmit}
        disabled={
          pending ||
          message.trim().length < 10 ||
          message.trim().length > 5000
        }
      >
        {pending ? "Submitting..." : "Submit message"}
      </button>
    </section>
  );
}

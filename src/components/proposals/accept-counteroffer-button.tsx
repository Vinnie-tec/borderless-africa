"use client";

import { useState } from "react";


import { useToast } from "@/components/toast/toast-provider";
import { acceptCounteroffer } from "@/lib/marketplace/proposals/negotiation-actions";

type AcceptCounterofferButtonProps = {
  proposalId: string;
};

export default function AcceptCounterofferButton({
  proposalId,
}: AcceptCounterofferButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const toast = useToast();

  async function handleAccept() {
    setIsPending(true);

    try {
      const result = await acceptCounteroffer(proposalId);

      if (!result.success) {
        toast.error("Could not accept counteroffer", {
          description: result.message,
        });
        return;
      }

      toast.success("Counteroffer accepted", {
        description: result.message,
      });

      // Refresh the server-rendered proposal and negotiation history.
      window.location.reload();
    } catch {
      toast.error("Something went wrong", {
        description: "Please try again.",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleAccept}
      disabled={isPending}
    >
      {isPending ? "Accepting..." : "Accept counteroffer"}
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/toast/toast-provider";
import { acceptProposal } from "@/lib/marketplace/contracts/actions";

type AcceptProposalButtonProps = {
  proposalId: string;
};

export default function AcceptProposalButton({
  proposalId,
}: AcceptProposalButtonProps) {
  const router = useRouter();
  const toast = useToast();

  const [isPending, setIsPending] = useState(false);

  async function handleAccept() {
    if (isPending) return;

    const confirmed = window.confirm(
      "Accept this proposal and create a contract? Other active proposals for this job will be rejected."
    );

    if (!confirmed) return;

    setIsPending(true);

    try {
      const result = await acceptProposal(proposalId);

      if (!result.success) {
        toast.error("Proposal not accepted", {
          description: result.message,
        });
        return;
      }

      toast.success("Proposal accepted", {
        description: "Your contract has been created and is awaiting payment.",
      });

      router.refresh();
    } catch {
      toast.error("Something went wrong", {
        description: "Please try again in a moment.",
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
      {isPending ? "Accepting proposal..." : "Accept proposal"}
    </button>
  );
}

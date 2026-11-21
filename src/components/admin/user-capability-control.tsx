
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { changeUserCapability } from "@/app/admin/users/capability-actions";
import { useToast } from "@/components/toast/toast-provider";

type Capability = "client" | "freelancer";

type Props = {
  userId: string;
  currentCapabilities: string[];
};

const capabilities: Capability[] = ["client", "freelancer"];

export function UserCapabilityControl({
  userId,
  currentCapabilities,
}: Props) {
  const [enabledCapabilities, setEnabledCapabilities] = useState<
    Capability[]
  >(
    capabilities.filter((capability) =>
      currentCapabilities.includes(capability),
    ),
  );

  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleChange(capability: Capability, enabled: boolean) {
    startTransition(async () => {
      try {
        const result = await changeUserCapability({
          userId,
          capability,
          enabled,
        });

        if (!result.success) {
          toast.error("Capability update failed", {
            description: result.message,
          });
          return;
        }

        setEnabledCapabilities((previous) =>
          enabled
            ? [...previous, capability]
            : previous.filter((item) => item !== capability),
        );

        toast.success("Capabilities updated", {
          description: result.message,
        });

        router.refresh();
      } catch {
        toast.error("Capability update failed", {
          description: "Something went wrong. Please try again.",
        });
      }
    });
  }

  return (
    <fieldset disabled={isPending}>
      <legend>Marketplace access</legend>

      {capabilities.map((capability) => (
        <label key={capability}>
          <input
            type="checkbox"
            checked={enabledCapabilities.includes(capability)}
            onChange={(event) =>
              handleChange(capability, event.target.checked)
            }
          />
          {capability === "client" ? "Client" : "Freelancer"}
        </label>
      ))}

      {isPending && <span> Updating...</span>}
    </fieldset>
  );
}

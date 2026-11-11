"use client";

import { useState, useTransition } from "react";

import { activateMarketplaceCapability } from "@/lib/marketplace/actions";
import type { MarketplaceCapability } from "@/lib/marketplace/capabilities";
import { useToast } from "@/components/toast/toast-provider";

type MarketplaceSetupProps = {
  initialCapabilities: MarketplaceCapability[];
};

export default function MarketplaceSetup({
  initialCapabilities,
}: MarketplaceSetupProps) {
  const [capabilities, setCapabilities] = useState(initialCapabilities);

  const [isPending, startTransition] = useTransition();
  const [activating, setActivating] = useState<MarketplaceCapability | null>(
    null,
  );
  const toast = useToast();

  function handleActivate(capability: MarketplaceCapability) {
    setActivating(capability);

    startTransition(async () => {
      try {
        const result = await activateMarketplaceCapability(capability);

        if (!result.success) {
          toast.error(result.message);
          return;
        }

        setCapabilities((current) =>
          current.includes(capability) ? current : [...current, capability],
        );

        toast.success(result.message);
      } catch {
        toast.error("Could not activate this capability.", {
          description: "Please try again.",
        });
      } finally {
        setActivating(null);
      }
    });
  }

  const options: MarketplaceCapability[] = ["client", "freelancer"];

  return (
    <section>
      <h2>Marketplace capabilities</h2>
      <p>
        Choose how you want to use Borderless Africa. You can activate both
        options.
      </p>

      {options.map((capability) => {
        const isActive = capabilities.includes(capability);

        return (
          <div key={capability}>
            <h3>
              {capability === "client"
                ? "Hire freelancers"
                : "Work as a freelancer"}
            </h3>

            <p>
              {capability === "client"
                ? "Post jobs and hire professionals."
                : "Submit proposals and work with clients."}
            </p>

            {isActive ? (
              <p>Active</p>
            ) : (
              <button
                type="button"
                disabled={activating !== null}
                onClick={() => handleActivate(capability)}
              >
                {activating === capability ? "Activating..." : "Activate"}
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}

"use client";

import { useState, useTransition } from "react";

import { activateMarketplaceCapability } from "@/lib/marketplace/actions";
import type { MarketplaceCapability } from "@/lib/marketplace/capabilities";
import { useToast } from "@/components/toast/toast-provider";
import styles from "./marketplace-setup.module.scss";

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
    const previousCapabilities = capabilities;
    setCapabilities((current) =>
      current.includes(capability) ? current : [...current, capability],
    );

    startTransition(async () => {
      try {
        const result = await activateMarketplaceCapability(capability);

        if (!result.success) {
          setCapabilities(previousCapabilities);
          toast.error(result.message);
          return;
        }

        toast.success(result.message);
      } catch {
        setCapabilities(previousCapabilities);
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
    <section className={styles.section}>
      <div className={styles.heading}>
        <h2>Choose your path</h2>
        <p>
          Set up how you want to take part. You can activate both at any time.
        </p>
      </div>

      <div className={styles.options}>
        {options.map((capability) => {
          const isActive = capabilities.includes(capability);

          return (
            <article className={styles.option} key={capability}>
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
                <span className={styles.active}>Active</span>
              ) : (
                <button
                  type="button"
                  disabled={activating !== null || isPending}
                  onClick={() => handleActivate(capability)}
                >
                  {activating === capability ? "Activating..." : "Activate"}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}


"use server";

import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { requireClient } from "@/lib/marketplace/authorization";

const supportedCurrencies = ["NGN", "KES", "GHS"] as const;

type CreateJobResult =
  | {
      success: true;
      message: string;
      jobId: string;
    }
  | {
      success: false;
      message: string;
    };

// Validate untrusted input before inserting anything into PostgreSQL.
function validateJobInput(input: unknown) {
  if (!input || typeof input !== "object") {
    return { success: false as const, message: "Invalid job details." };
  }

  const data = input as Record<string, unknown>;

  const title =
    typeof data.title === "string" ? data.title.trim() : "";

  const description =
    typeof data.description === "string"
      ? data.description.trim()
      : "";

  const category =
    typeof data.category === "string" ? data.category.trim() : "";

  const budget = Number(data.budget);

  const currency = data.currency;

  const deliveryDays = Number(data.deliveryDays);

  // Validate the title.
  if (title.length < 5 || title.length > 160) {
    return {
      success: false as const,
      message: "Title must be between 5 and 160 characters.",
    };
  }

  // Validate the job description.
  if (description.length < 30 || description.length > 10000) {
    return {
      success: false as const,
      message: "Description must be between 30 and 10,000 characters.",
    };
  }

  // Validate the category.
  if (category.length < 2 || category.length > 100) {
    return {
      success: false as const,
      message: "Please provide a valid job category.",
    };
  }

  // Validate the budget.
  if (
    !Number.isFinite(budget) ||
    budget <= 0 ||
    budget > 9999999999.99 ||
    !/^\d+(\.\d{1,2})?$/.test(String(data.budget).trim())
  ) {
    return {
      success: false as const,
      message: "Enter a valid budget with no more than two decimal places.",
    };
  }

  // Only accept currencies supported by our initial target markets.
  if (
    typeof currency !== "string" ||
    !supportedCurrencies.includes(
      currency as (typeof supportedCurrencies)[number]
    )
  ) {
    return {
      success: false as const,
      message: "Unsupported currency.",
    };
  }

  // Delivery time must be a positive whole number.
  if (
    !Number.isInteger(deliveryDays) ||
    deliveryDays < 1 ||
    deliveryDays > 3650
  ) {
    return {
      success: false as const,
      message: "Delivery time must be between 1 and 3650 days.",
    };
  }

  // Closing date is optional, but if supplied it must be in the future.
  let closingAt: Date | null = null;

  if (data.closingAt !== undefined && data.closingAt !== null && data.closingAt !== "") {
    if (typeof data.closingAt !== "string") {
      return {
        success: false as const,
        message: "Invalid proposal closing date.",
      };
    }

    closingAt = new Date(data.closingAt);

    if (
      Number.isNaN(closingAt.getTime()) ||
      closingAt.getTime() <= Date.now()
    ) {
      return {
        success: false as const,
        message: "The proposal closing date must be in the future.",
      };
    }
  }

  return {
    success: true as const,
    data: {
      title,
      description,
      category,
      budget: budget.toFixed(2),
      currency,
      deliveryDays,
      closingAt,
    },
  };
}

// Create a draft job for the currently authenticated client.
export async function createJob(
  input: unknown
): Promise<CreateJobResult> {
  // Never accept the client ID from the browser.
  // Derive ownership from the verified server-side session.
  const session = await requireClient();

  const validation = validateJobInput(input);

  if (!validation.success) {
    return validation;
  }

  try {
    const [job] = await db
      .insert(jobs)
      .values({
        ...validation.data,
        clientId: session.user.id,

        // Status is intentionally omitted.
        // PostgreSQL applies the default: draft.
      })
      .returning({
        id: jobs.id,
      });

    return {
      success: true,
      message: "Your job has been saved as a draft.",
      jobId: job.id,
    };
  } catch {
    return {
      success: false,
      message: "Could not create your job. Please try again.",
    };
  }
}

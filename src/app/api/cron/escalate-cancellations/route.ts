
import { timingSafeEqual } from "node:crypto";

import { escalateExpiredCancellations } from "@/lib/marketplace/contracts/escalation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is not configured.");

    return Response.json(
      { error: "Cron endpoint is not configured." },
      { status: 500 },
    );
  }

  const providedToken = Buffer.from(
    request.headers.get("authorization") ?? "",
  );
  const expectedToken = Buffer.from(`Bearer ${cronSecret}`);

  // Compare tokens safely, including their lengths.
  const authorized =
    providedToken.length === expectedToken.length &&
    timingSafeEqual(providedToken, expectedToken);

  if (!authorized) {
    return Response.json(
      { error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const result = await escalateExpiredCancellations();

    return Response.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Cancellation escalation failed:", error);

    return Response.json(
      { error: "Cancellation escalation failed." },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { refreshAllExpiringTokens } from "@/lib/shopee-token";

/**
 * Cron job endpoint to refresh expiring tokens
 * GET /api/shopee/refresh-tokens
 * 
 * Set up a cron job (e.g., Vercel Cron or GitHub Actions) to call this endpoint:
 * - Schedule: Every 12 hours
 * - URL: https://yourdomain.com/api/shopee/refresh-tokens
 * - Authorization: Bearer token (set CRON_SECRET in .env)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Cron] Starting token refresh job...");
    const results = await refreshAllExpiringTokens();
    console.log("[Cron] Token refresh completed:", results);

    return NextResponse.json({
      success: true,
      message: "Token refresh completed",
      results,
    });
  } catch (error) {
    console.error("[Cron] Token refresh failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Token refresh failed",
      },
      { status: 500 }
    );
  }
}

/**
 * app/api/admin/charts/route.ts
 *
 * GET /api/admin/charts
 *
 * Returns chart-ready data for the admin analytics page.
 * Supports ?days=30 or ?startDate=2026-01-01 for dynamic range.
 *
 * Returns:
 *   - revenueOverTime: daily revenue array sorted by date
 *   - bookingsPerDay: daily booking count array sorted by date
 *   - servicePopularity: service name + count array sorted desc
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getPopularServices, AnalyticsFilter } from "@/lib/analytics";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["pending", "confirmed", "reschedule_requested"];

export async function GET(req: NextRequest) {
  // ── Auth guard ─────────────────────────────────────────────
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const daysParam = searchParams.get("days");
  const startDate = searchParams.get("startDate");

  const filter: AnalyticsFilter = {
    days: daysParam ? parseInt(daysParam, 10) : (startDate ? undefined : 30),
    startDate: startDate || undefined,
  };

  // Calculate cutoff
  let cutoff: string;
  if (filter.startDate) {
    cutoff = filter.startDate;
  } else {
    const d = new Date();
    d.setDate(d.getDate() - (filter.days ?? 30));
    cutoff = d.toISOString().split("T")[0];
  }

  try {
    // Fetch bookings with service_price for revenue + booking count charts
    const [bookingsRes, popularServices] = await Promise.all([
      supabaseAdmin
        .from("bookings")
        .select("date, service_price")
        .in("status", ACTIVE_STATUSES)
        .gte("date", cutoff)
        .order("date", { ascending: true }),
      getPopularServices(filter),
    ]);

    if (bookingsRes.error) throw bookingsRes.error;

    // Aggregate revenue and booking counts per day
    const dailyRevenue: Record<string, number> = {};
    const dailyBookings: Record<string, number> = {};

    for (const b of bookingsRes.data) {
      dailyRevenue[b.date] = (dailyRevenue[b.date] || 0) + (b.service_price || 0);
      dailyBookings[b.date] = (dailyBookings[b.date] || 0) + 1;
    }

    // Convert to sorted arrays for Recharts
    const revenueOverTime = Object.entries(dailyRevenue)
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const bookingsPerDay = Object.entries(dailyBookings)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      data: {
        revenueOverTime,
        bookingsPerDay,
        servicePopularity: popularServices,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/admin/charts] Error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

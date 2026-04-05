/**
 * app/api/admin/dashboard/route.ts
 *
 * GET /api/admin/dashboard
 *
 * Aggregates key business metrics for the Admin Dashboard Summary Cards.
 * Returns:
 *   - bookingsToday: number of bookings scheduled for today
 *   - revenueToday: total revenue from today's bookings
 *   - revenueThisMonth: total revenue for the current month
 *   - activeBookings: total non-cancelled bookings (all time)
 *   - cancelledBookings: total cancelled bookings (all time)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getDailyRevenue, getMonthlyRevenue } from "@/lib/revenue";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // ── Auth guard ─────────────────────────────────────────────
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0]; // "YYYY-MM-DD"
    const monthStr = todayStr.slice(0, 7);             // "YYYY-MM"

    // Run all queries concurrently for maximum performance
    const [
      revenueToday,
      revenueThisMonth,
      bookingsTodayRes,
      activeRes,
      cancelledRes,
    ] = await Promise.all([
      getDailyRevenue(todayStr),
      getMonthlyRevenue(monthStr),

      // Count bookings scheduled for today (non-cancelled)
      supabaseAdmin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("date", todayStr)
        .neq("status", "cancelled"),

      // Count all active bookings (non-cancelled, all time)
      supabaseAdmin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .neq("status", "cancelled"),

      // Count all cancelled bookings (all time)
      supabaseAdmin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", "cancelled"),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        bookingsToday: bookingsTodayRes.count ?? 0,
        revenueToday,
        revenueThisMonth,
        activeBookings: activeRes.count ?? 0,
        cancelledBookings: cancelledRes.count ?? 0,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/admin/dashboard] Error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

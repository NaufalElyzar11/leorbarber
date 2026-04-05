/**
 * app/api/debug/analytics/route.ts
 *
 * Exposes the internal analytics logic so we can verify the computations
 * are working correctly with existing Supabase data.
 *
 * WARNING: Remove before putting the application into production!
 */

import { NextResponse } from "next/server";
import {
  getBookingStats,
  getPopularServices,
  getPeakHours,
  getRepeatCustomers,
  getCustomerStats,
} from "@/lib/analytics";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const daysString = searchParams.get("days");
  const startDate = searchParams.get("startDate");

  const filter = {
    days: daysString ? parseInt(daysString, 10) : (startDate ? undefined : 30),
    startDate: startDate || undefined,
  };

  try {
    const [stats, popular, peak, customers, customersFull] = await Promise.all([
      getBookingStats(filter),
      getPopularServices(filter),
      getPeakHours(filter),
      getRepeatCustomers(filter),
      getCustomerStats(filter),
    ]);

    return NextResponse.json({
      success: true,
      timeframe: filter.startDate ? `Since ${filter.startDate}` : `Last ${filter.days} days`,
      data: {
        stats,
        popular,
        peak,
        customers,
        customerAnalytics: customersFull,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

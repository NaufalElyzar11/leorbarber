/**
 * lib/analytics.ts
 *
 * Backend business intelligence and analytics module.
 * Groups and aggregates booking data computationally to bypass
 * the need for complex SQL RPCs inside Supabase.
 */

import { supabaseAdmin } from "@/lib/supabaseClient";

const ACTIVE_STATUSES = ["pending", "confirmed", "reschedule_requested"];

export interface BookingStats {
  total: number;
  daily: Record<string, number>;
  monthly: Record<string, number>;
}

export interface PopularService {
  name: string;
  count: number;
}

export interface PeakHour {
  time: string;
  count: number;
}

export interface CustomerStats {
  totalUniqueCustomers: number;
  repeatCustomers: number;
  repeatPercentage: string;
}

export interface AnalyticsFilter {
  days?: number;         // e.g. 30, 90, 365
  startDate?: string;    // e.g. "2026-01-01" for YTD
}

/**
 * Helper to compute the ISO string cutoff date based on filter
 */
function getDateCutoff(filter?: AnalyticsFilter): string {
  if (filter?.startDate) {
    return filter.startDate;
  }
  
  const d = new Date();
  d.setDate(d.getDate() - (filter?.days ?? 30));
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * 1. getBookingStats
 * Calculates total bookings per day and month over the dynamic window.
 */
export async function getBookingStats(filter?: AnalyticsFilter): Promise<BookingStats> {
  const cutoff = getDateCutoff(filter);

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("date")
    .in("status", ACTIVE_STATUSES)
    .gte("date", cutoff);

  if (error) {
    console.error("[getBookingStats] Error:", error.message);
    return { total: 0, daily: {}, monthly: {} };
  }

  const result: BookingStats = {
    total: data.length,
    daily: {},
    monthly: {},
  };

  data.forEach((b) => {
    // Daily accumulation
    result.daily[b.date] = (result.daily[b.date] || 0) + 1;

    // Monthly accumulation (YYYY-MM)
    const month = b.date.slice(0, 7);
    result.monthly[month] = (result.monthly[month] || 0) + 1;
  });

  return result;
}

/**
 * 2. getPopularServices
 * Ranks services by total bookings over the given window.
 */
export async function getPopularServices(filter?: AnalyticsFilter): Promise<PopularService[]> {
  const cutoff = getDateCutoff(filter);

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("services(name)")
    .in("status", ACTIVE_STATUSES)
    .gte("date", cutoff);

  if (error) {
    console.error("[getPopularServices] Error:", error.message);
    return [];
  }

  const counts: Record<string, number> = {};

  data.forEach((b: any) => {
    const sName = Array.isArray(b.services)
      ? b.services[0]?.name
      : b.services?.name;
    const name = sName || "Unknown Service";
    counts[name] = (counts[name] || 0) + 1;
  });

  // Convert to array and sort descending
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 3. getPeakHours
 * Ranks hours of the day by total bookings over the given window.
 */
export async function getPeakHours(filter?: AnalyticsFilter): Promise<PeakHour[]> {
  const cutoff = getDateCutoff(filter);

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("time")
    .in("status", ACTIVE_STATUSES)
    .gte("date", cutoff);

  if (error) {
    console.error("[getPeakHours] Error:", error.message);
    return [];
  }

  const counts: Record<string, number> = {};

  data.forEach((b) => {
    const hourStr = b.time.slice(0, 5); // "HH:MM"
    counts[hourStr] = (counts[hourStr] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([time, count]) => ({ time, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 4. getCustomerStats
 *
 * Comprehensive customer analytics:
 *   - Total unique customers
 *   - Repeat vs one-time customer counts
 *   - Average booking frequency
 *   - Top loyal customers (sorted by booking count)
 *   - Loyalty tier breakdown
 */

export interface CustomerProfile {
  email: string;
  name: string;
  bookingCount: number;
  totalSpent: number;
  loyaltyTier: "new" | "returning" | "regular" | "vip";
}

export interface FullCustomerStats {
  totalUniqueCustomers: number;
  repeatCustomers: number;
  repeatPercentage: string;
  averageBookingsPerCustomer: string;
  loyaltyBreakdown: {
    new: number;        // 1 booking
    returning: number;  // 2 bookings
    regular: number;    // 3-5 bookings
    vip: number;        // 6+ bookings
  };
  topCustomers: CustomerProfile[];
}

function getLoyaltyTier(count: number): CustomerProfile["loyaltyTier"] {
  if (count >= 6) return "vip";
  if (count >= 3) return "regular";
  if (count >= 2) return "returning";
  return "new";
}

export async function getCustomerStats(filter?: AnalyticsFilter): Promise<FullCustomerStats> {
  const cutoff = getDateCutoff(filter);

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("email, name, service_price")
    .in("status", ACTIVE_STATUSES)
    .gte("date", cutoff);

  if (error) {
    console.error("[getCustomerStats] Error:", error.message);
    return {
      totalUniqueCustomers: 0,
      repeatCustomers: 0,
      repeatPercentage: "0%",
      averageBookingsPerCustomer: "0",
      loyaltyBreakdown: { new: 0, returning: 0, regular: 0, vip: 0 },
      topCustomers: [],
    };
  }

  // Aggregate per customer (by email)
  const customers: Record<string, { name: string; count: number; spent: number }> = {};

  for (const b of data) {
    const email = b.email.toLowerCase();
    if (!customers[email]) {
      customers[email] = { name: b.name, count: 0, spent: 0 };
    }
    customers[email].count += 1;
    customers[email].spent += (b.service_price || 0);
  }

  // Build profiles and tally loyalty tiers
  const breakdown = { new: 0, returning: 0, regular: 0, vip: 0 };
  const profiles: CustomerProfile[] = [];
  let repeatCount = 0;

  for (const [email, info] of Object.entries(customers)) {
    const tier = getLoyaltyTier(info.count);
    breakdown[tier]++;
    if (info.count > 1) repeatCount++;

    profiles.push({
      email,
      name: info.name,
      bookingCount: info.count,
      totalSpent: info.spent,
      loyaltyTier: tier,
    });
  }

  // Sort by booking count descending, take top 10
  profiles.sort((a, b) => b.bookingCount - a.bookingCount);
  const topCustomers = profiles.slice(0, 10);

  const uniqueCount = profiles.length;
  const totalBookings = data.length;
  const avgBookings = uniqueCount === 0 ? 0 : totalBookings / uniqueCount;
  const rawPercent = uniqueCount === 0 ? 0 : (repeatCount / uniqueCount) * 100;

  return {
    totalUniqueCustomers: uniqueCount,
    repeatCustomers: repeatCount,
    repeatPercentage: `${Math.round(rawPercent)}%`,
    averageBookingsPerCustomer: avgBookings.toFixed(1),
    loyaltyBreakdown: breakdown,
    topCustomers,
  };
}

/**
 * Backward-compatible wrapper (used by dashboard + debug API).
 */
export async function getRepeatCustomers(filter?: AnalyticsFilter): Promise<CustomerStats> {
  const full = await getCustomerStats(filter);
  return {
    totalUniqueCustomers: full.totalUniqueCustomers,
    repeatCustomers: full.repeatCustomers,
    repeatPercentage: full.repeatPercentage,
  };
}


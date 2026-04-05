/**
 * lib/schedule.ts
 *
 * Backend utility for the Admin Schedule Management System.
 * Constructs a comprehensive view of a barber's day.
 */

import { supabaseAdmin } from "@/lib/supabaseClient";

export interface ScheduleSlot {
  time: string; // "10:00"
  status: "available" | "booked" | "blocked" | "past";
  booking?: {
    id: string;
    customer_name: string;
    service_name: string;
    status: string;
  };
  block?: {
    id: string;
    reason: string | null;
  };
}

export interface GetBarberScheduleResult {
  slots: ScheduleSlot[];
  isWholeDayBlocked: boolean;
  blockId?: string;
  blockReason?: string | null;
  error?: string;
}

const SLOT_START_HOUR = 10;
const SLOT_END_HOUR = 22;

/**
 * Returns a 10:00 to 22:00 timeline detailing every slot's exact state.
 */
export async function getBarberSchedule(
  barberId: string,
  date: string
): Promise<GetBarberScheduleResult> {
  const [bookingsRes, blocksRes] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select("id, name, status, time, services(name)")
      .eq("barber_id", barberId)
      .eq("date", date)
      .neq("status", "cancelled"),
    supabaseAdmin
      .from("schedule_blocks")
      .select("id, time, reason")
      .eq("barber_id", barberId)
      .eq("date", date),
  ]);

  if (bookingsRes.error || blocksRes.error) {
    return {
      slots: [],
      isWholeDayBlocked: false,
      error: `Database fetch failed: ${bookingsRes.error?.message || blocksRes.error?.message}`,
    };
  }

  // Check for whole-day block
  const wholeDayBlock = blocksRes.data?.find((b) => b.time === null);
  const isWholeDayBlocked = !!wholeDayBlock;

  // Map bookings to time keys
  const bookingsMap: Record<string, any> = {};
  for (const b of bookingsRes.data || []) {
    const timeKey = b.time.slice(0, 5); // "HH:MM"
    bookingsMap[timeKey] = b;
  }

  // Map individual blocks to time keys
  const blocksMap: Record<string, any> = {};
  for (const bl of blocksRes.data || []) {
    if (bl.time !== null) {
      blocksMap[bl.time.slice(0, 5)] = bl;
    }
  }

  // Build the time grid
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const isToday = date === todayStr;
  const currentHour = now.getHours();

  const slots: ScheduleSlot[] = [];

  for (let hour = SLOT_START_HOUR; hour < SLOT_END_HOUR; hour++) {
    const timeStr = `${String(hour).padStart(2, "0")}:00`;
    let status: ScheduleSlot["status"] = "available";
    let bookingPayload;
    let blockPayload;

    const isPast = isToday && hour <= currentHour;
    
    // Evaluate status priority: 
    // 1. Blocked (by whole day or individual slot)
    // 2. Booked
    // 3. Past
    // 4. Available

    if (isWholeDayBlocked || blocksMap[timeStr]) {
      status = "blocked";
      const actualBlock = isWholeDayBlocked ? wholeDayBlock : blocksMap[timeStr];
      blockPayload = {
        id: actualBlock.id,
        reason: actualBlock.reason,
      };
    } else if (bookingsMap[timeStr]) {
      status = "booked";
      const b = bookingsMap[timeStr];
      // Array mapping safety for Supabase relationships
      const svcName = Array.isArray(b.services) ? b.services[0]?.name : b.services?.name;
      bookingPayload = {
        id: b.id,
        customer_name: b.name,
        service_name: svcName || "Unknown Service",
        status: b.status,
      };
    } else if (isPast) {
      status = "past";
    }

    slots.push({
      time: timeStr,
      status,
      booking: bookingPayload,
      block: blockPayload,
    });
  }

  return {
    slots,
    isWholeDayBlocked,
    blockId: wholeDayBlock?.id,
    blockReason: wholeDayBlock?.reason,
  };
}

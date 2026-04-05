/**
 * lib/timeSlot.ts
 *
 * Time slot generator for the Barbershop Booking System.
 *
 * Rules (from context.md):
 *   - Available hours: 10:00 – 22:00
 *   - Interval: 1 hour (12 possible slots: 10:00 … 21:00)
 *   - A slot is unavailable if a non-cancelled booking already occupies it
 *   - Supports querying per barber
 *
 * Server-side only — uses supabaseAdmin.
 */

import { supabaseAdmin } from "@/lib/supabaseClient";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const SLOT_START_HOUR = 10; // 10:00
const SLOT_END_HOUR = 22;   // last slot begins at 21:00 (1-hour duration)
const SLOT_INTERVAL_HOURS = 1;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface TimeSlot {
  time: string;        // "HH:MM" format, e.g. "10:00"
  available: boolean;
}

export interface GetAvailableSlotsResult {
  slots: TimeSlot[];
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Generates the full list of possible time slots regardless of availability.
 * Returns strings in "HH:MM" format.
 */
function generateAllSlots(): string[] {
  const slots: string[] = [];
  for (let hour = SLOT_START_HOUR; hour < SLOT_END_HOUR; hour += SLOT_INTERVAL_HOURS) {
    slots.push(`${String(hour).padStart(2, "0")}:00`);
  }
  return slots; // ["10:00", "11:00", ..., "21:00"]
}

/**
 * Normalises a DB time value to "HH:MM".
 * Supabase returns TIME columns as "HH:MM:SS" — we strip the seconds.
 */
function normaliseTime(raw: string): string {
  return raw.slice(0, 5); // "14:00:00" → "14:00"
}

// ─────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────

/**
 * Returns all 12 possible time slots for a given barber and date,
 * annotated with their availability status.
 *
 * A slot is marked unavailable when a booking with status ≠ 'cancelled'
 * already exists for that barber + date + time.
 *
 * Also excludes slots that have already passed today (real-time cutoff).
 *
 * @param date      ISO date string "YYYY-MM-DD"
 * @param barberId  UUID of the barber
 *
 * @example
 * const { slots, error } = await getAvailableSlots("2026-04-01", "barber-uuid");
 * // slots: [{ time: "10:00", available: true }, { time: "11:00", available: false }, ...]
 */
export async function getAvailableSlots(
  date: string,
  barberId: string
): Promise<GetAvailableSlotsResult> {
  // 1. Fetch all booked (non-cancelled) times for this barber on this date
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("time")
    .eq("barber_id", barberId)
    .eq("date", date)
    .neq("status", "cancelled");

  // 1b. Fetch all scheduled blocks for this barber on this date
  const { data: blocksData, error: blocksError } = await supabaseAdmin
    .from("schedule_blocks")
    .select("time")
    .eq("barber_id", barberId)
    .eq("date", date);

  if (error || blocksError) {
    return {
      slots: [],
      error: `Failed to fetch slots: ${error?.message || blocksError?.message}`,
    };
  }

  // Check for whole-day block
  const isWholeDayBlocked = blocksData?.some(b => b.time === null) ?? false;
  if (isWholeDayBlocked) {
    return { slots: generateAllSlots().map(time => ({ time, available: false })) };
  }

  // 2. Build Sets of occupied times for O(1) lookup
  const bookedTimes = new Set((data ?? []).map(row => normaliseTime(row.time)));
  const blockedTimes = new Set((blocksData ?? []).filter(row => row.time !== null).map(row => normaliseTime(row.time)));

  // 3. Determine past-time cutoff (only relevant when date === today)
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const isToday = date === todayStr;
  const currentHour = now.getHours();

  // 4. Annotate each slot
  const slots: TimeSlot[] = generateAllSlots().map((time) => {
    const slotHour = parseInt(time.slice(0, 2), 10);

    const isPast = isToday && slotHour <= currentHour;
    const isBooked = bookedTimes.has(time);
    const isBlocked = blockedTimes.has(time);

    return {
      time,
      available: !isPast && !isBooked && !isBlocked,
    };
  });

  return { slots };
}

/**
 * Convenience helper — returns only the available slot times as strings.
 * Useful when rendering a simple dropdown or list of selectable options.
 *
 * @param date      ISO date string "YYYY-MM-DD"
 * @param barberId  UUID of the barber
 *
 * @example
 * const { times } = await getAvailableSlotTimes("2026-04-01", "barber-uuid");
 * // times: ["10:00", "13:00", "15:00"]
 */
export async function getAvailableSlotTimes(
  date: string,
  barberId: string
): Promise<{ times: string[]; error?: string }> {
  const { slots, error } = await getAvailableSlots(date, barberId);
  if (error) return { times: [], error };
  return { times: slots.filter((s) => s.available).map((s) => s.time) };
}

/**
 * Fetches availability for multiple barbers on the same date in one round-trip.
 * Returns a map of barberId → TimeSlot[].
 *
 * @param date       ISO date string "YYYY-MM-DD"
 * @param barberIds  Array of barber UUIDs
 *
 * @example
 * const { slotsMap } = await getSlotsByBarbers("2026-04-01", [id1, id2]);
 * // slotsMap["barber-uuid-1"] = [{ time: "10:00", available: true }, ...]
 */
export async function getSlotsByBarbers(
  date: string,
  barberIds: string[]
): Promise<{ slotsMap: Record<string, TimeSlot[]>; error?: string }> {
  if (barberIds.length === 0) return { slotsMap: {} };

  // Single query for all barbers
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("barber_id, time")
    .in("barber_id", barberIds)
    .eq("date", date)
    .neq("status", "cancelled");

  // 1b. Fetch blocks for all barbers
  const { data: blocksData, error: blocksError } = await supabaseAdmin
    .from("schedule_blocks")
    .select("barber_id, time")
    .in("barber_id", barberIds)
    .eq("date", date);

  if (error || blocksError) {
    return {
      slotsMap: {},
      error: `Failed to fetch slots: ${error?.message || blocksError?.message}`,
    };
  }

  // Build maps: barberId → Set of booked/blocked times
  const bookedMap: Record<string, Set<string>> = {};
  const blockedMap: Record<string, Set<string>> = {};
  const wholeDayBlocks = new Set<string>();

  for (const row of data ?? []) {
    if (!bookedMap[row.barber_id]) bookedMap[row.barber_id] = new Set();
    bookedMap[row.barber_id].add(normaliseTime(row.time));
  }

  for (const row of blocksData ?? []) {
    if (row.time === null) {
      wholeDayBlocks.add(row.barber_id);
    } else {
      if (!blockedMap[row.barber_id]) blockedMap[row.barber_id] = new Set();
      blockedMap[row.barber_id].add(normaliseTime(row.time));
    }
  }

  // Past-time cutoff
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const isToday = date === todayStr;
  const currentHour = now.getHours();

  const allPossibleSlots = generateAllSlots();

  // Annotate per barber
  const slotsMap: Record<string, TimeSlot[]> = {};
  for (const barberId of barberIds) {
    const booked = bookedMap[barberId] ?? new Set<string>();
    const blocked = blockedMap[barberId] ?? new Set<string>();
    const isWholeDayBlocked = wholeDayBlocks.has(barberId);

    slotsMap[barberId] = allPossibleSlots.map((time) => {
      const slotHour = parseInt(time.slice(0, 2), 10);
      const isPast = isToday && slotHour <= currentHour;
      return {
        time,
        available: !isWholeDayBlocked && !isPast && !booked.has(time) && !blocked.has(time),
      };
    });
  }

  return { slotsMap };
}

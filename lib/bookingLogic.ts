/**
 * lib/bookingLogic.ts
 *
 * Core booking logic for the Barbershop Booking System.
 * All database operations use supabaseAdmin (service role) so they
 * are safe to call only from server-side code (API routes / Server Actions).
 *
 * Exported functions:
 *   - validateBookingInput    → validates raw form input
 *   - checkSlotAvailability   → checks if a barber slot is free
 *   - createBooking           → inserts a new booking + secure tokens
 *   - requestReschedule       → marks booking as reschedule_requested
 *   - cancelBooking           → marks booking as cancelled
 */

import { supabaseAdmin } from "@/lib/supabaseClient";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "reschedule_requested";

export type TokenType = "cancel" | "reschedule";

export interface BookingInput {
  name: string;
  email: string;
  phone: string;
  service_id: string;
  barber_id: string;
  date: string; // ISO date string: "YYYY-MM-DD"
  time: string; // Time string: "HH:MM" or "HH:MM:SS"
}

export interface Booking {
  id: string;
  name: string;
  email: string;
  phone: string;
  service_id: string;
  barber_id: string;
  date: string;
  time: string;
  service_price: number;
  status: BookingStatus;
  reschedule_requested: boolean;
  new_date: string | null;
  new_time: string | null;
  created_at: string;
}

export interface BookingToken {
  id: string;
  booking_id: string;
  token: string;
  type: TokenType;
  expires_at: string;
}

export interface BookingResult {
  success: boolean;
  data?: Booking;
  error?: string;
}

export interface AvailabilityResult {
  available: boolean;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Booking hours window per context.md: 10:00–22:00 */
const BOOKING_START_HOUR = 10;
const BOOKING_END_HOUR = 22; // last slot starts at 21:00 (duration = 1h)

/** Token validity window */
const TOKEN_EXPIRY_DAYS = 7;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Generate a cryptographically secure random token */
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Returns expiry timestamp N days from now */
function expiresAt(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Validates "YYYY-MM-DD" date format */
function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
}

/** Validates "HH:MM" or "HH:MM:SS" time format */
function isValidTime(time: string): boolean {
  return /^\d{2}:\d{2}(:\d{2})?$/.test(time);
}

/** Extracts hour from "HH:MM" or "HH:MM:SS" */
function getHour(time: string): number {
  return parseInt(time.split(":")[0], 10);
}

// ─────────────────────────────────────────────────────────────
// 1. validateBookingInput
// ─────────────────────────────────────────────────────────────

/**
 * Validates raw booking form input.
 * Returns null if valid, or an error message string if invalid.
 *
 * @example
 * const error = validateBookingInput(input);
 * if (error) return res.status(400).json({ error });
 */
export function validateBookingInput(input: BookingInput): string | null {
  const { name, email, phone, service_id, barber_id, date, time } = input;

  if (!name?.trim()) return "Name is required.";
  if (name.trim().length < 2) return "Name must be at least 2 characters.";

  if (!email?.trim()) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return "Invalid email address.";

  if (!phone?.trim()) return "Phone number is required.";
  if (!/^\+?[\d\s\-()]{7,15}$/.test(phone)) return "Invalid phone number.";

  if (!service_id?.trim()) return "Service is required.";
  if (!barber_id?.trim()) return "Barber is required.";

  if (!date) return "Date is required.";
  if (!isValidDate(date)) return "Invalid date format. Use YYYY-MM-DD.";

  const selectedDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (selectedDate < today) return "Cannot book a date in the past.";

  if (!time) return "Time is required.";
  if (!isValidTime(time)) return "Invalid time format. Use HH:MM.";

  const hour = getHour(time);
  if (hour < BOOKING_START_HOUR || hour >= BOOKING_END_HOUR) {
    return `Booking time must be between ${BOOKING_START_HOUR}:00 and ${BOOKING_END_HOUR}:00.`;
  }

  return null; // valid
}

// ─────────────────────────────────────────────────────────────
// 2. checkSlotAvailability
// ─────────────────────────────────────────────────────────────

/**
 * Checks whether a barber's time slot is still available.
 * A slot is unavailable if a non-cancelled booking already exists
 * for the same barber + date + time.
 *
 * @example
 * const { available } = await checkSlotAvailability(barber_id, date, time);
 * if (!available) return res.status(409).json({ error: "Slot already booked." });
 */
export async function checkSlotAvailability(
  barber_id: string,
  date: string,
  time: string
): Promise<AvailabilityResult> {
  try {
    // Normalize time to "HH:MM:SS" to match PostgreSQL TIME column format.
    // Frontend sends "HH:MM" but the DB stores and returns "HH:MM:SS".
    const normalizedTime = time.length === 5 ? `${time}:00` : time;

    // 1. Check if an active booking exists
    const { data: bookingData, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("barber_id", barber_id)
      .eq("date", date)
      .eq("time", normalizedTime)
      .neq("status", "cancelled")
      .maybeSingle();

    if (bookingError) throw bookingError;
    if (bookingData) return { available: false, error: "Slot already booked." };

    // 2. Check if admin has explicitly blocked this slot or the whole day
    const { data: blockData, error: blockError } = await supabaseAdmin
      .from("schedule_blocks")
      .select("id")
      .eq("barber_id", barber_id)
      .eq("date", date)
      .or(`time.is.null,time.eq.${normalizedTime}`)
      .limit(1);

    if (blockError) throw blockError;
    if (blockData && blockData.length > 0) {
      return { available: false, error: "This slot has been blocked by the admin." };
    }

    return { available: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { available: false, error: `Availability check failed: ${message}` };
  }
}

// ─────────────────────────────────────────────────────────────
// 3. createBooking
// ─────────────────────────────────────────────────────────────

/**
 * Inserts a new booking into the database.
 * Validates input → checks slot availability → inserts booking → creates tokens.
 *
 * Returns the created Booking and the generated cancel/reschedule tokens
 * so the caller can embed them in emails.
 *
 * @example
 * const result = await createBooking(input);
 * if (!result.success) return res.status(400).json({ error: result.error });
 */
export async function createBooking(input: BookingInput): Promise<
  BookingResult & {
    tokens?: { cancel: string; reschedule: string };
  }
> {
  // 1. Validate input
  const validationError = validateBookingInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // 2. Check slot availability
  const { available, error: availError } = await checkSlotAvailability(
    input.barber_id,
    input.date,
    input.time
  );
  if (availError) return { success: false, error: availError };
  if (!available) {
    return {
      success: false,
      error: "This time slot is already booked. Please choose another.",
    };
  }

  // Fetch service price
  const { data: service, error: serviceError } = await supabaseAdmin
    .from("services")
    .select("price")
    .eq("id", input.service_id)
    .single();

  if (serviceError || !service) {
    return { success: false, error: "Invalid service selected." };
  }

  // 3. Insert booking
  const { data: booking, error: insertError } = await supabaseAdmin
    .from("bookings")
    .insert({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      service_id: input.service_id,
      barber_id: input.barber_id,
      date: input.date,
      time: input.time,
      service_price: service.price,
      status: "pending" as BookingStatus,
    })
    .select()
    .single();

  if (insertError) {
    // Handle unique constraint violation (race condition)
    if (insertError.code === "23505") {
      return {
        success: false,
        error: "This time slot was just booked. Please choose another.",
      };
    }
    return { success: false, error: insertError.message };
  }

  // 4. Generate cancel and reschedule tokens
  const cancelToken = generateToken();
  const rescheduleToken = generateToken();
  const expiry = expiresAt(TOKEN_EXPIRY_DAYS);

  const { error: tokenError } = await supabaseAdmin
    .from("booking_tokens")
    .insert([
      {
        booking_id: booking.id,
        token: cancelToken,
        type: "cancel",
        expires_at: expiry,
      },
      {
        booking_id: booking.id,
        token: rescheduleToken,
        type: "reschedule",
        expires_at: expiry,
      },
    ]);

  if (tokenError) {
    // Booking was created; log token failure but don't block confirmation
    console.error("[createBooking] Token generation failed:", tokenError.message);
  }

  return {
    success: true,
    data: booking as Booking,
    tokens: {
      cancel: cancelToken,
      reschedule: rescheduleToken,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// 4. requestReschedule
// ─────────────────────────────────────────────────────────────

/**
 * Marks a booking as reschedule_requested with the proposed new date/time.
 * Does NOT overwrite the original date/time — the original remains intact
 * until the admin approves the reschedule.
 *
 * @param bookingId   UUID of the booking to reschedule
 * @param token       The reschedule token from the email link
 * @param newDate     Proposed new date (YYYY-MM-DD)
 * @param newTime     Proposed new time (HH:MM)
 *
 * @example
 * const result = await requestReschedule(id, token, "2026-04-10", "14:00");
 */
export async function requestReschedule(
  bookingId: string,
  token: string,
  newDate: string,
  newTime: string
): Promise<BookingResult> {
  // 1. Validate the token
  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from("booking_tokens")
    .select("*, bookings(*)")
    .eq("token", token)
    .eq("type", "reschedule")
    .eq("booking_id", bookingId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (tokenError) return { success: false, error: tokenError.message };
  if (!tokenRow) {
    return { success: false, error: "Invalid or expired reschedule link." };
  }

  // 2. Validate new date/time
  if (!isValidDate(newDate)) {
    return { success: false, error: "Invalid new date format." };
  }
  if (!isValidTime(newTime)) {
    return { success: false, error: "Invalid new time format." };
  }
  const hour = getHour(newTime);
  if (hour < BOOKING_START_HOUR || hour >= BOOKING_END_HOUR) {
    return {
      success: false,
      error: `New time must be between ${BOOKING_START_HOUR}:00 and ${BOOKING_END_HOUR}:00.`,
    };
  }

  // 3. Ensure the requested slot is available (for the same barber)
  const booking = tokenRow.bookings as Booking;
  const { available, error: availError } = await checkSlotAvailability(
    booking.barber_id,
    newDate,
    newTime
  );
  if (availError) return { success: false, error: availError };
  if (!available) {
    return {
      success: false,
      error: "The requested new slot is already booked. Please choose another.",
    };
  }

  // 4. Update booking — do NOT touch original date/time
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "reschedule_requested" as BookingStatus,
      reschedule_requested: true,
      new_date: newDate,
      new_time: newTime,
    })
    .eq("id", bookingId)
    .select()
    .single();

  if (updateError) return { success: false, error: updateError.message };

  return { success: true, data: updated as Booking };
}

// ─────────────────────────────────────────────────────────────
// 5. cancelBooking
// ─────────────────────────────────────────────────────────────

/**
 * Cancels a booking by setting its status to "cancelled".
 * Validates the cancel token before processing.
 *
 * @param bookingId   UUID of the booking to cancel
 * @param token       The cancel token from the email link
 *
 * @example
 * const result = await cancelBooking(id, token);
 * if (!result.success) return res.status(400).json({ error: result.error });
 */
export async function cancelBooking(
  bookingId: string,
  token: string
): Promise<BookingResult> {
  // 1. Validate the token
  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from("booking_tokens")
    .select("id, expires_at, booking_id")
    .eq("token", token)
    .eq("type", "cancel")
    .eq("booking_id", bookingId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (tokenError) return { success: false, error: tokenError.message };
  if (!tokenRow) {
    return { success: false, error: "Invalid or expired cancellation link." };
  }

  // 2. Fetch current booking to guard against double-cancel
  const { data: current, error: fetchError } = await supabaseAdmin
    .from("bookings")
    .select("id, status")
    .eq("id", bookingId)
    .single();

  if (fetchError) return { success: false, error: fetchError.message };
  if (current.status === "cancelled") {
    return { success: false, error: "This booking is already cancelled." };
  }

  // 3. Cancel the booking
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({ status: "cancelled" as BookingStatus })
    .eq("id", bookingId)
    .select()
    .single();

  if (updateError) return { success: false, error: updateError.message };

  // 4. Invalidate used token immediately
  await supabaseAdmin
    .from("booking_tokens")
    .delete()
    .eq("id", tokenRow.id);

  return { success: true, data: updated as Booking };
}

/**
 * app/api/reschedule/route.ts
 *
 * POST /api/reschedule
 *
 * Handles a customer's reschedule request via a secure email token.
 * The original booking date/time is NEVER overwritten here.
 * Admin must approve via PATCH /api/bookings/:id to finalise.
 *
 * Flow:
 *   1. Parse + validate request body (id, token, new_date, new_time)
 *   2. Validate reschedule token (type, expiry)
 *   3. Fetch booking — guard already-cancelled / already-pending-reschedule
 *   4. Validate new_date + new_time (format + business hours)
 *   5. Check new slot availability for same barber
 *   6. Update: status = "reschedule_requested", new_date, new_time
 *   7. Notify admin (fire-and-forget)
 */

import { NextRequest, NextResponse } from "next/server";
import { validateToken, revokeToken } from "@/lib/token";
import { checkSlotAvailability } from "@/lib/bookingLogic";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sendAdminRescheduleNotification, BookingEmailData } from "@/lib/email";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const SLOT_START_HOUR = 10;
const SLOT_END_HOUR   = 22; // last slot at 21:00

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function ok<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data }, { status: 200 });
}

function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
}

function isValidTime(time: string): boolean {
  return /^\d{2}:\d{2}(:\d{2})?$/.test(time);
}

function getHour(time: string): number {
  return parseInt(time.slice(0, 2), 10);
}

// ─────────────────────────────────────────────────────────────
// POST /api/reschedule
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Parse body
  let body: { id?: string; token?: string; new_date?: string; new_time?: string };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const { id: bookingId, token, new_date, new_time } = body;

  if (!bookingId?.trim()) return fail("Booking ID is required.");
  if (!token?.trim())     return fail("Token is required.");
  if (!new_date?.trim())  return fail("new_date is required (YYYY-MM-DD).");
  if (!new_time?.trim())  return fail("new_time is required (HH:MM).");

  // 2. Validate token — must be type "reschedule", must not be expired
  const { success: tokenValid, error: tokenError, tokenRow } = await validateToken(
    token,
    "reschedule"
  );

  if (!tokenValid || !tokenRow) {
    return fail(tokenError ?? "Invalid or expired reschedule link.", 401);
  }

  // Ensure token belongs to the claimed booking (prevents token-swapping)
  if (tokenRow.booking_id !== bookingId) {
    return fail("Token does not match booking.", 401);
  }

  // 3. Fetch booking
  const { data: booking, error: fetchError } = await supabaseAdmin
    .from("bookings")
    .select(`
      id, name, email, phone, status,
      date, time, barber_id,
      reschedule_requested,
      services ( name ),
      barbers  ( name )
    `)
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return fail("Booking not found.", 404);
  }

  // Guard: cannot reschedule a cancelled booking
  if (booking.status === "cancelled") {
    return fail("Cannot reschedule a cancelled booking.", 409);
  }

  // Guard: a reschedule request is already pending
  if (booking.reschedule_requested) {
    return fail("A reschedule request is already pending. Please wait for admin approval.", 409);
  }

  // 4. Validate new date + time
  if (!isValidDate(new_date)) {
    return fail("Invalid new_date format. Use YYYY-MM-DD.");
  }

  const selectedDate = new Date(new_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (selectedDate < today) {
    return fail("Cannot reschedule to a date in the past.");
  }

  if (!isValidTime(new_time)) {
    return fail("Invalid new_time format. Use HH:MM.");
  }

  const hour = getHour(new_time);
  if (hour < SLOT_START_HOUR || hour >= SLOT_END_HOUR) {
    return fail(`New time must be between ${SLOT_START_HOUR}:00 and ${SLOT_END_HOUR}:00.`);
  }

  // Prevent requesting the exact same slot
  const normalised_new_time = new_time.slice(0, 5); // "HH:MM"
  const normalised_cur_time = booking.time.slice(0, 5);

  if (new_date === booking.date && normalised_new_time === normalised_cur_time) {
    return fail("The requested slot is the same as the current booking.");
  }

  // 5. Check new slot availability (same barber)
  const { available, error: availError } = await checkSlotAvailability(
    booking.barber_id,
    new_date,
    new_time
  );

  if (availError) return fail(availError, 500);
  if (!available) {
    return fail("The requested slot is already booked. Please choose a different time.", 409);
  }

  // 6. Update booking — original date/time untouched
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({
      status:               "reschedule_requested",
      reschedule_requested: true,
      new_date,
      new_time,
    })
    .eq("id", bookingId)
    .select()
    .single();

  if (updateError) {
    return fail(`Failed to submit reschedule request: ${updateError.message}`, 500);
  }

  // Invalidate used reschedule token — a new one will be issued if needed
  revokeToken(token).catch((err) =>
    console.error("[POST /api/reschedule] Token revoke error:", err)
  );

  // 7. Notify admin (fire-and-forget)
  const adminEmail  = process.env.ADMIN_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? "";
  const serviceName = (booking.services as unknown as { name: string } | null)?.name ?? "—";
  const barberName  = (booking.barbers  as unknown as { name: string } | null)?.name ?? "—";

  if (adminEmail) {
    const emailData: BookingEmailData = {
      bookingId:     booking.id,
      customerName:  booking.name,
      customerEmail: booking.email,
      serviceName,
      barberName,
      date: booking.date,
      time: booking.time,
    };

    // Notify admin that a reschedule is pending
    sendAdminRescheduleNotification(emailData, adminEmail, new_date, new_time)
      .catch((err) =>
        console.error("[POST /api/reschedule] Admin notification error:", err)
      );
  }

  return ok({
    booking: updated,
    message:
      "Reschedule request submitted. Your original booking remains active until approved by admin.",
  });
}

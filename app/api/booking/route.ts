/**
 * app/api/booking/route.ts
 *
 * POST /api/booking
 *
 * Full booking creation flow:
 *   1. Parse + validate request body
 *   2. Check slot availability
 *   3. Insert booking into DB
 *   4. Generate cancel + reschedule tokens
 *   5. Send confirmation email to customer
 *   6. Send notification email to admin
 *
 * Emails are sent ONLY after a confirmed successful DB insert.
 */

import { NextRequest, NextResponse } from "next/server";
import { createBooking, validateBookingInput, BookingInput } from "@/lib/bookingLogic";
import { sendBookingConfirmation, sendAdminNotification, BookingEmailData } from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabaseClient";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

// ─────────────────────────────────────────────────────────────
// POST /api/booking
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const input = body as BookingInput;

  // 2. Validate input (pure, no DB)
  const validationError = validateBookingInput(input);
  if (validationError) return fail(validationError, 400);

  // 3. Create booking (checks availability → inserts → generates tokens)
  const result = await createBooking(input);

  if (!result.success || !result.data) {
    // 409 for slot conflicts, 400 for everything else
    const isConflict =
      result.error?.toLowerCase().includes("already booked") ||
      result.error?.toLowerCase().includes("just booked");
    return fail(result.error ?? "Booking failed.", isConflict ? 409 : 400);
  }

  const booking = result.data;
  const { cancel: cancelToken, reschedule: rescheduleToken } = result.tokens ?? {};

  // 4. Fetch related service + barber names for email
  const [serviceRes, barberRes] = await Promise.all([
    supabaseAdmin.from("services").select("name").eq("id", booking.service_id).single(),
    supabaseAdmin.from("barbers").select("name").eq("id", booking.barber_id).single(),
  ]);

  const serviceName = serviceRes.data?.name ?? "—";
  const barberName  = barberRes.data?.name  ?? "—";

  const emailData: BookingEmailData = {
    bookingId:     booking.id,
    customerName:  booking.name,
    customerEmail: booking.email,
    serviceName,
    barberName,
    date: booking.date,
    time: booking.time,
  };

  // 5. Send emails (fire-and-forget — do not block response on email failure)
  const adminEmail = process.env.ADMIN_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? "";

  Promise.all([
    cancelToken && rescheduleToken
      ? sendBookingConfirmation(emailData, cancelToken, rescheduleToken)
      : Promise.resolve(),
    adminEmail
      ? sendAdminNotification(emailData, adminEmail)
      : Promise.resolve(),
  ]).catch((err) =>
    console.error("[POST /api/booking] Email send error:", err)
  );

  return ok(
    {
      booking,
      message: "Booking created successfully. A confirmation email has been sent.",
    },
    201
  );
}

/**
 * app/api/cancel/route.ts
 *
 * POST /api/cancel
 *
 * Cancels a booking via a secure email token link.
 * Token validation IS the proof of user intent — no further admin approval
 * step is required here. Admin is notified after cancellation.
 *
 * Flow:
 *   1. Read booking ID + token from request body
 *   2. Validate cancel token (type, expiry)
 *   3. Guard: already cancelled?
 *   4. Mark booking as "cancelled" in DB
 *   5. Revoke all tokens for this booking (prevent reuse)
 *   6. Notify admin of the cancellation (fire-and-forget)
 *
 * No token → no cancel. Period.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateToken, revokeBookingTokens } from "@/lib/token";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sendAdminCancelNotification, BookingEmailData } from "@/lib/email";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function ok<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data }, { status: 200 });
}

function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

// ─────────────────────────────────────────────────────────────
// POST /api/cancel
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Parse body
  let body: { id?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const { id: bookingId, token } = body;

  if (!bookingId?.trim()) return fail("Booking ID is required.", 400);
  if (!token?.trim())     return fail("Token is required.", 400);

  // 2. Validate token — must be type "cancel", must not be expired
  const { success: tokenValid, error: tokenError } = await validateToken(
    token,
    "cancel"
  );

  if (!tokenValid) {
    return fail(tokenError ?? "Invalid or expired cancellation link.", 401);
  }

  // 3. Fetch booking and guard against double-cancel
  const { data: booking, error: fetchError } = await supabaseAdmin
    .from("bookings")
    .select(`
      id, name, email, phone, status,
      date, time, service_id, barber_id,
      services ( name ),
      barbers  ( name )
    `)
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return fail("Booking not found.", 404);
  }

  if (booking.status === "cancelled") {
    return fail("This booking is already cancelled.", 409);
  }

  // 4. Mark booking as cancelled
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .select()
    .single();

  if (updateError) {
    return fail(`Failed to cancel booking: ${updateError.message}`, 500);
  }

  // 5. Revoke ALL tokens for this booking — no further actions allowed
  revokeBookingTokens(bookingId).catch((err) =>
    console.error("[POST /api/cancel] Token revoke error:", err)
  );

  // 6. Notify admin (fire-and-forget — does not block response)
  const adminEmail = process.env.ADMIN_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? "";
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

    // Notify admin
    sendAdminCancelNotification(emailData, adminEmail)
      .catch((err) =>
        console.error("[POST /api/cancel] Admin notification error:", err)
      );
  }

  return ok({
    booking: updated,
    message: "Your booking has been successfully cancelled.",
  });
}

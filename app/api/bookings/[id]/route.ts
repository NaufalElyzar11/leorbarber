/**
 * app/api/bookings/[id]/route.ts
 *
 * PATCH /api/bookings/:id
 *
 * Admin endpoint to update booking status.
 *
 * Supported transitions:
 *   pending              → confirmed
 *   pending              → cancelled
 *   reschedule_requested → confirmed   (approves reschedule: moves new_date/time → date/time)
 *   reschedule_requested → cancelled   (rejects reschedule: keeps original date/time)
 *   any                  → cancelled
 *
 * Body: { status: "confirmed" | "cancelled" }
 *
 * Side effects:
 *   - Approving reschedule copies new_date/new_time → date/time and clears reschedule fields
 *   - Cancellation revokes all tokens for the booking
 *   - Sends admin decision email to customer in both cases
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { revokeBookingTokens } from "@/lib/token";
import {
  sendAdminDecisionEmail,
  BookingEmailData,
} from "@/lib/email";
import { requireAdmin } from "@/lib/adminAuth";

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
// PATCH /api/bookings/:id
// ─────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // ── Auth guard ─────────────────────────────────────────────
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = params;

  // 1. Parse body
  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const { status: newStatus } = body;
  const allowedStatuses = ["confirmed", "cancelled"];
  if (!newStatus || !allowedStatuses.includes(newStatus)) {
    return fail(`Status must be one of: ${allowedStatuses.join(", ")}.`);
  }

  // 2. Fetch current booking
  const { data: booking, error: fetchError } = await supabaseAdmin
    .from("bookings")
    .select(`
      id, name, email, phone, status,
      date, time, new_date, new_time,
      reschedule_requested,
      service_id, barber_id,
      services ( id, name, price ),
      barbers  ( id, name )
    `)
    .eq("id", id)
    .single();

  if (fetchError || !booking) {
    return fail("Booking not found.", 404);
  }

  // 3. Guard — no-op transitions
  if (booking.status === newStatus) {
    return fail(`Booking is already ${newStatus}.`);
  }

  if (booking.status === "cancelled") {
    return fail("Cannot change status of a cancelled booking.");
  }

  // 4. Build update payload
  const isApprovingReschedule =
    booking.reschedule_requested && newStatus === "confirmed";

  const updatePayload: Record<string, unknown> = { status: newStatus };

  if (isApprovingReschedule) {
    // Promote proposed dates into the actual booking slot
    updatePayload.date                 = booking.new_date;
    updatePayload.time                 = booking.new_time;
    updatePayload.new_date             = null;
    updatePayload.new_time             = null;
    updatePayload.reschedule_requested = false;
  }

  if (newStatus === "cancelled") {
    // Clear any pending reschedule fields on cancellation
    updatePayload.reschedule_requested = false;
    updatePayload.new_date             = null;
    updatePayload.new_time             = null;
  }

  // 5. Apply update
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("bookings")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (updateError) return fail(`Update failed: ${updateError.message}`, 500);

  // 6. Revoke all tokens if cancelled
  if (newStatus === "cancelled") {
    revokeBookingTokens(id).catch((err) =>
      console.error("[PATCH /api/bookings/:id] Token revoke error:", err)
    );
  }

  // 7. Send decision email to customer (fire-and-forget)
  const serviceName = (booking.services as unknown as { name: string } | null)?.name ?? "—";
  const barberName  = (booking.barbers  as unknown as { name: string } | null)?.name ?? "—";

  const emailData: BookingEmailData = {
    bookingId:     booking.id,
    customerName:  booking.name,
    customerEmail: booking.email,
    serviceName,
    barberName,
    date: booking.date,
    time: booking.time,
  };

  if (booking.status === "pending" && newStatus === "confirmed") {
    // Do nothing: Normal booking confirmation — the email was already sent upon creation.
  } else if (booking.reschedule_requested) {
    // Reschedule request decision
    const approved = newStatus === "confirmed";
    sendAdminDecisionEmail(
      emailData,
      "reschedule",
      approved,
      isApprovingReschedule ? booking.new_date  : undefined,
      isApprovingReschedule ? booking.new_time  : undefined
    ).catch((err) =>
      console.error("[PATCH /api/bookings/:id] Email error:", err)
    );
  } else if (newStatus === "cancelled") {
    // Admin manually cancels a booking
    sendAdminDecisionEmail(emailData, "cancel", true).catch((err) =>
      console.error("[PATCH /api/bookings/:id] Email error:", err)
    );
  }

  return ok({
    booking: updated,
    message: `Booking ${newStatus === "confirmed" ? "confirmed" : "cancelled"} successfully.`,
  });
}

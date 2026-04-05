/**
 * app/api/booking-details/route.ts
 *
 * GET /api/booking-details?id=...&token=...&type=cancel|reschedule
 *
 * Securely fetches booking details ONLY if a valid action token is provided.
 * Used by the cancel and reschedule frontend pages to display what is being
 * modified and to fetch slots for the correct barber.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateToken, TokenType } from "@/lib/token";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const token = searchParams.get("token");
  const type = searchParams.get("type") as TokenType;

  if (!id || !token || !type) {
    return NextResponse.json(
      { success: false, error: "Missing required parameters (id, token, type)." },
      { status: 400 }
    );
  }

  if (type !== "cancel" && type !== "reschedule") {
    return NextResponse.json(
      { success: false, error: "Invalid token type." },
      { status: 400 }
    );
  }

  // 1. Validate the token
  const { success: tokenValid, error: tokenError, tokenRow } = await validateToken(
    token,
    type
  );

  if (!tokenValid || !tokenRow) {
    return NextResponse.json(
      { success: false, error: tokenError ?? "Invalid or expired link." },
      { status: 401 }
    );
  }

  // 2. Ensure token belongs to the claimed booking ID
  if (tokenRow.booking_id !== id) {
    return NextResponse.json(
      { success: false, error: "Token does not match booking." },
      { status: 401 }
    );
  }

  // 3. Fetch booking public details
  const { data: booking, error: fetchError } = await supabaseAdmin
    .from("bookings")
    .select(`
      id, date, time, status, barber_id, service_id,
      services ( name, price ),
      barbers  ( name )
    `)
    .eq("id", id)
    .single();

  if (fetchError || !booking) {
    return NextResponse.json(
      { success: false, error: "Booking not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: { booking } });
}

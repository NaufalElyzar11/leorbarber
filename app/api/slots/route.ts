/**
 * app/api/slots/route.ts
 *
 * GET /api/slots?barber_id=<uuid>&date=YYYY-MM-DD
 *
 * Returns all time slots for a barber on a given date,
 * annotated with availability status.
 * Used by the booking page to populate the TimeSlotPicker.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/timeSlot";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const barber_id = searchParams.get("barber_id");
  const date      = searchParams.get("date");

  if (!barber_id) {
    return NextResponse.json(
      { success: false, error: "barber_id is required." },
      { status: 400 }
    );
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { success: false, error: "date is required in YYYY-MM-DD format." },
      { status: 400 }
    );
  }

  const { slots, error } = await getAvailableSlots(date, barber_id);

  if (error) {
    return NextResponse.json(
      { success: false, error },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: { slots } });
}

/**
 * app/api/schedule/block/route.ts
 *
 * Admin API to manage Schedule Blocks
 *
 * POST /api/schedule/block
 * Creates a new block. If `time` is omitted, the block spans the whole day.
 * Body: { barber_id, date, time?, reason? }
 *
 * DELETE /api/schedule/block
 * Deletes an existing block.
 * Body: { id }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
  let body: { barber_id?: string; date?: string; time?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { barber_id, date, time, reason } = body;

  if (!barber_id || !date) {
    return NextResponse.json(
      { success: false, error: "barber_id and date are required." },
      { status: 400 }
    );
  }

  // Ensure time fits "HH:MM:SS" or "HH:MM"
  let formattedTime: string | null = null;
  if (time && time.trim() !== "") {
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
      return NextResponse.json(
        { success: false, error: "Invalid time format." },
        { status: 400 }
      );
    }
    formattedTime = time.length === 5 ? `${time}:00` : time;
  }

  const payload = {
    barber_id,
    date,
    time: formattedTime,
    reason: reason?.trim() || "Admin Block",
  };

  const { data, error } = await supabaseAdmin
    .from("schedule_blocks")
    .insert(payload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Schedule blocked successfully.", data });
}

export async function DELETE(req: NextRequest) {
  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ success: false, error: "Block ID is required." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("schedule_blocks")
    .delete()
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Schedule block removed successfully." });
}

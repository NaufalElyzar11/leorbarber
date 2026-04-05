/**
 * app/api/barbers/route.ts
 *
 * GET /api/barbers
 * Returns all active barbers with their working hours.
 * 
 * POST /api/barbers
 * Admin endpoint to add a new barber.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabaseClient";

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabase
    .from("barbers")
    .select("id, name, working_hours_start, working_hours_end")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: { barbers: data } });
}

// ─────────────────────────────────────────────────────────────
// POST /api/barbers
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Parse body
  let body: { name?: string; working_hours_start?: string; working_hours_end?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const { name, working_hours_start, working_hours_end } = body;

  // 2. Validate
  if (!name?.trim()) {
    return NextResponse.json({ success: false, error: "Barber name is required." }, { status: 400 });
  }

  const payload: Record<string, any> = { name: name.trim() };

  if (working_hours_start) payload.working_hours_start = working_hours_start;
  if (working_hours_end)   payload.working_hours_end = working_hours_end;

  // 3. Insert using Admin Client
  const { data, error } = await supabaseAdmin
    .from("barbers")
    .insert(payload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: "Barber added successfully.",
    data: data,
  }, { status: 201 });
}

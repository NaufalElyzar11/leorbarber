/**
 * app/api/barbers/[id]/route.ts
 *
 * PATCH /api/barbers/:id
 * Admin endpoint to update a barber's details.
 *
 * DELETE /api/barbers/:id
 * Admin endpoint to soft-delete a barber (is_active = false).
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

function ok<T>(data: T, message: string, status = 200): NextResponse {
  return NextResponse.json({ success: true, message, data }, { status });
}

function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/barbers/:id
// ─────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { id } = params;

  let body: { name?: string; working_hours_start?: string; working_hours_end?: string; is_active?: boolean };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.");
  }

  const { name, working_hours_start, working_hours_end, is_active } = body;

  const payload: Record<string, any> = {};
  if (name !== undefined) {
    if (!name.trim()) return fail("Name cannot be empty.");
    payload.name = name.trim();
  }
  if (working_hours_start !== undefined) payload.working_hours_start = working_hours_start;
  if (working_hours_end !== undefined)   payload.working_hours_end = working_hours_end;
  if (is_active !== undefined)           payload.is_active = is_active;

  if (Object.keys(payload).length === 0) {
    return fail("No fields provided to update.");
  }

  const { data, error } = await supabaseAdmin
    .from("barbers")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return fail(`Failed to update barber: ${error.message}`, 500);
  }

  return ok(data, "Barber updated successfully.");
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/barbers/:id
// ─────────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { id } = params;

  // We perform a SOFT delete to preserve historical booking and revenue data.
  const { data, error } = await supabaseAdmin
    .from("barbers")
    .update({ is_active: false })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return fail(`Failed to delete barber: ${error.message}`, 500);
  }

  return ok(data, "Barber successfully removed from public booking.");
}

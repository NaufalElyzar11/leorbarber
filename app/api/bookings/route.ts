/**
 * app/api/bookings/route.ts
 *
 * GET /api/bookings
 *
 * Returns all bookings, joined with service and barber names.
 * Admin-facing endpoint.
 *
 * Query params (all optional):
 *   ?status=pending|confirmed|cancelled|reschedule_requested
 *   ?date=YYYY-MM-DD
 *   ?barber_id=<uuid>
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

function ok<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data }, { status: 200 });
}

function fail(message: string, status = 500): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

// ─────────────────────────────────────────────────────────────
// GET /api/bookings
// ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth guard ─────────────────────────────────────────────
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const status    = searchParams.get("status");
  const date      = searchParams.get("date");
  const barber_id = searchParams.get("barber_id");

  // Validate status filter if provided
  const validStatuses = ["pending", "confirmed", "cancelled", "reschedule_requested"];
  if (status && !validStatuses.includes(status)) {
    return fail(`Invalid status filter. Must be one of: ${validStatuses.join(", ")}`, 400);
  }

  // Build query — join service + barber inline via Supabase FK expansion
  let query = supabaseAdmin
    .from("bookings")
    .select(`
      id,
      name,
      email,
      phone,
      date,
      time,
      status,
      reschedule_requested,
      new_date,
      new_time,
      created_at,
      services ( id, name, price ),
      barbers  ( id, name )
    `)
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (status)    query = query.eq("status", status);
  if (date)      query = query.eq("date", date);
  if (barber_id) query = query.eq("barber_id", barber_id);

  const { data, error } = await query;

  if (error) return fail(`Failed to fetch bookings: ${error.message}`);

  return ok({ bookings: data, total: data.length });
}

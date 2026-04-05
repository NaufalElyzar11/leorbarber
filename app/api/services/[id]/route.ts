/**
 * app/api/services/[id]/route.ts
 *
 * PATCH /api/services/:id
 * Admin endpoint to update a service (name, price, description, is_active).
 *
 * DELETE /api/services/:id
 * Admin endpoint to soft-delete a service (is_active = false).
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
// PATCH /api/services/:id
// ─────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { id } = params;

  let body: {
    name?: string;
    price?: number;
    description?: string;
    is_active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body.");
  }

  const { name, price, description, is_active } = body;

  const payload: Record<string, any> = {};
  if (name !== undefined) {
    if (!name.trim()) return fail("Name cannot be empty.");
    payload.name = name.trim();
  }
  if (price !== undefined) {
    if (price < 0) return fail("Price must be non-negative.");
    payload.price = price;
  }
  if (description !== undefined) payload.description = description.trim();
  if (is_active !== undefined)   payload.is_active = is_active;

  if (Object.keys(payload).length === 0) {
    return fail("No fields provided to update.");
  }

  const { data, error } = await supabaseAdmin
    .from("services")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return fail(`Failed to update service: ${error.message}`, 500);
  }

  return ok(data, "Service updated successfully.");
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/services/:id
// ─────────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { id } = params;

  // Soft delete — preserves revenue and booking history
  const { data, error } = await supabaseAdmin
    .from("services")
    .update({ is_active: false })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return fail(`Failed to delete service: ${error.message}`, 500);
  }

  return ok(data, "Service removed from public listing.");
}

/**
 * app/api/services/route.ts
 *
 * GET /api/services
 * Returns all active services ordered by price ascending.
 *
 * POST /api/services
 * Admin endpoint to add a new service.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabaseClient";

// ─────────────────────────────────────────────────────────────
// GET /api/services
// ─────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabase
    .from("services")
    .select("id, name, price, description")
    .eq("is_active", true)
    .order("price", { ascending: true });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: { services: data } });
}

// ─────────────────────────────────────────────────────────────
// POST /api/services
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { name?: string; price?: number; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { name, price, description } = body;

  // Validate
  if (!name?.trim()) {
    return NextResponse.json(
      { success: false, error: "Service name is required." },
      { status: 400 }
    );
  }

  if (price === undefined || price === null || price < 0) {
    return NextResponse.json(
      { success: false, error: "Price must be a non-negative number." },
      { status: 400 }
    );
  }

  const payload: Record<string, any> = {
    name: name.trim(),
    price,
    description: description?.trim() ?? "",
  };

  const { data, error } = await supabaseAdmin
    .from("services")
    .insert(payload)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, message: "Service added successfully.", data },
    { status: 201 }
  );
}

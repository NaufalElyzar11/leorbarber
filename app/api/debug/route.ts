/**
 * app/api/debug/route.ts
 *
 * GET /api/debug
 *
 * DEVELOPMENT ONLY — cek koneksi Supabase dan data bookings terbaru.
 * ⚠️ Hapus file ini sebelum deploy ke production!
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function GET() {
  const results: Record<string, unknown> = {};

  // 1. Cek koneksi DB — ambil semua bookings
  const { data: bookings, error: bookingsError } = await supabaseAdmin
    .from("bookings")
    .select("id, name, date, time, status, barber_id")
    .order("created_at", { ascending: false })
    .limit(10);

  results.bookings = {
    error: bookingsError?.message ?? null,
    count: bookings?.length ?? 0,
    data: bookings ?? [],
  };

  // 2. Cek tabel barbers
  const { data: barbers, error: barbersError } = await supabaseAdmin
    .from("barbers")
    .select("id, name");

  results.barbers = {
    error: barbersError?.message ?? null,
    count: barbers?.length ?? 0,
    data: barbers ?? [],
  };

  // 3. Cek tabel services
  const { data: services, error: servicesError } = await supabaseAdmin
    .from("services")
    .select("id, name");

  results.services = {
    error: servicesError?.message ?? null,
    count: services?.length ?? 0,
    data: services ?? [],
  };

  // 4. Cek tabel booking_tokens
  const { data: tokens, error: tokensError } = await supabaseAdmin
    .from("booking_tokens")
    .select("id, booking_id, type")
    .limit(5);

  results.booking_tokens = {
    error: tokensError?.message ?? null,
    count: tokens?.length ?? 0,
    data: tokens ?? [],
  };

  // 5. Environment check
  results.env = {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Set" : "❌ Missing",
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ Set" : "❌ Missing",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ Set" : "❌ Missing",
    RESEND_API_KEY: process.env.RESEND_API_KEY ? "✅ Set" : "❌ Missing",
    ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "❌ Missing",
  };

  const hasAnyError = [bookingsError, barbersError, servicesError, tokensError].some(Boolean);

  return NextResponse.json({
    status: hasAnyError ? "❌ DB Error" : "✅ DB Connected",
    timestamp: new Date().toISOString(),
    results,
  });
}

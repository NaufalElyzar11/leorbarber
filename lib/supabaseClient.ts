/**
 * lib/supabaseClient.ts
 *
 * Supabase client setup for the Barbershop Booking System.
 *
 * Exports:
 *   - supabase       → browser/client-side client (anon key, safe to expose)
 *   - supabaseAdmin  → server-side client (service role key, NEVER import on client)
 *
 * Usage:
 *   import { supabase }      from "@/lib/supabaseClient";   // Client components / API routes (read/public writes)
 *   import { supabaseAdmin } from "@/lib/supabaseClient";   // Server-only: cancel, reschedule, admin actions
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ──────────────────────────────────────────────
// Environment variable validation
// ──────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseAnonKey) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// ──────────────────────────────────────────────
// Public (anon) client
// Safe to use in browser and server components.
// Respects Row Level Security (RLS) policies.
// ──────────────────────────────────────────────
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: false, // No auth sessions needed (booking is public)
    },
  }
);

// ──────────────────────────────────────────────
// Admin (service role) client
// ONLY import this in server-side code:
//   - /app/api/** route handlers
//   - Server Actions
//   - getServerSideProps / generateStaticParams
//
// This key BYPASSES RLS — never expose it to the browser.
// ──────────────────────────────────────────────
function createAdminClient(): SupabaseClient {
  if (!supabaseServiceRoleKey) {
    throw new Error(
      "Missing environment variable: SUPABASE_SERVICE_ROLE_KEY. " +
        "This client may only be used on the server."
    );
  }
  return createClient(supabaseUrl!, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Admin Supabase client — server-only.
 * Bypasses RLS. Use for:
 *   - Confirming / rejecting reschedule requests
 *   - Processing cancel actions (token validation → status update)
 *   - Any privileged admin operations
 */
export const supabaseAdmin: SupabaseClient = createAdminClient();

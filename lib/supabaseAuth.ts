/**
 * lib/supabaseAuth.ts
 *
 * Auth-aware Supabase clients for the Barbershop Booking System.
 *
 * Exports:
 *   - createBrowserAuthClient() → client-side auth (login form, session checks)
 *   - createServerAuthClient()  → server-side auth (API route protection)
 *
 * Uses @supabase/ssr for cookie-based session management with Next.js.
 */

import { createBrowserClient as _createBrowserClient } from "@supabase/ssr";
import { createServerClient as _createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// ──────────────────────────────────────────────
// Environment variables
// ──────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ──────────────────────────────────────────────
// Browser client (for "use client" components)
// ──────────────────────────────────────────────

export function createBrowserAuthClient() {
  return _createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// ──────────────────────────────────────────────
// Server client (for API routes / middleware)
// Reads and writes auth cookies from the request.
// ──────────────────────────────────────────────

export function createServerAuthClient(
  req: NextRequest,
  res?: NextResponse
) {
  const response = res ?? NextResponse.next();

  return {
    client: _createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Set cookies on the response
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }),
    response,
  };
}

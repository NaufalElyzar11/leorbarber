/**
 * app/auth/callback/route.ts
 *
 * Supabase Auth callback handler.
 * Exchanges the auth code for a session and sets cookies.
 * Required for server-side cookie-based auth to work.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabaseAuth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/admin";

  if (code) {
    const { client, response } = createServerAuthClient(req);
    const { error } = await client.auth.exchangeCodeForSession(code);

    if (!error) {
      // Redirect to the intended destination
      const url = new URL(next, req.url);
      return NextResponse.redirect(url, { headers: response.headers });
    }
  }

  // If no code or exchange failed, redirect to login
  const loginUrl = new URL("/admin/login", req.url);
  return NextResponse.redirect(loginUrl);
}

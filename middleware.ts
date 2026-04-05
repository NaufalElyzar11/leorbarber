/**
 * middleware.ts
 *
 * Next.js Middleware for Supabase Auth session refresh.
 *
 * Runs on every request to /admin/* and /api/admin/* to keep
 * auth cookies fresh. Does NOT perform authorization — that's
 * done by requireAdmin() in each API route.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const response = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Forward cookies to both the request and response
          cookiesToSet.forEach(({ name, value }) => {
            req.cookies.set(name, value);
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh the session — this updates the auth cookies if needed
  await supabase.auth.getUser();

  return response;
}

// Only run middleware on admin routes (pages + API)
export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/bookings/:path*"],
};

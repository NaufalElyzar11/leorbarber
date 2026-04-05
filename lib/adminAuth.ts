/**
 * lib/adminAuth.ts
 *
 * Server-side admin authentication helper.
 *
 * Usage in API routes:
 *   const auth = await requireAdmin(req);
 *   if (auth instanceof NextResponse) return auth; // 401 or 403
 *   // auth.user is the verified admin user
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabaseAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { User } from "@supabase/supabase-js";

interface AdminAuthSuccess {
  user: User;
}

/**
 * Verifies that the request is from an authenticated admin user.
 *
 * 1. Reads the session from request cookies
 * 2. Verifies the user exists via Supabase Auth
 * 3. Checks the `admins` table to confirm admin privilege
 *
 * @returns The admin user object, or a NextResponse with 401/403.
 */
export async function requireAdmin(
  req: NextRequest
): Promise<AdminAuthSuccess | NextResponse> {
  // 1. Get authenticated user from cookies
  const { client } = createServerAuthClient(req);
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 }
    );
  }

  // 2. Check if the user is in the admins table
  const { data: adminRow, error: adminError } = await supabaseAdmin
    .from("admins")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (adminError || !adminRow) {
    return NextResponse.json(
      { success: false, error: "Forbidden. Admin access required." },
      { status: 403 }
    );
  }

  return { user };
}

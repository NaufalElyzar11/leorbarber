/**
 * lib/token.ts
 *
 * Token generation and validation for the Barbershop Booking System.
 * Tokens are generated using Node's crypto module (CSPRNG) — 32 bytes
 * of entropy encoded as a 64-character hex string, making them
 * practically impossible to guess or brute-force.
 *
 * Tokens are stored in the `booking_tokens` table and expire after a
 * configurable duration (default: 7 days).
 *
 * Exported functions:
 *   - generateToken(type, bookingId)  → inserts and returns a new token row
 *   - validateToken(token, type)      → validates token and returns booking
 *   - revokeToken(token)              → immediately invalidates a token
 *   - revokeBookingTokens(bookingId)  → invalidates all tokens for a booking
 */

import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseClient";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type TokenType = "cancel" | "reschedule";

export interface BookingToken {
  id: string;
  booking_id: string;
  token: string;
  type: TokenType;
  expires_at: string;
}

export interface GenerateTokenResult {
  success: boolean;
  token?: string;
  expiresAt?: string;
  error?: string;
}

export interface ValidateTokenResult {
  success: boolean;
  bookingId?: string;
  tokenRow?: BookingToken;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

/** Entropy bytes — 32 bytes = 256 bits of randomness (hex string = 64 chars) */
const TOKEN_BYTES = 32;

/** Default token validity (days) */
const TOKEN_EXPIRY_DAYS = 7;

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

/**
 * Generates a cryptographically secure random token string.
 * Uses Node.js `crypto.randomBytes` (CSPRNG) — safe against prediction.
 */
function createSecureToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
  // Example output: "a3f19c2e8b0d4f5a7e1c3b6d9f2a8e4c7b5d0f3a1e6c9b2d5f8a0e3c7b4d1f"
}

/**
 * Returns an ISO timestamp N days from now.
 */
function expiresAt(days: number = TOKEN_EXPIRY_DAYS): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ─────────────────────────────────────────────────────────────
// 1. generateToken
// ─────────────────────────────────────────────────────────────

/**
 * Generates a secure token for a booking action (cancel or reschedule),
 * persists it to the `booking_tokens` table, and returns the token string.
 *
 * Always call AFTER a successful DB write — never preemptively.
 *
 * @param type       "cancel" | "reschedule"
 * @param bookingId  UUID of the booking this token belongs to
 * @param expiryDays Optional override for token validity (default: 7 days)
 *
 * @example
 * const result = await generateToken("cancel", booking.id);
 * if (!result.success) throw new Error(result.error);
 * const cancelLink = `${APP_URL}/booking/cancel?id=${bookingId}&token=${result.token}`;
 */
export async function generateToken(
  type: TokenType,
  bookingId: string,
  expiryDays: number = TOKEN_EXPIRY_DAYS
): Promise<GenerateTokenResult> {
  const token = createSecureToken();
  const expiry = expiresAt(expiryDays);

  const { error } = await supabaseAdmin
    .from("booking_tokens")
    .insert({
      booking_id: bookingId,
      token,
      type,
      expires_at: expiry,
    });

  if (error) {
    return { success: false, error: `Failed to save token: ${error.message}` };
  }

  return { success: true, token, expiresAt: expiry };
}

/**
 * Convenience helper — generates both cancel AND reschedule tokens
 * for a booking in a single call (two inserts, one await).
 *
 * @example
 * const { cancel, reschedule } = await generateBookingTokens(booking.id);
 */
export async function generateBookingTokens(bookingId: string): Promise<{
  cancel: string | null;
  reschedule: string | null;
  error?: string;
}> {
  const cancelToken = createSecureToken();
  const rescheduleToken = createSecureToken();
  const expiry = expiresAt();

  const { error } = await supabaseAdmin.from("booking_tokens").insert([
    { booking_id: bookingId, token: cancelToken,     type: "cancel",     expires_at: expiry },
    { booking_id: bookingId, token: rescheduleToken, type: "reschedule", expires_at: expiry },
  ]);

  if (error) {
    return {
      cancel: null,
      reschedule: null,
      error: `Failed to generate tokens: ${error.message}`,
    };
  }

  return { cancel: cancelToken, reschedule: rescheduleToken };
}

// ─────────────────────────────────────────────────────────────
// 2. validateToken
// ─────────────────────────────────────────────────────────────

/**
 * Validates a token by:
 *   1. Looking it up in `booking_tokens`
 *   2. Ensuring it matches the expected type
 *   3. Ensuring it has not expired
 *
 * Returns the associated booking ID if valid.
 * Does NOT consume or delete the token — call revokeToken() after action.
 *
 * @param token  Raw token string from the URL query param
 * @param type   Expected token type ("cancel" | "reschedule")
 *
 * @example
 * const { success, bookingId } = await validateToken(token, "cancel");
 * if (!success) return res.status(400).json({ error: "Invalid or expired link." });
 */
export async function validateToken(
  token: string,
  type: TokenType
): Promise<ValidateTokenResult> {
  if (!token || token.length !== TOKEN_BYTES * 2) {
    return { success: false, error: "Malformed token." };
  }

  const { data, error } = await supabaseAdmin
    .from("booking_tokens")
    .select("*")
    .eq("token", token)
    .eq("type", type)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    return { success: false, error: `Token lookup failed: ${error.message}` };
  }

  if (!data) {
    return { success: false, error: "Invalid or expired token." };
  }

  return {
    success: true,
    bookingId: data.booking_id,
    tokenRow: data as BookingToken,
  };
}

// ─────────────────────────────────────────────────────────────
// 3. revokeToken
// ─────────────────────────────────────────────────────────────

/**
 * Immediately invalidates a single token by deleting it from the database.
 * Call this after a successful cancel or reschedule action to prevent reuse.
 *
 * @example
 * await revokeToken(token);
 */
export async function revokeToken(token: string): Promise<void> {
  await supabaseAdmin
    .from("booking_tokens")
    .delete()
    .eq("token", token);
}

// ─────────────────────────────────────────────────────────────
// 4. revokeBookingTokens
// ─────────────────────────────────────────────────────────────

/**
 * Invalidates ALL tokens for a given booking.
 * Use when a booking is fully cancelled — no further actions allowed.
 *
 * @example
 * await revokeBookingTokens(bookingId);
 */
export async function revokeBookingTokens(bookingId: string): Promise<void> {
  await supabaseAdmin
    .from("booking_tokens")
    .delete()
    .eq("booking_id", bookingId);
}

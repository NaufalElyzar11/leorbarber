/**
 * app/api/debug/backfill-price/route.ts
 *
 * Temporary utility endpoint to backfill `service_price` for all 
 * existing bookings that were created before the revenue tracking update.
 *
 * Usage: GET http://localhost:3000/api/debug/backfill-price
 * WARNING: Remove this file before production deployment!
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function GET() {
  // 1. Fetch all bookings where service_price is 0 or null
  const { data: bookings, error: fetchError } = await supabaseAdmin
    .from("bookings")
    .select("id, service_id, service_price")
    .or("service_price.eq.0,service_price.is.null");

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  // 2. Fetch all services to map their prices
  const { data: services, error: serviceError } = await supabaseAdmin
    .from("services")
    .select("id, price");

  if (serviceError) {
    return NextResponse.json({ error: serviceError.message }, { status: 500 });
  }

  const priceMap = new Map<string, number>();
  for (const s of services) priceMap.set(s.id, s.price);

  // 3. Update bookings
  let updatedCount = 0;
  for (const b of bookings || []) {
    const correctPrice = priceMap.get(b.service_id) || 0;
    
    // Only update if it actually needs updating
    if (correctPrice > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("bookings")
        .update({ service_price: correctPrice })
        .eq("id", b.id);

      if (updateError) {
        console.error(`Failed to update booking ${b.id}:`, updateError.message);
      } else {
        updatedCount++;
      }
    }
  }

  return NextResponse.json({
    message: "Backfill complete.",
    scanned: bookings?.length || 0,
    updated: updatedCount,
  });
}

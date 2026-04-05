import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, status, date, time, new_date, new_time, reschedule_requested")
    .order("created_at", { ascending: false })
    .limit(10);
  
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Latest Bookings:");
    console.table(data);
  }
}

check();

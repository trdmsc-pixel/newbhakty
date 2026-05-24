import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: "/Users/shyamsharma/Desktop/WORK/3.5 port/newbhakty/.env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const activeIds = [
    "1b5cc21a-b73d-4513-9f84-72b97d69bb40",
    "f9d80e40-84cf-4e98-92ff-06fb57d778ea"
  ];

  console.log("Testing navigation_menu table query...");
  try {
    const { data, error } = await supabase
      .from("navigation_menu")
      .select("id")
      .not("id", "in", `(${activeIds.join(",")})`);
    console.log("Result navigation_menu:", { data, error });
  } catch (e) {
    console.error("Error navigation_menu:", e);
  }

  console.log("Testing pricing_tiers table query...");
  try {
    const { data, error } = await supabase
      .from("pricing_tiers")
      .select("id")
      .not("id", "in", `(${activeIds.join(",")})`);
    console.log("Result pricing_tiers:", { data, error });
  } catch (e) {
    console.error("Error pricing_tiers:", e);
  }
}

run();

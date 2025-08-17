import { createClient } from "@supabase/supabase-js";

// Ensure environment variables are loaded correctly
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Supabase URL or ANON KEY is missing!");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// src/lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

// Load Vercel environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Safety check
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Supabase URL or ANON KEY is missing!");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

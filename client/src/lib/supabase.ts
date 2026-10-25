import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!supabaseUrl || !supabaseKey) {
  // createClient() throws on missing values, which would blank the entire site.
  // Keep the public pages working and make the misconfiguration obvious instead.
  console.error(
    "[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are not set; sign-in is unavailable."
  );
}

export const supabase = createClient(
  supabaseUrl || "http://localhost:54321",
  supabaseKey || "supabase-key-not-configured"
);

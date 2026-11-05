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

/**
 * Known remaining session sharing between sites (found Nov 5 2026, not changed
 * by the sign-out scope fix):
 *
 * 1. Auth storage is per origin, and the storage adapter is localStorage
 *    (supabase-js default). www.cabinetdealz.com serves /signin, /admin,
 *    /store/:slug, and /contractor, so all of those share one session.
 * 2. A branded <slug>.cabinetdealz.com is redirected by vercel.json to
 *    /store/:slug on the canonical host, so it lands in that same session
 *    instead of keeping a session of its own.
 * 3. The legacy app_session_id cookie (shared/const) is set and cleared on the
 *    API host, so the browser attaches it to every API request, whichever site
 *    the tab is on.
 *
 * Changing any of that means moving to a per-site storage key or cookie
 * partition, which this PR deliberately does not do.
 */
export const supabase = createClient(
  supabaseUrl || "http://localhost:54321",
  supabaseKey || "supabase-key-not-configured"
);

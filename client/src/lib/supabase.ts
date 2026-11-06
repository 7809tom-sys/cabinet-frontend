import { createClient } from "@supabase/supabase-js";
import {
  AUTH_STORAGE_KEY,
  createPerTabAuthStorage,
  detachCrossTabAuthBroadcast,
  removeLegacySharedAuthSession,
} from "./supabaseAuthStorage";

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
 * One sign-in per browser tab.
 *
 * This client stores its session in `window.sessionStorage` under a fixed
 * storage key instead of the supabase-js default (`localStorage`, shared by
 * every tab of the origin). A tab that signs in as an affiliate no longer
 * rewrites the admin tab's session, because no other tab can read this one's
 * store. The session survives a reload or an OAuth redirect in the same tab,
 * and "Duplicate tab" copies it, but a brand-new tab starts signed out.
 *
 * A duplicated tab inherits a copy of the same refresh token, so the first
 * refresh in either copy invalidates the other's; signing in normally in a
 * second tab is the durable way to hold a second identity.
 *
 * The default client also opens a BroadcastChannel on the storage key and
 * replays `SIGNED_IN` / `SIGNED_OUT` / `TOKEN_REFRESHED` into every other tab;
 * that channel is closed below, since the tabs are independent now.
 *
 * Session cleanup from the old shared store: see `supabaseAuthStorage.ts`.
 */
export const supabase = createClient(
  supabaseUrl || "http://localhost:54321",
  supabaseKey || "supabase-key-not-configured",
  {
    auth: {
      storage: createPerTabAuthStorage(),
      storageKey: AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

// Nothing in this tab should pick up another tab's Supabase events.
detachCrossTabAuthBroadcast(supabase);
// A refresh token left in the origin-wide localStorage would still be usable by
// any script on this origin. Drop it now that no client reads it.
removeLegacySharedAuthSession(supabaseUrl);

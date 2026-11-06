// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  AUTH_STORAGE_KEY,
  createPerTabAuthStorage,
  detachCrossTabAuthBroadcast,
} from "./supabaseAuthStorage";

/**
 * The reported bug: Tom is signed in as admin in one tab, signs in as the
 * 'firstclassfcd' affiliate in another, and the admin tab becomes the affiliate.
 *
 * This drives the real supabase-js client against the real storage adapters.
 * A "browser" here is a fresh `Storage` object per tab, which is exactly what
 * sessionStorage gives each tab and what localStorage does not. The library
 * only needs getItem/setItem/removeItem, so a Map-backed store is a faithful
 * stand-in and needs no network.
 */

const SUPABASE_URL = "https://abcdefghijklmnop.supabase.co";

function storage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, String(value)); },
    removeItem: (key: string) => { values.delete(key); },
    keys: () => [...values.keys()],
  };
}

function createTab(storageKey: string, store: ReturnType<typeof storage>): SupabaseClient {
  const client = createClient(SUPABASE_URL, "publishable-key", {
    auth: {
      storage: createPerTabAuthStorage(store),
      storageKey,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  detachCrossTabAuthBroadcast(client);
  return client;
}

/** A session object shaped the way supabase-js persists one. */
function sessionFor(subject: string, email: string, role: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: `access-${subject}`,
    refresh_token: `refresh-${subject}`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user: {
      id: subject,
      aud: "authenticated",
      role: "authenticated",
      email,
      app_metadata: { provider: "email" },
      user_metadata: { name: email, role },
      created_at: "2026-01-01T00:00:00Z",
    },
  };
}

async function readToken(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

const clients: SupabaseClient[] = [];

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.auth.dispose()));
  vi.restoreAllMocks();
});

describe("two tabs, two identities", () => {
  it("keeps an admin tab signed in as admin when another tab signs in as an affiliate", async () => {
    const adminStore = storage();
    const affiliateStore = storage();

    const adminTab = createTab(AUTH_STORAGE_KEY, adminStore);
    const affiliateTab = createTab(AUTH_STORAGE_KEY, affiliateStore);
    clients.push(adminTab, affiliateTab);

    adminStore.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionFor("admin-user", "7809tom@gmail.com", "admin")));
    affiliateStore.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionFor("affiliate-user", "fcd@firstclass.test", "user")));

    expect(await readToken(adminTab)).toBe("access-admin-user");
    expect(await readToken(affiliateTab)).toBe("access-affiliate-user");

    // Signing in / out in the affiliate tab must not reach the admin tab.
    await affiliateTab.auth.signOut({ scope: "local" });

    expect(await readToken(affiliateTab)).toBeNull();
    expect(await readToken(adminTab)).toBe("access-admin-user");
  });

  it("would share one session if the tabs used localStorage — the reported bug", async () => {
    // The old configuration: one localStorage object and one storage key.
    const sharedLocalStorage = storage();
    const first = createTab(AUTH_STORAGE_KEY, sharedLocalStorage);
    const second = createTab(AUTH_STORAGE_KEY, sharedLocalStorage);
    clients.push(first, second);

    const affiliateSession = sessionFor("affiliate-user", "fcd@firstclass.test", "user");
    sharedLocalStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(affiliateSession));

    // Both tabs resolve the same record, so the admin tab silently becomes
    // whoever signed in last. This is the behaviour the fix removes.
    expect(await readToken(first)).toBe("access-affiliate-user");
    expect(await readToken(second)).toBe("access-affiliate-user");
  });

  it("signs out of one tab locally without revoking the other tab's session", async () => {
    const adminStore = storage();
    const affiliateStore = storage();
    const adminTab = createTab(AUTH_STORAGE_KEY, adminStore);
    const affiliateTab = createTab(AUTH_STORAGE_KEY, affiliateStore);
    clients.push(adminTab, affiliateTab);

    adminStore.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionFor("admin-user", "7809tom@gmail.com", "admin")));
    affiliateStore.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionFor("affiliate-user", "fcd@firstclass.test", "user")));

    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({}), { status: 204 }));
    vi.stubGlobal("fetch", fetchSpy);

    await adminTab.auth.signOut({ scope: "local" });

    // scope 'local' never asks the auth server to revoke anything globally.
    const calledUrls = fetchSpy.mock.calls.map(([input]) => String(input));
    expect(calledUrls.every((url) => !url.includes("logout?scope=global"))).toBe(true);
    expect(await readToken(adminTab)).toBeNull();
    expect(await readToken(affiliateTab)).toBe("access-affiliate-user");

    vi.unstubAllGlobals();
  });

  it("a duplicated tab starts with the session copied, a brand-new tab starts signed out", async () => {
    const original = storage();
    original.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionFor("admin-user", "7809tom@gmail.com", "admin")));

    // "Duplicate tab" copies sessionStorage into the new tab.
    const duplicateStore = storage(Object.fromEntries(original.values));
    // A brand-new tab gets an empty store.
    const brandNewStore = storage();

    const duplicate = createTab(AUTH_STORAGE_KEY, duplicateStore);
    const brandNew = createTab(AUTH_STORAGE_KEY, brandNewStore);
    clients.push(duplicate, brandNew);

    expect(await readToken(duplicate)).toBe("access-admin-user");
    expect(await readToken(brandNew)).toBeNull();
  });
});

describe("cross-tab broadcast is not relaying auth events", () => {
  it("closes the BroadcastChannel the library opens on the storage key", async () => {
    const store = storage();
    const withChannel = createTab(AUTH_STORAGE_KEY, store);
    clients.push(withChannel);

    const channel = (withChannel.auth as unknown as { broadcastChannel: BroadcastChannel | null }).broadcastChannel;
    expect(channel).toBeNull();
  });

  it("still notifies this tab's own listeners when the session changes", async () => {
    // setSession validates the JWT shape, so the token needs a readable payload.
    const payload = {
      sub: "admin-user",
      email: "7809tom@gmail.com",
      aud: "authenticated",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const encode = (value: object) =>
      btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.c2lnbmF0dXJl`;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ id: "admin-user", aud: "authenticated", email: payload.email }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const store = storage();
    const tab = createTab(AUTH_STORAGE_KEY, store);
    clients.push(tab);

    const events: string[] = [];
    const { data } = tab.auth.onAuthStateChange((event) => {
      events.push(event);
    });

    const { error } = await tab.auth.setSession({ access_token: accessToken, refresh_token: "refresh-admin-user" });

    expect(error).toBeNull();
    expect(events).toContain("SIGNED_IN");
    expect(await readToken(tab)).toBe(accessToken);
    data.subscription.unsubscribe();
    vi.unstubAllGlobals();
  });
});

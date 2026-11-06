/**
 * Per-tab sign-in, end to end in a real browser.
 *
 * The bug: Tom (admin) had one tab open under the 'firstclassfcd' affiliate
 * account, and his admin tab came up as that affiliate. Root cause was the
 * supabase-js default auth store — `localStorage` under one key, shared by every
 * tab of the origin, plus a `BroadcastChannel` that replayed auth events between
 * tabs.
 *
 * This drives the **real application** (real `useAuth`, real tRPC client, real
 * request headers, real `/signin` form) with the API and the Supabase auth
 * endpoint mocked. The API mock is strict about the one thing under test:
 * `auth.me` resolves the caller from `Authorization: Bearer` and nothing else,
 * exactly like `cabinet-backend`.
 *
 * The app is served by the Vite dev server; see the header of perTabTestApp below.
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { accountIdFromToken, mockApi, mockSupabaseAuth } from "../client/src/testing/perTabApi";

const ADMIN = { email: "7809tom@gmail.com", password: "test-password", id: "admin-tom" };
const AFFILIATE = { email: "fcd@firstclass.example", password: "test-password", id: "affiliate-fcd" };

/** The Supabase storage key this app pins; a tab's session lives under it. */
const SESSION_KEY = "cabinetdealz.auth.session.v1";
/**
 * The key the default supabase-js client would use (the pre-fix behaviour).
 * Read only so the test can prove the session is *not* kept there.
 */
const SHARED_KEY = "sb-test-auth-token";

function subFromRawSession(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as { access_token?: string };
    const parts = (session.access_token ?? "").split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

function accountIdForEmail(email: string): string | null {
  if (email === ADMIN.email) return ADMIN.id;
  if (email === AFFILIATE.email) return AFFILIATE.id;
  return null;
}

/**
 * Who this tab shows as signed in, read from the store the app actually uses:
 * this tab's `sessionStorage` first, then `localStorage`.
 *
 * Reading both is deliberate. With the fix, only `sessionStorage` has a record,
 * so this is the tab's own person. With the pre-fix shared `localStorage`
 * record, this returns whichever account was written last — which is exactly the
 * leak the test must catch, instead of failing earlier for a boring reason.
 *
 * Returns null while the page is navigating, so it can be polled.
 */
async function storedAccountId(page: Page): Promise<string | null> {
  try {
    return await page.evaluate(
      ([sessionKey, sharedKey]) =>
        (() => {
          const parse = (raw: string | null) => {
            if (!raw) return null;
            try {
              const session = JSON.parse(raw) as { access_token?: string };
              const parts = (session.access_token ?? "").split(".");
              if (parts.length !== 3) return null;
              const payload = JSON.parse(atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string };
              return payload.sub ?? null;
            } catch {
              return null;
            }
          };
          // Any `sb-*-auth-token` key is the shared-record shape.
          const sharedRaw =
            window.localStorage.getItem(sharedKey) ??
            Object.keys(window.localStorage)
              .filter((key) => /^sb-.*-auth-token$/.test(key))
              .map((key) => window.localStorage.getItem(key))
              .find((value) => value !== null) ??
            null;
          return parse(window.sessionStorage.getItem(sessionKey)) ?? parse(sharedRaw);
        })(),
      [SESSION_KEY, SHARED_KEY],
    );
  } catch {
    // Execution context destroyed mid-navigation: report "not known yet".
    return null;
  }
}

/** Whether the tab keeps its session in `sessionStorage` (the fix) and not in `localStorage`. */
async function sessionStorageOnly(page: Page): Promise<{ inSession: boolean; inLocal: boolean }> {
  return page.evaluate(([sessionKey]) => ({
    inSession: window.sessionStorage.getItem(sessionKey) !== null,
    inLocal: Object.keys(window.localStorage).some((key) => /^sb-.*-auth-token$/.test(key)),
  }), [SESSION_KEY]);
}

function jwtFor(accountId: string, email: string): string {
  const b64 = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return [
    b64({ alg: "HS256", typ: "JWT" }),
    b64({ sub: accountId, email, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 }),
    "c2ln",
  ].join(".");
}

/**
 * Answer the Supabase password grant, so submitting the real sign-in form in a
 * tab produces that tab's own session. A tab that asks for a different email
 * gets a different account and a different token.
 */
async function mockPasswordGrant(page: Page) {
  await page.route("**/auth/v1/token?grant_type=password", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as { email?: string; password?: string };
    const accountId = body.email ? accountIdForEmail(body.email) : null;
    if (!accountId || body.password !== "test-password") {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "invalid_grant", error_description: "Invalid login credentials" }),
      });
      return;
    }
    const email = body.email!;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: jwtFor(accountId, email),
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: `test-refresh-token.${accountId}`,
        user: {
          id: `supabase-${accountId}`,
          aud: "authenticated",
          role: "authenticated",
          email,
          app_metadata: { provider: "email" },
          user_metadata: { name: accountId === ADMIN.id ? "Tom (Admin)" : "First Class Affiliate" },
          created_at: "2026-01-01T00:00:00.000Z",
        },
      }),
    });
  });
}

async function prepare(page: Page) {
  // Playwright matches the most recently added route first, so the specific
  // password grant is registered last to win over the generic token route.
  const auth = await mockSupabaseAuth(page);
  const api = await mockApi(page);
  await mockPasswordGrant(page);
  return { ...api, ...auth };
}

/**
 * Wait until this tab has landed on a page under `pathPrefix`.
 *
 * Sign-in redirects through `/signin` → the destination → `?viewAs=`, so this
 * polls `page.url()` instead of waiting for one navigation to finish.
 */
async function waitForPath(page: Page, pathPrefix: RegExp) {
  await expect.poll(() => page.url(), { timeout: 30_000 }).toMatch(pathPrefix);
}
async function submitSignInForm(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/signin");
  await page.getByLabel("Email", { exact: true }).fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  // Scope to the form: the header has its own "Sign In" link to this page.
  await page.locator('form:has(input#login-email)').getByRole("button", { name: "Sign In", exact: true }).click();
}

/** What the header shows for the signed-in person in this tab. */
function headerAccountName(page: Page) {
  return page.getByTestId("site-toolbar-account-name");
}

test.describe("per-tab sign-in", () => {
  // The account name in the header is the `xl:` variant, so use a desktop-width
  // viewport; otherwise the header shows only icons.
  test.use({ viewport: { width: 1440, height: 900 } });

  test("affiliate tab and admin tab keep their own accounts across reloads, and signing out of one leaves the other signed in", async ({ browser }) => {
    test.slow();
    // One context = one browser profile, which is exactly Tom's situation.
    const context: BrowserContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    const affiliateTab = await context.newPage();
    const adminTab = await context.newPage();
    const affiliateApi = await prepare(affiliateTab);
    const adminApi = await prepare(adminTab);

    try {
      // ── Tab A signs in as the 'firstclassfcd' affiliate ───────────────────
      await submitSignInForm(affiliateTab, AFFILIATE);
      await waitForPath(affiliateTab, /\/affiliate/);
      await expect.poll(() => storedAccountId(affiliateTab), {
        message: "the affiliate tab never stored its session",
      }).toBe(AFFILIATE.id);

      // ── Tab B signs in as Tom, the admin, in its own tab ──────────────────
      await submitSignInForm(adminTab, ADMIN);
      await waitForPath(adminTab, /\/admin/);
      await expect.poll(() => storedAccountId(adminTab), {
        message: "the admin tab never stored its session",
      }).toBe(ADMIN.id);

      // The reported bug: signing in on tab B must not turn tab A into Bob.
      await expect.poll(() => storedAccountId(affiliateTab), {
        message: "the admin sign-in leaked into the affiliate tab",
      }).toBe(AFFILIATE.id);

      // Each tab's API calls carry that tab's own token.
      const affiliateTokens = new Set(affiliateApi.tokensSeen.map(accountIdFromToken));
      const adminTokens = new Set(adminApi.tokensSeen.map(accountIdFromToken));
      expect([...affiliateTokens]).toEqual([AFFILIATE.id]);
      expect([...adminTokens]).toEqual([ADMIN.id]);

      // ── Both reload: each keeps its own account ──────────────────────────
      await affiliateTab.reload();
      await adminTab.reload();

      await expect.poll(() => storedAccountId(affiliateTab), {
        message: "the affiliate tab lost its account on reload",
      }).toBe(AFFILIATE.id);
      await expect.poll(() => storedAccountId(adminTab), {
        message: "the admin tab lost its account on reload",
      }).toBe(ADMIN.id);

      // Each tab shows the person it is signed in as. An affiliate owner who
      // opens an unscoped page is sent to their own dashboard by
      // AffiliateOwnerScopeGuard, so /affiliate *is* the affiliate tab's page;
      // the admin tab lands on /admin, whose header names him.
      await expect.poll(() => affiliateTab.url(), {
        message: "the affiliate tab is not on the affiliate dashboard",
      }).toContain("/affiliate");
      await expect(headerAccountName(adminTab)).toHaveText("Tom (Admin)");
      await expect(adminTab.getByTestId("crm-stage-board")).toBeVisible();

      // The session is per tab: kept in this tab's sessionStorage, and never in
      // the origin-wide localStorage record that used to be shared.
      const affiliateStorage = await sessionStorageOnly(affiliateTab);
      const adminStorage = await sessionStorageOnly(adminTab);
      expect(affiliateStorage).toEqual({ inSession: true, inLocal: false });
      expect(adminStorage).toEqual({ inSession: true, inLocal: false });

      // ── Signing out of the affiliate tab (tab A) leaves the admin signed in ─
      // The affiliate shell's own footer menu drives the same logout() hook.
      await affiliateTab.locator('[data-sidebar="footer"] button').first().click();
      await affiliateTab.getByRole("menuitem", { name: "Sign out" }).click();
      await expect.poll(() => storedAccountId(affiliateTab), {
        message: "the affiliate tab did not sign out",
      }).toBeNull();
      await expect.poll(() => storedAccountId(adminTab), {
        message: "signing out of the affiliate tab signed the admin tab out",
      }).toBe(ADMIN.id);

      // The admin tab is untouched: still the admin, still on the admin page.
      await adminTab.reload();
      await expect.poll(() => storedAccountId(adminTab), {
        message: "the admin tab lost its account after the affiliate tab signed out",
      }).toBe(ADMIN.id);
      await expect(headerAccountName(adminTab)).toHaveText("Tom (Admin)");
    } finally {
      await context.close();
    }
  });
});

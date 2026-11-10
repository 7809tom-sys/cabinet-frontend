/**
 * Before/after screenshots of the signed-in header, for the affiliate-button fix.
 *
 * Captures the real TopNav for:
 *   - an admin who is also the affiliate owner  (the reported case)
 *   - an admin with no store
 *   - a plain affiliate partner
 * at desktop and mobile widths, in both the OLD behaviour and the fixed one.
 */
import { test, type Page } from "@playwright/test";
import { mockApi, mockSupabaseAuth } from "../client/src/testing/perTabApi";

const SESSION_KEY = "cabinetdealz.auth.session.v1";

function jwtFor(accountId: string, email: string): string {
  const b64 = (value: object) => btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return [
    b64({ alg: "HS256", typ: "JWT" }),
    b64({ sub: accountId, email, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 }),
    "c2ln",
  ].join(".");
}

async function seedSession(page: Page, accountId: string, email: string) {
  const token = jwtFor(accountId, email);
  const session = {
    access_token: token,
    refresh_token: `test-refresh-token.${accountId}`,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: { id: accountId, email },
  };
  await page.addInitScript(([key, value]) => {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  }, [SESSION_KEY, session] as const);
}

const ACCOUNTS = [
  { key: "admin-affiliate", id: "admin-fcd", email: "admin@firstclass.example", label: "Admin who owns a store" },
  { key: "admin-only", id: "admin-tom", email: "7809tom@gmail.com", label: "Admin, no store" },
  { key: "affiliate", id: "affiliate-fcd", email: "fcd@firstclass.example", label: "Affiliate partner" },
  { key: "regular", id: "regular-customer", email: "customer@example.com", label: "Regular user" },
] as const;

const WIDTHS = [
  { key: "desktop", width: 1512, height: 900 },
  { key: "mobile", width: 390, height: 844 },
] as const;

for (const account of ACCOUNTS) {
  for (const size of WIDTHS) {
    test(`header — ${account.label} — ${size.key}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await mockSupabaseAuth(page);
      await mockApi(page);
      await seedSession(page, account.id, account.email);
      // `/design` renders the real site TopNav as a single compact row, which is
      // the header in the owner's screenshots. It also omits the Admin Edit Mode
      // bar, so the strip captured is the header itself.
      await page.goto("/design");
      // The designer re-renders continuously, which makes a "visible" wait flaky
      // even though the row is present; wait for attachment, then settle.
      await page.waitForSelector('[data-testid="site-toolbar-row"]', { state: "attached", timeout: 45_000 });
      await page.waitForTimeout(2500);

      const variant = process.env.HEADER_VARIANT ?? "after";
      // Screenshot the page and crop to the header strip. Element screenshots wait
      // for the element to stop moving, which never happens on a live re-render.
      const box = await page.evaluate(() => {
        const row = document.querySelector('[data-testid="site-toolbar-row"]');
        if (!row) return null;
        const r = row.getBoundingClientRect();
        const top = Math.round(r.top);
        return { x: 0, y: Math.max(0, top - 2), width: Math.round(window.innerWidth), height: Math.round(r.height) + 4 };
      });
      if (!box) throw new Error("no site toolbar row");
      await page.screenshot({
        path: `${process.env.HEADER_OUT ?? "test-artifacts/header"}/${variant}-${account.key}-${size.key}.png`,
        clip: box,
        animations: "disabled",
        caret: "hide",
        timeout: 60_000,
      });
    });
  }
}

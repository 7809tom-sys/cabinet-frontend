/**
 * What the signed-in header actually shows, per account and per width.
 *
 * Tom reported: "lost the affiliate button". The site header for his admin
 * account shows the language switch, cart, username, Admin, My Account and Sign
 * out — but no Affiliate.
 *
 * This spec drives the real header for an admin who is also a linked affiliate,
 * an admin who is not, and a plain affiliate, at desktop and mobile widths, and
 * records exactly which account-action buttons are visible.
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

/** Put a session for `accountId` into this context before the app boots. */
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
    window.sessionStorage.setItem(key, value);
  }, [SESSION_KEY, JSON.stringify(session)] as const);
}

async function prepare(page: Page) {
  await mockSupabaseAuth(page);
  await mockApi(page);
}

/** Every visible label in the site header's account-actions cluster. */
async function visibleAccountActions(page: Page) {
  return page.evaluate(() => {
    const cluster = document.querySelector('[data-testid="site-toolbar-account-actions"]');
    if (!cluster) return { present: false, labels: [] as string[] };
    // Report EVERY button, with whether the viewport actually shows it. A button
    // can be in the DOM and still be scrolled or clipped out of view, which is a
    // different failure from being conditionally rendered.
    const vw = window.innerWidth;
    const items = Array.from(cluster.querySelectorAll("a, button")).map((node) => {
      const el = node as HTMLElement;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const text = (el.textContent ?? "").trim();
      const displayed = style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      // Visible means: displayed, and its box actually lies inside the viewport.
      const onScreen = displayed && rect.right > 0 && rect.left < vw && rect.bottom > 0 && rect.top < window.innerHeight;
      return { text, displayed, onScreen, left: Math.round(rect.left), right: Math.round(rect.right), top: Math.round(rect.top) };
    });
    const labels = items.filter((i) => i.onScreen).map((i) => i.text).filter(Boolean);
    const offscreen = items.filter((i) => i.displayed && !i.onScreen).map((i) => i.text);
    return { present: true, labels, offscreen, vw };
  });
}

test.describe("signed-in header account actions", () => {
  for (const [label, width, height] of [["desktop", 1512, 950], ["laptop", 1279, 900], ["wide", 1280, 900], ["mobile", 390, 844]] as const) {
    test(`admin who is also a linked affiliate — ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await prepare(page);
      await seedSession(page, "admin-fcd", "admin@firstclass.example");
      await page.goto("/design");
      await page.waitForSelector('[data-testid="site-toolbar-account-actions"], [data-testid="site-toolbar-row"]', { timeout: 30_000 });

      // The toggle is the only button with this aria-label; it is xl:hidden.
      await page.getByRole("button", { name: "Toggle menu" }).click({ timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(500);
      const drawer = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href="/affiliate"]'));
        return links.map((a) => ({ text: (a.textContent ?? "").trim(), visible: (a as HTMLElement).offsetParent !== null }));
      });
      // eslint-disable-next-line no-console
      console.log(`[${label}] affiliate links (drawer):`, JSON.stringify(drawer));
      const actions = await visibleAccountActions(page);
      const headerText = await page.evaluate(() => document.querySelector("header")?.textContent ?? "(no header)");
      // eslint-disable-next-line no-console
      console.log(`[${label}] admin+affiliate header actions:`, JSON.stringify(actions), "| HEADER:", headerText.slice(0, 200));
    });

    test(`admin without an affiliate record — ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await prepare(page);
      await seedSession(page, "admin-tom", "7809tom@gmail.com");
      await page.goto("/design");
      await page.waitForSelector('[data-testid="site-toolbar-account-actions"], [data-testid="site-toolbar-row"]', { timeout: 30_000 });

      const actions = await visibleAccountActions(page);
      // eslint-disable-next-line no-console
      console.log(`[${label}] admin-only header actions:`, JSON.stringify(actions));
    });
  }
});

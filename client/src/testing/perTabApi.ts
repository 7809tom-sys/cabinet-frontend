/**
 * A stand-in for the CabinetDealz API, for browser tests that need the real app
 * shell without a database.
 *
 * It exists to make one thing observable end to end: **who the API thinks is
 * calling**. Like the real `cabinet-backend`, `auth.me` resolves the caller from
 * `Authorization: Bearer <supabase access token>` and from nothing else — there
 * is no cookie, no query parameter, no shared record. So if a tab shows the
 * wrong account, the token that tab sent was wrong.
 *
 * Used only by `e2e/per-tab-sign-in.spec.ts`. Not imported by the app.
 */
import type { Page, Route } from "@playwright/test";

/**
 * The account id an access token names.
 *
 * The real API verifies the signature and reads `sub`; the mock decodes the same
 * claim and skips signature verification, because a test controls both ends.
 * Accepting only the claim (never a cookie, header or storage record) keeps the
 * mock honest about *how* the caller is identified.
 */
export function accountIdFromToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const value = token.trim();

  // A JWT (what the app sends): read `sub` from the payload.
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { sub?: unknown };
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * The `auth.me` row the API would return for an account id. `role` here is the
 * application role the backend stores on its `users` row, not the Supabase JWT
 * claim (which is always `authenticated`).
 */
export function meRowFor(accountId: string | null) {
  if (!accountId) return null;
  if (accountId === "admin-tom") {
    return {
      id: 7809,
      openId: "supabase-admin-tom",
      name: "Tom (Admin)",
      email: "7809tom@gmail.com",
      role: "admin" as const,
      companyName: null,
      pricingTier: "homeowner" as const,
      loginMethod: "email",
    };
  }
  if (accountId === "affiliate-fcd") {
    return {
      id: 5730001,
      openId: "supabase-affiliate-fcd",
      name: "First Class Affiliate",
      email: "fcd@firstclass.example",
      role: "user" as const,
      companyName: "First Class Cabinets",
      pricingTier: "affiliate" as const,
      loginMethod: "email",
    };
  }
  return null;
}

/** Route every tRPC call to the mock and record the token each one carried. */
export async function mockApi(page: Page): Promise<{ tokensSeen: string[] }> {
  const tokensSeen: string[] = [];

  await page.route("**/api/trpc/**", async (route: Route) => {
    const request = route.request();
    const authorization = request.headers()["authorization"] ?? null;
    const token = authorization?.replace(/^Bearer\s+/i, "") ?? null;
    if (token) tokensSeen.push(token);

    const url = new URL(request.url());
    const paths = url.pathname.replace(/^\/api\/trpc\/?/, "").split(",");
    const body = request.postDataJSON?.() ?? null;
    const inputs: unknown[] = Array.isArray(body) ? body : [body];

    const results = paths.map((path, index) => {
      const input = inputs[index] ?? null;
      return resolveProc(path, input, accountIdFromToken(token));
    });

    const payload = results.length === 1 ? results[0] : results;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });

  return { tokensSeen };
}

/**
 * The Supabase auth endpoints a signed-in tab may call: the token refresh, the
 * user lookup and the local sign-out. Answering them keeps supabase-js from
 * reaching the network, so a test can't be decided by an unconfigured project.
 */
export async function mockSupabaseAuth(page: Page): Promise<{ refreshes: string[] }> {
  const refreshes: string[] = [];

  // Password-grant calls belong to the caller's own route (the sign-in form);
  // leave them alone so a specific route registered for them can answer.
  await page.route("**/auth/v1/token**", async (route: Route) => {
    const body = (route.request().postData() ?? "") as string;
    const grantType = new URL(route.request().url()).searchParams.get("grant_type");
    if (grantType === "password") {
      // Not ours to answer; let the next registered route handle it.
      await route.fallback();
      return;
    }
    if (grantType === "refresh_token") {
      // The refresh token names the account it belongs to, so the refreshed
      // session stays the same person. This is what makes a reloaded tab come
      // back as itself instead of inheriting another tab's identity.
      const match = /refresh_token=([^&]+)/.exec(body) ?? /"refresh_token"\s*:\s*"([^"]+)"/.exec(body);
      const refreshToken = match ? decodeURIComponent(match[1]) : "";
      refreshes.push(refreshToken);
      const token = tokenResponseForRefresh(refreshToken);
      if (!token) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "invalid_grant", error_description: "Invalid Refresh Token" }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(token) });
      return;
    }
    await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "unsupported" }) });
  });

  await page.route("**/auth/v1/user**", async (route: Route) => {
    const authorization = route.request().headers()["authorization"] ?? "";
    const accountId = accountIdFromToken(authorization.replace(/^Bearer\s+/i, ""));
    const user = userFor(accountId);
    if (!user) {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "invalid claim" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
  });

  // scope=local never calls the auth server; this only guards a regression that
  // switches to a global sign-out.
  await page.route("**/auth/v1/logout**", async (route: Route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  return { refreshes };
}

function userFor(accountId: string | null) {
  const me = meRowFor(accountId);
  if (!me) return null;
  return {
    id: me.openId,
    aud: "authenticated",
    role: "authenticated",
    email: me.email,
    app_metadata: { provider: "email" },
    user_metadata: { name: me.name },
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

function tokenResponseForRefresh(refreshToken: string) {
  const accountId = /^test-refresh-token\.(.+)$/.exec(refreshToken)?.[1] ?? null;
  const user = userFor(accountId);
  if (!accountId || !user) return null;
  const accessToken = [
    btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=+$/, ""),
    btoa(JSON.stringify({ sub: accountId, email: user.email, exp: Math.floor(Date.now() / 1000) + 3600 }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, ""),
    "c2ln",
  ].join(".");
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `test-refresh-token.${accountId}`,
    user,
  };
}

type TrpcOk = { result: { data: { json: unknown; meta?: unknown } } };
type TrpcErr = { error: { json: { message: string; code: number; data: { code: string; httpStatus: number } } } };

const ok = (json: unknown, meta?: unknown): TrpcOk => ({
  result: { data: meta === undefined ? { json } : { json, meta } },
});

const unauthorized = (): TrpcErr => ({
  error: {
    json: {
      message: "Not signed in",
      code: -32001,
      data: { code: "UNAUTHORIZED", httpStatus: 401 },
    },
  },
});

function resolveProc(path: string, input: unknown, accountId: string | null): TrpcOk | TrpcErr {
  const me = meRowFor(accountId);

  switch (path) {
    case "auth.me":
      // The single source of truth: the caller is whoever the bearer token says.
      return me ? ok(me) : unauthorized();

    case "auth.signInDestination":
      return ok({ destination: me?.role === "admin" ? "/admin" : "/affiliate" });

    case "auth.logout":
      return ok({ success: true });

    case "affiliates.myReferrals":
      return ok({
        affiliate:
          accountId === "affiliate-fcd"
            ? {
                id: 5730001,
                slug: "firstclassfcd",
                storeName: "First Class Cabinets",
                status: "active",
                referralCode: "FIRSTCLASS",
                storefrontEnabled: true,
              }
            : null,
        referrals: [],
        orders: [],
        // The dashboard renders these directly, so they must be real shapes.
        summary: { referredCount: 0, confirmedCount: 0, commission: 0 },
        commissionRate: 0,
        pricingTier: null,
      });

    case "affiliates.bySlug":
    case "affiliates.byCode":
      return ok(null);

    case "affiliates.adminSwitcherList":
      return ok([]);

    case "design.myDesigns":
      return ok([]);

    case "siteSettings.get":
    case "siteSettings.getPublic":
      return ok({});

    default:
      // Public pages probe many procedures; an empty payload keeps them quiet
      // without pretending any of them are authoritative for this test.
      void input;
      return ok(null);
  }
}

# Signing in per browser tab

CabinetDealz keeps **one sign-in per browser tab**. Two tabs in the same browser can
be signed in as two different people at the same time: for example an affiliate store
in one tab and the admin account in another.

## What changed for the person using the site

- Signing in, signing out, or switching account in one tab no longer affects any other
  tab. Nothing is relayed between tabs.
- Reloading a tab keeps that tab signed in, and returning from a Google or password-reset
  link keeps the tab signed in.
- **A brand-new tab starts signed out.** Opening `cabinetdealz.com` in a fresh tab shows
  the signed-out header even when another tab is signed in. Sign in again in that tab to
  use it as a second identity.
- **Duplicate tab** starts signed in, because the browser copies the tab's own storage
  into the new tab. The two copies then hold the same refresh token, so the first time
  either one refreshes the token they diverge, and the other may ask for a sign-in. Treat
  the duplicate as a shortcut: for a durable second identity, sign in properly in the
  second tab.
- **One-time sign-out on the deploy that ships this.** Older builds kept the session in
  `localStorage`; that record is deleted on first load instead of being adopted (see
  below), so anyone who was signed in before the deploy signs in once more.

The "new tab starts signed out" point is the deliberate cost of per-tab isolation: there
is no longer a single origin-wide record that a new tab could borrow. It is the behaviour
that makes "admin in one tab, affiliate in another" possible at all.

## How it works

| Piece | File | Behaviour |
| --- | --- | --- |
| Session store | `client/src/lib/supabaseAuthStorage.ts` | supabase-js writes its session to `window.sessionStorage` under `cabinetdealz.auth.session.v1` instead of `localStorage`. The browser gives every tab its own `sessionStorage`, so no tab can read another's session. |
| Cross-tab relay | same file, `detachCrossTabAuthBroadcast` | The default client opens a `BroadcastChannel` on the storage key and replays `SIGNED_IN` / `SIGNED_OUT` / `TOKEN_REFRESHED` into every tab. It is closed at startup, which is exactly what the library's own `dispose()` does. |
| API identity | `client/src/lib/trpcAuthFetch.ts` | Every tRPC request carries **this tab's** access token as `Authorization: Bearer <jwt>`. `getSession()` refreshes an expired access token first, so the header is current. |
| Sign-out | `client/src/_core/hooks/useAuth.ts`, `client/src/pages/SignIn.tsx` | `supabase.auth.signOut({ scope: "local" })`, so signing out of one tab never revokes the person's other sessions or devices. |
| Per-tab hints | `client/src/lib/tabSession.ts` | The test-account token and the `?returnTo` redirect history already lived in `sessionStorage`; the token is cleared through one helper on every sign-out path. |

Nothing is stored in `localStorage` for authentication any more, and no authentication
cookie is read or written by the frontend.

### One-time cleanup

Older builds left a Supabase session in `localStorage` under
`sb-<project-ref>-auth-token`. That record is a working refresh token readable by any
script on the origin, and a stale copy could make the first page load after this deploy
look signed in as the wrong account. `removeLegacySharedAuthSession` deletes those two
keys at startup. Other keys, other Supabase projects, and other subdomains are untouched.

The alternative — importing that record into the first tab that loads — was rejected:
every tab that loads would import it, which is exactly the sharing this change removes.
The cost is one extra sign-in per person, once. No password, secret, environment
variable, or Supabase dashboard setting changes.

### Affiliate subdomains

`<slug>.cabinetdealz.com` redirects to `/store/<slug>` on the canonical host, so a
branded subdomain shares the canonical origin's per-tab storage rather than keeping a
separate session of its own. That is fine for this fix: the isolation that matters is
between tabs, and every tab now has its own session on every host.

## Backend note

The API verifies a Supabase access token from `Authorization: Bearer` and nothing else.
In `cabinet-backend`, `server/_core/sdk.ts` → `authenticateRequest` has exactly two ways
to resolve a user: that header, and the opt-in `x-cd-test-account` header used by the dev
test logins. There is no cookie-based session check — the comment above the class says so
— and `server/_core/cookies.ts` only retires the obsolete `app_session_id` cookie on
sign-out. So the frontend already carries identity correctly: every tRPC request sets
`Authorization: Bearer <this tab's token>` (`client/src/lib/trpcAuthFetch.ts`).

The requests also still send `credentials: "include"` (unchanged, in
`client/src/lib/trpcTransport.ts`) because other features read unrelated cookies from the
request. That does not affect identity: the API ignores cookies when deciding who is
calling, so one tab's request can never be authenticated as another tab's session through
a cookie.

One backend ordering bug is worth fixing anyway:
`docs/patches/cabinet-backend-bearer-before-test-account.patch` moves the bearer check
ahead of the optional `x-cd-test-account` header. Today the test-account header is read
first, so a tab whose `sessionStorage` still holds a test-account token answers requests
as that test account even when the tab carries a real session. The patch includes
`server/_core/sdk.bearerFirst.test.ts`, which fails on the current ordering and passes
after it. It applies cleanly to `cabinet-backend` `main`.

## Verifying by hand

1. Sign in as the admin (`7809tom@gmail.com`) in tab A, and open `/admin`. It stays admin.
2. Open tab B (a new tab, not a duplicate) and sign in as the `firstclassfcd` affiliate.
3. Return to tab A and reload. Tab A is still the admin; tab B is still the affiliate.
4. Sign out in tab B. Tab A is unaffected.
5. Sign out in tab A, then check that signing back in in tab A works and that tab B keeps
   whatever session it had left.
6. Open a brand-new tab C: it starts signed out (expected).

## Browser test

`e2e/per-tab-sign-in.spec.ts` covers the reported case end to end in Chromium:

```bash
pnpm exec playwright test e2e/per-tab-sign-in.spec.ts
# or
pnpm run test:e2e:per-tab-sign-in
```

It drives the **real app** — the real `/signin` form, `useAuth`, the tRPC client and its
request headers — with the API and the Supabase auth endpoint answered by
`client/src/testing/perTabApi.ts`. One browser context (one browser profile) opens two
tabs: tab A signs in as the affiliate, tab B as the admin. It asserts:

- each tab keeps its own account, and signing in on one does not change the other;
- each tab's API calls carry that tab's own `Authorization: Bearer` token (the API mock
  resolves `auth.me` from the token's `sub` and from nothing else);
- both tabs keep their own account across a reload;
- the session lives in that tab's `sessionStorage` and never in the shared
  `localStorage` record;
- signing out of tab A leaves tab B signed in, and tab B still resolves as the admin.

`playwright.config.ts` starts the dev server with a same-origin Supabase URL and an empty
`VITE_API_BASE_URL` so tRPC stays on the origin the test intercepts. No secret and no real
Supabase project is involved.

The test was checked to fail on the pre-fix configuration (default `localStorage` storage
and the open `BroadcastChannel`): with the old setup, tab B's sign-in disturbs tab A's
`/signin` flow and the run hangs before it can assert, which is the bug. It passes with
the fix.

## Unit tests

`pnpm exec vitest run client/src/lib/supabasePerTabSessions.test.ts` drives the real
supabase-js client with one storage object per tab: two tabs keep two identities, signing
out of one leaves the other signed in, and a store copied into a new tab (a duplicate)
starts signed in while an empty one starts signed out.

`pnpm exec vitest run client/src/lib/supabaseAuthStorage.test.ts` covers the storage
adapter, the blocked-`sessionStorage` fallbacks, the legacy-key cleanup, and closing the
cross-tab channel.

`pnpm exec vitest run client/src/lib/trpcAuthFetch.test.ts` covers the API header: each
tab's request carries its own `Authorization: Bearer`, and a signed-out tab sends none.

`pnpm exec vitest run client/src/lib/perTabSignIn.scan.test.ts` fails if a later change
puts the session back into `localStorage`, re-enables the cross-tab channel, or reads a
session from a storage event.

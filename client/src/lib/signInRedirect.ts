export type SignInRedirectRecord = { destination: string; at: number };

export const SIGN_IN_REDIRECT_HISTORY_KEY = "cd.signin.redirectHistory";
/** How long a previous hop counts when deciding that an automatic redirect is looping. */
export const SIGN_IN_REDIRECT_LOOP_WINDOW_MS = 60_000;

export type SignInNavigationInput = {
  role: string | null | undefined;
  /** Safe returnTo from the sign-in URL, or null. */
  requestedReturn: string | null;
  /** Path chosen by auth.signInDestination. */
  serverDestination: string;
  /** True when an existing session is sending the browser onward without a new sign-in. */
  automatic: boolean;
  history: SignInRedirectRecord[];
  now: number;
};

export type SignInNavigationDecision = {
  /** Null means stay on the sign-in page. */
  destination: string | null;
  history: SignInRedirectRecord[];
};

/** Admin asked to come back to the admin area, including a tab or nested admin route. */
export function isAdminReturnPath(value: string | null | undefined): boolean {
  const pathname = pathnameOf(value);
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * Admins who asked for /admin always get that path, even when the server still
 * points an affiliate record on the same email at the affiliate portal.
 * Everyone else follows the server destination.
 */
export function resolveSignInDestination(input: Pick<SignInNavigationInput, "role" | "requestedReturn" | "serverDestination">): string {
  if (input.role === "admin" && input.requestedReturn && isAdminReturnPath(input.requestedReturn)) {
    return input.requestedReturn;
  }
  return input.serverDestination;
}

/**
 * Decide where a completed sign-in goes.
 *
 * A password or Google sign-in always navigates once. An automatic redirect
 * (the sign-in page noticed a session that was already there) will not repeat
 * a hop to the same path inside the loop window. That is the bounce where
 * /affiliate sends the browser back to /signin and the existing session
 * immediately sends it to /affiliate again.
 */
export function decideSignInNavigation(input: SignInNavigationInput): SignInNavigationDecision {
  const destination = resolveSignInDestination(input);
  const recent = recentHistory(input.history, input.now);
  if (!isNavigableDestination(destination)) {
    return { destination: null, history: recent };
  }
  const normalized = normalizeRedirectPath(destination);
  if (input.automatic && repeatsPath(recent, normalized)) {
    return { destination: null, history: recent };
  }
  return {
    destination,
    history: [...recent, { destination: normalized, at: input.now }],
  };
}

export function loadSignInRedirectHistory(storage: Pick<Storage, "getItem">, now: number): SignInRedirectRecord[] {
  try {
    const raw = storage.getItem(SIGN_IN_REDIRECT_HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return recentHistory(
      parsed.filter(isRedirectRecord),
      now,
    );
  } catch {
    return [];
  }
}

export function saveSignInRedirectHistory(storage: Pick<Storage, "setItem">, history: SignInRedirectRecord[]): void {
  storage.setItem(SIGN_IN_REDIRECT_HISTORY_KEY, JSON.stringify(history));
}

function isRedirectRecord(value: unknown): value is SignInRedirectRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as { destination?: unknown; at?: unknown };
  return typeof record.destination === "string" && typeof record.at === "number" && Number.isFinite(record.at);
}

function recentHistory(history: SignInRedirectRecord[], now: number): SignInRedirectRecord[] {
  return history.filter((entry) => now - entry.at >= 0 && now - entry.at < SIGN_IN_REDIRECT_LOOP_WINDOW_MS);
}

function repeatsPath(history: SignInRedirectRecord[], destination: string): boolean {
  const path = pathnameOf(destination);
  return history.some((entry) => pathnameOf(entry.destination) === path);
}

function isNavigableDestination(destination: string): boolean {
  const pathname = pathnameOf(destination);
  return pathname.startsWith("/") && pathname !== "/signin" && !pathname.startsWith("/signin/");
}

/** Path plus query, ignoring a hash and a trailing slash on the pathname. */
export function normalizeRedirectPath(value: string): string {
  const withoutHash = value.split("#")[0] ?? "";
  const [rawPath, query] = withoutHash.split("?");
  const path = (rawPath || "/").replace(/\/+$/, "") || "/";
  return query ? `${path}?${query}` : path;
}

function pathnameOf(value: string | null | undefined): string {
  if (!value) return "";
  return normalizeRedirectPath(value).split("?")[0] ?? "";
}

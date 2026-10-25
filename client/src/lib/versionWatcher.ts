// versionWatcher.ts
//
// Detects when a newer build of the app has been deployed and gently prompts
// the user to refresh, so nobody gets stuck on a stale, cached version of the
// site. The frontend build writes /version.json (e.g. { "version": "9f2b7673" });
// it changes only when a new frontend build is deployed.
//
// Design goals:
// - Make a new build visible immediately, including while a Designer panel or
//   dialog is open; the user remains in control of when to refresh.
// - Be resilient: if the endpoint returns HTML (some hosts serve the SPA shell
//   for unknown paths) or fails, do nothing.
// - Cheap: a tiny no-store fetch on an interval + when the tab regains focus.

export type VersionInfo = { version?: string; timestamp?: number };

const VERSION_URL = "/version.json";
// How often to check while the tab is visible.
const POLL_MS = 5 * 60 * 1000; // 5 minutes

let bootVersion: string | null = null;
let started = false;
let notified = false;
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Fetch the current deployed build stamp. Returns null on any failure or when
 * the response is not the expected JSON shape (e.g. an HTML fallback page).
 */
export async function fetchDeployedVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    // Guard against hosts that return the SPA HTML shell for unknown paths.
    if (!ct.includes("application/json") && !ct.includes("text/json")) {
      // Try to parse anyway, but bail if it looks like HTML.
      const text = await res.text();
      const trimmed = text.trim();
      if (trimmed.startsWith("<")) return null;
      try {
        const data = JSON.parse(trimmed) as VersionInfo;
        return typeof data.version === "string" ? data.version : null;
      } catch {
        return null;
      }
    }
    const data = (await res.json()) as VersionInfo;
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

type NotifyFn = (opts: { onReload: () => void }) => void;

let notifyFn: NotifyFn | null = null;

/**
 * Allow the app to provide a custom UI (e.g. a toast). If none is provided we
 * fall back to a minimal, dependency-free banner.
 */
export function setVersionNotifier(fn: NotifyFn) {
  notifyFn = fn;
}

function doReload() {
  // Navigate to the same route with a one-time cache-busting marker. This gives
  // the browser a fresh HTML document request, so its hashed script references
  // come from the newly deployed build even when the current Designer tab has
  // been open for a long time.
  const target = new URL(window.location.href);
  target.searchParams.set("__cd_refresh", String(Date.now()));
  window.location.replace(target.toString());
}

function fallbackBanner(onReload: () => void) {
  if (document.getElementById("cd-version-banner")) return;
  const bar = document.createElement("div");
  bar.id = "cd-version-banner";
  bar.setAttribute("role", "alert");
  bar.setAttribute("aria-live", "assertive");
  bar.style.cssText = [
    "position:fixed",
    "left:50%",
    "top:max(16px, env(safe-area-inset-top))",
    "transform:translateX(-50%) translateY(8px)",
    "z-index:2147483647",
    "display:flex",
    "align-items:center",
    "gap:12px",
    "max-width:calc(100vw - 24px)",
    "padding:12px 16px",
    "border-radius:12px",
    "background:#101828",
    "color:#fff",
    "font:500 14px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
    "box-shadow:0 10px 25px -5px rgba(0,0,0,.35),0 8px 10px -6px rgba(0,0,0,.25)",
    "opacity:0",
    "transition:opacity .2s cubic-bezier(.23,1,.32,1),transform .2s cubic-bezier(.23,1,.32,1)",
  ].join(";");

  const text = document.createElement("span");
  text.textContent = "A Cabinet Dealz update is ready.";

  const btn = document.createElement("button");
  btn.textContent = "Refresh";
  btn.style.cssText = [
    "cursor:pointer",
    "border:0",
    "border-radius:8px",
    "padding:8px 14px",
    "background:#f5b301",
    "color:#101828",
    "font:600 14px/1 system-ui,sans-serif",
    "transition:transform .16s cubic-bezier(.23,1,.32,1),opacity .16s",
  ].join(";");
  btn.addEventListener("click", onReload);
  btn.addEventListener("pointerdown", () => (btn.style.transform = "scale(0.97)"));
  btn.addEventListener("pointerup", () => (btn.style.transform = "scale(1)"));

  const dismiss = document.createElement("button");
  dismiss.setAttribute("aria-label", "Dismiss");
  dismiss.textContent = "✕";
  dismiss.style.cssText = [
    "cursor:pointer",
    "border:0",
    "background:transparent",
    "color:#98a2b3",
    "font:600 14px/1 system-ui,sans-serif",
    "padding:6px",
  ].join(";");
  dismiss.addEventListener("click", () => bar.remove());

  bar.append(text, btn, dismiss);
  document.body.appendChild(bar);
  // Animate in.
  requestAnimationFrame(() => {
    bar.style.opacity = "1";
    bar.style.transform = "translateX(-50%) translateY(0)";
  });
}

function notifyNewVersion() {
  if (notified) return;
  notified = true;
  const onReload = doReload;
  // A high-z-index DOM banner is the guaranteed delivery mechanism. Sonner
  // toasts can be visually displaced by an existing notification stack or a
  // browser's reduced-motion/extension behavior; this banner remains above
  // every Sheet, Dialog, and Designer canvas until the user refreshes or
  // explicitly dismisses it.
  fallbackBanner(onReload);
  if (notifyFn) {
    notifyFn({ onReload });
  }
}

async function check() {
  if (notified) return;
  const current = await fetchDeployedVersion();
  if (!current) return; // endpoint unavailable or returned HTML — ignore.
  if (bootVersion == null) {
    bootVersion = current;
    return;
  }
  if (current !== bootVersion) {
    // This is a non-blocking prompt, not an automatic reload. It must appear
    // even above an open Designer attribute panel or dialog so the user knows
    // exactly when the latest update is ready to apply.
    notifyNewVersion();
  }
}

/**
 * Start watching for new deployments. Safe to call once at app startup.
 * Pass the build version the app booted with (from import or a global), or let
 * the watcher learn it from the first successful fetch.
 */
export function startVersionWatcher(initialVersion?: string) {
  if (started || typeof window === "undefined") return;
  started = true;
  if (initialVersion) bootVersion = initialVersion;

  // Learn the boot version immediately (no prompt on first read).
  void check();

  timer = setInterval(() => {
    if (document.visibilityState === "visible") void check();
  }, POLL_MS);

  // Re-check when the user returns to the tab — the common "I left it open
  // overnight" case where a deploy happened in between.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void check();
  });
  window.addEventListener("focus", () => void check());
}

export function stopVersionWatcher() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}

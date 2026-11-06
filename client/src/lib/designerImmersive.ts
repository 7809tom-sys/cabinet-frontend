/**
 * Fullscreen ("immersive") canvas mode for the Designer.
 *
 * The owner's request: one small square button on the 3D viewer that hides all
 * four bars — the site header, the page-history row, and the two Designer
 * toolbars (the top designer toolbar and the phone/tablet bottom bar) — so the
 * canvas fills the screen, and toggles back to edit mode exactly as before.
 *
 * Two things must survive that toggle, which is why the rules live here as pure
 * functions instead of inside the page component:
 *
 * 1. The browser Fullscreen API is an ENHANCEMENT. Embedded iframes, iOS Safari
 *    (no `requestFullscreen` on arbitrary elements) and any policy refusal must
 *    leave the layout-only immersive mode working, with an always-visible exit.
 * 2. Leaving immersive mode must restore the exact edit layout, so the flag is
 *    the only state the layout reads — nothing is mutated, re-parented, or
 *    unmounted while the chrome is hidden.
 */

/** Chrome regions hidden while immersive mode is on. */
export const DESIGNER_IMMERSIVE_CHROME = [
  "site-header",
  "history-nav",
  "designer-toolbar",
  "mobile-bottom-bar",
] as const;

export type DesignerImmersiveChrome = (typeof DESIGNER_IMMERSIVE_CHROME)[number];

/** The real Fullscreen API is optional: a missing method is not an error. */
export function canRequestBrowserFullscreen(element: unknown): boolean {
  if (!element || typeof element !== "object") return false;
  const candidate = element as { requestFullscreen?: unknown };
  return typeof candidate.requestFullscreen === "function";
}

/**
 * `document.fullscreenElement` may be absent (older WebKit exposes only
 * `webkitFullscreenElement`), and it is not guaranteed to equal our element when
 * another element owns the fullscreen session. Both are "not ours".
 */
export function browserFullscreenOwnsElement(documentLike: unknown, element: unknown): boolean {
  if (!documentLike || !element) return false;
  const doc = documentLike as { fullscreenElement?: unknown; webkitFullscreenElement?: unknown };
  const owner = doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
  return owner !== null && owner === element;
}

/**
 * The keyboard exit. `Esc` always leaves immersive mode, whether or not the
 * Fullscreen API was used, and modifier chords (Cmd+Esc, Ctrl+Esc) are left to
 * the browser rather than hijacked.
 */
export function immersiveEscapePressed(event: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
} | null | undefined): boolean {
  if (!event || event.key !== "Escape") return false;
  return !event.metaKey && !event.ctrlKey && !event.altKey;
}

/**
 * Whether to ask the browser for a real fullscreen session when entering
 * immersive mode. Only the transition into immersive mode asks; the exit path
 * uses `exitBrowserFullscreen`.
 */
export function shouldRequestBrowserFullscreen(input: {
  entering: boolean;
  element: unknown;
  alreadyOwned: boolean;
}): boolean {
  if (!input.entering || input.alreadyOwned) return false;
  return canRequestBrowserFullscreen(input.element);
}

/**
 * What the layout should do after a `fullscreenchange`. A user pressing Esc (or
 * the browser's own "exit fullscreen" affordance) closes the browser session
 * without touching our flag, which used to strand the user with all chrome
 * hidden and no button to bring it back. Any exit we did not initiate clears
 * immersive mode too.
 */
export function immersiveStateAfterFullscreenChange(input: {
  immersive: boolean;
  element: unknown;
  documentLike: unknown;
}): { keepImmersive: boolean; clearImmersive: boolean } {
  if (!input.immersive) return { keepImmersive: false, clearImmersive: false };
  if (browserFullscreenOwnsElement(input.documentLike, input.element)) {
    return { keepImmersive: true, clearImmersive: false };
  }
  return { keepImmersive: false, clearImmersive: true };
}

/**
 * The accessible label pair for the toggle. The label names the action the
 * press performs, so it is never a state with no verb.
 */
export function immersiveToggleLabel(immersive: boolean): { ariaLabel: string; title: string } {
  return immersive
    ? { ariaLabel: "Exit fullscreen", title: "Exit fullscreen — back to edit mode" }
    : { ariaLabel: "Fullscreen view", title: "Fullscreen view — hide the toolbars" };
}

/**
 * Immersive mode covers the viewport (`fixed inset-0`). The canvas and the
 * floating rails are positioned against this class, so the renderer's
 * ResizeObserver measures the new box. Without it the canvas keeps painting at
 * the pre-toggle size and the picture is clipped or letterboxed.
 */
export const DESIGNER_IMMERSIVE_ROOT_CLASS =
  "designer-immersive-root fixed inset-0 z-50 flex h-[100dvh] w-screen flex-col overflow-hidden bg-background";

/** Applied to the 3D stage inside immersive mode: fills the viewport, keeps its own scroll off. */
export const DESIGNER_IMMERSIVE_CANVAS_CLASS = "flex-1 min-h-0 overflow-hidden";

/**
 * Chrome gets hidden with `hidden` rather than unmounted. Unmounting the site
 * header would remount it (losing any open menu) on exit, and unmounting the
 * designer toolbar would drop popovers and sheets mid-session.
 */
export function designerChromeClass(hidden: boolean, base = ""): string {
  return hidden ? `${base} hidden`.trim() : base;
}

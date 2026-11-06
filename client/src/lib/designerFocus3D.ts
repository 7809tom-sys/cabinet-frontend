/**
 * Focus 3D lets the 3D viewer own the screen: the Designer hides its toolbars,
 * the selected-cabinet bar, and the side panels, and asks the browser for
 * fullscreen so its own chrome goes away too. Nothing about the design, the
 * placement rules, or the camera changes. Every helper degrades to a no-op when
 * the browser has no Fullscreen API (iOS Safari on iPad, embedded webviews).
 */

type RequestableFullscreenElement = Element & {
  requestFullscreen?: () => Promise<void>;
};

export function canRequestDesignerFullscreen(
  target: Element | null | undefined,
): boolean {
  return Boolean(
    target &&
      typeof (target as RequestableFullscreenElement).requestFullscreen ===
        "function",
  );
}

/** Resolves true only when the browser actually entered fullscreen. */
export async function requestDesignerFullscreen(
  target: Element | null | undefined,
): Promise<boolean> {
  if (!canRequestDesignerFullscreen(target)) return false;
  try {
    await (target as RequestableFullscreenElement).requestFullscreen!();
    return true;
  } catch {
    // A denied or unsupported request must never block Focus 3D itself.
    return false;
  }
}

export async function exitDesignerFullscreen(): Promise<void> {
  if (typeof document === "undefined" || !document.fullscreenElement) return;
  const exit = document.exitFullscreen;
  if (typeof exit !== "function") return;
  try {
    await exit.call(document);
  } catch {
    // The browser already left fullscreen; there is nothing left to restore.
  }
}

/** Esc restores the Designer chrome whether or not fullscreen was granted. */
export function isDesignerFocusExitKey(key: string): boolean {
  return key === "Escape" || key === "Esc";
}

/**
 * True when Esc belongs to something else on screen (a dialog, a picker, an
 * input). Focus 3D must not steal those keystrokes.
 */
export function shouldIgnoreFocusExitKey(event: {
  key: string;
  defaultPrevented?: boolean;
  target?: EventTarget | null;
}): boolean {
  if (event.defaultPrevented) return true;
  if (!isDesignerFocusExitKey(event.key)) return true;
  const target = event.target as Element | null;
  if (target && typeof target.closest === "function") {
    if (
      target.closest(
        '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]',
      )
    )
      return true;
  }
  const tag = (target as HTMLElement | null)?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

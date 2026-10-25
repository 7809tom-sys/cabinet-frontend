export type PopupSessionPosition = {
  x: number;
  y: number;
};

// v2 intentionally discards offsets written before abandoned pointer movement
// was guarded. Those old session entries can contain an unintended drifted
// position; new entries are written only by a completed grip drag or nudge.
const STORAGE_PREFIX = "cabinet-dealz:popup-position:v2";

function validPosition(value: unknown): value is PopupSessionPosition {
  return Boolean(
    value
      && typeof value === "object"
      && Number.isFinite((value as PopupSessionPosition).x)
      && Number.isFinite((value as PopupSessionPosition).y),
  );
}

/**
 * Builds a stable, session-only key. A caller-supplied key takes precedence;
 * otherwise we use the rendered popup's explicit test/accessibility identity.
 * The title fallback keeps ordinary DialogContent callers working without any
 * per-dialog wiring.
 */
export function popupSessionPositionKey({
  kind,
  explicitKey,
  testId,
  ariaLabel,
  title,
}: {
  kind: "dialog" | "alert-dialog" | "overlay-dialog";
  explicitKey?: string;
  testId?: string | null;
  ariaLabel?: string | null;
  title?: string | null;
}): string {
  const identity = explicitKey || testId || ariaLabel || title || "unnamed-popup";
  return `${STORAGE_PREFIX}:${kind}:${encodeURIComponent(identity.trim().slice(0, 160))}`;
}

export function readPopupSessionPosition(key: string): PopupSessionPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return validPosition(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writePopupSessionPosition(key: string, position: PopupSessionPosition): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(position));
  } catch {
    // Position memory is a convenience only; private-storage policies must not
    // prevent users from opening or moving a Designer popup.
  }
}

/** Keeps a stored or newly dragged popup reachable after a viewport resize. */
export function clampPopupSessionPosition(
  position: PopupSessionPosition,
  popupWidth: number,
  popupHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  inset = 12,
): PopupSessionPosition {
  const baseLeft = viewportWidth / 2 - popupWidth / 2;
  const baseTop = viewportHeight / 2 - popupHeight / 2;
  return {
    x: Math.min(Math.max(position.x, inset - baseLeft), viewportWidth - inset - popupWidth - baseLeft),
    y: Math.min(Math.max(position.y, inset - baseTop), viewportHeight - inset - popupHeight - baseTop),
  };
}

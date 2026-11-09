/**
 * Short (above-the-worktop) wall cabinets.
 *
 * A 24-inch-or-shorter upper hangs at the range's 72-inch datum or the
 * refrigerator's cap, not in the 54-inch upper run. It is a one-face appliance
 * surround, not a run end: nothing exposes a *side* of it that a finished
 * end panel is meant to cover, and a board cut for a 30-inch upper does not
 * match its elevation band. So no side/end panel is generated beside one of
 * these uppers, and none is billed (Tom, Nov 9 2026, issue 353 outcome 8).
 *
 * Base cabinets, tall boxes and 30-inch-and-taller uppers are unchanged.
 */
export const SHORT_UPPER_MAX_HEIGHT_IN = 24;

/** True for a wall cabinet whose box is 24 inches tall or shorter (W3024, W3018, W3012). */
export function isShortUpperCabinet(item: {
  placement?: string | null;
  height?: number | string | null;
  masterCode?: string | null;
}): boolean {
  if (item.placement !== "wall") return false;
  const height = Number(item.height);
  if (Number.isFinite(height) && height > 0) return height <= SHORT_UPPER_MAX_HEIGHT_IN + 0.01;
  // A placed record without a stored height still names its height in the code:
  // W3024 is 30 wide by 24 tall, W3012 is 30 wide by 12 tall.
  const code = String(item.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = /^W(\d{2})(\d{2})(?:[A-Z]+)?$/.exec(code);
  if (!match) return false;
  const codedHeight = Number(match[2]);
  return codedHeight > 0 && codedHeight <= SHORT_UPPER_MAX_HEIGHT_IN;
}

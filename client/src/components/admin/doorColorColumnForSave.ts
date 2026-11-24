const HEX_TEXT = /^#?[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;

/**
 * The legacy `color` column used to be typed by hand in the Edit Door Style
 * dialog, beside the door style, and often held a hex that duplicated the door
 * color source. That field is gone; the door color source (paint brand, hex or
 * Sherwin-Williams) is the one color of record.
 *
 * A saved color NAME ("Navy Blue") is kept as written. A blank or hex-looking
 * value is the stale duplicate, so it is replaced by the resolved hex, but only
 * when the door color source has a confirmed color. With no confirmed color the
 * saved value is left exactly as it is today.
 */
export function doorColorColumnForSave(input: {
  saved: string | null | undefined;
  confirmedSource: boolean;
  resolvedHex: string | null | undefined;
}): string | null {
  const saved = (input.saved ?? "").trim();
  const resolved = (input.resolvedHex ?? "").trim().toLowerCase();
  if (input.confirmedSource && /^#[0-9a-f]{6}$/.test(resolved) && (!saved || HEX_TEXT.test(saved))) return resolved;
  return saved || null;
}

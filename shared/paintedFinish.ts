/**
 * Paint vs stain, for the surfaces a renderer has to keep flat.
 *
 * Tom's rule (Nov 4 2026): a painted face renders as a solid color. It carries no
 * grain, no photo streaks, and no per-piece wood-grain crop. A stained face keeps
 * its grain. Only an explicit paint marker counts: a `finishCategory` of painted
 * (the value `door_styles.finishCategory` stores) or a wood species / finish that
 * names paint, HDF, or MDF. A record with no finish text at all is not forced
 * solid here, so untouched styles keep the path they render on today.
 */
export type PaintedFinishInput = {
  finishCategory?: string | null;
  woodSpecies?: string | null;
  finish?: string | null;
};

/** True when the style states a painted / HDF / MDF finish. */
export function isPaintedFinish(style: PaintedFinishInput | null | undefined): boolean {
  if (!style) return false;
  const category = (style.finishCategory ?? "").trim().toLowerCase();
  if (category === "painted" || category === "paint") return true;
  const text = `${style.woodSpecies ?? ""} ${style.finish ?? ""}`;
  return /\bpaint(?:ed)?\b|\bhdf\b|\bmdf\b/i.test(text);
}

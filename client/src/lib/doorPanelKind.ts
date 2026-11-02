// Door-panel treatment derived from the door-style family name.
// Kept out of design.ts so storefront swatches and scene photos can use it
// without downloading the kitchen geometry engine on first visit.
export type DoorPanelKind = "shaker" | "slim-shaker" | "raised" | "slab" | "beaded" | "inset" | "double-shaker";

export function doorPanelKind(doorStyle?: string | null): DoorPanelKind {
  const s = (doorStyle ?? "").toLowerCase();
  if (/double/.test(s)) return "double-shaker";
  // Slim / narrow Shaker: a Shaker door built with a narrow ~1/2" rail & stile
  // instead of the standard ~2.25". Detect it before the generic shaker so the
  // swatch can draw the thin frame.
  if (/slim|narrow|thin[ -]?frame|skinny/.test(s) && /shaker/.test(s)) return "slim-shaker";
  if (/slim shaker|narrow shaker/.test(s)) return "slim-shaker";
  // "Flat panel" and "recessed" are a framed shaker, not a slab. Raised phrases
  // are checked before the generic flat/slab words.
  if (/flat[\s-]?panel|\brecessed\b/.test(s)) return "shaker";
  if (/raised|cathedral|\barch(?:ed)?\b|\bogee\b|traditional/.test(s)) return "raised";
  if (/slab|flat|contemporary|euro|modern/.test(s)) return "slab";
  if (/bead/.test(s)) return "beaded";
  if (/inset/.test(s)) return "inset";
  return "shaker";
}

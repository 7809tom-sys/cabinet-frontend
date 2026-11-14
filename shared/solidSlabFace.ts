/**
 * A slab door with a solid colour is a flat surface, not a photo.
 *
 * Tom, Nov 14 2026: "most is a slab door with a solid color" - about the altaeuro
 * Studio Series, whose 49 styles store a style code (ZSA, LCA, SCM) as their colour
 * and mostly describe a slab front in a solid finish.
 *
 * The renderer already has a flat path (`paintedFinish`: a solid of the resolved
 * colour, no door photo, no grain tile). This decides when a slab earns it without
 * anybody writing "paint" in the finish text.
 *
 * Deliberately conservative: a slab that names a WOOD species keeps its grain and
 * renders on the photo path, because a wood-look slab (Torino, Oak Shade) is not a
 * solid colour even when its catalog row carries a hex.
 */
export type SolidSlabInput = {
  /** "slab" | "flat" | "raised" | "glass" from the catalog row. */
  panelConstruction?: string | null;
  /** door_styles.doorShape, which some lines use instead of panelConstruction. */
  doorShape?: string | null;
  /** door_styles.doorStyle ("Slab", "Shaker", ...). */
  doorStyle?: string | null;
  /** The style's resolved colour. Only a real hex counts. */
  color?: string | null;
  finish?: string | null;
  woodSpecies?: string | null;
};

const HEX = /^#[0-9a-f]{6}$/i;

/** Wood names that mean a slab still has grain to show. */
const WOOD_TEXT = /\b(?:oak|hickory|maple|walnut|birch|ash|pine|cherry|alder|beech|rift|quarter(?:ed)?)\b/i;

function isSlab(input: SolidSlabInput): boolean {
  const construction = (input.panelConstruction ?? "").trim().toLowerCase();
  if (construction === "slab") return true;
  if (construction === "raised" || construction === "glass") return false;
  const shape = (input.doorShape ?? "").trim().toLowerCase();
  if (shape.includes("slab")) return true;
  const door = (input.doorStyle ?? "").trim().toLowerCase();
  return door === "slab" || door.includes("slab");
}

/** True when this style is a slab front in a solid colour, so it renders flat. */
export function isSolidSlabFace(input: SolidSlabInput | null | undefined): boolean {
  if (!input) return false;
  if (!isSlab(input)) return false;
  if (!HEX.test((input.color ?? "").trim())) return false;
  return !WOOD_TEXT.test(`${input.woodSpecies ?? ""} ${input.finish ?? ""}`);
}

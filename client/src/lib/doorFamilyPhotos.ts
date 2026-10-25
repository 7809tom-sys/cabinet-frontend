import { doorPanelKind, type DoorPanelKind } from "@/lib/design";

// ─────────────────────────────────────────────────────────────────────────────
// Door-family hero photos
// Photorealistic, watermark-free door-sample photos for the major panel families.
// Hosted on the project CDN (lifecycle-tied URLs). Each of the 61 styles maps to
// the closest family photo for a rich hero visual; the color-accurate SVG swatch
// (DoorStyleSwatch) remains the universal per-style detail/fallback.
// ─────────────────────────────────────────────────────────────────────────────

export interface DoorFamilyLike {
  doorStyle?: string | null;
}

// Compressed webp URLs (preferred for page loads).
const PHOTOS: Record<Exclude<DoorPanelKind, "double-shaker" | "slim-shaker"> | "shaker", string> = {
  shaker:
    "/manus-storage/legacy-cdn/door-shaker-6rdTMsADtNgxjohki84YKU.webp",
  raised:
    "/manus-storage/legacy-cdn/door-raised-oLYqpx7edoxNoN4EWy9xXG.webp",
  slab:
    "/manus-storage/legacy-cdn/door-slab-EPKZonTXAZzp3JdcxzKMQQ.webp",
  beaded:
    "/manus-storage/legacy-cdn/door-beaded-nR3rA7Ru7s5RUiFQZghnDo.webp",
  inset:
    "/manus-storage/legacy-cdn/door-inset-ZhoLPcYFUe6Qtsr2ARk4Jt.webp",
};

/**
 * Returns the CDN photo URL for the door style's panel family, or null when the
 * family has no dedicated photo (caller should fall back to the SVG swatch).
 */
export function doorFamilyPhoto(style: DoorFamilyLike): string | null {
  const kind = doorPanelKind(style.doorStyle);
  if (kind === "double-shaker" || kind === "slim-shaker") return PHOTOS.shaker;
  return PHOTOS[kind] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Full-kitchen lifestyle "room scene" photos
// We sell the dream kitchen, not a door. These are photorealistic full-room
// scenes (island, pendants, styled counters) modeled on leading RTA retailers
// (Lily Ann Cabinets, The RTA Store). Each style resolves to the scene that best
// matches BOTH its door-panel family and its finish/color so the hero feels like
// the finished kitchen a buyer is imagining.
// ─────────────────────────────────────────────────────────────────────────────

const CDN =
  "/manus-storage/legacy-cdn";

export type KitchenSceneKey =
  | "shaker-white"
  | "shaker-gray"
  | "shaker-espresso"
  | "raised-cherry"
  | "slab-natural";

// Compressed webp scenes (preferred for page loads).
export const KITCHEN_SCENES: Record<KitchenSceneKey, string> = {
  "shaker-white": `${CDN}/kitchen-scene-shaker-white-mgJd4qiCHQceFDfcnPxSBB.webp`,
  "shaker-gray": `${CDN}/kitchen-scene-shaker-gray-2efULLS7TtDdQkBp5AHFZK.webp`,
  "shaker-espresso": `${CDN}/kitchen-scene-shaker-espresso-oPGA9oBZCRb9ai3ZyVy7ub.webp`,
  "raised-cherry": `${CDN}/kitchen-scene-raised-cherry-T3vA5stdneXhkTbrScSj4d.webp`,
  "slab-natural": `${CDN}/kitchen-scene-slab-natural-emxM5j6qArSi4VUE44mnqN.webp`,
};

// A coarse finish bucket derived from the style code/name keywords. Mirrors the
// finishColors() keyword groups in design.ts but collapsed to the buckets we
// have photography for.
type FinishBucket = "white" | "gray" | "dark" | "warmwood" | "lightwood";

// Keyword groups. PAINT COLOR is what the eye reads, so an explicit white /
// off-white paint name MUST win even when the door is built on a wood species
// (e.g. "Maple · SW 7006 Extra White" or "Solid Birch · Snowbound" is a WHITE
// kitchen, not a maple/birch "lightwood" one). Likewise an explicit dark or gray
// PAINT wins over the species. Only when no paint color is named do we fall back
// to the wood-species buckets (warm vs light wood). This ordering is what keeps a
// white cabinet from ever rendering the cherry scene.
const WHITE_RE =
  /\bwhite\b|snow|arctic|alpine|pearl|cream|almond|biscuit|linen|marshmallow|snowbound|alabaster|blanc|chantilly|frost|cotton|ivory|antique white|off[- ]?white/;
const DARK_RE =
  /black|obsidian|onyx|carbon|tricorn|caviar|iron ore|espresso|java|mocha|coffee|chocolate|ebony/;
const GRAY_RE =
  /grey|gray|graphite|pewter|charcoal|slate|fog|grizzle|repose|dovetail|mindful|dorian|gauntlet|navy|blue|indigo|ocean|abyss|cobalt/;
const WARMWOOD_RE =
  /cherry|mahogany|chestnut|cinnamon|spice|saddle|rust|autumn|toffee|amber|nutmeg|ginger/;
const LIGHTWOOD_RE =
  /oak|honey|natural|maple|birch|wheat|blonde|gold|hickory|shade|solstice/;

function finishBucket(doorStyle?: string | null): FinishBucket {
  const s = (doorStyle ?? "").toLowerCase();
  // 1) Explicit PAINT colors win over wood species, in this priority:
  //    white → dark → gray. (A door is rarely two paint colors; if it somehow
  //    names both, the lighter/cleaner read is the safer hero.)
  if (WHITE_RE.test(s)) return "white";
  if (DARK_RE.test(s)) return "dark";
  if (GRAY_RE.test(s)) return "gray";
  // 2) No paint color named → classify by wood species/tone.
  if (WARMWOOD_RE.test(s)) return "warmwood";
  if (LIGHTWOOD_RE.test(s)) return "lightwood";
  // 3) Unknown → clean & bright default (never cherry).
  return "white";
}

/**
 * Resolve the best full-kitchen room scene for a door style, combining its
 * panel family and finish bucket. Always returns a scene URL (never null) so
 * every card/hero gets a lifestyle visual.
 */
export function kitchenSceneFor(style: DoorFamilyLike): string {
  const kind = doorPanelKind(style.doorStyle);
  const finish = finishBucket(style.doorStyle);

  // Slab / contemporary → light natural wood modern scene.
  if (kind === "slab") return KITCHEN_SCENES["slab-natural"];

  // Raised / cathedral → traditional warm cherry scene for warm/wood/dark tones;
  // a raised white/gray kitchen still reads best as the bright shaker rooms.
  if (kind === "raised") {
    if (finish === "white") return KITCHEN_SCENES["shaker-white"];
    if (finish === "gray") return KITCHEN_SCENES["shaker-gray"];
    return KITCHEN_SCENES["raised-cherry"];
  }

  // Shaker / beaded / inset / double-shaker → pick the scene by finish.
  switch (finish) {
    case "gray":
      return KITCHEN_SCENES["shaker-gray"];
    case "dark":
      return KITCHEN_SCENES["shaker-espresso"];
    case "warmwood":
      return KITCHEN_SCENES["raised-cherry"];
    case "lightwood":
      return KITCHEN_SCENES["slab-natural"];
    case "white":
    default:
      return KITCHEN_SCENES["shaker-white"];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dimensional 3D product renders (per generic cabinet item)
// Photorealistic three-quarter-angle studio renders with depth + shadow, modeled
// on leading RTA retailers. Each SKU resolves to the render that best matches its
// CATEGORY (base / wall / tall / vanity / accessory) and FINISH bucket, so a
// shopper sees a real product photo instead of a flat to-scale diagram. The
// to-scale CabinetDrawing remains available as the "Dimensions" view, and the
// SVG swatch stays the universal color-accurate fallback.
// ─────────────────────────────────────────────────────────────────────────────

type ProductCategory = "base" | "wall" | "tall" | "vanity" | "accessory";

// Compressed webp renders (preferred for page loads).
const PRODUCT_PHOTOS: Record<string, string> = {
  // Base — full finish coverage
  "base:white": `${CDN}/prod-base-shaker-white-EQqwnS39T7AsY7XCwYDyPW.webp`,
  "base:gray": `${CDN}/prod-base-shaker-gray-bX7qNBMmZ5Abt4dxXHB5uB.webp`,
  "base:warmwood": `${CDN}/prod-base-cherry-bjnCyF9AS5p9oUeeYQNdaG.webp`,
  "base:dark": `${CDN}/prod-base-espresso-aaMH2vASEjTuRTPUt47Nsg.webp`,
  // Wall — full finish coverage
  "wall:white": `${CDN}/prod-wall-shaker-white-8PsrxeydDBdMRNU88ESQfS.webp`,
  "wall:gray": `${CDN}/prod-wall-shaker-gray-fxt8GwDMwtnxrb9iATKxfe.webp`,
  "wall:warmwood": `${CDN}/prod-wall-cherry-QHvngHNKEsCw3ipTKfDpDe.webp`,
  "wall:dark": `${CDN}/prod-wall-espresso-eVUAMmwcs3LAXnjGHuS6RJ.webp`,
  // Tall — full finish coverage
  "tall:white": `${CDN}/prod-tall-shaker-white-oYxHAbKd3y3ZAZZHoJGdiA.webp`,
  "tall:gray": `${CDN}/prod-tall-gray-WuDVv8ZBNTsQURBP5pBp6Z.webp`,
  "tall:warmwood": `${CDN}/prod-tall-cherry-iCGauxVBC9tTJ4iRMdmcsC.webp`,
  "tall:dark": `${CDN}/prod-tall-espresso-Dqth4GR5YPQeTqsjnzEZC9.webp`,
  // Vanity — full finish coverage
  "vanity:white": `${CDN}/prod-vanity-shaker-white-PYq6TQSEeJfuj7XfG3Beov.webp`,
  "vanity:gray": `${CDN}/prod-vanity-gray-WNCEY5BcdKUp8E2GaNWnLe.webp`,
  "vanity:warmwood": `${CDN}/prod-vanity-cherry-3jcRo9a65MCKreEMFQx7oc.webp`,
  "vanity:dark": `${CDN}/prod-vanity-espresso-Enqw8GFJLk6uNXEpCgvtAy.webp`,
  // Accessory — neutral white + warm wood + dark
  "accessory:white": `${CDN}/prod-accessory-crown-BtKLVqnRs9FvTATNhbPLMq.webp`,
  "accessory:warmwood": `${CDN}/prod-accessory-cherry-F6r5JhLTgBeNtHp3BTqk4M.webp`,
  "accessory:dark": `${CDN}/prod-accessory-espresso-iEP6g93WYBisHc3YBgen6S.webp`,
};

// Map any DB category string to one of our render categories.
function productCategory(category?: string | null): ProductCategory {
  const c = (category ?? "").toLowerCase();
  if (c.includes("wall") || c.includes("upper")) return "wall";
  if (c.includes("tall") || c.includes("pantry") || c.includes("utility")) return "tall";
  if (c.includes("vanity") || c.includes("bath")) return "vanity";
  if (
    c.includes("accessor") ||
    c.includes("molding") ||
    c.includes("moulding") ||
    c.includes("filler") ||
    c.includes("panel") ||
    c.includes("trim") ||
    c.includes("toe") ||
    c.includes("crown")
  )
    return "accessory";
  // base, ada, sink base, drawer base, corner, etc. all read as a base render
  return "base";
}

export interface CabinetProductLike {
  category?: string | null;
  doorStyle?: string | null;
}

/**
 * Resolve the best dimensional 3D product render for a cabinet SKU, combining its
 * category and finish bucket.
 *
 * Returns `null` for the Accessory category (trim & molding, panels, shelves,
 * roll-out trays, drawer/display fronts, inserts, etc.). Those items are too
 * varied for a single glamour render — a generic crown-molding photo on a flat
 * drawer front or a shelf reads wrong — so the caller should fall back to the
 * accurate, item-specific to-scale CabinetDrawing instead.
 *
 * For real cabinet boxes (base / wall / tall / vanity / ada) it always returns a
 * render URL, falling back across finishes within the category, then to white,
 * then to the base white render.
 */
export function cabinetProductPhoto(item: CabinetProductLike): string | null {
  const cat = productCategory(item.category);

  // Accessories are not real cabinet boxes — let the UI use the accurate drawing.
  if (cat === "accessory") return null;

  const finish = finishBucket(item.doorStyle);

  // Preferred: exact category + finish.
  const exact = PRODUCT_PHOTOS[`${cat}:${finish}`];
  if (exact) return exact;

  // Finish fallback chain within the same category (dark→warmwood reads closest).
  const order: FinishBucket[] = ["white", "gray", "warmwood", "dark", "lightwood"];
  for (const f of order) {
    const url = PRODUCT_PHOTOS[`${cat}:${f}`];
    if (url) return url;
  }

  // Category fallback: tall/vanity always have a white render; otherwise base white.
  return PRODUCT_PHOTOS[`${cat}:white`] ?? PRODUCT_PHOTOS["base:white"];
}

// ─────────────────────────────────────────────────────────────────────────────
// Kitchen-scene lead-in copy
// Short, evocative descriptions of the finished kitchen each scene depicts, used
// to lead the buying flow with the "dream kitchen" before the individual item.
// ─────────────────────────────────────────────────────────────────────────────

const SCENE_BLURBS: Record<KitchenSceneKey, { title: string; blurb: string }> = {
  "shaker-white": {
    title: "Bright & Timeless White Shaker Kitchen",
    blurb:
      "Clean white shaker fronts, satin-nickel hardware and an airy, open feel — the most-requested look that brightens any space and never goes out of style.",
  },
  "shaker-gray": {
    title: "Warm Greige Shaker Kitchen",
    blurb:
      "Soft dove-gray shaker cabinetry pairs with natural light for a calm, modern-farmhouse feel that hides everyday wear and complements almost any countertop.",
  },
  "shaker-espresso": {
    title: "Rich Espresso Kitchen",
    blurb:
      "Deep espresso fronts deliver a dramatic, contemporary statement — striking against light counters and stainless appliances.",
  },
  "raised-cherry": {
    title: "Classic Cherry Raised-Panel Kitchen",
    blurb:
      "Warm cherry wood grain and raised-panel doors create a traditional, inviting kitchen with timeless craftsmanship and depth.",
  },
  "slab-natural": {
    title: "Modern Natural-Wood Kitchen",
    blurb:
      "Handle-free natural-wood slab fronts and a minimal profile give a sleek, European-modern look full of warmth.",
  },
};

const SCENE_BY_URL: Record<string, KitchenSceneKey> = Object.fromEntries(
  (Object.keys(KITCHEN_SCENES) as KitchenSceneKey[]).map((k) => [KITCHEN_SCENES[k], k]),
) as Record<string, KitchenSceneKey>;

/**
 * Returns the kitchen-scene image URL plus a short title/blurb describing the
 * finished kitchen, for leading the buying flow. Always returns a value.
 */
export function kitchenSceneWithCopy(style: DoorFamilyLike): {
  image: string;
  title: string;
  blurb: string;
} {
  const image = kitchenSceneFor(style);
  const key = SCENE_BY_URL[image] ?? "shaker-white";
  return { image, ...SCENE_BLURBS[key] };
}


// ─────────────────────────────────────────────────────────────────────────────
// Real-photo guard
// The seed stores per-style image columns as RELATIVE placeholder paths
// (e.g. "/room-scenes/aspen-white-room-scene.jpg") that are NOT actually served
// — they 404. Treat those as "no photo" so the UI falls back to the
// color-accurate DoorStyleSwatch instead of a broken image or a borrowed scene.
//
// A URL is considered a REAL photo only when it is an absolute http(s) URL
// (our CDN) or an inline data URI. Anything else (relative placeholder, empty,
// null) returns null.
// ─────────────────────────────────────────────────────────────────────────────
export function realImageUrl(url?: string | null): string | null {
  if (!url) return null;
  const u = url.trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (/^data:image\//i.test(u)) return u;
  // Accept webdev static storage paths served from the same origin
  if (u.startsWith("/manus-storage/")) return u;
  return null;
}

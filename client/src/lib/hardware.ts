// ─── Cabinet hardware (knobs / pulls) specification engine ──────────────────
// Hardware (knobs, bar pulls, cup pulls) is chosen for a design as a FINISHING
// SPEC, not as a priced catalog SKU. The catalog does not carry decorative
// hardware SKUs, so we never invent a price: the design simply records which
// hardware style the customer wants and how many pieces the layout needs, then
// lists that on the build sheet as a finishing note for the installer/shop.
//
// Counting rule (industry convention):
//   • each DOOR gets 1 knob (or 1 pull, depending on style)
//   • each DRAWER gets 1 pull (cup or bar) — knobs are uncommon on wide drawers
// Open shelving, appliances, panels/skins, and fillers carry no hardware.
//
// All logic is pure/deterministic so it can be unit-tested independently of the
// canvas and the database.

import {
  type PlacedCabinet,
  isPanelItem,
  isLCornerCabinet,
} from "./design";
import { standardBaseDoorCount, standardBaseRenderedCounts } from "@/lib/genericCabinetDrawerReference";
import { isTwentyFourSingleDoorDataError } from "@shared/twentyFourDoorFace";

// True only for the genuine Corner Drawer Base (CDB), which legitimately shows a
// drawer stack. All OTHER L-corner cabinets (easy-reach ERB, lazy-Susan LSB,
// blind BBC) show DOORS, never drawers, in the elevation view.
function isCornerDrawerBase(p: PlacedCabinet): boolean {
  const code = `${p.masterCode ?? ""}`.toUpperCase();
  const desc = `${p.description ?? ""}`.toLowerCase();
  return /^CDB/.test(code) || /corner drawer/.test(desc);
}

// The hardware styles a customer can spec. "none" means no hardware (e.g. a
// touch-latch / push-to-open job) and produces an empty schedule.
export type HardwareStyleId = "none" | "knob" | "bar-pull" | "cup-pull" | "knob-and-pull";

/**
 * Exact Hardware Resources variant selected in the regular Designer. This saved
 * presentation record deliberately has no price, quantity, cart, or shipment
 * fields: the current public retail price is re-read from this immutable product
 * identity when the Designer prepares its materials and cart lines.
 */
export type CatalogHardwareSelection = {
  vendorProductId: number;
  sku: string;
  collection: string;
  productType: string;
  configurationKey: string;
  configurationLabel: string;
  finish: string;
  imageUrl: string | null;
};

/**
 * Regular Designer only. Other renderers retain their own unchanged defaults. This is the style a new design
 * starts with and the fallback an older saved design uses when it has no brand-catalog pick.
 */
export const DEFAULT_DESIGNER_HARDWARE_STYLE_ID: HardwareStyleId = "bar-pull";

/** Cabinet front product types the regular Designer can represent today. */
export function catalogHardwareStyleId(productType: string | null | undefined): HardwareStyleId | null {
  const normalized = (productType ?? "").trim().toLocaleLowerCase();
  if (normalized === "knob" || normalized === "t-knob") return "knob";
  if (normalized === "cup pull") return "cup-pull";
  if (normalized === "pull" || normalized === "bar pull" || normalized === "tab pull") return "bar-pull";
  // Appliance handles are source products, but they are not cabinet-door or
  // drawer hardware. Do not silently apply them to cabinets.
  return null;
}

/**
 * Older saved designs only have a generic `hardwareStyleId` and no brand pick. That id is read back as the fallback
 * style so the 3D, elevation and corner views keep rendering their hardware; the brand picker shows nothing selected
 * until the customer picks one. An unknown or missing id falls back to the Designer default. No data is migrated.
 */
export function savedHardwareFallbackStyleId(saved: unknown): HardwareStyleId {
  return HARDWARE_STYLES.some((style) => style.id === saved) ? saved as HardwareStyleId : DEFAULT_DESIGNER_HARDWARE_STYLE_ID;
}

export function isCatalogCabinetHardwareType(productType: string | null | undefined): boolean {
  return catalogHardwareStyleId(productType) !== null;
}

/**
 * How a published hardware finish should respond in the designer, independent
 * of the cabinet lighting rig. Navy and other very dark stains drop the room's
 * environment intensity to 0.22. A shared high-metalness profile then takes
 * almost all of its color from that dim reflection, so satin nickel and satin
 * bronze both collapse toward black. These responses keep the finish color in
 * the diffuse term. Polished chrome stays shinier than a brushed metal, and
 * matte black stays flat. An unknown future finish uses light satin nickel;
 * no color is inferred from a SKU, title, or product image.
 */
export type CatalogHardwareFinishSurface = {
  color: string;
  roughness: number;
  metalness: number;
  envMapIntensity: number;
  clearcoat: number;
  clearcoatRoughness: number;
};

const HARDWARE_FINISH_RESPONSE = {
  matte: { roughness: 0.78, metalness: 0.05, envMapIntensity: 0.12, clearcoat: 0, clearcoatRoughness: 1 },
  dark: { roughness: 0.52, metalness: 0.26, envMapIntensity: 0.28, clearcoat: 0, clearcoatRoughness: 1 },
  brushed: { roughness: 0.44, metalness: 0.22, envMapIntensity: 0.3, clearcoat: 0, clearcoatRoughness: 1 },
  satin: { roughness: 0.36, metalness: 0.18, envMapIntensity: 0.26, clearcoat: 0, clearcoatRoughness: 1 },
  polished: { roughness: 0.2, metalness: 0.12, envMapIntensity: 0.22, clearcoat: 0, clearcoatRoughness: 1 },
} as const satisfies Record<string, Omit<CatalogHardwareFinishSurface, "color">>;

const PUBLISHED_HARDWARE_FINISHES: Record<string, { color: string; response: keyof typeof HARDWARE_FINISH_RESPONSE }> = {
  "matte black": { color: "#1d2024", response: "matte" },
  "gun metal": { color: "#6a727b", response: "dark" },
  "brushed pewter": { color: "#c5c8c3", response: "brushed" },
  "distressed pewter": { color: "#a3a7a2", response: "brushed" },
  "brushed oil rubbed bronze": { color: "#6b4b38", response: "dark" },
  "oil rubbed bronze": { color: "#5e4030", response: "dark" },
  "satin bronze": { color: "#d7a85c", response: "satin" },
  "brushed gold": { color: "#e2bc62", response: "satin" },
  "polished chrome": { color: "#f4f6f7", response: "polished" },
  chrome: { color: "#f4f6f7", response: "polished" },
  "satin nickel": { color: "#e6e9ec", response: "satin" },
  "brushed nickel": { color: "#d5d9dd", response: "brushed" },
  "polished nickel": { color: "#ece8df", response: "polished" },
};

const DEFAULT_HARDWARE_FINISH = { color: "#d8dce0", response: "satin" as const };

export function catalogHardwareFinishSurface(finish: string | null | undefined): CatalogHardwareFinishSurface {
  const published = PUBLISHED_HARDWARE_FINISHES[(finish ?? "").trim().toLocaleLowerCase()] ?? DEFAULT_HARDWARE_FINISH;
  return { color: published.color, ...HARDWARE_FINISH_RESPONSE[published.response] };
}

/** Swatch and elevation tint for a published hardware finish. */
export function catalogHardwareFinishAccent(finish: string | null | undefined): string {
  return catalogHardwareFinishSurface(finish).color;
}

/** Reject malformed saved browser data before it becomes a visual selection. */
export function normalizeCatalogHardwareSelection(value: unknown): CatalogHardwareSelection | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const vendorProductId = Number(input.vendorProductId);
  const strings = ["sku", "collection", "productType", "configurationKey", "configurationLabel", "finish"] as const;
  if (!Number.isInteger(vendorProductId) || vendorProductId <= 0) return null;
  if (strings.some((key) => typeof input[key] !== "string" || !(input[key] as string).trim())) return null;
  const productType = String(input.productType).trim();
  if (!isCatalogCabinetHardwareType(productType)) return null;
  return {
    vendorProductId,
    sku: String(input.sku).trim(),
    collection: String(input.collection).trim(),
    productType,
    configurationKey: String(input.configurationKey).trim(),
    configurationLabel: String(input.configurationLabel).trim(),
    finish: String(input.finish).trim(),
    imageUrl: typeof input.imageUrl === "string" && input.imageUrl.trim() ? input.imageUrl.trim() : null,
  };
}

export interface HardwareStyle {
  id: HardwareStyleId;
  /** Short label for the picker. */
  label: string;
  /** One-line description for tooltips / build-sheet note. */
  description: string;
  /** Exact catalog/manufacturer swatch or product image when one has been sourced. */
  referenceUrl?: string | null;
  /** What goes on a door front. */
  doorPiece: "knob" | "pull" | "none";
  /** What goes on a drawer front. */
  drawerPiece: "knob" | "pull" | "cup" | "none";
}

export const HARDWARE_STYLES: HardwareStyle[] = [
  {
    id: "none",
    label: "None",
    description: "No decorative hardware (push-to-open / touch latch)",
    doorPiece: "none",
    drawerPiece: "none",
  },
  {
    id: "knob",
    label: "Knobs",
    description: "Round knob on every door and drawer",
    doorPiece: "knob",
    drawerPiece: "knob",
  },
  {
    id: "bar-pull",
    label: "Bar Pulls",
    description: "Modern bar (tube) pull on every door and drawer",
    doorPiece: "pull",
    drawerPiece: "pull",
  },
  {
    id: "cup-pull",
    label: "Cup Pulls",
    description: "Cup (bin) pulls on drawers, knobs on doors (classic mix)",
    doorPiece: "knob",
    drawerPiece: "cup",
  },
  {
    id: "knob-and-pull",
    label: "Knobs + Pulls",
    description: "Knobs on doors, bar pulls on drawers",
    doorPiece: "knob",
    drawerPiece: "pull",
  },
];

export const DEFAULT_HARDWARE_STYLE_ID: HardwareStyleId = "none";

/** Look up a hardware style by id, falling back to the default ("none"). */
export function hardwareStyle(id: HardwareStyleId | null | undefined): HardwareStyle {
  return (
    HARDWARE_STYLES.find((s) => s.id === id) ??
    HARDWARE_STYLES.find((s) => s.id === DEFAULT_HARDWARE_STYLE_ID)!
  );
}

// Cabinets that never carry decorative hardware: appliances, panels/skins, and
// unpriced synthetic items (cabinetId 0 = appliance/fixture).
function carriesHardware(p: PlacedCabinet): boolean {
  if (p.placement === "appliance") return false;
  if (p.cabinetId === 0) return false;
  if (isPanelItem(p)) return false;
  return true;
}

// Fallback only for cabinets that are not exact B## door bases and have no
// stored door count. Exact standard bases use standardBaseDoorCount instead:
// B21 and under is one door, and B24–B30 keep one full-width drawer.
const TWO_DOOR_MIN_WIDTH_IN = 24;

// The cabinet's width in inches: the live width the customer sees, falling back
// to the original catalog (nominal) width for older saved designs.
function cabinetWidthIn(p: PlacedCabinet): number {
  if (typeof p.width === "number" && p.width > 0) return p.width;
  if (typeof p.nominalWidth === "number" && p.nominalWidth > 0) return p.nominalWidth;
  return 0;
}

/**
 * Infer how many DOORS a placed cabinet shows on its front. Trust the stored
 * door count when present; otherwise fall back to the description/code:
 *  • a drawer-only base (DB-*, "drawer base") shows 0 doors
 *  • everything else shows at least 1 door
 */
export function doorCountForCabinet(p: PlacedCabinet): number {
  if (!carriesHardware(p)) return 0;
  // B09–B21 are always one door, even when a catalog row says 2. B24 and wider
  // standard bases are always two doors. A stored count of one door on any other
  // standard 24" cabinet is the same data error and is drawn as two doors.
  const standardDoors = standardBaseDoorCount(p);
  if (standardDoors != null) return standardDoors;
  // A turned bridge is a single-door upper on its side; its placed width is the
  // cabinet's height, so the width rule below would read two doors.
  if (p.turnedSideways === true) return 1;
  // A stored count of exactly one door on a standard 24" cabinet is a data
  // error. Other stored counts (including a real zero) still win.
  if (p.numberOfDoors === 1 && isTwentyFourSingleDoorDataError({
    masterCode: p.masterCode,
    description: p.description,
    width: cabinetWidthIn(p) || p.width,
    category: p.category,
    subCategory: p.subCategory,
    graphicType: p.customProfile,
    cornerType: p.cornerType,
    facePattern: p.facePattern,
    openingType: p.openingType,
    turnedSideways: p.turnedSideways,
    noDoor: p.noDoor,
    isCornerCabinet: p.isCornerCabinet,
  })) return 2;
  if (typeof p.numberOfDoors === "number") return Math.max(0, p.numberOfDoors);
  const hay = `${p.description ?? ""} ${p.masterCode ?? ""}`.toLowerCase();
  if ((/\bdrawer base\b|^db|drawer\b/.test(hay)) && !/door/.test(hay)) return 0;
  // No stored door count: infer by width the way real cabinetry is built. A
  // narrow box (up to ~21" — e.g. P9 through B-21) is a SINGLE door; a wide box
  // (B-24 and up) is a TWO-door cabinet. This applies to bog-standard door
  // bases and door wall cabinets; corners/blinds are handled by their own code.
  if (cabinetWidthIn(p) >= TWO_DOOR_MIN_WIDTH_IN) return 2;
  return 1;
}

/**
 * Infer how many DRAWERS a placed cabinet shows. Trust the stored drawer count
 * when present; otherwise read it from the code suffix (DB-24-3 → 3 drawers) or
 * default to 0 (a plain door base has no drawers in this simplified model — the
 * single top drawer of a standard base is left out unless the code says -N).
 */
export function drawerCountForCabinet(p: PlacedCabinet): number {
  if (!carriesHardware(p)) return 0;
  // Corner cabinets show DOORS, not drawers — the sole exception is the genuine
  // Corner Drawer Base (CDB), which has a real drawer stack.
  if (isLCornerCabinet(p.masterCode, p.description) && !isCornerDrawerBase(p)) return 0;
  if (typeof p.numberOfDrawers === "number") return Math.max(0, p.numberOfDrawers);
  const code = `${p.masterCode ?? ""}`.toUpperCase();
  const hay = `${p.description ?? ""} ${p.masterCode ?? ""}`.toLowerCase();
  // Drawer base codes encode the stack count as a trailing -N (DB-24-3 → 3).
  if (/^db/i.test(code) || /\bdrawer base\b/.test(hay)) {
    const m = code.match(/-(\d+)\s*$/);
    if (m) return Math.max(1, parseInt(m[1], 10));
    return 3; // unspecified drawer base defaults to a 3-drawer stack
  }
  return 0;
}

/**
 * How many drawer fronts to DRAW on a cabinet's face in the elevation view.
 * This is a visual count (not a hardware/pricing count): in addition to the
 * real drawer stack from drawerCountForCabinet, standard floor base cabinets
 * (B-series, sink/door bases) get a single top drawer the way real cabinetry
 * does. Wall cabinets, tall/pantry, drawer bases, and panels are left to the
 * underlying count.
 */
export function displayDrawerCount(p: PlacedCabinet): number {
  // Standard door bases draw the generic catalog top row. numberOfDrawers is
  // not trusted (B30 is stored as 2). A saved drawerLayout still overrides.
  if (standardBaseDoorCount(p) != null) {
    if (!carriesHardware(p)) return 0;
    return standardBaseRenderedCounts({
      masterCode: p.masterCode,
      drawerLayout: p.drawerLayout,
      doors: 0,
      drawers: 0,
    }).drawers;
  }
  const base = drawerCountForCabinet(p);
  if (base > 0) return base;
  if (!carriesHardware(p)) return 0;
  if (p.placement !== "base") return 0;
  const hay = `${p.description ?? ""} ${p.masterCode ?? ""}`.toLowerCase();
  // Skip cabinets that don't have a standard top drawer: corners/lazy susans,
  // trash pullouts, sink bases (false drawer front, but keep as drawer face),
  // and full-height door bases. Most standard bases get one top drawer.
  if (/lazy|susan|\bls\b|corner|blind|\bbwb\b|trash|waste|\bfhd\b|full height|farm|apron/.test(hay)) return 0;
  const doors = doorCountForCabinet(p);
  if (doors <= 0) return 0;
  // Cabinets that are not exact B## door bases still get one top drawer per
  // inferred door. B24–B30 are handled above and keep a single full-width drawer.
  return Math.max(1, doors);
}

export interface HardwarePieceCount {
  /** Round knobs. */
  knobs: number;
  /** Bar / tube pulls. */
  barPulls: number;
  /** Cup (bin) pulls. */
  cupPulls: number;
  /** Total of all pieces. */
  total: number;
}

const EMPTY_COUNT: HardwarePieceCount = { knobs: 0, barPulls: 0, cupPulls: 0, total: 0 };

/**
 * Count the hardware pieces a single placed cabinet needs under a given style.
 * Doors take the style's door piece; drawers take the style's drawer piece.
 */
export function hardwareForCabinet(
  p: PlacedCabinet,
  styleId: HardwareStyleId | null | undefined,
): HardwarePieceCount {
  const style = hardwareStyle(styleId);
  if (style.id === "none") return { ...EMPTY_COUNT };
  if (!carriesHardware(p)) return { ...EMPTY_COUNT };

  const doors = doorCountForCabinet(p);
  const drawers = drawerCountForCabinet(p);

  let knobs = 0;
  let barPulls = 0;
  let cupPulls = 0;

  const add = (piece: HardwareStyle["doorPiece"] | HardwareStyle["drawerPiece"], qty: number) => {
    if (qty <= 0) return;
    if (piece === "knob") knobs += qty;
    else if (piece === "pull") barPulls += qty;
    else if (piece === "cup") cupPulls += qty;
  };

  add(style.doorPiece, doors);
  add(style.drawerPiece, drawers);

  return { knobs, barPulls, cupPulls, total: knobs + barPulls + cupPulls };
}

export interface HardwareSchedule extends HardwarePieceCount {
  styleId: HardwareStyleId;
  styleLabel: string;
  /** How many cabinets contribute at least one piece. */
  cabinetsWithHardware: number;
}

/**
 * Aggregate the whole layout into one hardware schedule (totals by piece type)
 * for the build sheet. Returns a zeroed schedule when the style is "none".
 */
export function hardwareSchedule(
  placed: PlacedCabinet[],
  styleId: HardwareStyleId | null | undefined,
): HardwareSchedule {
  const style = hardwareStyle(styleId);
  let knobs = 0;
  let barPulls = 0;
  let cupPulls = 0;
  let cabinetsWithHardware = 0;

  if (style.id !== "none") {
    for (const p of placed) {
      const c = hardwareForCabinet(p, style.id);
      if (c.total > 0) cabinetsWithHardware += 1;
      knobs += c.knobs;
      barPulls += c.barPulls;
      cupPulls += c.cupPulls;
    }
  }

  return {
    styleId: style.id,
    styleLabel: style.label,
    knobs,
    barPulls,
    cupPulls,
    total: knobs + barPulls + cupPulls,
    cabinetsWithHardware,
  };
}

/**
 * Build a single human-readable build-sheet line for the hardware schedule, or
 * null when there is nothing to list (style "none" or an empty layout). The
 * line is a finishing NOTE — it carries no price because decorative hardware is
 * not a priced catalog SKU.
 */
export function hardwareScheduleNote(schedule: HardwareSchedule): string | null {
  if (schedule.total <= 0) return null;
  const parts: string[] = [];
  if (schedule.knobs > 0) parts.push(`${schedule.knobs} knob${schedule.knobs === 1 ? "" : "s"}`);
  if (schedule.barPulls > 0) parts.push(`${schedule.barPulls} bar pull${schedule.barPulls === 1 ? "" : "s"}`);
  if (schedule.cupPulls > 0) parts.push(`${schedule.cupPulls} cup pull${schedule.cupPulls === 1 ? "" : "s"}`);
  return `Hardware (${schedule.styleLabel}): ${parts.join(", ")} — ${schedule.total} pieces total`;
}

// ─── Hardware placement spec (framed vs slab doors) ──────────────────────
// Where the knob/pull physically sits on a door or drawer face. This drives BOTH
// the AI kitchen-preview rendering prompt (so generated images place hardware
// realistically) and the installer note on the build sheet.
//
// Convention:
//   FRAMED doors (Shaker, Slim Shaker, raised/recessed panel — anything with a
//   stile/rail frame around a center panel):
//     • The pull is vertical on the latch stile, centered in that stile — not
//       on the flat center panel. Two doors meet in the middle, so each pull
//       sits on the inner stile.
//     • BASE doors: the top of the pull is 2.75" below the top of the door.
//     • WALL/UPPER doors: the bottom of the pull is 2.75" above the bottom of
//       the door.
//     • TALL/PANTRY doors: at a comfortable reach near the base-to-wall
//       transition (about 42" off the floor). Stacked leaves meet at that
//       rail instead.
//   SLAB / flat doors (no frame): inset ~1.5" from the latch-side edge and
//     2.75" from the near horizontal edge (top for base, bottom for upper).
//   DRAWERS: pull centered both horizontally and vertically on the drawer face.
// All distances are to the hardware's CENTER POINT unless a clearance is
// measured to the end of the pull.

export type DoorConstruction = "framed" | "slab";

/** Default stile width (inches) used to center hardware on framed doors. */
export const FRAMED_STILE_WIDTH_IN = 3;
/** Centerline of the standard 3-inch framed-door stile, measured from its edge. */
export const FRAMED_STILE_CENTER_IN = FRAMED_STILE_WIDTH_IN / 2;
/** Hardware center offset from the near rail (inches), as a range. */
export const RAIL_OFFSET_MIN_IN = 2.5;
export const RAIL_OFFSET_MAX_IN = 3;

/**
 * Door hardware must always land on a physical framed stile. Older saved plans
 * can contain the retired face-center choice; render those records through the
 * automatic opening-edge rule instead of leaving a pull in the door panel.
 */
export function normalizeDoorHardwareFramePosition(
  position: "auto" | "left" | "center" | "right" | "paired" | "top-center" | null | undefined,
): "auto" | "left" | "right" | "paired" | "top-center" {
  return position === "left" || position === "right" || position === "paired" || position === "top-center" ? position : "auto";
}

/**
 * Horizontal centerline for door hardware, measured from the left edge of one
 * physical door face. Left/right positions are centered on the actual stile;
 * ordinary framed doors retain the default three-inch value.
 * Center is accepted only for backward compatibility with older direct callers;
 * cabinet-door renderers normalize that retired choice to an opening edge.
 */
export function doorHardwareCenterFromLeftIn(
  faceWidthIn: number,
  position: "left" | "center" | "right",
  stileWidthIn: number | null | undefined = FRAMED_STILE_WIDTH_IN,
): number {
  const width = Number.isFinite(faceWidthIn) ? Math.max(0, faceWidthIn) : 0;
  if (position === "center") return width / 2;
  const requestedStile = Number(stileWidthIn);
  const resolvedStile = Number.isFinite(requestedStile) && requestedStile > 0 ? requestedStile : FRAMED_STILE_WIDTH_IN;
  const edgeInset = Math.min(resolvedStile / 2, width / 2);
  return position === "left" ? edgeInset : width - edgeInset;
}

/** Signed horizontal offset from a door face's center, in physical inches. */
export function doorHardwareOffsetFromFaceCenterIn(
  faceWidthIn: number,
  position: "left" | "center" | "right",
  stileWidthIn?: number | null,
): number {
  const width = Number.isFinite(faceWidthIn) ? Math.max(0, faceWidthIn) : 0;
  return doorHardwareCenterFromLeftIn(width, position, stileWidthIn) - width / 2;
}

/**
 * How far a vertical door pull stays off the near horizontal edge, in inches.
 * The same clearance is used at the top of a base door and the bottom of a wall door.
 */
export const DOOR_PULL_EDGE_CLEARANCE_IN = 2.75;
/**
 * Floor height for a full-height tall/pantry door pull. It sits in the open
 * band between the counter (34½") and the usual wall-cabinet bottom (54"),
 * where a standing person can reach it.
 */
export const TALL_DOOR_PULL_FLOOR_HEIGHT_IN = 42;

export type DoorPullVerticalAnchor = "top" | "bottom" | "reach";

/**
 * Signed vertical offset of a door pull's center from the door face center, in inches.
 * Positive is up.
 *
 * "top" — base doors, floor-seated wall cabinets, and the lower leaf of a stacked
 * pantry. The top of the pull is 2.75" below the top of the door.
 * "bottom" — wall doors and the upper leaf of a stacked pantry. The bottom of
 * the pull is 2.75" above the bottom of the door.
 * "reach" — one full-height tall door. The pull center targets 42" off the floor
 * and is clamped so the whole pull stays on the door.
 */
export function doorPullCenterOffsetFromFaceCenterIn(input: {
  faceHeightIn: number;
  pullLengthIn: number;
  anchor: DoorPullVerticalAnchor;
  /** Floor height of this door's center. Used by "reach". */
  doorCenterFloorIn?: number;
  targetFloorIn?: number;
}): number {
  const face = Number.isFinite(input.faceHeightIn) ? Math.max(0, input.faceHeightIn) : 0;
  const requestedLength = Number.isFinite(input.pullLengthIn) ? Math.max(0, input.pullLengthIn) : 0;
  const pull = Math.min(requestedLength, face);
  const clearance = Math.min(DOOR_PULL_EDGE_CLEARANCE_IN, Math.max(0, face - pull));
  const insetToCenter = clearance + pull / 2;
  if (input.anchor === "bottom") return insetToCenter - face / 2;
  if (input.anchor === "reach") {
    const target = input.targetFloorIn ?? TALL_DOOR_PULL_FLOOR_HEIGHT_IN;
    const centerFloor = Number.isFinite(input.doorCenterFloorIn) ? input.doorCenterFloorIn! : target;
    const maxUp = Math.max(0, face / 2 - pull / 2);
    return Math.max(-maxUp, Math.min(maxUp, target - centerFloor));
  }
  return face / 2 - insetToCenter;
}

/**
 * Classify a door style string as framed vs slab. Shaker, slim shaker, and any
 * raised/recessed/panel door is framed; "slab", "flat", or "euro" is slab.
 * Defaults to framed (the most common case in this catalog).
 */
export function doorConstruction(doorStyle: string | null | undefined): DoorConstruction {
  const s = (doorStyle ?? "").toLowerCase();
  if (/\bslab\b|\bflat\b|\beuro\b|full overlay flat/.test(s)) return "slab";
  return "framed";
}

export interface HardwarePlacementSpec {
  construction: DoorConstruction;
  /** Plain-English placement instruction for installers + AI render prompts. */
  doorRule: string;
  drawerRule: string;
}

/**
 * Produce the placement spec for a given door style. Pure + deterministic.
 */
export function hardwarePlacementSpec(
  doorStyle: string | null | undefined,
): HardwarePlacementSpec {
  const construction = doorConstruction(doorStyle);
  const clearance = `${DOOR_PULL_EDGE_CLEARANCE_IN}"`;
  if (construction === "framed") {
    return {
      construction,
      doorRule:
        `Framed door: vertical pull centered on the ~${FRAMED_STILE_WIDTH_IN}" latch-side stile ` +
        `(on the frame, not on the center panel). Two-door cabinets place both pulls on the inner meeting stiles. ` +
        `Base doors: ${clearance} down from the top rail, opposite the hinge. ` +
        `Wall/upper doors: ${clearance} up from the bottom rail, opposite the hinge. ` +
        `Tall/pantry doors: a comfortable height near the base-to-wall transition, opposite the hinge.`,
      drawerRule: "Drawer: pull centered horizontally and vertically on the drawer face.",
    };
  }
  return {
    construction,
    doorRule:
      `Slab door: vertical pull inset ~1.5" from the latch-side edge and ${clearance} from the ` +
      `near horizontal edge (top for base, bottom for upper). Tall doors sit near the base-to-wall transition.`,
    drawerRule: "Drawer: pull centered horizontally and vertically on the drawer face.",
  };
}

/**
 * Build the build-sheet / render-prompt placement note for a layout, given its
 * hardware style and door style. Returns null when there is no hardware (style
 * "none") so callers can skip it.
 */
export function hardwarePlacementNote(
  styleId: HardwareStyleId | null | undefined,
  doorStyle: string | null | undefined,
): string | null {
  const style = hardwareStyle(styleId);
  if (style.id === "none") return null;
  const spec = hardwarePlacementSpec(doorStyle);
  return `Hardware placement — ${spec.doorRule} ${spec.drawerRule}`;
}

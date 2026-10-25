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

export function isCatalogCabinetHardwareType(productType: string | null | undefined): boolean {
  return catalogHardwareStyleId(productType) !== null;
}

/**
 * Map only the supplier's published finish labels to a stable visual metal
 * tone. An unknown future finish safely retains neutral nickel; no color is
 * inferred from a SKU, title, or product image.
 */
export function catalogHardwareFinishAccent(finish: string | null | undefined): string {
  switch ((finish ?? "").trim().toLocaleLowerCase()) {
    case "matte black": return "#1d2024";
    case "gun metal": return "#4d555d";
    case "brushed pewter":
    case "distressed pewter": return "#8b8f8c";
    case "brushed oil rubbed bronze": return "#5b4335";
    case "satin bronze": return "#a9783d";
    case "brushed gold": return "#b08a36";
    case "polished chrome": return "#c9d0d6";
    case "satin nickel": return "#aeb4b9";
    default: return "#b8bbc0";
  }
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

// At/above this width (inches) a standard door cabinet is built with TWO doors
// (and, on a base, two side-by-side top drawers). Below it, one door + one
// full-width top drawer. 24" is the industry break: B-24 up = two doors.
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
  // A standard base gets ONE top drawer per door: a single-door base (≤21")
  // shows one full-width top drawer; a two-door base (B-24, B-30, …) shows two
  // side-by-side top drawers that line up over its two doors.
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
// Convention captured from the shop:
//   FRAMED doors (Shaker, Slim Shaker, raised/recessed panel — anything with a
//   stile/rail frame around a center panel):
//     • Horizontal: center the hardware's center point in the middle of the ~3"
//       vertical stile on the latch (handle) side — NOT on the flat center panel.
//     • Vertical, BASE doors: 2.5–3" UP from the inside edge of the bottom rail.
//     • Vertical, WALL/UPPER doors: 2.5–3" DOWN from the inside edge of the top
//       rail (mirror of the base rule, so pairs read symmetrically across a run).
//   SLAB / flat doors (no frame): inset ~1.5" from the latch-side edge and ~2.5–3"
//     from the near horizontal edge (bottom for base, top for upper).
//   DRAWERS: pull centered both horizontally and vertically on the drawer face.
// All distances are to the hardware's CENTER POINT.

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
  const offset = `${RAIL_OFFSET_MIN_IN}–${RAIL_OFFSET_MAX_IN}"`;
  if (construction === "framed") {
    return {
      construction,
      doorRule:
        `Framed door: center the knob/pull on the ~${FRAMED_STILE_WIDTH_IN}" latch-side stile ` +
        `(centered within the frame, not on the center panel). Base doors: ${offset} up from the ` +
        `bottom rail; wall/upper doors: ${offset} down from the top rail.`,
      drawerRule: "Drawer: pull centered horizontally and vertically on the drawer face.",
    };
  }
  return {
    construction,
    doorRule:
      `Slab door: inset the knob/pull ~1.5" from the latch-side edge and ${offset} from the ` +
      `near horizontal edge (bottom for base, top for upper).`,
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

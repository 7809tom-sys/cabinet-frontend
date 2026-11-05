/**
 * Tall oven / pantry cabinets in the measured Auto-Design build.
 *
 * A line sells its tall boxes as real cabinet records (33" × 90" oven pantry,
 * 30" × 84" double-oven tower, plain pantry, utility tower). Auto-Design never
 * drops one into a run on its own: a tall box replaces a floor-and-upper span,
 * so the person building the kitchen chooses it explicitly in the tall-cabinet
 * pop-up. A pick auto-places it — there is no drag or manual drop step — inside
 * a free span that respects the wall ends, the refrigerator panel limit, the
 * ceiling, and every cabinet already seated.
 *
 * Roll-out trays, valances, moldings, panels, and similar accessories are NOT
 * tall boxes and never appear here; they stay add-on accessory lines.
 */
import { cabinetDrawingType } from "./cabinetGraphics";
import {
  COLLISION_EPSILON_IN,
  STD,
  appendCollisionFreePlacements,
  cabinetWall,
  dim,
  footprintDepth,
  freeSegmentsOnWall,
  isPanelItem,
  isSinkBaseCabinet,
  resolvedDesignCabinetDimensions,
  roomWallRunFrames,
  wallCeilingMin,
  wallRunJoinAt,
  wallPlacementAt,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
  type WallSide,
} from "./design";
import { refrigeratorLimitIn } from "./autoDesignAnchors";
import { boundedWallPlacementAt } from "./designerBounds";

export type AutoDesignTallKind = "oven-pantry" | "pantry" | "utility";

export type AutoDesignTallProduct = {
  id: number;
  /** Display SKU with the distributor's alias suffix removed, e.g. UOC3390(O339024) → UOC3390. */
  masterCode: string;
  /** The catalog row's exact stored code, used when the box is placed. */
  catalogCode: string;
  description: string;
  subCategory: string | null;
  kind: AutoDesignTallKind;
  widthIn: number;
  heightIn: number;
  depthIn: number;
};

export type AutoDesignTallGroup = { kind: AutoDesignTallKind; label: string; products: AutoDesignTallProduct[] };

export const AUTO_DESIGN_TALL_KIND_LABELS: Record<AutoDesignTallKind, string> = {
  "oven-pantry": "Oven pantry / oven tower",
  pantry: "Pantry",
  utility: "Utility / broom tower",
};

/**
 * Distributors store the line's own code with the manufacturer alias in
 * parentheses ("UOC3390(O339024)"). The customer-facing SKU is the first part;
 * the full stored code is kept for placement and pricing.
 */
export function displayTallSku(code: string | null | undefined): string {
  const raw = (code ?? "").trim();
  const beforeAlias = raw.split("(")[0]!.trim();
  return beforeAlias || raw;
}

/**
 * Resolve the tall box picked in the tall pop-up to its catalog row. Matching is
 * by id first, then by the alias-stripped SKU, so a saved pick survives a
 * catalog re-import that keeps the code and changes the id.
 */
export function resolveTallPick(
  catalog: readonly DesignCabinet[],
  pick: { cabinetId: number; masterCode: string },
): DesignCabinet | null {
  const byId = catalog.find((row) => row.id === pick.cabinetId);
  if (byId) return byId;
  const wanted = displayTallSku(pick.masterCode).toUpperCase();
  return catalog.find((row) => row.placement === "tall" && displayTallSku(row.masterCode).toUpperCase() === wanted) ?? null;
}

function normalizedCode(code: string | null | undefined): string {
  return displayTallSku(code).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const OVEN_TALL_CODE = /^(?:UOC|TOS|TOD|O3\d|OVEN)/;
const UTILITY_CODE = /^(?:U[0-9]|UB|UTL|BROOM|TOS2DBID)/;
const NOT_A_TALL_BOX = /filler|panel|skin|moulding|molding|crown|light rail|toe ?kick|valance|roll[- ]?out|tray|shelf|sample|touch.?up/i;

type TallCandidate = DesignCabinet & { placement?: string | null; isNotCabinet?: boolean | null };

/** A real tall cabinet box the Auto-Design pop-up can offer. */
export function isAutoDesignTallBox(row: TallCandidate): boolean {
  if ((row.placement ?? "") !== "tall") return false;
  if (row.isNotCabinet) return false;
  if (isPanelItem(row) || isSinkBaseCabinet(row)) return false;
  const text = `${row.masterCode ?? ""} ${row.description ?? ""} ${row.subCategory ?? ""}`;
  if (NOT_A_TALL_BOX.test(text)) return false;
  if (!hasPositiveMeasures(row)) return false;
  if (!isTallShape(row)) return false;
  return true;
}

function hasPositiveMeasures(row: TallCandidate): boolean {
  const dims = resolvedDesignCabinetDimensions(row);
  return dims.width > 0 && dims.height > 0 && dims.depth > 0;
}

/** An oven/pantry tower, not a 24"-deep base that a distributor filed on the tall tab. */
function isTallShape(row: TallCandidate): boolean {
  const dims = resolvedDesignCabinetDimensions(row);
  if (dims.height < STD.BASE_HEIGHT + 6) return false;
  return true;
}

export function autoDesignTallKind(row: TallCandidate): AutoDesignTallKind {
  const drawingType = cabinetDrawingType(row);
  const code = normalizedCode(row.masterCode);
  const text = `${row.description ?? ""} ${row.subCategory ?? ""}`.toLowerCase();
  if (drawingType === "oven-tall" || OVEN_TALL_CODE.test(code) || /\boven\b/.test(text)) return "oven-pantry";
  if (UTILITY_CODE.test(code) || /utility|broom|cleaning/.test(text)) return "utility";
  return "pantry";
}

/**
 * Every tall box the selected line can place, one entry per catalog row. A row
 * the Designer cannot draw (no width, height, or depth) is left out: there is no
 * box to place, and Auto-Design reports that instead of inventing one.
 */
export function autoDesignTallProducts(catalog: readonly TallCandidate[]): AutoDesignTallProduct[] {
  const seen = new Set<string>();
  const products: AutoDesignTallProduct[] = [];
  for (const row of catalog) {
    if (!isAutoDesignTallBox(row)) continue;
    const dims = resolvedDesignCabinetDimensions(row);
    const catalogCode = (row.masterCode ?? "").trim();
    const key = `${displayTallSku(catalogCode)}|${dims.width}|${dims.height}`;
    if (seen.has(key)) continue;
    seen.add(key);
    products.push({
      id: row.id,
      masterCode: displayTallSku(catalogCode),
      catalogCode,
      description: row.description ?? displayTallSku(catalogCode),
      subCategory: row.subCategory ?? null,
      kind: autoDesignTallKind(row),
      widthIn: dims.width,
      heightIn: dims.height,
      depthIn: dims.depth,
    });
  }
  return products.sort((left, right) =>
    left.kind.localeCompare(right.kind)
    || left.widthIn - right.widthIn
    || left.heightIn - right.heightIn
    || left.masterCode.localeCompare(right.masterCode, undefined, { numeric: true }));
}

export function groupTallProducts(products: readonly AutoDesignTallProduct[]): AutoDesignTallGroup[] {
  const order: AutoDesignTallKind[] = ["oven-pantry", "pantry", "utility"];
  return order.flatMap((kind) => {
    const rows = products.filter((product) => product.kind === kind);
    if (rows.length === 0) return [];
    return [{
      kind,
      label: AUTO_DESIGN_TALL_KIND_LABELS[kind],
      products: [...rows].sort((left, right) => left.widthIn - right.widthIn || left.heightIn - right.heightIn),
    }];
  });
}

export type AutoDesignTallFit =
  | {
    ok: true;
    wallId: string;
    alongIn: number;
    /** "end" when the box closes a run, "start" when it opens one, "free" for a lone span. */
    seat: AutoDesignTallSeat;
    placement: ReturnType<typeof wallPlacementAt> & { wallId?: string; wallOffset?: number };
  }
  | {
    ok: false;
    /** Stable code for the review list and the toast: unavailable vs blocked. */
    code: "tall-cabinet-unavailable" | "tall-cabinet-blocked";
    reason: string;
  };

/**
 * Where a tall box landed in its run. A tall box is a run TERMINATOR: pantry and
 * oven towers sit at the end of a run of lowers and uppers, never in the middle
 * of it with cabinets on both sides.
 */
export type AutoDesignTallSeat = "end" | "start" | "free";

/** Where a tall box would sit relative to the run's ends. */
export type AutoDesignTallCornerCheck =
  | { atInsideCorner: false }
  | {
    atInsideCorner: true;
    /** The adjoining wall that turns into this one. */
    adjoiningWallId: string;
    /** True when the adjoining run already has floor cabinets at that corner. */
    adjoiningRunOccupied: boolean;
  };

/**
 * True when a tall box seated here would stand in an INSIDE CORNER shared with
 * another run. A tall box is a 24-inch-deep full-height body; where two runs meet at
 * an inside corner, the adjoining run's own cabinets occupy that corner square. A
 * pantry parked there reads as wedged into the corner instead of ending a run — the
 * defect the owner reported (screenshot, Nov 5 2026).
 *
 * Two independent signals, because a tall box is seated BEFORE the base runs tile:
 *
 *  - `runWallIds`: the walls this build will fill. A corner shared with one of them
 *    is a corner that is going to be occupied, so a tall must not take it first and
 *    force the corner cabinet somewhere else.
 *  - `placed`: anything already seated on the adjoining wall (a corner cabinet, a
 *    base, a tall) is a hard signal the corner is taken.
 */
export function tallSeatInsideCorner(input: {
  wallId: string;
  alongIn: number;
  widthIn: number;
  room: RoomData;
  placed: readonly PlacedCabinet[];
  runWallIds?: readonly string[];
}): AutoDesignTallCornerCheck {
  const frame = roomWallRunFrames(input.room).find((candidate) => candidate.id === input.wallId);
  if (!frame) return { atInsideCorner: false };
  // Which end of the run is this box touching?
  const touchesStart = Math.abs(input.alongIn - frame.runStart) <= 0.5;
  const touchesEnd = Math.abs(input.alongIn + input.widthIn - frame.runEnd) <= 0.5;
  if (!touchesStart && !touchesEnd) return { atInsideCorner: false };
  const join = wallRunJoinAt(frame, touchesStart ? "start" : "end", input.room);
  if (!join) return { atInsideCorner: false };
  const onPlacedRun = input.placed.some((item) => (
    item.placement !== "appliance"
    && !item.islandFace
    && cabinetWall(item, input.room) === join.frame.id
  ));
  const runWalls = input.runWallIds ?? [];
  const willCarryARun = runWalls.includes(join.frame.id);
  return {
    atInsideCorner: true,
    adjoiningWallId: join.frame.id,
    adjoiningRunOccupied: onPlacedRun || willCarryARun,
  };
}

export type AutoDesignTallFitInput = {
  product: AutoDesignTallProduct;
  room: RoomData;
  placed: readonly PlacedCabinet[];
  openings: readonly WallOpening[];
  /** Walls the measured build owns, in run order. */
  wallIds: readonly string[];
  /**
   * Every wall this build will fill. A corner shared with one of these is going to
   * be occupied, so a tall box must not claim it before the base runs tile.
   * Defaults to `wallIds`.
   */
  runWallIds?: readonly string[];
  /**
   * True when this is one of several tall boxes in the same build. The caller
   * seats them one at a time and re-reads `placed` between calls, so each box
   * still gets a real free span.
   */
  allowMultiple?: boolean;
};

/**
 * Seats one tall box at the END of a run on the kitchen's own walls.
 *
 * Owner rule: a tall cabinet (oven tower, pantry) goes at the end of a run — the
 * end of a wall run, or the end of the free span that closes a run — never in
 * the middle of the first gap that happens to fit. The old behavior measured the
 * first free span and dropped the box at the span's START, so a pantry landed
 * between the corner base and the sink instead of closing the run.
 *
 * Order of preference, per wall (run order), then per free span:
 *   1. the span's far/run END, when the box butts the wall end there;
 *   2. the span's near/run START, when the box butts the wall end there;
 *   3. the span's end, then start, when the box closes an interior gap.
 *
 * Rules kept from the rest of the Designer:
 * - never past a wall end (`boundedWallPlacementAt`),
 * - never across the refrigerator's panel limit,
 * - never through an opening, a corner clearance, or another cabinet,
 * - the box's real height must clear that wall's lowest ceiling,
 * - a range / sink / refrigerator anchor is never moved to make room; the box
 *   is reported as blocked instead.
 */
export function planAutoDesignTallFit(input: AutoDesignTallFitInput): AutoDesignTallFit {
  const { product, room } = input;
  const walls = input.wallIds.length > 0
    ? [...input.wallIds]
    : roomWallRunFrames(room).filter((frame) => frame.kind !== "peninsula").map((frame) => frame.id);
  let ceilingBlocked = false;
  let panelBlocked = false;
  // True when the only run ends left for this box are inside corners another run
  // already occupies. Reported specifically, so a "not placed" tall is explained.
  let insideCornerBlocked = false;
  // Best candidate seen so far, so a blocked span does not hide a later fit.
  let best: { wallId: string; alongIn: number; seat: AutoDesignTallSeat; spot: ReturnType<typeof wallPlacementAt>; score: number } | null = null;
  for (const wallId of walls) {
    const ceiling = wallCeilingMin(room, wallId as WallSide);
    if (Number.isFinite(ceiling) && ceiling > 0 && ceiling + COLLISION_EPSILON_IN < product.heightIn) {
      ceilingBlocked = true;
      continue;
    }
    const frame = roomWallRunFrames(room).find((candidate) => candidate.id === wallId);
    if (!frame) continue;
    const limit = refrigeratorLimitIn({ placed: [...input.placed], room, wallId });
    const segments = freeSegmentsOnWall(
      wallId as WallSide,
      room,
      [...input.placed],
      [...input.openings],
      product.widthIn,
      0,
      "tall",
      false,
      undefined,
      product.depthIn,
    );
    const runStart = frame.runStart;
    const runEnd = frame.runEnd;
    for (const segment of segments) {
      if (segment.length + COLLISION_EPSILON_IN < product.widthIn) continue;
      const spanStart = Math.max(segment.start, runStart);
      const spanEnd = Math.min(segment.start + segment.length, runEnd);
      if (spanEnd - spanStart + COLLISION_EPSILON_IN < product.widthIn) continue;
      // A span that reaches a wall end closes (or opens) the run there; that is
      // where a tall box belongs. An interior span is only a fallback.
      const buttsRunEnd = Math.abs(spanEnd - runEnd) <= COLLISION_EPSILON_IN;
      const buttsRunStart = Math.abs(spanStart - runStart) <= COLLISION_EPSILON_IN;
      // Score a seat by how much it reads as a TRUE END OF THE RUN (owner rule,
      // Nov 5 2026: a pantry closes a run, it does not sit in a corner):
      //   0  a run end that meets no other wall at all — the clearest end of a run
      //   1  a run end whose neighbour is another wall with no kitchen run on it
      //   2  a run end that IS an inside corner shared with another kitchen run
      //   3+ an interior span end (only when no run end is free)
      // An occupied inside corner is pushed to the back so any real run end wins.
      const runEndFrame = frame;
      const joins = {
        start: wallRunJoinAt(runEndFrame, "start", room),
        end: wallRunJoinAt(runEndFrame, "end", room),
      };
      const plannedRunWalls = input.runWallIds ?? input.wallIds;
      const wallHasFloorRun = (wallId: string) => plannedRunWalls.includes(wallId) || input.placed.some((item) => (
        item.placement !== "appliance" && !item.islandFace && cabinetWall(item, room) === wallId
      ));
      const endScore = (at: "start" | "end", base: number) => {
        const join = joins[at];
        if (!join) return base;
        return wallHasFloorRun(join.frame.id) ? base + 2 : base + 1;
      };
      // A run end always beats an interior span, and an unshared run end beats a
      // shared corner. The bands keep those two priorities from interfering.
      const candidates: Array<{ along: number; seat: AutoDesignTallSeat; score: number }> = [];
      if (buttsRunEnd) candidates.push({ along: spanEnd - product.widthIn, seat: "end", score: endScore("end", 0) });
      if (buttsRunStart) candidates.push({ along: spanStart, seat: "start", score: endScore("start", 0) });
      if (!buttsRunEnd) candidates.push({ along: spanEnd - product.widthIn, seat: "free", score: 20 });
      if (!buttsRunStart) candidates.push({ along: spanStart, seat: "free", score: 21 });
      for (const candidate of candidates) {
        const along = roundTallOffset(candidate.along);
        if (along < spanStart - COLLISION_EPSILON_IN || along + product.widthIn > spanEnd + COLLISION_EPSILON_IN) continue;
        // A seat in an occupied inside corner is a last resort; if it is the only
        // option the drop is explained in those terms below.
        const corner = tallSeatInsideCorner({
          wallId,
          alongIn: along,
          widthIn: product.widthIn,
          room,
          placed: input.placed,
          runWallIds: input.runWallIds ?? input.wallIds,
        });
        // An occupied inside corner is pushed behind every unshared run end. It is
        // still usable as a last resort, and flagged so a drop can be explained.
        const cornerPenalty = corner.atInsideCorner && corner.adjoiningRunOccupied ? 10 : 0;
        if (cornerPenalty > 0) insideCornerBlocked = true;
        const score = candidate.score + cornerPenalty;
        if (limit && along < limit.endIn - COLLISION_EPSILON_IN && along + product.widthIn > limit.startIn + COLLISION_EPSILON_IN) {
          panelBlocked = true;
          continue;
        }
        const spot = boundedWallPlacementAt(along, product.widthIn, product.depthIn, wallId, room);
        if (!spot) continue;
        const seatAlong = startOf(spot, along);
        if (limit && seatAlong < limit.endIn - COLLISION_EPSILON_IN && seatAlong + product.widthIn > limit.startIn + COLLISION_EPSILON_IN) {
          panelBlocked = true;
          continue;
        }
        const probe = tallPlacement(product, wallId, spot, seatAlong);
        if (appendCollisionFreePlacements([...input.placed], [probe], room).rejected.length > 0) continue;
        // Keep the best-scoring seat across every candidate: a lower-scoring end can
        // follow a higher-scoring one in this list, so the first accepted candidate
        // is not necessarily the right one.
        if (!best || score < best.score) {
          best = { wallId, alongIn: seatAlong, seat: candidate.seat, spot, score };
        }
      }
    }
  }
  if (best) {
    return { ok: true, wallId: best.wallId, alongIn: best.alongIn, seat: best.seat, placement: best.spot };
  }
  if (ceilingBlocked) {
    return {
      ok: false,
      code: "tall-cabinet-blocked",
      reason: `${product.masterCode} is ${product.heightIn}″ tall and does not clear this room's ceiling on any kitchen wall.`,
    };
  }
  if (panelBlocked) {
    return {
      ok: false,
      code: "tall-cabinet-blocked",
      reason: `No free span wide enough for ${product.masterCode} (${product.widthIn}″) that also stays clear of the refrigerator end panels.`,
    };
  }
  if (insideCornerBlocked) {
    return {
      ok: false,
      code: "tall-cabinet-blocked",
      reason: `The only free ${product.widthIn}″ span for ${product.masterCode} is an inside corner another run already occupies, and a tall box closes a run rather than a shared corner. Shorten a run so a run end is free; nothing was placed.`,
    };
  }
  return {
    ok: false,
    code: "tall-cabinet-blocked",
    reason: `No free ${product.widthIn}″ span on the kitchen walls for ${product.masterCode}. A tall box goes at the end of a run, and no run has a clear end that wide. Shorten a run or remove a cabinet to make room; nothing was placed.`,
  };
}

/** Placement rides the 1/8-inch grid, so a span end is compared on that grid too. */
function roundTallOffset(value: number): number {
  const numeric = Number.isFinite(value) ? value : 0;
  return Math.round(numeric * 8) / 8;
}

function startOf(spot: { wallOffset?: number }, fallback: number): number {
  const offset = Number(spot.wallOffset);
  return Number.isFinite(offset) ? offset : fallback;
}

/** The real placed record for a tall pick; the caller commits it with the run. */
export function tallCabinetPlacement(input: {
  product: AutoDesignTallProduct;
  source: DesignCabinet;
  wallId: string;
  spot: ReturnType<typeof wallPlacementAt>;
  alongIn: number;
  uid: string;
  styleId: number | null;
}): PlacedCabinet {
  const { product, source } = input;
  return {
    uid: input.uid,
    cabinetId: source.id,
    masterCode: source.masterCode,
    description: source.description,
    category: source.category ?? null,
    subCategory: source.subCategory ?? null,
    placement: "tall",
    ...input.spot,
    width: product.widthIn,
    depth: footprintDepth(source) || product.depthIn,
    height: product.heightIn,
    mountBottom: 0,
    catalogImageUrl: source.catalogImageUrl ?? null,
    numberOfDoors: source.numberOfDoors,
    numberOfDrawers: source.numberOfDrawers,
    styleId: input.styleId,
  };
}

function tallPlacement(
  product: AutoDesignTallProduct,
  wallId: string,
  spot: ReturnType<typeof wallPlacementAt>,
  alongIn: number,
): PlacedCabinet {
  return {
    uid: "auto-design-tall-probe",
    cabinetId: product.id,
    masterCode: product.catalogCode,
    description: product.description,
    placement: "tall",
    ...spot,
    width: product.widthIn,
    depth: product.depthIn,
    height: product.heightIn,
    mountBottom: 0,
    wallId: spot.wallId ?? wallId,
    wallOffset: spot.wallOffset ?? alongIn,
  } as PlacedCabinet;
}

/** One appliance the auto-designer can seat at a measured center. */
export type AutoDesignApplianceChoice = {
  /** The appliance palette's master code; the build matches the row by it. */
  masterCode: string;
  /** Palette key, stable per visual even when two rows share a master code. */
  key: string;
  label: string;
  widthIn: number;
  imageUrl?: string | null;
  kind: "range" | "refrigerator" | "dishwasher";
};

/**
 * The range choices the auto-designer offers in a pop-up.
 *
 * `RANGE-30` is the synthetic appliance code the measured build already searches
 * for, so every 30" range visual shares it; the palette key keeps the finishes
 * apart. A 36" and a 42" range carry their own codes because the build seats the
 * measured anchor at the code's width.
 */
export function autoDesignRangeChoices(palette: readonly DesignCabinet[]): AutoDesignApplianceChoice[] {
  const seen = new Set<string>();
  const choices: AutoDesignApplianceChoice[] = [];
  for (const row of palette) {
    const code = (row.masterCode ?? "").toUpperCase();
    if (row.placement !== "appliance") continue;
    // A range proper: the RANGE code the build searches for. Hoods, microwaves,
    // and refrigerators also say "range" in their copy and must stay out.
    if (!/^RANGE-?\d/.test(code)) continue;
    if (/hood|microwave|fridge|refrigerator|dishwasher/i.test(`${code} ${row.description ?? ""}`)) continue;
    const width = Number(row.width);
    if (!Number.isFinite(width) || width <= 0) continue;
    const key = `${code}|${row.description ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    choices.push({
      masterCode: row.masterCode,
      key,
      label: row.description ?? row.masterCode,
      widthIn: width,
      imageUrl: row.catalogImageUrl ?? null,
      kind: "range",
    });
  }
  return choices.sort((left, right) => left.widthIn - right.widthIn || left.label.localeCompare(right.label));
}

/** The range the build seats when nothing was picked: the classic 30-inch row. */
export function defaultAutoDesignRange(choices: readonly AutoDesignApplianceChoice[]): AutoDesignApplianceChoice | null {
  return choices.find((choice) => choice.masterCode === "RANGE-30") ?? choices[0] ?? null;
}

/** Walls the auto-designer owns, in run order: every perimeter wall, never a peninsula. */
export function autoDesignKitchenWallIds(room: RoomData): string[] {
  return roomWallRunFrames(room).filter((frame) => frame.kind !== "peninsula").map((frame) => frame.id);
}

/** True when a placed tall box already occupies the kitchen, so the pop-up stays quiet. */
export function hasPlacedTallCabinet(placed: readonly PlacedCabinet[], room: RoomData): boolean {
  return placed.some((item) => item.placement === "tall" && !isPanelItem(item) && cabinetWall(item, room) != null);
}

/** One-line note used by the pop-up card and the review list. */
export function describeTallProduct(product: AutoDesignTallProduct): string {
  const kind = AUTO_DESIGN_TALL_KIND_LABELS[product.kind];
  return `${product.masterCode} · ${kind} · ${product.widthIn}″ W × ${product.heightIn}″ H`;
}

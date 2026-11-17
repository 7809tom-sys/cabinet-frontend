/**
 * "Is this an ADA kitchen?" (Tom, Nov 17 2026).
 *
 * One checkbox on the Auto Design intake. Off (the default, and every intake
 * saved before the question existed) changes nothing. On, the finished build is
 * walked once, after the uppers, corners and glass stackers are seated:
 *
 *  1. Base cabinets switch to the selected line's own ADA version of the same
 *     width and family (B24 -> B24ADA, 3DB15 -> 3DB15ADA, SB36 -> SB36ADA ...).
 *     Only real catalog rows are used; nothing is invented or renamed. A base the
 *     line has no ADA version of keeps its standard SKU and is named.
 *  2. Counter height: an ADA base is a 32.5 in box, so with a 1.5 in top the
 *     counter is 34 in (the access maximum). Standard bases that stay are named
 *     as 36 in counter.
 *  3. Knee space at the sink: credited only when the line's ADA sink base says
 *     it has a removable front / open knee space. Otherwise it is reported as
 *     not met. The cooktop/prep knee space is reported (Auto Design seats a
 *     freestanding range, so it never builds one).
 *  4. Clearances: 48 in in front of every run (the work aisle), a 60 in turning
 *     circle somewhere on the open floor, and a 30 x 48 in clear floor space at
 *     the sink, range, dishwasher and refrigerator. These are checks only; a
 *     room that cannot meet them is named, never silently changed.
 *
 * Values are the NKBA Access Standard figures (ICC A117.1-2009 based), from
 * /workspace/auto-design/nkba-island-clearances.md: 30 x 48 clear floor,
 * 60 in turning circle, 34 in max counter, 30 in wide x 27 in high knee space.
 */
import type { AutoDesignIntake } from "./autoDesignFifteenRules";
import type { WallLabel } from "./autoDesignAutoBuild";
import type { DesignerReviewFinding } from "./designerReviewFindings";
import { isDishwasherItem } from "./dishwasherPanelRule";
import {
  STD,
  cabinetWall,
  elevationBox,
  isFillerItem,
  isPanelItem,
  isRangeOrOven,
  isRefrigerator,
  isSinkBaseCabinet,
  placedFootprint,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";

export const ADA_WORK_AISLE_MIN_IN = 48;
export const ADA_TURNING_CIRCLE_DIAMETER_IN = 60;
export const ADA_CLEAR_FLOOR_WIDTH_IN = 30;
export const ADA_CLEAR_FLOOR_DEPTH_IN = 48;
export const ADA_COUNTER_MAX_IN = 34;
export const ADA_KNEE_WIDTH_MIN_IN = 30;
export const ADA_KNEE_HEIGHT_MIN_IN = 27;
/** An ADA-height base box: 34 in counter less a 1.5 in top. */
export const ADA_BASE_BOX_HEIGHT_IN = ADA_COUNTER_MAX_IN - STD.COUNTERTOP_THICKNESS;

const ADA_RULE_ID = "auto-design-ada";
const WIDTH_MATCH_IN = 0.05;
const HEIGHT_MATCH_IN = 0.1;

export function isAdaKitchen(intake: AutoDesignIntake | null | undefined): boolean {
  return intake?.ada === true;
}

function normalizedCode(code: string | null | undefined): string {
  return String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** A real catalog row the line sells as an ADA (accessible) kitchen cabinet. Vanity (21 in deep) rows are not kitchen bases. */
export function isAdaCatalogRow(row: Pick<DesignCabinet, "masterCode" | "category" | "subCategory" | "depth" | "id">): boolean {
  if (!(Number(row.id) > 0)) return false;
  const code = normalizedCode(row.masterCode);
  if (!code.includes("ADA")) return false;
  if (num(row.depth, 24) < 23) return false;
  if (/vanity/i.test(`${row.category ?? ""} ${row.subCategory ?? ""}`)) return false;
  return true;
}

/** The ADA row's structural code with the positional ADA marker removed: B18ADA1RS -> B181RS, ADA-SB36R -> SB36R. */
export function adaCoreCode(masterCode: string): string {
  return normalizedCode(masterCode).replace("ADA", "");
}

/** Family stem and width of a base code: 3DB15 -> {stem: "3DB", width: 15, suffix: ""}. */
function codeParts(code: string): { stem: string; width: number; suffix: string } | null {
  const match = normalizedCode(code).match(/^([0-9]?[A-Z]+?)(\d{2})(.*)$/);
  if (!match) return null;
  return { stem: match[1], width: Number(match[2]), suffix: match[3] };
}

export type AdaSwapCandidate = { row: DesignCabinet; exact: boolean };

/**
 * The line's ADA version of one placed standard base: same width, same family.
 * Exact core match first (B24 -> B24ADA, B181RS -> B18ADA1RS), then the same
 * family stem with only an "S" style suffix difference (B30 -> B30SADA).
 */
export function adaVersionOf(
  cabinet: Pick<PlacedCabinet, "masterCode" | "width">,
  adaRows: readonly DesignCabinet[],
): AdaSwapCandidate | null {
  const std = normalizedCode(cabinet.masterCode);
  const width = num(cabinet.width);
  const sameWidth = adaRows.filter((row) => Math.abs(num(row.width) - width) <= WIDTH_MATCH_IN);
  const exact = sameWidth
    .filter((row) => adaCoreCode(row.masterCode) === std)
    .sort((a, b) => normalizedCode(a.masterCode).length - normalizedCode(b.masterCode).length)[0];
  if (exact) return { row: exact, exact: true };
  const parts = codeParts(std);
  if (!parts) return null;
  const stdSuffix = parts.suffix.replace(/^S/, "");
  const close = sameWidth
    .filter((row) => {
      const core = codeParts(adaCoreCode(row.masterCode));
      return core != null && core.stem === parts.stem && core.width === parts.width && core.suffix.replace(/^S/, "") === stdSuffix;
    })
    .sort((a, b) => normalizedCode(a.masterCode).length - normalizedCode(b.masterCode).length)[0];
  return close ? { row: close, exact: false } : null;
}

/** A floor base box on a run that carries counter: not an appliance, filler, panel or anything mounted up the wall. */
function isCounterBase(item: PlacedCabinet): boolean {
  if (item.placement !== "base") return false;
  if (isFillerItem(item) || isPanelItem(item)) return false;
  if (isDishwasherItem(item)) return false;
  if (num(item.mountBottom, 0) > 0.05) return false;
  return true;
}

/** True when the catalog text says the sink base leaves an open / removable-front knee space. */
export function adaSinkBaseHasKneeSpace(item: Pick<PlacedCabinet, "description" | "subCategory">): boolean {
  return /removable|knee\s*space|wheelchair|open\s*(?:base|knee)/i.test(`${item.description ?? ""} ${item.subCategory ?? ""}`);
}

type Rect = { x0: number; y0: number; x1: number; y1: number };

function floorRect(item: PlacedCabinet): Rect {
  const size = placedFootprint(item);
  const x = num(item.x);
  const y = num(item.y);
  return { x0: x, y0: y, x1: x + size.w, y1: y + size.d };
}

/** Anything on the floor a wheelchair cannot roll under: bases, talls and floor appliances. Uppers, stackers and over-range units are not. */
function isFloorObstacle(item: PlacedCabinet, room: RoomData): boolean {
  if (item.placement === "wall") return false;
  if (item.integratedWallBlindFiller) return false;
  const size = placedFootprint(item);
  if (size.w <= 0.01 || size.d <= 0.01) return false;
  try {
    if (elevationBox(item, room).bottom >= ADA_KNEE_HEIGHT_MIN_IN) return false;
  } catch {
    // An item the elevation helper cannot read is treated as on the floor.
  }
  return true;
}

function overlapLength(a0: number, a1: number, b0: number, b1: number): number {
  return Math.min(a1, b1) - Math.max(a0, b0);
}

function rectsIntersect(a: Rect, b: Rect, tolerance = 0.05): boolean {
  return overlapLength(a.x0, a.x1, b.x0, b.x1) > tolerance && overlapLength(a.y0, a.y1, b.y0, b.y1) > tolerance;
}

const PERPENDICULAR: Record<WallSide, WallSide[]> = {
  top: ["left", "right"],
  bottom: ["left", "right"],
  left: ["top", "bottom"],
  right: ["top", "bottom"],
};

/** Clear distance straight out from the front of one run item to the next obstacle (or the opposite wall). */
function clearInFront(item: Rect, side: WallSide, others: readonly { rect: Rect; side: WallSide | null }[], room: RoomData): number {
  const width = num(room.width);
  const depth = num(room.depth);
  const across = others.filter((o) => !(o.side && PERPENDICULAR[side].includes(o.side)));
  if (side === "top" || side === "bottom") {
    const front = side === "top" ? item.y1 : item.y0;
    let clear = side === "top" ? depth - front : front;
    for (const o of across) {
      if (overlapLength(item.x0, item.x1, o.rect.x0, o.rect.x1) <= 1) continue;
      const gap = side === "top" ? o.rect.y0 - front : front - o.rect.y1;
      if (gap >= -0.05) clear = Math.min(clear, Math.max(0, gap));
    }
    return clear;
  }
  const front = side === "left" ? item.x1 : item.x0;
  let clear = side === "left" ? width - front : front;
  for (const o of across) {
    if (overlapLength(item.y0, item.y1, o.rect.y0, o.rect.y1) <= 1) continue;
    const gap = side === "left" ? o.rect.x0 - front : front - o.rect.x1;
    if (gap >= -0.05) clear = Math.min(clear, Math.max(0, gap));
  }
  return clear;
}

function distanceToRect(px: number, py: number, r: Rect): number {
  const dx = Math.max(r.x0 - px, 0, px - r.x1);
  const dy = Math.max(r.y0 - py, 0, py - r.y1);
  return Math.hypot(dx, dy);
}

/** Largest clear circle (diameter, inches) the open floor holds, searched on a 1 in grid. Capped at the room. */
export function largestClearCircleIn(rects: readonly Rect[], room: RoomData): { diameterIn: number; center: { x: number; y: number } | null } {
  const width = num(room.width);
  const depth = num(room.depth);
  let best = 0;
  let center: { x: number; y: number } | null = null;
  for (let x = 0; x <= width; x += 1) {
    for (let y = 0; y <= depth; y += 1) {
      let radius = Math.min(x, y, width - x, depth - y);
      if (radius <= best) continue;
      for (const r of rects) {
        radius = Math.min(radius, distanceToRect(x, y, r));
        if (radius <= best) break;
      }
      if (radius > best) {
        best = radius;
        center = { x, y };
      }
    }
  }
  return { diameterIn: Math.floor(best * 2 * 8) / 8, center };
}

/** A 30 x 48 in clear floor space in front of one fixture: forward approach first, then parallel. */
function clearFloorSpaceAt(target: PlacedCabinet, side: WallSide, rects: readonly { uid: string; rect: Rect }[], room: RoomData): boolean {
  const r = floorRect(target);
  const width = num(room.width);
  const depth = num(room.depth);
  const tries: Array<[number, number]> = [[ADA_CLEAR_FLOOR_WIDTH_IN, ADA_CLEAR_FLOOR_DEPTH_IN], [ADA_CLEAR_FLOOR_DEPTH_IN, ADA_CLEAR_FLOOR_WIDTH_IN]];
  for (const [along, out] of tries) {
    let space: Rect;
    if (side === "top" || side === "bottom") {
      const cx = (r.x0 + r.x1) / 2;
      space = side === "top"
        ? { x0: cx - along / 2, x1: cx + along / 2, y0: r.y1, y1: r.y1 + out }
        : { x0: cx - along / 2, x1: cx + along / 2, y0: r.y0 - out, y1: r.y0 };
    } else {
      const cy = (r.y0 + r.y1) / 2;
      space = side === "left"
        ? { y0: cy - along / 2, y1: cy + along / 2, x0: r.x1, x1: r.x1 + out }
        : { y0: cy - along / 2, y1: cy + along / 2, x0: r.x0 - out, x1: r.x0 };
    }
    // Slide the space along the wall up to half its width to clear a corner run.
    for (const shift of [0, -along / 4, along / 4, -along / 2, along / 2]) {
      const s: Rect = side === "top" || side === "bottom"
        ? { ...space, x0: space.x0 + shift, x1: space.x1 + shift }
        : { ...space, y0: space.y0 + shift, y1: space.y1 + shift };
      if (s.x0 < -0.05 || s.y0 < -0.05 || s.x1 > width + 0.05 || s.y1 > depth + 0.05) continue;
      if (rects.some((o) => o.uid !== target.uid && rectsIntersect(o.rect, s))) continue;
      return true;
    }
  }
  return false;
}

function fmt(n: number): string {
  return `${Math.round(n * 8) / 8}`;
}

export type AdaKitchenResult = {
  placed: PlacedCabinet[];
  /** standard -> ADA swaps that were made, in plan order. */
  swaps: Array<{ uid: string; from: string; to: string; exact: boolean }>;
  /** Standard bases kept because the line sells no ADA version. */
  kept: Array<{ uid: string; masterCode: string }>;
  findings: DesignerReviewFinding[];
  notes: string[];
};

/**
 * Applies the ADA kitchen choice to a finished Auto Design plan. With the box
 * unchecked the plan comes back untouched (same array contents, no findings).
 */
export function applyAdaKitchenPreference(input: {
  placed: readonly PlacedCabinet[];
  baseCatalog: readonly DesignCabinet[];
  intake: AutoDesignIntake | null | undefined;
  room: RoomData;
  wallLabelOf?: (wallId: string) => WallLabel | null;
}): AdaKitchenResult {
  const placed = [...input.placed];
  if (!isAdaKitchen(input.intake)) return { placed, swaps: [], kept: [], findings: [], notes: [] };
  const { room } = input;
  const labelOf = (wallId: string | null | undefined): WallLabel | null => (wallId && input.wallLabelOf ? input.wallLabelOf(wallId) : null);
  const findings: DesignerReviewFinding[] = [];
  const notes: string[] = [];
  const finding = (f: Omit<DesignerReviewFinding, "ruleId">) => findings.push({ ruleId: ADA_RULE_ID, wallLabel: null, cabinetUid: null, cabinetCode: null, ...f });

  // 1. ADA cabinets from the selected line, same width and family only.
  const adaRows = input.baseCatalog.filter((row) => row.placement === "base" || row.placement == null).filter(isAdaCatalogRow);
  const swaps: AdaKitchenResult["swaps"] = [];
  const kept: AdaKitchenResult["kept"] = [];
  const working = placed.map((item) => {
    if (!isCounterBase(item)) return item;
    if (normalizedCode(item.masterCode).includes("ADA")) return item;
    const match = adaVersionOf(item, adaRows);
    if (!match) {
      kept.push({ uid: item.uid, masterCode: item.masterCode });
      return item;
    }
    const row = match.row;
    swaps.push({ uid: item.uid, from: item.masterCode, to: row.masterCode, exact: match.exact });
    const swapped: PlacedCabinet = {
      ...item,
      cabinetId: row.id,
      masterCode: row.masterCode,
      description: row.description ?? item.description,
      category: row.category ?? item.category ?? null,
      subCategory: row.subCategory ?? item.subCategory ?? null,
      height: num(row.height, ADA_BASE_BOX_HEIGHT_IN),
    };
    for (const key of ["numberOfDoors", "numberOfDrawers", "graphicType", "drawerLayout", "layoutSpec", "facePattern", "doorHeight", "drawerHeight", "specImageUrl", "catalogImageUrl"] as const) {
      if ((row as any)[key] !== undefined) (swapped as any)[key] = (row as any)[key];
    }
    return swapped;
  });

  if (adaRows.length === 0) {
    finding({
      code: "ada-line-has-no-ada-cabinets",
      severity: "warning",
      title: "ADA kitchen: this line sells no ADA cabinets",
      detail: `The selected door line has no ADA base cabinets in its catalog, so the standard cabinets were kept (${kept.length} base${kept.length === 1 ? "" : "s"}). Pick a line that sells ADA cabinets, or order ADA-height bases separately.`,
    });
  } else {
    if (swaps.length > 0) {
      finding({
        code: "ada-cabinets-switched",
        severity: "info",
        title: `ADA kitchen: ${swaps.length} base cabinet${swaps.length === 1 ? "" : "s"} switched to the line's ADA version`,
        detail: swaps.map((s) => `${s.from} -> ${s.to}${s.exact ? "" : " (closest ADA version)"}`).join(", ") + ".",
      });
    }
    if (kept.length > 0) {
      finding({
        code: "ada-cabinets-no-ada-version",
        severity: "warning",
        title: "ADA kitchen: no ADA version in this line",
        detail: `Kept the standard cabinet because the line has no ADA version of the same width: ${kept.map((k) => k.masterCode).join(", ")}.`,
      });
    }
  }

  // 2. Counter height: 34 in max over ADA-height bases.
  const counterBases = working.filter(isCounterBase);
  const tall = counterBases.filter((item) => num(item.height, STD.BASE_HEIGHT) > ADA_BASE_BOX_HEIGHT_IN + HEIGHT_MATCH_IN);
  const lowered = counterBases.length - tall.length;
  if (counterBases.length > 0 && tall.length === 0) {
    finding({
      code: "ada-counter-34",
      severity: "info",
      title: `ADA kitchen: counters at ${ADA_COUNTER_MAX_IN} in`,
      detail: `Every base is a ${fmt(ADA_BASE_BOX_HEIGHT_IN)} in ADA-height box, so a ${fmt(STD.COUNTERTOP_THICKNESS)} in top finishes at ${ADA_COUNTER_MAX_IN} in.`,
    });
  } else if (tall.length > 0) {
    finding({
      code: "ada-counter-over-34",
      severity: "warning",
      title: `ADA kitchen: counter over ${ADA_COUNTER_MAX_IN} in`,
      detail: `${lowered > 0 ? `${lowered} base${lowered === 1 ? " is" : "s are"} ADA height (${ADA_COUNTER_MAX_IN} in counter), but ` : ""}${tall.map((t) => t.masterCode).join(", ")} ${tall.length === 1 ? "is a standard" : "are standard"} ${fmt(STD.BASE_HEIGHT)} in box${tall.length === 1 ? "" : "es"}, so the counter there is ${fmt(STD.BASE_HEIGHT + STD.COUNTERTOP_THICKNESS)} in.${lowered > 0 ? " A run with both heights needs a step in the top." : ""}`,
    });
  }
  const dishwasher = working.find((item) => isDishwasherItem(item));
  if (dishwasher && lowered > 0) {
    finding({
      code: "ada-dishwasher-height",
      severity: "warning",
      title: "ADA kitchen: dishwasher under a 34 in counter",
      detail: "A standard dishwasher needs about a 34.5 in opening. Under a 34 in counter, order an ADA-height dishwasher.",
      cabinetUid: dishwasher.uid,
      cabinetCode: dishwasher.masterCode,
      wallLabel: labelOf(dishwasher.wallId),
    });
  }

  // 3. Knee space at the sink, and at the cooktop / prep area.
  const sinkBase = working.find((item) => item.placement === "base" && isSinkBaseCabinet(item));
  if (sinkBase) {
    const isAda = normalizedCode(sinkBase.masterCode).includes("ADA");
    const knee = isAda && adaSinkBaseHasKneeSpace(sinkBase);
    if (knee) {
      finding({
        code: "ada-knee-space-sink",
        severity: "info",
        title: "ADA kitchen: knee space at the sink",
        detail: `${sinkBase.masterCode} (${sinkBase.description}) leaves the knee space under the sink. Knee space must be at least ${ADA_KNEE_WIDTH_MIN_IN} in wide and ${ADA_KNEE_HEIGHT_MIN_IN} in high; insulate or cover the drain and supply pipes.`,
        cabinetUid: sinkBase.uid,
        cabinetCode: sinkBase.masterCode,
        wallLabel: labelOf(sinkBase.wallId),
      });
    } else {
      finding({
        code: "ada-knee-space-sink-missing",
        severity: "warning",
        title: "ADA kitchen: no knee space at the sink",
        detail: isAda
          ? `${sinkBase.masterCode} is the line's ADA sink base, but its catalog description does not say it has a removable front or open knee space. Confirm with the distributor, or leave the sink open (${ADA_KNEE_WIDTH_MIN_IN} in wide x ${ADA_KNEE_HEIGHT_MIN_IN} in high knee space) with the pipes covered.`
          : `The line sells no ADA sink base with a removable front, so ${sinkBase.masterCode} was kept. For an ADA sink, leave the sink open (${ADA_KNEE_WIDTH_MIN_IN} in wide x ${ADA_KNEE_HEIGHT_MIN_IN} in high knee space) with the pipes covered.`,
        cabinetUid: sinkBase.uid,
        cabinetCode: sinkBase.masterCode,
        wallLabel: labelOf(sinkBase.wallId),
      });
    }
  }
  const range = working.find((item) => item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description));
  finding({
    code: "ada-knee-space-cooktop",
    severity: "warning",
    title: "ADA kitchen: no knee space at the cooktop",
    detail: range
      ? `${range.masterCode} is a freestanding range at about 36 in. A seated cook needs a cooktop at ${ADA_COUNTER_MAX_IN} in max with knee space below (and a wall oven). Auto Design does not build that yet.`
      : `No knee space was built at a cooktop or prep counter. A seated cook needs one ${ADA_KNEE_WIDTH_MIN_IN} in wide open section at ${ADA_COUNTER_MAX_IN} in max.`,
    cabinetUid: range?.uid ?? null,
    cabinetCode: range?.masterCode ?? null,
    wallLabel: labelOf(range?.wallId),
  });

  // 4. Clearances: 48 in aisles, 60 in turning circle, 30 x 48 clear floor at each fixture.
  const obstacles = working
    .filter((item) => isFloorObstacle(item, room))
    .map((item) => {
      let side: WallSide | null = null;
      try {
        side = item.wallId && ["top", "bottom", "left", "right"].includes(item.wallId) ? (item.wallId as WallSide) : cabinetWall(item, room);
      } catch {
        side = null;
      }
      return { uid: item.uid, item, rect: floorRect(item), side };
    });
  const bySide = new Map<WallSide, typeof obstacles>();
  for (const o of obstacles) {
    if (!o.side) continue;
    const list = bySide.get(o.side) ?? [];
    list.push(o);
    bySide.set(o.side, list);
  }
  for (const [side, items] of Array.from(bySide.entries())) {
    const others = obstacles.filter((o) => o.side !== side);
    let tightest = Number.POSITIVE_INFINITY;
    for (const o of items) tightest = Math.min(tightest, clearInFront(o.rect, side, others, room));
    if (!Number.isFinite(tightest)) continue;
    const wallLabel = labelOf(side);
    const name = wallLabel ?? `${side} wall`;
    if (tightest + 0.05 < ADA_WORK_AISLE_MIN_IN) {
      finding({
        code: "ada-aisle-under-48",
        severity: "warning",
        title: `ADA kitchen: aisle under ${ADA_WORK_AISLE_MIN_IN} in`,
        detail: `Only ${fmt(tightest)} in of clear floor in front of the ${name} run; an ADA kitchen needs ${ADA_WORK_AISLE_MIN_IN} in. The room is too tight here; move a run or the island.`,
        wallLabel,
      });
    } else {
      finding({
        code: "ada-aisle-ok",
        severity: "info",
        title: `ADA kitchen: ${ADA_WORK_AISLE_MIN_IN} in aisle met`,
        detail: `${fmt(tightest)} in of clear floor in front of the ${name} run (${ADA_WORK_AISLE_MIN_IN} in minimum).`,
        wallLabel,
      });
    }
  }
  const circle = largestClearCircleIn(obstacles.map((o) => o.rect), room);
  if (circle.diameterIn + 0.05 < ADA_TURNING_CIRCLE_DIAMETER_IN) {
    finding({
      code: "ada-turning-circle-missing",
      severity: "warning",
      title: `ADA kitchen: no ${ADA_TURNING_CIRCLE_DIAMETER_IN} in turning circle`,
      detail: `The largest clear circle on the open floor is about ${fmt(circle.diameterIn)} in across; a wheelchair needs ${ADA_TURNING_CIRCLE_DIAMETER_IN} in (or a ${ADA_TURNING_CIRCLE_DIAMETER_IN} in T-turn using knee space).`,
    });
  } else {
    finding({
      code: "ada-turning-circle-ok",
      severity: "info",
      title: `ADA kitchen: ${ADA_TURNING_CIRCLE_DIAMETER_IN} in turning circle fits`,
      detail: `The open floor holds a ${ADA_TURNING_CIRCLE_DIAMETER_IN} in turning circle${circle.center ? ` (centered about ${fmt(circle.center.x)} in, ${fmt(circle.center.y)} in from the back-left corner)` : ""}.`,
    });
  }
  const fixtures: Array<{ label: string; item: PlacedCabinet | undefined }> = [
    { label: "sink", item: sinkBase },
    { label: "range", item: range },
    { label: "dishwasher", item: dishwasher },
    { label: "refrigerator", item: working.find((item) => isRefrigerator(item)) },
  ];
  const blocked: string[] = [];
  const met: string[] = [];
  for (const { label, item } of fixtures) {
    if (!item) continue;
    const owner = obstacles.find((o) => o.uid === item.uid);
    if (!owner?.side) continue;
    if (clearFloorSpaceAt(item, owner.side, obstacles, room)) met.push(label);
    else blocked.push(`${label} (${item.masterCode})`);
  }
  if (blocked.length > 0) {
    finding({
      code: "ada-clear-floor-blocked",
      severity: "warning",
      title: `ADA kitchen: no ${ADA_CLEAR_FLOOR_WIDTH_IN} x ${ADA_CLEAR_FLOOR_DEPTH_IN} in clear floor`,
      detail: `No ${ADA_CLEAR_FLOOR_WIDTH_IN} x ${ADA_CLEAR_FLOOR_DEPTH_IN} in clear floor space in front of the ${blocked.join(", ")}.`,
    });
  }
  if (met.length > 0) {
    finding({
      code: "ada-clear-floor-ok",
      severity: "info",
      title: `ADA kitchen: ${ADA_CLEAR_FLOOR_WIDTH_IN} x ${ADA_CLEAR_FLOOR_DEPTH_IN} in clear floor met`,
      detail: `Clear floor space in front of the ${met.join(", ")}.`,
    });
  }
  finding({
    code: "ada-scope-note",
    severity: "info",
    title: "ADA kitchen: what was checked",
    detail: "Values follow the NKBA Access Standard (ICC A117.1 based): 48 in aisles, 60 in turning circle, 30 x 48 in clear floor, 34 in max counter, 30 in wide x 27 in high knee space. Wall cabinet heights, hardware and appliance models were not changed; the island and any furniture are not in the clearance check.",
  });
  notes.push(`ADA kitchen: ${swaps.length} base${swaps.length === 1 ? "" : "s"} switched to ADA versions, ${kept.length} kept standard.`);

  return { placed: working, swaps, kept, findings, notes };
}

/**
 * Auto Design v2 final passes (Tom, Nov 17 2026, owner voice 3:27 PM CT).
 *
 * The rules fire in this order on the finished layout, before the plan is handed back:
 *  1. Corners: a 24" diagonal corner upper gets a 12" cabinet on each leg. The base corner is
 *     named as what was actually placed (a lazy Susan, a blind corner or a diagonal); a line
 *     that sells no 24" diagonal base corner keeps its corner and the report says so.
 *  2. Cabinet before filler: a 9" upper plus the 3" filler beside it becomes one 12" cabinet
 *     (the line sells W1212GD for it), never a 9" and a filler side by side and never a 39.
 *  3-4. (Window mirror, glass schedule and flush 96" tops run next, in autoDesignGlassSchedule.)
 *  5. Rule 10: every visible side gets 3/4" stock. A 1/4" skin is not accepted; it is swapped
 *     for 3/4" stock cut from the line's own panel (S2496, TDEP, BDEP). A side that still
 *     cannot be finished is named with the real reason.
 *
 * Nothing invents a SKU or a price; every row comes from the selected line's catalog.
 */
import type { DesignerReviewFinding } from "./designerReviewFindings";
import { autoDesignStandardUpperRows } from "./autoDesignWallCabinets";
import { autoDesignExactUpperTiling } from "./autoDesignUpperWidths";
import { panelIsThreeQuarter } from "./autoDesignRangeFlanks";
import { exposedPanelRequirements } from "./exposedPanelRule";
import { exposedPanelFaceInches, exposedPanelTypeForCatalog } from "./exposedSidePanels";
import {
  WALL_OPENING_CLEARANCE_IN, appendCollisionFreePlacements, cabinetWall, dim, elevationBox, footprintDepth, glassStackerFamily, isCornerCabinet,
  isFillerItem, isPanelItem, isStacker, placedFootprint, wallPlacementAt, wallRunOffset, wallRunSpan,
  type DesignCabinet, type PlacedCabinet, type RoomData, type WallOpening, type WallSide,
} from "./design";

const EPS = 0.1;
const HEIGHT_MATCH_IN = 0.5;
const WIDTH_MATCH_IN = 0.05;
const WALLS: readonly WallSide[] = ["top", "right", "bottom", "left"] as WallSide[];
const THREE_QUARTER_IN = 0.75;
/** A panel within about an inch of the cabinet depth still covers the side (BDEP 23 1/2 on a 24" base). */
const PANEL_DEPTH_TOLERANCE_IN = 1;

/** Uid marker for the 12" cabinet that replaced a 9" + 3" filler (it is on the glass schedule). */
export const AUTO_DESIGN_MERGED_TWELVE_UID = ":v2-merged12";
/** Uid marker for the 12" cabinet on a diagonal corner leg (the window mirror leaves it in place). */
export const AUTO_DESIGN_CORNER_FLANK_UID = ":v2-corner-flank";

export function isAutoDesignMergedTwelve(item: Pick<PlacedCabinet, "uid">): boolean {
  return String(item.uid).endsWith(AUTO_DESIGN_MERGED_TWELVE_UID);
}

export function isAutoDesignCornerFlank(item: Pick<PlacedCabinet, "uid">): boolean {
  return String(item.uid).includes(AUTO_DESIGN_CORNER_FLANK_UID);
}

type Span = { item: PlacedCabinet; start: number; end: number; bottom: number; top: number };

function spanOn(item: PlacedCabinet, wall: string, room: RoomData): Span {
  const start = wallRunOffset(item, wall, room);
  const box = elevationBox(item, room);
  return { item, start, end: start + wallRunSpan(item, wall, room), bottom: box.bottom, top: box.bottom + box.height };
}

function inches(value: number): string {
  return `${Math.round(value * 100) / 100}″`;
}

function isPlainUpperAt(item: PlacedCabinet, heightIn: number): boolean {
  return item.placement === "wall" && !item.islandFace && !isFillerItem(item) && !isPanelItem(item) && !isStacker(item)
    && !isCornerCabinet(item.masterCode, item.description, item.cornerType ?? null)
    && /^W-?\d/i.test(item.masterCode) && Math.abs((Number(item.height) || 0) - heightIn) <= HEIGHT_MATCH_IN;
}

function upperFromRow(row: DesignCabinet, start: number, wall: string, room: RoomData, template: PlacedCabinet, heightIn: number, uid: string, styleId: number | null): PlacedCabinet {
  const width = dim(row.width, 0);
  const depth = footprintDepth(row);
  return {
    uid,
    cabinetId: row.id,
    masterCode: row.masterCode,
    description: row.description,
    category: row.category,
    subCategory: row.subCategory,
    placement: "wall",
    ...wallPlacementAt(start, width, depth, wall as WallSide, room),
    width,
    depth,
    height: dim(row.height, heightIn),
    mountBottom: template.mountBottom ?? 54,
    numberOfDoors: row.numberOfDoors,
    numberOfDrawers: row.numberOfDrawers,
    catalogImageUrl: row.catalogImageUrl ?? null,
    constructionMethod: row.constructionMethod ?? null,
    styleId: template.styleId ?? styleId,
  } as PlacedCabinet;
}

function verticalOverlap(a: Span, b: Span): number {
  return Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom);
}

/** True when two pieces touch in plan (within `margin` inches). */
function touchesInPlan(a: PlacedCabinet, b: PlacedCabinet, margin: number): boolean {
  const fa = placedFootprint(a);
  const fb = placedFootprint(b);
  return a.x - margin <= b.x + fb.w && b.x - margin <= a.x + fa.w && a.y - margin <= b.y + fb.d && b.y - margin <= a.y + fa.d;
}

function withoutUids(placed: readonly PlacedCabinet[], uids: ReadonlySet<string>): PlacedCabinet[] {
  return placed.filter((item) => !uids.has(item.uid) && !(item.stackedOnCabinetUid && uids.has(item.stackedOnCabinetUid)));
}

// ---------------------------------------------------------------------------
// Rule 2: cabinet before filler (9" + 3" filler -> one 12")
// ---------------------------------------------------------------------------

export function mergeAutoDesignUpperCabinetPlusFiller(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  wallCatalog: readonly DesignCabinet[];
  heightIn: number | null;
  styleId: number | null;
  makeUid: () => string;
}): { placed: PlacedCabinet[]; notes: string[] } {
  let working = [...input.placed];
  const notes: string[] = [];
  const height = input.heightIn;
  if (height == null) return { placed: working, notes };
  const row12 = autoDesignStandardUpperRows(input.wallCatalog, height).find((row) => Math.abs(dim(row.width, 0) - 12) <= WIDTH_MATCH_IN);
  if (!row12) return { placed: working, notes };
  const { room } = input;
  const nines = working.filter((item) => isPlainUpperAt(item, height) && Math.abs((Number(item.width) || 0) - 9) <= WIDTH_MATCH_IN);
  for (const nine of nines) {
    if (!working.some((item) => item.uid === nine.uid)) continue;
    const wall = cabinetWall(nine, room) as string;
    if (!wall) continue;
    const ninth = spanOn(nine, wall, room);
    const filler = working
      .filter((item) => item.placement === "wall" && isFillerItem(item) && cabinetWall(item, room) === wall)
      .map((item) => spanOn(item, wall, room))
      .find((entry) => (Math.abs(entry.start - ninth.end) <= EPS || Math.abs(entry.end - ninth.start) <= EPS)
        && Math.abs(entry.end - entry.start + 9 - 12) <= WIDTH_MATCH_IN
        && verticalOverlap(entry, ninth) >= (ninth.top - ninth.bottom) - HEIGHT_MATCH_IN);
    if (!filler) continue;
    const start = Math.min(ninth.start, filler.start);
    const twelve = upperFromRow(row12, start, wall, room, nine, height, `${input.makeUid()}${AUTO_DESIGN_MERGED_TWELVE_UID}`, input.styleId);
    const accepted = appendCollisionFreePlacements(withoutUids(working, new Set([nine.uid, filler.item.uid])), [twelve], room);
    if (accepted.rejected.length > 0) continue;
    working = accepted.placed;
    notes.push(`Cabinet before filler: ${nine.masterCode} + the ${inches(filler.end - filler.start)} ${filler.item.masterCode} on ${wall} became one ${row12.masterCode} (12″), so a 9″ cabinet and a filler no longer sit side by side.`);
  }
  return { placed: working, notes };
}

// ---------------------------------------------------------------------------
// Rule 1: corners (24" diagonal + a 12" on each leg)
// ---------------------------------------------------------------------------

type Leg = { wall: WallSide; edge: number; dir: 1 | -1 };

/** The runs that meet a corner piece: its own wall and the perpendicular wall it abuts. */
function cornerLegs(corner: PlacedCabinet, placed: readonly PlacedCabinet[], room: RoomData, level: (item: PlacedCabinet) => boolean): Leg[] {
  const legs: Leg[] = [];
  const own = cabinetWall(corner, room);
  for (const wall of WALLS) {
    const pieces = placed.filter((item) => item.uid !== corner.uid && level(item) && cabinetWall(item, room) === wall);
    if (!pieces.length) continue;
    const cs = spanOn(corner, wall, room);
    for (const dir of [1, -1] as const) {
      const edge = dir === 1 ? cs.end : cs.start;
      const meets = pieces.some((item) => {
        const s = spanOn(item, wall, room);
        const touches = dir === 1 ? Math.abs(s.start - edge) <= 3.6 && s.start >= edge - EPS : Math.abs(s.end - edge) <= 3.6 && s.end <= edge + EPS;
        return touches && (wall === own || touchesInPlan(item, corner, 3.6));
      });
      if (meets) legs.push({ wall, edge, dir });
    }
  }
  return legs;
}

function cornerLabel(walls: readonly string[], wallLabelOf: (wallId: string) => string | null): string {
  const labels = Array.from(new Set(walls.map((wall) => wallLabelOf(wall) ?? wall))).sort();
  return labels.length >= 2 ? `Corner between ${labels.join(" and ")}` : `Corner on ${labels[0] ?? "the run"}`;
}

export function flankAutoDesignDiagonalCornerUppers(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  wallCatalog: readonly DesignCabinet[];
  heightIn: number | null;
  styleId: number | null;
  makeUid: () => string;
  wallLabelOf: (wallId: string) => string | null;
}): { placed: PlacedCabinet[]; notes: string[]; findings: DesignerReviewFinding[] } {
  let working = [...input.placed];
  const notes: string[] = [];
  const findings: DesignerReviewFinding[] = [];
  const height = input.heightIn;
  if (height == null) return { placed: working, notes, findings };
  const { room } = input;
  const standard = autoDesignStandardUpperRows(input.wallCatalog, height);
  const widths = Array.from(new Set(standard.map((row) => dim(row.width, 0))));
  const rowFor = (width: number) => standard.find((row) => Math.abs(dim(row.width, 0) - width) <= WIDTH_MATCH_IN) ?? null;
  const row12 = rowFor(12);
  const corners = working.filter((item) => item.placement === "wall" && !isStacker(item) && glassStackerFamily(item) === "WDC");
  for (const corner of corners) {
    const cornerSpan = spanOn(corner, cabinetWall(corner, room) as string, room);
    const level = (item: PlacedCabinet) => item.placement === "wall" && !isStacker(item) && !isPanelItem(item);
    const legs = cornerLegs(corner, working, room, level);
    const label = cornerLabel([cabinetWall(corner, room) as string, ...legs.map((leg) => leg.wall)], input.wallLabelOf);
    for (const leg of legs) {
      const onWall = working.filter((item) => item.uid !== corner.uid && level(item) && cabinetWall(item, room) === leg.wall)
        .map((item) => spanOn(item, leg.wall, room))
        .filter((entry) => verticalOverlap(entry, cornerSpan) > 1);
      // Step over corner fillers (3" or less) to the first cabinet on the leg.
      let edge = leg.edge;
      for (;;) {
        const sliver = onWall.find((entry) => isFillerItem(entry.item) && entry.end - entry.start <= 3 + EPS
          && (leg.dir === 1 ? Math.abs(entry.start - edge) <= EPS : Math.abs(entry.end - edge) <= EPS));
        if (!sliver) break;
        edge = leg.dir === 1 ? sliver.end : sliver.start;
      }
      const run: Span[] = [];
      for (;;) {
        const next = onWall.find((entry) => !run.includes(entry) && isPlainUpperAt(entry.item, height)
          && (leg.dir === 1 ? Math.abs(entry.start - edge) <= EPS : Math.abs(entry.end - edge) <= EPS));
        if (!next) break;
        run.push(next);
        edge = leg.dir === 1 ? next.end : next.start;
      }
      if (!run.length) continue;
      const first = run[0]!;
      if (Math.abs(first.end - first.start - 12) <= WIDTH_MATCH_IN) continue;
      const total = run.reduce((sum, entry) => sum + entry.end - entry.start, 0);
      const legName = input.wallLabelOf(leg.wall) ?? leg.wall;
      const rest = total >= 12 - WIDTH_MATCH_IN ? (Math.abs(total - 12) <= WIDTH_MATCH_IN ? [] : autoDesignExactUpperTiling(total - 12, widths)) : null;
      if (!row12 || rest == null || rest.some((width) => !rowFor(width))) {
        findings.push({
          ruleId: "auto-design-corner-diagonal",
          code: "corner-diagonal-flank-missing",
          severity: "warning",
          title: `${label}: no 12″ cabinet beside the ${corner.masterCode} on ${legName}`,
          detail: !row12
            ? `The corner rule puts a 12″ cabinet on each leg of the 24″ diagonal, and this line sells no ${inches(height)} 12″ wall cabinet.`
            : `The corner rule puts a 12″ cabinet on each leg of the 24″ diagonal; the ${inches(total)} run of ${run.map((entry) => entry.item.masterCode).join(" + ")} cannot close exactly around a 12″ with this line's widths.`,
        });
        continue;
      }
      const runStart = Math.min(...run.map((entry) => entry.start));
      const runEnd = Math.max(...run.map((entry) => entry.end));
      const pieces = [12, ...rest];
      const template = first.item;
      const replacements: PlacedCabinet[] = [];
      let along = leg.dir === 1 ? runStart : runEnd;
      pieces.forEach((width, index) => {
        const start = leg.dir === 1 ? along : along - width;
        const uid = index === 0 ? `${input.makeUid()}${AUTO_DESIGN_CORNER_FLANK_UID}` : input.makeUid();
        replacements.push(upperFromRow(rowFor(width)!, start, leg.wall, room, template, height, uid, input.styleId));
        along = leg.dir === 1 ? along + width : along - width;
      });
      const accepted = appendCollisionFreePlacements(withoutUids(working, new Set(run.map((entry) => entry.item.uid))), replacements, room);
      if (accepted.rejected.length > 0) {
        findings.push({
          ruleId: "auto-design-corner-diagonal",
          code: "corner-diagonal-flank-missing",
          severity: "warning",
          title: `${label}: no 12″ cabinet beside the ${corner.masterCode} on ${legName}`,
          detail: `The 12″ cabinet and the re-tiled run (${replacements.map((item) => item.masterCode).join(" + ")}) would collide with another piece.`,
        });
        continue;
      }
      working = accepted.placed;
      const ordered = leg.dir === 1 ? replacements : [...replacements].reverse();
      const was = (leg.dir === 1 ? run : [...run].reverse()).map((entry) => entry.item.masterCode);
      notes.push(`${label}: the ${corner.masterCode} 24″ diagonal corner upper has a 12″ ${replacements[0]!.masterCode} beside it on ${legName} (now ${ordered.map((item) => item.masterCode).join(" + ")}, was ${was.join(" + ")}).`);
    }
  }
  return { placed: working, notes, findings };
}

function cornerTypeName(item: PlacedCabinet): string {
  const text = `${item.masterCode} ${item.description ?? ""} ${item.cornerType ?? ""}`.toLowerCase();
  if (/diagonal/.test(text)) return "24″ diagonal corner";
  if (/lazy\s*susan|easy\s*reach|^erb|^ls/i.test(text)) return "lazy Susan corner";
  if (/blind|^bbc/i.test(text)) return "blind corner";
  return "corner cabinet";
}

/**
 * Names the base corner actually placed. The corner decision is written early ("a catalog-fitting
 * lazy Susan (or a blind if none fits)") and a seat note ("BBC36 blind corner pulled 6″") can
 * outlive the cabinet it described; both are rewritten from the final plan. A line that sells no
 * 24" diagonal base corner keeps its corner and the report names the rule it could not meet.
 */
export function reconcileAutoDesignCornerReport(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  notes: string[];
  baseCatalog: readonly DesignCabinet[];
  wallLabelOf: (wallId: string) => string | null;
}): { notes: string[]; findings: DesignerReviewFinding[] } {
  const { room } = input;
  const cornerBases = input.placed.filter((item) => item.placement === "base" && !item.islandFace
    && isCornerCabinet(item.masterCode, item.description, item.cornerType ?? null));
  const codes = new Set(input.placed.map((item) => String(item.masterCode).toUpperCase()));
  const describe = (item: PlacedCabinet) => {
    const level = (other: PlacedCabinet) => (other.placement === "base" || other.placement === "appliance") && !isPanelItem(other);
    const legs = cornerLegs(item, input.placed, room, level);
    return { item, label: cornerLabel([cabinetWall(item, room) as string, ...legs.map((leg) => leg.wall)], input.wallLabelOf) };
  };
  const described = cornerBases.map(describe);
  const notes: string[] = [];
  for (const note of input.notes) {
    const pulled = /^[^:]+: (\S+) blind corner pulled /.exec(note);
    if (pulled && !codes.has(pulled[1]!.toUpperCase())) continue;
    const decision = /^(Corner between [^:]+): (a catalog-fitting lazy Susan \(or a blind if none fits\)|a blind corner, or a smaller lazy Susan that fits|a lazy Susan with a 9 in cabinet beside it|a lazy Susan|a turned blind corner|a pull-out \/ sliding corner) — (.*)$/.exec(note);
    if (decision) {
      const match = described.find((entry) => entry.label === decision[1]) ?? (described.length === 1 ? described[0] : undefined);
      if (match) {
        notes.push(`${decision[1]}: ${match.item.masterCode} ${cornerTypeName(match.item)} placed — ${decision[3]}`);
        continue;
      }
    }
    notes.push(note);
  }
  const findings: DesignerReviewFinding[] = [];
  const diagonalBase = input.baseCatalog.find((row) => row.placement === "base" && /diagonal/i.test(`${row.description ?? ""}`) && !/wall/i.test(`${row.description ?? ""}`));
  for (const entry of described) {
    if (/diagonal/i.test(cornerTypeName(entry.item))) continue;
    findings.push({
      ruleId: "auto-design-corner-diagonal",
      code: "corner-diagonal-base-unavailable",
      severity: "warning",
      title: `${entry.label}: ${entry.item.masterCode} ${cornerTypeName(entry.item)} kept, not a 24″ diagonal with 12″ cabinets`,
      detail: diagonalBase
        ? `The corner rule asks for a 24″ diagonal base with a 12″ cabinet on each leg; ${diagonalBase.masterCode} was not seated here, so the ${entry.item.masterCode} stays.`
        : `The corner rule asks for a 24″ diagonal base with a 12″ cabinet on each leg, and this line sells no diagonal base corner, so the ${entry.item.masterCode} stays (no SKU was invented).`,
      cabinetUid: entry.item.uid,
      cabinetCode: entry.item.masterCode,
    } as DesignerReviewFinding);
  }
  return { notes, findings };
}

// ---------------------------------------------------------------------------
// Rule 10: 3/4" stock on every visible side
// ---------------------------------------------------------------------------

type PanelRow = DesignCabinet & { face: number; stockHeight: number };

function threeQuarterStock(panelCatalog: readonly DesignCabinet[]): PanelRow[] {
  return panelCatalog.flatMap((row) => {
    if (!row || !(Number(row.id) > 0)) return [];
    if (!exposedPanelTypeForCatalog(row as never)) return [];
    const text = `${row.masterCode} ${row.description ?? ""} ${row.subCategory ?? ""}`.toLowerCase();
    if (/dishwasher|return panel|refrigerator|fridge|filler|toe|crown|molding|moulding/.test(text)) return [];
    if (!panelIsThreeQuarter(row as never)) return [];
    return [{ ...row, face: exposedPanelFaceInches(row as never), stockHeight: dim(row.height, 0) } as PanelRow];
  });
}

/**
 * The 3/4" sheet of the line that covers a side `depth` deep and `height` tall: a base end panel
 * for a base side when one is tall enough, then a plain one-piece sheet (S2496) before a two-piece
 * decorative panel (TDEP), then the smallest.
 */
function pickThreeQuarter(stock: readonly PanelRow[], depth: number, height: number, placement?: string | null): PanelRow | null {
  const baseEnd = (row: PanelRow) => placement === "base" && exposedPanelTypeForCatalog(row as never) === "base-end";
  const twoPiece = (row: PanelRow) => /2-piece|two-piece/i.test(`${row.description ?? ""}`);
  return [...stock]
    .filter((row) => row.face + PANEL_DEPTH_TOLERANCE_IN >= depth && row.stockHeight + 0.01 >= height)
    .sort((a, b) => Number(baseEnd(b)) - Number(baseEnd(a))
      || Number(twoPiece(a)) - Number(twoPiece(b))
      || a.face * a.stockHeight - b.face * b.stockHeight || a.masterCode.localeCompare(b.masterCode))[0] ?? null;
}

export function finishAutoDesignVisibleSides(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  panelCatalog: readonly DesignCabinet[];
  buildWallIds?: readonly string[];
  wallEndsCovered?: boolean;
  /** Windows and doors: a wall panel stays out of a window's clearance, a base panel out of the opening. */
  openings?: readonly WallOpening[];
}): { placed: PlacedCabinet[]; notes: string[]; findings: DesignerReviewFinding[] } {
  const { room } = input;
  const intoOpening = (wall: string, from: number, to: number, bottom: number, top: number, placement: string | null | undefined) => (input.openings ?? []).find((opening) => {
    if (String(opening.side) !== wall) return false;
    const pad = placement === "wall" ? WALL_OPENING_CLEARANCE_IN : 0;
    const sill = opening.kind === "door" ? 0 : Number(opening.sill) || 0;
    const head = sill + (Number(opening.height) || 0);
    const verticalHit = opening.kind === "door" || placement === "wall" || (bottom < head - EPS && top > sill + EPS);
    return verticalHit && from < opening.offset + opening.width + pad - 0.01 && to > opening.offset - pad + 0.01;
  });
  const stock = threeQuarterStock(input.panelCatalog);
  const notes: string[] = [];
  const findings: DesignerReviewFinding[] = [];
  // 1. A 1/4" skin on a side is not 3/4" stock: swap it for 3/4" stock cut from the line's panel.
  const swapped: string[] = [];
  let working = input.placed.map((item) => {
    if (!isPanelItem(item) || item.placement !== "wall" && item.placement !== "base") return item;
    const row = input.panelCatalog.find((candidate) => candidate.id === item.cabinetId && String(candidate.masterCode) === String(item.masterCode))
      ?? input.panelCatalog.find((candidate) => String(candidate.masterCode) === String(item.masterCode));
    if (!row || panelIsThreeQuarter(row as never)) return item;
    const thin = [Number(row.width), Number(row.depth)].some((value) => value > 0 && value < 0.6);
    if (!thin) return item;
    const height = elevationBox(item, room).height;
    const sheet = pickThreeQuarter(stock, Number(item.depth) || 0, height, item.placement);
    if (!sheet) return item;
    swapped.push(`${item.masterCode} → 3/4″ cut from ${sheet.masterCode}`);
    return {
      ...item,
      cabinetId: sheet.id,
      masterCode: sheet.masterCode,
      description: sheet.description,
      category: sheet.category ?? item.category,
      subCategory: sheet.subCategory ?? item.subCategory,
      fieldModificationNote: `Rule 10: 3/4″ finished side cut from ${sheet.masterCode} (replaces the 1/4″ ${item.masterCode} skin).`,
    } as PlacedCabinet;
  });
  if (swapped.length) notes.push(`Rule 10 takes 3/4″ stock, not 1/4″ skins: ${swapped.join("; ")}.`);
  // 2. Every visible side the plan still leaves open gets 3/4" stock outside the cabinet.
  const requirements = exposedPanelRequirements({ placed: working, room, buildWallIds: input.buildWallIds, wallEndsCovered: input.wallEndsCovered });
  const finished: string[] = [];
  for (const requirement of requirements) {
    const cabinet = working.find((item) => item.uid === requirement.cabinetUid);
    if (!cabinet) continue;
    const wall = requirement.wallId as WallSide;
    const box = elevationBox(cabinet, room);
    const depth = Number(cabinet.depth) || 0;
    const sheet = pickThreeQuarter(stock, depth, box.height, cabinet.placement);
    const unmet = (why: string) => findings.push({
      ruleId: "exposed-panel-three-quarter",
      code: "exposed-side-left-unfinished",
      severity: "warning",
      title: `${cabinet.masterCode} keeps an unfinished ${requirement.side} side`,
      detail: `Rule 10 needs 3/4″ stock on every visible side (${requirement.reason}); ${why}`,
      cabinetUid: cabinet.uid,
      cabinetCode: cabinet.masterCode,
    });
    if (!sheet) {
      unmet(`the selected line sells no 3/4″ panel at least ${inches(depth - PANEL_DEPTH_TOLERANCE_IN)} deep and ${inches(box.height)} tall.`);
      continue;
    }
    const s = spanOn(cabinet, wall, room);
    const along = requirement.side === "end" ? s.end : s.start - THREE_QUARTER_IN;
    const spot = wallPlacementAt(along, THREE_QUARTER_IN, Math.max(depth, THREE_QUARTER_IN), wall, room, cabinet.peninsulaSide ?? null, false);
    if (Math.abs((spot.wallOffset ?? along) - along) > 0.2) {
      unmet(`there is no 3/4″ of room outside the ${requirement.side} side for a ${sheet.masterCode} panel.`);
      continue;
    }
    const opening = intoOpening(wall, along, along + THREE_QUARTER_IN, box.bottom, box.bottom + box.height, cabinet.placement);
    if (opening) {
      unmet(opening.kind === "window" && cabinet.placement === "wall"
        ? `a 3/4″ ${sheet.masterCode} panel would sit inside the window's ${inches(WALL_OPENING_CLEARANCE_IN)} clearance.`
        : `a 3/4″ ${sheet.masterCode} panel would sit inside the ${opening.kind === "door" ? "door" : "window"} opening.`);
      continue;
    }
    const makePanel = (bottomIn: number, heightIn: number) => ({
      ...cabinet,
      ...spot,
      uid: `auto-panel:${cabinet.uid}:${requirement.side}`,
      cabinetId: sheet.id,
      masterCode: sheet.masterCode,
      description: sheet.description,
      category: "Panels",
      subCategory: "End panel",
      width: THREE_QUARTER_IN,
      depth,
      height: heightIn,
      nominalWidth: THREE_QUARTER_IN,
      nominalHeight: heightIn,
      nominalDepth: depth,
      mountBottom: cabinet.placement === "wall" || bottomIn > box.bottom + EPS ? bottomIn : cabinet.mountBottom,
      placement: cabinet.placement === "wall" ? "wall" : "base",
      numberOfDoors: 0,
      numberOfDrawers: 0,
      stackedOnCabinetUid: null,
      wallId: spot.wallId ?? wall,
      wallOffset: spot.wallOffset ?? along,
      fieldModificationNote: `Rule 10: 3/4″ finished ${requirement.side} side (${requirement.reason}), ${inches(heightIn)} tall. Cut from ${sheet.masterCode}.`,
      // Like the range-flank panels: no autoPlacedReason, so the designer's own
      // exposed-side passes keep it (Rule 10 is an owner rule for every line).
      autoPlacedForUid: cabinet.uid,
      autoPlacedSide: requirement.side,
    } as unknown as PlacedCabinet);
    let accepted = appendCollisionFreePlacements(working, [makePanel(box.bottom, box.height)], room);
    let band: { bottom: number; top: number } | null = null;
    if (accepted.rejected.length > 0) {
      // Neighbours tight against the side (a bridge, an over-the-range microwave) already hide part
      // of it; the 3/4" stock then finishes only the band they leave open.
      const meeting = working.filter((other) => other.uid !== cabinet.uid && cabinetWall(other, room) === wall && !isStacker(other))
        .map((other) => spanOn(other, wall, room))
        .filter((other) => (requirement.side === "end" ? Math.abs(other.start - s.end) <= EPS : Math.abs(other.end - s.start) <= EPS)
          && (Number(other.item.depth) || 0) >= Math.min(depth, 12) - 0.01)
        .sort((a, b) => a.bottom - b.bottom);
      const open: Array<{ bottom: number; top: number }> = [];
      let from = box.bottom;
      for (const other of meeting) {
        if (other.top <= from || other.bottom >= box.bottom + box.height) continue;
        if (other.bottom > from + EPS) open.push({ bottom: from, top: Math.min(other.bottom, box.bottom + box.height) });
        from = Math.max(from, other.top);
      }
      if (from < box.bottom + box.height - EPS) open.push({ bottom: from, top: box.bottom + box.height });
      band = open.sort((a, b) => (b.top - b.bottom) - (a.top - a.bottom))[0] ?? null;
      if (band && open.length === 1) accepted = appendCollisionFreePlacements(working, [makePanel(band.bottom, band.top - band.bottom)], room);
      if (!band || open.length !== 1 || accepted.rejected.length > 0) {
        const names = Array.from(new Set(meeting.map((other) => other.item.masterCode)));
        unmet(`${names.length ? names.join(" and ") : "the next piece"} sit${names.length > 1 ? "" : "s"} tight against that side, leaving no 3/4″ of room for a ${sheet.masterCode} panel.`);
        continue;
      }
    }
    working = accepted.placed;
    finished.push(`${cabinet.masterCode} ${requirement.side} side (${sheet.masterCode}${band ? `, ${inches(band.top - band.bottom)} band from ${inches(band.bottom)} to ${inches(band.top)} left open by the pieces beside it` : ""})`);
  }
  if (finished.length) notes.push(`Rule 10: 3/4″ finished panels cut from the line's own stock on ${finished.join(", ")}.`);
  return { placed: working, notes, findings };
}

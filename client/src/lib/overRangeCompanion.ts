/**
 * Rule: if the design questions ask for an over-range microwave with a bridge cabinet, the build
 * places BOTH during the build — not after it, through a post-build dialog.
 *
 * The old flow only offered `offerAutoDesignBridgeAndMicrowave` / `rangeCompanionProposal` after
 * the plan was committed, so a customer who answered "microwave + bridge" in the design questions
 * still got a bare range until they accepted a second prompt. That prompt also required an exact
 * 30 inch range and an exact W3012/W3024 bridge within 0.01 inch, so an approved 30 inch line with
 * a 12/15/18/21/24 bridge only sometimes qualified.
 *
 * This module answers one question for the build: given the requested answer and the chosen line,
 * what microwave and bridge really exist, where do they sit, and what must be reported when they
 * cannot be placed.
 */
import {
  BRIDGE_STOCK_HEIGHTS,
  bridgeHeightForWallHeight,
  MICROWAVE_BRIDGE_HEIGHT_BY_NEIGHBOR_IN,
  microwaveBridgeHeightForNeighbor,
  cabinetWall,
  dim,
  isRangeOrOven,
  mountedMicrowaveOverRangeSpot,
  OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM,
  wallCeilingMin,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import type { DesignerReviewFinding } from "./designerReviewFindings";
import { kitchenRuleNumber } from "./kitchenRuleParameters";
import { hasAefPrintedGeometry } from "@shared/aefFramelessGeometry";
import {
  FRAMELESS_TOP_WALL_HEIGHT_IN,
  framelessWallTopDatumIn,
} from "./framelessWallTopAlignment";

/** What the designer asked for above the range. */
export type OverRangeAnswer = "hood" | "microwave-bridge" | "open" | null | undefined;

/** The approved bridge family: a real solid wall cabinet 12-24 inches tall. */
// 23 is the frameless 22-5/8" box (nominal "23"): the height whose top reaches
// the frameless 94-1/4" wall line from the 72" datum.
const APPROVED_BRIDGE_CODE = /^W(\d{2})(12|15|18|21|23|24)$/;

function numberOrZero(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** The source-priced microwave for this range width, from the layout appliance palette. */
export function overRangeMicrowaveFor(
  rangeWidthIn: number,
  appliancePalette: readonly DesignCabinet[],
): DesignCabinet | null {
  return appliancePalette.find((item) => {
    // The layout appliance palette carries `placementType`; a catalog row carries `placement`.
    const placement = (item as { placement?: string | null; placementType?: string | null }).placement
      ?? (item as { placementType?: string | null }).placementType;
    return placement === "appliance"
      && /^MW[-_]?\d/i.test(`${item.masterCode ?? ""}`)
      && Math.abs(numberOrZero(item.width) - rangeWidthIn) <= 0.01;
  }) ?? null;
}

/**
 * Tom (Nov 9): "I wouldn't put a 30 in cabinet over a 36 in stove." A bridge is
 * only ever as wide as the range it spans; no nearer stock width stands in.
 */
export function bridgeMatchesRangeWidth(bridgeWidthIn: number, rangeWidthIn: number): boolean {
  return Math.abs(bridgeWidthIn - rangeWidthIn) <= 0.01;
}

/** Whether the line has any bridge for this range width: a real one, or a single-door cabinet to turn. */
export function lineSellsBridgeAtRangeWidth(rangeWidthIn: number, wallCatalog: readonly DesignCabinet[]): boolean {
  return overRangeBridgeCandidates(rangeWidthIn, wallCatalog).kind !== "none";
}

/**
 * The visible reason when the line has neither a bridge at the range's width
 * nor a single-door cabinet to turn horizontal; shared by the pop-up and Auto Design.
 */
export function bridgeMissingAtRangeWidthReason(
  rangeWidthIn: number,
  lineName?: string | null,
  over: "microwave" | "range" = "microwave",
): string {
  const width = Math.round(rangeWidthIn);
  const line = lineName?.trim() ? `The ${lineName.trim()} line` : "The selected door line";
  return `${line} sells no ${width}″-wide bridge (W${width}12–W${width}24) and no single-door W12${width}–W21${width} to turn horizontal for this ${width}″ range, so no cabinet can be added over the ${over}.`;
}

/**
 * Tom (Nov 9): "I could take w1836 and flip it horizontal" / "W12 to W21 you
 * could use" / "You can't since a w24 has 2 doors." With no bridge at the
 * range's width, a single-door wall cabinet as TALL as the range is wide may be
 * hung turned 90 degrees: W1836 turned is 36 wide x 18 tall. Only these turned
 * heights exist; 24" never does.
 */
export const TURNED_BRIDGE_HEIGHTS_IN = [12, 15, 18, 21] as const;

const PLAIN_WALL_CODE = /^W(\d{2})(\d{2})$/;

/** The upright width/height of a single-door wall cabinet that may be turned over this range, or null. */
export function turnableBridgeGeometry(
  cabinet: DesignCabinet,
  rangeWidthIn: number,
): { width: number; height: number; turnedHeightIn: number } | null {
  if (cabinet.placement !== "wall" || cabinet.turnedSideways) return null;
  const match = PLAIN_WALL_CODE.exec((cabinet.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, ""));
  if (!match) return null;
  const identity = `${cabinet.masterCode} ${cabinet.description ?? ""} ${cabinet.subCategory ?? ""}`.toLowerCase();
  if (/\bspice\b|\brefrigerator\b|\bglass\b|\bopen\s+(?:box|shel(?:f|ves)|front)\b|\bcorner\b|\bdiagonal\b|\bblind\b|\bpeninsula\b/.test(identity)) return null;
  const width = numberOrZero(cabinet.width);
  const height = numberOrZero(cabinet.height);
  if (!width || !height || !bridgeMatchesRangeWidth(height, rangeWidthIn)) return null;
  const turnedHeightIn = stockBridgeHeightIn(width);
  const codeWidth = Number(match[1]);
  if (turnedHeightIn == null || !(TURNED_BRIDGE_HEIGHTS_IN as readonly number[]).includes(turnedHeightIn) || codeWidth > 21) return null;
  // A W24 and wider has two doors and cannot be turned. The catalog's own door
  // count wins when the row carries one; otherwise the 21" width limit decides.
  const doors = Number(cabinet.numberOfDoors);
  if (Number.isFinite(doors) && doors > 0 && doors !== 1) return null;
  return { width, height, turnedHeightIn };
}

/** The over-range view of a turned cabinet: same id and SKU, width and height swapped. */
export function turnedBridgeRow(cabinet: DesignCabinet): DesignCabinet {
  // Only single-door uppers qualify, so a row without a door count is still one
  // door; without it the 36" turned width would infer two.
  return { ...cabinet, width: cabinet.height, height: cabinet.width, numberOfDoors: 1, turnedSideways: true };
}

/** "W3018", or "W1836 turned horizontal" for a turned cabinet. */
export function overRangeBridgeLabel(bridge: Pick<DesignCabinet, "masterCode" | "turnedSideways">): string {
  return bridge.turnedSideways ? `${bridge.masterCode} turned horizontal` : bridge.masterCode;
}

export type OverRangeBridgeCandidates = {
  /** "bridge": real W{range}{12..24}; "turned": single-door W{12..21}{range} turned; "none": neither. */
  kind: "bridge" | "turned" | "none";
  /** The best row for each stock height (bridge rows as stored, turned rows as their turned view). */
  byHeight: Map<number, DesignCabinet>;
};

/** The bridges the line can hang over a range of this width, one per height; shared by the pop-up and Auto Design. */
export function overRangeBridgeCandidates(rangeWidthIn: number, wallCatalog: readonly DesignCabinet[]): OverRangeBridgeCandidates {
  const pick = (rows: { cabinet: DesignCabinet; heightIn: number; boxHeightIn: number }[]) => {
    const byHeight = new Map<number, DesignCabinet>();
    for (const heightIn of BRIDGE_STOCK_HEIGHTS) {
      const best = rows
        .filter((row) => row.heightIn === heightIn)
        .sort((left, right) => (
          Math.abs(left.boxHeightIn - heightIn) - Math.abs(right.boxHeightIn - heightIn)
          || left.cabinet.masterCode.localeCompare(right.cabinet.masterCode)
          || left.cabinet.id - right.cabinet.id
        ))[0];
      if (best) byHeight.set(heightIn, best.cabinet);
    }
    return byHeight;
  };
  const bridges = wallCatalog.flatMap((cabinet) => {
    const geometry = isUsableBridgeRow(cabinet);
    const heightIn = geometry ? stockBridgeHeightIn(geometry.height) : null;
    return geometry && heightIn != null && bridgeMatchesRangeWidth(geometry.width, rangeWidthIn)
      ? [{ cabinet, heightIn, boxHeightIn: geometry.height }]
      : [];
  });
  if (bridges.length > 0) return { kind: "bridge", byHeight: pick(bridges) };
  const turned = wallCatalog.flatMap((cabinet) => {
    const geometry = turnableBridgeGeometry(cabinet, rangeWidthIn);
    return geometry ? [{ cabinet: turnedBridgeRow(cabinet), heightIn: geometry.turnedHeightIn, boxHeightIn: geometry.width }] : [];
  });
  if (turned.length > 0) return { kind: "turned", byHeight: pick(turned) };
  return { kind: "none", byHeight: new Map() };
}

/** Width and height of a real bridge box, or null when the row is not one. */
export function bridgeFamilyGeometry(cabinet: {
  masterCode?: string | null;
  description?: string | null;
  subCategory?: string | null;
  category?: string | null;
  placement?: string | null;
  width?: string | number | null;
  height?: string | number | null;
}): { width: number; height: number } | null {
  return isUsableBridgeRow(cabinet as DesignCabinet);
}

function isUsableBridgeRow(cabinet: DesignCabinet): { width: number; height: number } | null {
  if (cabinet.placement !== "wall") return null;
  const normalized = (cabinet.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = APPROVED_BRIDGE_CODE.exec(normalized);
  if (!match) return null;
  const identity = `${cabinet.masterCode} ${cabinet.description ?? ""} ${cabinet.subCategory ?? ""}`.toLowerCase();
  // WSC30 is a spice cabinet and glass/open boxes are not a bridge.
  if (/\bspice\b/.test(identity)) return null;
  if (/\brefrigerator\b|\bglass\b|\bopen\s+box\b/.test(identity)) return null;
  const width = numberOrZero(cabinet.width);
  const height = numberOrZero(cabinet.height);
  if (!width || !height) return null;
  return { width, height };
}

/** A frameless line sells 17-5/8" where a framed line sells 18"; both are the 18" bridge. */
const BRIDGE_STOCK_HEIGHT_MATCH_IN = 0.5;

/**
 * The single wall top line this line finishes on, or null when the line has none
 * and the older neighbour-height mapping still applies.
 *
 * Tom's decision (Nov 9 2026, issue #354 item 5): on the U.S. Cabinet Depot
 * frameless line every wall cabinet top and every bridge top finishes at 94-1/4"
 * (54" bottom + the book's 40-1/4" box). `isFramelessLine` accepts either the
 * geometry marker on a placed cabinet or a frameless catalog row, so the pop-up,
 * the mandatory build pass and the restore pass all read the same answer.
 */
export function singleTopLineFor(input: {
  wallCatalog?: readonly { constructionMethod?: string | null }[];
  wallCabinetHeightIn?: number | null;
}): number | null {
  const catalogIsFrameless = (input.wallCatalog ?? []).some((row) => hasAefPrintedGeometry(row));
  if (catalogIsFrameless) return framelessWallTopDatumIn();
  // A 40-1/4" request is itself the frameless class: no framed line sells it.
  const requested = Number(input.wallCabinetHeightIn);
  if (Number.isFinite(requested) && Math.abs(requested - FRAMELESS_TOP_WALL_HEIGHT_IN) <= 0.05) {
    return framelessWallTopDatumIn();
  }
  return null;
}

/** The stock bridge height (12/15/18/21/24) a real box stands for, or null. */
export function stockBridgeHeightIn(heightIn: number): number | null {
  const nearest = BRIDGE_STOCK_HEIGHTS.reduce((best, height) => (
    Math.abs(height - heightIn) < Math.abs(best - heightIn) ? height : best
  ));
  return Math.abs(nearest - heightIn) <= BRIDGE_STOCK_HEIGHT_MATCH_IN ? nearest : null;
}

/** Whether a microwave bridge on the 72" datum fits under the wall's ceiling. Never clipped, never past it. */
export function microwaveBridgeClearsCeiling(boxHeightIn: number, ceilingIn: number | null | undefined): boolean {
  const ceiling = Number(ceilingIn);
  return !(Number.isFinite(ceiling) && ceiling > 0)
    || OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM + boxHeightIn <= ceiling + 0.01;
}

/** Where the uppers beside the range finish when none is placed yet: the wall-height setting. */
export function overRangeSettingTopLineIn(
  wallCabinetHeightIn: number,
  wallCatalog: readonly { placement?: string | null; width?: string | number | null; height?: string | number | null }[] = [],
): number {
  return overRangeUpperRunTop(wallCabinetHeightIn, wallCatalog)
    ?? kitchenRuleNumber("wall_bottom_in") + wallCabinetHeightIn;
}

/**
 * The one height pick for a microwave bridge, shared by the range-companion
 * pop-up and the Auto Design build. `available` lists the heights the line
 * really sells at this width and that clear the ceiling, with the top each
 * lands on from the 72" datum.
 *
 * A 30/36/42" neighbour maps to its 12/18/24" bridge (Tom, Nov 8). 15" and 21"
 * are never the default for those three, so when the mapped SKU is missing the
 * pick stays among 12/18/24. Any other neighbour height takes the tallest
 * height whose top does not pass the neighbours' top line, or the shortest
 * when every height passes it.
 */
export function microwaveBridgeHeightPick(
  available: readonly { heightIn: number; topIn: number }[],
  upperTopLineIn: number | null,
  neighborHeightIn: number | null,
  /**
   * Issue #354 item 5 (Tom, Nov 9 2026): on the frameless line the bridge tops
   * out on the 94-1/4" wall-cabinet line, not on the neighbour-mapping line.
   * Pass that line here and the pick ignores `neighborHeightIn`.
   */
  framelessTopLineIn: number | null = null,
): number | null {
  const sorted = [...available].sort((left, right) => left.heightIn - right.heightIn);
  if (sorted.length === 0) return null;
  if (framelessTopLineIn != null && Number.isFinite(framelessTopLineIn)) {
    // Every bridge hangs from the fixed 72" datum, so its top is 72 + height.
    // Take the shortest box whose top does not pass the line; when none reaches
    // it, take the tallest the line sells so the gap is as small as possible
    // (the caller names the shortfall rather than silently leaving it low).
    const reaching = sorted.filter((option) => option.topIn <= framelessTopLineIn + 0.51);
    if (reaching.length > 0) return reaching[reaching.length - 1]!.heightIn;
    return sorted[sorted.length - 1]!.heightIn;
  }
  const mapped = microwaveBridgeHeightForNeighbor(neighborHeightIn);
  if (mapped != null && sorted.some((option) => option.heightIn === mapped)) return mapped;
  const mappedHeights: number[] = Object.values(MICROWAVE_BRIDGE_HEIGHT_BY_NEIGHBOR_IN);
  const mappedOptions = sorted.filter((option) => mappedHeights.includes(option.heightIn));
  const candidates = mapped != null && mappedOptions.length > 0 ? mappedOptions : sorted;
  if (upperTopLineIn == null || !Number.isFinite(upperTopLineIn)) return candidates[candidates.length - 1]!.heightIn;
  const fitting = candidates.filter((option) => option.topIn <= upperTopLineIn + 0.01);
  return (fitting.length ? fitting[fitting.length - 1]! : candidates[0]!).heightIn;
}

/**
 * The solid bridge cabinet above the range. MANDATORY on every build (owner rule,
 * Nov 5 2026): the bridge is placed first, ahead of any microwave or hood, and is
 * not skippable by the pop-up answer.
 *
 * Selection, in order:
 *   1. only the RANGE width (a 36" range takes a 36" bridge, never a 30" one);
 *   2. among that width's heights that clear the ceiling, the one
 *      `microwaveBridgeHeightPick` takes - the same pick the pop-up preselects.
 *
 * The height comes from the run top line, not from a nominal bridge size: with
 * 30" uppers (top 84") a microwave bridge at the 72" datum must be 12" tall, which
 * is exactly W3012 for a 30" range. That is the owner's "12-inch wall cabinet above
 * the range". A line that stores its uppers at 30¼" or its bridges at 17⅝" instead
 * of 18" still gets the box whose top lands nearest that line.
 *
 * Returns null when the line sells no bridge at the range's width, or none at
 * that width clears the ceiling; callers report why and place nothing.
 */
export function overRangeBridgeFor(input: {
  rangeWidthIn: number;
  wallCabinetHeightIn: number;
  wallCatalog: readonly DesignCabinet[];
  /** The wall's ceiling, so a bridge taller than the room allows is never chosen. */
  ceilingIn?: number | null;
  /**
   * The single wall top line this line finishes on. The frameless designer passes
   * 94-1/4" here (issue #354 item 5): the bridge then tops out on that line from
   * the fixed 72" datum instead of following the neighbour-height mapping.
   */
  topLineIn?: number | null;
}): DesignCabinet | null {
  // The bridge spans the range, so only the range's own width qualifies: a real
  // bridge, else a single-door cabinet turned horizontal. Then the shared height
  // pick among the heights that clear the ceiling.
  const { byHeight } = overRangeBridgeCandidates(numberOrZero(input.rangeWidthIn), input.wallCatalog);
  const available = Array.from(byHeight.entries())
    .filter(([, cabinet]) => microwaveBridgeClearsCeiling(numberOrZero(cabinet.height), input.ceilingIn))
    .map(([heightIn, cabinet]) => ({ heightIn, topIn: OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM + numberOrZero(cabinet.height) }));
  const heightIn = microwaveBridgeHeightPick(
    available,
    overRangeSettingTopLineIn(input.wallCabinetHeightIn, input.wallCatalog),
    input.wallCabinetHeightIn,
    input.topLineIn ?? null,
  );
  return heightIn == null ? null : byHeight.get(heightIn) ?? null;
}

/**
 * The bridge height that puts the bridge top on the SAME line as the uppers beside
 * the range, measured from the datum this bridge actually hangs from.
 *
 * A 30" upper run tops at 84", so a bridge on the 72" microwave datum is 12" tall —
 * the W3012 the owner asks for. A 42" run tops at 96", so the same bridge is 24".
 *
 * The answer is always one of the real stock bridge heights (12/15/18/21/24), so a
 * caller that has no catalog can still name a purchasable SKU. When the line sells
 * its 30" class as 30¼" uppers, the run top moves to 84¼" and the nearest stock
 * height (12") is still the right box — the bridge finishes a quarter inch proud of
 * a nominal line, which is what the catalog offers.
 */
export function overRangeBridgeHeightFor(
  wallCabinetHeightIn: number,
  wallCatalog: readonly { placement?: string | null; width?: string | number | null; height?: string | number | null }[] = [],
  bridgeBottomIn: number = OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM,
  /** The line's single wall top line (frameless: 94-1/4"). Overrides the mapping. */
  topLineIn: number | null = null,
): number {
  // Issue #354 item 5: a line with one wall top line puts the bridge top there
  // from this datum, whatever height the neighbour is.
  if (topLineIn != null && Number.isFinite(topLineIn)) {
    const required = topLineIn - bridgeBottomIn;
    const sorted = [...BRIDGE_STOCK_HEIGHTS].sort((a, b) => a - b);
    const reaching = sorted.filter((height) => height <= required + 0.51);
    return reaching.length > 0 ? reaching[reaching.length - 1]! : sorted[sorted.length - 1]!;
  }
  // Over a microwave on the 72" datum, Tom's 30/36/42 -> 12/18/24 mapping wins.
  const mapped = Math.abs(bridgeBottomIn - OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM) <= 0.01
    ? microwaveBridgeHeightForNeighbor(wallCabinetHeightIn)
    : null;
  if (mapped != null) return mapped;
  const runTop = overRangeUpperRunTop(wallCabinetHeightIn, wallCatalog)
    ?? kitchenRuleNumber("wall_bottom_in") + wallCabinetHeightIn;
  const required = runTop - bridgeBottomIn;
  const nominal = bridgeHeightForWallHeight(wallCabinetHeightIn);
  const target = required > 0 ? required : nominal;
  return BRIDGE_STOCK_HEIGHTS.reduce((best, height) =>
    Math.abs(height - target) < Math.abs(best - target) ? height : best,
  );
}

/**
 * The top line the ordinary uppers beside the range actually finish on. Read from
 * the catalog's own wall rows for the requested class, so a 30¼" frameless upper
 * reports 84¼" rather than the framed 84". Null when the line sells no upper near
 * the request, which leaves the nominal ladder in charge.
 */
function overRangeUpperRunTop(
  wallCabinetHeightIn: number,
  wallCatalog: readonly { placement?: string | null; width?: string | number | null; height?: string | number | null }[],
): number | null {
  const heights = wallCatalog
    .filter((row) => row.placement === "wall" && numberOrZero(row.width) > 0 && numberOrZero(row.height) > 0)
    .map((row) => numberOrZero(row.height))
    .filter((height) => Math.abs(height - wallCabinetHeightIn) <= 2.5);
  if (heights.length === 0) return null;
  const height = heights
    .map((value) => Math.round(value * 1000) / 1000)
    .sort((a, b) => Math.abs(a - wallCabinetHeightIn) - Math.abs(b - wallCabinetHeightIn) || a - b)[0]!;
  return kitchenRuleNumber("wall_bottom_in") + height;
}

/**
 * Every bridge the line could put above this range, best first. Used by a caller
 * that needs to try a shorter bridge when the preferred one is blocked by the
 * ceiling or an existing cabinet.
 */
export function overRangeBridgeOptions(input: {
  rangeWidthIn: number;
  wallCabinetHeightIn: number;
  wallCatalog: readonly DesignCabinet[];
  ceilingIn?: number | null;
  /** The line's single wall top line (frameless: 94-1/4"). */
  topLineIn?: number | null;
}): DesignCabinet[] {
  const rows = input.wallCatalog
    .map((cabinet) => {
      const usable = isUsableBridgeRow(cabinet);
      return usable ? { cabinet, ...usable } : null;
    })
    .filter((entry): entry is { cabinet: DesignCabinet; width: number; height: number } => entry != null);
  const wantedWidth = numberOrZero(input.rangeWidthIn);
  const requiredHeight = overRangeBridgeHeightFor(input.wallCabinetHeightIn, input.wallCatalog, OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM, input.topLineIn ?? null);
  return rows
    .filter((row) => bridgeMatchesRangeWidth(row.width, wantedWidth) && microwaveBridgeClearsCeiling(row.height, input.ceilingIn))
    .sort((left, right) => (
      Math.abs(left.height - requiredHeight) - Math.abs(right.height - requiredHeight)
      || left.cabinet.masterCode.localeCompare(right.cabinet.masterCode)
      || left.cabinet.id - right.cabinet.id
    ))
    .map((row) => row.cabinet);
}

/** The wall's ceiling for a range, so a bridge is never picked for the wrong room. */
export function rangeWallCeiling(range: PlacedCabinet, room: RoomData): number {
  return wallCeilingMin(room, cabinetWall(range, room));
}

export type OverRangeCompanionPlan = {
  microwave: DesignCabinet;
  bridge: DesignCabinet;
  microwaveSpot: { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number };
  bridgeSpot: { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number };
  microwaveMountBottom: number;
  bridgeMountBottom: number;
  rangeUid: string;
  rangeCode: string;
};

export type OverRangeCompanionResult =
  | { ok: true; plan: OverRangeCompanionPlan }
  | { ok: false; findings: DesignerReviewFinding[] };

/**
 * Resolves the microwave + bridge the build must place. Called from inside the build, before the
 * wall cabinets are tiled, so the range never sits bare in a finished plan.
 */
export function planOverRangeCompanions(input: {
  answer: OverRangeAnswer;
  placed: readonly PlacedCabinet[];
  room: RoomData;
  appliancePalette: readonly DesignCabinet[];
  wallCatalog: readonly DesignCabinet[];
  wallCabinetHeightIn: number;
}): OverRangeCompanionResult {
  if (input.answer !== "microwave-bridge") return { ok: false, findings: [] };
  const range = input.placed.find((item) => (
    item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description)
  ));
  if (!range) {
    return {
      ok: false,
      findings: [{
        ruleId: "microwave-bridge-in-build",
        code: "no-range-for-microwave",
        severity: "warning",
        title: "No range for the microwave and bridge",
        detail: "The design questions asked for an over-range microwave, but this kitchen has no range.",
      }],
    };
  }
  const rangeWidth = numberOrZero(range.width);
  const microwave = overRangeMicrowaveFor(rangeWidth, input.appliancePalette);
  const bridge = overRangeBridgeFor({
    rangeWidthIn: rangeWidth,
    wallCabinetHeightIn: input.wallCabinetHeightIn,
    wallCatalog: input.wallCatalog,
    ceilingIn: rangeWallCeiling(range, input.room),
    topLineIn: singleTopLineFor({ wallCatalog: input.wallCatalog, wallCabinetHeightIn: input.wallCabinetHeightIn }),
  });
  const findings: DesignerReviewFinding[] = [];
  if (!microwave) {
    findings.push({
      ruleId: "microwave-bridge-in-build",
      code: "no-matching-microwave",
      severity: "warning",
      title: "No matching over-range microwave",
      detail: `The design questions asked for a microwave over the range, but the selected line sells no ${rangeWidth}″ over-range microwave.`,
      cabinetUid: range.uid,
      cabinetCode: range.masterCode,
    });
  }
  if (!bridge) {
    findings.push({
      ruleId: "microwave-bridge-in-build",
      code: "no-matching-bridge",
      severity: "warning",
      title: "No bridge cabinet above the range",
      detail: lineSellsBridgeAtRangeWidth(rangeWidth, input.wallCatalog)
        ? `Every ${Math.round(rangeWidth)}″-wide bridge choice in the selected line passes the ${rangeWallCeiling(range, input.room)}″ ceiling at the 72″ datum, so nothing could be placed above the ${rangeWidth}″ range.`
        : bridgeMissingAtRangeWidthReason(rangeWidth),
      cabinetUid: range.uid,
      cabinetCode: range.masterCode,
    });
  }
  if (!microwave || !bridge) return { ok: false, findings };

  return { ok: true, plan: overRangeCompanionPlanFor({ range, room: input.room, microwave, bridge }) };
}

/**
 * The geometry for one chosen microwave and bridge over one range.
 *
 * Split out of `planOverRangeCompanions` so a caller that already has the real
 * microwave and bridge rows (the add-only fallback chain) does not have to
 * rediscover them through the catalog. The datum math is the same code.
 */
export function overRangeCompanionPlanFor(input: {
  range: PlacedCabinet;
  room: RoomData;
  microwave: DesignCabinet;
  bridge: DesignCabinet;
}): OverRangeCompanionPlan {
  const { range, room, microwave, bridge } = input;
  const microwaveHeight = numberOrZero(microwave.height);
  const microwaveSpot = mountedMicrowaveOverRangeSpot(
    { width: numberOrZero(microwave.width), depth: numberOrZero(microwave.depth) },
    range,
    room,
  );
  const side = cabinetWall(range, room);
  const rangeStart = wallRunOffset(range, side, room);
  const bridgeWidth = numberOrZero(bridge.width);
  const bridgeDepth = numberOrZero(bridge.depth);
  const bridgeStart = rangeStart + wallRunSpan(range, side, room) / 2 - bridgeWidth / 2;
  return {
    microwave,
    bridge,
    microwaveSpot,
    bridgeSpot: wallPlacementAt(bridgeStart, bridgeWidth, bridgeDepth, side, room),
    microwaveMountBottom: OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM - microwaveHeight,
    bridgeMountBottom: OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM,
    rangeUid: range.uid,
    rangeCode: range.masterCode,
  };
}

export type OverRangeBridgePlan = {
  bridge: DesignCabinet;
  bridgeSpot: { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number };
  bridgeMountBottom: number;
  rangeUid: string;
  rangeCode: string;
};

/**
 * The geometry for the mandatory bridge on its own, with no microwave.
 *
 * Owner rule (Nov 5 2026): the bridge is placed FIRST on every build, before any
 * microwave or hood, and is not skippable. A bridge that only ever arrives as a
 * microwave's companion therefore never appears when the answer is "hood" or
 * "open". This is the bridge alone, centered on the range at the 72 inch datum so
 * its top lands on the upper run line.
 */
export function overRangeBridgePlanFor(input: {
  range: PlacedCabinet;
  room: RoomData;
  bridge: DesignCabinet;
}): OverRangeBridgePlan {
  const { range, room, bridge } = input;
  const side = cabinetWall(range, room);
  const rangeStart = wallRunOffset(range, side, room);
  const bridgeWidth = numberOrZero(bridge.width);
  const bridgeDepth = numberOrZero(bridge.depth);
  const bridgeStart = rangeStart + wallRunSpan(range, side, room) / 2 - bridgeWidth / 2;
  return {
    bridge,
    bridgeSpot: wallPlacementAt(bridgeStart, bridgeWidth, bridgeDepth, side, room),
    bridgeMountBottom: OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM,
    rangeUid: range.uid,
    rangeCode: range.masterCode,
  };
}

/** The placed record for a bridge-only plan. Commit it through the collision gate. */
export function overRangeBridgePlacement(
  plan: OverRangeBridgePlan,
  options: { makeUid: () => string; styleId: number | null },
): PlacedCabinet {
  return {
    uid: options.makeUid(),
    cabinetId: plan.bridge.id,
    masterCode: plan.bridge.masterCode,
    description: plan.bridge.description,
    category: plan.bridge.category ?? "Wall",
    subCategory: plan.bridge.subCategory ?? "Wall",
    placement: "wall",
    ...plan.bridgeSpot,
    width: dim(plan.bridge.width, 30),
    depth: dim(plan.bridge.depth, 12),
    height: dim(plan.bridge.height, 12),
    mountBottom: plan.bridgeMountBottom,
    mountBottomAdjusted: true,
    overRangeMicrowaveBridge: true,
    ...(plan.bridge.turnedSideways ? { turnedSideways: true } : {}),
    numberOfDoors: plan.bridge.numberOfDoors ?? 2,
    numberOfDrawers: plan.bridge.numberOfDrawers ?? 0,
    catalogImageUrl: plan.bridge.catalogImageUrl ?? null,
    styleId: options.styleId,
  };
}

/**
 * True when this wall box is the bridge over this range: same wall, centered on the
 * range, and either flagged as a bridge or a bridge-family box hung at the 72 inch
 * datum. An existing bridge is never deleted, moved, or replaced.
 */
export function isBridgeOverRangeCabinet(
  cabinet: PlacedCabinet,
  range: PlacedCabinet,
  room: RoomData,
): boolean {
  if (cabinet.placement !== "wall" || cabinet.uid === range.uid) return false;
  const side = cabinetWall(range, room);
  if (cabinetWall(cabinet, room) !== side) return false;
  const rangeCenter = wallRunOffset(range, side, room) + wallRunSpan(range, side, room) / 2;
  const center = wallRunOffset(cabinet, side, room) + wallRunSpan(cabinet, side, room) / 2;
  // A bridge spans the range, so a centered overlap within an inch is the same box.
  if (Math.abs(rangeCenter - center) > 0.75) return false;
  if (cabinet.overRangeMicrowaveBridge === true) return true;
  const normalized = (cabinet.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cabinet.turnedSideways !== true && !/^W\d{2}(?:12|15|18|21|24)$/.test(normalized)) return false;
  // An ordinary W3024 elsewhere in the run is not the range's bridge. Only a box
  // hung at or above the 72 inch datum over the range counts.
  return Number(cabinet.mountBottom ?? 0) >= OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM - 0.5;
}

/**
 * The placed records for the plan. Kept separate so the caller can run them through the normal
 * collision gate before committing anything.
 */
export function overRangeCompanionPlacements(
  plan: OverRangeCompanionPlan,
  options: { makeUid: () => string; styleId: number | null },
): PlacedCabinet[] {
  const microwave: PlacedCabinet = {
    uid: options.makeUid(),
    cabinetId: plan.microwave.id,
    masterCode: plan.microwave.masterCode,
    description: plan.microwave.description,
    category: plan.microwave.category ?? "Appliance",
    subCategory: plan.microwave.subCategory ?? "Appliance",
    placement: "appliance",
    applianceRole: "countertop-opening",
    ...plan.microwaveSpot,
    width: dim(plan.microwave.width, 30),
    depth: dim(plan.microwave.depth, 15),
    height: dim(plan.microwave.height, 16),
    mountBottom: plan.microwaveMountBottom,
    numberOfDoors: plan.microwave.numberOfDoors ?? 0,
    numberOfDrawers: plan.microwave.numberOfDrawers ?? 0,
    catalogImageUrl: plan.microwave.catalogImageUrl ?? null,
    styleId: options.styleId,
  };
  const bridge: PlacedCabinet = {
    uid: options.makeUid(),
    cabinetId: plan.bridge.id,
    masterCode: plan.bridge.masterCode,
    description: plan.bridge.description,
    category: plan.bridge.category ?? "Wall",
    subCategory: plan.bridge.subCategory ?? "Wall",
    placement: "wall",
    ...plan.bridgeSpot,
    width: dim(plan.bridge.width, 30),
    depth: dim(plan.bridge.depth, 12),
    height: dim(plan.bridge.height, 12),
    mountBottom: plan.bridgeMountBottom,
    mountBottomAdjusted: true,
    overRangeMicrowaveBridge: true,
    ...(plan.bridge.turnedSideways ? { turnedSideways: true } : {}),
    numberOfDoors: plan.bridge.numberOfDoors ?? 2,
    numberOfDrawers: plan.bridge.numberOfDrawers ?? 0,
    catalogImageUrl: plan.bridge.catalogImageUrl ?? null,
    styleId: options.styleId,
  };
  return [bridge, microwave];
}

/**
 * Owner rule (kitchen rules: "Bridge cabinets over the range", owner-bridge-cabinets):
 * above the range the auto-designer places an OVER-THE-RANGE MICROWAVE with a BRIDGE
 * cabinet above it. Nothing else goes there by default. The bridge is a short solid
 * wall cabinet whose height comes from the upper line so its top lands on the same
 * run line (bridgeHeightForWallHeight: 30" uppers -> 12" bridge, 42" -> 24"), and
 * whose width matches the range.
 *
 * This is the default answer, so the old behavior — a full-height 30" wall cabinet
 * sitting over the range — no longer happens.
 */
export const DEFAULT_OVER_RANGE_ANSWER = "microwave-bridge" as const;

/** True when the answer asks the build to place a microwave and bridge itself. */
export function answerWantsMicrowaveBridge(answer: OverRangeAnswer): boolean {
  return (answer ?? DEFAULT_OVER_RANGE_ANSWER) === "microwave-bridge";
}

/**
 * For WIDTH and FIT purposes a bridge + over-the-range microwave stack above a
 * range behaves exactly like a plain wall cabinet of the same width: the bridge is
 * the same 30" span a W30xx occupies, and the microwave sits inside that span
 * below it. So a 30" range that accepts a 30" wall cabinet must accept a 30"
 * microwave + 30" bridge in the same place. Only the heights differ: the stack's
 * top is the upper run's top line.
 *
 * A fit check must therefore never reject the stack on width or span. This helper
 * is the one place that decides it, so the build and the review both use it.
 */
export function bridgeStackFitsLikeWallCabinet(input: {
  /** Free span above the range along the wall. */
  availableSpanIn: number;
  /** Width of the wall cabinet the same spot would take. */
  wallCabinetWidthIn: number;
  bridgeWidthIn: number;
  microwaveWidthIn: number;
}): { fits: boolean; requiredSpanIn: number; reason: string | null } {
  const requiredSpanIn = Math.max(input.bridgeWidthIn, input.microwaveWidthIn, 0);
  // The stack never requires more room than the wall cabinet it replaces.
  const comparedSpanIn = Math.min(requiredSpanIn, input.wallCabinetWidthIn);
  const fits = input.availableSpanIn + 0.01 >= comparedSpanIn;
  return {
    fits,
    requiredSpanIn: comparedSpanIn,
    reason: fits
      ? null
      : `A ${comparedSpanIn}″ cabinet goes here, and this space is ${Math.max(0, Math.round(input.availableSpanIn * 8) / 8)}″ wide.`,
  };
}

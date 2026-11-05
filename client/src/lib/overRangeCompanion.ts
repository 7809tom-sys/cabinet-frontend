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
  bridgeHeightForWallHeight,
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

/** What the designer asked for above the range. */
export type OverRangeAnswer = "hood" | "microwave-bridge" | "open" | null | undefined;

/** The approved bridge family: a real solid wall cabinet 12-24 inches tall. */
const APPROVED_BRIDGE_CODE = /^W(\d{2})(12|15|18|21|24)$/;

/** Stock bridge widths, nearest-first for a width the line does not sell verbatim. */
const BRIDGE_WIDTH_ORDER = [30, 33, 36, 24, 27, 39, 42] as const;

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

/** The width a bridge for this range should be: the range's own width, when the line sells it. */
function bridgeWidthCandidates(rangeWidthIn: number): number[] {
  const wanted = Math.round(rangeWidthIn * 8) / 8;
  const candidates = [wanted, ...BRIDGE_WIDTH_ORDER];
  return Array.from(new Set(candidates.filter((width) => width > 0)));
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

/**
 * The solid bridge cabinet above the range. MANDATORY on every build (owner rule,
 * Nov 5 2026): the bridge is placed first, ahead of any microwave or hood, and is
 * not skippable by the pop-up answer.
 *
 * Selection, in order:
 *   1. the width that matches the RANGE width (a 36" range takes a 36" bridge);
 *   2. else the nearest stock bridge width the line sells;
 *   3. the height that lands the bridge's top on the upper line, else the nearest
 *      real height that still clears the wall's ceiling.
 *
 * A frameless line sells 15⅛ or 17⅝ instead of 15 or 18, so height matching is
 * tolerant. Returns null only when the line genuinely sells no bridge box.
 */
export function overRangeBridgeFor(input: {
  rangeWidthIn: number;
  wallCabinetHeightIn: number;
  wallCatalog: readonly DesignCabinet[];
  /** The wall's ceiling, so a bridge taller than the room allows is never chosen. */
  ceilingIn?: number | null;
}): DesignCabinet | null {
  const rows = input.wallCatalog
    .map((cabinet) => {
      const usable = isUsableBridgeRow(cabinet);
      return usable ? { cabinet, ...usable } : null;
    })
    .filter((entry): entry is { cabinet: DesignCabinet; width: number; height: number } => entry != null);
  if (rows.length === 0) return null;

  const wantedWidth = numberOrZero(input.rangeWidthIn);
  const requiredHeight = bridgeHeightForWallHeight(input.wallCabinetHeightIn);
  const ceiling = Number(input.ceilingIn);
  const heightAllowed = (height: number) => !(Number.isFinite(ceiling) && ceiling > 0)
    || OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM + height <= ceiling + 0.5;
  // Width first: the bridge spans the range, so the exact range width wins and the
  // nearest stock width is the fallback. Then the height that lands on the upper
  // line, and only then a real height that still clears the wall's ceiling.
  return rows
    .filter((row) => heightAllowed(row.height))
    .sort((left, right) => (
      Math.abs(left.width - wantedWidth) - Math.abs(right.width - wantedWidth)
      || Math.abs(left.height - requiredHeight) - Math.abs(right.height - requiredHeight)
      || left.cabinet.masterCode.localeCompare(right.cabinet.masterCode)
      || left.cabinet.id - right.cabinet.id
    ))[0]?.cabinet ?? null;
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
}): DesignCabinet[] {
  const rows = input.wallCatalog
    .map((cabinet) => {
      const usable = isUsableBridgeRow(cabinet);
      return usable ? { cabinet, ...usable } : null;
    })
    .filter((entry): entry is { cabinet: DesignCabinet; width: number; height: number } => entry != null);
  const wantedWidth = numberOrZero(input.rangeWidthIn);
  const requiredHeight = bridgeHeightForWallHeight(input.wallCabinetHeightIn);
  const ceiling = Number(input.ceilingIn);
  const heightFits = (height: number) => !(Number.isFinite(ceiling) && ceiling > 0)
    || OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM + height <= ceiling + 0.5;
  return rows
    .filter((row) => heightFits(row.height))
    .sort((left, right) => (
      Math.abs(left.width - wantedWidth) - Math.abs(right.width - wantedWidth)
      || Math.abs(left.height - requiredHeight) - Math.abs(right.height - requiredHeight)
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
      detail: `The selected line sells no solid bridge cabinet (a 12″–24″ wall box) for a ${rangeWidth}″ range, so nothing could be placed above it.`,
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
  if (!/^W\d{2}(?:12|15|18|21|24)$/.test(normalized)) return false;
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

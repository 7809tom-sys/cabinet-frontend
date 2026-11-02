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

/** The approved bridge family: a real solid 30 inch wall cabinet 12-24 inches tall. */
const APPROVED_BRIDGE_CODE = /^W30(?:12|15|18|21|24)$/;

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
 * The solid 30 inch bridge for this range and upper height. A range must be 30 inches wide; the
 * bridge height follows the upper height so the bridge's top lands on the same 84/90/96 line.
 */
export function overRangeBridgeFor(input: {
  rangeWidthIn: number;
  wallCabinetHeightIn: number;
  wallCatalog: readonly DesignCabinet[];
}): DesignCabinet | null {
  if (Math.abs(input.rangeWidthIn - 30) > 0.01) return null;
  const requiredHeight = bridgeHeightForWallHeight(input.wallCabinetHeightIn);
  const eligible = input.wallCatalog.filter((cabinet) => {
    const identity = `${cabinet.masterCode} ${cabinet.description ?? ""} ${cabinet.subCategory ?? ""}`.toLowerCase();
    const normalized = cabinet.masterCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return cabinet.placement === "wall"
      && APPROVED_BRIDGE_CODE.test(normalized)
      && Math.abs(numberOrZero(cabinet.width) - 30) <= 0.01
      // A frameless line sells 15⅛ or 17⅝ instead of 15 or 18; the bridge must top out on the
      // same 84/90/96 line, not on the nominal catalog height.
      && Math.abs(numberOrZero(cabinet.height) - requiredHeight) <= 0.75
      // WSC30 is a spice cabinet and glass/open boxes are not a bridge.
      && !/\bspice\b/.test(identity)
      && !/\brefrigerator\b|\bglass\b|\bopen\s+box\b/.test(identity);
  });
  // Closest real height wins so the plan never reports a false "no bridge".
  return [...eligible]
    .sort((left, right) => (
      Math.abs(numberOrZero(left.height) - requiredHeight) - Math.abs(numberOrZero(right.height) - requiredHeight)
      || left.masterCode.localeCompare(right.masterCode)
      || left.id - right.id
    ))[0] ?? null;
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
      title: "No matching bridge cabinet",
      detail: Math.abs(rangeWidth - 30) > 0.01
        ? `The bridge cabinet is a 30″ family, and this range is ${rangeWidth}″ wide.`
        : `The design questions asked for a bridge above the range, but the selected line sells no 30″ W3012–W3024 bridge for ${input.wallCabinetHeightIn}″ uppers.`,
      cabinetUid: range.uid,
      cabinetCode: range.masterCode,
    });
  }
  if (!microwave || !bridge) return { ok: false, findings };

  const microwaveHeight = numberOrZero(microwave.height);
  const microwaveBottom = OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM - microwaveHeight;
  const microwaveSpot = mountedMicrowaveOverRangeSpot(
    { width: numberOrZero(microwave.width), depth: numberOrZero(microwave.depth) },
    range,
    input.room,
  );
  const side = cabinetWall(range, input.room);
  const rangeStart = wallRunOffset(range, side, input.room);
  const bridgeWidth = numberOrZero(bridge.width);
  const bridgeDepth = numberOrZero(bridge.depth);
  const bridgeStart = rangeStart + wallRunSpan(range, side, input.room) / 2 - bridgeWidth / 2;
  const bridgeSpot = wallPlacementAt(bridgeStart, bridgeWidth, bridgeDepth, side, input.room);
  return {
    ok: true,
    plan: {
      microwave,
      bridge,
      microwaveSpot,
      bridgeSpot,
      microwaveMountBottom: microwaveBottom,
      bridgeMountBottom: OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM,
      rangeUid: range.uid,
      rangeCode: range.masterCode,
    },
  };
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

/** True when the answer asks the build to place a microwave and bridge itself. */
export function answerWantsMicrowaveBridge(answer: OverRangeAnswer): boolean {
  return answer === "microwave-bridge";
}

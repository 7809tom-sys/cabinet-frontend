import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CROWN_MITER_ALLOWANCE_IN,
  DEFAULT_ROOM,
  makeDefaultSinkForCabinet,
  wallPlacementAt,
  syncWallRunOffsets,
  wallRunOffset,
  type DesignCabinet,
  type PlacedCabinet,
  type WallOpening,
} from "./design";
import { CROWN_MITER_CUT_ALLOWANCE_IN } from "./crownTakeoff";
import {
  DESIGNER_LAYOUT_RULES,
  AUTO_DESIGN_WIGGLE_ROOM_IN,
  REFRIGERATOR_SHIFT_LIMIT_IN,
  SINK_SHIFT_LIMIT_IN,
  activeAutoDesignWiggleMoves,
  applyDesignerLayoutRules,
  applyAutoDesignWiggleRoom,
  crownMiterCutAllowanceIn,
  enforceTrimSupplierContinuity,
  formatAutoDesignWiggleBadge,
  formatAutoDesignWiggleMessage,
  type AutoDesignAnchorOrigin,
} from "./designerLayoutRules";

const pageSource = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

function catalog(widths: number[]): DesignCabinet[] {
  return widths.map((width, index) => ({
    id: index + 1,
    masterCode: `B${width}`,
    description: `${width} inch base cabinet`,
    category: "Base",
    subCategory: "Base",
    width: String(width),
    height: "34.5",
    depth: "24",
    placement: "base",
    numberOfDoors: 1,
    numberOfDrawers: width >= 12 ? 1 : 0,
  })) as DesignCabinet[];
}

function rangeOnBottom(roomWidth: number, start: number, width = 30): { room: typeof DEFAULT_ROOM; item: PlacedCabinet } {
  const room = { ...DEFAULT_ROOM, width: roomWidth };
  const spot = wallPlacementAt(start, width, 26, "bottom", room);
  const item: PlacedCabinet = {
    uid: "range-1",
    cabinetId: 0,
    masterCode: "RANGE-30",
    description: "30 inch range",
    category: "Appliance",
    subCategory: "Appliance",
    placement: "appliance",
    x: spot.x,
    y: spot.y,
    width,
    depth: 26,
    height: 36,
    rotation: spot.rotation,
    wallId: spot.wallId,
    wallOffset: spot.wallOffset,
    mountBottom: 0,
    numberOfDoors: 0,
    numberOfDrawers: 0,
  };
  return { room, item };
}

function originFor(item: PlacedCabinet, kind: string, start: number): AutoDesignAnchorOrigin {
  return { uid: item.uid, kind, wallId: "bottom", originalStart: start };
}

describe("designer rule registry", () => {
  it("counts wiggle room with the other designer rules", () => {
    const ids = DESIGNER_LAYOUT_RULES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DESIGNER_LAYOUT_RULES.find((rule) => rule.id === "wiggle-room")).toMatchObject({
      name: "wiggle room",
      phase: "wiggle",
    });
    expect(ids).toEqual(expect.arrayContaining([
      "wiggle-room",
      "small-gap-filler",
      "filler-adjoining-finish",
      "nine-inch-tray-base",
      "trim-single-supplier",
      "crown-miter-allowance",
      "faucet-on-counter",
    ]));
    expect(AUTO_DESIGN_WIGGLE_ROOM_IN).toBe(3);
  });

  it("keeps the crown cut allowance at 4 inches", () => {
    expect(CROWN_MITER_ALLOWANCE_IN).toBe(4);
    expect(CROWN_MITER_CUT_ALLOWANCE_IN).toBe(4);
    expect(crownMiterCutAllowanceIn()).toBe(4);
  });
});

describe("auto-design wiggle room", () => {
  it("shifts an appliance to the smallest move that removes the filler", () => {
    const { room, item } = rangeOnBottom(120, 45);
    const beforeY = item.y;
    const result = applyAutoDesignWiggleRoom({
      placed: [item],
      room,
      openings: [],
      catalog: catalog([36, 30, 24, 18, 12]),
      origins: [originFor(item, "stove", 45)],
    });
    const moved = result.placed.find((candidate) => candidate.uid === item.uid)!;
    expect(wallRunOffset(moved, "bottom", room)).toBeCloseTo(42, 5);
    expect(result.moves).toHaveLength(1);
    expect(result.moves[0]).toMatchObject({ deltaAlongIn: -3, distanceFromOriginalIn: 3, toStart: 42 });
    expect(Math.abs(result.moves[0]!.distanceFromOriginalIn)).toBeLessThanOrEqual(3);
    expect(moved.wallId).toBe("bottom");
    expect(moved.y).toBe(beforeY);
    expect(moved.mountBottom).toBe(0);
  });

  it("stops at 3 inches when the exact cabinet fit is farther away", () => {
    const { room, item } = rangeOnBottom(77, 15);
    const result = applyAutoDesignWiggleRoom({
      placed: [item],
      room,
      openings: [],
      catalog: catalog([36]),
      origins: [originFor(item, "stove", 15)],
    });
    const moved = result.placed.find((candidate) => candidate.uid === item.uid)!;
    const start = wallRunOffset(moved, "bottom", room);
    expect(start).toBeCloseTo(12, 5);
    expect(Math.abs(start - 15)).toBeLessThanOrEqual(3);
    expect(Math.abs(start - 11)).toBeGreaterThan(0.5);
    expect(moved.y).toBe(item.y);
    expect(moved.wallId).toBe(item.wallId);
  });

  it("moves a refrigerator up to 6 inches and keeps a sink inside 3 inches", () => {
    expect(REFRIGERATOR_SHIFT_LIMIT_IN).toBe(6);
    expect(SINK_SHIFT_LIMIT_IN).toBe(3);
    const { room, item } = rangeOnBottom(77, 15);
    const fridge = { ...item, uid: "fridge-1" };
    const fridgeResult = applyAutoDesignWiggleRoom({
      placed: [fridge],
      room,
      openings: [],
      catalog: catalog([36]),
      origins: [originFor(fridge, "refrigerator", 15)],
    });
    const fridgeStart = wallRunOffset(fridgeResult.placed[0]!, "bottom", room);
    expect(Math.abs(fridgeStart - 15)).toBeLessThanOrEqual(6);
    expect(Math.abs(fridgeStart - 15)).toBeGreaterThan(3);
    expect(fridgeStart).toBeLessThan(12);
    expect(fridgeResult.moves[0]).toMatchObject({
      kind: "refrigerator",
      applianceType: "refrigerator",
      label: "Refrigerator",
      direction: "left",
    });

    const sink = { ...item, uid: "sink-1" };
    const sinkResult = applyAutoDesignWiggleRoom({
      placed: [sink],
      room,
      openings: [],
      catalog: catalog([36]),
      origins: [originFor(sink, "sink", 15)],
    });
    const sinkStart = wallRunOffset(sinkResult.placed[0]!, "bottom", room);
    expect(Math.abs(sinkStart - 15)).toBeLessThanOrEqual(3);
    expect(Math.abs(sinkStart - 11)).toBeGreaterThan(0.5);
  });

  it("leaves an appliance where it is when the run is already an exact fit", () => {
    const { room, item } = rangeOnBottom(120, 36);
    const result = applyAutoDesignWiggleRoom({
      placed: [item],
      room,
      openings: [],
      catalog: catalog([36, 30, 24, 18, 12]),
      origins: [originFor(item, "stove", 36)],
    });
    const stayed = result.placed.find((candidate) => candidate.uid === item.uid)!;
    expect(wallRunOffset(stayed, "bottom", room)).toBeCloseTo(36, 5);
    expect(stayed.x).toBe(item.x);
    expect(stayed.y).toBe(item.y);
    expect(stayed.wallId).toBe("bottom");
    expect(result.moves).toEqual([]);
  });

  it("measures the 3-inch cap from the original placement after a corner nudge", () => {
    const { room, item } = rangeOnBottom(120, 46);
    const result = applyAutoDesignWiggleRoom({
      placed: [item],
      room,
      openings: [],
      catalog: catalog([36, 30, 24, 18, 12]),
      origins: [originFor(item, "stove", 45)],
    });
    const moved = result.placed.find((candidate) => candidate.uid === item.uid)!;
    expect(wallRunOffset(moved, "bottom", room)).toBeCloseTo(42, 5);
    expect(Math.abs(wallRunOffset(moved, "bottom", room) - 45)).toBeLessThanOrEqual(3);
  });

  it("does not pull a sink off a modeled window", () => {
    const room = { ...DEFAULT_ROOM, width: 120 };
    const spot = wallPlacementAt(45, 36, 24, "bottom", room);
    const sink: PlacedCabinet = {
      uid: "sink-1",
      cabinetId: 4,
      masterCode: "SB-36",
      description: "Sink Base 36",
      placement: "base",
      x: spot.x,
      y: spot.y,
      width: 36,
      depth: 24,
      height: 34.5,
      rotation: spot.rotation,
      wallId: spot.wallId,
      wallOffset: spot.wallOffset,
      mountBottom: 0,
      numberOfDoors: 2,
      numberOfDrawers: 0,
    };
    const window: WallOpening = {
      uid: "window-1",
      kind: "window",
      label: "Sink window",
      side: "bottom",
      offset: 45,
      width: 36,
      height: 36,
      sill: 42,
    };
    const result = applyAutoDesignWiggleRoom({
      placed: [sink],
      room,
      openings: [window],
      catalog: catalog([36, 30, 24, 18, 12]),
      origins: [originFor(sink, "sink", 45)],
    });
    expect(wallRunOffset(result.placed[0]!, "bottom", room)).toBeCloseTo(45, 5);
    expect(result.moves).toEqual([]);
    expect(result.placed[0]!.y).toBe(sink.y);
  });

  it("reports nothing when the range already fits and no shift is needed", () => {
    const { room, item } = rangeOnBottom(120, 36);
    const result = applyAutoDesignWiggleRoom({
      placed: [item],
      room,
      openings: [],
      catalog: catalog([36, 30, 24, 18, 12]),
      origins: [originFor(item, "stove", 36)],
    });
    expect(result.moves).toEqual([]);
    expect(wallRunOffset(result.placed[0]!, "bottom", room)).toBeCloseTo(36, 5);
  });

  it("reports a 2 inch right nudge when a 36 inch lazy Susan forces the range to move", () => {
    const room = { ...DEFAULT_ROOM, width: 144 };
    const susanSpot = wallPlacementAt(0, 36, 36, "bottom", room);
    const susan: PlacedCabinet = {
      uid: "ls-36",
      cabinetId: 36,
      masterCode: "LSB36",
      description: '36" Lazy Susan Corner Base',
      category: "Base",
      subCategory: "Corner",
      placement: "base",
      cornerType: "lazy-susan",
      x: susanSpot.x,
      y: susanSpot.y,
      width: 36,
      depth: 36,
      height: 34.5,
      rotation: susanSpot.rotation,
      wallId: susanSpot.wallId,
      wallOffset: susanSpot.wallOffset,
      numberOfDoors: 2,
      numberOfDrawers: 0,
    };
    const rangeSpot = wallPlacementAt(34, 30, 26, "bottom", room);
    const range: PlacedCabinet = {
      uid: "range-1",
      cabinetId: 0,
      masterCode: "RANGE-30",
      description: "30 inch range",
      category: "Appliance",
      subCategory: "Appliance",
      placement: "appliance",
      x: rangeSpot.x,
      y: rangeSpot.y,
      width: 30,
      depth: 26,
      height: 36,
      rotation: rangeSpot.rotation,
      wallId: rangeSpot.wallId,
      wallOffset: rangeSpot.wallOffset,
      mountBottom: 0,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    };
    const result = applyAutoDesignWiggleRoom({
      placed: [susan, range],
      room,
      openings: [],
      catalog: catalog([36, 30, 24, 18, 15, 12]),
      origins: [originFor(range, "stove", 34)],
    });
    expect(result.moves).toHaveLength(1);
    const move = result.moves[0]!;
    expect(move).toMatchObject({
      uid: "range-1",
      kind: "stove",
      applianceType: "stove",
      label: "Range",
      wallId: "bottom",
      wallLabel: "bottom wall",
      direction: "right",
      inchesMoved: 2,
      deltaAlongIn: 2,
      originalPositionIn: 34,
      newPositionIn: 36,
      fromStart: 34,
      toStart: 36,
      reason: {
        uid: "ls-36",
        masterCode: "LSB36",
        label: '36" lazy Susan',
        widthIn: 36,
      },
    });
    expect(move.distanceFromOriginalIn).toBeLessThanOrEqual(3);
    expect(wallRunOffset(result.placed.find((item) => item.uid === "range-1")!, "bottom", room)).toBeCloseTo(36, 5);
    expect(result.placed.find((item) => item.uid === "ls-36")!.wallOffset).toBe(susan.wallOffset);
    expect(formatAutoDesignWiggleMessage(move)).toBe('Wiggle room applied: Range moved 2" right to fit the 36" lazy Susan');
    expect(formatAutoDesignWiggleBadge(move)).toBe('Moved 2" →');
    expect(activeAutoDesignWiggleMoves(result.moves, result.placed, room)).toEqual(result.moves);
    expect(activeAutoDesignWiggleMoves(result.moves, syncWallRunOffsets(result.placed, room), room)).toEqual(result.moves);
    const nudged = result.placed.find((item) => item.uid === "range-1")!;
    const manuallyMoved = { ...nudged, wallOffset: (nudged.wallOffset ?? 36) + 1, x: nudged.x + 1 };
    expect(activeAutoDesignWiggleMoves(result.moves, [susan, manuallyMoved], room)).toEqual([]);
    expect(activeAutoDesignWiggleMoves(result.moves, [susan], room)).toEqual([]);
  });
});

describe("shared designer layout rules", () => {
  it("fills a small seam with the adjoining cabinet's finish", () => {
    const room = { ...DEFAULT_ROOM, width: 144 };
    const left: PlacedCabinet = {
      uid: "erb36-corner",
      cabinetId: 1,
      masterCode: "ERB36",
      description: "Easy Reach Corner Base 36",
      placement: "base",
      x: 0,
      y: 0,
      width: 36,
      depth: 24,
      height: 34.5,
      rotation: 0,
      styleId: 11,
      numberOfDoors: 1,
      numberOfDrawers: 0,
    };
    const right: PlacedCabinet = {
      uid: "b18-next-to-erb36",
      cabinetId: 2,
      masterCode: "B18",
      description: "18 inch Base Cabinet",
      placement: "base",
      x: 38.5,
      y: 0,
      width: 18,
      depth: 24,
      height: 34.5,
      rotation: 0,
      styleId: 33,
      numberOfDoors: 1,
      numberOfDrawers: 1,
    };
    const distant: PlacedCabinet = {
      uid: "distant-wall",
      cabinetId: 3,
      masterCode: "W3012",
      description: "30 inch wall cabinet",
      placement: "wall",
      x: 80,
      y: 0,
      width: 30,
      depth: 12,
      height: 30,
      rotation: 0,
      mountBottom: 54,
      styleId: 22,
      numberOfDoors: 2,
      numberOfDrawers: 0,
    };
    const result = applyDesignerLayoutRules({
      placed: [left, right, distant],
      room,
      openings: [],
      fillers: [{
        id: 90,
        masterCode: "BF3",
        description: "3 inch base filler",
        category: "Filler",
        subCategory: "Filler",
        width: "3",
        height: "34.5",
        depth: "24",
        catalogImageUrl: null,
      }],
      makeUid: (() => { let n = 0; return () => `fill-${++n}`; })(),
      styleId: 99,
    });
    const filler = result.placed.find((item) => item.cabinetId === 90);
    expect(filler).toBeTruthy();
    expect(filler!.width).toBeCloseTo(2.5, 3);
    const owner = result.placed.find((item) => item.uid === filler!.fillerForCabinetUid);
    expect(owner && [left.uid, right.uid].includes(owner.uid)).toBe(true);
    expect(filler!.styleId).toBe(owner!.styleId);
    expect([11, 33]).toContain(filler!.styleId);
    expect(filler!.styleId).not.toBe(22);
    expect(filler!.styleId).not.toBe(99);
    expect(filler!.fillerForCabinetUid).not.toBe(distant.uid);
    expect(result.appliedRuleIds).toContain("small-gap-filler");
    expect(result.appliedRuleIds).toContain("filler-adjoining-finish");
  });

  it("clears drawers on a 9-inch base and leaves a wider base alone", () => {
    const room = { ...DEFAULT_ROOM, width: 120 };
    const narrowSpot = wallPlacementAt(0, 9, 24, "bottom", room);
    const wideSpot = wallPlacementAt(12, 18, 24, "bottom", room);
    const narrow: PlacedCabinet = {
      uid: "b9",
      cabinetId: 9,
      masterCode: "B9",
      description: "9 inch base",
      placement: "base",
      ...narrowSpot,
      width: 9,
      depth: 24,
      height: 34.5,
      numberOfDoors: 1,
      numberOfDrawers: 2,
    };
    const wide: PlacedCabinet = {
      uid: "b18",
      cabinetId: 18,
      masterCode: "B18",
      description: "18 inch base",
      placement: "base",
      ...wideSpot,
      width: 18,
      depth: 24,
      height: 34.5,
      numberOfDoors: 1,
      numberOfDrawers: 1,
    };
    const result = applyDesignerLayoutRules({
      placed: [narrow, wide],
      room,
      openings: [],
      fillers: [],
      makeUid: () => "unused",
      styleId: null,
    });
    expect(result.placed.find((item) => item.uid === "b9")!.numberOfDrawers).toBe(0);
    expect(result.placed.find((item) => item.uid === "b18")!.numberOfDrawers).toBe(1);
  });

  it("uses one trim supplier for the whole project", () => {
    const mixed = enforceTrimSupplierContinuity([
      { id: "crown-1", kind: "crown", supplierId: "alpha", wallId: "top" },
      { id: "shoe-1", kind: "shoe", supplierId: "alpha", wallId: "top" },
      { id: "rail-1", kind: "light-rail", supplierId: "beta", wallId: "left" },
    ]);
    expect(mixed.map((piece) => piece.supplierId)).toEqual(["alpha", "alpha", "alpha"]);
    const tied = enforceTrimSupplierContinuity([
      { id: "mould-1", kind: "moulding", supplierId: "alpha", wallId: "bottom" },
      { id: "batten-1", kind: "batten", supplierId: "beta", wallId: "right" },
    ]);
    expect(tied.map((piece) => piece.supplierId)).toEqual(["alpha", "alpha"]);
  });

  it("keeps the default sink faucet on the countertop deck", () => {
    const sinkBase = {
      uid: "sink-base-36",
      cabinetId: 1,
      masterCode: "SB-36",
      description: "Sink Base 36",
      placement: "base",
      x: 24,
      y: 0,
      width: 36,
      depth: 24,
      height: 34.5,
      rotation: 0,
    } as PlacedCabinet;
    const fixture = makeDefaultSinkForCabinet(sinkBase, DEFAULT_ROOM, "double");
    expect(fixture.faucet).toBe(true);
    expect(fixture.faucetRearDeckOffsetIn).toBeGreaterThan(0);
  });
});

describe("auto-design completion wiring", () => {
  it("runs wiggle room and the shared rules inside the measured build", () => {
    const completion = pageSource.slice(pageSource.indexOf("const completeAutoDesignLayout"), pageSource.indexOf("const cancelAutoDesignCornerStage"));
    const corners = completion.indexOf("for (const slot of stage.slots)");
    const wiggle = completion.indexOf("applyAutoDesignWiggleRoom({");
    const bases = completion.indexOf("planAutoDesignBaseSegment({");
    const rules = completion.indexOf("applyDesignerLayoutRules({");
    const seams = completion.indexOf("fillAutoDesignLowerSeams({");
    const walls = completion.indexOf("buildAutoDesignWallCabinets({");
    const secondRules = completion.indexOf("applyDesignerLayoutRules({", rules + 1);
    const commit = completion.indexOf("setPlaced(working)");
    expect(wiggle).toBeGreaterThan(corners);
    expect(bases).toBeGreaterThan(wiggle);
    expect(rules).toBeGreaterThan(bases);
    expect(seams).toBeGreaterThan(rules);
    expect(walls).toBeGreaterThan(seams);
    expect(secondRules).toBeGreaterThan(walls);
    expect(commit).toBeGreaterThan(secondRules);
    expect(pageSource).toContain("anchorOrigins");
    expect(pageSource).toContain("Auto-Design will not move it.");
    expect(completion).toContain("closeSeams: true");
  });
});

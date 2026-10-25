import { describe, expect, it } from "vitest";
import { appendWallBuilderSegment, wallBuilderRoomGeometry, type WallBuilderSegment } from "./polygonRoom";
import {
	appendRefrigeratorEnclosurePlacements,
	commitIndependentCabinetCandidate,
	fitExplicitRefrigeratorOptionPlacements,
	refrigeratorBayRunMetrics,
	refrigeratorBayVerificationMetrics,
	wallPlacementAt,
	wallPlacementAtUnbounded,
	wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { buildDesignCabinetCartLines } from "./designCartLines";

const STYLE_ID = 330028;
const PRICES: Record<string, number> = { "FRIDGE-36": 0, WR3612: 210, REP2496: 145, B24: 260, B36: 330 };
const standardRoom: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

function drawnRoom(): RoomData {
  let segments: WallBuilderSegment[] = [];
  segments = appendWallBuilderSegment(segments, 144, "start");
  segments = appendWallBuilderSegment(segments, 144, "right45");
  segments = appendWallBuilderSegment(segments, 120, "right90");
  const result = wallBuilderRoomGeometry(segments);
  if (!result.room) throw new Error(result.error ?? "Expected a measured room path");
  return { ...result.room, ceilingHeight: 96 };
}

function body(uid: string, code: string, placement: PlacedCabinet["placement"], along: number, width: number, depth: number, height: number, wallId: string, room: RoomData): PlacedCabinet {
  const spot = wallPlacementAt(along, width, depth, wallId, room);
  return { uid, cabinetId: 1, masterCode: code, description: code, placement, x: spot.x, y: spot.y, width, depth, height, rotation: spot.rotation, wallId: spot.wallId, wallOffset: spot.wallOffset };
}

/** Each source part is created at its own coordinate; append validates but never shifts the refrigerator or neighbors. */
function independentLayout(room: RoomData, wallId: string, fridgeAlong: number, panels: "both" | "left" = "both") {
  const fridge = { ...body("fridge", "FRIDGE-36", "appliance", fridgeAlong, 36, 30, 70, wallId, room), cabinetId: 0, refrigeratorPanelMode: panels, refrigeratorOptionsChosen: true };
  const bay = refrigeratorBayRunMetrics(fridge, room);
  const cap = { ...body("cap", "WR3612", "wall", fridgeAlong, 36, 24, 12, wallId, room), mountBottom: 72, refrigeratorAssemblyId: fridge.uid, refrigeratorAssemblyRole: "bridge" as const };
  const panel = (side: "left" | "right") => {
    const along = side === "left" ? bay.openingStart - 0.75 : bay.openingEnd;
    const spot = wallPlacementAt(along, 0.75, 24, wallId, room);
    return { uid: `${side}-panel`, cabinetId: 2, masterCode: "REP2496", description: "Refrigerator End Panel", placement: "tall" as const, x: spot.x, y: spot.y, width: 0.75, depth: 24, height: 84, rotation: spot.rotation, wallId: spot.wallId, wallOffset: spot.wallOffset, customProfile: "refrigerator-end-panel", refrigeratorAssemblyId: fridge.uid, refrigeratorAssemblyRole: `${side}-panel` as const, mountBottom: 0 };
  };
  const result = appendRefrigeratorEnclosurePlacements([fridge], [cap, panel("left"), ...(panels === "both" ? [panel("right")] : [])], fridge.uid, room);
  expect(result.rejected).toEqual([]);
  return result.placed;
}

/** New refrigerator options may start just outside a run; fit only those selected parts, never a neighbor. */
function fittedEdgeLayout(room: RoomData, wallId: string) {
  const fridge = {
    ...body("fridge", "FRIDGE-36", "appliance", 0, 36, 30, 70, wallId, room),
    cabinetId: 0,
    refrigeratorPanelMode: "both" as const,
    refrigeratorOptionsChosen: true,
  };
  const cap = {
    ...body("cap", "WR3612", "wall", 0, 36, 24, 12, wallId, room),
    mountBottom: 72,
    refrigeratorAssemblyId: fridge.uid,
    refrigeratorAssemblyRole: "bridge" as const,
  };
  const panel = (side: "left" | "right") => {
    const along = side === "left" ? -1.25 : 36.5;
    const spot = wallPlacementAtUnbounded(along, 0.75, 24, wallId, room);
    return {
      ...body(`${side}-panel`, "REP2496", "tall", 0, 0.75, 24, 84, wallId, room),
      ...spot,
      wallOffset: along,
      mountBottom: 0,
      refrigeratorAssemblyId: fridge.uid,
      refrigeratorAssemblyRole: `${side}-panel` as const,
      customProfile: "refrigerator-end-panel",
    };
  };
  const fitted = fitExplicitRefrigeratorOptionPlacements([fridge], [cap, panel("left"), panel("right")], fridge.uid, room);
  const committed = appendRefrigeratorEnclosurePlacements(fitted.existing, fitted.additions, fridge.uid, room);
  expect(fitted.shiftIn).toBe(1.25);
  expect(committed.rejected).toEqual([]);
  return committed.placed;
}

function runReport(placed: PlacedCabinet[], room: RoomData, wallId: string) {
  const fridge = placed.find((item) => item.masterCode === "FRIDGE-36")!;
  return {
    parts: placed.map((item) => ({ code: item.masterCode, role: item.refrigeratorAssemblyRole ?? null, start: +wallRunOffset(item, wallId, room).toFixed(3), span: +wallRunSpan(item, wallId, room).toFixed(3), mountBottom: item.mountBottom ?? 0 })).sort((a, b) => a.start - b.start || a.code.localeCompare(b.code)),
    metrics: refrigeratorBayVerificationMetrics(placed, fridge, room),
  };
}

function cart(placed: PlacedCabinet[]) {
  return buildDesignCabinetCartLines({ placed, styleId: STYLE_ID, distributorId: 210001, tier: "homeowner", styleNameById: new Map([[STYLE_ID, "Proof"]]), unitPriceFor: (item) => PRICES[item.masterCode] ?? null })
    .map((line) => `${line.masterCode}x${line.quantity}`).sort();
}

describe("one engine: independent refrigerator parts in standard and Wall Builder rooms", () => {
  const drawn = drawnRoom();
  const [flatWall, angledWall, cornerWall] = (drawn.customWalls ?? []).map((wall) => wall.id) as [string, string, string];

  it("places the same explicit source parts on standard and flat drawn walls", () => {
    const standard = independentLayout(standardRoom, "top", 40);
    const continuous = independentLayout(drawn, flatWall, 40);
    expect(runReport(continuous, drawn, flatWall)).toEqual(runReport(standard, standardRoom, "top"));
    expect(cart(continuous)).toEqual(cart(standard));
  });

  it("uses identical run-relative positions and prices on a 45° Wall Builder wall", () => {
    const standard = independentLayout(standardRoom, "top", 40);
    const angled = independentLayout(drawn, angledWall, 40);
    expect(runReport(angled, drawn, angledWall)).toEqual(runReport(standard, standardRoom, "top"));
    expect(cart(angled)).toEqual(cart(standard));
  });

  it("fits explicitly selected panels at a wall start identically on standard and 45° Wall Builder walls", () => {
    const standard = fittedEdgeLayout(standardRoom, "top");
    const angled = fittedEdgeLayout(drawn, angledWall);
    expect(runReport(angled, drawn, angledWall)).toEqual(runReport(standard, standardRoom, "top"));
    expect(runReport(angled, drawn, angledWall).parts).toEqual([
      expect.objectContaining({ code: "REP2496", role: "left-panel", start: 0 }),
      expect.objectContaining({ code: "FRIDGE-36", role: null, start: 1.25 }),
      expect.objectContaining({ code: "WR3612", role: "bridge", start: 1.25 }),
      expect.objectContaining({ code: "REP2496", role: "right-panel", start: 37.75 }),
    ]);
  });

  it("accepts an explicit panel at an inside corner only when its measured span fits", () => {
    const standard = independentLayout(standardRoom, "right", 1.25);
    const drawnCorner = independentLayout(drawn, cornerWall, 1.25);
    expect(runReport(drawnCorner, drawn, cornerWall)).toEqual(runReport(standard, standardRoom, "right"));
    expect(runReport(drawnCorner, drawn, cornerWall).parts.find((part) => part.role === "left-panel")?.start).toBe(0);
  });

  it("moves only the refrigerator, leaving explicitly selected panels and cap at their own coordinates", () => {
    for (const [room, wallId] of [[standardRoom, "top"], [drawn, angledWall]] as const) {
      const placed = independentLayout(room, wallId, 40);
      const fridge = placed.find((item) => item.masterCode === "FRIDGE-36")!;
      const movedSpot = wallPlacementAt(72, 36, 30, wallId, room);
      const moved = commitIndependentCabinetCandidate(placed, { ...fridge, ...movedSpot });
      expect(wallRunOffset(moved.find((item) => item.uid === fridge.uid)!, wallId, room)).toBeCloseTo(72, 3);
      for (const part of placed.filter((item) => item.uid !== fridge.uid)) {
        expect(moved.find((item) => item.uid === part.uid)).toBe(part);
      }
    }
  });
});

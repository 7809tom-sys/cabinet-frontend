import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/autoDesignRealCatalog.json";
import {
  anchoredRefrigeratorOf,
  buildAnchoredRefrigeratorBay,
  refrigeratorAnchorMeasurement,
  refrigeratorFloorReservation,
} from "./autoDesignRefrigeratorAnchor";
import {
  cabinetWall,
  wallPlacementAt,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";

const STYLE = "330011";
const REAL = catalogFixture as unknown as Record<string, { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[] }>;
const WALLS = REAL[STYLE]!.wall;
const ACCESSORY = REAL[STYLE]!.accessory;
const DEEP_CAPS = WALLS.filter((row) => Number(row.width) === 36 && Number(row.depth) >= 20);
const END_PANELS = ACCESSORY.filter((row) => /REPV|refrigerator end panel/i.test(`${row.masterCode} ${row.description ?? ""} ${row.subCategory ?? ""}`));

const room: RoomData = { width: 156, depth: 132, ceilingHeight: 96 };

function placeRefrigerator(along: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet {
  const spot = wallPlacementAt(along, 36, 30, "top", room);
  return {
    uid: "user-fridge",
    cabinetId: 0,
    masterCode: "FRIDGE-36",
    description: '36" Refrigerator',
    category: "Appliance",
    subCategory: "Appliance",
    placement: "appliance",
    applianceRole: "base-height",
    ...spot,
    width: 36,
    depth: 30,
    height: 70,
    mountBottom: 0,
    ...extra,
  };
}

let uidCounter = 0;
const makeUid = () => `anchor-bay-${++uidCounter}`;

function bayFor(refrigerator: PlacedCabinet, placed: readonly PlacedCabinet[] = [refrigerator]) {
  uidCounter = 0;
  return buildAnchoredRefrigeratorBay({
    placed,
    refrigerator,
    room,
    caps: DEEP_CAPS,
    endPanels: END_PANELS,
    styleId: Number(STYLE),
    makeUid,
    wallCabinetHeightIn: 30,
    framelessLine: false,
  });
}

describe("a refrigerator already on the plan is a fixed anchor", () => {
  it("finds the appliance on the plan", () => {
    const refrigerator = placeRefrigerator(48);
    expect(anchoredRefrigeratorOf([refrigerator])?.uid).toBe(refrigerator.uid);
    expect(anchoredRefrigeratorOf([])).toBeNull();
    // An end panel is not the appliance.
    expect(anchoredRefrigeratorOf([
      { ...refrigerator, uid: "panel", masterCode: "REPV2496", description: "Refrigerator End Panel", placement: "tall" } as PlacedCabinet,
    ])).toBeNull();
  });

  it("reports the refrigerator's real position in the measured wall-label datum", () => {
    const refrigerator = placeRefrigerator(48);
    const measurement = refrigeratorAnchorMeasurement({
      refrigerator,
      room,
      originCorner: "left",
      runDirection: "right",
    });
    // Wall 1 runs left to right from x=0, so the measured center is 48 + 18.
    expect(measurement).toEqual({ wallLabel: "Wall 1", centerOffsetIn: 66 });
    const reversed = refrigeratorAnchorMeasurement({
      refrigerator,
      room,
      originCorner: "left",
      runDirection: "left",
    });
    // Measured from the far end instead: 156 - 66.
    expect(reversed).toEqual({ wallLabel: "Wall 1", centerOffsetIn: 90 });
  });

  it("builds the panels and the cabinet above WITHOUT moving the refrigerator", () => {
    const refrigerator = placeRefrigerator(48);
    const before = { x: refrigerator.x, y: refrigerator.y, width: refrigerator.width, depth: refrigerator.depth, height: refrigerator.height };
    const bay = bayFor(refrigerator);
    const after = bay.placed.find((item) => item.uid === refrigerator.uid)!;
    // Same object, same geometry: the appliance is never re-seated or clamped.
    expect(after).toBe(refrigerator);
    expect({ x: after.x, y: after.y, width: after.width, depth: after.depth, height: after.height }).toEqual(before);
    expect(bay.additions.map((item) => item.refrigeratorAssemblyRole).sort()).toEqual(["bridge", "left-panel", "right-panel"]);
  });

  it("reserves the appliance's floor span plus its panels so no run can cover it", () => {
    const refrigerator = placeRefrigerator(48);
    const bay = bayFor(refrigerator);
    const floor = refrigeratorFloorReservation(refrigerator, room)!;
    expect(floor).toEqual({ wall: "top", start: 48, end: 84 });
    expect(bay.reservation).not.toBeNull();
    expect(bay.reservation!.wall).toBe("top");
    // The reserved span is strictly wider than the appliance alone: the panels
    // are part of the bay, so no base run or filler may land on them.
    expect(bay.reservation!.start).toBeLessThan(floor.start);
    expect(bay.reservation!.end).toBeGreaterThan(floor.end);
    // The reserved span really contains the appliance and every panel.
    for (const piece of bay.additions) {
      const start = wallRunOffset(piece, "top", room);
      expect(start).toBeGreaterThanOrEqual(bay.reservation!.start - 0.05);
      expect(start + wallRunSpan(piece, "top", room)).toBeLessThanOrEqual(bay.reservation!.end + 0.05);
    }
  });

  it("keeps a deep counter-depth refrigerator at its own depth instead of clamping it", () => {
    const refrigerator = placeRefrigerator(48, { depth: 30 });
    const bay = bayFor(refrigerator);
    const after = bay.placed.find((item) => item.uid === refrigerator.uid)!;
    // The appliance is never re-seated: its depth and its wall position are its own.
    expect(after.depth).toBe(30);
    expect(after.y).toBe(refrigerator.y);
    expect(bay.notes.join(" ")).toMatch(/finish at the panel line/);
  });

  it("omits a corner-side panel that would leave the wall, and says so", () => {
    // Flush to the wall start: there is no run for a left panel.
    const refrigerator = placeRefrigerator(0);
    const bay = bayFor(refrigerator);
    const roles = bay.additions.map((item) => item.refrigeratorAssemblyRole);
    expect(roles).not.toContain("left-panel");
    expect(roles).toContain("right-panel");
    expect(bay.placed.find((item) => item.uid === refrigerator.uid)).toBe(refrigerator);
    expect(bay.notes.join(" ")).toMatch(/closed corner side/);
  });

  it("omits a panel where a cabinet already stands instead of moving the refrigerator", () => {
    const refrigerator = placeRefrigerator(48);
    const spot = wallPlacementAt(30, 18, 24, "top", room);
    const neighbor: PlacedCabinet = {
      uid: "b18",
      cabinetId: 1,
      masterCode: "B18",
      description: '18" Base Cabinet',
      category: "Base",
      subCategory: "Base",
      placement: "base",
      ...spot,
      width: 18,
      depth: 24,
      height: 34.5,
      mountBottom: 0,
    };
    const bay = bayFor(refrigerator, [refrigerator, neighbor]);
    const roles = bay.additions.map((item) => item.refrigeratorAssemblyRole);
    expect(roles).not.toContain("left-panel");
    expect(bay.placed.find((item) => item.uid === refrigerator.uid)).toBe(refrigerator);
    const b18 = bay.placed.find((item) => item.uid === "b18")!;
    expect(wallRunOffset(b18, "top", room)).toBe(30);
    expect(bay.notes.join(" ")).toMatch(/already stands at that side/);
  });

  it("falls back to the appliance's own floor span when no surround can be built", () => {
    uidCounter = 0;
    const refrigerator = placeRefrigerator(48, { width: 39 });
    const bay = buildAnchoredRefrigeratorBay({
      placed: [refrigerator],
      refrigerator,
      room,
      caps: [],
      endPanels: [],
      styleId: Number(STYLE),
      makeUid,
    });
    expect(bay.additions).toEqual([]);
    expect(bay.placed).toEqual([refrigerator]);
    expect(bay.reservation).toEqual({ wall: "top", start: 48, end: 87 });
    expect(bay.notes.join(" ")).toMatch(/The refrigerator itself stays exactly where it is/);
  });

  it("keeps the appliance inside every wall frame it can stand on", () => {
    for (const wall of ["top", "bottom", "left", "right"] as const) {
      const frame = wallRunFrame(wall, room)!;
      const start = Math.max(0, wallRunOffset(placeRefrigerator(48), wall, room));
      const spot = wallPlacementAt(start, 36, 30, wall, room);
      const refrigerator = placeRefrigerator(0, { ...spot, wallId: spot.wallId, wallOffset: spot.wallOffset, rotation: spot.rotation });
      const bay = bayFor(refrigerator);
      expect(cabinetWall(refrigerator, room)).toBe(wall);
      expect(bay.placed.find((item) => item.uid === refrigerator.uid)).toBe(refrigerator);
      for (const panel of bay.additions.filter((item) => item.refrigeratorAssemblyRole?.endsWith("panel"))) {
        const panelStart = wallRunOffset(panel, wall, room);
        expect(panelStart).toBeGreaterThanOrEqual(-0.05);
        expect(panelStart + wallRunSpan(panel, wall, room)).toBeLessThanOrEqual(frame.length + 0.05);
      }
    }
  });
});

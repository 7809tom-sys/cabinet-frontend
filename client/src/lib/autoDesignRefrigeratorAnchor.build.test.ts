import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import type { DesignCabinet, PlacedCabinet, RoomData } from "./design";
import {
  cabinetWall,
  elevationBox,
  placedFootprint,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
} from "./design";
import { runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import { anchoredRefrigeratorOf, refrigeratorFloorReservation } from "./autoDesignRefrigeratorAnchor";

type Pack = { base: unknown[]; wall: unknown[]; accessory: unknown[] };
const REAL = realCatalog as unknown as Record<string, Pack>;
const STYLE = "330011";
const BASES = REAL[STYLE]!.base as DesignCabinet[];
const WALLS = REAL[STYLE]!.wall as DesignCabinet[];
const ACCESSORY = REAL[STYLE]!.accessory as DesignCabinet[];
const FILLERS = ACCESSORY.filter((row) => /filler/i.test(`${row.masterCode} ${row.description ?? ""}`));
const END_PANELS = ACCESSORY.filter((row) => /REPV|refrigerator end panel/i.test(`${row.masterCode} ${row.description ?? ""} ${row.subCategory ?? ""}`));
const DEEP_CAPS = WALLS.filter((row) => Number(row.width) === 36 && Number(row.depth) >= 20);

function room(): RoomData {
  return { width: 168, depth: 132, ceilingHeight: 96 } as RoomData;
}

const APPLIANCE_PALETTE = [
  { id: 0, masterCode: "RANGE-30", description: '30" Range', category: "Appliance", subCategory: "Appliance", width: "30", height: "36", depth: "25", placement: "appliance" } as DesignCabinet,
  { id: 0, masterCode: "DW-24", description: '24" Dishwasher', category: "Appliance", subCategory: "Appliance", width: "24", height: "34.5", depth: "24", placement: "appliance" } as DesignCabinet,
  { id: 0, masterCode: "FRIDGE-36", description: '36" Refrigerator', category: "Appliance", subCategory: "Appliance", width: "36", height: "70", depth: "30", placement: "appliance" } as DesignCabinet,
];

function inputs(overrides: Partial<AutoDesignInputs> = {}): AutoDesignInputs {
  return {
    layoutType: "single-wall",
    originCorner: "left",
    runDirection: "right",
    wallCabinetHeightIn: 30,
    sink: { wallLabel: "Wall 1", centerOffsetIn: 24 },
    sinkBaseWidthIn: 36,
    sinkBaseKind: "regular",
    stove: { wallLabel: "Wall 1", centerOffsetIn: 66 },
    skipDishwasher: true,
    dishwasher: null,
    // A refrigerator placed by hand: the dialog's own measurement is ignored.
    refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 138 },
    ...overrides,
  };
}

/** The refrigerator a person already put on the plan, on Wall 1 (the physical top wall). */
function placedRefrigerator(insideRoom: RoomData, along: number): PlacedCabinet {
  const spot = wallPlacementAt(along, 36, 30, "top", insideRoom);
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
    rotation: spot.rotation,
  };
}

let uid = 0;

function build(options: {
  insideRoom?: RoomData;
  refrigeratorAlong?: number;
  inputOverrides?: Partial<AutoDesignInputs>;
} = {}): { result: AutoDesignLayoutSuccess; refrigerator: PlacedCabinet } {
  uid = 0;
  const insideRoom = options.insideRoom ?? room();
  const refrigerator = placedRefrigerator(insideRoom, options.refrigeratorAlong ?? 96);
  const result = runAutoDesignLayout({
    input: inputs(options.inputOverrides),
    room: insideRoom,
    openings: [],
    baseCatalog: BASES,
    wallCatalog: WALLS,
    fillers: FILLERS,
    appliancePalette: APPLIANCE_PALETTE,
    refrigeratorCaps: DEEP_CAPS,
    refrigeratorEndPanels: END_PANELS,
    styleId: Number(STYLE),
    makeUid: () => `uid-${++uid}`,
    preExistingPlacements: [refrigerator],
    anchoredRefrigerator: refrigerator,
  });
  if (!result.ok) throw new Error(result.message);
  return { result, refrigerator };
}

/** True when two placed bodies share real 3D volume. */
function bodiesOverlap(a: PlacedCabinet, b: PlacedCabinet, insideRoom: RoomData): boolean {
  const aBox = elevationBox(a, insideRoom);
  const bBox = elevationBox(b, insideRoom);
  const aFoot = placedFootprint(a);
  const bFoot = placedFootprint(b);
  const overlapX = Math.min(a.x + aFoot.w, b.x + bFoot.w) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + aFoot.d, b.y + bFoot.d) - Math.max(a.y, b.y);
  const overlapZ = Math.min(aBox.bottom + aBox.height, bBox.bottom + bBox.height) - Math.max(aBox.bottom, bBox.bottom);
  return overlapX > 0.05 && overlapY > 0.05 && overlapZ > 0.05;
}

describe("Auto-Design designs around a refrigerator that is already placed", () => {
  it("builds a full kitchen and keeps the refrigerator where it was placed", () => {
    const insideRoom = room();
    const { result, refrigerator } = build({ insideRoom });
    const after = result.placed.find((item) => item.uid === refrigerator.uid);
    // The appliance survives the whole build: one record, on its own wall, at its
    // own along-wall position and width. Only the existing refrigerator-panel rule
    // brings its drawn depth to the end-panel face (the same rule the measured
    // build has always applied), and the plan says so.
    expect(after).toBeTruthy();
    expect(result.placed.filter((item) => item.uid === refrigerator.uid)).toHaveLength(1);
    expect(after!.wallId).toBe(refrigerator.wallId);
    expect(after!.wallOffset).toBe(refrigerator.wallOffset);
    expect(after!.x).toBe(refrigerator.x);
    expect(after!.y).toBe(refrigerator.y);
    expect(after!.width).toBe(refrigerator.width);
    expect(after!.height).toBe(refrigerator.height);
    expect(after!.depth).toBeLessThanOrEqual(refrigerator.depth);
    expect(result.notes.join(" ")).toMatch(/finish at the panel line/);
    // Its floor span is unchanged: the same along-wall start and end.
    expect(refrigeratorFloorReservation(after!, insideRoom)).toEqual(refrigeratorFloorReservation(refrigerator, insideRoom));
    // A real kitchen really was designed around it.
    const baseCabinets = result.placed.filter((item) => item.placement === "base" || item.placement === "appliance");
    expect(baseCabinets.length).toBeGreaterThan(3);
    expect(result.placed.some((item) => item.placement === "wall")).toBe(true);
    expect(result.notes.join(" ")).toMatch(/fixed anchor/);
  });

  it("never puts a cabinet, filler, or panel on the refrigerator's floor space", () => {
    const insideRoom = room();
    const { result, refrigerator } = build({ insideRoom });
    const reserved = refrigeratorFloorReservation(refrigerator, insideRoom)!;
    const floor = result.placed.filter((item) => (
      item.uid !== refrigerator.uid
      && item.refrigeratorAssemblyId !== refrigerator.uid
      && (item.placement === "base" || item.placement === "appliance" || item.placement === "tall")
      && cabinetWall(item, insideRoom) === reserved.wall
    ));
    for (const piece of floor) {
      const start = wallRunOffset(piece, reserved.wall, insideRoom);
      const end = start + wallRunSpan(piece, reserved.wall, insideRoom);
      const overlaps = start < reserved.end - 0.05 && end > reserved.start + 0.05;
      expect(overlaps, `${piece.masterCode} covers the refrigerator's floor space`).toBe(false);
    }
  });

  it("leaves no cabinet body overlapping the refrigerator itself", () => {
    const insideRoom = room();
    const { result, refrigerator } = build({ insideRoom });
    const after = result.placed.find((item) => item.uid === refrigerator.uid)!;
    for (const piece of result.placed) {
      if (piece.uid === after.uid) continue;
      if (piece.refrigeratorAssemblyId === after.uid) continue;
      if (piece.placement === "wall") continue;
      expect(bodiesOverlap(piece, after, insideRoom), `${piece.masterCode} overlaps the refrigerator`).toBe(false);
    }
  });

  it("keeps the refrigerator on its measured wall even when the dialog names another", () => {
    // The dialog says Wall 3; the appliance stands on Wall 1 (the top wall).
    const insideRoom = room();
    const { result, refrigerator } = build({
      insideRoom,
      inputOverrides: { refrigerator: { wallLabel: "Wall 3", centerOffsetIn: 40 } },
    });
    const after = result.placed.find((item) => item.uid === refrigerator.uid)!;
    expect(cabinetWall(after, insideRoom)).toBe("top");
    expect(wallRunOffset(after, "top", insideRoom)).toBe(96);
  });

  it("keeps the refrigerator on the plan even when the dialog asked for no refrigerator", () => {
    const insideRoom = room();
    const { result, refrigerator } = build({
      insideRoom,
      inputOverrides: { refrigerator: null },
    });
    const after = result.placed.find((item) => item.uid === refrigerator.uid)!;
    expect(cabinetWall(after, insideRoom)).toBe("top");
    expect(wallRunOffset(after, "top", insideRoom)).toBe(96);
    // The bay is still built around it, so nothing can be placed on the appliance.
    expect(result.placed.filter((item) => item.refrigeratorAssemblyId === refrigerator.uid).length).toBeGreaterThan(0);
  });

  it("still builds beside a refrigerator pushed flush into a corner", () => {
    const insideRoom = room();
    // The appliance owns the wall start; the runs get the rest of the wall.
    const { result, refrigerator } = build({
      insideRoom,
      refrigeratorAlong: 0,
      inputOverrides: {
        sink: { wallLabel: "Wall 1", centerOffsetIn: 110 },
        stove: { wallLabel: "Wall 1", centerOffsetIn: 60 },
      },
    });
    const after = result.placed.find((item) => item.uid === refrigerator.uid)!;
    expect(after.wallId).toBe(refrigerator.wallId);
    expect(wallRunOffset(after, "top", insideRoom)).toBe(0);
    // The closed corner side has no panel: the adjoining wall closes it.
    expect(result.placed.filter((item) => item.refrigeratorAssemblyRole === "left-panel")).toHaveLength(0);
    expect(result.placed.filter((item) => item.refrigeratorAssemblyRole === "right-panel")).toHaveLength(1);
    // Nothing on the floor layer runs into the refrigerator's own footprint.
    for (const piece of result.placed.filter((item) => item.placement === "base" || item.placement === "appliance")) {
      if (piece.uid === after.uid) continue;
      expect(bodiesOverlap(piece, after, insideRoom), `${piece.masterCode} overlaps the corner refrigerator`).toBe(false);
    }
  });

  it("keeps a tall cabinet beside the refrigerator valid", () => {
    const insideRoom = room();
    const tall = (REAL[STYLE]!.accessory as DesignCabinet[]).find((row) => row.placement === "tall" && Number(row.width) === 24)
      ?? (REAL[STYLE]!.accessory as DesignCabinet[]).find((row) => row.placement === "tall");
    if (!tall) return;
    const { result, refrigerator } = build({
      insideRoom,
      inputOverrides: { tallCabinets: [{ cabinetId: tall.id, masterCode: tall.masterCode }] },
    });
    const after = result.placed.find((item) => item.uid === refrigerator.uid)!;
    expect(after.wallId).toBe(refrigerator.wallId);
    // The appliance is never moved, re-sized, or duplicated by the tall pass.
    expect({ x: after.x, width: after.width, height: after.height })
      .toEqual({ x: refrigerator.x, width: refrigerator.width, height: refrigerator.height });
    const reserved = refrigeratorFloorReservation(refrigerator, insideRoom)!;
    for (const tower of result.placed.filter((item) => item.placement === "tall" && item.refrigeratorAssemblyId == null)) {
      if (cabinetWall(tower, insideRoom) !== reserved.wall) continue;
      const start = wallRunOffset(tower, reserved.wall, insideRoom);
      expect(start < reserved.end - 0.05 && start + wallRunSpan(tower, reserved.wall, insideRoom) > reserved.start + 0.05).toBe(false);
    }
  });

  it("keeps the refrigerator bay's own cabinet above inside the end panels", () => {
    const insideRoom = room();
    const { result, refrigerator } = build({ insideRoom });
    const panels = result.placed.filter((item) => item.refrigeratorAssemblyRole?.endsWith("panel"));
    expect(panels.length).toBeGreaterThan(0);
    const bridge = result.placed.find((item) => item.refrigeratorAssemblyRole === "bridge");
    expect(bridge).toBeTruthy();
    const bayStart = Math.min(...panels.map((panel) => wallRunOffset(panel, "top", insideRoom)));
    const bayEnd = Math.max(...panels.map((panel) => wallRunOffset(panel, "top", insideRoom) + wallRunSpan(panel, "top", insideRoom)));
    const bridgeStart = wallRunOffset(bridge!, "top", insideRoom);
    expect(bridgeStart).toBeGreaterThanOrEqual(bayStart - 0.05);
    expect(bridgeStart + wallRunSpan(bridge!, "top", insideRoom)).toBeLessThanOrEqual(bayEnd + 0.05);
    // The appliance is still where it was placed.
    expect(result.placed.find((item) => item.uid === refrigerator.uid)!.wallOffset).toBe(refrigerator.wallOffset);
  });

  it("anchors the refrigerator through the shared helper the Designer uses", () => {
    const insideRoom = room();
    const refrigerator = placedRefrigerator(insideRoom, 96);
    expect(anchoredRefrigeratorOf([refrigerator, ...BASES.slice(0, 2).map((row) => ({ ...row, uid: `x-${row.id}` } as unknown as PlacedCabinet))])?.uid).toBe(refrigerator.uid);
  });
});

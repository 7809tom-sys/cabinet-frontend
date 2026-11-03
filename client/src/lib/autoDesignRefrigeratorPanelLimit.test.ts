/**
 * Owner item 3, the repeat bug: nothing may extend past the refrigerator end
 * panel, not even slightly — and that includes the wall cabinets and fillers
 * along the same wall, not only the floor cabinets.
 *
 * The build clamps the floor layer (`clampPlacedToRefrigeratorPanels` runs inside
 * `applyDesignerLayoutRules`), but the upper layer is tiled afterwards and was
 * never clamped, so a 24-inch-deep upper plus its filler could run through the
 * tall panel. These tests pin the rule on a real measured build and on the wall
 * layer directly.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import type { DesignCabinet, PlacedCabinet, RoomData, WallSide } from "./design";
import {
  cabinetWall,
  placedHeight,
  refrigeratorPanelOuterStops,
  wallRunOffset,
  wallRunSpan,
} from "./design";
import { runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import { clampPlacedToRefrigeratorPanels } from "./design";

type Pack = { base: unknown[]; wall: unknown[]; accessory: unknown[] };
const STYLE = "330011";
const REAL = realCatalog as unknown as Record<string, Pack>;
const BASES = REAL[STYLE]!.base as DesignCabinet[];
const WALLS = REAL[STYLE]!.wall as DesignCabinet[];
const FILLERS = (REAL[STYLE]!.accessory as DesignCabinet[]).filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`));

function room(): RoomData {
  return { width: 150, depth: 150, ceilingHeight: 96, openWallPath: false } as RoomData;
}

function inputs(overrides: Partial<AutoDesignInputs> = {}): AutoDesignInputs {
  return {
    layoutType: "u-shape",
    originCorner: "left",
    runDirection: "right",
    wallCabinetHeightIn: 30,
    sink: { wallLabel: "Wall 1", centerOffsetIn: 75 },
    sinkBaseWidthIn: 36,
    sinkBaseKind: "regular",
    stove: { wallLabel: "Wall 2", centerOffsetIn: 75 },
    skipDishwasher: true,
    dishwasher: null,
    refrigerator: { wallLabel: "Wall 3", centerOffsetIn: 131 },
    refrigeratorWidthIn: 36,
    ...overrides,
  };
}

const APPLIANCES = [
  { id: 0, masterCode: "RANGE-30", description: '30" Range', category: "Appliance", subCategory: "Appliance", width: "30", height: "36", depth: "25", placement: "appliance" } as DesignCabinet,
  { id: 0, masterCode: "DW-24", description: '24" Dishwasher', category: "Appliance", subCategory: "Appliance", width: "24", height: "34.5", depth: "24", placement: "appliance" } as DesignCabinet,
  { id: 0, masterCode: "FRIDGE-36", description: '36" Refrigerator', category: "Appliance", subCategory: "Appliance", width: "36", height: "70", depth: "30", placement: "appliance" } as DesignCabinet,
];

let uid = 0;
function build(overrides: Partial<AutoDesignInputs> = {}): AutoDesignLayoutSuccess {
  uid = 0;
  const deepAbove = WALLS.filter((row) => Number(row.width) === 36 && Number(row.depth) >= 20);
  const endPanels = (REAL[STYLE]!.accessory as DesignCabinet[]).filter((row) => /REPV|refrigerator end panel/i.test(`${row.masterCode} ${row.description}`));
  const result = runAutoDesignLayout({
    input: inputs(overrides),
    room: room(),
    openings: [],
    baseCatalog: BASES,
    wallCatalog: WALLS,
    fillers: FILLERS,
    appliancePalette: APPLIANCES,
    refrigeratorCaps: deepAbove,
    refrigeratorEndPanels: endPanels,
    styleId: 330011,
    makeUid: () => `uid-${++uid}`,
  });
  if (!result.ok) throw new Error(result.message);
  return result;
}

/** Every panel's outer stop, per wall, so a test can assert nothing crosses it. */
function panelStops(result: AutoDesignLayoutSuccess, roomData: RoomData) {
  return refrigeratorPanelOuterStops(result.placed, roomData);
}

describe("nothing extends past the refrigerator end panel", () => {
  it("keeps every wall cabinet and filler behind the panel on the refrigerator wall", () => {
    const roomData = room();
    const result = build();
    const stops = panelStops(result, roomData);
    expect(stops.length).toBeGreaterThan(0);
    const offenders = result.placed.filter((item) => {
      if (item.refrigeratorAssemblyRole) return false;
      const wallId = (item.wallId ?? cabinetWall(item, roomData)) as string;
      const stop = stops.find((entry) => entry.wallId === wallId);
      if (!stop) return false;
      const start = wallRunOffset(item, wallId, roomData);
      const end = start + wallRunSpan(item, wallId, roomData);
      // A piece that straddles an outer panel face is the bug.
      return (start < stop.outer - 0.02 && end > stop.outer + 0.02)
        || (stop.outerLow != null && start < stop.outerLow - 0.02 && end > stop.outerLow + 0.02);
    });
    expect(offenders.map((item) => `${item.masterCode}@${item.wallId}`)).toEqual([]);
  });

  it("drops or clamps a wall cabinet that would cross the panel instead of drawing it through", () => {
    const roomData = room();
    const fridge: PlacedCabinet = {
      uid: "fridge", cabinetId: 0, masterCode: "FRIDGE-36", description: "Refrigerator", placement: "appliance",
      x: 60, y: 0, width: 36, depth: 30, height: 70, rotation: 0, wallId: "top", wallOffset: 60,
      refrigeratorPanelMode: "both", refrigeratorOptionsChosen: true, refrigeratorAssemblyRole: "bridge",
    } as PlacedCabinet;
    const leftPanel: PlacedCabinet = {
      uid: "panel-left", cabinetId: 1, masterCode: "REPV2496", description: "Refrigerator end panel", placement: "tall",
      x: 60 - 0.75, y: 0, width: 0.75, depth: 24, height: 96, rotation: 0, wallId: "top", wallOffset: 60 - 0.75,
      refrigeratorAssemblyId: "fridge", refrigeratorAssemblyRole: "left-panel", customProfile: "refrigerator-end-panel",
    } as PlacedCabinet;
    const rightPanel: PlacedCabinet = {
      ...leftPanel, uid: "panel-right", x: 96, wallOffset: 96, refrigeratorAssemblyRole: "right-panel",
    } as PlacedCabinet;
    // A 24-inch-deep upper 6 inches into the left panel: the repeat bug.
    const crossingUpper: PlacedCabinet = {
      uid: "upper-crossing", cabinetId: 2, masterCode: "W301224", description: '30" × 12" × 24" Wall Cabinet',
      placement: "wall", x: 60 - 6, y: 0, width: 30, depth: 24, height: 12, rotation: 0,
      wallId: "top", wallOffset: 60 - 6, mountBottom: 54,
    } as PlacedCabinet;
    const clamped = clampPlacedToRefrigeratorPanels([fridge, leftPanel, rightPanel, crossingUpper], roomData);
    const still = clamped.placed.find((item) => item.uid === "upper-crossing");
    const start = still ? wallRunOffset(still, "top", roomData) : Infinity;
    const end = still ? start + wallRunSpan(still, "top", roomData) : Infinity;
    // Either it was removed, or it now stops at the panel face. Never through it.
    expect(still == null || end <= 60 - 0.75 + 0.02 || start >= 96 - 0.02).toBe(true);
  });

  it("keeps the upper layer inside the panel limit in the measured build", () => {
    const roomData = room();
    const result = build();
    const uppers = result.placed.filter((item) => item.placement === "wall" || item.placement === "tall");
    const stops = panelStops(result, roomData);
    for (const upper of uppers) {
      if (upper.refrigeratorAssemblyRole) continue;
      const wallId = cabinetWall(upper, roomData);
      const stop = stops.find((entry) => entry.wallId === wallId);
      if (!stop) continue;
      const start = wallRunOffset(upper, wallId, roomData);
      const end = start + wallRunSpan(upper, wallId, roomData);
      expect(start < stop.outer - 0.02 && end > stop.outer + 0.02).toBe(false);
      expect(placedHeight(upper)).toBeGreaterThan(0);
      void (wallId as WallSide);
    }
  });
});

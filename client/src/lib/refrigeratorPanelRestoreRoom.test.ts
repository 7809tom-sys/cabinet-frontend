import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, refrigeratorBayRunMetrics, wallPlacementAtUnbounded, type PlacedCabinet, type RoomData, type WallSide } from "@/lib/design";
import { applyRefrigeratorEndPanelFieldCuts } from "@/lib/refrigeratorEndPanelCut";

const drawnRoom = {
  ...DEFAULT_ROOM,
  width: 200,
  depth: 200,
  vertices: [
    { id: "v1", x: 0, y: 0 }, { id: "v2", x: 60, y: 60 }, { id: "v3", x: 60, y: 180 }, { id: "v4", x: 0, y: 180 },
  ],
  customWalls: [
    { id: "diagonal", startVertexId: "v1", endVertexId: "v2", lockedAngle: 45 as const },
    { id: "straight", startVertexId: "v2", endVertexId: "v3" },
    { id: "return", startVertexId: "v3", endVertexId: "v4" },
    { id: "close", startVertexId: "v4", endVertexId: "v1" },
  ],
} as unknown as RoomData;

function bay(side: WallSide): PlacedCabinet[] {
  const seat = (base: Partial<PlacedCabinet>, along: number, width: number, depth: number): PlacedCabinet => {
    const spot = wallPlacementAtUnbounded(along, width, depth, side, drawnRoom);
    return { uid: "x", cabinetId: 1, masterCode: "X", description: "", placement: "tall", height: 96, ...base, ...spot, width, depth } as PlacedCabinet;
  };
  const fridge = seat({ uid: "fridge", masterCode: "FRIDGE-36", description: "Refrigerator", placement: "appliance", height: 70 }, 20, 36, 24);
  const metrics = refrigeratorBayRunMetrics(fridge, drawnRoom);
  const assembly = { refrigeratorAssemblyId: "fridge", description: "Refrigerator End Panel", masterCode: "REP3096" };
  return [
    fridge,
    // Already cut from a 30-inch stock panel to the 24-inch refrigerator.
    seat({ ...assembly, uid: "left-panel", refrigeratorAssemblyRole: "left-panel", nominalDepth: 24, refrigeratorPanelStockDepth: 30 }, metrics.openingStart - 0.75, 0.75, 24),
    seat({ ...assembly, uid: "right-panel", refrigeratorAssemblyRole: "right-panel", nominalDepth: 24, refrigeratorPanelStockDepth: 30 }, metrics.openingEnd, 0.75, 24),
  ];
}

describe("refrigerator panels on reload", () => {
  it("does not re-seat a panel against a room that lacks its wall", () => {
    for (const side of ["straight", "return", "close", "diagonal"] as WallSide[]) {
      const parts = bay(side);
      // A restore that commits before the restored room is current.
      const result = applyRefrigeratorEndPanelFieldCuts(parts, DEFAULT_ROOM);
      expect(result).toBe(parts);
      // With the right room the seated panels are already correct.
      expect(applyRefrigeratorEndPanelFieldCuts(parts, drawnRoom)).toBe(parts);
    }
  });

  it("updates roomRef inside every room update so setPlaced sees the new room", () => {
    const source = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");
    expect(source).toContain("const [room, setRoomState] = useState<RoomData>(DEFAULT_ROOM);");
    expect(source).toMatch(/setRoomState\(\(previous\) => \{\s*const next = typeof update === "function" \? update\(previous\) : update;\s*roomRef\.current = next;/);
    expect(source.indexOf("const [room, setRoomState]")).toBeLessThan(source.indexOf("const [placed, setPlacedState]"));
  });
});

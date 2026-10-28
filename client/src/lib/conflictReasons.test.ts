import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ceilingFitDetail,
  ceilingFitViolations,
  wallOpeningClearanceDetail,
  wallOpeningClearanceViolations,
  wallPlacementAt,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
} from "./design";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
const window: WallOpening = { uid: "window", kind: "window", side: "top", offset: 36, width: 30, sill: 42, height: 36 };

function upper(offset: number, width: number, height = 30): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 12, "top", room);
  return { uid: `w${offset}`, cabinetId: 1, masterCode: `W${width}${height}`, description: "Wall", placement: "wall", ...spot, width, depth: 12, height };
}

describe("placement conflict reasons", () => {
  it("reports how far a cabinet overlaps the window, and lets one sit at the edge", () => {
    const over = upper(4, 33); // ends at 37, 1" onto the window
    const edge = upper(3, 33); // ends at 36, flush with the window edge
    const flagged = wallOpeningClearanceViolations([over, edge], [window], room);
    expect(flagged.has(over.uid)).toBe(true);
    expect(wallOpeningClearanceDetail(over, [window], room)).toMatchObject({ gap: -1, required: 0 });
    expect(flagged.has(edge.uid)).toBe(false);
    expect(wallOpeningClearanceDetail(edge, [window], room)).toBeNull();
  });

  it("keeps the full 3-inch clearance from a door", () => {
    const door: WallOpening = { uid: "door", kind: "door", side: "top", offset: 36, width: 30, sill: 0, height: 80 };
    const near = upper(2, 33); // 1" from the door casing
    expect(wallOpeningClearanceViolations([near], [door], room).has(near.uid)).toBe(true);
    expect(wallOpeningClearanceDetail(near, [door], room)).toMatchObject({ gap: 1, required: 3 });
  });

  it("reports the cabinet top and the wall ceiling for every ceiling violation", () => {
    const lowRoom: RoomData = { ...room, ceilingHeight: 84 };
    const tall: PlacedCabinet = { ...upper(80, 24), uid: "pantry", masterCode: "U249024", placement: "tall", depth: 24, height: 93 };
    expect(ceilingFitViolations([tall], lowRoom).has(tall.uid)).toBe(true);
    const detail = ceilingFitDetail(tall, lowRoom);
    expect(detail?.ceiling).toBe(84);
    expect(detail?.top).toBe(93);
    expect(ceilingFitDetail(tall, room)).toBeNull();
  });

  it("shows the reasons in the attention banner", () => {
    const source = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");
    expect(source).toContain('data-testid="design-conflict-reasons"');
    expect(source).toContain("wallOpeningClearanceDetail(cabinet, openings, room)");
    expect(source).toContain("ceilingFitDetail(cabinet, room)");
  });
});

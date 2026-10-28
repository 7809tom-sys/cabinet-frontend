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
  it("reports the gap to the window for every cabinet the clearance rule flags", () => {
    const close = upper(2, 33); // ends at 35, 1" from the window
    const clear = upper(0, 30); // ends at 30, 6" from the window
    const flagged = wallOpeningClearanceViolations([close, clear], [window], room);
    expect(flagged.has(close.uid)).toBe(true);
    expect(wallOpeningClearanceDetail(close, [window], room)).toMatchObject({ gap: 1, required: 3 });
    expect(flagged.has(clear.uid)).toBe(false);
    expect(wallOpeningClearanceDetail(clear, [window], room)).toBeNull();
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

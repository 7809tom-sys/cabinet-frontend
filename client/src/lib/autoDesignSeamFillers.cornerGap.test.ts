/**
 * A corner-owned run end is only deliberate for a BLIND corner (its pull pocket).
 * Tom, Nov 13 2026: a 2-inch gap beside an LS36 in a kitchen with no blind corner
 * was left unfilled, because the seam finder treated every corner end as blocked.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, wallPlacementAt, type PlacedCabinet, type RoomData } from "./design";
import { findAutoDesignSeams } from "./autoDesignSeamFillers";

const ROOM = DEFAULT_ROOM as RoomData;
const CORNER = { x: ROOM.width, y: 0 };

function base(uid: string, masterCode: string, description: string, width: number, depth: number, wall: "top" | "right", offset: number): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, depth, wall, ROOM);
  return {
    uid, cabinetId: 1, masterCode, description, category: "Base", subCategory: "Base",
    placement: "base", ...spot, width, depth, height: 34.5, numberOfDoors: 1, numberOfDrawers: 0,
  } as PlacedCabinet;
}

function seamsAround(cornerCode: string, cornerDescription: string) {
  const corner = base("corner", cornerCode, cornerDescription, 36, 24, "top", ROOM.width - 36);
  const next = base("next", "B24", '24" Base', 24, 24, "right", 2);
  return findAutoDesignSeams({ layer: "base", placed: [corner, next], room: ROOM, openings: [], corners: [CORNER] });
}

describe("corner gaps", () => {
  it("fills a small gap at a lazy-susan corner, because that corner needs no pocket", () => {
    const seams = seamsAround("LS36", '36" Lazy Susan');
    expect(seams.some((seam) => seam.wall === "right" && seam.end - seam.start <= 2.5)).toBe(true);
  });

  it("still keeps a blind corner's pocket empty", () => {
    const seams = seamsAround("BBC36", '36" Blind Base Corner');
    expect(seams.some((seam) => seam.wall === "right" && seam.end - seam.start <= 2.5)).toBe(false);
  });
});

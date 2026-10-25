import { describe, it, expect } from "vitest";
import {
  isHickoryStyle,
  exposedEnds,
  exposedEndCount,
  hickorySkinSuggestions,
} from "./hickorySkins";
import { type PlacedCabinet, type RoomData } from "./design";

const ROOM: RoomData = { width: 144, depth: 120 };

function cab(partial: Partial<PlacedCabinet>): PlacedCabinet {
  return {
    uid: "u",
    cabinetId: 1,
    masterCode: "B-24",
    description: "Base 24",
    placement: "base",
    x: 0,
    y: 0,
    width: 24,
    depth: 24,
    rotation: 0,
    ...partial,
  };
}

describe("isHickoryStyle", () => {
  it("matches on woodSpecies", () => {
    expect(isHickoryStyle({ woodSpecies: "Hickory" })).toBe(true);
    expect(isHickoryStyle({ woodSpecies: "hickory" })).toBe(true);
  });
  it("matches when Hickory appears in the name/finish", () => {
    expect(isHickoryStyle({ ourName: "Rustic Hickory Shaker" })).toBe(true);
    expect(isHickoryStyle({ finish: "Natural Hickory" })).toBe(true);
  });
  it("does not match non-hickory species", () => {
    expect(isHickoryStyle({ woodSpecies: "Maple" })).toBe(false);
    expect(isHickoryStyle({ ourName: "Aspen White" })).toBe(false);
    expect(isHickoryStyle(null)).toBe(false);
    expect(isHickoryStyle(undefined)).toBe(false);
  });
});

describe("exposedEnds", () => {
  it("a lone base on the back wall mid-span exposes BOTH ends", () => {
    // Placed away from both corners on the back (top) wall.
    const c = cab({ uid: "a", x: 48, y: 0, width: 24, depth: 24 });
    const ends = exposedEnds([c], ROOM);
    expect(ends.length).toBe(2);
    expect(ends.map((e) => e.end).sort()).toEqual(["end", "start"]);
  });

  it("a base flush into the left corner exposes only the outboard end", () => {
    // Sits at x=0 (left corner) on the back wall → start end buried in corner.
    const c = cab({ uid: "a", x: 0, y: 0, width: 24, depth: 24 });
    const ends = exposedEnds([c], ROOM);
    expect(ends.length).toBe(1);
    expect(ends[0].end).toBe("end");
  });

  it("two abutting cabinets only expose the two outer ends", () => {
    const a = cab({ uid: "a", x: 24, y: 0, width: 24, depth: 24 });
    const b = cab({ uid: "b", x: 48, y: 0, width: 24, depth: 24 });
    const ends = exposedEnds([a, b], ROOM);
    // a.start exposed, a.end abuts b, b.start abuts a, b.end exposed → 2 ends.
    expect(ends.length).toBe(2);
  });

  it("a full wall-to-wall run exposes no ends", () => {
    const a = cab({ uid: "a", x: 0, y: 0, width: 72, depth: 24 });
    const b = cab({ uid: "b", x: 72, y: 0, width: 72, depth: 24 });
    const ends = exposedEnds([a, b], ROOM);
    expect(ends.length).toBe(0);
  });

  it("ignores panels and appliances", () => {
    const panel = cab({ uid: "p", masterCode: "BDEP", description: "Base Decorative End Panel", x: 48, y: 0, width: 3, depth: 24 });
    const ends = exposedEnds([panel], ROOM);
    expect(ends.length).toBe(0);
  });
});

describe("hickorySkinSuggestions", () => {
  const midBase = cab({ uid: "a", x: 48, y: 0, width: 24, depth: 24, placement: "base" });

  it("returns no suggestions for a non-hickory style", () => {
    expect(hickorySkinSuggestions([midBase], ROOM, { woodSpecies: "Maple" })).toEqual([]);
  });

  it("suggests one skin per exposed end for a hickory style", () => {
    const out = hickorySkinSuggestions([midBase], ROOM, { woodSpecies: "Hickory" });
    expect(out.length).toBe(2); // both ends exposed
    for (const s of out) {
      expect(s.pendingSku).toBe(true);
      expect(s.quantity).toBe(1);
      expect(s.suggestCode).toBe("HICKORY-SKIN-BASE");
      expect(s.description).toContain("Hickory");
    }
  });

  it("uses the right placeholder code per placement bucket", () => {
    const wall = cab({ uid: "w", x: 48, y: 0, width: 24, depth: 12, placement: "wall", height: 30 });
    const tall = cab({ uid: "t", x: 90, y: 0, width: 24, depth: 24, placement: "tall", height: 84 });
    const out = hickorySkinSuggestions([wall, tall], ROOM, { woodSpecies: "Hickory" });
    const codes = new Set(out.map((s) => s.suggestCode));
    expect(codes.has("HICKORY-SKIN-WALL")).toBe(true);
    expect(codes.has("HICKORY-SKIN-TALL")).toBe(true);
  });

  it("exposedEndCount matches the number of suggestions", () => {
    expect(exposedEndCount([midBase], ROOM)).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM } from "./design";
import {
  autoBuildCornerCatalog,
  fourAnchorCornerSlots,
  fourAnchorCornerSlotPoint,
} from "./fourAnchorCornerStage";

describe("Four-anchor appliance-first corner stage", () => {
  it("asks for no corner on a single-wall or galley build, one real corner for L, and two for U", () => {
    expect(fourAnchorCornerSlots("single-wall")).toEqual([]);
    expect(fourAnchorCornerSlots("galley")).toEqual([]);
    expect(fourAnchorCornerSlots("l-shape")).toEqual([
      { id: "wall-1-wall-2", label: "Corner between Wall 1 and Wall 2", firstWall: "Wall 1", secondWall: "Wall 2" },
    ]);
    expect(fourAnchorCornerSlots("u-shape")).toEqual([
      { id: "wall-1-wall-2", label: "Corner between Wall 1 and Wall 2", firstWall: "Wall 1", secondWall: "Wall 2" },
      { id: "wall-2-wall-3", label: "Corner between Wall 2 and Wall 3", firstWall: "Wall 2", secondWall: "Wall 3" },
    ]);
  });

  it("maps the L-shape Wall 1/Wall 2 choice to their actual shared engine vertex", () => {
    expect(fourAnchorCornerSlotPoint(
      { id: "wall-1-wall-2", label: "Corner between Wall 1 and Wall 2", firstWall: "Wall 1", secondWall: "Wall 2" },
      DEFAULT_ROOM,
      "left",
      "right",
    )).toEqual({ x: DEFAULT_ROOM.width, y: 0, firstWallId: "top" });
  });

  it("requires the real corner between measured back and right runs even if Single wall was left selected", () => {
    expect(fourAnchorCornerSlots("single-wall", {
      wallIds: ["top", "right"], room: DEFAULT_ROOM, originCorner: "left", runDirection: "right",
    })).toEqual([
      { id: "wall-1-wall-2", label: "Corner between Wall 1 and Wall 2", firstWall: "Wall 1", secondWall: "Wall 2" },
    ]);
  });

  it("does not invent a corner between opposing galley runs", () => {
    expect(fourAnchorCornerSlots("galley", {
      wallIds: ["top", "bottom"], room: DEFAULT_ROOM, originCorner: "left", runDirection: "right",
    })).toEqual([]);
  });

  it("includes a sixth custom wall in measured-corner discovery only when it shares a real vertex", () => {
    const room = {
      width: 180,
      depth: 180,
      ceilingHeight: 96,
      vertices: [
        { id: "a", x: 0, y: 0 }, { id: "b", x: 120, y: 0 }, { id: "c", x: 180, y: 60 },
        { id: "d", x: 180, y: 180 }, { id: "e", x: 60, y: 180 }, { id: "f", x: 0, y: 120 },
      ],
      customWalls: [
        ["w1", "a", "b"], ["w2", "b", "c"], ["w3", "c", "d"],
        ["w4", "d", "e"], ["w5", "e", "f"], ["w6", "f", "a"],
      ].map(([id, startVertexId, endVertexId]) => ({ id, startVertexId, endVertexId })),
    } as typeof DEFAULT_ROOM;
    const slots = fourAnchorCornerSlots("single-wall", {
      wallIds: ["w5", "w6"], room, originCorner: "left", runDirection: "right",
    });
    expect(slots).toContainEqual({
      id: "wall-5-wall-6",
      label: "Corner between Wall 5 and Wall 6",
      firstWall: "Wall 5",
      secondWall: "Wall 6",
    });
  });

  it("deduplicates the declared L corner and retains both requested U corners", () => {
    const measured = { wallIds: ["top", "right"], room: DEFAULT_ROOM, originCorner: "left" as const, runDirection: "right" as const };
    expect(fourAnchorCornerSlots("l-shape", measured)).toHaveLength(1);
    expect(fourAnchorCornerSlots("u-shape", measured)).toHaveLength(2);
  });

  it("uses actual wall frames rather than a hard-coded top-right vertex on reversed traversal", () => {
    const measured = { wallIds: ["top", "left"], room: DEFAULT_ROOM, originCorner: "right" as const, runDirection: "left" as const };
    const slots = fourAnchorCornerSlots("single-wall", measured);
    expect(slots).toHaveLength(1);
    expect(fourAnchorCornerSlotPoint(slots[0], measured.room, measured.originCorner, measured.runDirection))
      .toEqual({ x: 0, y: 0, firstWallId: "top" });
  });

  it("shows only real source-priced base-corner options after appliances, never a straight base, sink base, or base-end return", () => {
    const catalog = [
      { id: 1, masterCode: "B24", description: "24 inch Base Cabinet", placement: "base" as const },
      { id: 2, masterCode: "SB36", description: "36 inch Sink Base", placement: "base" as const },
      { id: 3, masterCode: "BEC24", description: "Base End Corner Cabinet", placement: "base" as const, cornerType: "base-end-corner" },
      { id: 4, masterCode: "LSB36", description: "36 inch Lazy Susan Corner Base", placement: "base" as const, cornerType: "lazy-susan", width: "36" },
      { id: 5, masterCode: "BBC39", description: "39 inch Blind Corner Base", placement: "base" as const, cornerType: "blind-corner", width: "39" },
      { id: 6, masterCode: "WDC2430", description: "Diagonal Wall Corner", placement: "wall" as const, cornerType: "diagonal" },
    ];

    expect(autoBuildCornerCatalog(catalog).map((item) => item.masterCode)).toEqual(["BBC39", "LSB36"]);
  });
});

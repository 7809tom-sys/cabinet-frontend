import { describe, expect, it } from "vitest";
import { autoFillSpan } from "./autofill";
import { DEFAULT_ROOM, wallRunCornerPlacement, wallRunFrame, type PlacedCabinet, type RoomData } from "./design";
import {
  autoBuildCornerCatalog,
  autoDesignCornerSlots,
  autoDesignCornerSlotPoint,
  autoDesignMissingCornerWarnings,
  autoDesignRunWallIds,
} from "./autoDesignCornerStage";

/** Open three-wall U: side, back, side. The two front ends have no adjoining wall. */
function openURoom(): RoomData {
  return {
    width: 144,
    depth: 120,
    ceilingHeight: 96,
    openWallPath: true,
    vertices: [
      { id: "front-left", x: 0, y: 120 },
      { id: "back-left", x: 0, y: 0 },
      { id: "back-right", x: 144, y: 0 },
      { id: "front-right", x: 144, y: 120 },
    ],
    customWalls: [
      { id: "side-left", label: "Wall 1", startVertexId: "front-left", endVertexId: "back-left" },
      { id: "back", label: "Wall 2", startVertexId: "back-left", endVertexId: "back-right" },
      { id: "side-right", label: "Wall 3", startVertexId: "back-right", endVertexId: "front-right" },
    ],
  };
}

describe("Auto-Design appliance-first corner stage", () => {
  it("asks for no corner on a single-wall or galley build, one real corner for L, and two for U", () => {
    expect(autoDesignCornerSlots("single-wall")).toEqual([]);
    expect(autoDesignCornerSlots("galley")).toEqual([]);
    expect(autoDesignCornerSlots("l-shape")).toEqual([
      { id: "wall-1-wall-2", label: "Corner between Wall 1 and Wall 2", firstWall: "Wall 1", secondWall: "Wall 2" },
    ]);
    // Without a measured room, a U still names its two open-U corners.
    expect(autoDesignCornerSlots("u-shape")).toEqual([
      { id: "wall-1-wall-2", label: "Corner between Wall 1 and Wall 2", firstWall: "Wall 1", secondWall: "Wall 2" },
      { id: "wall-2-wall-3", label: "Corner between Wall 2 and Wall 3", firstWall: "Wall 2", secondWall: "Wall 3" },
    ]);
  });

  it("maps the L-shape Wall 1/Wall 2 choice to their actual shared engine vertex", () => {
    expect(autoDesignCornerSlotPoint(
      { id: "wall-1-wall-2", label: "Corner between Wall 1 and Wall 2", firstWall: "Wall 1", secondWall: "Wall 2" },
      DEFAULT_ROOM,
      "left",
      "right",
    )).toEqual({ x: DEFAULT_ROOM.width, y: 0, firstWallId: "top" });
  });

  it("requires the real corner between measured back and right runs even if Single wall was left selected", () => {
    expect(autoDesignCornerSlots("single-wall", {
      wallIds: ["top", "right"], room: DEFAULT_ROOM, originCorner: "left", runDirection: "right",
    })).toEqual([
      { id: "wall-1-wall-2", label: "Corner between Wall 1 and Wall 2", firstWall: "Wall 1", secondWall: "Wall 2" },
    ]);
  });

  it("does not invent a corner between opposing galley runs", () => {
    expect(autoDesignCornerSlots("galley", {
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
    const slots = autoDesignCornerSlots("single-wall", {
      wallIds: ["w5", "w6"], room, originCorner: "left", runDirection: "right",
    });
    expect(slots).toContainEqual({
      id: "wall-5-wall-6",
      label: "Corner between Wall 5 and Wall 6",
      firstWall: "Wall 5",
      secondWall: "Wall 6",
    });
  });

  it("deduplicates the declared L corner and retains both back corners of a U", () => {
    const measured = { wallIds: ["top", "right"], room: DEFAULT_ROOM, originCorner: "left" as const, runDirection: "right" as const };
    expect(autoDesignCornerSlots("l-shape", measured)).toHaveLength(1);
    expect(autoDesignCornerSlots("u-shape", measured).map((slot) => slot.id)).toEqual([
      "wall-1-wall-2", "wall-1-wall-4", "wall-2-wall-3", "wall-3-wall-4",
    ]);
  });

  it("counts corners by layout: a closed U has four, an open U has two, L has one, galley and single wall have none", () => {
    const rectangle = { wallIds: ["top", "right", "left"], room: DEFAULT_ROOM, originCorner: "left" as const, runDirection: "right" as const };
    expect(autoDesignCornerSlots("u-shape", rectangle)).toHaveLength(4);
    expect(autoDesignCornerSlots("l-shape", rectangle)).toHaveLength(1);
    expect(autoDesignCornerSlots("galley", {
      wallIds: ["top", "bottom"], room: DEFAULT_ROOM, originCorner: "left", runDirection: "right",
    })).toHaveLength(0);
    expect(autoDesignCornerSlots("single-wall")).toHaveLength(0);
    expect(autoDesignCornerSlots("single-wall", {
      wallIds: ["top"], room: DEFAULT_ROOM, originCorner: "left", runDirection: "right",
    })).toHaveLength(0);
  });

  it("adds the two Wall 4 corners on a closed rectangular U", () => {
    const measured = {
      wallIds: ["top", "right", "left"],
      room: DEFAULT_ROOM,
      originCorner: "left" as const,
      runDirection: "right" as const,
    };
    const slots = autoDesignCornerSlots("u-shape", measured);
    expect(slots.map((slot) => slot.id)).toEqual(["wall-1-wall-2", "wall-1-wall-4", "wall-2-wall-3", "wall-3-wall-4"]);
    expect(slots.map((slot) => autoDesignCornerSlotPoint(slot, DEFAULT_ROOM, "left", "right"))).toEqual([
      { x: DEFAULT_ROOM.width, y: 0, firstWallId: "top" },
      { x: 0, y: 0, firstWallId: "top" },
      { x: DEFAULT_ROOM.width, y: DEFAULT_ROOM.depth, firstWallId: "right" },
      { x: 0, y: DEFAULT_ROOM.depth, firstWallId: "bottom" },
    ]);
  });

  it("cabinets the far wall too when the U is traversed to the left on a closed room", () => {
    const slots = autoDesignCornerSlots("u-shape", {
      wallIds: ["top", "left", "right"], room: DEFAULT_ROOM, originCorner: "left", runDirection: "left",
    });
    expect(slots).toHaveLength(4);
    expect(slots.map((slot) => autoDesignCornerSlotPoint(slot, DEFAULT_ROOM, "left", "left"))).toEqual([
      { x: 0, y: 0, firstWallId: "top" },
      { x: DEFAULT_ROOM.width, y: 0, firstWallId: "top" },
      { x: 0, y: DEFAULT_ROOM.depth, firstWallId: "left" },
      { x: DEFAULT_ROOM.width, y: DEFAULT_ROOM.depth, firstWallId: "bottom" },
    ]);
  });

  it("gives a hand-drawn three-wall U its two real corners and no open-end corner", () => {
    const room = openURoom();
    const slots = autoDesignCornerSlots("u-shape", {
      wallIds: ["side-left", "back", "side-right"], room, originCorner: "left", runDirection: "right",
    });
    expect(slots).toHaveLength(2);
    const points = slots.map((slot) => autoDesignCornerSlotPoint(slot, room, "left", "right"));
    expect(points).toEqual([
      { x: 0, y: 0, firstWallId: "side-left" },
      { x: 144, y: 0, firstWallId: "back" },
    ]);
    const corner = {
      uid: "lsb", cabinetId: 1, masterCode: "LSB36", description: "36 inch Lazy Susan Base",
      placement: "base", x: 0, y: 0, width: 36, depth: 36, height: 34.5, rotation: 0,
    } as PlacedCabinet;
    const rightRun = wallRunFrame("side-right", room);
    expect(rightRun).not.toBeNull();
    expect(wallRunCornerPlacement(corner, rightRun!, "end", room)).toBeNull();
    expect(wallRunCornerPlacement(corner, rightRun!, "start", room)).not.toBeNull();
  });

  it("does not auto-insert a corner cabinet when a manual run, including a U open end, is filled", () => {
    const catalog = [
      { id: 1, masterCode: "B24", description: "24 inch Base Cabinet", width: "24", placement: "base" as const },
      { id: 2, masterCode: "B36", description: "36 inch Base Cabinet", width: "36", placement: "base" as const },
      { id: 3, masterCode: "LSB36", description: "36 inch Lazy Susan Corner Base", width: "36", placement: "base" as const, isCornerCabinet: true },
    ];
    const filled = autoFillSpan(120, "kitchen", catalog);
    expect(filled.items.map((item) => item.cabinet.masterCode)).not.toContain("LSB36");
    expect(filled.items.some((item) => !item.isFiller)).toBe(true);
  });

  it("warns only for a genuinely empty real corner, never for a third U corner", () => {
    const uSlots = autoDesignCornerSlots("u-shape", {
      wallIds: ["top", "right", "left"], room: DEFAULT_ROOM, originCorner: "left", runDirection: "right",
    });
    const chosen = Object.fromEntries(uSlots.map((slot) => [slot.id, { cabinetId: 36 }]));
    expect(autoDesignMissingCornerWarnings(uSlots, chosen)).toEqual([]);
    expect(uSlots.map((slot) => slot.id)).toEqual(["wall-1-wall-2", "wall-1-wall-4", "wall-2-wall-3", "wall-3-wall-4"]);

    const missingSide = autoDesignMissingCornerWarnings(uSlots, { [uSlots[0]!.id]: { cabinetId: 36 } });
    expect(missingSide).toEqual([
      "A corner cabinet is required at every Auto-Design L/U corner. Choose a source-priced corner for Corner between Wall 1 and Wall 4 before filling the remaining runs.",
      "A corner cabinet is required at every Auto-Design L/U corner. Choose a source-priced corner for Corner between Wall 2 and Wall 3 before filling the remaining runs.",
      "A corner cabinet is required at every Auto-Design L/U corner. Choose a source-priced corner for Corner between Wall 3 and Wall 4 before filling the remaining runs.",
    ]);

    const lSlots = autoDesignCornerSlots("l-shape", {
      wallIds: ["top", "right", "left"], room: DEFAULT_ROOM, originCorner: "left", runDirection: "right",
    });
    expect(lSlots).toHaveLength(1);
    expect(autoDesignMissingCornerWarnings(lSlots, {})).toEqual([
      "A corner cabinet is required at every Auto-Design L/U corner. Choose a source-priced corner for Corner between Wall 1 and Wall 2 before filling the remaining runs.",
    ]);
    expect(autoDesignMissingCornerWarnings(lSlots, { [lSlots[0]!.id]: { cabinetId: 36 } })).toEqual([]);

    expect(autoDesignMissingCornerWarnings(autoDesignCornerSlots("galley", {
      wallIds: ["top", "bottom"], room: DEFAULT_ROOM, originCorner: "left", runDirection: "right",
    }), {})).toEqual([]);
    expect(autoDesignMissingCornerWarnings(autoDesignCornerSlots("single-wall"), {})).toEqual([]);
  });

  it("keeps Wall 4 in a closed U and still ignores a wall the room does not have", () => {
    const measured = {
      wallIds: ["top", "right", "bottom", "left"],
      room: DEFAULT_ROOM,
      originCorner: "left" as const,
      runDirection: "right" as const,
    };
    const slots = autoDesignCornerSlots("u-shape", measured);
    expect(slots.some((slot) => slot.firstWall === "Wall 4" || slot.secondWall === "Wall 4")).toBe(true);
    expect(autoDesignRunWallIds({ ...measured, layoutType: "u-shape", wallIds: measured.wallIds })).toEqual(["top", "right", "bottom", "left"]);
    const open = openURoom();
    expect(autoDesignRunWallIds({
      layoutType: "u-shape", room: open, originCorner: "left", runDirection: "right", wallIds: ["side-left", "back", "side-right"],
    })).toEqual(["side-left", "back", "side-right"]);
    expect(autoDesignRunWallIds({ ...measured, layoutType: "l-shape", wallIds: ["top", "right", "left"] })).toEqual(["top", "right", "left"]);
    expect(autoDesignRunWallIds({ ...measured, layoutType: "galley", wallIds: ["top", "bottom"] })).toEqual(["top", "bottom"]);
    expect(autoDesignRunWallIds({ ...measured, layoutType: "single-wall", wallIds: ["top", "left"] })).toEqual(["top", "left"]);
  });

  it("uses actual wall frames rather than a hard-coded top-right vertex on reversed traversal", () => {
    const measured = { wallIds: ["top", "left"], room: DEFAULT_ROOM, originCorner: "right" as const, runDirection: "left" as const };
    const slots = autoDesignCornerSlots("single-wall", measured);
    expect(slots).toHaveLength(1);
    expect(autoDesignCornerSlotPoint(slots[0], measured.room, measured.originCorner, measured.runDirection))
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

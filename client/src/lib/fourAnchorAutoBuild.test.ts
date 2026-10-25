import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM } from "./design";
import { adjacentDishwasherCenterIn, anchorAlongStartIn, autoBuildSelectedWallCornerReservations, autoBuildStraightBaseCatalog, buildWallLabelMap, canRunFourAnchorAutoBuild, isAutoBuildStraightSinkBaseCandidate, makeFourAnchorSixWallTrainingRoom, planFourAnchorAutoBuild, subtractAnchorRunReservations, wallLabelToEngineWallId } from "./fourAnchorAutoBuild";

describe("four-anchor wall-label mapping", () => {
  it.each([
    ["left", "right", ["top", "right", "bottom", "left"]],
    ["left", "left", ["top", "left", "bottom", "right"]],
    ["right", "left", ["top", "left", "bottom", "right"]],
    ["right", "right", ["top", "right", "bottom", "left"]],
  ] as const)("maps %s origin and %s traversal to the perimeter", (origin, direction, expected) => {
    const map = buildWallLabelMap(DEFAULT_ROOM, origin, direction);
    expect(Object.values(map).slice(0, 4).map((ref) => ref?.engineWallId)).toEqual(expected);
    expect(map["Wall 5"]).toBeNull();
    expect(map["Wall 6"]).toBeNull();
  });

  it("maps a Wall 2 sink to the engine right wall and converts its center to an edge offset", () => {
    const wall = wallLabelToEngineWallId("Wall 2", DEFAULT_ROOM, "left", "right");
    expect(wall?.engineWallId).toBe("right");
    expect(wall?.startCorner).toBe("start");
    expect(anchorAlongStartIn({ wallLabel: "Wall 2", centerOffsetIn: 48 }, 36, wall!)).toBe(30);
  });

  it("reverses center measurements when traversal starts from the opposite frame endpoint", () => {
    const wall = wallLabelToEngineWallId("Wall 2", DEFAULT_ROOM, "left", "left");
    expect(wall?.engineWallId).toBe("left");
    expect(wall?.startCorner).toBe("end");
    expect(anchorAlongStartIn({ wallLabel: "Wall 2", centerOffsetIn: 48 }, 36, wall!)).toBe(DEFAULT_ROOM.depth - 48 - 18);
  });

  it("maps Wall 5 and Wall 6 only when a custom room actually contains those fifth and sixth wall segments", () => {
    const sixWallRoom = {
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

    const map = buildWallLabelMap(sixWallRoom, "left", "right");
    expect(map["Wall 5"]?.engineWallId).toBe("w5");
    expect(map["Wall 6"]?.engineWallId).toBe("w6");
    expect(wallLabelToEngineWallId("Wall 5", DEFAULT_ROOM, "left", "right")).toBeNull();
    expect(wallLabelToEngineWallId("Wall 6", DEFAULT_ROOM, "left", "right")).toBeNull();
  });

  it("provides a blank, closed six-wall training room whose Wall 1–6 labels map to six real physical segments", () => {
    const room = makeFourAnchorSixWallTrainingRoom();
    const map = buildWallLabelMap(room, "left", "right");

    expect(room.vertices).toHaveLength(6);
    expect(room.customWalls).toHaveLength(6);
    expect(room.openWallPath).not.toBe(true);
    expect(room.customWalls?.map((wall) => wall.label)).toEqual([
      "Wall 1", "Wall 2", "Wall 3", "Wall 4", "Wall 5", "Wall 6",
    ]);
    expect(Object.values(map).map((wall) => wall?.engineWallId)).toEqual([
      "four-anchor-training-wall-1",
      "four-anchor-training-wall-2",
      "four-anchor-training-wall-3",
      "four-anchor-training-wall-4",
      "four-anchor-training-wall-5",
      "four-anchor-training-wall-6",
    ]);
    expect(makeFourAnchorSixWallTrainingRoom()).not.toBe(room);
  });

  it("computes a flush left or right dishwasher center from the selected sink base width", () => {
    expect(adjacentDishwasherCenterIn(60, 36, 24, "left")).toBe(30);
    expect(adjacentDishwasherCenterIn(60, 36, 24, "right")).toBe(90);
  });

  it("keeps a refrigerator opening and requested panel span empty while tiling its selected wall", () => {
    expect(subtractAnchorRunReservations([{ start: 0, length: 144 }], [{ start: 48.75, end: 87.25 }])).toEqual([
      { start: 0, length: 48.75 },
      { start: 87.25, length: 56.75 },
    ]);
  });

  it("reserves a corner shared by selected anchor walls from automatic straight-base fill", () => {
    const reservations = autoBuildSelectedWallCornerReservations("right", DEFAULT_ROOM, ["top", "right"]);
    expect(reservations).toEqual([{ start: 0, end: 24 }]);
  });

  it("does not reserve an unselected adjoining corner", () => {
    const reservations = autoBuildSelectedWallCornerReservations("right", DEFAULT_ROOM, ["top", "left"]);
    expect(reservations).toEqual([]);
  });

  it("uses SB36 as the straight sink anchor and never substitutes a corner sink base on a wall run", () => {
    const sb36 = { id: 1, masterCode: "SB36", description: '36" Sink Base Cabinet', placement: "base" as const, width: "36" };
    const cornerSink = { id: 2, masterCode: "CSB36", description: '36" Corner Sink Base Cabinet', placement: "base" as const, width: "36" };

    expect(isAutoBuildStraightSinkBaseCandidate(sb36)).toBe(true);
    expect(isAutoBuildStraightSinkBaseCandidate(cornerSink)).toBe(false);
  });

  it("never auto-fills a straight selected wall with a corner cabinet", () => {
    const catalog = [
      { id: 1, masterCode: "B24", description: '24" Base Cabinet', placement: "base" as const, width: "24" },
      { id: 2, masterCode: "LSB36", description: '36" Lazy Susan Corner Base', placement: "base" as const, width: "36" },
      { id: 3, masterCode: "BBC39", description: '39" Blind Corner Base', placement: "base" as const, width: "39" },
      { id: 4, masterCode: "CSB36", description: '36" Corner Sink Base Cabinet', placement: "base" as const, width: "36" },
      { id: 5, masterCode: "SB36", description: '36" Sink Base Cabinet', placement: "base" as const, width: "36" },
    ];

    expect(autoBuildStraightBaseCatalog(catalog).map((item) => item.masterCode)).toEqual(["B24"]);
  });

  it("defaults to regular door bases with top drawers, not unrequested specialty or all-drawer boxes", () => {
    const catalog = [
      { masterCode: "3DB48", description: "48 inch Three Drawer Base", numberOfDoors: 0, numberOfDrawers: 3 },
      { masterCode: "B-36", description: "Double Door Single Drawer Base Cabinet", numberOfDoors: 2, numberOfDrawers: 1 },
      { masterCode: "B24", description: "Standard Base Cabinet", numberOfDoors: 2, numberOfDrawers: 1 },
      { masterCode: "B18PO", description: "Pull-Out Base Cabinet" },
      { masterCode: "B30MW", description: "Microwave Base Cabinet" },
      { masterCode: "BFH36", description: "Full Height Door Base" },
      { masterCode: "VB36", description: "Vanity Base Cabinet", category: "Vanity" },
      { masterCode: "BEC24", description: "Square Double Door Base End" },
      { masterCode: "BF3", description: "Base Filler" },
    ].map((row) => ({ ...row, placement: "base" as const }));
    expect(autoBuildStraightBaseCatalog(catalog).map((row) => row.masterCode)).toEqual(["B-36", "B24"]);
  });
});

describe("four-anchor auto-build", () => {
  const required = {
    sink: { wallLabel: "Wall 1" as const, centerOffsetIn: 60 },
    stove: { wallLabel: "Wall 2" as const, centerOffsetIn: 48 },
    refrigerator: { wallLabel: "Wall 3" as const, centerOffsetIn: 36 },
  };

  it("places anchors in the required order and centers the sink on a measured window", () => {
    const result = planFourAnchorAutoBuild({
      layoutType: "single-wall",
      originCorner: "left",
      runDirection: "right",
      ...required,
      dishwasher: { wallLabel: "Wall 1", centerOffsetIn: 84 },
      sinkWindowCenter: { wallLabel: "Wall 1", centerOffsetIn: 60 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.anchors.map((anchor) => anchor.kind)).toEqual(["sink", "stove", "dishwasher", "refrigerator"]);
    expect(result.plan.anchors[0]).toMatchObject({ wallLabel: "Wall 1", centerOffsetIn: 60, source: "sink-window-centered" });
    expect(result.plan.surroundingRules).toEqual(["fillers", "blind corners", "molding", "substitution"]);
  });

  it("places an unmeasured dishwasher to the requested right of the sink", () => {
    const result = planFourAnchorAutoBuild({ ...required, layoutType: "galley", originCorner: "right", runDirection: "left", dishwasher: null, dishwasherSide: "right" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.anchors[2]).toMatchObject({ wallLabel: "Wall 1", centerOffsetIn: 60, source: "adjacent-to-sink", dishwasherSide: "right" });
  });

  it("preserves a left-of-sink choice for an unmeasured dishwasher", () => {
    const result = planFourAnchorAutoBuild({ ...required, layoutType: "galley", originCorner: "right", runDirection: "left", dishwasher: null, dishwasherSide: "left" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.anchors[2]).toMatchObject({ wallLabel: "Wall 1", source: "adjacent-to-sink", dishwasherSide: "left" });
  });

  it("does not add appliances explicitly marked as omitted, while retaining the required sink base", () => {
    const result = planFourAnchorAutoBuild({
      layoutType: "single-wall",
      originCorner: "left",
      runDirection: "right",
      sink: { wallLabel: "Wall 5", centerOffsetIn: 60 },
      stove: null,
      dishwasher: null,
      skipDishwasher: true,
      refrigerator: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.anchors).toEqual([
      expect.objectContaining({ kind: "sink", wallLabel: "Wall 5", centerOffsetIn: 60 }),
    ]);
  });

  it("asks for missing required measurements instead of guessing", () => {
    const result = planFourAnchorAutoBuild({ ...required, layoutType: "single-wall", originCorner: "left", runDirection: "right", sink: undefined as never });
    expect(result).toEqual({ ok: false, missing: ["sink"] });
  });

  it("is admin-only and refuses to overwrite hand-placed contents", () => {
    expect(canRunFourAnchorAutoBuild(true, false)).toBe(true);
    expect(canRunFourAnchorAutoBuild(false, false)).toBe(false);
    expect(canRunFourAnchorAutoBuild(true, true)).toBe(false);
  });
});

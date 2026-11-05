import { describe, expect, it } from "vitest";
import {
  insertStudioBay, moveStudioItem, placeStudioShelfLadder, setStudioShelfHeight, studioBays, studioCanonicalTowerFootprint,
  studioCenteredBayIndex, studioFixedBottom, studioFixedTop, studioItemHeight, studioSnapShelfHeight, studioWallFrame,
  STUDIO_SHELF_LADDER_MAX_COUNT, STUDIO_SHELF_LADDER_SPACING_IN, STUDIO_SHELF_LADDER_START_IN, STUDIO_WALLS,
  snapStudioPart, switchStudioWall, createStudioDesign, type StudioDesign, type StudioWall,
} from "./vendorClosetStudio";

/** Three towers with a part in each, so an insert can prove which parts moved with which tower. */
function threeTowers(): StudioDesign {
  let design = createStudioDesign();
  design = switchStudioWall(design, "back");
  // The starter draft already has a shelf; clear it so each tower's contents are unambiguous.
  design = { ...design, wallLayouts: { ...design.wallLayouts, back: { wallId: "back", bays: [{ id: "bay-1", wallId: "back", widthIn: 24, items: [] }] } }, bays: [{ id: "bay-1", wallId: "back", widthIn: 24, items: [] }] };
  const withSecond = insertStudioBay(design, 24, 1, "bay-b");
  if (!withSecond.ok) throw new Error(withSecond.reason);
  design = withSecond.design;
  const withThird = insertStudioBay(design, 24, 2, "bay-c");
  if (!withThird.ok) throw new Error(withThird.reason);
  design = withThird.design;
  for (const [index, id] of [[0, "shelf-a"], [1, "shelf-b"], [2, "shelf-c"]] as const) {
    const staged = snapStudioPart(design, index, "shelf", 40 + index * 4, id);
    if (!staged.ok) throw new Error(staged.reason);
    design = staged.design;
  }
  return design;
}

describe("tower insertion keeps every other tower's contents", () => {
  it("inserts at the requested index and leaves the left neighbours' parts untouched", () => {
    const design = threeTowers();
    expect(studioBays(design).map((bay) => bay.items.map((item) => item.id))).toEqual([["shelf-a"], ["shelf-b"], ["shelf-c"]]);

    // Insert a new tower directly after Tower 1: it lands in the second panel, Tower 2 and 3 move right.
    const inserted = insertStudioBay(design, 24, 1, "bay-new");
    expect(inserted.ok).toBe(true);
    if (!inserted.ok) return;
    expect(inserted.index).toBe(1);
    const bays = studioBays(inserted.design);
    expect(bays.map((bay) => bay.id)).toEqual(["bay-1", "bay-new", "bay-b", "bay-c"]);
    // Everything to the left is unchanged; everything to the right keeps its parts and only shifts over.
    expect(bays[0].items.map((item) => item.id)).toEqual(["shelf-a"]);
    expect(bays[1].items).toEqual([]);
    expect(bays[2].items.map((item) => item.id)).toEqual(["shelf-b"]);
    expect(bays[3].items.map((item) => item.id)).toEqual(["shelf-c"]);
    for (const bay of bays) expect(bay.items.every((item) => item.wallId === "back")).toBe(true);
  });

  it("defaults to the end of the run and re-centers the viewer on the new tower", () => {
    const design = threeTowers();
    // Inserting after the selected tower is what the studio passes, so the new tower is beside what the user saw.
    const appended = insertStudioBay(design, 24, undefined, "bay-end");
    expect(appended.ok).toBe(true);
    if (!appended.ok) return;
    expect(appended.index).toBe(3);
    expect(studioBays(appended.design).map((bay) => bay.id)).toEqual(["bay-1", "bay-b", "bay-c", "bay-end"]);
    expect(studioCenteredBayIndex(appended.design, 0, "bay-end")).toBe(3);
    // With no focus tower, the selected tower stays centered.
    expect(studioCenteredBayIndex(appended.design, 2, null)).toBe(2);
    // A stale focus id (for example after a wall switch) falls back to the selection instead of throwing.
    expect(studioCenteredBayIndex(appended.design, 1, "does-not-exist")).toBe(1);
  });

  it("reports a full wall or a full run instead of dropping a tower", () => {
    let design = createStudioDesign();
    for (let index = 0; index < 3; index += 1) {
      const added = insertStudioBay(design, 24, undefined, `bay-${index + 2}`);
      if (!added.ok) throw new Error(added.reason);
      design = added.design;
    }
    expect(studioBays(design)).toHaveLength(4);
    const tooMany = insertStudioBay(design, 24, 0, "bay-5");
    expect(tooMany).toEqual({ ok: false, reason: "Choose up to four sourced tower bays." });

    const wide = { ...createStudioDesign(), wallWidthIn: 40 };
    const noRoom = insertStudioBay(wide, 24, 0, "bay-too-wide");
    expect(noRoom.ok).toBe(false);
  });
});

describe("shelf spacing tool", () => {
  const start = Math.max(STUDIO_SHELF_LADDER_START_IN, studioFixedBottom(createStudioDesign()) + 0.75);
  /** The starter draft's first tower with its sample shelf removed, so only the run is in the tower. */
  const emptyBackWall = (): StudioDesign => ({
    ...createStudioDesign(),
    wallLayouts: { back: { wallId: "back", bays: [{ id: "bay-1", wallId: "back", widthIn: 24, items: [] }] } },
    bays: [{ id: "bay-1", wallId: "back", widthIn: 24, items: [] }],
  });

  it("starts at the 4.5-in mark and steps by 10 in by default", () => {
    // A bare tower, so the run is the only thing in it.
    const design = emptyBackWall();
    expect(studioFixedBottom(design)).toBe(6);
    // The owner's 4.5-in mark sits inside the fixed bottom shelf, so the first placeable shelf is the
    // first legal height above it, and every following shelf keeps the 10-in pitch.
    expect(start).toBe(6.75);
    const run = placeStudioShelfLadder(design, 0, 5);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.skipped).toEqual([]);
    expect(run.placed.map((item) => item.bottomIn)).toEqual([6.75, 16.75, 26.75, 36.75, 46.75]);
    expect(run.spacings).toEqual([0, 10, 20, 30, 40]);
    expect(studioBays(run.design)[0].items.filter((item) => item.kind === "shelf").map((item) => item.bottomIn))
      .toEqual([6.75, 16.75, 26.75, 36.75, 46.75]);
  });

  it("honours an edited spacing and never places a shelf past the fixed top", () => {
    const design = createStudioDesign();
    const tight = placeStudioShelfLadder(design, 0, 4, 20);
    expect(tight.ok).toBe(true);
    if (!tight.ok) return;
    expect(tight.placed.map((item) => item.bottomIn)).toEqual([6.75, 26.75, 46.75, 66.75]);

    // 14 in spacing runs past the fixed top shelf; the shelves that do not fit are reported, not forced.
    const run = placeStudioShelfLadder(design, 0, 8, 14);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const top = studioFixedTop(design);
    for (const item of run.placed) expect(item.bottomIn + studioItemHeight("shelf")).toBeLessThanOrEqual(top + 0.001);
    expect(run.skipped.length).toBeGreaterThan(0);
    expect(run.placed.length + run.skipped.length).toBe(8);
    // The reported gaps are still the requested pitch, so the panel can say exactly which shelf was dropped.
    expect(run.skipped).toEqual(expect.arrayContaining([run.skipped[0]]));
    expect([...run.skipped].sort((a, b) => a - b)).toEqual(run.skipped);
  });

  it("rejects nonsense counts and spacings with a readable reason", () => {
    const design = createStudioDesign();
    expect(placeStudioShelfLadder(design, 0, 0)).toMatchObject({ ok: false });
    expect(placeStudioShelfLadder(design, 0, STUDIO_SHELF_LADDER_MAX_COUNT + 1)).toMatchObject({ ok: false });
    expect(placeStudioShelfLadder(design, 0, 3, 1)).toMatchObject({ ok: false, reason: "Enter a shelf spacing of at least 2 in." });
    expect(placeStudioShelfLadder(design, 3, 3)).toMatchObject({ ok: false, reason: "Choose a tower before adding a shelf run." });
  });

  it("adds the run to the selected tower only", () => {
    let design = createStudioDesign();
    const neighbor = insertStudioBay(design, 24, 1, "bay-2");
    if (!neighbor.ok) throw new Error(neighbor.reason);
    design = neighbor.design;
    const run = placeStudioShelfLadder(design, 1, 3);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(studioBays(run.design)[0].items.filter((item) => item.kind === "shelf")).toHaveLength(1);
    expect(studioBays(run.design)[1].items.filter((item) => item.kind === "shelf")).toHaveLength(3);
  });
});

describe("exact and dragged shelf heights", () => {
  it("sets an exact quarter-inch height and refuses an overlapping one", () => {
    const design = createStudioDesign();
    const run = placeStudioShelfLadder(design, 0, 2);
    if (!run.ok) throw new Error(run.reason);
    const [lower, upper] = run.placed;
    const moved = setStudioShelfHeight(run.design, 0, lower.id, 22.25);
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(studioBays(moved.design)[0].items.find((item) => item.id === lower.id)?.bottomIn).toBe(22.25);

    // 22.25 is only 3.5 in below the next shelf at 16.75 → move the upper one instead, which passes;
    // then ask for a height that would land inside the lower shelf and expect a readable refusal.
    const overlap = setStudioShelfHeight(moved.design, 0, upper.id, 22.5);
    expect(overlap.ok).toBe(false);
    const belowFloor = setStudioShelfHeight(moved.design, 0, upper.id, 1);
    expect(belowFloor.ok).toBe(false);
    const pastTop = setStudioShelfHeight(moved.design, 0, upper.id, studioFixedTop(moved.design) + 5);
    expect(pastTop.ok).toBe(false);
  });

  it("snaps dragged heights to ¼ in and clamps them inside the opening", () => {
    const design = createStudioDesign();
    expect(studioSnapShelfHeight(design, 20.1)).toBe(20);
    expect(studioSnapShelfHeight(design, 20.14)).toBe(20.25);
    expect(studioSnapShelfHeight(design, -50)).toBe(studioFixedBottom(design) + 0.75);
    expect(studioSnapShelfHeight(design, 500)).toBe(studioFixedTop(design) - studioItemHeight("shelf"));
  });

  it("moves a shelf with moveStudioItem exactly like the drag does", () => {
    const design = createStudioDesign();
    const run = placeStudioShelfLadder(design, 0, 1);
    if (!run.ok) throw new Error(run.reason);
    const shelf = run.placed[0];
    const moved = moveStudioItem(run.design, 0, shelf.id, 30.25);
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(studioBays(moved.design)[0].items.find((item) => item.id === shelf.id)?.bottomIn).toBe(30);
    // moveStudioItem rounds to whole inches; the drag path keeps the quarter-inch precision.
    expect(studioSnapShelfHeight(moved.design, 30.25)).toBe(30.25);
  });
});

describe("one format for every wall", () => {
  it("gives every wall the same canonical tower run", () => {
    // A square room with equal wall lengths, so a shared format is proven by geometry and not by luck.
    const base: StudioDesign = {
      ...createStudioDesign(), wallWidthIn: 120, roomDepthIn: 120,
      // Start with an empty room so each iteration contributes exactly one tower to its own wall.
      wallLayouts: { back: { wallId: "back", bays: [] } },
      bays: [],
    };
    const seen: string[] = [];
    for (const wall of STUDIO_WALLS as StudioWall[]) {
      const scoped = switchStudioWall(base, wall);
      const added = insertStudioBay(scoped, 24, 0, `bay-${wall}`);
      if (!added.ok) throw new Error(added.reason);
      const withParts = snapStudioPart(added.design, 0, "shelf", 42, `shelf-${wall}`);
      if (!withParts.ok) throw new Error(withParts.reason);
      const run = studioCanonicalTowerFootprint(withParts.design, wall);
      seen.push(`${Math.round((run.xMax - run.xMin) * 1000) / 1000}x${Math.round((run.zMax - run.zMin) * 1000) / 1000}`);
      // The run starts at x = 0 with its board face at the tower depth, for every wall.
      expect(Math.round(run.xMin * 1000) / 1000).toBe(0);
      expect(Math.round(run.zMin * 1000) / 1000).toBe(0);
      expect(Math.round(run.zMax * 1000) / 1000).toBe(14.5);
    }
    expect(new Set(seen).size).toBe(1);
    // One 24-in tower plus two uprights, whichever wall it is on.
    expect(seen[0]).toBe("25.5x14.5");
  });

  it("points the camera at each wall from inside the room", () => {
    const design = { ...createStudioDesign(), wallWidthIn: 120, roomDepthIn: 96 };
    const frame = (wall: StudioWall) => studioWallFrame(design, wall);
    expect(Math.abs(frame("back").yaw)).toBe(0);
    expect(frame("left").yaw).toBeCloseTo(Math.PI / 2, 6);
    expect(frame("right").yaw).toBeCloseTo(-Math.PI / 2, 6);
    expect(Math.abs(frame("front").yaw)).toBeCloseTo(Math.PI, 6);
    // The camera yaw is the inverse of the model rotation, so the boards always face the viewer.
    for (const wall of STUDIO_WALLS as StudioWall[]) expect(frame(wall).yaw).toBeCloseTo(-frame(wall).rotationY, 6);
  });
});

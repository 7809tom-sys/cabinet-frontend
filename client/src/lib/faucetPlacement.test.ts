import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addSinkFixture, sinkFaucetTransform } from "@/components/design/InteractiveRoom3D";
import { DEFAULT_ROOM, makeSinkForCabinet, wallPlacementAt, type PlacedCabinet, type SinkFixture, type WallOpening } from "./design";
import {
  clampSinkDragForFaucet,
  raiseWindowsForDeckFaucet,
  resolveDeckFaucetPlacement,
  windowFrameObstacle,
} from "./faucetPlacement";

const room = DEFAULT_ROOM;

function sink(overrides: Partial<SinkFixture> = {}): SinkFixture {
  return {
    uid: "sink-1",
    type: "double",
    x: 31.5,
    y: 2.5,
    width: 33,
    depth: 20,
    sourceDepth: 20,
    faucet: true,
    wallSide: "top",
    faucetRearDeckOffsetIn: 1.25,
    faucetOverallHeight: 15.75,
    faucetSpoutLength: 9.375,
    faucetSpoutHeight: 6.5,
    faucetForm: "pull-down",
    pelicanFaucetProfileId: "pelican-pl-8213-fountain-pull-down",
    ...overrides,
  };
}

function lowSillWindow(overrides: Partial<WallOpening> = {}): WallOpening {
  return {
    uid: "window-1",
    kind: "window",
    label: "Over sink",
    side: "top",
    offset: 30,
    width: 36,
    height: 36,
    sill: 38,
    ...overrides,
  };
}

const counter = [{ x: 0, y: 0, width: 144, depth: 25.5 }];

describe("deck faucet placement around windows", () => {
  it("draws a faucet in front of a low window sill instead of omitting it", () => {
    // Owner rule (Nov 5 2026): the faucet is at the sink, in front of the window. A
    // sink under glazing is the normal kitchen, so this is drawn, not hidden.
    const placement = resolveDeckFaucetPlacement(sink(), room, [lowSillWindow()], counter);
    const frame = windowFrameObstacle(lowSillWindow());
    expect(frame).not.toBeNull();

    expect(placement.renderFaucet).toBe(true);
    expect(placement.anchored).toBe(true);
    expect(placement.inFrontOfWindow).toBe(true);
    expect(placement.conflict).toBe("window-frame");
    // Kept on the deck behind the basin, never pushed into the wall.
    expect(placement.centerFromWallIn).toBeLessThanOrEqual(2.5);
    expect(placement.centerFromWallIn).toBeGreaterThan(0);
    expect(placement.mountY).toBeGreaterThanOrEqual(0);
    expect(placement.mountY).toBeLessThanOrEqual(placement.centerFromWallIn);

    const root = new THREE.Group();
    addSinkFixture(root, sink(), placement);
    const faucetParts: string[] = [];
    root.traverse((node) => {
      if (node.userData.sinkFaucet || node.userData.sinkFaucetBase || node.userData.sinkFaucetSpout) {
        faucetParts.push(String(node.userData.sinkFaucet ? "sinkFaucet" : node.userData.sinkFaucetBase ? "base" : "spout"));
      }
    });
    expect(faucetParts.length).toBeGreaterThan(0);
    expect(faucetParts).toContain("sinkFaucet");
  });

  it("keeps a faucet on the counter behind the sink and clear of the wall when no window is in the way", () => {
    const placed = sink({ type: "single", x: 36, y: 4.5, width: 25, depth: 18, sourceDepth: 18 });
    const placement = resolveDeckFaucetPlacement(placed, room, [], counter);

    expect(placement.warning).toBeNull();
    expect(placement.conflict).toBeNull();
    expect(placement.renderFaucet).toBe(true);
    expect(placement.offsetIn).toBeCloseTo(1.25, 5);
    expect(placement.onCountertop).toBe(true);
    expect(placement.clearOfWall).toBe(true);
    expect(placement.centerFromWallIn).toBeGreaterThan(0.375);
    expect(placement.centerFromWallIn).toBeLessThan(placed.y);
    expect(placement.mountX).toBeCloseTo(placed.x + placed.width / 2, 5);

    const faucet = sinkFaucetTransform(placed, placement.offsetIn);
    expect(faucet.z * 12).toBeCloseTo(placement.centerFromWallIn, 5);
    expect(faucet.x * 12).toBeCloseTo(placement.mountX, 5);
  });

  it("moves a tall faucet forward on the rear deck when that clears a low sill", () => {
    const placed = sink({ type: "single", x: 36, y: 4.5, width: 25, depth: 18, sourceDepth: 18, faucetOverallHeight: 15.75 });
    const placement = resolveDeckFaucetPlacement(placed, room, [lowSillWindow({ offset: 24, width: 48 })], counter);
    const frame = windowFrameObstacle(lowSillWindow())!;

    expect(placement.warning).toBeNull();
    expect(placement.renderFaucet).toBe(true);
    expect(placement.offsetIn).toBeLessThan(1.25);
    expect(placement.offsetIn).toBeGreaterThanOrEqual(0);
    expect(placement.centerFromWallIn).toBeLessThanOrEqual(placed.y);
    expect(placement.centerFromWallIn - 1.14).toBeGreaterThan(frame.intoRoomIn);
    expect(placement.onCountertop).toBe(true);
  });

  it("anchors a left-wall faucet on the counter behind the sink, not in the wall", () => {
    const placed = sink({
      wallSide: "left",
      x: 4.5,
      y: 40,
      width: 18,
      depth: 30,
      sourceWidth: 30,
      sourceDepth: 18,
    });
    const placement = resolveDeckFaucetPlacement(placed, room, [], [{ x: 0, y: 30, width: 25.5, depth: 48 }]);
    expect(placement.warning).toBeNull();
    expect(placement.renderFaucet).toBe(true);
    expect(placement.anchored).toBe(true);
    expect(placement.mountX).toBeCloseTo(4.5 - 1.25, 5);
    expect(placement.mountY).toBeCloseTo(placed.y + placed.depth / 2, 5);
    expect(placement.mountX).toBeGreaterThan(0.375);
    expect(placement.onCountertop).toBe(true);

    // A window on this wall does not block the faucet: standing in front of glazing
    // is expected, and the window never moves.
    const window = lowSillWindow({ side: "left", offset: 30, width: 36, sill: 38 });
    const overWindow = clampSinkDragForFaucet(placed, { x: 3.0, y: placed.y }, room, [window], [{ x: 0, y: 30, width: 25.5, depth: 48 }]);
    expect(overWindow.blocked).toBe(false);
    expect(overWindow.warning).toBeNull();
    expect(resolveDeckFaucetPlacement({ ...placed, x: 3.0 }, room, [window], [{ x: 0, y: 30, width: 25.5, depth: 48 }]).inFrontOfWindow).toBe(true);
    // Pushing the sink into the wall is still refused.
    const intoWall = clampSinkDragForFaucet(placed, { x: -6, y: placed.y }, room, [window], [{ x: 0, y: 30, width: 25.5, depth: 48 }]);
    expect(intoWall.blocked).toBe(true);
    expect(intoWall.x).toBe(placed.x);
  });

  it("allows a drag in front of a window but still refuses one off the countertop", () => {
    const placed = sink({ type: "single", x: 36, y: 4.5, width: 30, depth: 18, sourceDepth: 18 });
    const window = lowSillWindow({ offset: 24, width: 48, sill: 32, height: 40 });

    // Toward the window, while still on the deck and clear of the wall: allowed. The
    // faucet stands in front of the glazing.
    const towardWindow = clampSinkDragForFaucet(placed, { x: placed.x, y: 3.0 }, room, [window], counter);
    expect(towardWindow.blocked).toBe(false);
    expect(towardWindow.y).toBe(3.0);
    expect(towardWindow.warning).toBeNull();
    expect(resolveDeckFaucetPlacement({ ...placed, y: 3.0 }, room, [window], counter).inFrontOfWindow).toBe(true);

    // Off the measured countertop: still refused.
    const offCounter = clampSinkDragForFaucet(placed, { x: placed.x, y: 80 }, room, [window], counter);
    expect(offCounter.blocked).toBe(true);
    expect(offCounter.x).toBe(placed.x);
    expect(offCounter.y).toBe(placed.y);

    const alongCounter = clampSinkDragForFaucet(placed, { x: 90, y: placed.y }, room, [window], counter);
    expect(alongCounter.blocked).toBe(false);
    expect(alongCounter.x).toBe(90);
    expect(alongCounter.y).toBe(placed.y);
  });
});

/** Farmhouse apron sink centered under a window, with no rear-deck offset. */
function farmhouseUnderWindow(faucetHeightIn: number, sill = 42, height = 36) {
  const spot = wallPlacementAt(54, 36, 24, "top", room);
  const cabinet: PlacedCabinet = {
    uid: "fsb-36",
    cabinetId: 36,
    masterCode: "FSB36",
    description: "36 inch farmhouse sink base",
    category: "Base",
    placement: "base",
    x: spot!.x,
    y: spot!.y,
    width: 36,
    depth: 24,
    height: 34.5,
    rotation: spot!.rotation,
    wallId: spot!.wallId,
    wallOffset: spot!.wallOffset,
    numberOfDoors: 0,
    numberOfDrawers: 0,
  };
  const placed = makeSinkForCabinet("farmhouse", cabinet, room, { width: 33, depth: 21 });
  const fixture: SinkFixture = {
    ...placed,
    uid: "farm-sink",
    faucet: true,
    faucetOverallHeight: faucetHeightIn,
    faucetSpoutLength: 9.375,
    faucetSpoutHeight: 6.5,
    faucetForm: "pull-down",
    pelicanFaucetProfileId: "pelican-pl-8213-fountain-pull-down",
    faucetRearDeckOffsetIn: undefined,
  };
  const along = fixture.x + fixture.width / 2;
  const window: WallOpening = {
    uid: "window-over-farm",
    kind: "window",
    label: "Over sink",
    side: "top",
    offset: along - 18,
    width: 36,
    height,
    sill,
  };
  return { fixture, window };
}

describe("a faucet in front of a window is drawn, and the window never moves", () => {
  it("leaves a low sill exactly as it is and draws the faucet in front of the glazing", () => {
    const { fixture, window } = farmhouseUnderWindow(15.75);
    expect(fixture.faucetRearDeckOffsetIn).toBeUndefined();
    expect(fixture.type).toBe("farmhouse");

    const placement = resolveDeckFaucetPlacement(fixture, room, [window], counter);
    // Standing in front of the window is expected, and is reported as such.
    expect(placement.inFrontOfWindow).toBe(true);
    expect(placement.renderFaucet).toBe(true);
    expect(placement.anchored).toBe(true);

    const raised = raiseWindowsForDeckFaucet({
      sinks: [fixture],
      room,
      openings: [window],
      countertops: counter,
      wallLabels: { top: "Wall 1" },
    });
    // The window is the SAME object, with every coordinate and dimension intact.
    expect(raised.openings[0]).toBe(window);
    expect(raised.openings[0]!.sill).toBe(window.sill);
    expect(raised.openings[0]!.height).toBe(window.height);
    expect(raised.openings[0]!.offset).toBe(window.offset);
    expect(raised.openings[0]!.width).toBe(window.width);
    expect(raised.notes).toEqual([]);
    expect(raised.unresolved).toBe(false);
    expect(raised.inFrontOfWindow).toBe(true);

    // And the faucet really is built as meshes.
    const root = new THREE.Group();
    addSinkFixture(root, fixture, placement);
    const faucetParts: string[] = [];
    root.traverse((node) => {
      if (node.userData.sinkFaucet || node.userData.sinkFaucetBase || node.userData.sinkFaucetSpout) faucetParts.push("faucet");
    });
    expect(faucetParts.length).toBeGreaterThan(0);
  });

  it("moves the faucet forward on the deck where it can, without touching the window", () => {
    const placed = sink({ type: "single", x: 36, y: 6, width: 25, depth: 18, sourceDepth: 18, faucetOverallHeight: 15.75 });
    const window = lowSillWindow({ offset: 24, width: 48 });
    const placement = resolveDeckFaucetPlacement(placed, room, [window], counter);
    expect(placement.renderFaucet).toBe(true);
    // It stayed on the deck, behind the basin.
    expect(placement.centerFromWallIn).toBeLessThanOrEqual(placed.y);
    expect(placement.centerFromWallIn).toBeGreaterThan(0);
    const raised = raiseWindowsForDeckFaucet({ sinks: [placed], room, openings: [window], countertops: counter });
    expect(raised.openings[0]).toBe(window);
  });

  it("draws the faucet even when the wall is too low to raise any sill", () => {
    const { fixture, window } = farmhouseUnderWindow(15.75);
    const lowRoom = {
      ...room,
      customWalls: [{ id: "top", startVertexId: "a", endVertexId: "b", height: 48 }],
    };
    const raised = raiseWindowsForDeckFaucet({
      sinks: [fixture],
      room: lowRoom,
      openings: [window],
      countertops: counter,
      wallLabels: { top: "Wall 1" },
    });
    expect(raised.openings[0]).toBe(window);
    expect(raised.notes).toEqual([]);
    expect(raised.unresolved).toBe(false);
    const placement = resolveDeckFaucetPlacement(fixture, lowRoom, raised.openings, counter);
    expect(placement.renderFaucet).toBe(true);
    expect(placement.inFrontOfWindow).toBe(true);
  });

  it("keeps a taller faucet in front of the same untouched window", () => {
    const short = farmhouseUnderWindow(8);
    const first = raiseWindowsForDeckFaucet({
      sinks: [short.fixture],
      room,
      openings: [short.window],
      countertops: counter,
      wallLabels: { top: "Wall 1" },
    });
    expect(first.openings[0]).toBe(short.window);
    const tallFixture = { ...short.fixture, faucetOverallHeight: 15.75 };
    const second = raiseWindowsForDeckFaucet({
      sinks: [tallFixture],
      room,
      openings: first.openings,
      countertops: counter,
      wallLabels: { top: "Wall 1" },
    });
    expect(second.openings[0]).toBe(short.window);
    expect(second.openings[0]!.sill).toBe(short.window.sill);
    expect(second.openings[0]!.height).toBe(short.window.height);
    const placement = resolveDeckFaucetPlacement(tallFixture, room, second.openings, counter);
    expect(placement.renderFaucet).toBe(true);
    expect(placement.inFrontOfWindow).toBe(true);
  });

  it("keeps a window that already clears the faucet exactly as it is", () => {
    const { fixture, window } = farmhouseUnderWindow(15.75, 72, 18);
    const raised = raiseWindowsForDeckFaucet({ sinks: [fixture], room, openings: [window], countertops: counter });
    expect(raised.openings[0]).toBe(window);
    expect(raised.notes).toEqual([]);
    expect(raised.unresolved).toBe(false);
  });
});

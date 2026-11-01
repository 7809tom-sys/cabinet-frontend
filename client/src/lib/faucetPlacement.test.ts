import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addSinkFixture, sinkFaucetTransform } from "@/components/design/InteractiveRoom3D";
import { DEFAULT_ROOM, STD, makeSinkForCabinet, wallPlacementAt, type PlacedCabinet, type SinkFixture, type WallOpening } from "./design";
import {
  FAUCET_FRAME_GAP_IN,
  FAUCET_WINDOW_CONFLICT_MESSAGE,
  clampSinkDragForFaucet,
  minimumFaucetClearSill,
  raiseWindowsForDeckFaucet,
  resolveDeckFaucetPlacement,
  windowFrameObstacle,
  windowTrimWidthIn,
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
  it("does not put a faucet through a low window sill when the rear deck cannot clear the frame", () => {
    const placement = resolveDeckFaucetPlacement(sink(), room, [lowSillWindow()], counter);
    const frame = windowFrameObstacle(lowSillWindow());

    expect(frame).not.toBeNull();
    expect(placement.conflict).toBe("window-frame");
    expect(placement.warning).toBe(FAUCET_WINDOW_CONFLICT_MESSAGE);
    expect(placement.renderFaucet).toBe(false);
    expect(placement.centerFromWallIn).toBeLessThanOrEqual(2.5);
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
    expect(faucetParts).toEqual([]);
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

    const window = lowSillWindow({ side: "left", offset: 30, width: 36, sill: 38 });
    const blocked = clampSinkDragForFaucet(placed, { x: 0.3, y: placed.y }, room, [window], [{ x: 0, y: 30, width: 25.5, depth: 48 }]);
    expect(blocked.blocked).toBe(true);
    expect(blocked.x).toBe(placed.x);
    expect(blocked.warning).toBe(FAUCET_WINDOW_CONFLICT_MESSAGE);
  });

  it("refuses a manual drag into a window frame or off the countertop", () => {
    const placed = sink({ type: "single", x: 36, y: 4.5, width: 30, depth: 18, sourceDepth: 18 });
    const window = lowSillWindow({ offset: 24, width: 48, sill: 32, height: 40 });

    const intoWindow = clampSinkDragForFaucet(placed, { x: placed.x, y: 0.4 }, room, [window], counter);
    expect(intoWindow.blocked).toBe(true);
    expect(intoWindow.x).toBe(placed.x);
    expect(intoWindow.y).toBe(placed.y);
    expect(intoWindow.warning).toBe(FAUCET_WINDOW_CONFLICT_MESSAGE);

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

function roundSillUp(value: number): number {
  const halves = value * 2;
  const nearest = Math.round(halves);
  if (Math.abs(halves - nearest) <= 1e-6) return nearest / 2;
  return Math.ceil(halves - 1e-9) / 2;
}

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

describe("Auto-Design raises a window instead of hiding the faucet", () => {
  it("raises a low sill the minimum half inch and then draws the faucet", () => {
    const { fixture, window } = farmhouseUnderWindow(15.75);
    expect(fixture.faucetRearDeckOffsetIn).toBeUndefined();
    expect(fixture.type).toBe("farmhouse");
    const before = resolveDeckFaucetPlacement(fixture, room, [window], counter);
    expect(before.conflict).toBe("window-frame");
    expect(before.renderFaucet).toBe(false);

    const rawSill = minimumFaucetClearSill(window, 15.75);
    const expectedSill = roundSillUp(rawSill);
    expect(expectedSill).toBeGreaterThan(window.sill);
    expect(expectedSill * 2).toBe(Math.round(expectedSill * 2));
    const apron = windowTrimWidthIn(window.width) * 1.6;
    expect(expectedSill - apron).toBeGreaterThanOrEqual(STD.COUNTERTOP_HEIGHT + 15.75 + FAUCET_FRAME_GAP_IN - 1e-6);

    const raised = raiseWindowsForDeckFaucet({
      sinks: [fixture],
      room,
      openings: [window],
      countertops: counter,
      wallLabels: { top: "Wall 1" },
    });
    const opening = raised.openings[0]!;
    const fixedTop = window.sill + window.height;
    expect(opening.sill).toBe(expectedSill);
    expect(opening.sill + opening.height).toBeCloseTo(fixedTop, 5);
    expect(opening.height).toBeCloseTo(fixedTop - expectedSill, 5);
    expect(opening.offset).toBe(window.offset);
    expect(opening.side).toBe(window.side);
    expect(raised.unresolved).toBe(false);
    expect(raised.notes[0]?.text).toMatch(/sill raised/);
    expect(raised.notes[0]?.text).toMatch(/was not raised or moved/);
    expect(raised.notes[0]?.text).not.toMatch(/Window on Wall 1 raised/);

    const after = resolveDeckFaucetPlacement(fixture, room, raised.openings, counter);
    expect(after.conflict).toBeNull();
    expect(after.warning).toBeNull();
    expect(after.renderFaucet).toBe(true);
    const root = new THREE.Group();
    addSinkFixture(root, fixture, after);
    const faucetParts: string[] = [];
    root.traverse((node) => {
      if (node.userData.sinkFaucet || node.userData.sinkFaucetBase || node.userData.sinkFaucetSpout) {
        faucetParts.push("faucet");
      }
    });
    expect(faucetParts.length).toBeGreaterThan(0);
  });

  it("leaves a window that already clears the faucet where it is", () => {
    const { fixture, window } = farmhouseUnderWindow(15.75, 72, 18);
    const before = resolveDeckFaucetPlacement(fixture, room, [window], counter);
    expect(before.conflict).toBeNull();
    const raised = raiseWindowsForDeckFaucet({ sinks: [fixture], room, openings: [window], countertops: counter });
    expect(raised.openings[0]).toBe(window);
    expect(raised.notes).toEqual([]);
    expect(raised.unresolved).toBe(false);
  });

  it("keeps the hidden-faucet warning when the wall is too low to raise the sill", () => {
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
    expect(raised.unresolved).toBe(true);
    expect(raised.openings[0]?.sill).toBe(window.sill);
    expect(raised.openings[0]?.height).toBe(window.height);
    expect(raised.notes[0]?.text).toBe("Window on Wall 1 was left where it is. The sill could not be raised enough for the faucet without moving the top.");
    const stillBlocked = resolveDeckFaucetPlacement(fixture, lowRoom, raised.openings, counter);
    expect(stillBlocked.renderFaucet).toBe(false);
    expect(stillBlocked.warning).toBe(FAUCET_WINDOW_CONFLICT_MESSAGE);
    expect(FAUCET_WINDOW_CONFLICT_MESSAGE).not.toMatch(/lower faucet/i);
    expect(FAUCET_WINDOW_CONFLICT_MESSAGE).toMatch(/raising the sill/i);
    expect(FAUCET_WINDOW_CONFLICT_MESSAGE).toMatch(/top stays put/i);
  });

  it("raises the window again when a taller faucet replaces the first one", () => {
    const short = farmhouseUnderWindow(8);
    const first = raiseWindowsForDeckFaucet({
      sinks: [short.fixture],
      room,
      openings: [short.window],
      countertops: counter,
      wallLabels: { top: "Wall 1" },
    });
    const tallFixture = { ...short.fixture, faucetOverallHeight: 15.75 };
    const second = raiseWindowsForDeckFaucet({
      sinks: [tallFixture],
      room,
      openings: first.openings,
      countertops: counter,
      wallLabels: { top: "Wall 1" },
    });
    expect(second.openings[0]!.sill).toBeGreaterThan(first.openings[0]!.sill);
    expect(resolveDeckFaucetPlacement(tallFixture, room, second.openings, counter).renderFaucet).toBe(true);
    expect(resolveDeckFaucetPlacement(tallFixture, room, second.openings, counter).conflict).toBeNull();
    expect(second.openings[0]!.sill + second.openings[0]!.height).toBeCloseTo(short.window.sill + short.window.height, 5);
    expect(second.notes[0]?.text).toMatch(/sill raised .+ in\. so the faucet clears it/);
    expect(second.notes[0]?.text).toMatch(/was not raised or moved/);
  });
});

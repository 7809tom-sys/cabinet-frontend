import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addSinkFixture, sinkFaucetTransform } from "@/components/design/InteractiveRoom3D";
import { DEFAULT_ROOM, type SinkFixture, type WallOpening } from "./design";
import {
  FAUCET_WINDOW_CONFLICT_MESSAGE,
  clampSinkDragForFaucet,
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

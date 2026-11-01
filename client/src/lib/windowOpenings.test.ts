import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addWallOpening } from "@/components/design/InteractiveRoom3D";
import { DEFAULT_ROOM, type PlacedCabinet, type SinkFixture, type WallOpening, type WallSide } from "./design";
import { raiseWindowsForDeckFaucet } from "./faucetPlacement";
import { dropDuplicateAutoWindows, moveWindowsWithWallTops } from "./windowOpenings";

function autoWindow(side: WallSide, uid: string, note = "Window on Wall 2: sill raised 4.5 in. so the faucet clears it."): WallOpening {
  return {
    uid, kind: "window", label: 'Over-Sink Window 36" × 48"', side, offset: 40, width: 36, height: 44.5, sill: 51.5,
    faucetClearanceNote: note, autoPlaced: true,
  };
}

function handWindow(side: WallSide): WallOpening {
  return { uid: `hand-${side}`, kind: "window", label: 'Window 36"', side, offset: 12, width: 36, height: 36, sill: 42 };
}

describe("windows stay on the wall they belong to", () => {
  it("drops auto-generated copies that were stamped onto every wall and keeps the sink wall", () => {
    const openings = (["top", "left", "right", "bottom"] as const).map((side, index) => autoWindow(side, `copy-${index}`));
    const sink = {
      uid: "sink", cabinetId: 1, masterCode: "SB36", description: "36 inch Sink Base", placement: "base",
      wallId: "right", x: 120, y: 40, width: 36, depth: 24, height: 34.5, rotation: 270,
    } as PlacedCabinet;
    const kept = dropDuplicateAutoWindows(openings, DEFAULT_ROOM, [sink]);
    expect(kept.map((opening) => opening.side)).toEqual(["right"]);
    expect(kept).toHaveLength(1);
  });

  it("keeps a hand-placed window on every wall", () => {
    const openings = (["top", "left", "right", "bottom"] as const).map(handWindow);
    expect(dropDuplicateAutoWindows(openings, DEFAULT_ROOM)).toBe(openings);
  });

  it("keeps two different auto windows that are not copies", () => {
    const sinkWall = autoWindow("top", "sink-window");
    const other = autoWindow("left", "other", "Window on Wall 1: sill raised 2 in. so the faucet clears it.");
    other.offset = 80;
    const kept = dropDuplicateAutoWindows([sinkWall, other], DEFAULT_ROOM);
    expect(kept.map((opening) => opening.uid).sort()).toEqual(["other", "sink-window"]);
  });

  it("draws one window mesh for one opening, not one per wall", () => {
    const root = new THREE.Group();
    addWallOpening(root, handWindow("top"), DEFAULT_ROOM);
    const drawn: string[] = [];
    root.traverse((node) => {
      if (node.userData.openingUid) drawn.push(String(node.userData.openingUid));
    });
    expect(drawn).toEqual(["hand-top"]);
  });
});

describe("a raised wall carries its windows and then locks them", () => {
  it("moves only the windows on the wall that got taller, by the same amount", () => {
    const windows = [handWindow("top"), handWindow("left")];
    const nextRoom = { ...DEFAULT_ROOM, wallCeilings: { top: { high: 108, low: 108 } } };
    const moved = moveWindowsWithWallTops(windows, DEFAULT_ROOM, nextRoom);
    const top = moved.find((opening) => opening.side === "top")!;
    const left = moved.find((opening) => opening.side === "left")!;
    expect(top.sill).toBe(54);
    expect(top.height).toBe(36);
    expect(top.sill + top.height).toBe(90);
    expect(top.wallHeightLocked).toBe(true);
    expect(left.sill).toBe(42);
    expect(left.wallHeightLocked).toBeUndefined();
  });

  it("does not shorten a window that is locked to its wall", () => {
    const locked: WallOpening = {
      uid: "window-1", kind: "window", label: "Over sink", side: "top", offset: 30, width: 36, height: 36, sill: 38,
      wallHeightLocked: true,
    };
    const sink: SinkFixture = {
      uid: "sink-1", type: "double", x: 31.5, y: 2.5, width: 33, depth: 20, sourceDepth: 20, faucet: true,
      wallSide: "top", faucetRearDeckOffsetIn: 1.25, faucetOverallHeight: 15.75, faucetSpoutLength: 9.375,
      faucetSpoutHeight: 6.5, faucetForm: "pull-down",
    };
    const result = raiseWindowsForDeckFaucet({
      sinks: [sink], room: DEFAULT_ROOM, openings: [locked], wallLabels: { top: "Wall 1" },
    });
    expect(result.openings[0]).toMatchObject({ sill: 38, height: 36, offset: 30 });
    expect(result.openings[0]!.sill + result.openings[0]!.height).toBe(74);
    expect(result.notes[0]?.text).toMatch(/locked to its wall/);
    expect(result.unresolved).toBe(true);
  });
});

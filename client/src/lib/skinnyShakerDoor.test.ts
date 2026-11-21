import { describe, expect, it } from "vitest";
import { SHAKER_FRAME_MAX_FACE_WIDTH_SHARE, threeDShakerRailThickness } from "./shakerRail";
import { standardDoorCountForFaceWidth } from "./cabinetGraphics";
import { dlShakerDoorBox, dlShakerFrameIn } from "@shared/doorBoxBlueprint";

// Tom, Nov 21 2026, 3:35 PM CT: a narrow wall door "not follow the dl framework".
// Two full 3 inch stiles left a sliver of center, so the door read as flat planks.
const INCH = 1 / 12;
const OUTER_REVEAL_IN = 1 / 16;
const CENTER_GAP_IN = 1 / 8;

function standardFaceWidthIn(cabinetWidthIn: number, doors: number): number {
  return (cabinetWidthIn - OUTER_REVEAL_IN * 2 - CENTER_GAP_IN * (doors - 1)) / doors;
}

function frameIn(faceWIn: number, faceHIn: number, requested?: number) {
  return threeDShakerRailThickness(faceWIn * INCH, faceHIn * INCH, requested) / INCH;
}

describe("DL Shaker frame on skinny doors", () => {
  it("keeps the recessed center at least half the door wide on every standard width", () => {
    for (const width of [6, 9, 10.5, 12, 15, 18, 21, 24, 27, 30, 33, 36, 42]) {
      for (const doors of [standardDoorCountForFaceWidth(width), 2]) {
        const face = standardFaceWidthIn(width, doors);
        if (face < 7) continue; // under 7 in is a plain slab (DL_SHAKER_SLAB_BELOW_IN)
        for (const height of [30, 36, 42]) {
          const stile = frameIn(face, height, 3);
          const rail = frameIn(face, height, 3);
          const label = `${width}in ${doors}-door face ${face.toFixed(3)}x${height}`;
          expect(rail, label).toBeCloseTo(stile, 9);
          expect(stile, label).toBeGreaterThan(0);
          expect((face - stile * 2) / face, label).toBeGreaterThanOrEqual(0.5 - 1e-9);
        }
      }
    }
  });

  it("shrinks the frame on a 9 inch wall door instead of leaving a 2.875 inch sliver", () => {
    const face = standardFaceWidthIn(9, 1);
    expect(face).toBeCloseTo(8.875, 6);
    expect(frameIn(face, 42)).toBeCloseTo(face * SHAKER_FRAME_MAX_FACE_WIDTH_SHARE, 6);
    expect(face - frameIn(face, 42) * 2).toBeCloseTo(4.4375, 4);
  });

  it("covers two narrow doors on an 18 inch cabinet the catalog sets to two doors", () => {
    const face = standardFaceWidthIn(18, 2);
    expect(face).toBeLessThan(9);
    expect(face - frameIn(face, 42) * 2).toBeGreaterThanOrEqual(face / 2 - 1e-9);
  });

  it("leaves 12 inch and wider doors at the full 3 inch DL frame", () => {
    for (const face of [12, 14.875, 17.875, 20.875]) expect(frameIn(face, 30)).toBeCloseTo(3, 9);
    expect(frameIn(11.875, 30)).toBeCloseTo(2.96875, 6);
  });

  it("keeps the admin Door Box Blueprint on the same clamp, five pieces on a narrow door", () => {
    for (const [w, h, r] of [[8.875, 42, 3], [6, 30, 3], [11.875, 30, 3], [15, 30, 2.75], [8.875, 30, 1]] as const) {
      expect(dlShakerFrameIn(w, h, r)).toBeCloseTo(frameIn(w, h, r), 6);
    }
    const box = dlShakerDoorBox(8.875, 42);
    expect(box.kind).not.toBe("slab");
    expect(box.pieces.map((piece) => piece.id)).toEqual(["top-rail", "bottom-rail", "left-stile", "right-stile", "center-panel"]);
    const center = box.pieces.find((piece) => piece.id === "center-panel");
    expect(center?.widthIn ?? 0).toBeGreaterThanOrEqual(8.875 / 2 - 0.01);
  });
});

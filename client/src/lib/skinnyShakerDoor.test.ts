import { describe, expect, it } from "vitest";
import { threeDShakerRailThickness } from "./shakerRail";
import { standardDoorCountForFaceWidth } from "./cabinetGraphics";
import { dlShakerDoorBox, dlShakerFrameIn } from "@shared/doorBoxBlueprint";
import { RAISED_PANEL_BLUEPRINT, raisedPanelFrameGeometry } from "@shared/raisedPanelDoorBlueprint";
import {
  RAISED_PANEL_FRAME_IN,
  REGULAR_SHAKER_FRAME_IN,
  SKINNY_SHAKER_FACE_BELOW_IN,
  SKINNY_SHAKER_FRAME_MAX_FACE_SHARE,
  isSkinnyShakerFace,
  shakerFrameWidthIn,
} from "@shared/shakerFrameRule";

// Tom, Nov 21 2026: 3:35 PM CT "not follow the dl framework" (a narrow door read as flat
// planks), 3:45 PM CT: regular shaker = fixed 2.75 in frame; skinny shaker (face under
// 12 in, confirm with Tom) = min(2.75, 25% of the face), rails = stiles.
const INCH = 1 / 12;
const OUTER_REVEAL_IN = 1 / 16;
const CENTER_GAP_IN = 1 / 8;

function standardFaceWidthIn(cabinetWidthIn: number, doors: number): number {
  return (cabinetWidthIn - OUTER_REVEAL_IN * 2 - CENTER_GAP_IN * (doors - 1)) / doors;
}

function frameIn(faceWIn: number, faceHIn: number, requested?: number | string | null) {
  return threeDShakerRailThickness(faceWIn * INCH, faceHIn * INCH, requested) / INCH;
}

describe("regular shaker vs skinny shaker frame", () => {
  it("names the rule: 2.75 in regular frame, skinny under 12 in, 25% cap", () => {
    expect(REGULAR_SHAKER_FRAME_IN).toBe(2.75);
    expect(SKINNY_SHAKER_FACE_BELOW_IN).toBe(12);
    expect(SKINNY_SHAKER_FRAME_MAX_FACE_SHARE).toBe(0.25);
    expect(isSkinnyShakerFace(11.99)).toBe(true);
    expect(isSkinnyShakerFace(12)).toBe(false);
  });

  it("gives every regular shaker door exactly 2.75 in, whatever standard width is stored", () => {
    for (const face of [12, 14.875, 17.875, 20.875, 23.875, 30]) {
      for (const height of [12, 24, 30, 36, 42, 84]) {
        for (const stored of [undefined, null, "", 3, "3", 2.75, "2.75"]) {
          const label = `${face}x${height} stored ${String(stored)}`;
          expect(frameIn(face, height, stored), label).toBeCloseTo(2.75, 9);
          expect(dlShakerFrameIn(face, height, typeof stored === "number" ? stored : null), label).toBe(2.75);
        }
      }
    }
  });

  it("caps a skinny door at 25% of its face, rails equal stiles, center at least half the door", () => {
    for (const face of [7, 7.3125, 8, 8.875, 9.5, 10, 10.375]) {
      for (const height of [30, 36, 42]) {
        const label = `${face}x${height}`;
        const frame = frameIn(face, height);
        expect(frame, label).toBeCloseTo(Math.min(2.75, face * 0.25), 9);
        expect(frameIn(face, height, 3), label).toBeCloseTo(frame, 9);
        expect((face - frame * 2) / face, label).toBeGreaterThanOrEqual(0.5 - 1e-9);
      }
    }
    // Between 11 and 12 in the cap is above 2.75, so the frame is the regular 2.75.
    expect(frameIn(11.875, 30)).toBeCloseTo(2.75, 9);
    expect(frameIn(11, 30)).toBeCloseTo(2.75, 9);
  });

  it("fixes the 9 in wall door Tom flagged (8.875 in face)", () => {
    const face = standardFaceWidthIn(9, 1);
    expect(face).toBeCloseTo(8.875, 6);
    expect(frameIn(face, 42)).toBeCloseTo(2.21875, 6);
    expect(face - frameIn(face, 42) * 2).toBeCloseTo(4.4375, 6);
  });

  it("covers every standard cabinet width, one or two doors", () => {
    for (const width of [9, 10.5, 12, 15, 18, 21, 24, 27, 30, 33, 36, 42]) {
      for (const doors of [standardDoorCountForFaceWidth(width), 2]) {
        const face = standardFaceWidthIn(width, doors);
        if (face < 7) continue; // under 7 in is a plain slab (DL_SHAKER_SLAB_BELOW_IN)
        const expected = face < 12 ? Math.min(2.75, face * 0.25) : 2.75;
        expect(frameIn(face, 30), `${width}in ${doors}-door`).toBeCloseTo(expected, 9);
      }
    }
  });

  it("keeps a verified non-standard width (Slim Shaker 1 in) and caps it only on a tiny face", () => {
    expect(frameIn(15, 30, 1)).toBeCloseTo(1, 9);
    expect(frameIn(8.875, 30, 1)).toBeCloseTo(1, 9);
    expect(frameIn(3, 30, 1)).toBeCloseTo(0.75, 9);
  });

  it("keeps the admin Door Box Blueprint on the same rule, five pieces on a skinny door", () => {
    for (const [w, h, r] of [[8.875, 42, 3], [11.875, 30, 3], [15, 30, 2.75], [24, 42, null], [8.875, 30, 1]] as const) {
      expect(dlShakerFrameIn(w, h, r)).toBeCloseTo(frameIn(w, h, r), 9);
      expect(dlShakerFrameIn(w, h, r)).toBeCloseTo(shakerFrameWidthIn(w, h, r), 9);
    }
    expect(dlShakerDoorBox(15, 30).frameIn).toBe(2.75);
    const box = dlShakerDoorBox(8.875, 42);
    expect(box.kind).not.toBe("slab");
    expect(box.pieces.map((piece) => piece.id)).toEqual(["top-rail", "bottom-rail", "left-stile", "right-stile", "center-panel"]);
    expect(box.pieces.find((piece) => piece.id === "center-panel")?.widthIn ?? 0).toBeGreaterThanOrEqual(8.875 / 2 - 0.01);
  });

  it("gives every regular raised panel door exactly 2.5 in (Tom, 3:51 PM CT)", () => {
    expect(RAISED_PANEL_FRAME_IN).toBe(2.5);
    for (const face of [12, 14.875, 17.875, 20.875, 30]) {
      for (const height of [24, 30, 42]) {
        for (const stored of [undefined, null, "", 3, "3", 2.75]) {
          const label = `raised ${face}x${height} stored ${String(stored)}`;
          expect(threeDShakerRailThickness(face * INCH, height * INCH, stored, "raised") / INCH, label).toBeCloseTo(2.5, 9);
        }
      }
    }
  });

  it("caps a skinny raised panel door at min(2.5, 25% of the face)", () => {
    for (const face of [7, 8, 8.875, 9.5, 10.375, 11.875]) {
      const frame = threeDShakerRailThickness(face * INCH, 30 * INCH, null, "raised") / INCH;
      expect(frame, String(face)).toBeCloseTo(Math.min(2.5, face * 0.25), 9);
      expect((face - frame * 2) / face).toBeGreaterThanOrEqual(0.5 - 1e-9);
    }
    // A measured raised width that is not the old default is kept.
    expect(threeDShakerRailThickness(15 * INCH, 30 * INCH, 2, "raised") / INCH).toBeCloseTo(2, 9);
  });

  it("keeps the admin raised panel blueprint on the same 2.5 in frame as the 3D raised door", () => {
    expect(RAISED_PANEL_BLUEPRINT.frame.railIn).toBe(2.5);
    expect(RAISED_PANEL_BLUEPRINT.frame.stileIn).toBe(2.5);
    for (const [w, h] of [[15, 30], [8.875, 42], [11.875, 30], [24, 42]] as const) {
      const g = raisedPanelFrameGeometry({ faceWidth: w * INCH, faceHeight: h * INCH });
      const expected = threeDShakerRailThickness(w * INCH, h * INCH, null, "raised");
      expect(g.rail, `${w}x${h}`).toBeCloseTo(expected, 9);
      expect(g.stile, `${w}x${h}`).toBeCloseTo(expected, 9);
    }
  });
});

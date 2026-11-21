/**
 * Door Box Blueprint: DL raised panel and DL slim shaker sections
 * (Tom, voice, Nov 21 2026, 1:11 PM CT).
 */
import { describe, expect, it } from "vitest";
import {
  DL_PUBLISHED_DOOR_THICKNESS_IN,
  SLIM_SHAKER_FRAME_IN,
  TBD_CONFIRM_WITH_TOM,
  dlShakerDoorBox,
  raisedPanelDoorBox,
  slabDoorBox,
  slimShakerDoorBox,
} from "./doorBoxBlueprint";
import { RAISED_PANEL_BLUEPRINT, raisedPanelFrameGeometry } from "./raisedPanelDoorBlueprint";
import { DLC_FRAME_DETAIL } from "./dlcFr26Textures";

describe("DL slim shaker door box", () => {
  it("is five pieces on the 1 inch slim frame with the DL frame depth", () => {
    const box = slimShakerDoorBox(15, 30);
    expect(box.kind).toBe("slim-shaker");
    expect(box.frameIn).toBe(1);
    expect(box.pieces.map((p) => p.id)).toEqual(["top-rail", "bottom-rail", "left-stile", "right-stile", "center-panel"]);
    const center = box.pieces.find((p) => p.id === "center-panel")!;
    expect(center.widthIn).toBe(13);
    expect(center.heightIn).toBe(28);
    expect(box.pieces.find((p) => p.id === "top-rail")!.widthIn).toBe(15);
    expect(box.depthIn).toBeCloseTo(DLC_FRAME_DETAIL.railDepth * 12, 3);
  });

  it("matches the repo's Slim Shaker frame rule", async () => {
    const { SLIM_SHAKER_FRAME_INCHES } = await import("../client/src/lib/doorFrameMetrics");
    const { SLIM_SHAKER_FACE_FRAME_INCHES } = await import("../client/src/lib/elevationFrameGeometry");
    expect(SLIM_SHAKER_FRAME_IN).toBe(SLIM_SHAKER_FRAME_INCHES);
    expect(SLIM_SHAKER_FRAME_IN).toBe(SLIM_SHAKER_FACE_FRAME_INCHES);
  });

  it("does not apply the 2.75/3 inch small-front slab rule", () => {
    const drawer = slimShakerDoorBox(15, 6);
    expect(drawer.kind).toBe("slim-shaker");
    expect(drawer.smallFrontSlab).toBe(false);
    expect(drawer.frameIn).toBe(1);
  });
});

describe("DL raised panel door box", () => {
  it("uses the renderer's raised panel geometry, in inches", () => {
    const box = raisedPanelDoorBox(15, 30);
    const g = raisedPanelFrameGeometry({ faceWidth: 15 / 12, faceHeight: 30 / 12, dlcFrame: true });
    expect(box.kind).toBe("raised-panel");
    expect(box.center).toBe("raised");
    expect(box.pieces.map((p) => p.id)).toEqual(["top-rail", "bottom-rail", "left-stile", "right-stile", "groove", "bevel", "raised-panel"]);
    expect(box.frameIn).toBe(RAISED_PANEL_BLUEPRINT.frame.railIn);
    const panel = box.pieces.find((p) => p.id === "raised-panel")!;
    expect(panel.widthIn).toBeCloseTo(g.panelWidth * 12, 2);
    expect(panel.heightIn).toBeCloseTo(g.panelHeight * 12, 2);
    const bevel = box.pieces.find((p) => p.id === "bevel")!;
    expect(bevel.depthIn).toBeCloseTo(RAISED_PANEL_BLUEPRINT.bevel.readableDepthIn, 3);
    expect(box.depthIn).toBeCloseTo(RAISED_PANEL_BLUEPRINT.frame.dlcRailDepthFt * 12, 3);
    // The panel sits inside the opening and is centered on the door.
    expect(panel.xIn + panel.widthIn / 2).toBeCloseTo(7.5, 2);
    expect(panel.yIn + panel.heightIn / 2).toBeCloseTo(15, 2);
  });
});

describe("published values and TBDs", () => {
  it("cites DL's published 3/4 inch door thickness and marks unknowns TBD", () => {
    expect(DL_PUBLISHED_DOOR_THICKNESS_IN).toBe(0.75);
    for (const box of [raisedPanelDoorBox(15, 30), slimShakerDoorBox(15, 30)]) {
      expect(box.published?.some((line) => line.includes("Specification Book"))).toBe(true);
      expect(box.tbd?.length).toBeGreaterThan(0);
      for (const line of box.tbd!) expect(line).toContain(TBD_CONFIRM_WITH_TOM);
    }
  });

  it("leaves the original DL shaker and slab boxes unchanged", () => {
    const shaker = dlShakerDoorBox(15, 30);
    expect(shaker.tbd).toBeUndefined();
    expect(shaker.published).toBeUndefined();
    expect(shaker.pieces.every((p) => p.zIn === undefined)).toBe(true);
    expect(slabDoorBox(15, 30).pieces).toEqual([{ id: "slab", label: "Slab", xIn: 0, yIn: 0, widthIn: 15, heightIn: 30, depthIn: 0.54 }]);
  });
});

import { describe, expect, it } from "vitest";
import {
  drawerPanelInsetPx,
  elevationFrameInsetPx,
  frameInsetPxFromInches,
  isFlatPanelElevationStyle,
  isShakerElevationStyle,
  SHAKER_FACE_FRAME_PX,
  shakerFacePanelGeometry,
} from "./elevationFrameGeometry";

describe("elevation face-frame geometry", () => {
  it("uses Zenith Sage's authored 3-inch stile as a 12-pixel door reveal", () => {
    expect(frameInsetPxFromInches("3.00")).toBe(12);
  });

  it("uses an entered verified Shaker stile for both door and drawer faces", () => {
    expect(isShakerElevationStyle("shaker")).toBe(true);
    expect(isShakerElevationStyle("slim-shaker")).toBe(true);
    expect(isShakerElevationStyle("raised")).toBe(false);
    expect(elevationFrameInsetPx("shaker", 6)).toBe(6);
    expect(drawerPanelInsetPx(6, true)).toBe(6);
  });

  it("uses real door width for the Shaker center panel: 12-inch yields 6-inch and 21-inch yields 15-inch", () => {
    expect(shakerFacePanelGeometry(12, 30)).toMatchObject({
      stileInches: 3,
      railInches: 3,
      centerPanelWidthInches: 6,
      centerPanelHeightInches: 24,
      horizontalInsetPercent: 25,
    });
    expect(shakerFacePanelGeometry(21, 30)).toMatchObject({
      stileInches: 3,
      railInches: 3,
      centerPanelWidthInches: 15,
      centerPanelHeightInches: 24,
    });
    expect(shakerFacePanelGeometry(21, 30).horizontalInsetPercent).toBeCloseTo(14.285714, 5);
  });

  it("uses verified independent stile and rail measurements when the authorized Door Style record supplies them", () => {
    expect(shakerFacePanelGeometry(21, 30, { stileInches: 1, railInches: 1.5 })).toMatchObject({
      stileInches: 1,
      railInches: 1.5,
      centerPanelWidthInches: 19,
      centerPanelHeightInches: 27,
    });
    expect(elevationFrameInsetPx("slim-shaker", 4)).toBe(4);
  });

  it("keeps every Slim Shaker fallback at a one-inch frame while regular Shaker stays three inches", () => {
    expect(shakerFacePanelGeometry(21, 30, undefined, "slim-shaker")).toMatchObject({
      stileInches: 1,
      railInches: 1,
      centerPanelWidthInches: 19,
      centerPanelHeightInches: 28,
    });
    expect(elevationFrameInsetPx("slim-shaker", null)).toBe(4);
    expect(drawerPanelInsetPx(null, true, "slim-shaker")).toBe(4);
    expect(elevationFrameInsetPx("shaker", null)).toBe(SHAKER_FACE_FRAME_PX);
    expect(drawerPanelInsetPx(null, true, "shaker")).toBe(SHAKER_FACE_FRAME_PX);
  });

  it("uses real partial face height for 3-inch top and bottom rails", () => {
    // A 30-inch oven door keeps a 24-inch center panel after two 3-inch rails.
    expect(shakerFacePanelGeometry(12, 30)).toMatchObject({
      railInches: 3,
      centerPanelHeightInches: 24,
      verticalInsetPercent: 10,
    });
    // A 12-inch partial-height face keeps a 6-inch center panel.
    expect(shakerFacePanelGeometry(12, 12)).toMatchObject({
      railInches: 3,
      centerPanelHeightInches: 6,
      verticalInsetPercent: 25,
    });
  });

  it("keeps the same 3-inch square Shaker frame across base, wall, tall, drawer, microwave, and specialty fronts", () => {
    const cabinetFrontFamilies = [
      "base cabinet",
      "wall cabinet",
      "tall pantry",
      "drawer base",
      "microwave base",
      "specialty end cabinet",
    ];

    for (const family of cabinetFrontFamilies) {
      expect(elevationFrameInsetPx("shaker", null), family).toBe(SHAKER_FACE_FRAME_PX);
      expect(drawerPanelInsetPx(null, true), family).toBe(SHAKER_FACE_FRAME_PX);
    }
  });

  it("falls back safely when a style has no authored frame width", () => {
    expect(frameInsetPxFromInches(null)).toBeNull();
    expect(drawerPanelInsetPx(null)).toBe(3);
  });

  it("keeps flat-panel slab doors and drawers unframed", () => {
    expect(isFlatPanelElevationStyle("slab")).toBe(true);
    expect(elevationFrameInsetPx("slab", 12)).toBeNull();
    expect(drawerPanelInsetPx(elevationFrameInsetPx("slab", 12))).toBe(3);
  });
});

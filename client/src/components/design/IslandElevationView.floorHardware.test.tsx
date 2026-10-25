import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IslandHardwareOverlay } from "./IslandElevationView";

describe("Island elevation floor-seated wall-cabinet hardware", () => {
  it("raises paired pulls while keeping both vertical on their existing meeting-edge rails", () => {
    const markup = renderToStaticMarkup(createElement(IslandHardwareOverlay, {
      doors: 2,
      drawers: 0,
      doorPiece: "pull",
      drawerPiece: "none",
      accent: "#1a2744",
      hardwarePosition: "auto",
      swing: "double",
      faceWidthIn: 30,
      raisedDoorPullOnRail: true,
    }));

    expect(markup.match(/data-cabinet-hardware="door-pull"/g)).toHaveLength(2);
    expect(markup.match(/data-hardware-orientation="vertical"/g)).toHaveLength(2);
    expect(markup.match(/data-hardware-position="raised-door-rail"/g)).toHaveLength(2);
    expect(markup).toContain('data-hardware-center-in="13.5"');
    expect(markup).toContain('data-hardware-center-in="16.5"');
    expect(markup).toContain("top:13%");
  });
});

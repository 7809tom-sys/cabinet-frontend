import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IslandHardwareOverlay, islandFarmhouseSinkElevationGeometry } from "./IslandElevationView";
import { farmhouseSinkBaseFaceLayout } from "@/lib/farmhouseSinkBaseFace";

describe("island farmhouse sink elevation geometry", () => {
  it("keeps a 36-inch FSB apron shallow, counter-mounted, and inset from the cabinet edges", () => {
    const geometry = islandFarmhouseSinkElevationGeometry(36);

    expect(geometry.apronHeightIn).toBe(8.5);
    expect(geometry.apronBottomIn).toBe(26);
    expect(geometry.sideInsetIn).toBe(1.44);
    expect(geometry.apronWidthIn).toBeCloseTo(33.12, 2);
  });
});

describe("island elevation hardware geometry", () => {
  it("centers a door pull on the three-inch frame 1.5 inches from the opening edge", () => {
    const markup = renderToStaticMarkup(createElement(IslandHardwareOverlay, {
      doors: 1,
      drawers: 1,
      doorPiece: "pull",
      drawerPiece: "pull",
      accent: "#1a2744",
      hardwarePosition: "auto",
      swing: "right",
      faceWidthIn: 18,
    }));
    expect(markup).toContain('data-hardware-position="left"');
    expect(markup).toContain('data-hardware-center-in="1.5"');
    expect(markup).toContain('data-hardware-edge-inset-in="1.5"');
    expect(markup).toContain('data-hardware-orientation="horizontal"');
  });
});

describe("island farmhouse sink base face", () => {
  it("places the door pulls below the apron zone instead of mid-face", () => {
    const apronZonePct = farmhouseSinkBaseFaceLayout(36, 30).apronZonePct;
    const markup = renderToStaticMarkup(createElement(IslandHardwareOverlay, {
      doors: 2, drawers: 0, doorPiece: "pull", drawerPiece: "pull", accent: "#1a2744",
      hardwarePosition: "auto", swing: "double", faceWidthIn: 36, doorBandStartPct: apronZonePct,
    }));
    const tops = [...markup.matchAll(/top:([0-9.]+)%/g)].map((m) => Number(m[1]));
    expect(tops).toHaveLength(2);
    for (const top of tops) {
      expect(top).toBeGreaterThan(apronZonePct);
      expect(top).toBeLessThan(100);
    }
  });
});

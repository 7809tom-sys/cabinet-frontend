import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HardwareOverlay } from "./ElevationView";
import { IslandHardwareOverlay } from "./IslandElevationView";
import { hardwareDrawSpec } from "@/lib/hardwareElevation";
import type { CatalogHardwareSelection } from "@/lib/hardware";

function pick(overrides: Partial<CatalogHardwareSelection> = {}): CatalogHardwareSelection {
  return {
    vendorProductId: 42,
    sku: "SKU-128",
    collection: "Aiden",
    productType: "Pull",
    configurationKey: "cfg",
    configurationLabel: '6-1/8" Overall Length Cabinet pull, 128 mm Center to Center',
    finish: "Satin Nickel",
    imageUrl: null,
    ...overrides,
  };
}

const pull96 = pick({
  sku: "SKU-96",
  configurationLabel: '4-13/16" Overall Length Cabinet pull, 96 mm Center to Center',
});
const pull128 = pick({
  sku: "SKU-128",
  configurationLabel: '6-1/8" Overall Length Cabinet pull, 128 mm Center to Center',
});

function drawerMarkup(catalogSpec: ReturnType<typeof hardwareDrawSpec>) {
  return renderToStaticMarkup(createElement(HardwareOverlay, {
    doors: 0,
    drawers: 3,
    doorPiece: "none",
    drawerPiece: "pull",
    accent: "#d8dce0",
    hardwarePosition: "auto",
    swing: "left",
    faceWidthIn: 30,
    cabinetHeightIn: 34.5,
    pantryLayout: null,
    catalogSpec,
  }));
}

/** Width percentage of each rendered drawer pull, in document order. */
function drawerPullWidths(markup: string): number[] {
  return (markup.match(/<div\b[^>]*data-cabinet-hardware="drawer-pull"[^>]*>/g) ?? []).map((attributes) => {
    const style = attributes.match(/\sstyle="([^"]*)"/)?.[1] ?? "";
    const width = style.match(/(?:^|;)width:([-+]?\d*\.?\d+)%/);
    if (width) return Number(width[1]);
    // The legacy proxy is drawn with left/right insets instead of a width.
    const left = Number(style.match(/(?:^|;)left:([-+]?\d*\.?\d+)%/)![1]);
    const right = Number(style.match(/(?:^|;)right:([-+]?\d*\.?\d+)%/)![1]);
    return 100 - left - right;
  });
}

describe("desktop elevation draws the picked catalog hardware", () => {
  it("draws a 128 mm bar pull longer than a 96 mm one on the same drawer front", () => {
    const short = drawerPullWidths(drawerMarkup(hardwareDrawSpec(pull96)));
    const long = drawerPullWidths(drawerMarkup(hardwareDrawSpec(pull128)));
    expect(short).toHaveLength(3);
    expect(long).toHaveLength(3);
    // The real overall lengths (4-13/16" vs 6-1/8") differ by less than the
    // center-to-center ratio, so compare against the catalog lengths themselves.
    expect(long[0]).toBeGreaterThan(short[0]);
    expect(long[0] / short[0]).toBeCloseTo(6.125 / 4.8125, 2);
  });

  it("keeps the measured piece inside the drawer row instead of overflowing it", () => {
    const markup = drawerMarkup(hardwareDrawSpec(pull128));
    expect(markup.match(/data-hardware-measured="true"/g)).toHaveLength(3);
    expect(markup).not.toContain('data-hardware-measured="clamped"');
  });

  it("tags each drawn piece with its family and its catalog length", () => {
    const markup = drawerMarkup(hardwareDrawSpec(pull96));
    expect(markup.match(/data-hardware-family="bar-pull"/g)).toHaveLength(3);
    expect(markup).toContain('data-hardware-length-in="4.813"');
  });

  it("renders a knob as a square body instead of a pull bar", () => {
    const knob = pick({ productType: "Knob", sku: "KNOB", configurationLabel: '1-3/8" Diameter Forged Look Cabinet Knob.' });
    const markup = renderToStaticMarkup(createElement(HardwareOverlay, {
      doors: 1, drawers: 1, doorPiece: "knob", drawerPiece: "knob", accent: "#d8dce0",
      hardwarePosition: "auto", swing: "left", faceWidthIn: 18, cabinetHeightIn: 34.5,
      catalogSpec: hardwareDrawSpec(knob),
    }));
    expect(markup.match(/data-cabinet-hardware="door-pull"/g)).toHaveLength(1);
    expect(markup.match(/data-cabinet-hardware="drawer-pull"/g)).toHaveLength(1);
    expect(markup.match(/data-hardware-family="round-knob"/g)).toHaveLength(2);
    expect(markup).toContain('data-hardware-length-in="1.375"');
  });

  it("puts an edge/finger pull on the top edge of the front", () => {
    const edge = pick({ productType: "Tab pull", sku: "TAB", configurationLabel: '4" Overall Length Tab Pull. Holes are 76 mm center-to-center.' });
    const markup = renderToStaticMarkup(createElement(HardwareOverlay, {
      doors: 0, drawers: 1, doorPiece: "none", drawerPiece: "pull", accent: "#d8dce0",
      hardwarePosition: "auto", swing: "left", faceWidthIn: 24, cabinetHeightIn: 34.5,
      catalogSpec: hardwareDrawSpec(edge),
    }));
    expect(markup).toContain('data-hardware-family="edge-pull"');
    const attributes = (markup.match(/<div\b[^>]*data-cabinet-hardware="drawer-pull"[^>]*>/) ?? [""])[0];
    const style = attributes.match(/\sstyle="([^"]*)"/)![1];
    const top = Number(style.match(/(?:^|;)top:([-+]?\d*\.?\d+)%/)![1]);
    const height = Number(style.match(/(?:^|;)height:([-+]?\d*\.?\d+)%/)![1]);
    // Top edge of the piece sits on the 0% top edge of the front.
    expect(top - height / 2).toBeCloseTo(0, 5);
  });

  it("keeps a picked door pull vertical at the opening edge", () => {
    const markup = renderToStaticMarkup(createElement(HardwareOverlay, {
      doors: 1, drawers: 0, doorPiece: "pull", drawerPiece: "none", accent: "#d8dce0",
      hardwarePosition: "auto", swing: "left", faceWidthIn: 18, cabinetHeightIn: 34.5,
      catalogSpec: hardwareDrawSpec(pull128),
    }));
    expect(markup).toContain('data-hardware-orientation="vertical"');
    expect(markup).toContain('data-hardware-position="right"');
    expect(markup).toContain('data-hardware-center-in="16.5"');
    expect(markup).toContain('data-hardware-edge-inset-in="1.5"');
    // The real 128 mm length now runs down the face, so the piece is taller than wide.
    const style = (markup.match(/<div\b[^>]*data-cabinet-hardware="door-pull"[^>]*>/) ?? [""])[0].match(/\sstyle="([^"]*)"/)![1];
    const width = Number(style.match(/(?:^|;)width:([-+]?\d*\.?\d+)%/)![1]);
    const height = Number(style.match(/(?:^|;)height:([-+]?\d*\.?\d+)%/)![1]);
    expect(height).toBeGreaterThan(width);
  });

  it("falls back to the generic proxy when no catalog pick is supplied", () => {
    const markup = drawerMarkup(null);
    expect(markup).toContain('data-cabinet-hardware="drawer-pull"');
    expect(markup).not.toContain("data-hardware-family=");
    expect(markup).not.toContain("data-hardware-measured=");
    // The legacy 25%–75% bar is still 50% wide.
    expect(drawerPullWidths(markup)).toEqual([50, 50, 50]);
  });

  it("falls back to the generic proxy when the pick's label has no readable size", () => {
    const unmeasurable = pick({ configurationLabel: "Cabinet pull in the Milan collection" });
    const spec = hardwareDrawSpec(unmeasurable);
    expect(spec?.unparseable).toBe(true);
    const markup = drawerMarkup(spec);
    expect(markup).not.toContain("data-hardware-family=");
    expect(drawerPullWidths(markup)).toEqual([50, 50, 50]);
  });
});

describe("island elevation draws the picked catalog hardware", () => {
  it("scales the same pick against the island front and keeps the vertical door rule", () => {
    const markup = renderToStaticMarkup(createElement(IslandHardwareOverlay, {
      doors: 1, drawers: 0, doorPiece: "pull", drawerPiece: "none", accent: "#d8dce0",
      hardwarePosition: "auto", swing: "right", faceWidthIn: 18, faceHeightIn: 30,
      catalogSpec: hardwareDrawSpec(pull128),
    }));
    expect(markup).toContain('data-hardware-position="left"');
    expect(markup).toContain('data-hardware-center-in="1.5"');
    expect(markup).toContain('data-hardware-orientation="vertical"');
    expect(markup).toContain('data-hardware-family="bar-pull"');
  });

  it("still draws the legacy proxy with no catalog pick", () => {
    const markup = renderToStaticMarkup(createElement(IslandHardwareOverlay, {
      doors: 1, drawers: 1, doorPiece: "pull", drawerPiece: "pull", accent: "#1a2744",
      hardwarePosition: "auto", swing: "right", faceWidthIn: 18,
    }));
    expect(markup).toContain('data-cabinet-hardware="door-pull"');
    expect(markup).not.toContain("data-hardware-family=");
  });
});

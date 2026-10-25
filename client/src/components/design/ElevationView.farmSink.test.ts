import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ElevationView, farmhouseSinkElevationGeometry } from "./ElevationView";

describe("farmhouse sink base elevation geometry", () => {
  it("mounts the FSB apron at the counter and leaves the cabinet toe-kick zone exposed", () => {
    const geometry = farmhouseSinkElevationGeometry(36);

    expect(geometry.apronBottomIn).toBe(26);
    expect(geometry.apronHeightIn).toBe(11.5);
    expect(geometry.apronBottomIn).toBeGreaterThan(4.5);
    expect(geometry.apronWidthIn).toBeCloseTo(33.12, 2);
  });

  it("keeps the visible basin shallow so the apron reads as a countertop-mounted sink", () => {
    const geometry = farmhouseSinkElevationGeometry(36);

    expect(geometry.basinHeightIn).toBeLessThan(geometry.apronHeightIn / 2);
    expect(geometry.basinWidthIn).toBeLessThan(geometry.apronWidthIn);
    expect(geometry.basinTopInsetIn).toBeGreaterThan(0);
  });

  it("renders FSB-36 as a countertop-mounted apron that leaves the styled cabinet base below visible", () => {
    const doorSampleUrl = "https://example.com/selected-shaker-door.webp";
    const markup = renderToStaticMarkup(
      createElement(
        LanguageProvider,
        null,
        createElement(ElevationView, {
          room: { width: 144, depth: 120, ceilingHeight: 96 },
          cabinets: [{
            uid: "fsb-36",
            cabinetId: 9390043,
            masterCode: "FSB-36",
            description: '36" Farm Sink Base Cabinet',
            category: "Base",
            subCategory: "Sink Base",
            placement: "base",
            x: 0,
            y: 0,
            width: 36,
            height: 34.5,
            depth: 24,
            rotation: 0,
          }],
          selectedUid: null,
          onSelect: () => undefined,
          wall: "back",
          countertopMaterialId: "white-quartz",
          doorSampleUrlFor: () => doorSampleUrl,
        }),
      ),
    );

    // SSR begins at 4 px/in. The 36" FSB apron starts 26" above the floor,
    // rather than at the floor, and ends at the countertop top (37.5").
    expect(markup).toContain('data-farm-sink-apron="true"');
    expect(markup).toContain('data-farm-sink-mounted="countertop"');
    expect(markup).toContain(`url(${doorSampleUrl})`);
    // The white-quartz slab remains in the elevation at 34.5" while the apron
    // overlays it from 26" through 37.5", as a real apron sink does.
    expect(markup).toContain("bottom:138px");
    expect(markup).toContain("bottom:104px");
    expect(markup).toContain("height:46px");
    expect(markup).toContain("z-index:23");
  });

  it("preserves the counter-mounted apron and exposed toe kick at desktop and mobile elevation scales", () => {
    const geometry = farmhouseSinkElevationGeometry(36);

    for (const pixelsPerInch of [1.5, 7]) {
      const apronBottomPx = geometry.apronBottomIn * pixelsPerInch;
      const apronTopPx = (geometry.apronBottomIn + geometry.apronHeightIn) * pixelsPerInch;
      const toeKickTopPx = 4.5 * pixelsPerInch;
      const countertopTopPx = 37.5 * pixelsPerInch;

      expect(apronBottomPx).toBeGreaterThan(toeKickTopPx);
      expect(apronTopPx).toBe(countertopTopPx);
    }
  });
});

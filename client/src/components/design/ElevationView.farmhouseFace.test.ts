import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ElevationView } from "./ElevationView";
import { farmhouseSinkBaseFaceLayout } from "@/lib/farmhouseSinkBaseFace";

/**
 * Elevation face of a farmhouse (apron-front) sink base. A real FSB has no top
 * rail and no false drawer front: the apron zone sits on top, two doors fill
 * the face beneath it. The old elevation drew a normal 20% false front over two
 * doors, which put a drawer face behind the apron.
 */
function render(cabinet: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(
      LanguageProvider,
      null,
      createElement(ElevationView, {
        room: { width: 144, depth: 120, ceilingHeight: 96 },
        cabinets: [{
          uid: "c1", cabinetId: 9360037, category: "Base", placement: "base",
          x: 0, y: 0, width: 36, height: 34.5, depth: 24, rotation: 0, ...cabinet,
        }] as never,
        selectedUid: null,
        onSelect: () => undefined,
        wall: "back",
        countertopMaterialId: "white-quartz",
        hardwareStyleId: "bar-pull",
        ...extra,
      } as never),
    ),
  );
}

const FSB = { masterCode: "FSB36", description: '36" Farm Sink Base Cabinet', subCategory: "Sink Base" };

function elementsWith(markup: string, attribute: string) {
  const matches = markup.match(new RegExp(`<div[^>]*${attribute}[^>]*>`, "g")) ?? [];
  return matches;
}
function pct(style: string, property: string) {
  const found = style.match(new RegExp(`(?:^|[;"\\s])${property}:\\s*([0-9.]+)%`));
  return found ? Number(found[1]) : null;
}

describe("farmhouse sink base elevation face", () => {
  it("draws two lower doors below an apron zone and no false drawer front", () => {
    const markup = render(FSB);
    expect(elementsWith(markup, 'data-farmhouse-base-face="true"')).toHaveLength(1);
    const doors = elementsWith(markup, "data-farmhouse-base-door");
    expect(doors).toHaveLength(2);
    // The elevation face is the 30" box above the 4.5" toe kick. Doors begin
    // exactly where the 8.5" apron zone ends, i.e. 26" above the floor, which is
    // also where the apron overlay's bottom edge sits.
    const apronPct = farmhouseSinkBaseFaceLayout(36, 30).apronZonePct;
    expect(apronPct).toBeCloseTo((8.5 / 30) * 100, 6);
    for (const door of doors) expect(pct(door, "top")).toBeCloseTo(apronPct, 1);
    // No generic sink-base false front / tilt-out strip.
    expect(markup).not.toContain("data-sink-base-false-front");
    expect(elementsWith(markup, "data-farmhouse-apron-zone")).toHaveLength(1);
  });

  it("puts one vertical pull on each lower door and no drawer pull under the apron", () => {
    const markup = render(FSB);
    const doorPulls = elementsWith(markup, 'data-cabinet-hardware="door-pull"');
    expect(doorPulls).toHaveLength(2);
    expect(elementsWith(markup, 'data-cabinet-hardware="drawer-pull"')).toHaveLength(0);
    const apronPct = farmhouseSinkBaseFaceLayout(36, 30).apronZonePct;
    for (const pull of doorPulls) {
      // Hardware centre must be inside the door zone, below the apron.
      expect(pct(pull, "top")!).toBeGreaterThan(apronPct);
      expect(pct(pull, "top")!).toBeLessThan(100);
    }
  });

  it("recognises every FSB size, ADA FSB and farmhouse descriptions", () => {
    for (const [masterCode, width] of [["FSB30", 30], ["FSB33", 33], ["FSB36", 36], ["ADA-FSB36", 36]] as const) {
      const markup = render({ masterCode, description: `${width}" Farm Sink Base Cabinet`, width });
      expect(elementsWith(markup, "data-farmhouse-base-door")).toHaveLength(2);
    }
    const byDescription = render({ masterCode: "XYZ36", description: '36" Apron Front Sink Base Cabinet' });
    expect(elementsWith(byDescription, "data-farmhouse-base-door")).toHaveLength(2);
  });

  it("leaves an ordinary sink base (SB36) with its false front over two doors", () => {
    const markup = render({ masterCode: "SB36", description: '36" Sink Base Cabinet', subCategory: "Sink Base" });
    expect(elementsWith(markup, "data-farmhouse-base-face")).toHaveLength(0);
    expect(markup).toContain("data-sink-base-false-front");
  });
});

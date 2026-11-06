import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { type PlacedCabinet } from "@/lib/design";
import { ElevationView } from "./ElevationView";

function renderGlassCabinet(overrides: Partial<PlacedCabinet>) {
  const cabinet = {
    uid: "glass-wall",
    cabinetId: 9360109,
    masterCode: "W2442GD",
    description: '24" Double Door Glass Door Wall Cabinet with 3 Adjustable Shelves',
    category: "Wall",
    subCategory: "Glass Door Wall",
    placement: "wall",
    x: 24,
    y: 0,
    width: 24,
    depth: 12,
    height: 42,
    rotation: 0,
    numberOfDoors: 2,
    numberOfDrawers: 0,
    customProfile: "wall_2door_glass",
    ...overrides,
  } as PlacedCabinet;
  return renderToStaticMarkup(createElement(
    LanguageProvider,
    null,
    createElement(ElevationView, {
      room: { width: 144, depth: 120, ceilingHeight: 96 },
      cabinets: [cabinet],
      selectedUid: null,
      onSelect: () => undefined,
      wall: "back",
      finish: { face: "#e8dfcf", edge: "#796f61", label: "#302c27" },
      panelKind: "shaker",
    }),
  ));
}

describe("glass-door elevation rendering", () => {
  it("renders W2442GD as two finished frames with transparent centers and three visible shelf levels", () => {
    const markup = renderGlassCabinet({ glassDoor: false, fixedShelfCount: null, adjustableShelfCount: null });
    expect(markup.match(/data-glass-door-frame="true"/g)).toHaveLength(2);
    expect(markup.match(/data-glass-door-pane="true"/g)).toHaveLength(2);
    expect(markup.match(/data-transparent-glass="true"/g)).toHaveLength(2);
    expect(markup.match(/data-glass-cabinet-interior="true"/g)).toHaveLength(2);
    expect(markup.match(/data-glass-cabinet-shelf=/g)).toHaveLength(6);
    expect(markup).toContain("background-color:#e8dfcf");
  });

  it("renders a legacy separated GD code as one framed glass door when its configured door count is one", () => {
    const markup = renderGlassCabinet({
      masterCode: "W-15-42GD",
      description: '15" Single Door Glass Door Wall Cabinet with 2 Adjustable Shelves',
      width: 15,
      numberOfDoors: 1,
      customProfile: null,
    });
    expect(markup.match(/data-glass-door-frame="true"/g)).toHaveLength(1);
    expect(markup.match(/data-transparent-glass="true"/g)).toHaveLength(1);
    expect(markup.match(/data-glass-cabinet-shelf=/g)).toHaveLength(2);
  });

  it("renders the supplied OE630 generic open-end form with two square shelf levels, not the stale curved profile", () => {
    const markup = renderGlassCabinet({
      masterCode: "OE630",
      description: '6" x 30" Open End Shelf Wall Cabinet',
      subCategory: "Open Shelf",
      width: 6,
      height: 30,
      numberOfDoors: 0,
      numberOfDrawers: 0,
      customProfile: "curved-open-shelf",
      fixedShelfCount: 3,
    });
    expect(markup).toContain('data-cabinet-profile="kitchencrest-square-open-end-shelf"');
    expect(markup).toContain('data-open-shelf-count="2"');
    expect(markup).toContain("border-top-right-radius:0");
  });

  it("draws WEOS0930, WEOS0936 and WEOS0942 as finished open boxes with their configured shelf count and no doors", () => {
    for (const [masterCode, height, configured, expectedShelves] of [
      ["WEOS0930", 30, 2, 2],
      ["WEOS0936", 36, 2, 2],
      ["WEOS0942", 42, 3, 3],
    ] as const) {
      const markup = renderGlassCabinet({
        uid: `shelf-${masterCode}`,
        cabinetId: 930,
        masterCode,
        description: "Wall End Open Shelf",
        category: "Wall",
        subCategory: "Open Shelf",
        width: 9,
        height,
        depth: 12,
        numberOfDoors: 0,
        numberOfDrawers: 0,
        customProfile: null,
        fixedShelfCount: configured,
      });

      // The open-shelf vector profile owns the face: no door leaves, no glass.
      expect(markup, masterCode).toContain('data-cabinet-profile="curved-open-shelf"');
      expect(markup, masterCode).toContain('data-open-shelf-finished-box="true"');
      expect(markup, masterCode).toContain(`data-open-shelf-shelves="${expectedShelves}"`);
      expect(markup.match(/data-glass-door-frame="true"/g) ?? [], masterCode).toHaveLength(0);
      expect(markup, masterCode).not.toContain('data-transparent-glass="true"');

      // Configured shelf count is drawn exactly, one board per configured shelf.
      const shelfBands = markup.match(/left-\[5%\] right-\[5%\] h-\[2px\]/g) ?? [];
      expect(shelfBands.length, masterCode).toBe(expectedShelves);
      for (let index = 0; index < expectedShelves; index += 1) {
        const percent = ((index + 1) / (expectedShelves + 1)) * 100;
        expect(markup, masterCode).toContain(`top:${percent}%`);
      }
      // An open shelf never draws a recessed Shaker door panel.
      expect(markup, masterCode).not.toContain("shaker");
    }
  });

  it("drawn open-shelf elevation keeps the finished face colour, not a darkened cavity border", () => {
    const markup = renderGlassCabinet({
      uid: "shelf-weos0930",
      cabinetId: 930,
      masterCode: "WEOS0930",
      description: "Wall End Open Shelf",
      category: "Wall",
      subCategory: "Open Shelf",
      width: 9,
      height: 30,
      depth: 12,
      numberOfDoors: 0,
      numberOfDrawers: 0,
      customProfile: null,
      fixedShelfCount: 2,
    });
    // The reported defect was a dark border around the opening that read as a
    // face frame. The face now uses an inset hairline on the box outline only.
    expect(markup).not.toContain("border:3px solid");
    expect(markup).toContain("inset 0 0 0 1.5px");
  });
});

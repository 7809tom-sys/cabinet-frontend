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

  it("keeps a non-open-shelf specialty profile's own fixed-shelf count", () => {
    // Regression: the open-shelf shelf plan is zero for cabinets outside the
    // family, and must never overwrite their configured count. (A custom
    // profile keeps its historical two-shelf drafting floor, so values at or
    // above 2 are the ones that distinguish the bug.)
    for (const configured of [2, 3, 4]) {
      const markup = renderGlassCabinet({
        uid: `specialty-${configured}`,
        cabinetId: 1,
        masterCode: "CUSTOM-30",
        description: '30" Specialty Cabinet',
        category: "Specialty",
        subCategory: "Specialty",
        width: 30,
        height: 42,
        depth: 12,
        numberOfDoors: 0,
        numberOfDrawers: 0,
        customProfile: "curved-open-shelf",
        fixedShelfCount: configured,
        adjustableShelfCount: 0,
      });
      const shelfBands = markup.match(/left-\[5%\] right-\[5%\] h-\[2px\]/g) ?? [];
      expect(shelfBands.length, `configured ${configured}`).toBe(configured);
    }
  });

  it("mirrors the elevation for each hand: solid side on the closed end", () => {
    const render = (hand: "left" | "right") => renderGlassCabinet({
      uid: `hand-${hand}`,
      cabinetId: 930,
      masterCode: "WOS0930",
      description: "Wall Open Shelf",
      category: "Wall",
      subCategory: "Open Shelf",
      width: 9,
      height: 30,
      depth: 12,
      numberOfDoors: 0,
      numberOfDrawers: 0,
      customProfile: null,
      fixedShelfCount: 2,
      openShelfHand: hand,
    });

    const right = render("right");
    expect(right).toContain('data-open-shelf-hand="right"');
    expect(right).toContain('data-open-shelf-solid-side="right"');
    expect(right).toMatch(/data-open-shelf-solid-side="right"[^>]*right:0/);

    const left = render("left");
    expect(left).toContain('data-open-shelf-hand="left"');
    expect(left).toContain('data-open-shelf-solid-side="left"');
    expect(left).toMatch(/data-open-shelf-solid-side="left"[^>]*left:0/);

    // Both hands draw the same configured shelf count and no door.
    for (const markup of [left, right]) {
      expect(markup.match(/left-\[5%\] right-\[5%\] h-\[2px\]/g) ?? []).toHaveLength(2);
      expect(markup.match(/data-glass-door-frame="true"/g) ?? []).toHaveLength(0);
    }
  });

  it("draws the 12-wide WEOS family with its configured shelves and no doors", () => {
    for (const [masterCode, height] of [
      ["WEOS1230", 30],
      ["WEOS1236", 36],
      ["WEOS1242", 42],
    ] as const) {
      const markup = renderGlassCabinet({
        uid: `shelf-${masterCode}`,
        cabinetId: 930,
        masterCode,
        description: "Wall End Open Shelf",
        category: "Wall",
        subCategory: "Open Shelf",
        width: 12,
        height,
        depth: 12,
        numberOfDoors: 0,
        numberOfDrawers: 0,
        customProfile: null,
        fixedShelfCount: 2,
      });
      expect(markup, masterCode).toContain('data-cabinet-profile="curved-open-shelf"');
      expect(markup, masterCode).toContain('data-open-shelf-shelves="2"');
      expect(markup.match(/left-\[5%\] right-\[5%\] h-\[2px\]/g) ?? [], masterCode).toHaveLength(2);
      expect(markup.match(/data-glass-door-frame="true"/g) ?? [], masterCode).toHaveLength(0);
      // The elevation face label is the size, not the raw SKU, and carries no depth.
      expect(markup, masterCode).toContain(`12&quot;W x ${height}&quot;H`);
      expect(markup, masterCode).not.toMatch(/1[23]&quot;\s*x\s*1[23]&quot;\s*x/i);
    }
  });
});

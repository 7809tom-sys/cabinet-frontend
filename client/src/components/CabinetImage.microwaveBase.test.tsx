import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CabinetImage } from "./CabinetImage";

describe("CabinetImage approved catalog art priority", () => {
  it("shows the approved master technical image before using a drawing fallback", () => {
    const markup = renderToStaticMarkup(
      createElement(CabinetImage, {
        cabinet: {
          masterCode: "BMC30",
          description: '30" Microwave Base Cabinet',
          category: "Base",
          subCategory: "Microwave Base Cabinet",
          numberOfDoors: 0,
          numberOfDrawers: 1,
          openingType: "top",
          drawerHeight: 12,
          catalogImageUrl: "https://example.com/approved-microwave-base-line-art.webp",
        },
      }),
    );

    expect(markup).toContain("approved-microwave-base-line-art.webp");
    expect(markup).not.toContain("data-cabinet-drawing");
  });

  it("uses an explicitly approved selected-line detail image before the master image", () => {
    const markup = renderToStaticMarkup(
      createElement(CabinetImage, {
        cabinet: {
          masterCode: "CHROME TRAY 33",
          description: "Chrome Tray Insert for ERB33 Easy-Reach Corner Cabinet",
          category: "Accessory",
          subCategory: "Lazy Susan Insert",
          catalogImageUrl: "https://example.com/approved-master-tray.webp",
        },
        overrideImageUrl: "https://example.com/approved-selected-line-tray.webp",
      }),
    );

    expect(markup).toContain("approved-selected-line-tray.webp");
    expect(markup).not.toContain("approved-master-tray.webp");
    expect(markup).not.toContain("data-cabinet-drawing");
  });

  it("falls back to PR3015 plate-rack technical line art only when no approved image exists", () => {
    const markup = renderToStaticMarkup(
      createElement(CabinetImage, {
        cabinet: {
          masterCode: "PR3015",
          description: '30" × 15" × 12" Wall Plate Rack Cabinet',
          category: "Wall",
          width: 30,
          height: 15,
          depth: 12,
        },
      }),
    );

    expect(markup).toContain('data-cabinet-drawing="plate-rack"');
  });

  it("uses approved BEC24 catalog artwork before a drawing fallback", () => {
    const markup = renderToStaticMarkup(
      createElement(CabinetImage, {
        cabinet: {
          masterCode: "BEC-24",
          description: '24" × 34.5" × 24" Base End Cabinet — 45° Angled End, 2 Doors',
          category: "Base",
          subCategory: "Base End Cabinet",
          width: 24,
          height: 34.5,
          depth: 24,
          numberOfDoors: 2,
          numberOfDrawers: 0,
          catalogImageUrl: "https://example.com/approved-bec24-capital-drawing.webp",
        },
      }),
    );

    expect(markup).toContain("approved-bec24-capital-drawing.webp");
    expect(markup).not.toContain("data-cabinet-drawing");
  });

  it("falls back to the WMS open cabinet-kit drawing rather than a double-door wall cabinet", () => {
    const markup = renderToStaticMarkup(
      createElement(CabinetImage, {
        cabinet: {
          masterCode: "WMS3018",
          description: '30" × 18" × 12" Wall Microwave Cabinet Kit with 26½" × ¾" × 17" Shelf Insert',
          category: "Wall",
          subCategory: "Microwave Wall",
          width: 30,
          height: 18,
          depth: 12,
          numberOfDoors: 0,
          numberOfDrawers: 0,
        },
      }),
    );

    expect(markup).toContain('data-cabinet-drawing="wall-microwave-kit"');
    expect(markup).not.toContain('data-cabinet-drawing="standard-door"');
  });

  it("renders the separately sold WMS shelf insert without a cabinet box", () => {
    const markup = renderToStaticMarkup(
      createElement(CabinetImage, {
        cabinet: {
          masterCode: "WMSSHELF",
          description: '26½" × ¾" × 17" Wall Microwave Cabinet Shelf Insert',
          category: "Accessory",
          subCategory: "Shelf Insert",
          width: 26.5,
          height: 0.75,
          depth: 17,
          numberOfDoors: 0,
          numberOfDrawers: 0,
        },
      }),
    );

    expect(markup).toContain('data-cabinet-drawing="shelf-insert"');
    expect(markup).not.toContain('data-cabinet-drawing="wall-microwave-kit"');
  });

  it("renders the exact code-owned roll-out shelf count on fallback technical art", () => {
    const fullHeightMarkup = renderToStaticMarkup(
      createElement(CabinetImage, {
        cabinet: {
          masterCode: "B18FH2RS",
          description: '18" × 34.5" × 24" Full-Height Base Cabinet — No Drawer, 2 Roll-Out Shelves',
          category: "Base",
          subCategory: "Full Height",
          width: 18,
          height: 34.5,
          depth: 24,
          numberOfDoors: 1,
          numberOfDrawers: 0,
        },
      }),
    );
    expect(fullHeightMarkup).toContain('data-rollout-shelf-indicator="true"');
    expect(fullHeightMarkup).toContain('data-rollout-shelf-count="2"');
    expect(fullHeightMarkup).toContain("2 included roll-out shelves");

    const regularBaseMarkup = renderToStaticMarkup(
      createElement(CabinetImage, {
        cabinet: {
          masterCode: "B121RS",
          description: '12" × 34.5" × 24" Base Cabinet — 1 Drawer, 1 Roll-Out Shelf',
          category: "Base",
          width: 12,
          height: 34.5,
          depth: 24,
          numberOfDoors: 1,
          numberOfDrawers: 1,
        },
      }),
    );
    expect(regularBaseMarkup).toContain('data-rollout-shelf-count="1"');

    const standardBaseMarkup = renderToStaticMarkup(
      createElement(CabinetImage, {
        cabinet: { masterCode: "B12", description: '12" Base Cabinet', category: "Base", width: 12 },
      }),
    );
    expect(standardBaseMarkup).not.toContain("data-rollout-shelf-indicator");
  });

  it("falls back to the same ADA drawer technical art whether ADA is prefix or suffix", () => {
    for (const masterCode of ["ADA-3DB15", "3DB15ADA"]) {
      const markup = renderToStaticMarkup(
        createElement(CabinetImage, {
          cabinet: {
            masterCode,
            description: '15" × 32.5" × 24" ADA Three-Drawer Base Cabinet',
            category: "ADA",
            subCategory: "ADA Base",
            width: 15,
            height: 32.5,
            depth: 24,
            numberOfDoors: 0,
            numberOfDrawers: 3,
          },
        }),
      );
      expect(markup).toContain('data-cabinet-drawing="drawer-base"');
    }
  });
});

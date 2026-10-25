import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { displayedStyleId } from "@/lib/design";
import { DoorFront } from "./ElevationView";

describe("mixed cabinet selected-style sample rendering", () => {
  it("renders the active one-finish door and drawer samples instead of stale per-cabinet finishes", () => {
    const samples = new Map([
      [7, { door: "https://example.com/fresh-sage-door.webp", drawer: "https://example.com/fresh-sage-drawer.webp" }],
      [42, { door: "https://example.com/caramel-door.webp", drawer: "https://example.com/caramel-drawer.webp" }],
      [99, { door: "https://example.com/black-door.webp", drawer: "https://example.com/black-drawer.webp" }],
    ]);
    const activeStyleId = 7;
    const staleCabinets = [
      { styleId: 42, cabinetType: "standard-door" as const, doors: 2, drawers: 1 },
      { styleId: 99, cabinetType: "corner-drawer-base" as const, doors: 0, drawers: 3 },
    ];

    for (const cabinet of staleCabinets) {
      const resolvedStyleId = displayedStyleId(cabinet, activeStyleId, false)!;
      const activeSample = samples.get(resolvedStyleId)!;
      const markup = renderToStaticMarkup(
        createElement(DoorFront, {
          kind: "shaker",
          edge: "#557155",
          face: "#8FAF8A",
          cabinetWidthIn: 24,
          cabinetHeightIn: 34.5,
          doorSampleUrl: activeSample.door,
          drawerSampleUrl: activeSample.drawer,
          ...cabinet,
        }),
      );

      if (cabinet.doors > 0) expect(markup).toContain(`url(${activeSample.door})`);
      if (cabinet.drawers > 0) expect(markup).toContain(`url(${activeSample.drawer})`);
      expect(markup).not.toContain("caramel-door.webp");
      expect(markup).not.toContain("black-door.webp");
    }
  });
});

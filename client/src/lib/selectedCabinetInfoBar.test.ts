import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_CATALOG_SOURCE_ROWS } from "@/lib/demoDistributorCatalog.generated";
import { selectedCabinetInfoBarDescription } from "@/lib/selectedCabinetInfoBar";

const LSB36 =
  '36" W x 34-1/2" H x 24" D Lazy Susan Corner Base — 1 Door; inside per distributor: 2 Lazy Susan trays in an easy-reach box (USCD) or pie-cut L-door with 2 baskets (Faircrest)';

describe("selected cabinet info bar description", () => {
  it("keeps the size and name and drops the door and interior clause", () => {
    expect(selectedCabinetInfoBarDescription(LSB36)).toBe(
      '36" W x 34-1/2" H x 24" D Lazy Susan Corner Base',
    );
    expect(selectedCabinetInfoBarDescription(
      '24" × 30" × 12" Wall Cabinet — 1 Door, 2 Adjustable Shelves',
    )).toBe('24" × 30" × 12" Wall Cabinet');
    expect(selectedCabinetInfoBarDescription(
      '18 in. ADA Base Cabinet — 1 Door, 1 Drawer, 1 Roll-Out Shelf Looks like: 1 door and 1 drawer; door style and edge profile per selected line.',
    )).toBe("18 in. ADA Base Cabinet");
    expect(selectedCabinetInfoBarDescription(
      '6 in. Base Spice Drawers Cabinet — 5 drawers',
    )).toBe("6 in. Base Spice Drawers Cabinet");
    expect(selectedCabinetInfoBarDescription(
      '12" W x 12" H x 12" D Wall Stacker Cabinet — 1 Plain Glass (PG) Door, glass included',
    )).toBe('12" W x 12" H x 12" D Wall Stacker Cabinet');
    expect(selectedCabinetInfoBarDescription(
      '30" W x 34-1/2" H x 24" D Base End Cabinet — Quarter-Octagon Shape, 2 Doors (17-1/2" W x 29" H each); shelves by distributor',
    )).toBe('30" W x 34-1/2" H x 24" D Base End Cabinet');
    expect(selectedCabinetInfoBarDescription(
      '30" W × 30-1/4" H × 13-1/2" D Wall Cabinet — 1 Door, 2 Shelves',
    )).toBe('30" W × 30-1/4" H × 13-1/2" D Wall Cabinet');
  });

  it("keeps a dash when that dash introduces the size", () => {
    const filler = 'Filler — 3" W x 42" H';
    const moulding = 'Batten Moulding — 96" × ¾" × 3/16"';
    const scribe = 'Filler — A front filler cut to 2-1/2"';
    expect(selectedCabinetInfoBarDescription(filler)).toBe(filler);
    expect(selectedCabinetInfoBarDescription(moulding)).toBe(moulding);
    expect(selectedCabinetInfoBarDescription(scribe)).toBe(scribe);
    expect(selectedCabinetInfoBarDescription(
      'Desk Knee Drawer — 30" W x 5-1/4" H x 21" D, 1 Drawer, trimmable to 28" W',
    )).toBe('Desk Knee Drawer — 30" W x 5-1/4" H x 21" D, 1 Drawer, trimmable to 28" W');
  });

  it("drops a distributor aside that follows a size", () => {
    expect(selectedCabinetInfoBarDescription(
      'Wine Cubby Wall Cabinet — 30" W x 6" H x 12" D, holds 6 bottles Looks like: open front (no doors or drawers on file); door style and edge profile per selected line.',
    )).toBe('Wine Cubby Wall Cabinet — 30" W x 6" H x 12" D, holds 6 bottles');
    expect(selectedCabinetInfoBarDescription(
      '30" × 18" × 12" Wall Microwave Cabinet Kit with 26½" × ¾" × 17" Shelf Insert Looks like: open front (no doors or drawers on file); door style and edge profile per selected line.',
    )).toBe('30" × 18" × 12" Wall Microwave Cabinet Kit with 26½" × ¾" × 17" Shelf Insert');
  });

  it("leaves a description that is already just the size and name unchanged", () => {
    expect(selectedCabinetInfoBarDescription('24" 2 Drawer Base Cabinet')).toBe('24" 2 Drawer Base Cabinet');
    expect(selectedCabinetInfoBarDescription('36 inch Lazy Susan Corner Base')).toBe("36 inch Lazy Susan Corner Base");
    expect(selectedCabinetInfoBarDescription("")).toBe("");
    expect(selectedCabinetInfoBarDescription(null)).toBe("");
    expect(selectedCabinetInfoBarDescription(undefined)).toBe("");
  });

  it("shortens every demo-catalog description the same way, without touching stored rows", () => {
    const lsb = DEMO_CATALOG_SOURCE_ROWS.find((row) => row.code === "LSB36");
    expect(lsb?.description).toBe(LSB36);
    for (const row of DEMO_CATALOG_SOURCE_ROWS) {
      const shown = selectedCabinetInfoBarDescription(row.description);
      expect(shown, row.code).not.toMatch(/inside per distributor/i);
      expect(shown, row.code).not.toMatch(/Looks like:/i);
    }
    expect(selectedCabinetInfoBarDescription(
      DEMO_CATALOG_SOURCE_ROWS.find((row) => row.code === "F342")?.description,
    )).toContain('3" W x 42" H');
  });

  it("feeds only the info bar, and the mobile sheet still shows the full description", () => {
    const source = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");
    const barAt = source.indexOf('className="ml-1 hidden sm:inline text-foreground/70"');
    const bar = source.slice(barAt, barAt + 600);
    expect(barAt).toBeGreaterThan(-1);
    expect(bar).toContain("selectedCabInfoBarDescription");
    expect(bar).toContain("title={selectedCabInfoBarDescription === selectedCabDisplayDescription ? undefined : selectedCabDisplayDescription}");
    expect(source).toContain('<div className="text-xs text-muted-foreground">{selectedCabDisplayDescription}</div>');
  });
});

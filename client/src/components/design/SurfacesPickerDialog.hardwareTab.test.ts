import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { STONE_CREEK_HARDWARE_LABEL, stoneCreekHardwareText } from "./StoneCreekHardwareGrid";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Surfaces & Fixtures Hardware tab", () => {
  const dialog = read("client/src/components/design/SurfacesPickerDialog.tsx");
  const grid = read("client/src/components/design/StoneCreekHardwareGrid.tsx");

  it("brands the line Stone Creek Hardware", () => {
    expect(STONE_CREEK_HARDWARE_LABEL).toBe("Stone Creek Hardware");
  });

  it("never shows a supplier name from catalog text", () => {
    expect(stoneCreekHardwareText("Hardware Resources pull")).toBe("Stone Creek Hardware pull");
    expect(stoneCreekHardwareText("Line DL knob")).toBe("Stone Creek Hardware knob");
    expect(stoneCreekHardwareText("Aiden")).toBe("Aiden");
    expect(grid).not.toMatch(/>[^<{]*Hardware Resources/);
  });

  it("puts the Hardware pill right after the catalog category pills", () => {
    const categories = dialog.indexOf("availableCats.map((c) => (");
    const hardware = dialog.indexOf('data-testid="surfaces-hardware-tab"');
    expect(categories).toBeGreaterThan(-1);
    expect(hardware).toBeGreaterThan(categories);
    expect(dialog.slice(hardware, hardware + 600)).toContain("Hardware\n");
  });

  it("reads the real hardware catalog and hides prices where the route hides them", () => {
    expect(grid).toContain("trpc.hardware.listConfigurations.useQuery");
    expect(grid).toContain("{!hidePrices && (");
    expect(dialog).toContain("hidePrices={hidePrices}");
  });
});

import { describe, expect, it } from "vitest";
import { describeBakingZone, kitchenUsageSuggestions, normalizeKitchenUsage, preferDrawerBasesBesideRange } from "./kitchenUsage";

describe("kitchen use", () => {
  it("treats a missing answer as skipped so saving is not blocked", () => {
    expect(normalizeKitchenUsage(null)).toMatchObject({ uses: [], skipped: true });
    expect(normalizeKitchenUsage({ uses: [], skipped: false })).toMatchObject({ skipped: true });
  });

  it("keeps a 36 inch baking counter beside the range and the refrigerator", () => {
    const zone = describeBakingZone({
      range: { start: 60, end: 90 },
      fridge: { start: 126, end: 162 },
      pieces: [{ start: 90, end: 126, kind: "base" }],
    });
    expect(zone.ok).toBe(true);
    expect(zone.widthIn).toBe(36);
    expect(zone.nearFridge).toBe(true);
    expect(zone.side).toBe("toward-fridge");
  });

  it("flags a baking counter that is shorter than 36 inches", () => {
    const zone = describeBakingZone({
      range: { start: 60, end: 90 },
      fridge: { start: 114, end: 150 },
      pieces: [{ start: 90, end: 114, kind: "base" }],
    });
    expect(zone.ok).toBe(false);
    expect(zone.widthIn).toBe(24);
    expect(zone.message).toMatch(/36/);
  });

  it("suggests drawer, tray, and mixer SKUs only when the line sells them", () => {
    const catalog = [
      { masterCode: "DB18", description: "18 inch drawer base", placement: "base", width: "18", numberOfDoors: 0, numberOfDrawers: 3 },
      { masterCode: "TD18", description: "Tray divider base", placement: "base", width: "18", numberOfDoors: 0, numberOfDrawers: 1 },
      { masterCode: "MIX18", description: "Mixer appliance garage", placement: "base", width: "18", numberOfDoors: 1, numberOfDrawers: 0 },
      { masterCode: "WRC3015", description: "Wall wine rack", placement: "wall", width: "30" },
    ];
    const baking = kitchenUsageSuggestions({ uses: ["baking"], skipped: false }, catalog);
    expect(baking.map((entry) => entry.masterCode)).toEqual(expect.arrayContaining(["DB18", "TD18", "MIX18"]));
    const entertaining = kitchenUsageSuggestions({ uses: ["entertaining"], skipped: false }, catalog);
    expect(entertaining.map((entry) => entry.masterCode)).toContain("WRC3015");
    expect(kitchenUsageSuggestions({ uses: ["minimal-cooking"], skipped: false }, catalog)).toEqual([]);
    expect(kitchenUsageSuggestions({ uses: [], skipped: true }, catalog)).toEqual([]);
  });

  it("swaps the range neighbor for a same-width drawer base", () => {
    const door = { masterCode: "B24", description: "24 inch base", width: "24", numberOfDoors: 1, numberOfDrawers: 0 };
    const drawer = { masterCode: "DB24", description: "24 inch drawer base", width: "24", numberOfDoors: 0, numberOfDrawers: 3 };
    const items = preferDrawerBasesBesideRange(
      [{ cabinet: door, width: 24, isFiller: false }],
      [door, drawer],
      true,
      false,
    );
    expect(items[0]?.cabinet.masterCode).toBe("DB24");
  });
});

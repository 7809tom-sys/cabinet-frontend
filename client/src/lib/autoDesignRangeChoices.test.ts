import { describe, expect, it } from "vitest";
import type { DesignCabinet } from "./design";
import { applianceAsDesignCabinet, APPLIANCES } from "./design";
import { autoDesignRangeChoices, defaultAutoDesignRange } from "./autoDesignTallCabinets";

const kitchenPalette = APPLIANCES
  .filter((appliance) => appliance.rooms.includes("kitchen"))
  .map(applianceAsDesignCabinet);

describe("the auto-designer range pop-up choices", () => {
  it("offers one card per real range visual, not one per shared master code", () => {
    const choices = autoDesignRangeChoices(kitchenPalette);
    expect(choices.length).toBeGreaterThan(1);
    // Every 30-inch range shares RANGE-30, so the palette keeps the finishes apart.
    expect(new Set(choices.map((choice) => choice.key)).size).toBe(choices.length);
    expect(choices.every((choice) => choice.masterCode.startsWith("RANGE"))).toBe(true);
    expect(choices.some((choice) => /gas/i.test(choice.label))).toBe(true);
  });

  it("never offers a hood, microwave, refrigerator, or dishwasher as a range", () => {
    const choices = autoDesignRangeChoices(kitchenPalette);
    expect(choices.some((choice) => /^(?:FRIDGE|DW|HOOD|MW)/.test(choice.masterCode))).toBe(false);
    expect(choices.some((choice) => /hood|microwave/i.test(choice.label))).toBe(false);
  });

  it("keeps the 30-inch row as the default so an untouched build is unchanged", () => {
    const choices = autoDesignRangeChoices(kitchenPalette);
    expect(defaultAutoDesignRange(choices)?.masterCode).toBe("RANGE-30");
  });

  it("reads the width from the catalog so a 36-inch range plans its own corners", () => {
    const wide = { ...applianceAsDesignCabinet(APPLIANCES[0]!), masterCode: "RANGE-36", width: "36", description: '36" Stainless Range' } as DesignCabinet;
    const choices = autoDesignRangeChoices([...kitchenPalette, wide]);
    expect(choices.find((choice) => choice.masterCode === "RANGE-36")?.widthIn).toBe(36);
  });

  it("returns an empty list rather than inventing a range", () => {
    expect(autoDesignRangeChoices([])).toEqual([]);
    expect(defaultAutoDesignRange([])).toBeNull();
  });
});

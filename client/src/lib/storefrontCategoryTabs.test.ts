import { describe, expect, it } from "vitest";
import {
  sortStorefrontCategoryTabs,
  storefrontCategoryTabLabel,
} from "./storefrontCategoryTabs";

describe("storefrontCategoryTabs", () => {
  it("uses the requested customer-facing order and retains unknown imports after it", () => {
    const ordered = sortStorefrontCategoryTabs([
      "Vanity",
      "Wall Skin / Scribe Veneer",
      "Accessory",
      "Tall",
      "Filler",
      "Wall",
      "Panels",
      "Corner",
      "Molding",
      "Base",
      "Specialty",
    ]);

    expect(ordered).toEqual([
      "Base",
      "Wall",
      "Corner",
      "Tall",
      "Filler",
      "Panels",
      "Wall Skin / Scribe Veneer",
      "Molding",
      "Accessory",
      "Vanity",
      "Specialty",
    ]);
  });

  it("keeps the source category as the filter key while showing concise labels", () => {
    expect(storefrontCategoryTabLabel("Wall Skin / Scribe Veneer")).toBe("Wall Skins");
    expect(storefrontCategoryTabLabel("Accessory")).toBe("Accessories");
    expect(storefrontCategoryTabLabel("Filler")).toBe("Filler");
  });
});

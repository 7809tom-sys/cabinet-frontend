import { describe, expect, it } from "vitest";
import {
  favoriteStorageKey,
  filterFavoriteFamilies,
  parseFavoriteFamilyIds,
  toggleFavoriteFamilyId,
} from "./favoriteFamilies";

describe("favorite family helpers", () => {
  it("scopes local favorites to the storefront", () => {
    expect(favoriteStorageKey("reaves-way-cabinet-shop")).toBe(
      "cabinetdealz:favorite-families:reaves-way-cabinet-shop"
    );
    expect(favoriteStorageKey()).toBe("cabinetdealz:favorite-families:main");
  });

  it("parses only valid numeric family ids", () => {
    expect(parseFavoriteFamilyIds('[12,"13",null,14]')).toEqual([12, 14]);
    expect(parseFavoriteFamilyIds("not-json")).toEqual([]);
  });

  it("toggles a family without creating duplicates", () => {
    expect(toggleFavoriteFamilyId([12, 14], 18)).toEqual([12, 14, 18]);
    expect(toggleFavoriteFamilyId([12, 14], 12)).toEqual([14]);
  });

  it("filters the family list to saved styles", () => {
    const families = [{ styleId: 1 }, { styleId: 2 }, { styleId: 3 }];
    expect(filterFavoriteFamilies(families, [3, 1])).toEqual([{ styleId: 1 }, { styleId: 3 }]);
  });
});

import { describe, expect, it } from "vitest";
import { bathroomFixtureFinishFilter, bathroomFixtureWidthIn, filterBathroomFixtureItems } from "./SurfacesPickerDialog";

const fixtures = [
  { id: 1, name: "White Vortex Toilet", pelicanCode: "PL-12044", size: '14 9/16" × 26 37/64"' },
  { id: 2, name: "Matte Black Vortex Toilet", pelicanCode: "PL-12044 MB", size: '14 9/16" × 26 37/64"' },
  { id: 3, name: "Freestanding Soaking Tub", pelicanCode: 'PL-02146 59"', size: '29 21/64" × 59 1/16"' },
  { id: 4, name: "Freestanding Soaking Tub", pelicanCode: 'PL-02146 67"', size: '29 13/32" × 66 21/32"' },
] as any[];

describe("Bathroom fixture card filters", () => {
  it("uses source-measured width when a Pelican placement profile exists", () => {
    expect(bathroomFixtureWidthIn(fixtures[0])).toBeCloseTo(14 + 9 / 16);
    expect(bathroomFixtureWidthIn(fixtures[2])).toBeCloseTo(29 + 21 / 64);
  });

  it("filters finish and mutually exclusive width bands without changing a fixture", () => {
    expect(bathroomFixtureFinishFilter(fixtures[1])).toBe("matte-black");
    expect(bathroomFixtureFinishFilter({ id: 4, name: "PL-12044 MB", pelicanCode: "PL-12044 MB", size: null })).toBe("matte-black");
    expect(bathroomFixtureFinishFilter({ id: 5, name: "PL-8522 BG", pelicanCode: "PL-8522 BG", size: null })).toBe("brushed-gold");
    expect(filterBathroomFixtureItems(fixtures, "matte-black", "all").map((item) => item.id)).toEqual([2]);
    expect(filterBathroomFixtureItems(fixtures, "all", "up-to-24").map((item) => item.id)).toEqual([1, 2]);
    expect(filterBathroomFixtureItems(fixtures, "all", "25-to-36").map((item) => item.id)).toEqual([3, 4]);
    expect(filterBathroomFixtureItems(fixtures, "all", "tub-59").map((item) => item.id)).toEqual([3]);
    expect(filterBathroomFixtureItems(fixtures, "all", "tub-67").map((item) => item.id)).toEqual([4]);
  });
});

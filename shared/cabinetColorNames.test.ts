import { describe, expect, it } from "vitest";
import { CABINET_NAME_COLORS, matchCabinetColorName } from "./cabinetColorNames";

describe("cabinet color names", () => {
  it("matches two-word phrases before the individual words", () => {
    expect(matchCabinetColorName("Blue Gray")).toBe(CABINET_NAME_COLORS.gray);
    expect(matchCabinetColorName("blue-grey shaker")).toBe(CABINET_NAME_COLORS.gray);
    expect(matchCabinetColorName("Natural Walnut")).toBe(CABINET_NAME_COLORS.walnut);
    expect(matchCabinetColorName("Light Gray")).toBe(CABINET_NAME_COLORS.lightGray);
    expect(matchCabinetColorName("White Oak")).toBe(CABINET_NAME_COLORS.natural);
  });

  it("matches the requested families as whole words", () => {
    expect(matchCabinetColorName("Greige")).toBe(CABINET_NAME_COLORS.gray);
    expect(matchCabinetColorName("slate")).toBe(CABINET_NAME_COLORS.gray);
    expect(matchCabinetColorName("Stone")).toBe(CABINET_NAME_COLORS.gray);
    expect(matchCabinetColorName("Pebble")).toBe(CABINET_NAME_COLORS.gray);
    expect(matchCabinetColorName("Cherry")).toBe(CABINET_NAME_COLORS.cherry);
    expect(matchCabinetColorName("Mahogany")).toBe(CABINET_NAME_COLORS.cherry);
    expect(matchCabinetColorName("Cognac")).toBe(CABINET_NAME_COLORS.cherry);
    expect(matchCabinetColorName("Hickory")).toBe(CABINET_NAME_COLORS.hickory);
    expect(matchCabinetColorName("Rustic")).toBe(CABINET_NAME_COLORS.hickory);
    expect(matchCabinetColorName("Chestnut")).toBe(CABINET_NAME_COLORS.hickory);
    expect(matchCabinetColorName("White")).toBe(CABINET_NAME_COLORS.white);
    expect(matchCabinetColorName("Paint")).toBe(CABINET_NAME_COLORS.white);
    expect(matchCabinetColorName("Smoke")).toBe(CABINET_NAME_COLORS.smoke);
    expect(matchCabinetColorName("Ash")).toBe(CABINET_NAME_COLORS.smoke);
  });

  it("does not match a color word inside another word", () => {
    expect(matchCabinetColorName("Painted Sage")).toBe(CABINET_NAME_COLORS.green);
    expect(matchCabinetColorName("flash")).toBeNull();
    expect(matchCabinetColorName("milestone")).toBeNull();
    expect(matchCabinetColorName("")).toBeNull();
  });
});

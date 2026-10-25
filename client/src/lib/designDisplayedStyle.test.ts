import { describe, expect, it } from "vitest";
import { displayedStyleId, finishColorsWithName } from "./design";

describe("displayedStyleId", () => {
  it("applies the active selected finish across placed cabinets in a one-finish design", () => {
    expect(displayedStyleId({ styleId: 42 }, 7, false)).toBe(7);
    expect(displayedStyleId({ styleId: 99 }, 7, false)).toBe(7);
  });

  it("preserves a per-cabinet finish only after a distinct two-tone style is active", () => {
    expect(displayedStyleId({ styleId: 42 }, 7, true)).toBe(42);
    expect(displayedStyleId({ styleId: null }, 7, true)).toBe(7);
  });

  it("uses the selected door sample finish for every mixed cabinet in one-finish mode", () => {
    const samples = new Map([
      [7, { name: "Fresh Sage", color: "Fresh Sage", finish: "#9AAE97", code: "FS" }],
      [42, { name: "Caramel Shaker", color: "Caramel", finish: "#8C6847", code: "CS" }],
      [99, { name: "Midnight Black Shaker", color: "Black", finish: "#1A1A1A", code: "MBS" }],
    ]);
    const active = samples.get(7)!;
    const expected = finishColorsWithName(active.name, active.color, active.finish, active.code);
    const staleCabinetFinishes = [{ styleId: 42 }, { styleId: 99 }, { styleId: null }].map((cabinet) => {
      const style = samples.get(displayedStyleId(cabinet, 7, false)!)!;
      return finishColorsWithName(style.name, style.color, style.finish, style.code);
    });

    expect(staleCabinetFinishes).toEqual([expected, expected, expected]);
  });
});

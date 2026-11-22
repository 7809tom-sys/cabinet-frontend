import { describe, expect, it } from "vitest";
import { DEMO_LINES, productsForLine } from "./demoDistributor";
import { EXAMPLE_KITCHENS, exampleKitchenRows } from "./demoExampleKitchens";

describe("demo example kitchens", () => {
  it("has 4 to 6 kitchens covering all three lines and varied layouts", () => {
    expect(EXAMPLE_KITCHENS.length).toBeGreaterThanOrEqual(4);
    expect(EXAMPLE_KITCHENS.length).toBeLessThanOrEqual(6);
    for (const line of DEMO_LINES) expect(EXAMPLE_KITCHENS.some((k) => k.lineId === line.id)).toBe(true);
    const layouts = new Set(EXAMPLE_KITCHENS.map((k) => k.layout));
    for (const l of ["L-shape", "U-shape", "Galley", "L-shape with island"]) expect(layouts.has(l as never)).toBe(true);
    expect(new Set(EXAMPLE_KITCHENS.map((k) => k.id)).size).toBe(EXAMPLE_KITCHENS.length);
  });

  it.each(EXAMPLE_KITCHENS.map((k) => [k.id, k] as const))("%s uses only real codes from its line and follows the layout rules", (_id, k) => {
    const codes = new Set(productsForLine(k.lineId).map((p) => p.sku));
    for (const item of k.items) {
      expect(codes.has(item.code), item.code).toBe(true);
      expect(item.qty).toBeGreaterThan(0);
    }
    const qty = (re: RegExp) => k.items.filter((i) => re.test(i.code)).reduce((s, i) => s + i.qty, 0);
    expect(qty(/^(BFF|WFF|FLD)/)).toBe(0); // no fluted fillers or legs
    expect(qty(/^(F\d|BF\d)/)).toBeLessThanOrEqual(2); // minimum filler
    expect(qty(/^REPV/)).toBeLessThanOrEqual(1); // one fridge end panel, open side only
    expect(qty(/^UNIV-ROT/)).toBeGreaterThan(0);
    expect(qty(/^(LSB|BBC)/)).toBeGreaterThan(k.layout === "Galley" ? -1 : 0);
    expect(qty(/^U\d{6}$/)).toBeGreaterThan(0); // tall pantry
    expect(k.items.some((i) => i.code === k.sinkBase)).toBe(true);
    for (const tray of k.items.filter((i) => i.code.startsWith("UNIV-ROT"))) {
      const width = tray.code.replace("UNIV-ROT", "");
      expect(k.items.some((i) => new RegExp(`^(B|3DB|SB)${width}$`).test(i.code)), `${tray.code} needs a ${width}" base`).toBe(true);
    }
  });

  it("adds the sink and faucet the designer would pick for the sink base", () => {
    for (const k of EXAMPLE_KITCHENS) {
      const { rows, totalCents } = exampleKitchenRows(k);
      expect(rows.some((r) => r.note?.startsWith("Sink for"))).toBe(true);
      expect(rows.some((r) => r.note === "Faucet")).toBe(true);
      expect(totalCents).toBeGreaterThan(0);
    }
  });
});

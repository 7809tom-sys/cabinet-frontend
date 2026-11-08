import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isRangeTopCartLine } from "./rangeTopDisplayOnly";

/**
 * Owner rule (Tom, CabinetDealz): a display-only range top is never stored in
 * the cart. This is the cart's last guard, which catches a stale persisted row
 * or a direct hand-off that bypassed the Designer's own line builders.
 */
describe("the cart refuses a display-only range-top line", () => {
  it("recognizes the PEL surface identity buildSurfaceCartLines would produce", () => {
    for (const id of [30001, 30002, 30003, 30004, 30005, 30006, 30007, 30008]) {
      expect(
        isRangeTopCartLine({
          masterCode: `PEL-${id}`,
          name: "Range Top",
          styleId: -id,
          styleLabel: "Range Tops",
          distributorId: null,
          tier: "homeowner",
          unitPrice: 599,
          priceLocked: true,
          qty: 1,
          productKind: "surface",
          pelicanProductId: id,
          category: "Range Tops",
        }),
      ).toBe(true);
    }
  });

  it("recognizes the line by any one of its identities", () => {
    expect(isRangeTopCartLine({ masterCode: "PEL-30001" })).toBe(true);
    expect(isRangeTopCartLine({ styleId: -30008 })).toBe(true);
    expect(isRangeTopCartLine({ category: "Range Tops" })).toBe(true);
    expect(isRangeTopCartLine({ pelicanProductId: 30005 })).toBe(true);
    expect(isRangeTopCartLine({ masterCode: "SC-RT-GAS-30" })).toBe(true);
  });

  it("leaves every other cart line alone", () => {
    expect(
      isRangeTopCartLine({
        masterCode: "PEL-769",
        styleId: -769,
        pelicanProductId: 769,
        category: "Sinks & Faucets",
      }),
    ).toBe(false);
    expect(
      isRangeTopCartLine({
        masterCode: "SB36",
        styleId: 330001,
        category: "Base",
      }),
    ).toBe(false);
    expect(
      isRangeTopCartLine({ masterCode: "PEL-30099", styleId: -30099 }),
    ).toBe(false);
    expect(isRangeTopCartLine(null)).toBe(false);
  });

  it("is enforced by the cart store on add, restore, and design hand-off", () => {
    const cart = readFileSync(
      resolve(process.cwd(), "client/src/contexts/CartContext.tsx"),
      "utf8",
    );
    // addItem is the only path a new cart line can take.
    expect(cart).toMatch(
      /const addItem = \(item: CartItem\)[\s\S]{0,400}isRangeTopCartLine\(item\)/,
    );
    // A cart restored from storage drops a stale range-top row.
    expect(cart).toMatch(
      /JSON\.parse\(raw\) as CartItem\[\]\)\s*\.filter\(\(item\) => !isRangeTopCartLine\(item\)\)/,
    );
    // The authoritative design hand-off filters too.
    expect(cart).toMatch(
      /designItems\.filter\(\(item\) => !isRangeTopCartLine\(item\)\)/,
    );
  });
});

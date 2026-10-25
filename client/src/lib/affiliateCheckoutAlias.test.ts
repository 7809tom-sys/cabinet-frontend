import { describe, expect, it } from "vitest";
import { resolveCheckoutAlias } from "./affiliateCheckoutAlias";

describe("order review affiliate alias", () => {
  it("uses the affiliate alias in the checkout summary rather than the central style name", () => {
    expect(
      resolveCheckoutAlias(
        { styleId: 330007, name: "Hickory Shaker" },
        { 330007: "Reeves Alias Test 2026 Hickory" },
      ),
    ).toBe("Reeves Alias Test 2026 Hickory");
  });

  it("uses the central name when the checkout is not an affiliate storefront", () => {
    expect(resolveCheckoutAlias({ styleId: 330007, name: "Hickory Shaker" }, undefined)).toBe("Hickory Shaker");
  });

  it("removes a trailing supplier token from affiliate and central checkout names", () => {
    expect(resolveCheckoutAlias({ styleId: 390016, name: "Aero Blanc (Preston)" }, undefined)).toBe("Aero Blanc");
    expect(resolveCheckoutAlias({ styleId: 390016, name: "Aero Blanc (Preston)" }, { 390016: "Aero Blanc (Preston)" })).toBe("Aero Blanc");
  });
});

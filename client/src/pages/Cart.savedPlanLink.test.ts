import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./Cart.tsx", import.meta.url), "utf8");

describe("saved plan cart disclosure", () => {
  it("shows the verified merchandise and carrier-quote boundary for an exact saved plan", () => {
    expect(source).toContain('data-testid="saved-plan-order-link"');
    expect(source).toContain("Saved kitchen plan linked to this order");
    expect(source).toContain("verified merchandise subtotal separately");
    expect(source).toContain("requires a current carrier quote");
  });
});

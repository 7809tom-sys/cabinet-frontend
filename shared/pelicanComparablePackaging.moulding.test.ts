import { describe, expect, it } from "vitest";
import { comparablePackagingRuleForPelicanProduct } from "./pelicanComparablePackaging";

describe("pelican comparable flooring trim spelling", () => {
  it("matches both Moldings & Trim and Mouldings & Trim", () => {
    for (const subCategory of ["Moldings & Trim", "Mouldings & Trim", "moldings & trim"]) {
      expect(comparablePackagingRuleForPelicanProduct({
        category: "Flooring",
        subCategory,
        name: "Aveline Stair Nose",
      })?.id).toBe("flooring-trim-v1");
    }
  });
});

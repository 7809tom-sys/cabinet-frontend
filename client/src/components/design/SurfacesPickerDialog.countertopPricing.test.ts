import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./SurfacesPickerDialog.tsx", import.meta.url), "utf8");

describe("SurfacesPickerDialog countertop pricing coverage", () => {
  it("explains the current measured slab quantity and locked line total", () => {
    expect(source).toContain("countertopPriceLines = []");
    expect(source).toContain('data-testid="countertop-priced-coverage"');
    expect(source).toContain("line.qtyNote");
    expect(source).toContain("formatPrice(line.unitPrice * line.qty)");
  });

  it("makes clear that a pony-wall bar extension is measured and supplier slabs stay whole-unit priced", () => {
    expect(source).toContain("The bar extension across a drywall pony wall is included in this measured coverage.");
    expect(source).toContain("Supplier pricing is per whole slab");
  });
});

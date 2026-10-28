import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./OrderReview.tsx", import.meta.url), "utf8");

describe("order review quantity total", () => {
  it("sums every line's quantity", () => {
    expect(source).toContain("const itemCount = lines.reduce((sum, l) => sum + l.qty, 0);");
  });

  it("shows the quantity total above the estimated total in the totals card", () => {
    const qtyRow = source.indexOf('data-testid="order-review-qty-total"');
    const estimatedTotal = source.indexOf('{t("or_est_total")}');
    expect(qtyRow).toBeGreaterThan(0);
    expect(qtyRow).toBeLessThan(estimatedTotal);
    expect(source.slice(qtyRow, estimatedTotal)).toContain("{itemCount}");
  });
});

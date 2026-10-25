import { describe, expect, it } from "vitest";
import { calculateCartSubtotal } from "./cartTotals";

describe("calculateCartSubtotal", () => {
  it("uses persisted unit prices and quantities without recomputing a supplier price", () => {
    expect(calculateCartSubtotal([
      { unitPrice: 365.95, qty: 2 },
      { unitPrice: null, qty: 1 },
    ])).toBe(731.9);
  });
});

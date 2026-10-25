import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/components/design/PlanCanvas.tsx"), "utf8");

describe("Smart Gap quote-only price presentation", () => {
  it("never exposes a missing approved customer price as a sale or zero-dollar price", () => {
    expect(source).toContain('bestPrice != null && bestPrice > 0 ? `$${bestPrice.toFixed(2)}` : "Quote required"');
    expect(source).toContain('unitPrice != null && unitPrice > 0 ? `$${unitPrice.toFixed(2)}` : "Quote required"');
    expect(source).not.toContain('bestPrice != null && bestPrice > 0 ? `$${bestPrice.toFixed(2)}` : "Price pending"');
    expect(source).not.toContain('unitPrice != null && unitPrice > 0 ? `$${unitPrice.toFixed(2)}` : "Price pending"');
  });
});

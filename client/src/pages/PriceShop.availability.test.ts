import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const priceShop = readFileSync(new URL("./PriceShop.tsx", import.meta.url), "utf8");
const priceShop10x10 = readFileSync(new URL("./PriceShop10x10.tsx", import.meta.url), "utf8");

describe("Price Shop unavailable cabinet status", () => {
  it("marks unavailable comparison lines explicitly instead of using N/A", () => {
    expect(priceShop).toContain('item.lineTotal ? `$${Number(item.lineTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "Unavailable"');
    expect(priceShop).not.toContain('item.lineTotal ? `$${Number(item.lineTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "N/A"');
    expect(priceShop).toContain('item.unitPrice ? `$${Number(item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "Unavailable"');
  });

  it("uses the same explicit unavailable state in the 10 by 10 comparison", () => {
    expect(priceShop10x10).toContain('item.unitPrice ? `$${Number(item.unitPrice).toFixed(2)}` : "Unavailable"');
    expect(priceShop10x10).toContain('item.lineTotal ? `$${Number(item.lineTotal).toFixed(2)}` : "Unavailable"');
    expect(priceShop10x10).not.toContain('text-muted-foreground text-xs">N/A');
  });
});

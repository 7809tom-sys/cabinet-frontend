import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "Cart.tsx"), "utf8");

describe("Cart compact item rows", () => {
  it("does not render product thumbnails in Your Cart", () => {
    expect(source).not.toContain("CabinetImage");
    expect(source).not.toContain("item.imageUrl");
    expect(source).not.toContain("Product artwork:");
  });

  it("retains direct quantity and delete controls on every compact row", () => {
    expect(source).toContain("setQty(item.masterCode, item.styleId, item.tier, item.qty - 1");
    expect(source).toContain("setQty(item.masterCode, item.styleId, item.tier, item.qty + 1");
    expect(source).toContain("removeItem(item.masterCode, item.styleId, item.tier");
    expect(source).toContain('aria-label={t("crt_remove_item")}');
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const cartContextSource = readFileSync(new URL("../contexts/CartContext.tsx", import.meta.url), "utf8");

describe("saved Design Tool checkout linkage", () => {
  it("always replaces the active scoped cart with the exact current design payload", () => {
    expect(source).toContain("replaceWithDesignItems(cartableLines, currentSavedDesignId ?? null)");
    expect(source).toContain("prevents hardware, cabinets, or another design from being carried over");
    expect(source).not.toContain("currentSavedDesignId != null && (cartItems.length === 0 || cartSourceDesignId === currentSavedDesignId)");
  });

  it("records the replacement design identity and clears that identity for ordinary cart edits", () => {
    expect(source).toContain("replaceWithDesignItems(cartableLines, currentSavedDesignId ?? null)");
    expect(cartContextSource).toContain("setSourceDesignId(null);");
  });

  it("keeps the customer-facing Designer-to-cart handoff in the active affiliate storefront", () => {
    expect(source).toContain("const cartDestination = cartPathForStoreScope(storeScope);");
    expect(source.match(/navigate\(cartDestination\)/g)).toHaveLength(1);
  });
});

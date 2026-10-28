import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Designer inventory wiring", () => {
  it("asks the inventory provider and lets the user swap", () => {
    expect(source).toContain("useDesignerInventory");
    expect(source).toContain("InventoryStockBadge");
    expect(source).toContain("InventoryDesignStockControl");
    expect(source).toContain("swapInventoryCabinet");
    expect(source).toContain("applyInventorySuggestion");
    expect(source).toContain("applyAutomaticSinkBaseSubstitutions");
    expect(source).toContain("SinkBaseSubstitutionNotice");
    expect(source).toContain("OutOfStockChoiceDialog");
    expect(source).toContain("chooseStockPrompt");
  });

  it("swaps only from the suggestion buttons", () => {
    const hook = readFileSync(new URL("../lib/useDesignerInventory.ts", import.meta.url), "utf8");
    expect(hook).not.toContain("applyInventorySuggestion");
    expect(source).toContain("onSwap={swapInventoryCabinet}");
    expect(source).toContain("onSwap={(suggestion) => swapInventoryCabinet(selectedCab.uid, suggestion)}");
    expect(source).not.toContain("useEffect(() => {\n    swapInventoryCabinet");
  });
});

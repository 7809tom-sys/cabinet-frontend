import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isExposedPanelStockCandidate } from "@/lib/exposedSidePanels";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("exposed-side panel pricing", () => {
  it("fetches prices for the panel stock the engine cuts from", () => {
    expect(source).toContain("catalogFillers.filter(isExposedPanelStockCandidate).forEach((panel) => push(panel.id, styleId, panel.masterCode));");
    expect(source).toContain("if (!isExposedPanelStockCandidate(item)) return [];");
  });

  it("waits for a price refetch before reporting missing panel prices", () => {
    expect(source).toContain("if (!priceRowsFetched || priceRowsFetching || exposedPanelStock.length === 0) return;");
  });

  it("collapses the Design check into one summary line with details on demand", () => {
    expect(source).toContain('data-testid="design-check-details"');
    expect(source).toContain("Design check: {exposedPanelSummary}");
    expect(source).not.toContain("Design check ({exposedPanelWarnings.length})");
  });

  it("recognises panel stock rows", () => {
    expect(isExposedPanelStockCandidate({ masterCode: "BEP24", description: "Base End Panel" })).toBe(true);
    expect(isExposedPanelStockCandidate({ masterCode: "WEP1230", subCategory: "End Panel" })).toBe(true);
    expect(isExposedPanelStockCandidate({ masterCode: "F342", description: "Filler" })).toBe(false);
  });
});

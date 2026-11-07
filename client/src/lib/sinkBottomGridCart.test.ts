import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSurfaceCartLines } from "./surfaceCartLines";

const designTool = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");

const gridPick = {
  id: 901,
  name: "PL-FC3018SB Bottom Grid",
  category: "Sinks & Faucets",
  subCategory: "Sink & Faucet Accessories",
  size: null,
  sellPrice: 72.56,
  description: null,
};

describe("Sink bottom grid add-on", () => {
  it("becomes its own payable cart line at quantity one", () => {
    const lines = buildSurfaceCartLines([gridPick], "homeowner");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      masterCode: "PEL-901",
      name: "PL-FC3018SB Bottom Grid",
      unitPrice: 72.56,
      qty: 1,
      pelicanProductId: 901,
      productKind: "surface",
    });
  });

  it("is an optional choice on the faucet step, defaulting to no grid", () => {
    // The sink step goes straight to the faucet; the grid never blocks the flow.
    expect(designTool).toContain('setRangeTopStep("faucet");');
    expect(designTool).not.toContain('"grid"');
    // Both answers are present, and "no grid" is its own selectable option.
    expect(designTool).toContain('data-testid="sink-bottom-grid-option"');
    expect(designTool).toContain('data-testid="sink-bottom-grid-none-option"');
    expect(designTool).toContain("Add a bottom grid?");
    expect(designTool).toContain("No grid — sink only");
    // Picking nothing still adds the sink; the standard faucet completes it.
    expect(designTool).toContain("Skip — add the standard Pelican faucet");
  });

  it("starts with no grid chosen and lets the shopper remove one", () => {
    expect(designTool).toContain("useState<SinkDialogProduct | null>(null)");
    expect(designTool).toContain('onClick={() => setPendingBottomGrid(null)}>Remove');
    // A grid the shopper chose is only applied when it still fits the sink.
    expect(designTool).toContain("bottomGridsForSink(sinkProduct.pelicanCode, [pendingBottomGrid])");
  });

  it("is written to the design's selected surfaces so the quote and cart carry it", () => {
    expect(designTool).toContain("A bottom grid is a cart line only.");
    expect(designTool).toContain("bottomGridProduct.name");
  });

  it("drops a grid the shopper chose before switching to a different sink model", () => {
    expect(designTool).toContain("bottomGridsForSink(chosen.pelicanCode, [current])");
    expect(designTool).toContain("bottomGridsForSink(sinkProduct.pelicanCode, [pendingBottomGrid])");
  });

  it("does not offer the grid on a vanity basin", () => {
    expect(designTool).toContain("{!isBathroomVanity && pendingSinkProduct && (");
  });
});

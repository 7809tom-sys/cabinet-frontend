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

  it("is offered only in the kitchen sink flow, after a sink is chosen", () => {
    expect(designTool).toContain('setRangeTopStep(isBathroomVanity ? "faucet" : "grid")');
    expect(designTool).toContain('Bottom grid for this sink');
    expect(designTool).toContain("Added to the cart only, not the drawing.");
    expect(designTool).toContain("Pelican lists no bottom grid for this sink model");
  });

  it("is written to the design's selected surfaces so the quote and cart carry it", () => {
    expect(designTool).toContain("A bottom grid is a cart line only.");
    expect(designTool).toContain("bottomGridProduct.name");
  });

  it("drops a grid the shopper chose before switching to a different sink model", () => {
    expect(designTool).toContain("bottomGridsForSink(chosen.pelicanCode, [current])");
    expect(designTool).toContain("bottomGridsForSink(sinkProduct.pelicanCode, [pendingBottomGrid])");
  });
});

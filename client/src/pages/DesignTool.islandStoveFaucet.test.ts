import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const designerSource = fs.readFileSync(path.resolve(__dirname, "DesignTool.tsx"), "utf8");
const planSource = fs.readFileSync(path.resolve(__dirname, "../components/design/PlanCanvas.tsx"), "utf8");
const threeDSource = fs.readFileSync(path.resolve(__dirname, "../components/design/InteractiveRoom3D.tsx"), "utf8");
const fabricatorSource = fs.readFileSync(path.resolve(__dirname, "FabricatorSheet.tsx"), "utf8");

describe("island stove and faucet rendering routes", () => {
  it("uses visible island countertop fragments for cart quantities instead of the pre-cutout slab", () => {
    expect(designerSource).toContain("countertopArea(placed, island, island ? islandCountertopVisibleRects(island, placed) : null, room)");
  });

  it("uses the same visible fragments in the plan and native 3D island slab renderers", () => {
    expect(planSource).toContain("islandCountertopVisibleRects(geometryIsland, snapshotCabinets)");
    expect(threeDSource).toContain("const slabs = islandCountertopVisibleRects(island, placed);");
    expect(threeDSource).toContain("const waterfallSlabs = islandCountertopRects(island, placed);");
    expect(fabricatorSource).toContain("islandCountertopVisibleRects(draft.island, draft.placed)");
  });
});

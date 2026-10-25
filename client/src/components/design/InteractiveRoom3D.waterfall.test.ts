import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(process.cwd(), "client/src/components/design/InteractiveRoom3D.tsx"), "utf8");

describe("3D waterfall end panels", () => {
  it("projects saved waterfall flags and builds full-height countertop side meshes", () => {
    expect(source).toContain("waterfallLeft: cabinet.waterfallLeft ?? null");
    expect(source).toContain("waterfallRight: cabinet.waterfallRight ?? null");
    expect(source).toContain("const waterfallSides");
	  expect(source).toContain("waterfallPanel: true");
	  expect(source).toContain("fullHeightToFloor: true");
	  expect(source).toContain("islandWaterfall: Boolean(sku.islandFace)");
	  expect(source).toContain("panel.translateX(side * (bodyWidth / 2 + panelThickness / 2))");
	  expect(source.indexOf("const waterfallSides")).toBeGreaterThan(source.indexOf("if (shouldRenderCountertopOverSceneItem"));
  });
});

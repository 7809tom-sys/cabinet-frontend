import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const designToolSource = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

describe("DesignTool MW-30 palette and drag flow", () => {
  it("routes every over-range microwave add through the tested attachment resolver before a placed cabinet is created", () => {
    expect(designToolSource).toContain('import { resolveOverRangeMicrowavePlacement } from "./designToolMicrowavePlacement"');
    expect(designToolSource).toContain("const otrPlacement = resolveOverRangeMicrowavePlacement(prev, room, activeWall, selectedUid, spot, { width, depth });");
    expect(designToolSource).toContain("spot = otrPlacement.spot;");
    expect(designToolSource).toContain("otrRangeUid = otrPlacement.rangeUid;");
  });

  it("blocks a palette or drag MW-30 add without a compatible range instead of continuing to free canvas placement", () => {
    expect(designToolSource).toContain("if (!otrPlacement.ok)");
    expect(designToolSource).toContain("setPlacementWarning(otrPlacement.message);");
    expect(designToolSource).toContain("toast.error(otrPlacement.message);");
    expect(designToolSource).toContain("return;");
  });
});

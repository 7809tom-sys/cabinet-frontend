import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("designer WalzCraft color button", () => {
  it("sits in the designer toolbar for every view, including the floor plan, and is not admin-only", () => {
    const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
    const lines = source.split("\n");
    const hits = lines.filter((line) => line.includes("<PlanWalzCraftWizardButton"));
    expect(hits).toEqual(["        <PlanWalzCraftWizardButton onShade={applyPlanDoorColor} />"]);
    const index = lines.findIndex((line) => line.includes("<PlanWalzCraftWizardButton"));
    expect(lines[index - 1]).not.toContain("viewMode");
    expect(lines[index - 1]).not.toContain("isAdmin");
    expect(source).toContain('data-testid="designer-toolbar"');
    expect(source.slice(0, source.indexOf("<PlanWalzCraftWizardButton"))).toContain('data-testid="designer-toolbar"');
    expect(source).toContain("renderHex: shade.hex");
  });
});

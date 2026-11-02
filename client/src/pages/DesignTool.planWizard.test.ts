import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("plan page WalzCraft color wizard", () => {
  it("puts the wizard button on the floor plan and saves the chosen shade as the render hex", () => {
    const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
    const marker = source.indexOf("<PlanWalzCraftWizardButton onShade={applyPlanDoorColor} />");
    expect(marker).toBeGreaterThan(0);
    const around = source.slice(Math.max(0, marker - 180), marker);
    expect(around).toContain('viewMode === "plan"');
    expect(source).toContain("renderHex: shade.hex");
    expect(source).toContain("adminUpdateDoorStyle");
  });
});
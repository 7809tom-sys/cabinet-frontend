import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Peninsula Wizard sequential appliances, sink popup and style gate", () => {
  it("offers dishwasher and wine cooler in the same ordered list as cabinets", () => {
    expect(source).toContain('item.masterCode === "DW-24" || item.masterCode === "WINE-24"');
    expect(source).toContain('<optgroup label="Appliances">');
    expect(source).not.toContain("Appliance in this run");
  });

  it("seats a chosen appliance in sequence using its real catalog size", () => {
    expect(source).toContain("const applianceDef = cabinet.id < 0");
    expect(source).toContain('applianceDef.depth, "appliance"');
  });

  it("opens the Designer sink and faucet popup for every Wizard sink base", () => {
    expect(source).toContain("setWizardSinkQueue(");
    expect(source).toContain("setSinkBaseDialog({ cabinetUid: next })");
    expect(source).toContain("isSinkBaseCabinet(cabinet)");
  });

  it("blocks adding or building anything until a cabinet style is selected", () => {
    expect(source).toContain('data-testid="peninsula-wizard-style-required"');
    expect(source).toContain('data-testid="peninsula-wizard-primary-cabinet-add" disabled={styleId == null}');
    expect(source).toContain('data-testid="peninsula-wizard-return-cabinet-add" disabled={styleId == null}');
    expect(source).toContain("if (styleIdRef.current == null) {");
  });
});

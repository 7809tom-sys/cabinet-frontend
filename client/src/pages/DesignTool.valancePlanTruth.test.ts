import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Designer arched valance plan truth", () => {
  it("keeps the arched valance opt-in rather than auto-adding it for a window and upper cabinet", () => {
    const trimStart = source.indexOf("// ─── Trim auto-apply");
    const trimEnd = source.indexOf("// Countertop is a POST-LAYOUT step", trimStart);
    const trimSource = source.slice(trimStart, trimEnd);

    expect(trimSource).toContain("Crown, batten, and valances remain opt-in");
    expect(trimSource).toContain("VA-48 that the customer did not add to the plan");
    expect(trimSource).not.toContain("hasWindows");
    expect(trimSource).not.toContain("setValance(true)");
  });

  it("keeps batten molding opt-in and never enables it from cabinet seams", () => {
    const trimStart = source.indexOf("// ─── Trim auto-apply");
    const trimEnd = source.indexOf("// Countertop is a POST-LAYOUT step", trimStart);
    const trimSource = source.slice(trimStart, trimEnd);

    expect(trimSource).toContain("Batten molding is always");
    expect(trimSource).not.toContain("needsBatten");
    expect(trimSource).not.toContain("setBatten(true)");
    expect(source).toContain('if (wasManuallyChosen("batten")) trimOverride.current.batten = true;');
    expect(source).toContain('setBatten(wasManuallyChosen("batten") && d.batten === true);');
    expect(source).toContain('(k === "crown" || k === "valance" || k === "batten")');
  });

  it("persists explicit trim provenance and clears legacy automatic VA-48 state on restoration", () => {
    expect(source).toContain("trimManualOverride: { ...trimOverride.current }");
    expect(source).toContain("const wasManuallyChosen = (kind: TrimKind)");
    expect(source).toContain('if (wasManuallyChosen("valance")) trimOverride.current.valance = true;');
    expect(source).toContain('setValance(wasManuallyChosen("valance") && d.valance === true);');
    expect(source).toContain('(k === "crown" || k === "valance" || k === "batten")');
  });

  it("keeps the Material & Parts invoice derived from the exact active trims", () => {
    const materialStart = source.indexOf("const materialsListSupplements");
    const materialEnd = source.indexOf("// ─── Placement actions", materialStart);
    const materialSource = source.slice(materialStart, materialEnd);

    expect(materialSource).toContain("for (const trim of activeTrims)");
    expect(materialSource).toContain("description: trimLabels[trim.kind]");
    expect(materialSource).toContain("activeTrims");
  });
});

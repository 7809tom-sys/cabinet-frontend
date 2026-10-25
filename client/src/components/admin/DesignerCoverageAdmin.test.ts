import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Designer Coverage administration", () => {
  it("provides a direct Cabinet Config edit action for every displayed cabinet", () => {
    const source = readFileSync(new URL("./DesignerCoverageAdmin.tsx", import.meta.url), "utf8");

    expect(source).toContain("cabinetConfigQuickEditUrl");
    expect(source).toContain("Edit Cabinet Config for ${cab.masterCode}");
    expect(source).toContain("<Pencil className=");
  });

  it("offers an explicit, accessible filter for cabinets with missing coverage", () => {
    const source = readFileSync(new URL("./DesignerCoverageAdmin.tsx", import.meta.url), "utf8");

    expect(source).toContain('data-testid="coverage-missing-only-toggle"');
    expect(source).toContain("Missing coverage only");
    expect(source).toContain("Showing only cabinets with missing coverage.");
    expect(source).toContain("gapsOnly,");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./PelicanCatalogAdmin.tsx", import.meta.url), "utf8");

describe("Pelican countertop structural overhang administration", () => {
  it("keeps the limit restricted to countertop rows and explicitly unverified until an administrator supplies it", () => {
    expect(source).toContain('it.category === "Quartz Slabs (Countertops)"');
    expect(source).toContain('placeholder="Unverified"');
    expect(source).toContain('step="0.125"');
    expect(source).toContain("setUnsupportedOverhangLimit.mutate");
  });

  it("shows the evidence audit and each configured row's explicit readiness state", () => {
    expect(source).toContain("trpc.pelican.designerReadinessAudit.useQuery");
    expect(source).toContain('data-testid="pelican-designer-readiness-audit"');
    expect(source).toContain("Designer evidence audit");
    expect(source).toContain('"Evidence complete"');
    expect(source).toContain('"Evidence needed"');
    expect(source).toContain("designerReadinessAudit.invalidate");
  });
});

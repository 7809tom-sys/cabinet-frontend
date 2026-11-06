import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DistributorMultipliersAdmin.tsx", import.meta.url), "utf8");

/**
 * The Multipliers tab is where an administrator sets the percentage that fills a
 * vendor row's Cost when that SKU has no stored cost. It has to say so plainly,
 * because the factor is otherwise only visible as two decimals in two inputs.
 */
describe("distributor multipliers cost factor", () => {
  it("states the factor that is used for missing costs", () => {
    expect(source).toContain("Cost factor used for missing costs");
    expect(source).toContain('data-testid={`multiplier-cost-factor-${r.id}`}');
  });

  it("says a vendor with no factor shows an em dash rather than a guess", () => {
    expect(source).toContain('not set — Catalog rows with no stored cost show &ldquo;—&rdquo;');
  });

  it("shows the factor as both a decimal and a percentage of list", () => {
    expect(source).toContain("eff.toFixed(4)");
    expect(source).toContain("of list (");
  });

  it("keeps the existing landed-cost definition unchanged", () => {
    // JSX wraps the sentence across lines, so assert the two halves.
    expect(source).toContain("Our cost ={");
    expect(source).toContain("(list × Base) × (1 + Tariff)");
  });

  it("labels the factor as a fraction of list, not a markup on cost", () => {
    // eff = base × (1 + freight), bounded to 0.01…1 by effValid.
    expect(source).toContain("base ?? 0) * (1 + (freight ?? 0))");
    expect(source).toContain("eff >= 0.01 && eff <= 1");
  });
});

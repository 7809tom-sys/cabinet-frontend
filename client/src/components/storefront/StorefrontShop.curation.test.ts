import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/components/storefront/StorefrontShop.tsx"), "utf8");

describe("StorefrontShop affiliate curation recovery", () => {
  it("clears a persisted line lock when an affiliate removes that distributor", () => {
    expect(source).toContain("trpc.storefront.families.useQuery");
    expect(source).toContain("{ slug }");
    expect(source).toContain("candidate.styleId === family.styleId");
    expect(source).toContain("clear();");
  });

  it("keeps finish swatch labels standalone instead of appending the style name", () => {
    expect(source).toContain("aria-label={label}");
    expect(source).not.toContain("aria-label={`${familyFinishLabel(variant)} —");
    expect(source).not.toContain("aria-label={`${label} —");
  });
});

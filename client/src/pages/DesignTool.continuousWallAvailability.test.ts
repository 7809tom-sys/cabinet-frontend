import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

describe("continuous-wall storefront availability", () => {
  it("keeps the experimental builder in CabinetDealz while affiliate Designers receive a coming-soon notice", () => {
    expect(source).toContain("const continuousWallsEnabled = !affiliateSlug;");
    expect(source).toContain("const continuousWallsComingSoonMessage = affiliateSlug");
    expect(source.match(/onApplyContinuousRoom=\{continuousWallsEnabled \? applyContinuousWallRoom : undefined\}/g)).toHaveLength(2);
    expect(source.match(/continuousWallComingSoonMessage=\{continuousWallsComingSoonMessage\}/g)).toHaveLength(2);
    expect(source).toContain("Continuous walls are coming soon to partner storefronts.");
  });
});

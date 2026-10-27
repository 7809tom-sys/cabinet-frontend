import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

describe("continuous-wall storefront availability", () => {
  it("offers the finished continuous-wall builder in every Designer, including affiliate storefronts", () => {
    expect(source).toContain("const continuousWallsEnabled = true;");
    expect(source).not.toContain("const continuousWallsEnabled = !affiliateSlug;");
    expect(source).toContain("const continuousWallsComingSoonMessage = null;");
    expect(source.match(/onApplyContinuousRoom=\{continuousWallsEnabled \? applyContinuousWallRoom : undefined\}/g)).toHaveLength(2);
    expect(source.match(/continuousWallComingSoonMessage=\{continuousWallsComingSoonMessage\}/g)).toHaveLength(2);
    expect(source).toContain("continuousWallBlockedReason");
    expect(source).not.toContain("Continuous walls are coming soon to partner storefronts.");
    expect(source).not.toContain("being prepared for partner storefronts");
  });
});

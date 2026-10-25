import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Bathroom Vanity palette wiring", () => {
  it("retains the distributor- and style-scoped, priced placeable cabinet query", () => {
    expect(source).toContain('paletteType === "corner" || paletteType === "vanity"');
    expect(source).toContain('styleId: styleId ?? undefined,');
    expect(source).toContain('distributorId: catalogDistributorScopeId ?? undefined,');
    expect(source).toContain('if (paletteType === "vanity") return isBathroomVanityCabinet(c);');
    expect(source).toContain('if (paletteType === "base") return !isCornerBase(c) && !isVanity(c);');
  });

  it("lets a Bathroom customer select the existing distributor and active door-style flow right in the Vanity tab", () => {
    expect(source).toContain('data-testid="bathroom-vanity-door-style-picker"');
    expect(source).toContain('data-testid="bathroom-vanity-distributor-picker"');
    expect(source).toContain('chooseCatalogDistributor(value === "all" ? null : Number(value))');
    expect(source).toContain('setSlotStyle(activeSlot, Number(value))');
    expect(source).toContain('value={styleId == null ? "" : String(styleId)}');
  });
});

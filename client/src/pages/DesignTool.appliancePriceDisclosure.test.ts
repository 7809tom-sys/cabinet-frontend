import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Designer appliance price disclosure", () => {
  it("marks synthetic appliance palette models as excluded from the design total", () => {
    expect(source).toContain('paletteType === "appliance" && Number(c.id) === 0');
    expect(source).toContain("Layout model — appliance price is not included in the design total.");
    expect(source).toContain('data-testid={`appliance-price-pending-${c.masterCode}`}');
  });
});

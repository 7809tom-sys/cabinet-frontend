import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Designer cart lines carry their supplier", () => {
  it("falls back to the selected style's supplier before the plan is locked", () => {
    expect(source).toContain("const cartDistributorId = lockedDistributorId ?? selectedStyleDistributorId ?? null;");
  });

  it("uses that supplier on trim, end panel, cabinet, and roll-out cart lines", () => {
    const start = source.indexOf("const cartDistributorId =");
    const end = source.indexOf("const cartableLines = useMemo", start);
    const cartBuilders = source.slice(start, source.indexOf("return mergeDesignCartLines([...cabinetCartLines", end));
    expect(cartBuilders).not.toContain("distributorId: lockedDistributorId ?? null");
    expect(cartBuilders.match(/distributorId: cartDistributorId,/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("loaded bundle price lock", () => {
  it("uses the verified saved bundle price as a composition-aware designer, cart, and 3D lock", () => {
    expect(source).toContain("const savedPackageTotal = Number(bundleData.homeownerPrice)");
    expect(source).toContain("setLoadedBundlePriceLock");
	  expect(source).toContain("const total = useMemo(() => calculateCartSubtotal(cartableLines), [cartableLines])");
    expect(source).toContain("lockDesignCartLinesToPackageTotal(designLines, activeBundlePriceLock.total)");
    expect(source).toContain("lockDesignCartLinesToPackageTotal(lines, activeBundlePriceLock.total)");
    expect(source).toContain("Verified bundle price");
  });
});

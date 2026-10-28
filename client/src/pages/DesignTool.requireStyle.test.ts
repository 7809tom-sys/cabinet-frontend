import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("cabinets require a vendor and door style", () => {
  it("refuses to place a cabinet before a door style is chosen and opens the vendor/color setup", () => {
    const start = source.indexOf("const addCabinet = useCallback(");
    const guard = source.slice(start, source.indexOf("if (isBaseBlindCorner(c) && blindPullOverride == null)", start));
    expect(guard).toContain("if (styleId == null && !isApplianceCode(c.masterCode)) {");
    expect(guard).toContain("setCatalogSetupOpen(true)");
    expect(guard).toContain("return;");
  });

  it("opens the vendor/color setup after the Continuous Wall Builder applies its walls", () => {
    const start = source.indexOf("const applyContinuousWallRoom = useCallback(");
    const body = source.slice(start, source.indexOf("const physicalWallSpans = useMemo(", start));
    expect(body).toContain("if (styleId == null) window.setTimeout(() => setCatalogSetupOpen(true), 0);");
    expect(body).toContain("styleId]);");
  });
});

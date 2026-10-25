import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Designer deletion placement state", () => {
  it("removes a deleted cabinet from the committed placement reference before an immediate re-add", () => {
    const helperStart = source.indexOf("const removeCabinetsAndReleaseVoid = useCallback");
    const helperEnd = source.indexOf("const removeCabinetAndReleaseVoid", helperStart);
    const helperBlock = source.slice(helperStart, helperEnd);
    expect(helperBlock).toContain("removePlacedCabinetWithRequiredBlindCornerFiller(current, uid)");
    expect(helperBlock).toContain("placedRef.current = next;");
    expect(source).toContain("removeCabinetsAndReleaseVoid([uid]);");
  });
});

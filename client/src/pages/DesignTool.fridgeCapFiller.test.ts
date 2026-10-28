import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("refrigerator cap filler", () => {
  const start = source.indexOf('const filler = catalogFillerForGap(catalogFillers, eachFillerWidth, "wall");');
  const end = source.indexOf("} else {", start);
  const missingFillerBranch = source.slice(start, end);

  it("keeps the over-fridge cabinet and panels when the line has no priced 3-inch wall filler", () => {
    expect(start).toBeGreaterThan(0);
    expect(missingFillerBranch).toContain("if (!filler) {");
    expect(missingFillerBranch).toContain("toast.warning(message");
    // A missing optional cap filler must not cancel the whole refrigerator assembly.
    expect(missingFillerBranch).not.toContain("return false");
  });

  it("still adds both cap fillers when a priced filler exists", () => {
    const fillerBranch = source.slice(end, source.indexOf("// 2) Refrigerator END PANELS", end));
    expect(fillerBranch).toContain('addCapFiller("bridge-left-filler", bay.openingStart);');
    expect(fillerBranch).toContain('addCapFiller("bridge-right-filler", bay.openingEnd - eachFillerWidth);');
  });
});

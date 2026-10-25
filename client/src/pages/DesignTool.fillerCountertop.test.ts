import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const directFillerRoute = source.slice(
  source.indexOf("const fillGapWithFiller = useCallback"),
  source.indexOf("// ── Combo: place a cabinet + auto-sized filler in one click"),
);
const catalogFillerAutoSnap = source.slice(
  source.indexOf("// Filler auto-snap: find nearest gap and resize/reposition"),
  source.indexOf("// Short cabinets centered over a sink normally begin"),
);

describe("Designer direct gap filler countertop contract", () => {
  it("records a direct base-gap filler as an installed, priced filler so its countertop continues the run", () => {
    expect(directFillerRoute).toContain("const fillerUid = makeUid()");
    expect(directFillerRoute).toContain("fillerPieceGroupId: `filler-group-${fillerUid}`");
    expect(directFillerRoute).toContain('fillerBillingRole: "primary"');
    expect(directFillerRoute).toContain("fillerTotalWidth: width");
    expect(directFillerRoute).toContain('fillerPlacementMode: "right"');
  });

  it("confirms any catalog-recognized filler after it snaps into a measured gap, rather than only FILL-prefixed codes", () => {
    expect(catalogFillerAutoSnap).toContain("isFillerItem(newCab)");
    expect(catalogFillerAutoSnap).toContain("fillerPieceGroupId: `filler-group-${finalCab.uid}`");
    expect(catalogFillerAutoSnap).toContain('fillerBillingRole: "primary"');
    expect(catalogFillerAutoSnap).toContain("fillerTotalWidth: best.length");
    expect(catalogFillerAutoSnap).toContain('fillerPlacementMode: "right"');
    expect(catalogFillerAutoSnap).toContain("matchInstalledFillerToCabinet(finalCab, owner, room)");
  });
});

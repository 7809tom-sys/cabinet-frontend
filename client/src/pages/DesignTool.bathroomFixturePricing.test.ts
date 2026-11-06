import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("placed bathroom fixture pricing wiring", () => {
  it("reads the price-refresh list without the 3D-drawability gate", () => {
    // designSelectionByIds is drawability-gated, so it never returns a toilet,
    // bidet, tub, or enclosure. Reading only that list nulled a placed
    // fixture's real price and the fixture reached Materials and the cart at
    // $0.00. byIds is the same active, catalog-visible, priced row.
    expect(source).toContain("trpc.surfaces.designSelectionByIds.useQuery(");
    expect(source).toContain("trpc.surfaces.byIds.useQuery(");
    expect(source).toContain("mergeVerifiedSurfacePriceRecords(verifiedSelectedSurfaceRecords, catalogSelectedSurfaceRecords)");
  });

  it("waits for both price reads before refreshing a saved selection", () => {
    expect(source).toContain(
      "const selectedSurfacePriceRecordsLoaded = verifiedSelectedSurfacesLoaded && catalogSelectedSurfacesLoaded;",
    );
    expect(source).toContain("refreshVerifiedSurfaceSelections(current, selectedSurfacePriceRecords)");
  });
});

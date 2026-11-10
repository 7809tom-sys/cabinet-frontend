import { describe, expect, it } from "vitest";
import matrixCatalog from "./__fixtures__/autoDesignMatrixCatalog.json";
import { resolveDoorDrawerCounts } from "./cabinetGraphics";
import { standardBaseFaceReference } from "@shared/genericCabinetDrawerReference";
import { isTwentyFourSingleDoorDataError } from "@shared/twentyFourDoorFace";

type Row = {
  masterCode?: string;
  description?: string | null;
  category?: string | null;
  subCategory?: string | null;
  width?: string | number | null;
  numberOfDoors?: number | null;
  numberOfDrawers?: number | null;
  graphicType?: string | null;
  cornerType?: string | null;
  placement?: string | null;
};

/**
 * Door count the drawing used before the 24" correction: the standard B-code
 * face when it owns the row, otherwise the stored count (a graphic token made
 * that count authoritative).
 */
function previousDoorCount(row: Row): number | null {
  const standard = standardBaseFaceReference(row.masterCode);
  if (standard) return standard.doors;
  if (row.numberOfDoors == null) return null;
  return Math.max(0, row.numberOfDoors);
}

function changedSkus(): string[] {
  const codes = new Set<string>();
  for (const payload of Object.values(matrixCatalog as Record<string, Record<string, unknown>>)) {
    for (const rows of Object.values(payload)) {
      if (!Array.isArray(rows)) continue;
      for (const row of rows as Row[]) {
        if (!row?.masterCode) continue;
        const before = previousDoorCount(row);
        if (before !== 1) continue;
        if (!isTwentyFourSingleDoorDataError(row)) continue;
        const after = resolveDoorDrawerCounts(row);
        if (after.doors === 2) codes.add(row.masterCode);
      }
    }
  }
  return [...codes].sort();
}

describe("catalog rows whose drawn door count changes to two", () => {
  it("keeps every code and only corrects the 24 inch single-door data errors", () => {
    expect(changedSkus()).toEqual([
      "B24S",
      "B24SFH",
      "SB24S",
      "SB24SFH",
      "VSB24S",
      "VSB24SFH",
      "W2415",
      "W2418",
      "W2423",
      "W2430S",
      "W2723",
      "W3015",
      "W3018",
      "W3023",
      "W3312",
      "W3315",
      "W3318",
      "W3323",
      "W3612",
      "W3615",
      "W3618",
      "W3623",
    ]);
  });
});

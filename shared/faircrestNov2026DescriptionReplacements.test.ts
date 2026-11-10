import { describe, expect, it } from "vitest";
import realCatalog from "../client/src/lib/__fixtures__/autoDesignRealCatalog.json";
import {
  FAIRCREST_NOV_2026_DESCRIPTION_REPLACEMENTS,
  FAIRCREST_NOV_2026_DESCRIPTION_SOURCE,
} from "./faircrestNov2026DescriptionReplacements";

type Row = { masterCode?: string; description?: string | null };

function snapshotDescription(masterCode: string): string | null {
  for (const payload of Object.values(realCatalog as Record<string, Record<string, unknown>>)) {
    for (const rows of Object.values(payload)) {
      if (!Array.isArray(rows)) continue;
      for (const row of rows as Row[]) {
        if (row.masterCode === masterCode && row.description) return row.description;
      }
    }
  }
  return null;
}

describe("Faircrest November 2026 description replacements", () => {
  it("names the November 2026 spec guide", () => {
    expect(FAIRCREST_NOV_2026_DESCRIPTION_SOURCE).toBe(
      "Faircrest Cabinets Product Specification Guide, November 2026 Edition",
    );
  });

  it("replaces only snapshot wording that differs from the guide, and keeps every code", () => {
    const codes = FAIRCREST_NOV_2026_DESCRIPTION_REPLACEMENTS.map((row) => row.masterCode);
    expect(new Set(codes).size).toBe(codes.length);
    for (const row of FAIRCREST_NOV_2026_DESCRIPTION_REPLACEMENTS) {
      expect(snapshotDescription(row.masterCode)).toBe(row.from);
      expect(row.to).not.toBe(row.from);
      expect(row.to.length).toBeGreaterThan(0);
      expect(row.source).toBe(FAIRCREST_NOV_2026_DESCRIPTION_SOURCE);
    }
  });
});

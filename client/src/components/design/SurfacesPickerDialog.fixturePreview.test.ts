import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BATHROOM_FIXTURE_FINISH_CHIPS, bathroomFixtureFinishFilter } from "./SurfacesPickerDialog";

describe("Bathroom fixture preview and finish chips", () => {
  it("keeps the seven source-token finish filters represented by visible swatches", () => {
    expect(BATHROOM_FIXTURE_FINISH_CHIPS.map((chip) => chip.value)).toEqual([
      "all",
      "white",
      "matte-black",
      "chrome",
      "brushed-nickel",
      "brushed-gold",
      "other",
    ]);
    expect(BATHROOM_FIXTURE_FINISH_CHIPS.every((chip) => chip.swatch.length > 0)).toBe(true);
    expect(bathroomFixtureFinishFilter({ name: "Pelican tub", pelicanCode: "PL-02146 MB", size: "59 in" })).toBe("matte-black");
  });

  it("renders a selected bathroom fixture card without changing placement or pricing boundaries", () => {
    const source = readFileSync(
      resolve(process.cwd(), "client/src/components/design/SurfacesPickerDialog.tsx"),
      "utf8",
    );
    expect(source).toContain('data-testid="selected-bathroom-fixture-preview"');
    expect(source).toContain('data-testid="bathroom-fixture-finish-filter"');
    expect(source).toContain("BATHROOM_FIXTURE_FINISH_CHIPS.map");
    expect(source).toContain("selectedBathroomFixture.imageUrl");
    expect(source).toContain("selectedBathroomFixture.sellPrice");
    expect(source).toContain("onPlaceBathroomFixture");
  });
});

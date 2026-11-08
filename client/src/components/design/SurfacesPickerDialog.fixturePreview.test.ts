import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BATHROOM_FIXTURE_FINISH_CHIPS, bathroomFixtureFinishFilter } from "./SurfacesPickerDialog";
import { withPelicanSinkCatalogCopy } from "@/lib/pelicanSinkCatalogDescriptions";

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

  it("never shows a kitchen farmhouse title over a vanity basin", () => {
    // The live catalog row behind the owner's screenshot: PL-3099 sold as an
    // 18" x 13" undermount vanity basin, but stored under the imported StoneCreek
    // "Farmhouse Reserve 33\" Farmhouse Apron-Front" name.
    const stored = {
      id: 656,
      pelicanCode: "PL-3099 Individually Packed",
      name: 'StoneCreek Farmhouse Reserve 33" Farmhouse Apron-Front Single Bowl',
      size: '18" x 13"',
      sellPrice: 116.1,
    };
    const banner = withPelicanSinkCatalogCopy(stored);
    expect(banner.name).not.toMatch(/farmhouse|apron/i);
    expect(banner.name).toBe("StoneCreek Pearl Series Porcelain Undermount Sink — White (Foam Lined Box)");
    // The size and price the customer is charged stay exactly as stored.
    expect(banner.size).toBe('18" x 13"');
    expect(banner.sellPrice).toBe(116.1);
  });

  it("reads the selected fixture through the same correction as the card grid", () => {
    // The banner used to read `selected` raw while the grid rendered corrected
    // copy, which is how a farmhouse title ended up over an undermount photo.
    const source = readFileSync(
      resolve(process.cwd(), "client/src/components/design/SurfacesPickerDialog.tsx"),
      "utf8",
    );
    const banner = source.slice(
      source.indexOf("const selectedBathroomFixture = useMemo"),
      source.indexOf("const selectedBacksplash = useMemo"),
    );
    expect(banner).toContain("withPelicanSinkCatalogCopy(match)");
    expect(banner).toContain("bathroomFixtureCardImage(match.pelicanCode, match.imageUrl)");
  });
});

/**
 * Issue #55 — regression test.
 *
 * Verified wall wine rack SKUs ending in 3015 / 3018 (WRC3015, WRC3018,
 * WXR3018; Skyline carries 3015, U.S. Cabinet Depot carries 3018) were present
 * and verified in Cabinet Config under "Wall Wine Rack" but never appeared on
 * the White Shaker storefront catalog or in the 3D Designer's cabinet picker.
 *
 * The rows below are the shapes the two live supply lines actually deliver,
 * including the supplier's combined "parent / child" category strings and the
 * bare accessory filing. Every assertion here is a consumer that dropped the
 * item:
 *
 *   1. the family catalog's Wall chip (`familyTypeMatches`)
 *   2. the Designer wall picker merge (`withWallWineRacks`)
 *   3. the Designer eligibility gate (`cabinetCanBeRenderedOrPlacedIn3d`)
 *   4. the affiliate storefront Wall tab (server-side exact category filter)
 *   5. catalog search for the SKU fragment and the words "wine rack"
 *
 * It also pins the false positives PR 59 introduced: WRC18L / WRC18R are Wall
 * Radius Caps (the WRC prefix is not enough), WR#### is a refrigerator wall,
 * and a BASE wine rack keeps the Base tab.
 */

import { describe, expect, it } from "vitest";
import { designerWallWineRackSections, isWallWineRackCabinet, withWallWineRacks, type WallWineRackFields } from "@shared/wallWineRack";
import { mergeStorefrontCatalogPages, storefrontCatalogOffsets } from "./storefrontWallWineRacks";
import { cabinetCanBeRenderedOrPlacedIn3d, isDesignerAccessoryItem } from "@shared/designerEligibility";
import { searchCatalogItems } from "@shared/catalogCodeSearch";
import { familyTypeMatches } from "./familyCategoryFilters";
import { mergeWallTabRacks, wallTabExtraCategories } from "./storefrontWallWineRacks";

type Row = WallWineRackFields & {
  id: number;
  masterCode: string;
  description: string | null;
  category: string | null;
  subCategory: string | null;
  placement?: string | null;
  placementType?: string | null;
  width: string | null;
  height: string | null;
  depth: string | null;
  aliases?: string[];
};

let nextId = 9400000;
function row(partial: Partial<Row> & Pick<Row, "masterCode" | "category" | "subCategory">): Row {
  nextId += 1;
  return {
    id: nextId,
    masterCode: partial.masterCode,
    description: partial.description ?? null,
    category: partial.category,
    subCategory: partial.subCategory,
    placement: partial.placement ?? null,
    placementType: partial.placementType ?? null,
    width: partial.width ?? "30",
    height: partial.height ?? "15",
    depth: partial.depth ?? "12",
    aliases: partial.aliases,
  };
}

/**
 * The two verified racks from the issue, one per supply line, with the
 * category strings those lines use for them.
 */
const SKYLINE_3015 = row({
  id: 9360166,
  masterCode: "WRC3015",
  description: '30"X 15" Wall Wine Rack Cabinet',
  category: "Wall Wine Rack",
  subCategory: "Wine Rack / Open Display",
  placement: "wall",
  placementType: "wall",
  width: "30",
  height: "15",
  depth: "12",
  aliases: ["WRC-30-15"],
});

const USCABINET_3018 = row({
  masterCode: "WRC3018",
  description: '30"X 18" Wall Wine Rack',
  category: "Specialty / Wine Rack",
  subCategory: null,
  placementType: null,
  width: "30",
  height: "18",
  depth: "12",
});

const USCABINET_3018_OPEN_DISPLAY = row({
  masterCode: "WXR3018",
  description: "Wall Wine Rack",
  category: "Accessories / Wine Storage",
  subCategory: "Wine Storage",
  placement: "accessory",
  placementType: "accessory",
  width: "30",
  height: "18",
  depth: "12",
});

const VERIFIED_RACKS = [SKYLINE_3015, USCABINET_3018, USCABINET_3018_OPEN_DISPLAY];

/** A White Shaker wall cabinet and a filler, so the tabs are not rack-only. */
const PLAIN_WALL = row({ masterCode: "W3018", category: "Wall", subCategory: "Bridge / Stacker" });

describe("issue #55: verified 3015 / 3018 wall wine racks reach every surface", () => {
  it("classifies each supplier filing of the verified racks as a wall rack", () => {
    for (const rack of VERIFIED_RACKS) {
      expect(isWallWineRackCabinet(rack), `${rack.masterCode} (${rack.category})`).toBe(true);
    }
    // The alias-only code Skyline prints on its own price sheet.
    expect(isWallWineRackCabinet(row({ masterCode: "WRC-30-15", category: "Specialty", subCategory: null }))).toBe(true);
    // A vendor-prefixed rack code, which the old prefix-anchored regex missed.
    expect(isWallWineRackCabinet(row({ masterCode: "DN-WRC3015", category: "Specialty", subCategory: "Open Display" }))).toBe(true);
    expect(isWallWineRackCabinet(row({ masterCode: "USCD-WRC3018", category: "Wall", subCategory: null }))).toBe(true);
  });

  it("keeps them on the family catalog's Wall chip and off Accessories", () => {
    for (const rack of VERIFIED_RACKS) {
      const label = `${rack.masterCode} (${rack.category})`;
      expect(familyTypeMatches("all", rack.category, rack.subCategory, rack.masterCode), label).toBe(true);
      expect(familyTypeMatches("wall", rack.category, rack.subCategory, rack.masterCode), label).toBe(true);
      expect(familyTypeMatches("accessory", rack.category, rack.subCategory, rack.masterCode), label).toBe(false);
      expect(familyTypeMatches("base", rack.category, rack.subCategory, rack.masterCode), label).toBe(false);
    }
    // The Wall chip has to be offered at all: it is derived from the items.
    expect(VERIFIED_RACKS.some((rack) => familyTypeMatches("wall", rack.category, rack.subCategory, rack.masterCode))).toBe(true);
  });

  it("reaches the Designer wall picker even when the supplier filed it as an accessory", () => {
    // What the palette actually merges: the wall-placement query, plus the
    // unfiltered master list and the accessory catalog as fallbacks.
    const wallPlacement = [PLAIN_WALL];
    const otherBuckets = [SKYLINE_3015, USCABINET_3018, USCABINET_3018_OPEN_DISPLAY];
    const palette = withWallWineRacks(wallPlacement, otherBuckets);

    for (const rack of VERIFIED_RACKS) {
      const found = palette.filter((item) => item.masterCode === rack.masterCode);
      expect(found, `${rack.masterCode} missing from the wall picker`).toHaveLength(1);
      expect(found[0].placement).toBe("wall");
    }
    // A rack merged twice (wall query + master list) must not double up.
    const duplicated = withWallWineRacks([SKYLINE_3015], [SKYLINE_3015, USCABINET_3018]);
    expect(duplicated.filter((item) => item.masterCode === "WRC3015")).toHaveLength(1);
  });

  it("is not refused by the Designer eligibility gate for being filed as an accessory", () => {
    for (const rack of VERIFIED_RACKS) {
      const label = `${rack.masterCode} (${rack.category})`;
      expect(isDesignerAccessoryItem(rack), label).toBe(false);
      expect(cabinetCanBeRenderedOrPlacedIn3d(rack), label).toBe(true);
    }
  });

  it("reaches the affiliate storefront Wall tab, whose API filter is exact-category", () => {
    // The categories this White Shaker line actually has, as the tab list shows.
    const lineCategories = ["Base", "Wall", "Tall", "Accessory", "Specialty / Wine Rack", "Accessories / Wine Storage"];

    const extras = wallTabExtraCategories("Wall", lineCategories);
    // The accessory/specialty buckets must be requested; Base must not.
    expect(extras).toContain("Specialty / Wine Rack");
    expect(extras).toContain("Accessories / Wine Storage");
    expect(extras).not.toContain("Base");

    // Nothing extra is requested on a tab other than Wall.
    expect(wallTabExtraCategories("Base", lineCategories)).toEqual([]);
    expect(wallTabExtraCategories(null, lineCategories)).toEqual([]);

    // The Wall tab response, plus what the extra buckets returned.
    const wallTabRows = [PLAIN_WALL];
    const extraRows = [USCABINET_3018, USCABINET_3018_OPEN_DISPLAY];
    const shown = mergeWallTabRacks(wallTabRows, extraRows);
    const codes = shown.map((item) => item.masterCode);
    expect(codes).toContain("W3018");
    expect(codes).toContain("WRC3018");
    expect(codes).toContain("WXR3018");
    // A non-rack accessory pulled for its category stays off the Wall tab.
    const filler = row({ masterCode: "F3", category: "Accessory", subCategory: "Filler" });
    expect(mergeWallTabRacks(wallTabRows, [filler]).map((item) => item.masterCode)).toEqual(["W3018"]);
  });

  it("is findable by SKU fragment and by the words \"wine rack\"", () => {
    const catalog = [PLAIN_WALL, ...VERIFIED_RACKS];

    for (const query of ["3015", "WRC3015", "3018", "WXR3018"]) {
      const hits = searchCatalogItems(catalog, query).map((hit) => hit.item.masterCode);
      expect(hits.length, `search "${query}" returned nothing`).toBeGreaterThan(0);
    }
    expect(searchCatalogItems(catalog, "3015").map((hit) => hit.item.masterCode)).toContain("WRC3015");
    expect(searchCatalogItems(catalog, "3018").map((hit) => hit.item.masterCode)).toEqual(
      expect.arrayContaining(["WRC3018", "WXR3018"]),
    );

    const byPhrase = searchCatalogItems(catalog, "wine rack", (item, query) => (
      `${item.masterCode} ${item.description ?? ""} ${item.subCategory ?? ""}`.toLowerCase().includes(query.toLowerCase())
    )).map((hit) => hit.item.masterCode);
    expect(byPhrase.length, 'search "wine rack" returned nothing').toBeGreaterThan(0);
  });
});

describe("issue #55: each line shows only the wine racks its catalog already sells", () => {
  // Dimensions and list prices are the live line-catalog values. The merge
  // must keep them and must not add a code the line did not return.
  const madisonWallPage = [
    { id: 1, masterCode: "W3018", category: "Wall", subCategory: "Bridge / Stacker", width: "30.00", height: "18.00", depth: "12.00", listPrice: "210.00" },
  ];
  const madisonRest = [
    {
      id: 9390348,
      masterCode: "WXR3018",
      category: "Wall",
      subCategory: "Wine Rack",
      description: "Wall X Rack Cabinet Kit — 30\" W x 18\" H x 12\" D (2 boxes)",
      width: "30.00",
      height: "18.00",
      depth: "12.00",
      listPrice: "402.00",
      homeownerPrice: "156.31",
    },
  ];
  const prestonLine = [
    {
      id: 9360166,
      masterCode: "WRC3015",
      category: "Wall",
      subCategory: "Wine Rack",
      description: "30\"X 15\" Wall Wine Rack Cabinet",
      width: "30.000",
      height: "15.000",
      depth: "12.000",
      listPrice: "340.00",
    },
    {
      id: 9360167,
      masterCode: "WRC3018",
      category: "Wall",
      subCategory: "Wine Rack / Open Display",
      description: "30\"X 18\" Wall Wine Rack Cabinet",
      width: "30.000",
      height: "18.000",
      depth: "12.000",
      listPrice: "355.00",
    },
    { id: 9, masterCode: "W3018", category: "Wall", subCategory: null, width: "30", height: "30", depth: "12", listPrice: "180.00" },
  ];

  it("loads the storefront page that SKU order places after the first 200 rows", () => {
    // Madison Shaker White's full line is 337 rows. Wall alone is 107, which
    // now fits in one 200-row page. View All still needs the next page.
    expect(storefrontCatalogOffsets(107)).toEqual([]);
    expect(storefrontCatalogOffsets(337)).toEqual([200]);
    expect(storefrontCatalogOffsets(60, 60)).toEqual([]);
    const shown = mergeStorefrontCatalogPages([madisonWallPage, madisonRest]);
    const rack = shown.find((item) => item.masterCode === "WXR3018");
    expect(rack).toMatchObject({ width: "30.00", height: "18.00", depth: "12.00", listPrice: "402.00", homeownerPrice: "156.31" });
    expect(shown.map((item) => item.masterCode)).not.toContain("WRC3015");
    expect(shown.map((item) => item.masterCode)).not.toContain("WRC3018");
  });

  it("puts the line's own racks on the catalog wall page without copying another line's codes", () => {
    const firstPage = [madisonWallPage[0]];
    const madisonShown = withWallWineRacks(firstPage, madisonRest);
    expect(madisonShown.map((item) => item.masterCode)).toEqual(["W3018", "WXR3018"]);
    expect(madisonShown.find((item) => item.masterCode === "WXR3018")).toMatchObject({
      width: "30.00",
      height: "18.00",
      depth: "12.00",
      listPrice: "402.00",
    });
    const prestonShown = withWallWineRacks(
      [{ id: 9, masterCode: "W3018", category: "Wall", width: "30", height: "30", depth: "12" }],
      prestonLine,
    );
    expect(prestonShown.map((item) => item.masterCode)).toEqual(["W3018", "WRC3015", "WRC3018"]);
    expect(prestonShown.find((item) => item.masterCode === "WRC3015")).toMatchObject({
      width: "30.000",
      height: "15.000",
      depth: "12.000",
      listPrice: "340.00",
    });
    expect(prestonShown.find((item) => item.masterCode === "WRC3018")).toMatchObject({
      width: "30.000",
      height: "18.000",
      depth: "12.000",
      listPrice: "355.00",
    });
    expect(prestonShown.map((item) => item.masterCode)).not.toContain("WXR3018");
    // A rack already on this page is not added a second time.
    expect(withWallWineRacks(prestonLine, prestonLine).filter((item) => item.masterCode === "WRC3015")).toHaveLength(1);
  });

  it("opens a designer wall section for the racks that line returned", () => {
    const madison = designerWallWineRackSections([...madisonWallPage, ...madisonRest]);
    expect(madison).toEqual([
      expect.objectContaining({
        label: "Wine Rack",
        items: [expect.objectContaining({ masterCode: "WXR3018", width: "30.00", height: "18.00", depth: "12.00", listPrice: "402.00" })],
      }),
    ]);
    const preston = designerWallWineRackSections(prestonLine);
    expect(preston.map((section) => section.label)).toEqual(["Wine Rack", "Wine Rack / Open Display"]);
    expect(preston.flatMap((section) => section.items.map((item) => item.masterCode))).toEqual(["WRC3015", "WRC3018"]);
    expect(designerWallWineRackSections(madisonWallPage)).toEqual([]);
  });
});

describe("issue #55: the wall-rack rules keep their false positives out", () => {
  it("does not treat WRC radius caps as wine racks", () => {
    // PR 59 matched every code starting with WRC, so these two became wall racks.
    for (const code of ["WRC18L", "WRC18R"]) {
      expect(isWallWineRackCabinet(row({ masterCode: code, category: "Wall", subCategory: "Radius Cap", description: "Wall Radius Cap" })), code).toBe(false);
    }
  });

  it("leaves the refrigerator wall, plain uppers, and other specialty boxes alone", () => {
    expect(isWallWineRackCabinet(row({ masterCode: "WR3624", category: "Wall", subCategory: "Refrigerator Wall", description: "Refrigerator wall cabinet" }))).toBe(false);
    expect(isWallWineRackCabinet(PLAIN_WALL)).toBe(false);
    expect(isWallWineRackCabinet(row({ masterCode: "PR3015", category: "Wall", subCategory: "Bridge / Stacker", description: "Wall Plate Rack Cabinet" }))).toBe(false);
    expect(isWallWineRackCabinet(row({ masterCode: "SPB9", category: "Specialty", subCategory: "Spice Pull-Out" }))).toBe(false);
  });

  it("keeps a BASE or TALL wine rack on its own tab", () => {
    // A real floor-standing wine rack is a cabinet, just not an upper.
    const baseRack = row({ masterCode: "BOWR30", category: "Base", subCategory: "Wine Rack", description: "Base w/ Wine Rack", placement: "base" });
    const tallRack = row({ masterCode: "WINEBIN-WALL", category: "Tall", subCategory: "Wine Storage", description: "Winebin-Tall", placement: "tall" });
    expect(isWallWineRackCabinet(baseRack)).toBe(false);
    expect(isWallWineRackCabinet(tallRack)).toBe(false);
    expect(withWallWineRacks([], [baseRack, tallRack])).toEqual([]);
    expect(familyTypeMatches("wall", baseRack.category, baseRack.subCategory, baseRack.masterCode)).toBe(false);
  });

  it("does not mistake a wine cooler or a glass holder for a rack box", () => {
    expect(isWallWineRackCabinet(row({ masterCode: "WINE-24", category: "Appliance", subCategory: "Wine Cooler", description: 'Wine Cooler 24"' }))).toBe(false);
    expect(isWallWineRackCabinet(row({ masterCode: "WGH30LSE", category: "Wall", subCategory: "Wine Glass Holder" }))).toBe(false);
  });
});

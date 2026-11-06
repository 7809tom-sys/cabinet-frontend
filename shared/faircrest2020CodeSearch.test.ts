import { describe, expect, it } from "vitest";
import { buildCodeIndex, matchCode } from "./codeMatch";
import { matchCabinetCodes } from "./cabinetCodeMatch";
import {
  catalogItemMatchesCode,
  searchCatalogItems,
} from "./catalogCodeSearch";
import { resolveFaircrest2020CatalogCode } from "./faircrest2020Aliases";

// A slice of the live catalog shape with the specialty rows this mapping is for.
const CATALOG = [
  {
    id: 1,
    masterCode: "WEOS0930",
    description: '9" x 30" Wall End Open Shelf',
    category: "Wall",
  },
  {
    id: 2,
    masterCode: "WEOS0936",
    description: '9" x 36" Wall End Open Shelf',
    category: "Wall",
  },
  {
    id: 3,
    masterCode: "LSB36",
    description: '36" Lazy Susan Corner Base',
    category: "Base",
  },
  {
    id: 4,
    masterCode: "BER36",
    description: '36" Pie-Cut Corner Base',
    category: "Base",
  },
  {
    id: 5,
    masterCode: "AG2418",
    description: '24" x 18" Appliance Garage Cabinet',
    category: "Wall",
  },
  {
    id: 6,
    masterCode: "B24",
    description: '24" Base 2 Doors 1 Drawer',
    category: "Base",
  },
  {
    id: 7,
    masterCode: "WBC2730",
    description: '27" x 30" Wall Blind Corner',
    category: "Wall",
  },
  {
    id: 8,
    masterCode: "BT9",
    description: '9" Tray Base Cabinet',
    category: "Base",
  },
  {
    id: 9,
    masterCode: "AW1230",
    description: '12" x 30" Wall Angle Cabinet',
    category: "Wall",
  },
];

describe("Faircrest 2020 codes in catalog search", () => {
  it("finds our wall open shelf by Faircrest's WOS code", () => {
    expect(
      searchCatalogItems(CATALOG, "WOS0930").map((hit) => hit.item.masterCode),
    ).toEqual(["WEOS0930"]);
    expect(
      searchCatalogItems(CATALOG, "WOS0936").map((hit) => hit.item.masterCode),
    ).toEqual(["WEOS0936"]);
  });

  it("finds our wall open shelf by the WOES misspelling", () => {
    expect(
      searchCatalogItems(CATALOG, "WOES0930").map((hit) => hit.item.masterCode),
    ).toEqual(["WEOS0930"]);
  });

  it("still finds our wall open shelf by our own code", () => {
    expect(
      searchCatalogItems(CATALOG, "WEOS0930").map((hit) => hit.item.masterCode),
    ).toEqual(["WEOS0930"]);
    expect(
      searchCatalogItems(CATALOG, "weos-09-30").map(
        (hit) => hit.item.masterCode,
      ),
    ).toEqual(["WEOS0930"]);
  });

  it("finds the flagged specialty rows by their Faircrest spelling", () => {
    // LS3612 is Faircrest's 36" lazy susan; the row is LSB36.
    expect(
      searchCatalogItems(CATALOG, "LS3612").map((hit) => hit.item.masterCode),
    ).toEqual(["LSB36"]);
    expect(
      searchCatalogItems(CATALOG, "LS3612-L").map((hit) => hit.item.masterCode),
    ).toEqual(["LSB36"]);
    // WBC2730-R is Faircrest's handed spelling of our unhanded WBC2730 row.
    expect(
      searchCatalogItems(CATALOG, "WBC2730-R").map(
        (hit) => hit.item.masterCode,
      ),
    ).toEqual(["WBC2730"]);
    expect(
      searchCatalogItems(CATALOG, "TB09").map((hit) => hit.item.masterCode),
    ).toEqual(["BT9"]);
    expect(
      searchCatalogItems(CATALOG, "WAC1230L").map((hit) => hit.item.masterCode),
    ).toEqual(["AW1230"]);
  });

  it("does not match a Faircrest size we do not sell", () => {
    // WOS1230 has no row of ours in this catalog slice.
    expect(searchCatalogItems(CATALOG, "WOS1230")).toEqual([]);
    // BBC42 is a needs-Tom row: it must not be guessed onto BBC36 or anything else.
    expect(searchCatalogItems(CATALOG, "BBC42")).toEqual([]);
  });

  it("never renames the row it matched", () => {
    const [hit] = searchCatalogItems(CATALOG, "WOS0930");
    expect(hit.item.masterCode).toBe("WEOS0930");
    expect(hit.item.description).toBe('9" x 30" Wall End Open Shelf');
  });

  it("keeps a normal code matching itself only", () => {
    expect(catalogItemMatchesCode(CATALOG[5], "B24")).toBe(true);
    expect(catalogItemMatchesCode(CATALOG[5], "WEOS0930")).toBe(false);
    expect(catalogItemMatchesCode(CATALOG[0], "B24")).toBe(false);
  });
});

describe("Faircrest 2020 codes in cart code matching", () => {
  it("resolves WOS0930 to the WEOS0930 catalog row", () => {
    const match = matchCode("WOS0930", buildCodeIndex(CATALOG));
    expect(match.matched).toBe(true);
    expect(match.masterCode).toBe("WEOS0930");
    expect(match.confidence).toBe("normalized");
  });

  it("resolves the LS3612 lazy susan by either hand", () => {
    for (const code of ["LS3612", "LS3612-L", "LS3612-R"]) {
      const match = matchCode(code, buildCodeIndex(CATALOG));
      expect(match.masterCode).toBe("LSB36");
    }
    expect(matchCode("LS3312", buildCodeIndex(CATALOG)).matched).toBe(false);
  });

  it("resolves a Faircrest blind corner hand to our unhanded row", () => {
    const match = matchCode("WBC2730-L", buildCodeIndex(CATALOG));
    expect(match.masterCode).toBe("WBC2730");
  });

  it("leaves an unconfirmed code unmatched instead of guessing", () => {
    for (const code of ["BBC42", "BBC45", "CSB36", "WRC3015", "SP09"]) {
      const match = matchCode(code, buildCodeIndex(CATALOG));
      expect(match.matched).toBe(false);
      expect(match.confidence).toBe("none");
    }
  });

  it("prefers a real master code over an alias", () => {
    // BER36 is both our master and the Faircrest code: the exact row wins.
    const match = matchCode("BER36", buildCodeIndex(CATALOG));
    expect(match.cabinetId).toBe(4);
    expect(match.confidence).toBe("exact");
  });

  it("works through the OCR photo-to-cart matcher too", () => {
    const results = matchCabinetCodes(
      [
        { code: "WOS0930", quantity: 2 },
        { code: "LS3612R", quantity: 1 },
        { code: "B24", quantity: 4 },
      ],
      CATALOG,
    );
    expect(results.map((result) => result.masterCode)).toEqual([
      "WEOS0930",
      "LSB36",
      "B24",
    ]);
    expect(results.map((result) => result.quantity)).toEqual([2, 1, 4]);
    expect(results.every((result) => result.matched)).toBe(true);
  });
});

describe("Faircrest aliasing never steals a real master", () => {
  it("keeps a row whose own code IS the Faircrest spelling", () => {
    // BER36 is our master code AND Faircrest's code, so the row stays exact.
    const catalog = [
      { id: 1, masterCode: "BER36", description: "36 pie-cut corner" },
      {
        id: 2,
        masterCode: "ERB36",
        description: "36 pie-cut corner, other spelling",
      },
    ];
    const hits = searchCatalogItems(catalog, "BER36");
    expect(hits[0]?.rank).toBe(0);
    expect(hits.map((hit) => hit.item.masterCode)).toEqual(["BER36", "ERB36"]);
    expect(matchCode("BER36", buildCodeIndex(catalog)).masterCode).toBe(
      "BER36",
    );
  });

  it("leaves a two-row ambiguity unresolved instead of picking one", () => {
    const catalog = [
      { id: 1, masterCode: "LSB36", description: "lazy susan" },
      { id: 2, masterCode: "LS36", description: "lazy susan, other spelling" },
    ];
    expect(resolveFaircrest2020CatalogCode("LS3612", catalog)).toBeNull();
    // A code that IS a row's own master still resolves, to that row.
    expect(resolveFaircrest2020CatalogCode("LS36", catalog)?.id).toBe(2);
  });
});

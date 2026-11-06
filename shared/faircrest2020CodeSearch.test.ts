import { describe, expect, it } from "vitest";
import { buildCodeIndex, matchCode } from "./codeMatch";
import { matchCabinetCodes } from "./cabinetCodeMatch";
import {
  catalogItemMatchesCode,
  searchCatalogItems,
} from "./catalogCodeSearch";
import {
  faircrest2020MasterCode,
  resolveFaircrest2020CatalogCode,
} from "./faircrest2020Aliases";

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
    // WBC2430-R is Faircrest's 24/27 band spelling of our unhanded WBC2730 row
    // (Tom mapped the 27" wall blind corners onto the 24/27 band).
    expect(
      searchCatalogItems(CATALOG, "WBC2430-R").map(
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
    // BBC42 has no Faircrest equivalent (Tom), so it must not be guessed onto
    // BBC36 or any BCB42 code either.
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

  it("resolves ER36 / ER 36 / ER-36 to the BER36 row", () => {
    const index = buildCodeIndex(CATALOG);
    for (const code of ["ER36", "ER 36", "ER-36", "er36", "ER36-L", "ER36-R"]) {
      const match = matchCode(code, index);
      expect(match.matched).toBe(true);
      expect(match.masterCode).toBe("BER36");
      expect(match.confidence).toBe("normalized");
    }
    // ER33 is still an open question, so it must not be guessed onto BER36.
    expect(matchCode("ER33", index).matched).toBe(false);
    expect(
      searchCatalogItems(CATALOG, "ER-36").map((hit) => hit.item.masterCode),
    ).toEqual(["BER36"]);
  });

  it("resolves an LS3612 / LS36 cart line to the lazy susan row", () => {
    const index = buildCodeIndex(CATALOG);
    for (const code of ["LS3612", "LS36", "LS-36", "LS3612-R"]) {
      expect(matchCode(code, index).masterCode).toBe("LSB36");
    }
  });

  it("resolves every full-height base 9 spelling to whichever row the line sells", () => {
    // A line that sells BT9 (330011) and one that sells BT9FH (540005) must not
    // cross: each line's own row wins, because this is a lookup alias only.
    const bt9Line = [{ id: 1, masterCode: "BT9", description: "9 tray base" }];
    const bt9fhLine = [
      { id: 2, masterCode: "BT9FH", description: "9 full height base" },
    ];
    for (const code of ["BFH9", "B9FH", "BT9", "BT09", "TB9", "TB09"]) {
      expect(matchCode(code, buildCodeIndex(bt9Line)).masterCode).toBe("BT9");
      expect(matchCode(code, buildCodeIndex(bt9fhLine)).masterCode).toBe(
        "BT9FH",
      );
    }
    // BT9PO never collapses into the full-height family: with its own row
    // present it resolves to itself, and it is not in the TB09 alias group.
    const withPo = [
      ...bt9Line,
      {
        id: 3,
        masterCode: "BT9PO",
        description: '9" Base with Spice Rack Pullout',
      },
    ];
    expect(matchCode("BT9PO", buildCodeIndex(withPo)).masterCode).toBe("BT9PO");
    expect(faircrest2020MasterCode("BT9PO")).toBeNull();
  });

  it("does not resolve SPO9 onto BT9PO", () => {
    const catalog = [
      {
        id: 1,
        masterCode: "BT9PO",
        description: '9" Base with Spice Rack Pullout',
      },
      { id: 2, masterCode: "BT9", description: '9" Tray Base Cabinet' },
    ];
    expect(resolveFaircrest2020CatalogCode("SPO9", catalog)).toBeNull();
    expect(matchCode("SPO9", buildCodeIndex(catalog)).masterCode).not.toBe(
      "BT9PO",
    );
    // The spice unit's own code still matches itself when the row exists.
    const withSpo9 = [
      ...catalog,
      { id: 3, masterCode: "SPO9", description: "9 Spice Pullout" },
    ];
    expect(matchCode("SPO9", buildCodeIndex(withSpo9)).masterCode).toBe("SPO9");
  });

  it("resolves wall easy reach spellings onto the WER row", () => {
    const catalog = [
      { id: 1, masterCode: "WER2436", description: "24x36 wall easy reach" },
    ];
    for (const code of [
      "WER2436",
      "ER2436",
      "ERW2436",
      "ER 2436",
      "WER2436-L",
    ]) {
      expect(matchCode(code, buildCodeIndex(catalog)).masterCode).toBe(
        "WER2436",
      );
    }
    // No 35/40 inch Faircrest counterpart, so those never match.
    expect(matchCode("WER2435", buildCodeIndex(catalog)).matched).toBe(false);
    expect(matchCode("ER2435", buildCodeIndex(catalog)).matched).toBe(false);
  });

  it("leaves an unconfirmed code unmatched instead of guessing", () => {
    for (const code of ["BBC42", "WRC3015", "SP09"]) {
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

  it("keeps WRC3015 on its OWN priced row after the LWR3015 alias (Tom)", () => {
    // 0230 split these two so Skyline's WRC3015 keeps its own supplier prices.
    // The Faircrest alias must never move a code off its priced row.
    const catalog = [
      {
        id: 1,
        masterCode: "WRC3015",
        description: "Skyline 30x15 wall wine rack",
      },
      {
        id: 2,
        masterCode: "LWR3015",
        description: "Ashford lattice wine rack",
      },
    ];
    const index = buildCodeIndex(catalog);
    // The code still resolves to itself, exactly, never to LWR3015.
    const match = matchCode("WRC3015", index);
    expect(match.matched).toBe(true);
    expect(match.cabinetId).toBe(1);
    expect(match.masterCode).toBe("WRC3015");
    expect(match.confidence).toBe("exact");
    // The lookup helper agrees: an exact master code always wins.
    expect(resolveFaircrest2020CatalogCode("WRC3015", catalog)?.id).toBe(1);
    expect(resolveFaircrest2020CatalogCode("LWR3015", catalog)?.id).toBe(2);
    // Search ranks WRC3015 first for its own code: no alias steals the hit.
    expect(
      searchCatalogItems(catalog, "WRC3015").map((hit) => hit.item.masterCode),
    ).toEqual(["WRC3015"]);
    // Only the Faircrest question answers LWR3015; the sellable code does not.
    expect(faircrest2020MasterCode("WRC3015")).toBe("LWR3015");
    expect(matchCode("WRC3015", index).masterCode).not.toBe("LWR3015");
  });
});

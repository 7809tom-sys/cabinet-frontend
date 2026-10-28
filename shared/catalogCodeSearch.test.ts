import { describe, expect, it } from "vitest";
import { matchCabinetCodes } from "./cabinetCodeMatch";
import { CATALOG_SEARCH_RANK, catalogItemMatchesCode, searchCatalogItems } from "./catalogCodeSearch";
import { matchCode, buildCodeIndex } from "./codeMatch";

const BT9_ALIASES = "B9; BFH9; BT-09; BT09; BSR9; FHB09; FHBO9; TBO9; FH9";

const tray = {
  id: 1,
  masterCode: "BT9",
  description: "9\" Tray Base Cabinet",
  category: "Base",
  subCategory: "Full height",
  aliases: BT9_ALIASES,
};

const partial = {
  id: 2,
  masterCode: "BT9PO",
  description: "BT9 pull-out",
  aliases: "",
};

const other = {
  id: 3,
  masterCode: "W3030",
  description: "Wall cabinet",
  aliases: "WALL30",
};

describe("catalog code search", () => {
  it("returns BT9 when the shopper types an alias such as FH9 or BT-09", () => {
    const items = [other, tray, partial];
    expect(searchCatalogItems(items, "FH9").map((hit) => hit.item.masterCode)).toEqual(["BT9"]);
    expect(searchCatalogItems(items, "BT-09").map((hit) => hit.item.masterCode)).toEqual(["BT9"]);
    expect(searchCatalogItems(items, "bt09").map((hit) => hit.item.masterCode)).toEqual(["BT9"]);
    expect(searchCatalogItems(items, "BT09").map((hit) => hit.item.masterCode)).toEqual(["BT9"]);
    expect(searchCatalogItems(items, "fhb 09").map((hit) => hit.item.masterCode)).toEqual(["BT9"]);
  });

  it("ranks an exact item code ahead of an exact alias and a partial code", () => {
    const aliasOwner = {
      id: 4,
      masterCode: "B15",
      description: "Base 15",
      aliases: ["BT9"],
    };
    const hits = searchCatalogItems([partial, aliasOwner, tray], "BT9");
    expect(hits.map((hit) => hit.item.masterCode)).toEqual(["BT9", "B15", "BT9PO"]);
    expect(hits.map((hit) => hit.rank)).toEqual([
      CATALOG_SEARCH_RANK.exactItem,
      CATALOG_SEARCH_RANK.exactAlias,
      CATALOG_SEARCH_RANK.partialCode,
    ]);
  });

  it("resolves an alias that equals a row's ReplacementMasterCode to the master", () => {
    const replaced = {
      id: 10,
      masterCode: "B9",
      replacementMasterCode: "BT9",
      description: "Retired tray code",
      aliases: "BT9; FH9",
    };
    const master = {
      id: 11,
      masterCode: "BT9",
      description: "9\" Tray Base Cabinet",
      aliases: "BT-09; B9",
    };
    expect(searchCatalogItems([replaced, other, master], "FH9").map((hit) => hit.item)).toEqual([master]);
    expect(searchCatalogItems([replaced, other, master], "BT9").map((hit) => hit.item.masterCode)).toEqual(["BT9"]);
    expect(searchCatalogItems([replaced, other, master], "B9").map((hit) => hit.item.masterCode)).toEqual(["BT9"]);
    expect(searchCatalogItems([replaced, other, master], "BT-09")[0]?.item.masterCode).toBe("BT9");
  });

  it("sends an alias that equals another row's ReplacementMasterCode to that master", () => {
    const unrelated = { id: 20, masterCode: "X1", description: "Other", aliases: "BT9" };
    const replaced = { id: 10, masterCode: "OLD", replacementMasterCode: "BT9", description: "Retired", aliases: "" };
    const master = { id: 11, masterCode: "BT9", description: "Tray", aliases: "FH9" };
    expect(searchCatalogItems([unrelated, replaced, master], "BT9").map((hit) => hit.item.masterCode)).toEqual(["BT9"]);
    expect(searchCatalogItems([unrelated, replaced, master], "OLD").map((hit) => hit.item.masterCode)).toEqual(["BT9"]);
    expect(searchCatalogItems([unrelated, replaced, master], "FH9").map((hit) => hit.item.masterCode)).toEqual(["BT9"]);
  });

  it("does not treat BT09 as BT9 unless that alias is actually listed", () => {
    expect(catalogItemMatchesCode({ masterCode: "BT9", aliases: "" }, "BT09")).toBe(false);
    expect(catalogItemMatchesCode({ masterCode: "BT9", aliases: "BT-09" }, "BT 09")).toBe(true);
  });

  it("matches a SKU fragment, including a line prefix, and a multi-word description", () => {
    const items = [
      { masterCode: "DN-WRC3015", description: "Wall Wine Rack Cabinet" },
      { masterCode: "LWR3015", description: "Lattice Wine Rack" },
      { masterCode: "PR3015", description: "Wall Plate Rack Cabinet" },
      { masterCode: "W3015", description: "Wall Cabinet" },
      { masterCode: "B24", description: "Base cabinet" },
    ];
    const text = (item: { description?: string }, query: string) =>
      (item.description ?? "").toLowerCase().includes(query.toLowerCase());
    expect(searchCatalogItems(items, "3015", text).map((hit) => hit.item.masterCode)).toEqual([
      "DN-WRC3015",
      "LWR3015",
      "PR3015",
      "W3015",
    ]);
    expect(searchCatalogItems(items, "wine rack", text).map((hit) => hit.item.masterCode)).toEqual([
      "DN-WRC3015",
      "LWR3015",
    ]);
    expect(searchCatalogItems(items, "WINE RACK", text).map((hit) => hit.item.description)).toEqual([
      "Wall Wine Rack Cabinet",
      "Lattice Wine Rack",
    ]);
  });

  it("keeps description matches and the original order when nothing was typed", () => {
    const items = [tray, other];
    expect(searchCatalogItems(items, "").map((hit) => hit.item)).toEqual(items);
    expect(searchCatalogItems(items, "wall", (item, query) => (item.description ?? "").toLowerCase().includes(query.toLowerCase()))
      .map((hit) => hit.item.masterCode)).toEqual(["W3030"]);
  });

  it("resolves alias codes in single-code matchers used by order entry and photo import", () => {
    const records = [
      { id: 1, masterCode: "BT9", description: "Tray base", category: "Base", aliases: BT9_ALIASES },
      { id: 2, masterCode: "B9", description: "Retired", category: "Base", replacementMasterCode: "BT9", aliases: "FH9" },
    ];
    const index = buildCodeIndex(records);
    expect(matchCode("FH9", index).masterCode).toBe("BT9");
    expect(matchCode("BT-09", index).masterCode).toBe("BT9");
    expect(matchCode("B9", index).masterCode).toBe("BT9");
    expect(matchCode("BT9", index)).toMatchObject({ masterCode: "BT9", confidence: "exact" });

    const ocr = matchCabinetCodes(
      [{ code: "bt09", quantity: 2 }, { code: "FH9", quantity: 1 }],
      records.map((row) => ({ ...row, description: row.description, category: row.category })),
    );
    expect(ocr.map((row) => row.masterCode)).toEqual(["BT9", "BT9"]);
  });

  it("matches alternate SKU columns and array aliases without a separate alias table", () => {
    const row = { masterCode: "SB36", sku: "SINK36", vendorSku: null, altSku1: "SB-36", altSku2: "", altSku3: null, aliasCodes: ["FARM36"] };
    expect(catalogItemMatchesCode(row, "sink36")).toBe(true);
    expect(catalogItemMatchesCode(row, "SB 36")).toBe(true);
    expect(searchCatalogItems([row], "farm-36")[0]?.rank).toBe(CATALOG_SEARCH_RANK.exactAlias);
  });
});

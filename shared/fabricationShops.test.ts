import { describe, expect, it } from "vitest";
import {
  fabShopStateFromFileName,
  guessFabShopColumnMapping,
  mapFabShopRows,
  matchFabShopsForZip,
  parseFabShopAddress,
  planFabShopImport,
} from "./fabricationShops";

const HEADERS = ["name", "region", "city", "address", "phone", "website", "google_rating", "review_count", "fabricator_confidence", "source"];

describe("fabrication shop upload", () => {
  it("maps the Florida list headers", () => {
    const mapping = guessFabShopColumnMapping(HEADERS);
    expect(mapping).toMatchObject({ name: 0, region: 1, city: 2, address: 3, phone: 4, website: 5, googleRating: 6, reviewCount: 7, confidence: 8, source: 9 });
    const [row] = mapFabShopRows([["Edge Stone", "Central FL", "Apopka", "2525 Clarcona Rd, Apopka, FL 32703", "(407) 260-5005", "https://x.com/", "4.9", "49", "medium", "web"]], mapping);
    expect(row).toMatchObject({ name: "Edge Stone", confidence: "medium" });
    expect(row?.zip).toBeUndefined();
  });

  it("reads state and ZIP from the address", () => {
    expect(parseFabShopAddress("2525 Clarcona Rd, Apopka, FL 32703")).toEqual({ state: "FL", zip: "32703" });
    expect(parseFabShopAddress("1716 Olive St, Lakeland, FL")).toEqual({ state: "FL", zip: null });
    expect(parseFabShopAddress("")).toEqual({ state: null, zip: null });
  });

  it("reads the state from the file name", () => {
    expect(fabShopStateFromFileName("Countertop Fabrication Shops in Florida.csv")).toBe("FL");
    expect(fabShopStateFromFileName("fab_shops_GA.xlsx")).toBe("GA");
  });

  it("plans an import: ZIP from city, duplicates and hidden names skipped", () => {
    const plan = planFabShopImport([
      { name: "Edge Stone", city: "Lakeland", address: "1 A St, Lakeland, FL 33801", website: "edge.com" },
      { name: "Olive Stone", city: "Lakeland", address: "1716 Olive St, Lakeland, FL" },
      { name: "Edge Stone LLC", city: "Lakeland", address: "9 B St, Lakeland, FL 33801" },
      { name: "Other Name", city: "Lakeland", address: "1 C St, Lakeland, FL 33803", website: "https://www.edge.com/about" },
      { name: "Edge Stone Tampa", city: "Tampa", address: "1 C St, Tampa, FL 33602", website: "https://www.edge.com/tampa" },
      { name: "Pelican Tops", city: "Tampa", address: "1 D St, Tampa, FL 33602" },
      { name: "No State Co", city: "Nowhere" },
      { name: "Saved Shop", city: "Ocala", address: "1 E St, Ocala, FL 34470" },
      { name: "", city: "Ocala" },
    ], [{ name: "Saved Shop", zip: "34470", city: "Ocala", state: "FL", website: null }], { sourceDoc: "test" });
    expect(plan.toInsert.map((shop) => [shop.name, shop.zip, shop.zipSource])).toEqual([
      ["Edge Stone", "33801", "address"],
      ["Olive Stone", "33801", "city"],
      ["Edge Stone Tampa", "33602", "address"],
    ]);
    expect(plan.zipFromCity).toBe(1);
    expect(plan.duplicates.map((d) => [d.name, d.where])).toEqual([
      ["Edge Stone LLC", "in_file"],
      ["Other Name", "in_file"],
      ["Saved Shop", "in_list"],
    ]);
    expect(plan.skipped.map((s) => s.reason)).toEqual(["hidden_brand", "missing_state", "missing_name"]);
    expect(plan.byState).toEqual([{ state: "FL", toImport: 3, duplicates: 3, withZip: 3 }]);
  });

  it("uses the default state when the file has none", () => {
    const plan = planFabShopImport([{ name: "A", city: "X" }], [], { sourceDoc: "t", defaultState: "Florida" });
    expect(plan.toInsert[0]).toMatchObject({ state: "FL", zip: null });
    expect(plan.noZip).toBe(1);
  });
});

describe("matching a quote ZIP to shops", () => {
  const shops = [
    { id: 1, state: "FL", zip: "32801", confidence: "medium" }, // Orlando
    { id: 2, state: "FL", zip: "32803", confidence: "high" }, // Orlando
    { id: 3, state: "FL", zip: "33602", confidence: "high" }, // Tampa (~80 mi)
    { id: 4, state: "FL", zip: "32301", confidence: "high" }, // Tallahassee
    { id: 5, state: "FL", zip: "32804", confidence: "high", isActive: false },
    { id: 6, state: "FL", zip: null, confidence: "high" },
  ];

  it("lists the exact ZIP first, then nearest within the radius", () => {
    const matches = matchFabShopsForZip("32801", shops);
    expect(matches.map((m) => [m.shop.id, m.method])).toEqual([[1, "same_zip"], [2, "distance"]]);
    expect(matches[1]!.distanceMiles).toBe(0);
  });

  it("widens with the radius and respects the limit", () => {
    expect(matchFabShopsForZip("32801", shops, { radiusMiles: 120 }).map((m) => m.shop.id)).toEqual([1, 2, 3]);
    expect(matchFabShopsForZip("32801", shops, { radiusMiles: 120, limit: 2 }).map((m) => m.shop.id)).toEqual([1, 2]);
  });

  it("falls back to same-state shops when none are near", () => {
    const matches = matchFabShopsForZip("32301-1234", shops.filter((s) => s.id !== 4), { radiusMiles: 10, state: "FL" });
    expect(matches.length).toBe(4);
    expect(matches.every((m) => m.method === "state")).toBe(true);
    expect(matches.map((m) => m.shop.id)).not.toContain(5);
    expect(matchFabShopsForZip("32301", shops.filter((s) => s.id !== 4), { radiusMiles: 10 })).toEqual([]);
  });

  it("returns nothing without a usable ZIP or for a state with no shops", () => {
    expect(matchFabShopsForZip(null, shops)).toEqual([]);
    expect(matchFabShopsForZip("abc", shops)).toEqual([]);
    expect(matchFabShopsForZip("30301", shops)).toEqual([]);
  });
});

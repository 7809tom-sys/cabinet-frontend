import { describe, expect, it } from "vitest";
import {
  buildCabinetShopDeal,
  cabinetShopRowState,
  guessCabinetShopColumnMapping,
  mapCabinetShopRows,
  normalizeShopWebsite,
  planCabinetShopImport,
  shopWebsiteKey,
  stateFromFileName,
} from "./crmCabinetShopImport";

const LIBRARY_HEADERS = ["name", "region", "city", "address", "phone", "website", "google_rating", "review_count", "type", "brands_carried", "rta_competitor", "confidence", "source"];
const opts = { marker: "cabinet_shop_list_2026-11-24", sourceDoc: "Cabinet Shops in Florida (affiliate library)" };

describe("column mapping", () => {
  it("maps every affiliate library column", () => {
    expect(guessCabinetShopColumnMapping(LIBRARY_HEADERS)).toEqual({
      name: 0, region: 1, city: 2, address: 3, phone: 4, website: 5, googleRating: 6, reviewCount: 7,
      type: 8, brandsCarried: 9, rtaCompetitor: 10, confidence: 11, source: 12,
    });
  });

  it("maps rows to trimmed fields and drops blanks", () => {
    const mapping = guessCabinetShopColumnMapping(["Name", "State", "Website"]);
    expect(mapCabinetShopRows([["  Acme  Cabinets ", "ga", ""]], mapping)).toEqual([{ name: "Acme Cabinets", state: "ga" }]);
  });
});

describe("state and website", () => {
  it("takes the State column, then the address ZIP, then the default", () => {
    expect(cabinetShopRowState({ state: "Georgia" })).toBe("GA");
    expect(cabinetShopRowState({ address: "974 Explorer Cv Ste 112, Altamonte Springs, FL 32701" })).toBe("FL");
    expect(cabinetShopRowState({ address: "no zip" }, "FL")).toBe("FL");
    expect(cabinetShopRowState({})).toBeNull();
  });

  it("reads the state from library file names", () => {
    expect(stateFromFileName("Cabinet Shops in Florida.xlsx")).toBe("FL");
    expect(stateFromFileName("1795572077452_Cabinet_Shops_in_Florida_63a0cee6.xlsx")).toBe("FL");
    expect(stateFromFileName("Cabinet Shops in New York.csv")).toBe("NY");
    expect(stateFromFileName("shops.csv")).toBeNull();
  });

  it("normalizes websites and their match key", () => {
    expect(normalizeShopWebsite("www.ckdflorida.com")).toBe("https://www.ckdflorida.com/");
    expect(normalizeShopWebsite("not a site")).toBeNull();
    expect(shopWebsiteKey("http://WWW.Example.com/about")).toBe("example.com");
  });
});

describe("buildCabinetShopDeal", () => {
  it("writes the distributor-style notes the CRM card parses, with no made-up site scores", () => {
    const deal = buildCabinetShopDeal({
      name: "American Kitchens, Inc. - Orlando", region: "Central FL", city: "Altamonte Springs",
      address: "974 Explorer Cv Ste 112, Altamonte Springs, FL 32701", phone: "(407) 645-3235",
      website: "http://www.americankitchensfl.com", type: "mixed", brandsCarried: "Cambria (quartz); US Cabinet Depot",
      confidence: "high", source: "Cambria dealer locator",
    }, "FL", opts);
    expect(deal.company).toBe("Cabinet shop prospect");
    expect(deal.title).toBe("Cabinet shop prospect — American Kitchens, Inc. - Orlando (Altamonte Springs, FL)");
    expect(deal.location).toBe("Altamonte Springs, FL");
    expect(deal.notes.split("\n")).toEqual([
      "cabinet_shop_list_2026-11-24",
      "Location: Altamonte Springs, FL | State: FL | Region: Central FL",
      "Address: 974 Explorer Cv Ste 112, Altamonte Springs, FL 32701",
      "Business type: mixed",
      "Website: http://www.americankitchensfl.com/",
      "Phone: (407) 645-3235",
      "Brands carried: Cambria (quartz)",
      "Confidence: high",
      "Source library doc: Cabinet Shops in Florida (affiliate library)",
      "Source: Cambria dealer locator",
    ]);
    expect(deal.notes).not.toMatch(/Site quality|PageSpeed|Platform/);
  });

  it("writes site stats only when the file has them", () => {
    const deal = buildCabinetShopDeal({ name: "X", siteQuality: "6", mobilePageSpeed: "62/100", platform: "Wix" }, "GA", opts);
    expect(deal.notes).toContain("Platform: Wix\nSite quality: 6/10 | Mobile PageSpeed: 62/100");
  });
});

describe("planCabinetShopImport", () => {
  const rows = [
    { name: "Acme Cabinets", address: "1 Main St, Tampa, FL 33601", website: "acme.com" },
    { name: "ACME cabinets", address: "9 Other St, Tampa, FL 33602" }, // same name + state in file
    { name: "Peach Cabinets", state: "GA", website: "https://www.peach.com" },
    { name: "Peach Kitchens", state: "GA", website: "http://peach.com/kitchens" }, // same website in file
    { name: "Old Shop", state: "FL" }, // already in CRM by name + state
    { name: "Site Shop", state: "FL", website: "known.com" }, // already in CRM by website
    { name: "", state: "FL" },
    { name: "No State Shop" },
    { name: "The Cabinet Nest by Pelican", state: "FL" },
    { name: "Bama Cabinets", state: "AL" },
  ];
  const existing = [
    { contactName: "Old Shop", notes: "cabinet_shop_list_2026-11-24\nLocation: Ocala, FL | State: FL" },
    { contactName: "Somebody", notes: "cabinet_shop_list_2026-11-24\nState: FL\nWebsite: https://www.known.com/" },
  ];

  it("imports new shops, skips duplicates by name+state or website, and counts per state FL, GA first", () => {
    const plan = planCabinetShopImport(rows, existing, opts);
    expect(plan.toInsert.map((d) => d.contactName)).toEqual(["Acme Cabinets", "Peach Cabinets", "Bama Cabinets"]);
    expect(plan.duplicates.map((d) => [d.name, d.where, d.match])).toEqual([
      ["ACME cabinets", "in_file", "name_state"],
      ["Peach Kitchens", "in_file", "website"],
      ["Old Shop", "in_crm", "name_state"],
      ["Site Shop", "in_crm", "website"],
    ]);
    expect(plan.skipped.map((s) => s.reason)).toEqual(["missing_name", "missing_state", "hidden_brand"]);
    expect(plan.skipped[2].name).toBe("(hidden)");
    expect(plan.byState).toEqual([
      { state: "FL", toImport: 1, duplicates: 3 },
      { state: "GA", toImport: 1, duplicates: 1 },
      { state: "AL", toImport: 1, duplicates: 0 },
    ]);
  });

  it("is idempotent: re-planning against what it would insert adds nothing", () => {
    const first = planCabinetShopImport(rows, existing, opts);
    const second = planCabinetShopImport(rows, [...existing, ...first.toInsert], opts);
    expect(second.toInsert).toEqual([]);
  });

  it("uses the default state for rows without one", () => {
    const plan = planCabinetShopImport([{ name: "No State Shop" }], [], { ...opts, defaultState: "Florida" });
    expect(plan.toInsert[0].state).toBe("FL");
  });
});

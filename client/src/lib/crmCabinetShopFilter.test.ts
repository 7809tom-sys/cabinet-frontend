import { describe, expect, it } from "vitest";
import {
  cabinetShopState,
  compareCabinetShopStates,
  countCabinetShopsByState,
  filterCabinetShopProspects,
  filterCabinetShopsByState,
  isCabinetShopProspect,
} from "./crmCabinetShopFilter";
import { isDistributorProspect } from "./crmDistributorFilter";

const flNote = "cabinet_shop_list_2026-11-24\nLocation: Altamonte Springs, FL | State: FL | Region: Central FL\nWebsite: https://www.example.com";

describe("isCabinetShopProspect", () => {
  it("matches the company tag in any case", () => {
    expect(isCabinetShopProspect({ company: "Cabinet shop prospect" })).toBe(true);
    expect(isCabinetShopProspect({ company: "  CABINET SHOP PROSPECT " })).toBe(true);
  });

  it("matches any cabinet shop list marker in notes, including later state batches", () => {
    expect(isCabinetShopProspect({ company: "Acme", notes: flNote })).toBe(true);
    expect(isCabinetShopProspect({ company: null, notes: "cabinet_shop_list_2026-12-02\nState: GA" })).toBe(true);
  });

  it("leaves regular contacts and distributors out, and distributors don't pick up shops", () => {
    expect(isCabinetShopProspect({ company: "Smith Remodeling", notes: "Wants a quote" })).toBe(false);
    expect(isCabinetShopProspect({ company: "Distributor prospect", notes: "distributor_master_list_2026-11-24" })).toBe(false);
    expect(isCabinetShopProspect({ company: null, notes: null })).toBe(false);
    expect(isDistributorProspect({ company: "Cabinet shop prospect", notes: flNote })).toBe(false);
  });
});

describe("cabinetShopState", () => {
  it("reads the State: line", () => {
    expect(cabinetShopState(flNote)).toBe("FL");
    expect(cabinetShopState("State: ga")).toBe("GA");
    expect(cabinetShopState("no state here")).toBeNull();
    expect(cabinetShopState(null)).toBeNull();
  });
});

describe("state ordering and counts", () => {
  it("puts FL then GA first, other states A to Z, unknown last", () => {
    expect(["TX", null, "GA", "AL", "FL"].sort(compareCabinetShopStates)).toEqual(["FL", "GA", "AL", "TX", null]);
  });

  it("counts shops per state in working order", () => {
    const deals = [
      { company: "Cabinet shop prospect", notes: "State: GA" },
      { company: "Cabinet shop prospect", notes: flNote },
      { company: "Cabinet shop prospect", notes: flNote },
      { company: "Homeowner", notes: "State: FL" },
      { company: "Cabinet shop prospect", notes: "State: AL" },
    ];
    expect(countCabinetShopsByState(deals)).toEqual([
      { state: "FL", count: 2 },
      { state: "GA", count: 1 },
      { state: "AL", count: 1 },
    ]);
  });

  it("filters prospects and narrows by state", () => {
    const deals = [
      { id: 1, company: "Cabinet shop prospect", notes: flNote },
      { id: 2, company: "Homeowner", notes: null },
      { id: 3, company: "Cabinet shop prospect", notes: "State: GA" },
      { id: 4, company: "Cabinet shop prospect", notes: "" },
    ];
    const shops = filterCabinetShopProspects(deals);
    expect(shops.map((d) => d.id)).toEqual([1, 3, 4]);
    expect(filterCabinetShopsByState(shops, "all").map((d) => d.id)).toEqual([1, 3, 4]);
    expect(filterCabinetShopsByState(shops, "GA").map((d) => d.id)).toEqual([3]);
    expect(filterCabinetShopsByState(shops, "unknown").map((d) => d.id)).toEqual([4]);
  });
});

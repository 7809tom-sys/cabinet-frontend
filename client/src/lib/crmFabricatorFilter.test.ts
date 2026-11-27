import { describe, expect, it } from "vitest";
import {
  countFabricatorsByState,
  fabricatorState,
  filterFabricatorProspects,
  filterFabricatorsByState,
  isFabricatorProspect,
  resolveFabricatorState,
} from "./crmFabricatorFilter";

const deal = (id: number, company: string | null, notes: string | null) => ({ id, company, notes });

describe("isFabricatorProspect", () => {
  it("matches the fabricator prospect company tag, any case", () => {
    expect(isFabricatorProspect({ company: "Fabricator prospect - Vantier" })).toBe(true);
    expect(isFabricatorProspect({ company: "  fabricator PROSPECT - Acme Stone " })).toBe(true);
  });

  it("matches the list marker in notes", () => {
    expect(isFabricatorProspect({ company: "Acme", notes: "fabricator_list_2026-11-26 | State: FL" })).toBe(true);
  });

  it("leaves everyone else out", () => {
    expect(isFabricatorProspect({ company: "Smith Remodeling", notes: "Wants a quote" })).toBe(false);
    expect(isFabricatorProspect({ company: "Distributor prospect" })).toBe(false);
    expect(isFabricatorProspect({ company: "Cabinet shop prospect" })).toBe(false);
    expect(isFabricatorProspect({ company: null, notes: null })).toBe(false);
  });
});

describe("fabricator state", () => {
  it("reads the State line out of the import note", () => {
    expect(fabricatorState("fabricator_list_2026-11-26 | State: FL | 12 Main St")).toBe("FL");
    expect(fabricatorState("State: ga")).toBe("GA");
    expect(fabricatorState("no state here")).toBeNull();
    expect(fabricatorState(null)).toBeNull();
  });

  it("counts by state, FL first", () => {
    const deals = [
      deal(1, "Fabricator prospect - A", "fabricator_list_2026-11-26 | State: GA"),
      deal(2, "Fabricator prospect - B", "fabricator_list_2026-11-26 | State: FL"),
      deal(3, "Fabricator prospect - C", "fabricator_list_2026-11-26 | State: FL"),
      deal(4, "Homeowner", null),
    ];
    expect(countFabricatorsByState(deals)).toEqual([
      { state: "FL", count: 2 },
      { state: "GA", count: 1 },
    ]);
  });

  it("filters to one state and keeps everything for all", () => {
    const deals = [
      deal(1, "Fabricator prospect - A", "State: GA"),
      deal(2, "Fabricator prospect - B", "State: FL"),
    ];
    expect(filterFabricatorsByState(deals, "FL").map((d) => d.id)).toEqual([2]);
    expect(filterFabricatorsByState(deals, "all").map((d) => d.id)).toEqual([1, 2]);
  });

  it("falls back to the first state with shops", () => {
    const states = [{ state: "FL", count: 2 }, { state: "GA", count: 1 }];
    expect(resolveFabricatorState(null, states)).toBe("FL");
    expect(resolveFabricatorState("GA", states)).toBe("GA");
    expect(resolveFabricatorState("TX", states)).toBe("FL");
    expect(resolveFabricatorState(null, [])).toBe("all");
  });
});

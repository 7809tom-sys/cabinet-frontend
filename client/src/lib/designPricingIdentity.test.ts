import { describe, expect, it } from "vitest";
import { activeCatalogPricingIdsByMasterCode, currentCatalogPricingCabinetId } from "./designPricingIdentity";

describe("currentCatalogPricingCabinetId", () => {
  it("uses the active catalog record with the exact saved master code", () => {
    expect(currentCatalogPricingCabinetId(
      { cabinetId: 1001, masterCode: "SB-33" },
      new Map([["SB-33", 9390063]]),
    )).toBe(9390063);
  });

  it("keeps the saved cabinet identity when no exact active master-code match exists", () => {
    expect(currentCatalogPricingCabinetId(
      { cabinetId: 1001, masterCode: "SB-33" },
      new Map([["SB-36", 9390099]]),
    )).toBe(1001);
  });

  it("keeps the persisted ID when duplicate active records share a master code", () => {
    const identities = activeCatalogPricingIdsByMasterCode([
      { id: 101, masterCode: "SB-33" },
      { id: 202, masterCode: "SB-33" },
    ]);
    expect(identities.get("SB-33")).toBeNull();
    expect(currentCatalogPricingCabinetId({ cabinetId: 17, masterCode: "SB-33" }, identities)).toBe(17);
  });

  it("prices the legacy WFR2442 display identity from the unambiguous active W-24-42 catalog row", () => {
    const identities = activeCatalogPricingIdsByMasterCode([
      { id: 9390128, masterCode: "W-24-42" },
    ]);
    expect(identities.get("W2442")).toBe(9390128);
    expect(currentCatalogPricingCabinetId(
      { cabinetId: 9390140, masterCode: "WFR2442" },
      identities,
    )).toBe(9390128);
  });

  it("never lets the WFR legacy fallback override a real exact WFR catalog product", () => {
    const identities = activeCatalogPricingIdsByMasterCode([
      { id: 9390128, masterCode: "W-24-42" },
      { id: 9400001, masterCode: "WFR2442" },
    ]);
    expect(currentCatalogPricingCabinetId(
      { cabinetId: 17, masterCode: "WFR2442" },
      identities,
    )).toBe(9400001);
  });

  it("keeps the persisted ID when normalized W-24-42 pricing identity is ambiguous", () => {
    const identities = activeCatalogPricingIdsByMasterCode([
      { id: 9390128, masterCode: "W-24-42" },
      { id: 9490128, masterCode: "W2442" },
    ]);
    expect(identities.get("W2442")).toBeNull();
    expect(currentCatalogPricingCabinetId(
      { cabinetId: 17, masterCode: "WFR2442" },
      identities,
    )).toBe(17);
  });
});

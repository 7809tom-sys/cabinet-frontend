import { describe, expect, it } from "vitest";
import {
  CRM_DEAL_DESIGNS_TABLE,
  CUSTOMER_DESIGN_LINK_NOTE,
  DESIGN_CUSTOMER_COLUMN,
  NO_LINKED_DESIGN_COPY,
  designLinkKind,
  designLinkSourceLabel,
  designLinkStorage,
  hasLinkedDesign,
  isDesignLinkKind,
  selectCustomerDesigns,
  serverLinkedDesigns,
} from "./crmCustomerDesigns";

const scope = { dealId: 5192, contractorCustomerId: null };

describe("customer design links", () => {
  it("keeps a design only when crm_deal_designs links it to this deal", () => {
    expect(designLinkKind({ designId: 44, dealIds: [5192] }, scope)).toBe("deal");
    expect(designLinkKind({ designId: 44, dealIds: [5192, 6001] }, scope)).toBe("deal");
  });

  it("drops a design linked to a different deal, even in the same store", () => {
    expect(designLinkKind({ designId: 44, dealIds: [6001] }, scope)).toBeNull();
    expect(designLinkKind({ designId: 44, dealIds: [] }, scope)).toBeNull();
    expect(designLinkKind({ designId: 44 }, scope)).toBeNull();
  });

  it("does not treat the customer's own saved designs as linked", () => {
    // Ownership (kitchen_designs.userId) and store (kitchen_designs.affiliateId)
    // are deliberately not part of the facts: a customer with 40 designs on the
    // account and one linked design must show one.
    const rows = [
      { designId: 44, dealIds: [5192] },
      { designId: 45, dealIds: [] },
      { designId: 46, dealIds: [7000] },
    ];
    expect(selectCustomerDesigns(rows, scope).map((row) => row.designId)).toEqual([44]);
  });

  it("falls back to the contractor customer folder when the deal has one", () => {
    const folderScope = { dealId: 5192, contractorCustomerId: 88 };
    expect(designLinkKind({ designId: 12, contractorCustomerId: 88 }, folderScope)).toBe("customerFolder");
    expect(designLinkKind({ designId: 12, contractorCustomerId: 89 }, folderScope)).toBeNull();
    expect(designLinkKind({ designId: 12, contractorCustomerId: 88 }, scope)).toBeNull();
  });

  it("shows nothing when no link is stored rather than guessing", () => {
    expect(hasLinkedDesign([{ designId: 45, dealIds: [] }], scope)).toBe(false);
    expect(selectCustomerDesigns([], scope)).toEqual([]);
    expect(NO_LINKED_DESIGN_COPY).toBe("No design linked to this customer yet.");
  });

  it("dedupes a design that happens to have two link rows", () => {
    const rows = [
      { designId: 44, dealIds: [5192], contractorCustomerId: 88 },
      { designId: 44, dealIds: [5192], contractorCustomerId: 88 },
    ];
    expect(selectCustomerDesigns(rows, { dealId: 5192, contractorCustomerId: 88 })).toHaveLength(1);
  });

  it("ignores a missing or invalid deal id instead of matching every design", () => {
    expect(designLinkKind({ designId: 44, dealIds: [5192] }, { dealId: null })).toBeNull();
    expect(designLinkKind({ designId: 44, dealIds: [5192] }, { dealId: 0 })).toBeNull();
    expect(hasLinkedDesign([{ designId: 44, dealIds: [5192] }], { dealId: null })).toBe(false);
  });

  it("names the table and column where the link is stored", () => {
    expect(designLinkStorage("deal")).toBe(CRM_DEAL_DESIGNS_TABLE);
    expect(CRM_DEAL_DESIGNS_TABLE).toBe("cabinet_dealz.crm_deal_designs");
    expect(designLinkStorage("customerFolder")).toBe(DESIGN_CUSTOMER_COLUMN);
    expect(DESIGN_CUSTOMER_COLUMN).toBe("cabinet_dealz.kitchen_designs.contractorCustomerId");
    expect(CUSTOMER_DESIGN_LINK_NOTE).toContain("linked to this customer");
  });

  it("labels each link source for the drawer", () => {
    expect(designLinkSourceLabel("deal")).toBe("Linked to this deal");
    expect(designLinkSourceLabel("customerFolder")).toBe("In this contractor customer folder");
  });

  it("drops a response row the server never proved linked", () => {
    expect(serverLinkedDesigns([{ id: 44, linkKind: "deal" }, { id: 45 }, { id: 46, linkKind: "guess" }]))
      .toEqual([{ id: 44, linkKind: "deal" }]);
    expect(isDesignLinkKind("deal")).toBe(true);
    expect(isDesignLinkKind("customerFolder")).toBe(true);
    expect(isDesignLinkKind(undefined)).toBe(false);
    expect(isDesignLinkKind("userId")).toBe(false);
  });
});

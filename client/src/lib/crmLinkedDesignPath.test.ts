import { describe, expect, it } from "vitest";
import { linkedDesignOpenPath, oneDesignOpenUrl } from "./crmLinkedDesignPath";
import type { CustomerLookupResult } from "./crmCustomerLookupProcedures";

const design = (patch: Partial<{ id: number; affiliateSlug: string | null }> = {}) => ({
  id: 4401,
  name: "Rivera kitchen",
  thumbnailUrl: null,
  assistLabel: null,
  updatedAt: "2026-11-04T15:20:00Z",
  linkKind: "deal" as const,
  linkId: 1,
  affiliateSlug: null,
  ...patch,
});

describe("CRM linked design links follow the design's own store", () => {
  it("opens a house design on the platform designer, not the customer's store", () => {
    // Main's #274: the store whose CRM is open must never decide this.
    expect(linkedDesignOpenPath({ id: 4401, affiliateSlug: null }, 5192))
      .toBe("/design?load=4401&crmDeal=5192");
  });

  it("opens a store design on that store's route", () => {
    expect(linkedDesignOpenPath({ id: 4409, affiliateSlug: "firstclass" }, 5192))
      .toBe("/store/firstclass/design?load=4409&crmDeal=5192");
  });

  it("treats an OWNER scope slug as the platform route", () => {
    expect(linkedDesignOpenPath({ id: 9, affiliateSlug: "OWNER" }, 7001))
      .toBe("/design?load=9&crmDeal=7001");
  });

  it("keeps the CRM context on the link", () => {
    expect(linkedDesignOpenPath({ id: 4401, affiliateSlug: null }, 5192)).toContain("crmDeal=5192");
  });
});

describe("which lookup result auto-opens", () => {
  const base = {
    ok: true as const,
    identifier: "5192",
    dealId: 5192,
    customerName: "Riley Rivera",
    contactEmail: null,
    affiliateId: 7,
  };

  it("opens the single design", () => {
    const result = { ...base, designs: [design()], outcome: "one" as const, openUrl: null };
    expect(oneDesignOpenUrl(result)).toBe("/design?load=4401&crmDeal=5192");
  });

  it("opens nothing when there are several or none", () => {
    expect(oneDesignOpenUrl({ ...base, designs: [design(), design({ id: 4402 })], outcome: "several" as const, openUrl: null })).toBeNull();
    expect(oneDesignOpenUrl({ ...base, designs: [], outcome: "none" as const, openUrl: null })).toBeNull();
  });

  it("opens nothing for a miss", () => {
    expect(oneDesignOpenUrl({ ok: false, reason: "not-found", identifier: "8888", dealId: 8888 })).toBeNull();
    expect(oneDesignOpenUrl(undefined)).toBeNull();
  });

  it("ignores a server-supplied openUrl in favour of the design's own store", () => {
    const result: CustomerLookupResult = {
      ...base,
      designs: [design({ affiliateSlug: "firstclass" })],
      outcome: "one",
      openUrl: "/design?load=4401&stale=1",
    };
    expect(oneDesignOpenUrl(result)).toBe("/store/firstclass/design?load=4401&crmDeal=5192");
  });
});

import { describe, expect, it } from "vitest";
import { masterAffiliateFilterId } from "./crmMasterFilter";

describe("masterAffiliateFilterId", () => {
  it("keeps the all-affiliates master board unfiltered", () => {
    expect(masterAffiliateFilterId("all")).toBeUndefined();
  });

  it("returns a valid selected affiliate identifier", () => {
    expect(masterAffiliateFilterId("42")).toBe(42);
    expect(masterAffiliateFilterId("0")).toBeUndefined();
  });
});

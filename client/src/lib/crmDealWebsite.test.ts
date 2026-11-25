import { describe, expect, it } from "vitest";
import { crmDealWebsite } from "./crmDealWebsite";

describe("crmDealWebsite", () => {
  it("reads the first URL from the Website line and labels it by domain", () => {
    const notes = "distributor_master_list_2026-11-24\nLocation: Philadelphia, PA\nWebsite: https://www.kitchen-worldinc.com/\nPlatform: Wix";
    expect(crmDealWebsite(notes)).toEqual({ url: "https://www.kitchen-worldinc.com/", label: "kitchen-worldinc.com" });
  });

  it("works when the import prefixed the notes or used separators", () => {
    expect(crmDealWebsite("Customer list import: rank 3 | Website: http://esquedascabinet.com | Platform: WordPress"))
      .toEqual({ url: "http://esquedascabinet.com/", label: "esquedascabinet.com" });
  });

  it("returns null with no Website line or no usable URL", () => {
    expect(crmDealWebsite(null)).toBeNull();
    expect(crmDealWebsite("Wants a quote. See https://example.com")).toBeNull();
    expect(crmDealWebsite("Website: not listed")).toBeNull();
    expect(crmDealWebsite("Website: javascript:alert(1)")).toBeNull();
  });
});

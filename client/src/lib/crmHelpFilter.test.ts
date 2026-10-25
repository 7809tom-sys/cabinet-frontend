import { describe, expect, it } from "vitest";
import { filterDealsByHelpType } from "./crmHelpFilter";

const deals = [
  { id: 1, needsHelpDesigning: true, needsHelpShipping: false },
  { id: 2, needsHelpDesigning: false, needsHelpShipping: true },
  { id: 3, needsHelpDesigning: true, needsHelpShipping: true },
  { id: 4, needsHelpDesigning: false, needsHelpShipping: false },
];

describe("filterDealsByHelpType", () => {
  it("leaves the CRM board unfiltered by default", () => {
    expect(filterDealsByHelpType(deals, "all").map((deal) => deal.id)).toEqual([1, 2, 3, 4]);
  });

  it("filters independently for Design Help and Shipping Cost Help", () => {
    expect(filterDealsByHelpType(deals, "design").map((deal) => deal.id)).toEqual([1, 3]);
    expect(filterDealsByHelpType(deals, "shipping").map((deal) => deal.id)).toEqual([2, 3]);
  });
});

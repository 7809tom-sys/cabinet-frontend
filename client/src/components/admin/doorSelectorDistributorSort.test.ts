import { describe, expect, it } from "vitest";
import { sortDoorStylesByDistributor } from "./doorSelectorDistributorSort";

const styles = [
  { id: 1, ourName: "Zebra White", supplierBrandName: "Kitchen Crest", supplierName: "Line K", featuredRank: 1 },
  { id: 2, ourName: "Alpha Oak", supplierBrandName: "Ashford", supplierName: "Line A", featuredRank: 2 },
  { id: 3, ourName: "No Line", supplierBrandName: null, supplierName: "  ", featuredRank: 3 },
  { id: 4, ourName: "Beta Grey", supplierBrandName: "kitchen crest", supplierName: "Line K", featuredRank: 4 },
  { id: 5, ourName: "Internal Only", supplierBrandName: "", supplierName: "DL Cabinetry", featuredRank: 5 },
];

const byRank = (a: { featuredRank: number; ourName: string }, b: { featuredRank: number; ourName: string }) =>
  a.featuredRank - b.featuredRank || a.ourName.localeCompare(b.ourName);

describe("sortDoorStylesByDistributor", () => {
  it("sorts A-Z and keeps styles with no distributor last", () => {
    const names = sortDoorStylesByDistributor(styles, "az", byRank).map((style) => style.ourName);
    expect(names).toEqual(["Alpha Oak", "Internal Only", "Zebra White", "Beta Grey", "No Line"]);
  });

  it("sorts Z-A and still keeps styles with no distributor last", () => {
    const names = sortDoorStylesByDistributor(styles, "za", byRank).map((style) => style.ourName);
    expect(names).toEqual(["Zebra White", "Beta Grey", "Internal Only", "Alpha Oak", "No Line"]);
  });

  it("uses the saved tie-break inside one distributor and does not mutate the source list", () => {
    const snapshot = styles.map((style) => style.ourName);
    sortDoorStylesByDistributor(styles, "az", byRank);
    expect(styles.map((style) => style.ourName)).toEqual(snapshot);
  });
});

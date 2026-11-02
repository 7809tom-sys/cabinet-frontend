import { describe, expect, it } from "vitest";
import {
  buildDistributorTabs,
  distributorLabel,
  sortDoorSelectorStyles,
  visibleDoorSelectorStyles,
  type DoorSelectorTabStyle,
} from "./doorSelectorDistributorTabs";

const door = (over: Partial<DoorSelectorTabStyle> & { ourName: string; distributorId: number }): DoorSelectorTabStyle => ({
  doorStyle: null,
  color: null,
  supplierBrandName: null,
  supplierName: null,
  ...over,
});

describe("admin door selector distributor tabs", () => {
  it("builds one tab per distributor on the loaded doors, alphabetically, with All left to the caller", () => {
    const doors = [
      door({ ourName: "A", distributorId: 3, supplierBrandName: "Kitchen Crest" }),
      door({ ourName: "B", distributorId: 1, supplierBrandName: "Ashford" }),
      door({ ourName: "C", distributorId: 3, supplierBrandName: "Kitchen Crest" }),
      door({ ourName: "D", distributorId: 2, supplierName: "Line B" }),
      door({ ourName: "E", distributorId: 9 }),
    ];
    expect(buildDistributorTabs(doors)).toEqual([
      { id: 1, name: "Ashford" },
      { id: 9, name: "Distributor #9" },
      { id: 3, name: "Kitchen Crest" },
      { id: 2, name: "Line B" },
    ]);
  });

  it("gives a new distributor a tab automatically, with no hard-coded list", () => {
    const before = buildDistributorTabs([door({ ourName: "A", distributorId: 1, supplierBrandName: "Ashford" })]);
    const after = buildDistributorTabs([
      door({ ourName: "A", distributorId: 1, supplierBrandName: "Ashford" }),
      door({ ourName: "B", distributorId: 42, supplierBrandName: "Brand New Line" }),
    ]);
    expect(before.map((tab) => tab.id)).toEqual([1]);
    expect(after.map((tab) => tab.id)).toEqual([1, 42]);
    expect(after.map((tab) => tab.name)).toContain("Brand New Line");
  });

  it("labels a line by brand name, then neutral supplier name, then its id", () => {
    expect(distributorLabel(door({ ourName: "A", distributorId: 5, supplierBrandName: " Acme ", supplierName: "Line A" }))).toBe("Acme");
    expect(distributorLabel(door({ ourName: "A", distributorId: 5, supplierBrandName: "   ", supplierName: "Line A" }))).toBe("Line A");
    expect(distributorLabel(door({ ourName: "A", distributorId: 5 }))).toBe("Distributor #5");
  });
});

describe("admin door selector tab sort", () => {
  const doors = [
    door({ ourName: "Zebra White", distributorId: 1, doorStyle: "Shaker", color: "White" }),
    door({ ourName: "Alpha Oak", distributorId: 1, doorStyle: "Slab", color: "Natural" }),
    door({ ourName: "Beta Grey", distributorId: 2, doorStyle: "Shaker", color: "Grey" }),
    door({ ourName: "Cedar", distributorId: 2, doorStyle: null, color: "  " }),
  ];

  it("sorts by door name", () => {
    expect(sortDoorSelectorStyles(doors, "name").map((d) => d.ourName)).toEqual([
      "Alpha Oak", "Beta Grey", "Cedar", "Zebra White",
    ]);
  });

  it("sorts by door style and keeps blank door styles last", () => {
    expect(sortDoorSelectorStyles(doors, "doorStyle").map((d) => d.ourName)).toEqual([
      "Beta Grey", "Zebra White", "Alpha Oak", "Cedar",
    ]);
  });

  it("sorts by color and keeps blank colors last", () => {
    expect(sortDoorSelectorStyles(doors, "color").map((d) => d.ourName)).toEqual([
      "Beta Grey", "Alpha Oak", "Zebra White", "Cedar",
    ]);
  });

  it("does not mutate the input", () => {
    const input = doors.slice();
    sortDoorSelectorStyles(input, "name");
    expect(input.map((d) => d.ourName)).toEqual(doors.map((d) => d.ourName));
  });
});

describe("admin door selector visibility", () => {
  const doors = [
    door({ ourName: "A", distributorId: 1 }),
    door({ ourName: "B", distributorId: 1 }),
    door({ ourName: "C", distributorId: 2 }),
  ];

  it("shows every switched-on distributor under All", () => {
    expect(visibleDoorSelectorStyles(doors, "all", () => true).map((d) => d.ourName)).toEqual(["A", "B", "C"]);
  });

  it("shows one distributor's doors inside its own tab", () => {
    expect(visibleDoorSelectorStyles(doors, 2, () => true).map((d) => d.ourName)).toEqual(["C"]);
  });

  it("hides a distributor's doors everywhere once it is switched off", () => {
    expect(visibleDoorSelectorStyles(doors, "all", (id) => id !== 1).map((d) => d.ourName)).toEqual(["C"]);
    expect(visibleDoorSelectorStyles(doors, 1, (id) => id !== 1)).toEqual([]);
  });
});

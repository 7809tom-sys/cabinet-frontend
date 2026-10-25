import { describe, it, expect } from "vitest";
import { groupStylesByDistributor } from "./groupStylesByDistributor";

const opts = {
  fallback: (id: number) => `Line ${id}`,
  other: "Other styles",
};

const distributors = [
  { id: 1, name: "Line A" },
  { id: 2, name: "Line B" },
  { id: 3, name: "Line C" },
];

describe("groupStylesByDistributor", () => {
  it("splits the real data shape (19 + 11 + 32) into three labeled groups", () => {
    const styles = [
      ...Array.from({ length: 19 }, (_, i) => ({ id: 100 + i, distributorId: 1 })),
      ...Array.from({ length: 11 }, (_, i) => ({ id: 200 + i, distributorId: 2 })),
      ...Array.from({ length: 32 }, (_, i) => ({ id: 300 + i, distributorId: 3 })),
    ];
    const groups = groupStylesByDistributor(styles, distributors, opts);
    expect(groups).toHaveLength(3);
    const byLabel = Object.fromEntries(groups.map((g) => [g.label, g.styles.length]));
    expect(byLabel).toEqual({ "Line A": 19, "Line B": 11, "Line C": 32 });
  });

  it("sorts groups by neutral label, not by distributor id or count", () => {
    const styles = [
      { id: 1, distributorId: 3 },
      { id: 2, distributorId: 1 },
      { id: 3, distributorId: 2 },
    ];
    const groups = groupStylesByDistributor(styles, distributors, opts);
    expect(groups.map((g) => g.label)).toEqual(["Line A", "Line B", "Line C"]);
  });

  it("uses the fallback label when a distributor id has no neutral label", () => {
    const styles = [{ id: 1, distributorId: 99 }];
    const groups = groupStylesByDistributor(styles, distributors, opts);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Line 99");
  });

  it("buckets styles with no distributorId under the 'other' label", () => {
    const styles = [
      { id: 1, distributorId: null },
      { id: 2 },
    ];
    const groups = groupStylesByDistributor(styles, distributors, opts);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Other styles");
    expect(groups[0].styles).toHaveLength(2);
  });

  it("treats a numeric-string distributorId mismatch as its own group (guards against type drift)", () => {
    // If the API ever returns distributorId as a string, it would NOT match the
    // numeric labelById keys — this test documents that and would catch it.
    const styles = [{ id: 1, distributorId: 1 }];
    const groups = groupStylesByDistributor(styles, distributors, opts);
    expect(groups[0].label).toBe("Line A");
  });

  it("preserves the incoming order of styles within a group", () => {
    const styles = [
      { id: 5, distributorId: 1 },
      { id: 2, distributorId: 1 },
      { id: 9, distributorId: 1 },
    ];
    const groups = groupStylesByDistributor(styles, distributors, opts);
    expect(groups[0].styles.map((s) => s.id)).toEqual([5, 2, 9]);
  });
});

describe("groupStylesByDistributor — distributor-first picker", () => {
  it("keeps same-named styles from different lines in their own groups (no cross-line shadowing)", () => {
    // Two lines both carry an "Air White" style. They must remain distinct so the
    // line-chooser shows each line's full lineup, not a name-deduped mash-up.
    const styles = [
      { id: 11, distributorId: 1, ourName: "Air White" },
      { id: 12, distributorId: 1, ourName: "Bloom Cinder" },
      { id: 21, distributorId: 2, ourName: "Air White" },
      { id: 22, distributorId: 2, ourName: "Carbon Frost" },
    ];
    const groups = groupStylesByDistributor(styles, distributors, opts);
    expect(groups).toHaveLength(2);
    const a = groups.find((g) => g.label === "Line A")!;
    const b = groups.find((g) => g.label === "Line B")!;
    expect(a.styles.map((s) => s.id)).toEqual([11, 12]);
    expect(b.styles.map((s) => s.id)).toEqual([21, 22]);
    // The same display name exists in BOTH lines — neither one is dropped.
    expect(a.styles.some((s) => (s as { ourName?: string }).ourName === "Air White")).toBe(true);
    expect(b.styles.some((s) => (s as { ourName?: string }).ourName === "Air White")).toBe(true);
  });
});

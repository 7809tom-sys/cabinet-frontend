import { describe, it, expect } from "vitest";
import { groupByProject } from "./DesignActions";

// Minimal row factory — groupByProject only reads projectName + updatedAt.
function row(
  id: number,
  projectName: string | null,
  updatedAt: string,
): {
  id: number;
  name: string;
  updatedAt: string;
  projectName: string | null;
} {
  return { id, name: `Design ${id}`, updatedAt, projectName };
}

describe("groupByProject — My Plans grouped by customer/house", () => {
  it("nests multiple room plans under a single customer/house", () => {
    const groups = groupByProject([
      row(1, "Smith Residence", "2026-01-01T10:00:00Z"),
      row(2, "Smith Residence", "2026-01-03T10:00:00Z"),
      row(3, "Smith Residence", "2026-01-02T10:00:00Z"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].projectName).toBe("Smith Residence");
    // Rooms sorted newest-first within the customer.
    expect(groups[0].rooms.map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it("separates different customers and orders newest-project first", () => {
    const groups = groupByProject([
      row(1, "Old Customer", "2026-01-01T10:00:00Z"),
      row(2, "New Customer", "2026-02-01T10:00:00Z"),
    ]);
    expect(groups.map((g) => g.projectName)).toEqual([
      "New Customer",
      "Old Customer",
    ]);
  });

  it("puts ungrouped (no customer) plans in a trailing null bucket", () => {
    const groups = groupByProject([
      row(1, null, "2026-03-01T10:00:00Z"),
      row(2, "Jones Residence", "2026-01-01T10:00:00Z"),
      row(3, "", "2026-04-01T10:00:00Z"),
    ]);
    // Real customer first, ungrouped bucket last.
    expect(groups[0].projectName).toBe("Jones Residence");
    const last = groups[groups.length - 1];
    expect(last.projectName).toBeNull();
    // Both the null and "" (whitespace) rows collapse into one ungrouped bucket.
    expect(last.rooms.map((r) => r.id).sort()).toEqual([1, 3]);
  });

  it("treats whitespace-only project names as the same customer", () => {
    const groups = groupByProject([
      row(1, "  Baker House  ", "2026-01-01T10:00:00Z"),
      row(2, "Baker House", "2026-01-02T10:00:00Z"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].projectName).toBe("Baker House");
    expect(groups[0].rooms).toHaveLength(2);
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CATALOG_SECTIONS,
  canonicalAdminTab,
  catalogLeaves,
  resolveCatalogTab,
} from "./catalogAdminTabs";

const tabsSource = readFileSync(
  resolve(process.cwd(), "client/src/components/admin/AdminGroupedTabs.tsx"),
  "utf8",
);

function tabBlock(value: string): string {
  const token = `<TabsContent value="${value}"`;
  const start = tabsSource.indexOf(token);
  expect(start, value).toBeGreaterThan(-1);
  const end = tabsSource.indexOf("</TabsContent>", start);
  expect(end, value).toBeGreaterThan(start);
  return tabsSource.slice(start, end);
}

describe("Products & Catalog tab groups", () => {
  const leaves = catalogLeaves();

  it("keeps every historical tab value on the same editor", () => {
    expect(new Set(leaves.map((leaf) => leaf.value)).size).toBe(leaves.length);
    expect(CATALOG_SECTIONS.length).toBeLessThan(leaves.length);

    for (const leaf of leaves) {
      const resolved = resolveCatalogTab(leaf.value);
      expect(resolved?.tabValue).toBe(leaf.value);
      expect(resolved?.tabLabel).toBe(leaf.label);
      expect(resolved?.editors).toEqual(leaf.editors);
      const block = tabBlock(leaf.value);
      expect(block).toContain(`<AdminTabErrorBoundary tabName="${leaf.boundary}"`);
      expect(block).toContain("</AdminTabErrorBoundary>");
      for (const editor of leaf.editors) {
        expect(block).toContain(`<${editor}`);
      }
      if (leaf.help) {
        expect(block).toContain(`<AdminTabHelp tab="${leaf.help}"`);
      }
    }
  });

  it("opens a section id on that section's first editor", () => {
    for (const section of CATALOG_SECTIONS) {
      const first = catalogLeaves(section)[0];
      const resolved = resolveCatalogTab(section.id);
      expect(resolved?.sectionId).toBe(section.id);
      expect(resolved?.tabValue).toBe(first.value);
      expect(canonicalAdminTab(section.id)).toBe(first.value);
      expect(canonicalAdminTab(first.value)).toBe(first.value);
    }
  });

  it("leaves non-catalog tab values unchanged", () => {
    expect(resolveCatalogTab("crm")).toBeNull();
    expect(resolveCatalogTab("")).toBeNull();
    expect(resolveCatalogTab(null)).toBeNull();
    expect(canonicalAdminTab("orders")).toBe("orders");
    expect(canonicalAdminTab("not-a-tab")).toBe("not-a-tab");
  });

  it("groups the catalog editors the way the admin row is organized", () => {
    expect(CATALOG_SECTIONS.map((section) => [section.label, catalogLeaves(section).map((leaf) => leaf.value)])).toEqual([
      ["Catalog", ["cabinets"]],
      ["Door styles", ["featured", "door-corrections", "door-rendering-audit"]],
      ["Images", ["images", "media-library", "generated-design-images"]],
      ["Suppliers", ["distributors", "glass-policy", "catalog-importer", "pending-distributor-connections", "vendor-onboarding"]],
      ["Cabinet Config", ["cabinet-config"]],
      ["Categories", ["categories"]],
      ["📦 Package Data & Parcel", ["package-data"]],
      ["Pelican Catalog", ["pelican-catalog"]],
      ["📦 Kitchen Packages", ["bundle-deals"]],
      ["10×10 Price Shop", ["price-shop-10x10"]],
      ["Data quality", [
        "conflicts",
        "merge-suggestions",
        "master-sku",
        "master-changes",
        "unpriced-items",
        "designer-price-flags",
        "pending-review",
        "cabinet-attention",
        "data-recovery",
      ]],
    ]);
    expect(tabsSource).toContain("tabs: CATALOG_SECTIONS.map((section) => ({ value: section.id, label: section.label }))");
    expect(tabsSource).toContain('data-testid={`catalog-subtabs-${section.id}`}');
  });
});

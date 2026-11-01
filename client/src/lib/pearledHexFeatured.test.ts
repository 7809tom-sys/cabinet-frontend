import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "docs/sql/0245_pearled_hex_featured.tidb.sql"), "utf8");
const categoryPage = readFileSync(resolve(process.cwd(), "client/src/pages/SurfacesCategory.tsx"), "utf8");

function statementsIn(block: string): string[] {
  return block
    .split(";")
    .map((part) => part.replace(/--[^\n]*/g, "").trim())
    .filter(Boolean);
}

describe("Pearled Hex storefront featured picker", () => {
  it("features item 426 by id and slug, one statement per numbered block", () => {
    expect(sql).toContain("cabinet_dealz.pelican_products");
    expect(sql).toContain("id = 426");
    expect(sql).toContain("slug = 'pearled-hex'");
    expect(sql).toContain("name = 'Pearled Hex'");
    expect(sql).toContain("isPopular = 1");
    expect(sql).not.toMatch(/materialImageUrl\s*=/);
    expect(sql).not.toMatch(/usableAsFloor/);
    expect(sql).not.toMatch(/\b(ownerId|distributorId|createdBy)\b/);
    const blocks = sql.split(/\n-- \d+/).slice(1);
    expect(blocks).toHaveLength(4);
    for (const block of blocks) {
      expect(statementsIn(block)).toHaveLength(1);
    }
    const [update, check, commit, committed] = blocks.map((block) => statementsIn(block)[0]);
    expect(update).toMatch(/^UPDATE cabinet_dealz\.pelican_products/i);
    expect(check).toMatch(/FROM cabinet_dealz\.pelican_products/i);
    expect(commit).toBe("COMMIT");
    expect(committed).toBe("SELECT 'COMMITTED'");
    expect(sql.trimEnd().endsWith(";")).toBe(true);
  });

  it("renders Featured picks from the catalog suggested rows and does not require a material image", () => {
    expect(categoryPage).toContain("Featured picks");
    expect(categoryPage).toContain("data!.suggested.map");
    expect(categoryPage).toContain("showSuggested");
    const featured = categoryPage.slice(categoryPage.indexOf("showSuggested"), categoryPage.indexOf("data!.items.map"));
    expect(featured).not.toContain("materialImageUrl");
    expect(featured).not.toContain("isPopular");
  });
});

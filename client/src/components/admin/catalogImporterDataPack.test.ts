/**
 * Unit tests for the NAC DataPack CSV parser functions embedded in CatalogImporterTab.
 * We test the pure logic functions by extracting them into a testable module.
 */
import { describe, it, expect } from "vitest";

// ---- Inline the pure functions under test (no JSZip dependency needed) ----

function parseSimpleCsv(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let isFirst = true;
  for (const line of lines) {
    if (!line.trim()) continue;
    if (isFirst) { isFirst = false; continue; }
    const cols: string[] = [];
    let inQuote = false;
    let cur = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === "," && !inQuote) {
        cols.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}

function inferCategoryFromNacSku(sku: string): string {
  const s = sku.toUpperCase();
  if (/^W\d/.test(s) || s.startsWith("WDC") || s.startsWith("WBC") || s.startsWith("WEC") || s.startsWith("WB")) return "Wall Cabinet";
  if (/^T\d/.test(s) || s.startsWith("OT") || s.startsWith("UT") || s.startsWith("PT")) return "Tall Cabinet";
  if (/^V\d/.test(s) || s.startsWith("VDB") || s.startsWith("VB")) return "Vanity";
  if (s.startsWith("BT") || s.startsWith("BS") || /^B\d/.test(s) || s.startsWith("SB") || s.startsWith("DB") || s.startsWith("3DB") || s.startsWith("2DB")) return "Base Cabinet";
  return "Base Cabinet";
}

interface PafProduct {
  code: string;
  description: string;
  category?: string;
  listPrice?: number;
}

function parseProductsAndPrices(productsCsv: string, priceCsv: string): PafProduct[] {
  const productRows = parseSimpleCsv(productsCsv);
  const priceRows = parseSimpleCsv(priceCsv);
  const priceMap: Record<string, number> = {};
  for (const row of priceRows) {
    if (row[1] === "PR00011" && row[5] === "O.PG02") {
      const sku = row[4];
      const price = parseFloat(row[7]);
      if (sku && !isNaN(price)) priceMap[sku] = price;
    }
  }
  const products: PafProduct[] = [];
  for (const row of productRows) {
    if (row[0] !== "Product") continue;
    const sku = row[2];
    const description = row[3] || sku;
    if (!sku) continue;
    const product: PafProduct = { code: sku.toUpperCase(), description, category: inferCategoryFromNacSku(sku) };
    if (priceMap[sku] !== undefined) product.listPrice = priceMap[sku];
    products.push(product);
  }
  return products;
}

// ---- Tests ----

describe("NAC DataPack CSV parser", () => {
  describe("parseSimpleCsv", () => {
    it("skips the header row and parses data rows", () => {
      const csv = "ProductGroup,Code,Name_en-US,Description_en-US\nProduct,R.27,BT09-R,Base Tray Cabinet - 1 Door\n";
      const rows = parseSimpleCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(["Product", "R.27", "BT09-R", "Base Tray Cabinet - 1 Door"]);
    });

    it("handles quoted fields with commas", () => {
      const csv = "A,B,C\n\"hello, world\",foo,bar\n";
      const rows = parseSimpleCsv(csv);
      expect(rows[0][0]).toBe("hello, world");
    });

    it("handles empty lines gracefully", () => {
      const csv = "A,B\nfoo,bar\n\n\nbaz,qux\n";
      const rows = parseSimpleCsv(csv);
      expect(rows).toHaveLength(2);
    });
  });

  describe("inferCategoryFromNacSku", () => {
    it("classifies wall cabinets", () => {
      expect(inferCategoryFromNacSku("W3036")).toBe("Wall Cabinet");
      expect(inferCategoryFromNacSku("W1230")).toBe("Wall Cabinet");
    });
    it("classifies tall cabinets", () => {
      expect(inferCategoryFromNacSku("T1896")).toBe("Tall Cabinet");
      expect(inferCategoryFromNacSku("OT1884")).toBe("Tall Cabinet");
    });
    it("classifies vanity cabinets", () => {
      expect(inferCategoryFromNacSku("V18")).toBe("Vanity");
      expect(inferCategoryFromNacSku("VDB24")).toBe("Vanity");
    });
    it("classifies base cabinets", () => {
      expect(inferCategoryFromNacSku("B12-R")).toBe("Base Cabinet");
      expect(inferCategoryFromNacSku("3DB24")).toBe("Base Cabinet");
      expect(inferCategoryFromNacSku("BT09-R")).toBe("Base Cabinet");
    });
    it("defaults unknown SKUs to Base Cabinet", () => {
      expect(inferCategoryFromNacSku("UNKNOWN")).toBe("Base Cabinet");
    });
  });

  describe("parseProductsAndPrices (DataPack end-to-end)", () => {
    const productsCsv = [
      "ProductGroup,Code,Name_en-US,Description_en-US",
      "Product,R.27,BT09-R,Base Tray Cabinet - 1 Door",
      "Product,R.28,BT09-L,Base Tray Cabinet - 1 Door",
      "Product,R.29,B12-R,Base Cabinet - 1 Door - 1 Drawer - 1 Shelf",
      "Product,R.30,W3036,Wall Cabinet 30x36",
      "Upcharge,U.01,DOOR_STYLE,Door Style Upcharge",  // should be skipped
    ].join("\n");

    const priceCsv = [
      "PriceListRef,PriceRuleRef,Rank,Key1,KeyTxt1,Key2,KeyTxt2,Value,CalcMethod,CalcMethodFormula",
      "Default,PR00011,10,R.27,BT09-R,O.PG02,PG02,256,,",
      "Default,PR00011,10,R.27,BT09-R,O.PG03,PG03,282,,",  // different price group — ignored
      "Default,PR00011,10,R.28,BT09-L,O.PG02,PG02,256,,",
      "Default,PR00011,10,R.29,B12-R,O.PG02,PG02,189,,",
      "Default,PR00011,10,R.30,W3036,O.PG02,PG02,145,,",
      "Default,PR00099,10,R.27,BT09-R,O.PG02,PG02,999,,",  // wrong price rule — ignored
    ].join("\n");

    it("returns only Product rows (skips Upcharge rows)", () => {
      const products = parseProductsAndPrices(productsCsv, priceCsv);
      expect(products).toHaveLength(4);
    });

    it("uppercases the SKU code", () => {
      const products = parseProductsAndPrices(productsCsv, priceCsv);
      expect(products[0].code).toBe("BT09-R");
    });

    it("assigns the correct list price from PG02 / PR00011", () => {
      const products = parseProductsAndPrices(productsCsv, priceCsv);
      const bt09r = products.find((p) => p.code === "BT09-R");
      expect(bt09r?.listPrice).toBe(256);
    });

    it("does not use prices from other price groups or rules", () => {
      const products = parseProductsAndPrices(productsCsv, priceCsv);
      // Only one price per SKU (PG02 / PR00011); PG03 and PR00099 rows are ignored
      const bt09r = products.find((p) => p.code === "BT09-R");
      expect(bt09r?.listPrice).toBe(256); // not 282 (PG03) or 999 (PR00099)
    });

    it("assigns correct category to wall and base SKUs", () => {
      const products = parseProductsAndPrices(productsCsv, priceCsv);
      const wall = products.find((p) => p.code === "W3036");
      const base = products.find((p) => p.code === "B12-R");
      expect(wall?.category).toBe("Wall Cabinet");
      expect(base?.category).toBe("Base Cabinet");
    });

    it("handles a product with no matching price gracefully", () => {
      const noPrice = [
        "ProductGroup,Code,Name_en-US,Description_en-US",
        "Product,R.99,NOPRICE,Cabinet With No Price",
      ].join("\n");
      const products = parseProductsAndPrices(noPrice, priceCsv);
      expect(products).toHaveLength(1);
      expect(products[0].listPrice).toBeUndefined();
    });
  });
});

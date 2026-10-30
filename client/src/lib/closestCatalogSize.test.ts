import { describe, expect, it } from "vitest";
import { pickClosestCatalogSize, type CatalogSize } from "./closestCatalogSize";

const size = (width: number, height: number, depth: number): CatalogSize => ({ width, height, depth });

describe("closest catalog size", () => {
  const rows = [
    { sku: "W3642", size: size(36, 42, 12) },
    { sku: "W3640", size: size(36, 40, 12) },
    { sku: "W3040", size: size(30, 40, 12) },
    { sku: "W3624D", size: size(36, 24, 24) },
    { sku: "W362275", size: size(36, 22.75, 13.5) },
    { sku: "W3630D", size: size(36, 30, 24) },
  ];

  it("substitutes the closest height and prefers the smaller box on a tie", () => {
    const picked = pickClosestCatalogSize({
      candidates: rows.filter((row) => row.sku.startsWith("W36") && row.size.depth === 12),
      wanted: { width: 36, height: 42, depth: 12 },
      read: (row) => row.size,
      require: ["width", "depth"],
      rank: [{ axis: "height", by: "closest" }],
    });
    expect(picked?.item.sku).toBe("W3642");

    const onlyForty = rows.filter((row) => row.size.height === 40 && row.size.depth === 12);
    const substituted = pickClosestCatalogSize({
      candidates: onlyForty,
      wanted: { width: 36, height: 42, depth: 12 },
      read: (row) => row.size,
      require: ["depth"],
      toleranceIn: 2,
      rank: [
        { axis: "height", by: "closest" },
        { axis: "width", by: "closest" },
      ],
    });
    expect(substituted?.item.sku).toBe("W3640");
  });

  it("can require a height ceiling and then take the tallest matching width and closest depth", () => {
    const picked = pickClosestCatalogSize({
      candidates: rows,
      wanted: { width: 36, height: 24, depth: 24 },
      read: (row) => row.size,
      accept: (actual) => actual.height < 30,
      rank: [
        { axis: "width", by: "closest" },
        { axis: "depth", by: "closest" },
        { axis: "height", by: "larger" },
      ],
    });
    expect(picked?.item.sku).toBe("W3624D");
  });
});

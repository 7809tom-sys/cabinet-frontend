import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CatalogSkuImage } from "./CatalogSkuImage";

describe("CatalogSkuImage supplier photo identity", () => {
  it("first renders the exact distributor SKU source and retains the product code", () => {
    const src = "/manus-storage/sku-images/1784390003470_ASP-B12_738a416d.jpg";
    const html = renderToStaticMarkup(createElement(CatalogSkuImage, {
      src,
      alt: "B12 base cabinet",
      cabinet: { masterCode: "B12", description: "B12 base cabinet", category: "Base" },
      finishColor: "#8FAF8A",
    }));
    expect(html).toContain(src);
    expect(html).toContain("B12 base cabinet");
    expect(html).not.toContain("/api/catalog-sku-photo/");
    expect(html).not.toContain("catalog-sku-illustration-fallback");
  });
});

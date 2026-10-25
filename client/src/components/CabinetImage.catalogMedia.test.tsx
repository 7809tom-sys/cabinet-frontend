import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CabinetImage } from "./CabinetImage";

describe("CabinetImage authentic catalog media", () => {
  it("first renders the exact approved B12 art before any same-image recovery or technical fallback", () => {
    const original = "/manus-storage/media-library/1790257199386_b12_b21_4dedff25";
    const markup = renderToStaticMarkup(createElement(CabinetImage, {
      cabinet: { masterCode: "B12", description: '12" Base Cabinet', category: "Base", width: 12, catalogImageUrl: original },
    }));
    expect(markup).toContain(original);
    expect(markup).not.toContain("/api/catalog-media/");
    expect(markup).not.toContain("data-cabinet-drawing");
  });
});

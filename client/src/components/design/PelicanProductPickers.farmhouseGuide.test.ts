import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compatibleFarmhouseSinkOptions, FarmhouseSinkSelectionGuide, type RecItem } from "./PelicanProductPickers";

const product = (pelicanCode: string): RecItem => ({
  id: pelicanCode === "PL-HA135 R0" ? 1 : 2,
  pelicanCode,
  slug: pelicanCode.toLowerCase().replace(/\s/g, "-"),
  name: pelicanCode,
  category: "Sinks",
  subCategory: "Kitchen",
  size: null,
  imageUrl: null,
  sellPrice: 100,
});

describe("compatibleFarmhouseSinkOptions", () => {
  it("keeps only source-verified apron-front profiles that fit the selected farm sink base", () => {
    expect(compatibleFarmhouseSinkOptions([product("PL-HA135 R0"), product("PL-VR1816 R20")], 36).map((item) => item.pelicanCode))
      .toEqual(["PL-HA135 R0"]);
  });

  it("does not offer a verified farmhouse sink below its source-backed base-width requirement", () => {
    expect(compatibleFarmhouseSinkOptions([product("PL-HA135 R0")], 24)).toEqual([]);
  });

  it("renders compatible farmhouse choices and a clear verified-only fallback inside the guide", () => {
    const compatibleMarkup = renderToStaticMarkup(createElement(FarmhouseSinkSelectionGuide, {
      baseCode: "FSB-36",
      openingWidthIn: 36,
      products: [product("PL-HA135 R0"), product("PL-VR1816 R20")],
      isLoading: false,
      onSelect: () => undefined,
      onBrowseAll: () => undefined,
    }));
    expect(compatibleMarkup).toContain("Sink Selection Guide");
    expect(compatibleMarkup).toContain("PL-HA135 R0");
    expect(compatibleMarkup).not.toContain("PL-VR1816 R20");

    const noMatchMarkup = renderToStaticMarkup(createElement(FarmhouseSinkSelectionGuide, {
      baseCode: "FSB-24",
      openingWidthIn: 24,
      products: [product("PL-HA135 R0")],
      isLoading: false,
      onSelect: () => undefined,
      onBrowseAll: () => undefined,
    }));
    expect(noMatchMarkup).toContain("No verified farmhouse sinks are currently linked to this base.");
    expect(noMatchMarkup).toContain("prevents an unverified or standard sink");
  });
});

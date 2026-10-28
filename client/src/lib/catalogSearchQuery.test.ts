import { describe, expect, it } from "vitest";
import { catalogGlobalSearchTerm, catalogSearchRequest } from "./catalogSearchQuery";

describe("catalogSearchRequest", () => {
  it("searches the selected door style even when the box is empty", () => {
    expect(catalogSearchRequest(390001, "")).toEqual({ kind: "style" });
    expect(catalogSearchRequest(390001, "  wine rack ")).toEqual({ kind: "style" });
  });

  it("searches the public catalog when a query is typed and no style is selected", () => {
    expect(catalogSearchRequest(null, "3015")).toEqual({ kind: "catalog", search: "3015" });
    expect(catalogSearchRequest(null, "  wine rack ")).toEqual({ kind: "catalog", search: "wine rack" });
  });

  it("asks for a door style only when there is nothing to search", () => {
    expect(catalogSearchRequest(null, "")).toEqual({ kind: "prompt" });
    expect(catalogSearchRequest(null, "   ")).toEqual({ kind: "prompt" });
  });
});

describe("catalogGlobalSearchTerm", () => {
  it("title-cases a description phrase and leaves a SKU fragment unchanged", () => {
    expect(catalogGlobalSearchTerm("wine rack")).toBe("Wine Rack");
    expect(catalogGlobalSearchTerm("  WINE RACK ")).toBe("Wine Rack");
    expect(catalogGlobalSearchTerm("3015")).toBe("3015");
    expect(catalogGlobalSearchTerm("dn-w3015")).toBe("Dn-W3015");
  });
});

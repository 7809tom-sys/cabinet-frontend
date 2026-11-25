import { describe, expect, it } from "vitest";
import { countertopQuoteStyleDetails, formatQuoteDateCT } from "./countertopQuoteDisplay";

describe("formatQuoteDateCT", () => {
  it("shows the quote date in Central time with a CT label", () => {
    // 17:47 UTC on Nov 25 2026 is 11:47 AM CST.
    expect(formatQuoteDateCT(new Date("2026-11-25T17:47:00Z"))).toBe("Nov 25, 2026, 11:47 AM CT");
    expect(formatQuoteDateCT("2026-11-25T17:47:00Z")).toBe("Nov 25, 2026, 11:47 AM CT");
  });

  it("uses daylight time in summer", () => {
    expect(formatQuoteDateCT("2026-07-04T15:05:00Z")).toBe("Jul 4, 2026, 10:05 AM CT");
  });

  it("returns null for missing or bad dates", () => {
    expect(formatQuoteDateCT(null)).toBeNull();
    expect(formatQuoteDateCT("")).toBeNull();
    expect(formatQuoteDateCT("not a date")).toBeNull();
  });
});

describe("countertopQuoteStyleDetails", () => {
  it("shows the material column", () => {
    expect(countertopQuoteStyleDetails({ material: "Quartz" })).toEqual([{ label: "Material", value: "Quartz" }]);
  });

  it("returns nothing when no style was recorded", () => {
    expect(countertopQuoteStyleDetails({ material: null, roomData: { width: 144, depth: 120 } })).toEqual([]);
    expect(countertopQuoteStyleDetails({ material: "  ", roomData: null })).toEqual([]);
  });

  it("adds a specific island top only when roomData really holds a known one", () => {
    const roomData = { width: 144, persistedEntities: { island: { countertopMaterialId: "carrara-marble" } } };
    expect(countertopQuoteStyleDetails({ material: "Marble", roomData })).toEqual([
      { label: "Material", value: "Marble" },
      { label: "Island top", value: "Carrara Marble" },
    ]);
    const unknown = { persistedEntities: { island: { countertopMaterialId: "mystery" } } };
    expect(countertopQuoteStyleDetails({ material: null, roomData: unknown })).toEqual([]);
  });

  it("reads explicit style, color and edge fields and JSON strings", () => {
    const roomData = JSON.stringify({ countertopStyle: "Calacatta Gold", countertopColor: "White", edgeProfileId: "bullnose" });
    expect(countertopQuoteStyleDetails({ material: "Quartz", roomData })).toEqual([
      { label: "Material", value: "Quartz" },
      { label: "Style", value: "Calacatta Gold" },
      { label: "Color", value: "White" },
      { label: "Edge", value: "Full Bullnose" },
    ]);
  });
});

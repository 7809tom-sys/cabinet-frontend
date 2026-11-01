import { describe, expect, it } from "vitest";
import {
  AUTHORIZED_PRICE_ALTERNATIVE_FOUND_LABEL,
  applyAuthorizedPriceAlternatives,
  applicableAlternativeCabinets,
  authorizedAlternativeConfirmText,
  summarizeApplicableCodes,
  topAlternativeChoices,
} from "./planSwitchAlternativeStatus";

const alt = (cabinetId: number, masterCode: string) => ({
  cabinetId,
  masterCode,
  description: masterCode,
  category: "Base",
  subCategory: "Base",
  width: 12,
  height: 34.5,
  depth: 24,
  numberOfDoors: 1,
  numberOfDrawers: 1,
  isCornerCabinet: false,
  customerPrice: 100 + cabinetId,
});

describe("authorized price alternative status", () => {
  const items = [
    { uid: "priced", status: "priced" as const, alternatives: [] },
    { uid: "found-a", status: "alternative_available" as const, alternatives: [alt(11, "B12A"), alt(12, "B12B")] },
    { uid: "found-b", status: "alternative_available" as const, alternatives: [alt(21, "W3030A")] },
    { uid: "none", status: "no_priced_alternative" as const, alternatives: [] },
    { uid: "empty", status: "alternative_available" as const, alternatives: [] },
  ];

  it("uses the review label for the found status", () => {
    expect(AUTHORIZED_PRICE_ALTERNATIVE_FOUND_LABEL).toBe("Authorized price alternative found for this cabinet");
    expect(authorizedAlternativeConfirmText(1).title).toBe("Apply this status to 1 cabinet?");
    expect(authorizedAlternativeConfirmText(3).action).toBe("Apply to 3 cabinets");
    expect(summarizeApplicableCodes(["B12", "W3030"])).toBe("B12, W3030");
    expect(summarizeApplicableCodes(["A", "B", "C"], 2)).toBe("A, B and 1 more");
  });

  it("keeps only pending cabinets in this review that already have a price alternative", () => {
    expect(applicableAlternativeCabinets(items).map((item) => item.uid)).toEqual(["found-a", "found-b"]);
  });

  it("chooses the top-ranked alternative for every applicable cabinet", () => {
    const choices = topAlternativeChoices(items);
    expect(choices.size).toBe(2);
    expect(choices.get("found-a")?.masterCode).toBe("B12A");
    expect(choices.get("found-b")?.masterCode).toBe("W3030A");
    expect(choices.has("none")).toBe(false);
    expect(choices.has("priced")).toBe(false);
  });

  it("updates every applicable cabinet and can finish them in the selected door style", () => {
    const placed = [
      { uid: "found-a", cabinetId: 1, masterCode: "B12", width: 12, height: 34.5, depth: 24, styleId: null },
      { uid: "found-b", cabinetId: 2, masterCode: "W3030", width: 30, height: 30, depth: 12, styleId: null },
      { uid: "none", cabinetId: 3, masterCode: "SB36", width: 36, height: 34.5, depth: 24, styleId: null },
    ];
    const result = applyAuthorizedPriceAlternatives(placed, topAlternativeChoices(items), 88);
    expect(result.updatedCount).toBe(2);
    expect(result.cabinets.find((cabinet) => cabinet.uid === "found-a")).toMatchObject({
      cabinetId: 11,
      masterCode: "B12A",
      styleId: 88,
    });
    expect(result.cabinets.find((cabinet) => cabinet.uid === "found-b")).toMatchObject({
      cabinetId: 21,
      masterCode: "W3030A",
      styleId: 88,
    });
    expect(result.cabinets.find((cabinet) => cabinet.uid === "none")).toMatchObject({
      masterCode: "SB36",
      styleId: null,
    });
  });
});

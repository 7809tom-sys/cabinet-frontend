import { describe, expect, it } from "vitest";
import {
  availableOverFridgeWidths,
  closestOverFridgeSuggestion,
  exactOverFridgeCabinet,
  overFridgeCatalogDimensions,
} from "./refrigeratorOverFridgePicker";

const caps = [
  { id: 1, masterCode: "W302424", width: "30.00", height: "24.00", depth: "24.00" },
  { id: 2, masterCode: "W332424", width: "33.00", height: "24.00", depth: "24.00" },
  { id: 3, masterCode: "W362424", width: "36.00", height: "24.00", depth: "24.00" },
  { id: 4, masterCode: "W361824", width: "36.00", height: "18.00", depth: "24.00" },
] as const;

describe("over-fridge catalog picker", () => {
  it("uses one exact catalog record for the W362424 code and its 36 × 24 × 24 dimensions", () => {
    const match = exactOverFridgeCabinet(caps, { width: 36, height: 24, depth: 24 });
    expect(match?.masterCode).toBe("W362424");
    expect(match && overFridgeCatalogDimensions(match)).toEqual({ width: 36, height: 24, depth: 24 });
  });

  it("never silently substitutes W332424 when 36 × 24 × 24 has no exact catalog record", () => {
    const without36 = caps.filter((cabinet) => cabinet.masterCode !== "W362424");
    expect(exactOverFridgeCabinet(without36, { width: 36, height: 24, depth: 24 })).toBeNull();
    expect(closestOverFridgeSuggestion(without36, { width: 36, height: 24, depth: 24 })?.masterCode).toBe("W332424");
  });

  it("reports only real catalog widths for the selected height and depth", () => {
    expect(availableOverFridgeWidths(caps, 24, 24)).toEqual([30, 33, 36]);
    expect(availableOverFridgeWidths(caps, 18, 24)).toEqual([36]);
  });
});

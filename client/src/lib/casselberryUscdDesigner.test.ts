import { describe, expect, it } from "vitest";
import row from "@shared/fixtures/casselberryUscd.json";
import {
  doorColorFallbackHex,
  doorColorProvenance,
  kitchenAcceptedFaceImage,
  resolveKitchenDoorColor,
  withAcceptedAppearance,
} from "@/lib/acceptedDoorAppearance";
import { resolveDoorFinishHex } from "@/lib/doorStyleAppearance";

const CASSELBERRY = row as Parameters<typeof resolveKitchenDoorColor>[0] & Parameters<typeof resolveDoorFinishHex>[0];
const WARM_IVORY = "#eeeadf";

describe("Designer reads USCD Casselberry Warm Ivory before any render is accepted", () => {
  it("paints the kitchen #EEEADF from the style's saved color", () => {
    expect(resolveDoorFinishHex(CASSELBERRY)).toBe(WARM_IVORY);
    expect(resolveKitchenDoorColor(CASSELBERRY).appliedHex).toBe(WARM_IVORY);
    expect(doorColorFallbackHex(CASSELBERRY)).toBe(WARM_IVORY);
    expect(doorColorProvenance(CASSELBERRY)).toBe("fallback");
    expect(kitchenAcceptedFaceImage(CASSELBERRY)).toBeNull();
  });

  it("stays #EEEADF when acceptedAppearance has nothing accepted for it", () => {
    const merged = withAcceptedAppearance(CASSELBERRY, { styleId: 1, colorHex: null, textureUrl: null, approvedVersionId: null });
    expect(resolveKitchenDoorColor(merged).appliedHex).toBe(WARM_IVORY);
    expect(withAcceptedAppearance(CASSELBERRY, null)).toBe(CASSELBERRY);
  });
});

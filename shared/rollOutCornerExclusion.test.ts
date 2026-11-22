import { describe, expect, it } from "vitest";
import {
  cornerSafeDisplayText,
  displayTextWithoutRollOutTray,
  isCornerCabinetExcludedFromRollOut,
  isRollOutTrayCatalogText,
  isRollOutTrayProduct,
} from "./rollOutCornerExclusion";

describe("isCornerCabinetExcludedFromRollOut", () => {
  it("treats documented corner prefixes as corners even when the catalog flag is missing", () => {
    const codes = [
      "BBC36",
      "BBC-45",
      "BLS24",
      "BLS36",
      "LSB33",
      "LS3612",
      "WBC2430",
      "DCW2436",
      "CSB36",
      "CDB36",
      "ERB33",
      "BER36",
      "WER2430",
      "DCB36",
      "DCSB36",
      "BCB42",
      "WDC42PG",
    ];
    for (const masterCode of codes) {
      expect(isCornerCabinetExcludedFromRollOut({ masterCode, isCornerCabinet: false }), masterCode).toBe(true);
    }
  });

  it("honors a stored corner type or explicit flag", () => {
    expect(isCornerCabinetExcludedFromRollOut({ masterCode: "X-99", cornerType: "lazy-susan" })).toBe(true);
    expect(isCornerCabinetExcludedFromRollOut({ masterCode: "X-99", cornerType: "triangle" })).toBe(true);
    expect(isCornerCabinetExcludedFromRollOut({ masterCode: "X-99", isCornerCabinet: true })).toBe(true);
  });

  it("does not treat a plain base or sink base as a corner", () => {
    expect(isCornerCabinetExcludedFromRollOut({ masterCode: "B18", isCornerCabinet: false })).toBe(false);
    expect(isCornerCabinetExcludedFromRollOut({ masterCode: "B24", isCornerCabinet: false })).toBe(false);
    expect(isCornerCabinetExcludedFromRollOut({ masterCode: "SB36", isCornerCabinet: false })).toBe(false);
    expect(isCornerCabinetExcludedFromRollOut({ masterCode: "3DB24" })).toBe(false);
    expect(isCornerCabinetExcludedFromRollOut({ masterCode: "P2496" })).toBe(false);
  });
});

describe("roll-out tray text and products", () => {
  it("recognizes roll-out tray wording and tray SKUs, but not lazy-Susan trays", () => {
    expect(isRollOutTrayCatalogText("Universal rollout tray for 18-inch cabinet")).toBe(true);
    expect(isRollOutTrayCatalogText("Roll-Out Shelf, Type A — for 18\" base")).toBe(true);
    expect(isRollOutTrayCatalogText("Base Blind w/Rollout Trays")).toBe(true);
    expect(isRollOutTrayCatalogText("2 Lazy Susan trays in an easy-reach box")).toBe(false);
    expect(isRollOutTrayProduct({ masterCode: "RS18-TYPEA", description: "Roll-Out Shelf, Type A" })).toBe(true);
    expect(isRollOutTrayProduct({ masterCode: "UNIV-ROT18", description: "Universal rollout tray for 18-inch cabinet" })).toBe(true);
    expect(isRollOutTrayProduct({ masterCode: "LSB33", description: "Lazy Susan Corner Base with 2 Lazy Susan trays" })).toBe(false);
  });

  it("strips rollout-tray phrases from corner display text only", () => {
    expect(displayTextWithoutRollOutTray("Base Blind w/Rollout Trays")).toBe("Base Blind");
    expect(displayTextWithoutRollOutTray('36" Blind Corner Base Cabinet with rollout tray')).toBe(
      '36" Blind Corner Base Cabinet',
    );
    expect(displayTextWithoutRollOutTray("With roll out tray's")).toBe("");
    expect(
      displayTextWithoutRollOutTray(
        '33" W x 34-1/2" H x 24" D Lazy Susan Corner Base — 1 Door; inside per distributor: 2 Lazy Susan trays in an easy-reach box',
      ),
    ).toContain("Lazy Susan trays");

    expect(cornerSafeDisplayText("Base Blind w/Rollout Trays", { masterCode: "BCB42" })).toBe("Base Blind");
    expect(cornerSafeDisplayText("18\" One Rollout Shelf Base Cabinet Kit", { masterCode: "B181RS" })).toBe(
      "18\" One Rollout Shelf Base Cabinet Kit",
    );
  });
});

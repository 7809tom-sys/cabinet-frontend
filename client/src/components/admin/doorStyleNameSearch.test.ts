import { describe, expect, it } from "vitest";
import {
  doorStyleSearchFields,
  doorStyleSearchSummary,
  doorStyleWhiteLabels,
  matchDoorStyle,
  normalizeDoorStyleSearchText,
  whiteLabelMatchNote,
} from "./doorStyleNameSearch";

const umberShaker = doorStyleSearchFields({
  ourName: "Umber Shaker",
  aliasName: null,
  doorStyle: "Shaker",
  color: "Umber",
  distributorName: "Line A",
});

const treasureChest = doorStyleSearchFields({
  ourName: "Treasure Chest",
  aliasName: "Aurum Vault",
  doorStyle: "Shaker",
  color: "Chestnut",
  distributorName: "Preston",
});

describe("normalizeDoorStyleSearchText", () => {
  it("drops case and every space or separator", () => {
    expect(normalizeDoorStyleSearchText("Umber Shaker")).toBe("umbershaker");
    expect(normalizeDoorStyleSearchText("  UMBER   SHAKER ")).toBe(
      "umbershaker",
    );
    expect(normalizeDoorStyleSearchText("Umber-Shaker")).toBe("umbershaker");
    expect(normalizeDoorStyleSearchText(null)).toBe("");
  });
});

describe("matchDoorStyle", () => {
  it("finds a door by its real name", () => {
    const match = matchDoorStyle(umberShaker, "Umber Shaker");
    expect(match).not.toBeNull();
    expect(match!.kind).toBe("real-name");
    expect(match!.name).toBe("Umber Shaker");
    expect(match!.whiteLabel).toBeNull();
    expect(whiteLabelMatchNote(match)).toBeNull();
  });

  it("finds a door by its white label and reports which name matched", () => {
    const match = matchDoorStyle(treasureChest, "Aurum Vault");
    expect(match).not.toBeNull();
    expect(match!.kind).toBe("white-label");
    expect(match!.name).toBe("Treasure Chest");
    expect(match!.whiteLabel).toBe("Aurum Vault");
    expect(whiteLabelMatchNote(match)).toBe(
      "White label “Aurum Vault” matched — real door name Treasure Chest",
    );
  });

  it("ignores case and spacing in both directions", () => {
    expect(matchDoorStyle(umberShaker, "umbershaker")?.kind).toBe("real-name");
    expect(matchDoorStyle(umberShaker, "UMBER SHAKER")?.kind).toBe("real-name");
    expect(matchDoorStyle(umberShaker, "  umBer   shAker ")?.kind).toBe(
      "real-name",
    );
    expect(matchDoorStyle(treasureChest, "aurumvault")?.whiteLabel).toBe(
      "Aurum Vault",
    );
    expect(matchDoorStyle(treasureChest, "AURUM-VAULT")?.whiteLabel).toBe(
      "Aurum Vault",
    );
  });

  it("supports partial matches", () => {
    expect(matchDoorStyle(umberShaker, "umber")?.kind).toBe("real-name");
    expect(matchDoorStyle(umberShaker, "shak")?.kind).toBe("real-name");
    expect(matchDoorStyle(treasureChest, "aurum")?.whiteLabel).toBe(
      "Aurum Vault",
    );
    expect(matchDoorStyle(treasureChest, "vault")?.whiteLabel).toBe(
      "Aurum Vault",
    );
  });

  it("returns null when nothing matches", () => {
    expect(matchDoorStyle(umberShaker, "zzzz")).toBeNull();
    expect(matchDoorStyle(treasureChest, "not a door")).toBeNull();
    expect(matchDoorStyle(umberShaker, "   ")).toBeNull();
  });

  it("prefers the real name when the white label is the same name", () => {
    const same = doorStyleSearchFields({
      ourName: "Umber Shaker",
      aliasName: "umber shaker",
    });
    expect(doorStyleWhiteLabels(same)).toEqual([]);
    expect(matchDoorStyle(same, "umbershaker")?.kind).toBe("real-name");
  });
});

describe("doorStyleSearchSummary", () => {
  it("counts matches and reports no-match clearly", () => {
    expect(doorStyleSearchSummary(2, 40, "umber")).toBe(
      "2 of 40 door styles match “umber”.",
    );
    expect(doorStyleSearchSummary(1, 40, "umber")).toBe(
      "1 of 40 door styles match “umber”.",
    );
    expect(doorStyleSearchSummary(0, 1, "zzz")).toBe(
      "No door style matches “zzz”. Search the real door name or its white label.",
    );
    expect(doorStyleSearchSummary(0, 1, "  ")).toBe("");
  });
});

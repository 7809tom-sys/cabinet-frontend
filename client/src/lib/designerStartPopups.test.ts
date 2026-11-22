import { describe, expect, it } from "vitest";
import {
  followUpAfterCabinetStyle,
  initialDesignerPopup,
  shouldPromptFixturePick,
} from "./designerStartPopups";

const sinkBase = {
  uid: "sb-1",
  masterCode: "SB36",
  description: "Sink Base 36",
  subCategory: "Sink Base",
  placement: "base" as const,
};

describe("Start from scratch popup order", () => {
  it("opens the cabinet style and color popup on an empty start", () => {
    expect(initialDesignerPopup({
      freshEmptyStart: true,
      restoredDesign: false,
      styleChosen: false,
    })).toBe("cabinet-style");
  });

  it("opens the room layout when a style was already chosen", () => {
    expect(initialDesignerPopup({
      freshEmptyStart: true,
      restoredDesign: false,
      styleChosen: true,
    })).toBe("room-layout");
  });

  it("does not replay either opening popup over a restored design", () => {
    expect(initialDesignerPopup({
      freshEmptyStart: true,
      restoredDesign: true,
      styleChosen: false,
    })).toBeNull();
    expect(initialDesignerPopup({
      freshEmptyStart: false,
      restoredDesign: false,
      styleChosen: false,
    })).toBeNull();
  });

  it("opens the room layout only after the style popup is confirmed", () => {
    expect(followUpAfterCabinetStyle({ action: "confirm", chainRoomLayout: true })).toBe("room-layout");
  });

  it("does not open the room layout when the style popup is skipped or was not the start-from-scratch step", () => {
    expect(followUpAfterCabinetStyle({ action: "dismiss", chainRoomLayout: true })).toBeNull();
    expect(followUpAfterCabinetStyle({ action: "confirm", chainRoomLayout: false })).toBeNull();
    expect(followUpAfterCabinetStyle({ action: "dismiss", chainRoomLayout: false })).toBeNull();
  });
});

describe("sink and faucet picker trigger", () => {
  const none = new Set<string>();

  it("opens for a newly placed sink base, including one identified by category rather than SKU", () => {
    expect(shouldPromptFixturePick({ cabinet: sinkBase, promptedUids: none })).toBe(true);
    expect(shouldPromptFixturePick({
      cabinet: { uid: "odd", masterCode: "B-24", description: "Base 24", subCategory: "Sink Base", placement: "base" },
      promptedUids: none,
    })).toBe(true);
  });

  it("does not open for a regular base cabinet", () => {
    expect(shouldPromptFixturePick({
      cabinet: { uid: "b24", masterCode: "B24", description: "Base 24", subCategory: "Base", placement: "base" },
      promptedUids: none,
    })).toBe(false);
  });

  it("asks once per sink base and not again on a later render", () => {
    const asked = new Set(["sb-1"]);
    expect(shouldPromptFixturePick({ cabinet: sinkBase, promptedUids: asked })).toBe(false);
    expect(shouldPromptFixturePick({
      cabinet: { ...sinkBase, uid: "sb-2" },
      promptedUids: asked,
    })).toBe(true);
  });

  it("does not open when the sink base already has a chosen sink, faucet, or an explicit drop", () => {
    expect(shouldPromptFixturePick({
      cabinet: sinkBase,
      existingSink: { cabinetUid: "sb-1", pelicanProductId: 501 },
      promptedUids: none,
    })).toBe(false);
    expect(shouldPromptFixturePick({
      cabinet: { ...sinkBase, sinkTopProductId: 88 },
      promptedUids: none,
    })).toBe(false);
    expect(shouldPromptFixturePick({
      cabinet: { ...sinkBase, faucetProductId: 77 },
      promptedUids: none,
    })).toBe(false);
    expect(shouldPromptFixturePick({
      cabinet: sinkBase,
      explicitSinkProduct: true,
      promptedUids: none,
    })).toBe(false);
  });

  it("still opens when the only sink is an unchosen seeded basin", () => {
    expect(shouldPromptFixturePick({
      cabinet: sinkBase,
      existingSink: { cabinetUid: "sb-1", pelicanProductId: null },
      promptedUids: none,
    })).toBe(true);
  });
});

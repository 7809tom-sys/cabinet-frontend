import { describe, expect, it } from "vitest";
import {
  dialogAfterFixturePick,
  followUpAfterCabinetStyle,
  initialDesignerPopup,
  nextSinkBasePopup,
  sinkFlowCoversSelectedCabinetSheet,
  popupsForRestoredDraft,
  shouldPromptFixturePick,
  sinkBasePlacementDialog,
} from "./designerStartPopups";

const sinkBase = {
  uid: "sb-1",
  masterCode: "SB36",
  description: "Sink Base 36",
  subCategory: "Sink Base",
  placement: "base" as const,
};

describe("sink base chooser", () => {
  it("opens What goes on top first for a farm base and a regular base", () => {
    expect(sinkBasePlacementDialog({ farmSinkBase: true, promptFixturePick: true, explicitSinkProduct: false })).toBe("what-goes-on-top");
    expect(sinkBasePlacementDialog({ farmSinkBase: false, promptFixturePick: true, explicitSinkProduct: false })).toBe("what-goes-on-top");
    expect(sinkBasePlacementDialog({ farmSinkBase: true, promptFixturePick: false, explicitSinkProduct: false })).toBe("none");
    expect(sinkBasePlacementDialog({ farmSinkBase: false, promptFixturePick: true, explicitSinkProduct: true })).toBe("none");
  });

  it("follows What goes on top into one sink list, then one faucet list", () => {
    expect(nextSinkBasePopup({ from: "placement", action: "open" })).toBe("what-goes-on-top");
    expect(nextSinkBasePopup({ from: "what-goes-on-top", action: "sink" })).toBe("pick-sink");
    expect(nextSinkBasePopup({ from: "what-goes-on-top", action: "range-top" })).toBe("range-top");
    expect(nextSinkBasePopup({ from: "pick-sink", action: "pick-sink" })).toBe("pick-faucet");
    expect(nextSinkBasePopup({ from: "pick-faucet", action: "pick-faucet" })).toBe("none");
  });

  it("keeps the phone selected-cabinet sheet under every sink-flow step", () => {
    expect(sinkFlowCoversSelectedCabinetSheet({ fixturePickOpen: false, sinkBaseDialogOpen: true })).toBe(true);
    expect(sinkFlowCoversSelectedCabinetSheet({ fixturePickOpen: true, sinkBaseDialogOpen: false })).toBe(true);
    expect(sinkFlowCoversSelectedCabinetSheet({ fixturePickOpen: false, sinkBaseDialogOpen: false })).toBe(false);
  });

  it("ends the flow when any step is dismissed, with no chooser underneath", () => {
    expect(dialogAfterFixturePick()).toBeNull();
    for (const from of ["placement", "what-goes-on-top", "pick-sink", "pick-faucet", "range-top"] as const) {
      expect(nextSinkBasePopup({ from, action: "dismiss" })).toBe("none");
    }
    expect(nextSinkBasePopup({ from: "pick-sink", action: "dismiss" })).not.toBe("what-goes-on-top");
  });
});

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

describe("version refresh restores an in-progress draft", () => {
  const sb1 = { ...sinkBase, uid: "sb-1", sinkTopProductId: 501 };
  const chosen = { cabinetUid: "sb-1", pelicanProductId: 501 };
  const sb2 = { ...sinkBase, uid: "sb-2" };

  it("does not open any popup for sink base 1, then opens for a newly placed sink base 2", () => {
    const restored = popupsForRestoredDraft({
      restoredSnapshot: true,
      placed: [sb1],
      sinks: [chosen],
      promptedUids: ["sb-1"],
    });
    expect(restored.openFixturePick).toBe(false);
    expect(restored.openingPopup).toBeNull();
    expect(restored.suppressOpeningPopups).toBe(true);

    const memory = new Set(restored.promptedUids);
    expect(shouldPromptFixturePick({ cabinet: sb1, existingSink: chosen, promptedUids: memory })).toBe(false);
    expect(shouldPromptFixturePick({ cabinet: sb2, promptedUids: memory })).toBe(true);
  });

  it("keeps the once-per-base memory across a second refresh after sink base 2 was asked", () => {
    const first = popupsForRestoredDraft({
      restoredSnapshot: true,
      placed: [sb1],
      sinks: [chosen],
      promptedUids: ["sb-1"],
    });
    const afterSecondBase = new Set(first.promptedUids);
    afterSecondBase.add("sb-2");
    const refreshed = popupsForRestoredDraft({
      restoredSnapshot: true,
      placed: [sb1, sb2],
      sinks: [chosen],
      promptedUids: [...afterSecondBase],
    });
    const memory = new Set(refreshed.promptedUids);
    expect(refreshed.openFixturePick).toBe(false);
    expect(refreshed.suppressOpeningPopups).toBe(true);
    expect(shouldPromptFixturePick({ cabinet: sb1, existingSink: chosen, promptedUids: memory })).toBe(false);
    expect(shouldPromptFixturePick({ cabinet: sb2, promptedUids: memory })).toBe(false);
  });

  it("treats sink bases already in an older draft as asked, even without the saved list", () => {
    const restored = popupsForRestoredDraft({
      restoredSnapshot: true,
      placed: [sb1],
      sinks: [chosen],
      promptedUids: null,
    });
    expect(restored.openFixturePick).toBe(false);
    expect(restored.suppressOpeningPopups).toBe(true);
    expect(restored.promptedUids).toContain("sb-1");
    expect(shouldPromptFixturePick({
      cabinet: sb2,
      promptedUids: new Set(restored.promptedUids),
    })).toBe(true);
  });

  it("does not suppress the style popup when the restored draft has no plan", () => {
    const restored = popupsForRestoredDraft({
      restoredSnapshot: true,
      placed: [],
      sinks: [],
      promptedUids: [],
    });
    expect(restored.suppressOpeningPopups).toBe(false);
    expect(restored.promptedUids).toEqual([]);
  });
});

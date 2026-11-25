/**
 * Start from scratch opens the cabinet style popup, then the room layout after
 * that choice is confirmed. The faucet and sink popup is not part of that chain.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Start from scratch popup chain", () => {
  it("does not open the faucet and sink popup when the designer opens", () => {
    expect(source).not.toContain("fixturePickShownRef");
    expect(source).not.toContain("setFixturePickOpen(true);\n  }, [autoDesignAvailable]);");
  });

  it("opens the cabinet style popup on an empty start and the room layout only after it is confirmed", () => {
    expect(source).toContain("initialDesignerPopup({");
    expect(source).toContain("chainRoomLayoutAfterStyleRef.current = true;");
    expect(source).toContain("setCatalogSetupOpen(true);");
    expect(source).toContain('finishCabinetStylePopup("confirm")');
    expect(source).toContain('finishCabinetStylePopup("dismiss")');
    expect(source).toContain("followUpAfterCabinetStyle({");
    expect(source).toContain('window.setTimeout(() => setLayoutStarterOpen(true), 0);');
  });

  it("persists the asked sink bases in the draft and does not reopen them on refresh", () => {
    expect(source).toContain("fixturePickPromptedUids: [...fixturePickPromptedUidsRef.current]");
    expect(source).toContain("popupsForRestoredDraft({");
    const restoreStart = source.indexOf("const refresh = popupsForRestoredDraft({");
    const restore = source.slice(restoreStart, source.indexOf("draftRestoredRef.current = true;", restoreStart));
    expect(restore).toContain("popupsForRestoredDraft({");
    expect(restore).not.toContain("setFixturePickOpen(true)");
    expect(restore).not.toContain("setCatalogSetupOpen(true)");
    expect(restore).not.toContain("setLayoutStarterOpen(true)");
  });

  it("asks for a faucet and sink only when a sink base is placed", () => {
    expect(source).toContain("shouldPromptFixturePick({");
    expect(source).toContain('(roomType === "kitchen" || farmSinkBase)');
    const placement = source.slice(
      source.indexOf("if (isSinkBaseCabinet(finalCab)) {"),
      source.indexOf("if (isFloatingShelfItem(finalCab)) {"),
    );
    expect(placement).toContain("shouldPromptFixturePick({");
    expect(placement).toContain("sinkBasePlacementDialog({");
    expect(placement).toContain("placementDialog === \"what-goes-on-top\"");
    expect(placement).not.toContain("setFixturePickOpen(true)");
    expect(placement).toContain("setSinkBaseDialog(null)");
    const dismiss = source.slice(source.indexOf("const dismissFixturePick"), source.indexOf("const applyAttachedCabinetFillers"));
    expect(dismiss).toContain("setFixturePickOpen(false)");
    expect(dismiss).toContain("fixturePickAllowedRef.current = false");
    expect(dismiss).toContain("setSinkBaseDialog(null)");
    expect(dismiss).not.toContain("setSinkBaseDialog({");
    expect(dismiss).not.toContain("setFixturePickOpen(true)");
    expect(source).toContain("step={fixturePickStep}");
    expect(source).toContain("onPickSink={pickFixtureSink}");
    expect(source).toContain("onPickFaucet={pickFixtureFaucet}");
    expect(source).not.toContain("Pick your faucet and sink");
  });
});

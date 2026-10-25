import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

function clearDesignBlock() {
  const start = source.indexOf("const resetCurrentDesign = usePersistFn(");
  const end = source.indexOf("// Sync sheet open state with selection on mobile", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("DesignTool authoritative Clear Design transaction", () => {
	it("clears the plan, room geometry, temporary 3D sources, selections, fixtures, warnings, history, and draft persistence together", () => {
	  const block = clearDesignBlock();
	  for (const required of [
	    "const emptyRoom: RoomData = { ...DEFAULT_ROOM }",
	    "setRoom(emptyRoom)",
	    "room.vertices?.length",
	    "room.customWalls?.length",
	    "room.peninsulaRuns?.length",
	    "smartGapPreviewSessionRef.current = null",
	      "historyRebaseRequestedRef.current = true",
		    "lastPushedRef.current = null",
	    "placedRef.current = emptyPlaced",
	    "styleIdRef.current = null",
	    "styleBRef.current = null",
	    "loadedDesignRef.current = null",
	    "loadedBundleRef.current = null",
	    "clearDraft()",
      "setPlaced(emptyPlaced)",
      "setSmartGapPreview([])",
      "setSmartGapPreviewPosition(null)",
      "setPlacementWarning(null)",
      "setFailedWallFit(null)",
      "setOpenings([])",
      "setSinks([])",
      "setFurniture([])",
      "setPonyWalls([])",
      "setAnnotations([])",
      "setSelectedUid(null)",
      "setSelectedOpeningUid(null)",
      "setSelectedSinkUid(null)",
      "setSelectedFurnUid(null)",
      "setSelectedPonyWallUid(null)",
      "setSelectedAnnotationUid(null)",
	    "setInteractive3dPresentation(null)",
	    "setLoadedBundlePriceLock(null)",
	    "setActiveSavedDesignId(null)",
	    "setSelectedLayoutPresetId(null)",
	    "setContinuousWallDraft(null)",
	    "setStyleId(null)",
	    "setStyleA(null)",
	    "setStyleB(null)",
	    "setLockedDistributorId(null)",
	    "setMixedWarehouseOverride(false)",
	    "setBacksplashHeightMode(\"standard\")",
	    "setCountertopBacksplashHeightIn(0)",
	    'setActiveWall("top")',
	    "setCompassWallStartIn(null)",
	    "setPeninsulaDraft(null)",
	    "setWallSettingsOpen(false)",
	    "setWallSettingsDraft(null)",
	    "setPeninsulaDeletePrompt(null)",
	    'setPlacementTarget("wall")',
	    'setViewMode("plan")',
	  ]) {
      expect(block).toContain(required);
    }
  });

  it("removes saved-design and bundle route ownership so refresh cannot repopulate the cleared canvas", () => {
    const block = clearDesignBlock();
    expect(block).toContain('url.searchParams.delete("load")');
	    expect(block).toContain('url.searchParams.delete("designId")');
	    expect(block).toContain('url.searchParams.delete("crmDeal")');
    expect(block).toContain('url.searchParams.delete("bundleId")');
	    expect(block).toContain('url.searchParams.delete("style")');
	    expect(block).toContain('navigate(`${url.pathname}${url.search}${url.hash}`, { replace: true })');
  });

	  it("starts a blank design without a second prompt after permanent deletion and removes a matching design cart", () => {
	    const block = clearDesignBlock();
	    expect(block).toContain("options?.skipConfirmation");
	    expect(block).toContain("options?.deletedDesignId != null && cartSourceDesignId === options.deletedDesignId");
	    expect(block).toContain("const startBlankAfterDeletedDesign = usePersistFn((designId: number)");
	    expect(source).toContain("onDeleteSuccess={(designId) => startBlankAfterDeletedDesign(designId)}");
	  });

  it("prompts for a room layout after every complete new-kitchen reset", () => {
    const block = clearDesignBlock();
    expect(block).toContain("setSelectedLayoutPresetId(null)");
    expect(block).toContain("setContinuousWallDraft(null)");
    expect(block).toContain("setLayoutStarterOpen(true)");
    expect(source).toContain("<Dialog open={layoutStarterOpen} onOpenChange={setLayoutStarterOpen}>");
    expect(source).toContain("Start with a room layout");
    expect(source).toContain("<RoomLayoutStarter");
  });

  it("starts a new drawing with only the automatic toe kick selected", () => {
    const block = clearDesignBlock();
    expect(source).toContain("const [toeKick, setToeKick] = useState(true);");
    expect(block).toContain("setToeKick(true);");
    for (const optionalSelection of [
      "setCrown(false);",
      "setBatten(false);",
      "setLightRail(false);",
      "setValance(false);",
      "setCountertop(false);",
      "setIsland(null);",
    ]) {
      expect(block).toContain(optionalSelection);
    }
    expect(source).toContain('checked={!!island}');
    expect(source).toContain("checked={toeKick}");
    expect(source).toContain("checked={crown}");
    expect(source).toContain("checked={batten}");
    expect(source).toContain("checked={lightRail}");
    expect(source).toContain("checked={valance}");
  });

  it("resets the active cabinet or parts catalog back to condensed category headings", () => {
    const block = clearDesignBlock();
    expect(block).toContain("setCollapsedGroups(new Set());");
    expect(block).toContain("setCatalogCollapseRequest(COLLAPSIBLE_CATALOG_TABS.has(paletteType) ? paletteType : null);");
  });

  it("also prompts when verified draft restoration finds no designed kitchen", () => {
    expect(source).toContain("let restoredDesignedKitchen = false");
    expect(source).toContain("restoredDesignedKitchen = true");
    expect(source).toContain("if (!restoredDesignedKitchen && !roomLayoutHandoffAppliedRef.current)");
    expect(source).toContain("setLayoutStarterOpen(true)");
  });

  it("routes both desktop and phone/tablet clear controls through the same transaction", () => {
    expect(source.match(/onClick=\{clearCurrentDesign\}/g)?.length).toBe(2);
  });
});

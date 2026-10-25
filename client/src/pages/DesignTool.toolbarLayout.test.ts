import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const designActionsSource = readFileSync(new URL("../components/design/DesignActions.tsx", import.meta.url), "utf8");
const roomSizeSource = readFileSync(new URL("../components/design/RoomSizeControl.tsx", import.meta.url), "utf8");
const planCanvasSource = readFileSync(new URL("../components/design/PlanCanvas.tsx", import.meta.url), "utf8");

describe("designer toolbar layout", () => {
  it("keeps the More-menu portal state hook inside the Design Tool component", () => {
    const hook = source.indexOf("const [moreToolsPortalElement, setMoreToolsPortalElement] = useState");
    const verifiedGate = source.indexOf("if (!verified)");

    expect(hook).toBeGreaterThan(-1);
    expect(hook).toBeLessThan(verifiedGate);
  });

  it("keeps one AI consultant control and one labeled primary 3D switch", () => {
    expect(source.match(/<ConsultantRoomControl/g)).toHaveLength(1);
    expect(source.match(/data-testid="switch-to-3d-view"/g)).toHaveLength(1);
    expect(source).not.toContain('> 3D</Button>');
    expect(source).not.toContain('title="Show the synchronized 3D designer canvas"');
  });

  it("uses the labeled Wall dropdown instead of duplicate wall tabs and an icon-only auto-fill button", () => {
    expect(source.match(/data-testid="compact-workspace-wall-selector"/g)).toHaveLength(1);

    const desktopToolbarStart = source.indexOf("{/* Wall selection lives in the labeled Wall dropdown above. */}");
    const desktopToolbarEnd = source.indexOf("{/* Save Design", desktopToolbarStart);
    const desktopToolbar = source.slice(desktopToolbarStart, desktopToolbarEnd);

    expect(desktopToolbarStart).toBeGreaterThan(-1);
    expect(desktopToolbarEnd).toBeGreaterThan(desktopToolbarStart);
    expect(desktopToolbar).not.toContain("room.customWalls.map");
    expect(desktopToolbar).not.toContain("onClick={autoFillActiveWall}");
  });

  it("removes the highlighted duplicate Hybrid, Corner, Save, and selected-delete desktop controls", () => {
    expect(source).not.toContain('onClick={() => setViewMode("hybrid")}');
    expect(source).not.toContain('onClick={() => setViewMode("corner")}');
    expect(designActionsSource).not.toContain('title={t("dt_act_save_btn")}');

    const desktopActionsStart = source.indexOf("{/* Desktop action cluster */}");
    const desktopActionsEnd = source.indexOf("{/* Lock Cabs */}", desktopActionsStart);
    const desktopSelectedActions = source.slice(desktopActionsStart, desktopActionsEnd);
    expect(desktopSelectedActions).not.toContain("onClick={deleteSelected}");

    expect(source).toContain('title="Save design"');
    expect(source).toContain("onClick={clearCurrentDesign}");
    expect(source).toContain("onRemoveCabinet={deleteCabinet}");
  });

  it("renders the desktop More menu into the slot beside the distributor selector", () => {
    const distributorRow = source.indexOf("Distributor selector and relocated desktop More menu");
    const slot = source.indexOf('data-testid="catalog-more-tools-slot"');
    const portal = source.indexOf("moreToolsPortalElement && createPortal(");
    const trigger = source.indexOf('title="More tools"');

    expect(distributorRow).toBeGreaterThan(-1);
    expect(slot).toBeGreaterThan(distributorRow);
    expect(portal).toBeGreaterThan(-1);
    expect(trigger).toBeGreaterThan(portal);
  });

  it("keeps one Wall tab and removes the redundant visible Wall By Ht tab", () => {
    const tabsStart = source.indexOf("{/* Catalog tabs.");
    const tabsEnd = source.indexOf(").map((tab) => (", tabsStart);
    const visibleTabs = source.slice(tabsStart, tabsEnd);

    expect(visibleTabs).toContain('"wall"');
    expect(visibleTabs).not.toContain('"wallht"');
    // Preserve the legacy internal mapping so a hot-reloaded old selection still
    // resolves to the normal Wall catalog rather than issuing an invalid query.
    expect(source).toContain('paletteType === "wallht"');
  });

  it("removes redundant desktop cabinet adjustment controls while preserving the attributes workflow", () => {
    const contextualStart = source.indexOf("{/* Contextual row:");
    const contextualEnd = source.indexOf("{isBaseBlindCorner(selectedCab)", contextualStart);
    const desktopSelectedStrip = source.slice(contextualStart, contextualEnd);

    expect(desktopSelectedStrip).not.toContain("<WallPicker");
    expect(desktopSelectedStrip).not.toContain("<DimStepper");
    expect(desktopSelectedStrip).not.toContain("adjustMountHeight(");
    expect(source).toContain("<CabinetAttributesDialog");
    expect(source).toContain("onMoveCabinet={cabinetsLocked ? undefined : moveCabinetFrom3D}");
  });

  it("keeps Materials & Parts as direct toolbar actions and removes every More-menu duplicate", () => {
    // Three direct desktop/mobile actions plus the tablet Workspace row use the
    // same all-items opener; the red count remains a separate shortcut.
    expect(source).toContain('const openMaterialsList = (initialConflictsOnly = false) => {');
    expect(source).toContain('data-testid="compact-workspace-materials-trigger"');
    expect(source).toContain('data-testid="tablet-more-materials-trigger"');
    expect(source).toContain('ariaLabel="Materials"');
    expect(source).toContain("Materials &amp; Parts");
    expect(source).not.toContain("Materials &amp; Parts List");
  });

  it("keeps island placement controls in a collapsed side panel instead of over the canvas", () => {
    expect(source).toContain("const [islandPlacementPanelExpanded, setIslandPlacementPanelExpanded]");
    expect(source).toContain('data-testid="island-placement-panel-toggle"');
    expect(source).toContain('aria-controls="island-placement-side-panel"');
    expect(source).toContain('data-testid="island-placement-side-panel"');
    expect(source).toContain('className="absolute right-3 top-14 z-40 flex flex-col items-end gap-2 sm:top-16"');
    expect(source).not.toContain('sm:left-1/2 sm:right-auto sm:-translate-x-1/2');
  });

	it("keeps Room Size visible in compact desktop workspace and reachable on mobile", () => {
	  expect(source).toContain('className={`${isTabletWorkspace ? "hidden" : "hidden lg:block"} ${layoutLocked ? "pointer-events-none opacity-50" : ""}`}');
  // Tablets fold Room Size into the More tools sheet instead.
  expect(source).toContain('data-testid="tablet-more-room-size"');
	  expect(roomSizeSource).toContain('aria-label="Open room size"');
	  expect(roomSizeSource).toContain("<span>Room size</span>");
	  expect(source).toContain("<RoomSizeControl");
	});

	it("gives every compact top-toolbar icon a hover label and accessible name", () => {
	  const iconControlsStart = source.indexOf("{/* Elevation, split, and island-only precision views. */}");
	  const iconControlsEnd = source.indexOf("{/* Mobile: icon-only compact buttons in top bar */}", iconControlsStart);
	  const iconControls = source.slice(iconControlsStart, iconControlsEnd);

	  expect(iconControls).toContain('title={t("dt_sh_front_view")}');
	  expect(iconControls).toContain('aria-label={t("dt_sh_front_view")}');
	  expect(iconControls).toContain('title={t("dt_sh_split")}');
	  expect(iconControls).toContain('aria-label={t("dt_sh_split")}');
	  expect(iconControls).toContain('title={currentSavedDesignId != null ? "Update this saved design" : "Save this design"}');
	  expect(iconControls).toContain('aria-label={currentSavedDesignId != null ? "Update design" : "Save design"}');
	  expect(iconControls).toContain('title="Start new design (clears all cabinets)"');
	  expect(iconControls).toContain('aria-label="Start new design and clear all cabinets"');
	  expect(iconControls).toContain('title="Export high-resolution Floor Plan image"');
	  expect(iconControls).toContain('aria-label="Export high-resolution Floor Plan image"');
	  expect(iconControls).toContain('title="Export dimensioned Floor Plan as PDF"');
	  expect(iconControls).toContain('aria-label="Export dimensioned Floor Plan as PDF"');
	});

	  it("offers one-click whole-drawing rotation in the Floor Plan canvas for explicit custom wall rooms", () => {
	    expect(source).toContain("onRotateDrawing={isPolygonRoom ? rotateDrawingClockwise : undefined}");
	    expect(source).toContain("drawingRotationDisabled={layoutLocked}");
	    expect(source).toContain("rotateCustomPlanClockwise({");
	    const rotationHandler = source.slice(source.indexOf("const rotateDrawingClockwise"), source.indexOf("// Backsplash material"));
	    expect(rotationHandler).toContain("roomRef.current = rotated.room;");
	    expect(rotationHandler.indexOf("roomRef.current = rotated.room;")).toBeLessThan(rotationHandler.indexOf("setPlaced(rotated.cabinets);"));
	  });


	  it("keeps wall visibility in the one responsive Floor Plan action rail", () => {
	    // Two PlanCanvas call sites plus the synchronized 3D-view visibility control.
	    expect(source.match(/onToggleWallLayer=\{\(\) => setShowWallLayer/g)).toHaveLength(3);
	    expect(source).not.toContain('data-testid="floor-plan-wall-layer-control"');
	    expect(planCanvasSource).toContain('data-testid="floor-plan-wall-layer-toggle"');
	    expect(planCanvasSource).toContain('aria-label={showWallLayer ? "Hide wall cabinets in this Floor Plan view" : "Show wall cabinets in this Floor Plan view"}');
	    expect(planCanvasSource).toContain('<span className="max-[300px]:hidden sm:hidden">Walls</span>');
	    expect(planCanvasSource).toContain('<span className="hidden min-[360px]:inline">Measurements</span>');
	    expect(planCanvasSource).toContain('<RotateCw className="h-4 w-4" /> <span className="max-[300px]:hidden">Rotate</span>');
	  });

	  it("keeps mobile Door & hardware editing direct without a large layout graphic", () => {
    const sheetStart = source.indexOf("{isMobile && selectedCab && !drawMode && !measureMode && (");
    const sheetEnd = source.indexOf("<WallPicker", sheetStart);
    const mobileCabinetSheet = source.slice(sheetStart, sheetEnd);

    expect(sheetStart).toBeGreaterThan(-1);
    expect(sheetEnd).toBeGreaterThan(sheetStart);
    expect(mobileCabinetSheet).toContain('data-testid="mobile-cabinet-door-hardware"');
    expect(mobileCabinetSheet).toContain("Door &amp; hardware");
    expect(mobileCabinetSheet).toContain('aria-label="Remove door"');
    expect(mobileCabinetSheet).toContain("supportsCenteredTopDoorPull(selectedCab)");
    expect(mobileCabinetSheet).toContain("usesRaisedFloorWallDoorPull(selectedCab)");
    expect(mobileCabinetSheet).not.toContain("DoorDrawerDiagram");
  });
});

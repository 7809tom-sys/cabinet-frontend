import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const designToolSource = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");
const nativeThreeDStart = designToolSource.indexOf("const renderNativeThreeDCanvas");
const nativeThreeDEnd = designToolSource.indexOf("\n  if (!verified)", nativeThreeDStart);
const nativeThreeDSource = designToolSource.slice(nativeThreeDStart, nativeThreeDEnd);

describe("DesignTool deterministic 3D preview routing", () => {
  it("routes all preview controls through InteractiveRoom3D rather than the simplified preview modal", () => {
    expect(designToolSource).toContain('onClick={() => setViewMode("threeD")}');
    expect(designToolSource).toContain('setTimeout(() => setViewMode("threeD"), 150)');
    expect(designToolSource).toContain('title="3D view"');
    expect(designToolSource).not.toContain('onClick={() => setViewMode("hybrid")}');
    expect(designToolSource).toContain("<InteractiveRoom3D");
    expect(designToolSource).not.toContain("<DesignPreviewModal");
    expect(designToolSource).not.toContain("setPreviewModalOpen");
    expect(nativeThreeDStart).toBeGreaterThan(-1);
    expect(nativeThreeDEnd).toBeGreaterThan(nativeThreeDStart);
    expect(nativeThreeDSource).toMatch(/<InteractiveRoom3D[\s\S]*?placed=\{deferredCountertopGeometry\.threeDPlaced\}[\s\S]*?crown=\{crown\}[\s\S]*?toeKick=\{toeKick\}[\s\S]*?catalogDropWall=\{activeWall\}/);
  });

  it("opens a loaded saved plan in the deterministic renderer even before a door style is selected", () => {
    expect(designToolSource).toContain("const hasPersistedTwoDPlan");
    expect(designToolSource).toContain("const savedPlanInteractive3dScene");
    expect(designToolSource).toContain("resolvedInteractive3dScene");
    expect(designToolSource).toContain("enabled: canLoadCatalogInteractive3d");
  });

  it("passes the live selected door profile into persisted 3D scenes whose stored material metadata is neutral", () => {
	  expect(designToolSource).toContain("catalogDoorProfile={activeStyle ? (() => {");
	  expect(designToolSource).toContain("designerDoorFrameMetrics(styleProfile");
    expect(designToolSource).toContain("doorStyle: activeStyle.doorStyle ?? activeStyle.ourName ?? null");
    expect(designToolSource).toContain("doorPanelType: activeStyle.doorPanelType ?? null");
  });

  it("supports a guarded direct 3D preview link after a saved 2D plan is ready", () => {
    expect(designToolSource).toContain('get("preview") === "3d"');
    expect(designToolSource).toContain("requestedThreeDPreview");
    expect(designToolSource).toContain("!canLoadInteractive3d || interactive3dLoading");
    expect(designToolSource).toContain('setViewMode("threeD")');
  });

  it("keeps the desktop preview control compact while retaining the explicit 3D action", () => {
    expect(designToolSource).toContain('<Boxes className="mr-1.5 h-3.5 w-3.5" /> 3D');
    expect(designToolSource).not.toContain('<Boxes className="mr-1.5 h-3.5 w-3.5" /> 3D preview');
    expect(designToolSource).toContain('<Boxes className="h-3.5 w-3.5" />');
  });

  it("uses intuitive compact arrows for the standard Back, Front, Left, and Right wall controls", () => {
    expect(designToolSource).toContain("const wallDirectionIcon: Record<WallSide, typeof ArrowUp> = {");
    expect(designToolSource).toContain("top: ArrowUp,");
    expect(designToolSource).toContain("bottom: ArrowDown,");
    expect(designToolSource).toContain("left: ArrowLeft,");
    expect(designToolSource).toContain("right: ArrowRight,");
    expect(designToolSource).toContain('aria-label={wallLabel[w]}');
  });
});

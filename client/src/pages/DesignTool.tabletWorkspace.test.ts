import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const designTool = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const room3d = readFileSync(new URL("../components/design/InteractiveRoom3D.tsx", import.meta.url), "utf8");
const topNav = readFileSync(new URL("../components/TopNav.tsx", import.meta.url), "utf8");
const hook = readFileSync(new URL("../hooks/useTabletWorkspace.ts", import.meta.url), "utf8");

describe("tablet workspace layout (1024–1366px or touch)", () => {
  it("defines the tablet tier by width only (1024–1366px); a wide touch screen keeps the desktop selector", () => {
    expect(hook).toContain("TABLET_WORKSPACE_MAX_WIDTH = 1366");
    expect(hook).toContain("width >= PHONE_WORKSPACE_MAX_WIDTH && width <= TABLET_WORKSPACE_MAX_WIDTH;");
    expect(hook).not.toContain("|| touch)");
    // Compact (drawer) mode is still decided by the original small-laptop rule alone.
    expect(designTool).toContain('|| (compactWorkspaceOverride === "auto" && isSmallLaptop)\n  );');
  });

  it("keeps a compact non-scrolling toolbar with the essentials and folds the rest into More tools", () => {
    expect(designTool).toContain('data-testid="designer-toolbar" data-tablet-workspace={isTabletWorkspace ? "true" : undefined}');
    expect(designTool).toContain("designer-top-toolbar border-b border-border bg-card px-2 py-1 flex flex-wrap");
    expect(designTool).toContain('data-testid="tablet-add-cabinet"');
    expect(designTool).toContain('data-testid="tablet-undo-redo"');
    expect(designTool).toContain('data-testid="tablet-running-total"');
    expect(designTool).toContain('{isTabletWorkspace ? "More tools" : "More"}');
    expect(designTool).toContain('data-testid="tablet-workspace-more-section"');
    expect(designTool).toContain('data-testid="tablet-more-room-size"');
    expect(designTool).toContain('data-testid="tablet-more-selected-actions"');
    // Desktop-only clusters are hidden on tablets, not just scrolled off-screen.
    expect(designTool).toContain('className={`${isTabletWorkspace ? "hidden" : "hidden lg:flex"} items-center gap-1`}');
    expect(designTool).toContain('className={`${isTabletWorkspace ? "hidden" : "hidden lg:block"}');
  });

  it("docks the toolbar at the bottom in portrait", () => {
    expect(designTool).toContain('isTabletPortrait ? "order-last border-b-0 border-t"');
  });

  it("keeps the catalog as the wide left-side panel and the cabinet editor as a dialog (owner preference)", () => {
    expect(designTool).toContain('<SheetContent side="left" className={compact ? "w-[min(840px,96vw)] p-0 gap-0 flex flex-col"');
    expect(designTool).not.toContain("tablet-catalog-bottom-sheet");
    const attributes = readFileSync(new URL("../components/design/CabinetAttributesDialog.tsx", import.meta.url), "utf8");
    expect(attributes).not.toContain("isTablet");
  });

  it("keeps the primary Peninsula Wizard action directly visible on tablets", () => {
    expect(designTool).toContain('data-testid="primary-peninsula-wizard"');
    expect(designTool).toContain('isTabletWorkspace ? "inline-flex h-10 min-w-11 px-3" : "hidden lg:inline-flex"');
    expect(designTool).toContain('{isTabletWorkspace ? "Peninsula" : "Peninsula Wizard"}');
  });

  it("collapses the 3D floating row, fitted fillers, and pan pad on tablets", () => {
    expect(room3d).toContain("const tabletOverlay = embedded && tabletTier.tablet;");
    expect(room3d).toContain('${tabletOverlay ? "hidden" : "hidden sm:flex"}');
    expect(room3d).toContain('data-testid="three-d-fitted-filler-chip"');
    expect(room3d).toContain("Fillers ({fittedFillerLabels.length})");
    expect(room3d).toContain('compact hidePan={tabletTier.touch} testId="three-d-tablet-navigation"');
    expect(room3d).toContain("{!tabletOverlay && <button type=\"button\" data-testid=\"three-d-add-cabinet-mobile\"");
  });

  it("hides the site header behind a CD button in full-screen design mode", () => {
    expect(topNav).toContain('data-testid="designer-immersive-restore"');
    expect(topNav).toContain('data-testid="designer-immersive-hide"');
    expect(topNav).toContain("if (isDesignerTablet && immersive)");
  });
});

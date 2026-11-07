import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const designTool = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const room3d = readFileSync(new URL("../components/design/InteractiveRoom3D.tsx", import.meta.url), "utf8");
const topNav = readFileSync(new URL("../components/TopNav.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./DesignTool.toolbar.css", import.meta.url), "utf8");

describe("Designer canvas-only mode wiring", () => {
  it("puts one square toggle in the top right of the 3D viewer", () => {
    const toggle = room3d.slice(room3d.indexOf('data-testid="three-d-immersive-toggle"') - 400);
    expect(room3d).toContain('data-testid="three-d-immersive-toggle"');
    // Square, thumb-sized, and pinned to the viewer's own top-right corner.
    expect(toggle).toContain("h-11 w-11");
    expect(toggle).toContain("absolute right-3 top-3");
    // The icon pair matches the rest of the viewer.
    expect(toggle).toContain("<Maximize2");
    expect(toggle).toContain("<Minimize2");
    // Accessible label and tooltip change with state.
    expect(toggle).toContain("aria-label={immersiveToggleLabel(immersive).ariaLabel}");
    expect(toggle).toContain("title={immersiveToggleLabel(immersive).title}");
    expect(toggle).toContain("aria-pressed={immersive}");
    // The stage must not treat the toggle as a canvas click.
    expect(toggle).toContain("onPointerDown={(event) => event.stopPropagation()}");
  });

  it("renders the toggle only where the Designer can actually hide the chrome", () => {
    expect(room3d).toContain("onToggleImmersive && (");
    expect(designTool).toContain("immersive={canvasOnly}");
    expect(designTool).toContain("onToggleImmersive={toggleCanvasOnly}");
  });

  it("hides all four bars instead of unmounting them", () => {
    // 1. site header
    expect(topNav).toContain("useDesignerCanvasOnly()");
    expect(topNav).toContain('data-canvas-only-hidden={designerCanvasOnly && location.startsWith("/design") ? "true" : undefined}');
    expect(topNav).toContain('${designerCanvasOnly && location.startsWith("/design") ? "hidden" : ""}');
    // 2. page-history row
    expect(app).toContain('data-canvas-only-hidden={designerCanvasOnly ? "true" : undefined}');
    expect(app).toContain('className={designerCanvasOnly ? "hidden" : undefined}');
    // 3. designer toolbar
    expect(designTool).toContain('data-canvas-only-hidden={canvasOnly ? "true" : undefined}');
    expect(designTool).toContain('${canvasOnly ? "hidden" : ""}');
    // 4. phone bottom bar
    expect(designTool).toContain('className={`fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur lg:hidden ${canvasOnly ? "hidden" : ""}`}');
    // The selected cabinet keeps its state because the bar is hidden, not removed.
    expect(designTool).toContain('data-testid="designer-root"');
    expect(designTool).toContain('data-canvas-only={canvasOnly ? "true" : undefined}');
  });

  it("expands the canvas to the viewport and lets the renderer re-measure", () => {
    expect(designTool).toContain('canvasOnly ? "fixed inset-0 z-50 flex h-[100dvh] w-screen flex-col overflow-hidden bg-background" : "flex flex-col h-full min-h-0"');
    expect(designTool).toContain('canvasOnly ? "relative flex flex-1 min-w-0 min-h-0 flex-col overflow-hidden" : DESIGNER_CANVAS_CONTAINER_CLASS');
    // The 3D mount is sized by its own ResizeObserver; a post-commit resize event
    // makes the first immersive frame full-size instead of the previous one.
    expect(room3d).toContain("new ResizeObserver");
    expect(designTool).toContain('window.dispatchEvent(new Event("resize"))');
  });

  it("collapses both side panels so the canvas fills the screen", () => {
    expect(designTool).toContain("hidden={canvasOnly}");
    expect(designTool).toContain("if (hidden) return null;");
    // A drawer that was open when the toggle was pressed must not cover the canvas.
    expect(designTool).toContain("<Sheet open={open && !hidden} onOpenChange={onOpenChange}>");
  });

  it("requests real browser fullscreen but survives refusal and keeps an exit on screen", () => {
    expect(designTool).toContain("shouldRequestBrowserFullscreen({");
    expect(designTool).toContain("void element.requestFullscreen().catch(() => undefined);");
    // A refusal must not undo immersive mode or raise an error.
    expect(designTool).not.toContain('toast.error("Full-screen view is not available');
    expect(designTool).toContain('document.addEventListener("fullscreenchange", onFullscreenChange)');
    expect(designTool).toContain("immersiveStateAfterFullscreenChange({");
  });

  it("exits on Esc without the Fullscreen API", () => {
    expect(designTool).toContain("if (!immersiveEscapePressed(event)) return;");
    expect(designTool).toContain('window.addEventListener("keydown", onKeyDown)');
  });

  it("clears every bar on a browser-initiated exit, not just local state", () => {
    // The site header and history row read the shared flag. Clearing only local
    // state left them hidden with no visible way back — regression test.
    const effectStart = designTool.indexOf("const onFullscreenChange = () => {");
    const effectEnd = designTool.indexOf('document.addEventListener("fullscreenchange"', effectStart);
    const effect = designTool.slice(effectStart, effectEnd);
    expect(effect).toContain("if (next.clearImmersive) setCanvasOnly(false);");
    // The setter publishes the flag to the header; the raw state setter does not.
    expect(effect).not.toContain("setCanvasOnlyState(false)");
    expect(effect).toContain("setCanvasOnly(false)");
  });

  it("keeps the canvas-only root class available for the floating rails", () => {
    expect(css).toContain(".designer-immersive-root {");
    expect(css).toContain("position: fixed;");
    expect(css).toContain("inset: 0;");
    expect(css).toContain("height: 100dvh;");
  });
});

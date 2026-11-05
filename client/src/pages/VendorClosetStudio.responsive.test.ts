// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Structural guards for the Closet Studio layout.
 *
 * The geometry itself (real bounding boxes, elementFromPoint, scroll retention) is asserted in
 * e2e/closet-studio-responsive.spec.ts at 1440x900, 768x1024, 1024x768, 390x844 and 360x740.
 * These unit guards keep the layout decisions from silently regressing between Playwright runs.
 */
const read = (relative: string) => readFileSync(`${process.cwd()}/client/src/${relative}`, "utf8");
const studio = read("pages/VendorClosetStudio.tsx");
const app = read("App.tsx");
const scene = read("components/vendor/VendorClosetScene.tsx");

describe("Closet Studio responsive layout", () => {
  it("fills the AffiliateShell main instead of nesting a second 100dvh", () => {
    // AffiliateShell's fullHeight main is flex-1 min-h-0; a nested 100dvh overflowed it and
    // made the lower controls unreachable.
    expect(studio).toContain('flex h-full min-h-0 flex-col overflow-hidden bg-[#e9e5dc]');
    expect(studio).not.toContain("h-[100dvh]");
    // The standalone routes provide the height the shell provides on the storefront route.
    expect(app).toContain('<div className="flex h-[100dvh] flex-col overflow-hidden">');
  });

  it("gives the drawing the flexible middle column and keeps it scroll-safe", () => {
    expect(studio).toContain('className="relative min-h-0 w-full flex-1 bg-[#e7e2d8]" data-testid="vendor-scene-panel"');
    expect(studio).toContain('className={`relative flex min-h-0 min-w-0 flex-1 overflow-hidden min-[1280px]:grid');
    // With the dock closed the desktop grid drops its first column, so the drawing keeps >60%.
    expect(studio).toContain("min-[1280px]:grid-cols-[minmax(320px,360px)_minmax(0,1fr)_250px]");
    expect(studio).toContain("min-[1280px]:grid-cols-[minmax(0,1fr)_250px]");
    expect(studio).not.toContain("h-[46vh]");
    // The scene mount stays a full-height flex child so ResizeObserver sees real changes.
    expect(scene).toContain('className="h-full min-h-0 w-full touch-none"');
    expect(scene).toContain("renderer.setSize(width, height, false)");
    expect(scene).toContain("new ResizeObserver(resize)");
  });

  it("collapses the secondary panels on tablet and phone, and shows them as sheets", () => {
    // Accessories dock: hidden until opened, absolute sheet below 1280px, static column above.
    expect(studio).toContain('data-open={partsPanelOpen ? "true" : "false"}');
    expect(studio).toContain('className={`${partsPanelOpen ? "flex" : "hidden"} absolute inset-x-0 bottom-0');
    // Material list: same closed-by-default treatment.
    expect(studio).toContain('className={`${showTabletMaterial || phonePanel === "material" ? "flex" : "hidden"} absolute');
    // Room panel: overlay sheet on small screens, static column on wide desktops.
    expect(studio).toContain('className={`${showRoom ? "flex" : "hidden"} absolute inset-x-0 bottom-0 top-11');
  });

  it("keeps only the essentials in the toolbar, with 44px targets and a destructive Delete plan", () => {
    expect(studio).toContain('data-testid="vendor-studio-toolbar"');
    expect(studio).toContain('data-testid="vendor-delete-plan"');
    expect(studio).toContain("border-[#c25b48]");
    expect(studio).toContain('data-testid="vendor-toolbar-edit"');
    expect(studio).toContain('data-testid="vendor-toolbar-fit"');
    // Mode pills and Room are secondary: wide-desktop only.
    expect(studio).toContain("min-[1280px]:flex");
  });

  it("never uses a document-wide scroll jump that pulled the page back to the top", () => {
    expect(studio).toContain("function scrollWithinScroller(");
    expect(studio).toContain('scrollWithinScroller(target, "start")');
    expect(studio).toContain('scrollWithinScroller(visiblePlanner, "center")');
    expect(studio).not.toContain("getElementById(id)?.scrollIntoView");
    expect(studio).not.toContain("visiblePlanner?.scrollIntoView");
    // Drawer lists contain their own overscroll so a wheel gesture cannot chain to the page.
    expect(studio).toContain("overflow-y-auto overscroll-contain");
  });

  it("keeps the room map a small collapsible inset over the drawing", () => {
    expect(studio).toContain('data-testid="vendor-room-minimap"');
    expect(studio).toContain("w-[116px]");
    expect(studio).toContain('aria-label="Collapse room map"');
    expect(studio).toContain('aria-label="Show room map"');
    // No oversized room map remains.
    expect(studio).not.toContain("h-72 w-full");
    expect(studio).not.toContain("max-w-lg rounded-xl border border-[#d8d0c3]");
  });
});

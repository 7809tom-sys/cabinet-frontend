import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Source-level pins for the floating column. The rendered behaviour (labels,
 * tooltips, PAN last) is covered in floatingColumn.test.tsx; these assertions
 * cover what a jsdom render cannot see — the geometry the column is anchored
 * to, and the fact that only ONE column exists in the 3D viewer.
 *
 * Node environment on purpose: `new URL("./file.css", import.meta.url)` has to
 * resolve to a real file, which the jsdom environment does not do.
 */
const columnSource = readFileSync(new URL("./floatingColumn.tsx", import.meta.url), "utf8");
const columnCss = readFileSync(new URL("./floatingColumn.css", import.meta.url), "utf8");
const viewerSource = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
const designToolSource = readFileSync(new URL("../../pages/DesignTool.tsx", import.meta.url), "utf8");

describe("floating column layout", () => {
  it("anchors the column to the bottom-right of the drawing surface", () => {
    expect(columnSource).toContain("absolute right-2 bottom-3");
    // Bottom anchoring + flex-col is what stacks the buttons upward from the pad.
    expect(columnSource).toContain("flex-col");
    expect(columnSource).toContain("items-center");
    // It no longer starts under the page header, which is what produced the
    // staggered rows the owner reported.
    expect(columnSource).not.toContain("top-[3.9rem]");
  });

  it("cannot run off the top of a short canvas", () => {
    // Scroll only as the last resort ...
    expect(columnSource).toContain("max-h-[calc(100%-");
    expect(columnSource).toContain("overflow-y-auto");
    expect(columnSource).toContain("overscroll-contain");
    // ... because every button shrinks together through one shared variable
    // first, so the stack neither gets clipped nor drifts out of line.
    expect(columnCss).toContain(".three-d-floating-column");
    expect(columnCss).toContain("--three-d-floating-button");
    expect(columnCss).toContain(".three-d-floating-column .three-d-floating-button");
    expect(columnCss).toContain("height: var(--three-d-floating-button)");
    expect(columnCss).toContain("width: var(--three-d-floating-button)");
    expect(columnCss).toContain("@media (max-height:");
    // The visible label is the first thing to go on a short screen.
    expect(columnCss).toContain(".three-d-floating-label");
  });

  it("reveals the hover description without a popover inside the render loop", () => {
    // A CSS hover rule, not a stateful tooltip root: the 3D stage re-renders on
    // every frame, and Radix's root re-entered its open state inside that loop.
    expect(columnCss).toContain(".three-d-floating-tooltip");
    expect(columnCss).toContain(".three-d-floating-item:hover > .three-d-floating-tooltip");
    expect(columnCss).toContain(":focus-within > .three-d-floating-tooltip");
    // Same dark pill as the app's Tooltip, and never a click target.
    expect(columnCss).toContain("background-color: #1a2744");
    expect(columnCss).toContain("pointer-events: none");
    // A touch screen does not hover, so the bubble is not drawn there at all.
    expect(columnCss).toContain("@media (hover: none)");
    expect(columnSource).not.toContain("@radix-ui/react-tooltip");
  });

  it("gives every column button one shared square style", () => {
    for (const token of ["shrink-0", "rounded-md", "border", "bg-white", "three-d-floating-button"]) {
      expect(columnSource, token).toContain(token);
    }
    expect(columnSource).toContain('h-11 w-11');
  });

  it("renders exactly one column in the 3D viewer, gated on the same breakpoints", () => {
    // A phone still gets the compact launcher instead of the full column.
    expect(viewerSource).toContain('className={`${THREE_D_VIEWER_COLUMN_CLASS} ${tabletOverlay ? "" : "hidden sm:flex"}`}');
    expect(viewerSource).toContain("data-testid={THREE_D_FLOATING_COLUMN_TEST_ID}");
    // One column only: a second right-edge rail is exactly what was misaligned.
    expect(viewerSource.match(/THREE_D_FLOATING_COLUMN_TEST_ID\}/g)?.length).toBe(1);
    // No floating control positions itself on the right edge any more.
    expect(viewerSource).not.toContain("top-[3.9rem]");
    expect(viewerSource).not.toContain("absolute right-3 top-3 z-40");
  });

  it("puts the page's quick adds and Auto-Design in that same column", () => {
    expect(designToolSource).toContain("floatingQuickActions={threeDFloatingQuickActions}");
    expect(designToolSource).toContain("floatingAutoDesignAction={threeDFloatingAutoDesignAction}");
    // The inline copies never position themselves.
    const quickActions = designToolSource.slice(
      designToolSource.indexOf("const threeDFloatingQuickActions"),
      designToolSource.indexOf("const renderNativeThreeDCanvas"),
    );
    expect(quickActions).toContain("inline");
    expect(quickActions).not.toContain("absolute");
  });
});

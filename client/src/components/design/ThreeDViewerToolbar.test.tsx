// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ThreeDViewerNavigationControls } from "./InteractiveRoom3D";
import { BathroomSetupChecklist } from "./BathroomSetupChecklist";
import {
  THREE_D_FLOATING_COLUMN_TEST_ID,
  THREE_D_VIEWER_BUTTON_CLASS,
  THREE_D_VIEWER_COLUMN_CLASS,
} from "./floatingColumn";

afterEach(cleanup);

const noop = () => {};

function renderControls(overrides: Partial<Parameters<typeof ThreeDViewerNavigationControls>[0]> = {}) {
  return render(
    <ThreeDViewerNavigationControls
      onZoom={noop}
      onReset={noop}
      onShare={noop}
      onPhotoRender={noop}
      onPan={noop}
      {...overrides}
    />,
  );
}

describe("right-hand 3D toolbar", () => {
  it("puts zoom, reset, share and the final preview in one square style", () => {
    const { container } = renderControls();
    const testIds = [
      "three-d-zoom-in",
      "three-d-zoom-out",
      "three-d-reset-view",
      "three-d-share-view",
      "three-d-photo-render",
    ];
    for (const id of testIds) {
      const button = container.querySelector(`[data-testid="${id}"]`) as HTMLElement;
      expect(button, id).toBeTruthy();
      for (const token of THREE_D_VIEWER_BUTTON_CLASS.split(" ")) {
        expect(button.className, `${id} missing ${token}`).toContain(token);
      }
    }
  });

  it("no longer wraps the buttons in a bordered panel", () => {
    const { container } = renderControls();
    const column = container.querySelector('[data-testid="three-d-viewer-navigation"]') as HTMLElement;
    // `contents` keeps the stable test id without adding a second flex box, so the
    // buttons are direct children of the caller's column.
    expect(column.className).toBe("contents");
    expect(container.querySelector('[data-testid="three-d-pan-pad"]')).toBeTruthy();
    // The column itself hangs off the bottom-right corner of the canvas.
    expect(THREE_D_VIEWER_COLUMN_CLASS).toContain("right-3");
    expect(THREE_D_VIEWER_COLUMN_CLASS).toContain("bottom-3");
    expect(THREE_D_VIEWER_COLUMN_CLASS).toContain("flex-col");
    // It grows upward from the PAN pad rather than being pinned under a header.
    expect(THREE_D_VIEWER_COLUMN_CLASS).not.toContain("top-[3.9rem]");
    expect(THREE_D_FLOATING_COLUMN_TEST_ID).toBe("three-d-floating-column");
  });

  it("renders the PAN pad last so it is the bottom of the stack", () => {
    const { container } = renderControls();
    const column = container.querySelector('[data-testid="three-d-viewer-navigation"]') as HTMLElement;
    const items = Array.from(column.children).map((node) => (node as HTMLElement).dataset.testid ?? node.tagName);
    expect(items[items.length - 1]).toBe("three-d-pan-pad");
    // Every other control comes before it.
    expect(items.indexOf("three-d-zoom-in")).toBeLessThan(items.length - 1);
    expect(items.indexOf("three-d-photo-render")).toBeLessThan(items.length - 1);
  });

  it("keeps the pan arrows in the same four positions", () => {
    const { container } = renderControls();
    for (const direction of ["up", "left", "right", "down"]) {
      expect(container.querySelector(`[data-testid="three-d-pan-${direction}"]`), direction).toBeTruthy();
    }
    const pad = container.querySelector('[data-testid="three-d-pan-pad"]') as HTMLElement;
    expect(pad.className).toContain("grid-cols-3");
  });

  it("has no shadow or lighting control", () => {
    const { container } = renderControls();
    expect(container.querySelector('[data-testid="three-d-shadows-toggle"]')).toBeNull();
    expect(container.querySelector('[data-testid="three-d-shadows-slider"]')).toBeNull();
    expect(container.querySelector('[aria-label="Lighting"]')).toBeNull();
    expect(container.querySelector('[aria-label="Shadow strength"]')).toBeNull();
  });

  it("still hides pan where the caller asks it to", () => {
    const { container } = renderControls({ hidePan: true });
    expect(container.querySelector('[data-testid="three-d-pan-pad"]')).toBeNull();
    expect(container.querySelector('[data-testid="three-d-zoom-in"]')).toBeTruthy();
  });

  it("gives every button an accessible name and a hover description", () => {
    const { container } = renderControls();
    const expected: Array<[string, string]> = [
      ["three-d-zoom-in", "Zoom in"],
      ["three-d-zoom-out", "Zoom out"],
      ["three-d-reset-view", "Reset view"],
      ["three-d-share-view", "Share view"],
      ["three-d-photo-render", "Final preview"],
      ["three-d-pan-up", "Pan up"],
      ["three-d-pan-down", "Pan down"],
      ["three-d-pan-left", "Pan left"],
      ["three-d-pan-right", "Pan right"],
    ];
    for (const [testId, name] of expected) {
      const button = container.querySelector(`[data-testid="${testId}"]`) as HTMLElement;
      expect(button, testId).toBeTruthy();
      expect(button.getAttribute("aria-label"), testId).toBe(name);
      // `title` is what a touch device gets on a long press.
      expect(button.getAttribute("title"), testId).toBeTruthy();
      // The hover description is linked with aria-describedby as well as drawn.
      const describedBy = button.getAttribute("aria-describedby");
      expect(describedBy, testId).toBeTruthy();
      expect(document.getElementById(describedBy!)?.getAttribute("role"), testId).toBe("tooltip");
    }
  });

  it("lets the caller add its own controls to the same column", () => {
    const { container } = renderControls({
      leading: <button data-testid="lead-action" type="button">lead</button>,
      quickActions: <button data-testid="quick-action" type="button">quick</button>,
      trailing: <button data-testid="trail-action" type="button">trail</button>,
    });
    const column = container.querySelector('[data-testid="three-d-viewer-navigation"]') as HTMLElement;
    const items = Array.from(column.children).map((node) => (node as HTMLElement).dataset.testid ?? node.tagName);
    expect(items[0]).toBe("lead-action");
    expect(items.indexOf("quick-action")).toBeGreaterThan(items.indexOf("three-d-zoom-out"));
    expect(items.indexOf("trail-action")).toBeLessThan(items.indexOf("three-d-pan-pad"));
    expect(items[items.length - 1]).toBe("three-d-pan-pad");
  });
});

describe("the bathroom checklist joins the one floating column", () => {
  it("renders as a 44px column button, not a panel over the canvas", () => {
    const { container } = renderControls({
      trailing: (
        <BathroomSetupChecklist
          steps={[{ id: "a", label: "Place a vanity sink base", detail: "…", complete: false }]}
          completed={0}
          required={1}
          onBrowseFixtures={() => {}}
          idPrefix="test"
        />
      ),
    });
    const toggle = container.querySelector('[data-testid="bathroom-checklist-toggle"]') as HTMLElement;
    expect(toggle).toBeTruthy();
    // Exactly the same size and shape class every other column button uses.
    expect(toggle.className).toContain("h-11");
    expect(toggle.className).toContain("w-11");
    // And it is closed: nothing covers the canvas until the shopper asks.
    expect(container.querySelector('[data-testid="bathroom-fixture-checklist"]')).toBeNull();
  });

  it("sits inside the floating column, so it cannot drift off the axis", () => {
    const { container } = renderControls({
      trailing: (
        <BathroomSetupChecklist
          steps={[]}
          completed={0}
          required={5}
          onBrowseFixtures={() => {}}
          idPrefix="test"
        />
      ),
    });
    const column = container.querySelector('[data-testid="three-d-pan-pad"]')?.parentElement;
    expect(column).toBeTruthy();
    expect(column!.querySelector('[data-testid="bathroom-checklist-toggle"]')).toBeTruthy();
  });
});

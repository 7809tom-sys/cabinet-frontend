// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  THREE_D_FLOATING_COLUMN_TEST_ID,
  THREE_D_VIEWER_BUTTON_CLASS,
  THREE_D_VIEWER_COLUMN_CLASS,
  THREE_D_VIEWER_PAN_CELL_CLASS,
  FloatingColumnButton,
  FloatingColumnLabel,
} from "./floatingColumn";
import { CanvasActionRail } from "./CanvasActionRail";
import { ThreeDViewerNavigationControls } from "./InteractiveRoom3D";

afterEach(cleanup);

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

const noop = () => {};

/**
 * Mirrors the real 3D stage: one bottom-anchored column holding the viewer's
 * navigation, the page's quick adds and the Auto-Design action, with the PAN pad
 * last. The real component wires exactly these slots.
 */
function StageColumn() {
  return (
    <div data-testid={THREE_D_FLOATING_COLUMN_TEST_ID} className={THREE_D_VIEWER_COLUMN_CLASS}>
      <ThreeDViewerNavigationControls
        onZoom={noop}
        onReset={noop}
        onShare={noop}
        onPan={noop}
        shadowStrength={100}
        onShadowStrengthChange={noop}
        leading={
          <FloatingColumnButton data-testid="three-d-immersive-toggle" label="Fullscreen view">
            <span aria-hidden="true" />
          </FloatingColumnButton>
        }
        quickActions={
          <CanvasActionRail inline testIdPrefix="three-d-floating" actions={["cabinet", "hardware"]} onAddCabinet={noop} onAddHardware={noop} />
        }
        trailing={
          <CanvasActionRail inline testIdPrefix="three-d-floating" actions={["autoDesign"]} onAddCabinet={noop} onAddHardware={noop} onAutoDesign={noop} />
        }
      />
    </div>
  );
}

describe("every floating button is labelled", () => {
  it("renders one bottom-anchored column, PAN pad last", () => {
    render(<StageColumn />);
    const column = screen.getByTestId(THREE_D_FLOATING_COLUMN_TEST_ID);
    const panPad = column.querySelector('[data-testid="three-d-pan-pad"]') as HTMLElement;
    expect(panPad).toBeTruthy();
    // Everything the owner listed is in the one column.
    const listed = [
      "three-d-immersive-toggle",
      "three-d-zoom-in",
      "three-d-zoom-out",
      "three-d-floating-add-cabinet",
      "three-d-floating-add-hardware",
      "three-d-floating-auto-design",
      "three-d-reset-view",
      "three-d-share-view",
      "three-d-shadows-toggle",
      "three-d-pan-up",
      "three-d-pan-right",
      "three-d-pan-down",
      "three-d-pan-left",
    ];
    for (const id of listed) {
      expect(column.querySelector(`[data-testid="${id}"]`), id).toBeTruthy();
    }
    // PAN is the bottom of the stack: no other control comes after it in flow.
    const panIds = new Set(["three-d-pan-pad", "three-d-pan-up", "three-d-pan-down", "three-d-pan-left", "three-d-pan-right"]);
    const after = Array.from(column.querySelectorAll<HTMLElement>("[data-testid]")).filter((node) => {
      const id = node.dataset.testid ?? "";
      if (panIds.has(id)) return false;
      // FOLLOWING (4) means `node` comes after the pan pad in document order.
      return Boolean(panPad.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(after.map((node) => node.dataset.testid)).toEqual([]);
    // And it is inside the same column as the buttons above it.
    expect(column.contains(panPad)).toBe(true);
  });

  it("names every button for screen readers, a long-press tooltip and a hover description", () => {
    render(<StageColumn />);
    const expected: Array<[string, string]> = [
      ["three-d-immersive-toggle", "Fullscreen view"],
      ["three-d-zoom-in", "Zoom in"],
      ["three-d-zoom-out", "Zoom out"],
      ["three-d-floating-add-cabinet", "Add cabinet"],
      ["three-d-floating-add-hardware", "Add hardware"],
      ["three-d-floating-auto-design", "Auto-Design"],
      ["three-d-reset-view", "Reset view"],
      ["three-d-share-view", "Share view"],
      ["three-d-shadows-toggle", "Lighting"],
      ["three-d-pan-up", "Pan up"],
      ["three-d-pan-down", "Pan down"],
      ["three-d-pan-left", "Pan left"],
      ["three-d-pan-right", "Pan right"],
    ];
    for (const [testId, name] of expected) {
      const button = screen.getByTestId(testId);
      expect(button.getAttribute("aria-label"), testId).toBe(name);
      // `title` is what a touch device gets on a long press.
      expect(button.getAttribute("title"), testId).toBeTruthy();
      // The hover description is a real element, linked to the button so it is
      // announced with it rather than only seen.
      const describedBy = button.getAttribute("aria-describedby");
      expect(describedBy, testId).toBeTruthy();
      const description = document.getElementById(describedBy!);
      expect(description?.textContent, testId).toBeTruthy();
      expect(description?.getAttribute("role"), testId).toBe("tooltip");
    }
  });

  /**
   * The description used to be an absolutely positioned child of the button. That
   * could never work: the column is `overflow-y-auto` and the 3D stage is
   * `overflow-hidden`, so the bubble was clipped at the column's edge, and any
   * z-index inside the stage lost to the pricing panel. It is now portalled to
   * `document.body` as a fixed layer, which escapes both.
   */
  it("describes the button for assistive tech even before any hover", () => {
    render(<FloatingColumnButton label="Zoom in" tooltip="Zoom in — closer to the cabinets"><span /></FloatingColumnButton>);
    const button = screen.getByRole("button", { name: "Zoom in" });
    // The sr-only description is always in the document, so `aria-describedby`
    // resolves on a touch screen where no bubble can ever be hovered.
    const description = screen.getByRole("tooltip");
    expect(description.textContent).toContain("closer to the cabinets");
    expect(description.className).toContain("sr-only");
    expect(button.getAttribute("aria-describedby")).toBe(description.id);
    // The visible bubble only exists while the pointer or focus is on the button.
    expect(document.querySelector(".three-d-floating-tooltip-portal")).toBeNull();
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it("keeps a visible label only where it still fits", () => {
    render(<FloatingColumnButton label="Add hardware" tooltip="Add hardware"><FloatingColumnLabel>Hardware</FloatingColumnLabel></FloatingColumnButton>);
    const button = screen.getByRole("button", { name: "Add hardware" });
    const label = button.querySelector(".three-d-floating-label");
    expect(label).toBeTruthy();
    // Decorative: the accessible name already comes from aria-label.
    expect(label?.getAttribute("aria-hidden")).toBe("true");
  });
});

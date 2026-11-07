// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CANVAS_ACTION_RAIL_CLASS, CanvasActionRail } from "./CanvasActionRail";

afterEach(cleanup);

describe("floating canvas action rail", () => {
  it("offers exactly the two actions the owner uses, with thumb-sized targets", () => {
    render(<CanvasActionRail onAddCabinet={() => {}} onAddHardware={() => {}} />);
    const cabinet = screen.getByTestId("canvas-quick-add-cabinet");
    const hardware = screen.getByTestId("canvas-quick-add-hardware");
    // 44×44 CSS px is the minimum touch target; the class pair pins it.
    expect(cabinet.className).toContain("h-11");
    expect(cabinet.className).toContain("w-11");
    expect(hardware.className).toContain("h-11");
    expect(hardware.className).toContain("w-11");
    // Each carries a visible label, a title, and an aria-label.
    expect(cabinet.getAttribute("aria-label")).toBe("Add cabinet");
    expect(cabinet.getAttribute("title")).toContain("Add cabinet");
    expect(cabinet.textContent).toContain("Cabinet");
    expect(hardware.getAttribute("aria-label")).toBe("Add hardware");
    expect(hardware.textContent).toContain("Hardware");
  });

  it("calls the handlers the existing toolbar buttons call", () => {
    const onAddCabinet = vi.fn();
    const onAddHardware = vi.fn();
    render(<CanvasActionRail onAddCabinet={onAddCabinet} onAddHardware={onAddHardware} />);
    fireEvent.click(screen.getByTestId("canvas-quick-add-cabinet"));
    expect(onAddCabinet).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("canvas-quick-add-hardware"));
    expect(onAddHardware).toHaveBeenCalledTimes(1);
  });

  it("reuses the closet wording and explains a disabled add", () => {
    const { rerender } = render(
      <CanvasActionRail onAddCabinet={() => {}} onAddHardware={() => {}} addCabinetLabel="Add closet parts" />,
    );
    expect(screen.getByTestId("canvas-quick-add-cabinet").getAttribute("aria-label")).toBe("Add closet parts");
    rerender(
      <CanvasActionRail
        onAddCabinet={() => {}}
        onAddHardware={() => {}}
        addCabinetDisabled
        addCabinetDisabledReason="Unlock the room layout to edit it"
      />,
    );
    const cabinet = screen.getByTestId("canvas-quick-add-cabinet");
    expect((cabinet as HTMLButtonElement).disabled).toBe(true);
    expect(cabinet.getAttribute("title")).toBe("Unlock the room layout to edit it");
  });

  it("anchors on the right edge clear of the fullscreen toggle and the zoom rail", () => {
    // Top-anchored with an explicit offset the Designer layout test checks against
    // the measured boxes of the toggle (top-right) and the pan/zoom rail (bottom-right).
    expect(CANVAS_ACTION_RAIL_CLASS).toContain("right-2");
    expect(CANVAS_ACTION_RAIL_CLASS).toContain("top-[6.75rem]");
    expect(CANVAS_ACTION_RAIL_CLASS).toContain("flex-col");
    expect(CANVAS_ACTION_RAIL_CLASS).not.toContain("top-1/2");
  });

  it("does not let a press fall through to the 3D selection gesture", () => {
    const onAddCabinet = vi.fn();
    render(<CanvasActionRail onAddCabinet={onAddCabinet} onAddHardware={() => {}} />);
    const rail = screen.getByTestId("designer-canvas-action-rail");
    const down = new MouseEvent("pointerdown", { bubbles: true });
    const stop = vi.spyOn(down, "stopPropagation");
    rail.dispatchEvent(down);
    expect(stop).toHaveBeenCalled();
  });

  it("can be hidden where a second fast path would only crowd the canvas", () => {
    const { container } = render(<CanvasActionRail hidden onAddCabinet={() => {}} onAddHardware={() => {}} />);
    expect(container.querySelector('[data-testid="designer-canvas-action-rail"]')).toBeNull();
  });
});

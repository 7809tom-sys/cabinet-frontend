// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CANVAS_ACTION_RAIL_CLASS, CanvasActionRail } from "./CanvasActionRail";

afterEach(cleanup);

describe("floating canvas action rail", () => {
  it("offers the actions the owner uses, with thumb-sized targets", () => {
    render(
      <CanvasActionRail onAddCabinet={() => {}} onAddHardware={() => {}} />,
    );
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
    render(
      <CanvasActionRail
        onAddCabinet={onAddCabinet}
        onAddHardware={onAddHardware}
      />,
    );
    fireEvent.click(screen.getByTestId("canvas-quick-add-cabinet"));
    expect(onAddCabinet).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("canvas-quick-add-hardware"));
    expect(onAddHardware).toHaveBeenCalledTimes(1);
  });

  it("reuses the closet wording and explains a disabled add", () => {
    const { rerender } = render(
      <CanvasActionRail
        onAddCabinet={() => {}}
        onAddHardware={() => {}}
        addCabinetLabel="Add closet parts"
      />,
    );
    expect(
      screen.getByTestId("canvas-quick-add-cabinet").getAttribute("aria-label"),
    ).toBe("Add closet parts");
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
    expect(cabinet.getAttribute("title")).toBe(
      "Unlock the room layout to edit it",
    );
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
    render(
      <CanvasActionRail onAddCabinet={onAddCabinet} onAddHardware={() => {}} />,
    );
    const rail = screen.getByTestId("designer-canvas-action-rail");
    const down = new MouseEvent("pointerdown", { bubbles: true });
    const stop = vi.spyOn(down, "stopPropagation");
    rail.dispatchEvent(down);
    expect(stop).toHaveBeenCalled();
  });

  it("renders the same buttons inline for the 3D viewer's floating column", () => {
    // The 3D stage owns the right-edge column, so its quick adds must NOT position
    // themselves: two independently anchored rails on one edge is exactly the
    // staggered layout this change removes.
    const onAddCabinet = vi.fn();
    render(
      <CanvasActionRail
        inline
        testIdPrefix="three-d-floating"
        actions={["cabinet", "hardware"]}
        onAddCabinet={onAddCabinet}
        onAddHardware={() => {}}
      />,
    );
    expect(screen.queryByTestId("designer-canvas-action-rail")).toBeNull();
    const wrapper = screen.getByTestId("designer-canvas-action-buttons");
    expect(wrapper.className).toBe("contents");
    const cabinet = screen.getByTestId("three-d-floating-add-cabinet");
    // Same button class as the column: same size, same styling, no offset.
    expect(cabinet.className).toContain("three-d-floating-button");
    expect(cabinet.className).toContain("h-11");
    expect(cabinet.className).toContain("w-11");
    expect(cabinet.getAttribute("aria-label")).toBe("Add cabinet");
    expect(cabinet.getAttribute("title")).toContain("Add cabinet");
    // The actions filter keeps Auto-Design out when the caller owns that slot.
    expect(screen.queryByTestId("three-d-floating-auto-design")).toBeNull();
    fireEvent.click(cabinet);
    expect(onAddCabinet).toHaveBeenCalledTimes(1);
  });

  it("can be hidden where a second fast path would only crowd the canvas", () => {
    const { container } = render(
      <CanvasActionRail
        hidden
        onAddCabinet={() => {}}
        onAddHardware={() => {}}
      />,
    );
    expect(
      container.querySelector('[data-testid="designer-canvas-action-rail"]'),
    ).toBeNull();
  });
});

describe("Auto-Design on the rail (canvas-only / fullscreen)", () => {
  it("offers a thumb-sized Auto-Design action that calls the page's own opener", () => {
    const onAutoDesign = vi.fn();
    render(
      <CanvasActionRail
        onAddCabinet={() => {}}
        onAddHardware={() => {}}
        onAutoDesign={onAutoDesign}
      />,
    );
    const auto = screen.getByTestId("canvas-quick-auto-design");
    // Same 44×44 minimum as the other rail actions, so it is usable on a tablet.
    expect(auto.className).toContain("h-11");
    expect(auto.className).toContain("w-11");
    expect(auto.getAttribute("aria-label")).toBe("Auto-Design");
    expect(auto.textContent).toContain("Auto");
    expect(auto.getAttribute("title")).toBe(
      "Auto-Design a kitchen from four fixed fixture anchors",
    );
    fireEvent.click(auto);
    expect(onAutoDesign).toHaveBeenCalledTimes(1);
  });

  it("stays on the rail while the Designer's own bars are hidden", () => {
    // The rail is only ever hidden for phones; canvas-only mode never unmounts it,
    // so a tablet in fullscreen keeps a way into Auto-Design.
    render(
      <CanvasActionRail
        onAddCabinet={() => {}}
        onAddHardware={() => {}}
        onAutoDesign={() => {}}
      />,
    );
    const rail = screen.getByTestId("designer-canvas-action-rail");
    expect(rail).toBeTruthy();
    expect(screen.getByTestId("canvas-quick-auto-design")).toBeTruthy();
  });

  it("hides Auto-Design where the room does not offer it", () => {
    const { container } = render(
      <CanvasActionRail onAddCabinet={() => {}} onAddHardware={() => {}} />,
    );
    expect(
      container.querySelector('[data-testid="canvas-quick-auto-design"]'),
    ).toBeNull();
  });

  it("keeps the shared disabled reason on the button instead of inventing one", () => {
    const onAutoDesign = vi.fn();
    render(
      <CanvasActionRail
        onAddCabinet={() => {}}
        onAddHardware={() => {}}
        onAutoDesign={onAutoDesign}
        autoDesignDisabled
        autoDesignDisabledReason="Needs an empty plan"
      />,
    );
    const auto = screen.getByTestId(
      "canvas-quick-auto-design",
    ) as HTMLButtonElement;
    expect(auto.disabled).toBe(true);
    expect(auto.getAttribute("title")).toBe("Needs an empty plan");
    fireEvent.click(auto);
    // A disabled button is inert; the opener must not run behind it.
    expect(onAutoDesign).not.toHaveBeenCalled();
  });
});

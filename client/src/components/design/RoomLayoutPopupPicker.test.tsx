// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RoomLayoutPopupPicker } from "./RoomLayoutPopupPicker";

afterEach(cleanup);

function setup(enabled = true) {
  const onClick = vi.fn();
  render(
    <RoomLayoutPopupPicker
      bathroom={<div data-testid="bath-body">bath choices</div>}
      kitchen={<div data-testid="kitchen-body">kitchen layouts</div>}
      closet={<div data-testid="closet-body">closet choices</div>}
      autoDesign={{ onClick, enabled }}
    />,
  );
  return onClick;
}

/** True when `later` renders after `earlier` in document order. */
function rendersAfter(later: Element, earlier: Element) {
  return Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe("RoomLayoutPopupPicker", () => {
  it("opens collapsed with only the three room buttons", () => {
    setup();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Bathroom", "Kitchen", "Closet"]);
    expect(screen.getByTestId("room-layout-popup-kitchen").getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("kitchen-body")).toBeNull();
    expect(screen.queryByTestId("room-layout-popup-auto-design")).toBeNull();
  });

  it("Kitchen shows the kitchen layouts and then the Auto-Design last step; switching and back work", () => {
    setup();
    fireEvent.click(screen.getByTestId("room-layout-popup-kitchen"));
    expect(screen.getByTestId("room-layout-popup-kitchen").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("kitchen-body")).toBeTruthy();
    const trigger = screen.getByTestId("room-layout-popup-auto-design");
    expect(trigger).toBeTruthy();
    // The room shapes and starter layouts come first; Auto-Design is the last step.
    expect(rendersAfter(trigger, screen.getByTestId("kitchen-body"))).toBe(true);
    expect(screen.getByTestId("room-layout-popup-auto-design-wrap").textContent).toContain("Last step");
    fireEvent.click(screen.getByTestId("room-layout-popup-closet"));
    expect(screen.getByTestId("closet-body")).toBeTruthy();
    expect(screen.queryByTestId("kitchen-body")).toBeNull();
    expect(screen.queryByTestId("room-layout-popup-auto-design")).toBeNull();
    fireEvent.click(screen.getByTestId("room-layout-popup-back"));
    expect(screen.queryByTestId("closet-body")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("never puts Auto-Design above the room plan it is meant to design", () => {
    setup();
    fireEvent.click(screen.getByTestId("room-layout-popup-kitchen"));
    const wrap = screen.getByTestId("room-layout-popup-auto-design-wrap");
    const body = screen.getByTestId("kitchen-body");
    expect(rendersAfter(wrap, body)).toBe(true);
    // It is the last block of the Kitchen panel, not a shortcut before the shapes.
    expect(screen.getByTestId("room-layout-popup-panel-kitchen").lastElementChild).toBe(wrap);
  });

  it("Auto-Design calls the supplied handler, and not when gated off", () => {
    const onClick = setup();
    fireEvent.click(screen.getByTestId("room-layout-popup-kitchen"));
    fireEvent.click(screen.getByTestId("room-layout-popup-auto-design"));
    expect(onClick).toHaveBeenCalledTimes(1);
    cleanup();
    const off = setup(false);
    fireEvent.click(screen.getByTestId("room-layout-popup-kitchen"));
    fireEvent.click(screen.getByTestId("room-layout-popup-auto-design"));
    expect(off).not.toHaveBeenCalled();
  });

  it("DesignTool wires the popup to the existing openAutoDesign and gating", () => {
    const src = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");
    expect(src).toContain("<RoomLayoutPopupPicker");
    expect(src).toContain("setTimeout(openAutoDesign, 120)");
    expect(src).toContain("enabled: autoDesignControl.enabled");
  });
});

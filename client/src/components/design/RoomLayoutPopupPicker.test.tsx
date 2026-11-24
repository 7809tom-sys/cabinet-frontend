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

describe("RoomLayoutPopupPicker", () => {
  it("opens collapsed with only the three room buttons", () => {
    setup();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Bathroom", "Kitchen", "Closet"]);
    expect(screen.getByTestId("room-layout-popup-kitchen").getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("kitchen-body")).toBeNull();
    expect(screen.queryByTestId("room-layout-popup-auto-design")).toBeNull();
  });

  it("Kitchen shows the kitchen layouts and the Auto-Design button; switching and back work", () => {
    setup();
    fireEvent.click(screen.getByTestId("room-layout-popup-kitchen"));
    expect(screen.getByTestId("room-layout-popup-kitchen").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("kitchen-body")).toBeTruthy();
    expect(screen.getByTestId("room-layout-popup-auto-design")).toBeTruthy();
    fireEvent.click(screen.getByTestId("room-layout-popup-closet"));
    expect(screen.getByTestId("closet-body")).toBeTruthy();
    expect(screen.queryByTestId("kitchen-body")).toBeNull();
    expect(screen.queryByTestId("room-layout-popup-auto-design")).toBeNull();
    fireEvent.click(screen.getByTestId("room-layout-popup-back"));
    expect(screen.queryByTestId("closet-body")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(3);
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

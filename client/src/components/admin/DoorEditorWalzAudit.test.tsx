/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DoorEditorWalzAudit } from "./DoorEditorWalzAudit";

afterEach(cleanup);

describe("door editor match card", () => {
  it("shows every grain unselected, then saves the owner's hex, grain, and orientation", () => {
    const onApply = vi.fn();
    const onReplicate = vi.fn();
    render(
      <DoorEditorWalzAudit
        style={{ id: 360001, distributorId: 180001, ourName: "Shaker Gray", aliasName: "Stone Gray (Preston)", doorStyle: "Shaker", color: "Gray" }}
        sampleUrl="/uploads/stone-gray.jpg"
        others={[
          { id: 360001, distributorId: 180001, ourName: "Shaker Gray" },
          { id: 390001, distributorId: 180001, ourName: "Shaker White" },
          { id: 540002, distributorId: 270001, ourName: "Grey Wood" },
        ]}
        onApply={onApply}
        onReplicate={onReplicate}
      />,
    );
    expect(screen.getByTestId("wizard-real-door")).toBeTruthy();
    expect(screen.getByTestId("wizard-working-door")).toBeTruthy();
    expect(screen.getByTestId("wizard-suggestion").textContent).toMatch(/#8d8f92/);
    expect(screen.getByTestId("wizard-suggestion").textContent).toMatch(/Not applied/);
    const tiles = screen.getByTestId("wizard-grains").querySelectorAll("button");
    expect(tiles.length).toBe(49);
    expect(Array.from(tiles).every((tile) => tile.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(screen.queryByTestId("color-family-gray")).toBeNull();
    fireEvent.click(screen.getByTestId("grain-tile-TGW"));
    expect(screen.getByTestId("wizard-orientation-horizontal").className).toMatch(/d7a46c/);
    fireEvent.change(screen.getByTestId("wizard-hex"), { target: { value: "#8d8f92" } });
    fireEvent.click(screen.getByTestId("wizard-apply"));
    expect(onApply).toHaveBeenCalledWith({ renderHex: "#8d8f92", woodSpecies: "Grey Wood", grainDirection: "horizontal" });
    fireEvent.click(screen.getByTestId("wizard-replicate-390001"));
    fireEvent.click(screen.getByTestId("wizard-replicate-apply"));
    expect(onReplicate).toHaveBeenCalledWith([390001], { renderHex: "#8d8f92", woodSpecies: "Grey Wood", grainDirection: "horizontal" });
  });

  it("does not rotate a horizontal grain until the owner switches it", () => {
    render(<DoorEditorWalzAudit style={{ id: 540003, ourName: "Dark Wood", styleCode: "TDW", doorStyle: "Slab" }} />);
    const working = screen.getByTestId("wizard-working-door");
    expect(working.getAttribute("style") ?? "").not.toMatch(/rotate/);
    fireEvent.click(screen.getByTestId("grain-tile-TDW"));
    expect(working.getAttribute("style") ?? "").not.toMatch(/rotate/);
    fireEvent.click(screen.getByTestId("wizard-orientation-vertical"));
    expect(working.getAttribute("style")).toMatch(/rotate\(90deg\)/);
  });
});

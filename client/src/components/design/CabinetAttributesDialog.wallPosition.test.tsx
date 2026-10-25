// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CabinetCornerClearancePanel, CabinetWallPositionControls } from "./CabinetAttributesDialog";

const position = {
  wallLabel: "Wall 2",
  wallLengthIn: 120,
  offsetIn: 36,
  maxOffsetIn: 84,
};

describe("CabinetWallPositionControls", () => {
  afterEach(cleanup);

  it("shows a measured wall run and exact start-corner position", () => {
    render(createElement(CabinetWallPositionControls, { position, onSetOffset: vi.fn() }));

    expect(screen.getByTestId("cabinet-wall-position-controls").textContent).toContain("Selected run: Wall 2");
    expect(screen.getByTestId("cabinet-wall-position-controls").textContent).toContain("120″ measured");
    expect((screen.getByLabelText("Cabinet position from wall start in inches") as HTMLInputElement).value).toBe("36");
  });

  it("commits a typed eighth-inch offset and nudges only along the selected run", () => {
    const onSetOffset = vi.fn();
    render(createElement(CabinetWallPositionControls, { position, onSetOffset }));

    const offset = screen.getByLabelText("Cabinet position from wall start in inches");
    fireEvent.change(offset, { target: { value: "41.375" } });
    fireEvent.blur(offset);
    expect(onSetOffset).toHaveBeenLastCalledWith(41.375);

    fireEvent.change(screen.getByLabelText("Cabinet movement distance in inches"), { target: { value: "2.5" } });
    fireEvent.click(screen.getByLabelText("Move cabinet toward wall end"));
    expect(onSetOffset).toHaveBeenLastCalledWith(38.5);

    fireEvent.click(screen.getByLabelText("Move cabinet toward wall start"));
    expect(onSetOffset).toHaveBeenLastCalledWith(33.5);
  });

  it("clamps typed values to the measured run so the cabinet stays on its wall", () => {
    const onSetOffset = vi.fn();
    render(createElement(CabinetWallPositionControls, { position, onSetOffset }));

    const offset = screen.getByLabelText("Cabinet position from wall start in inches");
    fireEvent.change(offset, { target: { value: "120" } });
    fireEvent.blur(offset);
    expect(onSetOffset).toHaveBeenCalledWith(84);
  });
});

describe("CabinetCornerClearancePanel", () => {
  afterEach(cleanup);

  it("shows the two measured wall-end gaps and no artificial setback for a normal 90-degree corner", () => {
    render(createElement(CabinetCornerClearancePanel, {
      clearance: {
        wallLabel: "Wall 2",
        angle: 90,
        placement: "flush",
        requiredClearanceIn: 0,
        startGapIn: 0,
        endGapIn: 84,
      },
    }));

    const panel = screen.getByTestId("cabinet-corner-clearance");
    expect(panel.textContent).toContain("90° corner on Wall 2");
    expect(panel.textContent).toContain("0″ required");
    expect(panel.textContent).toContain("Wall start gap");
    expect(panel.textContent).toContain("84″");
    expect(panel.textContent).toContain("no artificial setback");
  });

  it("shows the applicable 45-degree peninsula clearance without applying it to normal corners", () => {
    render(createElement(CabinetCornerClearancePanel, {
      clearance: {
        wallLabel: "Peninsula return",
        angle: 45,
        placement: "clearance",
        requiredClearanceIn: 11,
        startGapIn: 11,
        endGapIn: 55,
      },
    }));

    const panel = screen.getByTestId("cabinet-corner-clearance");
    expect(panel.textContent).toContain("11″ required");
    expect(panel.textContent).toContain("45° peninsula turn requires 11″");
  });
});

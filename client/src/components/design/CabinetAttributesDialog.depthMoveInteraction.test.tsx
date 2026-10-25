// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CabinetAttachedFillerControls, CabinetDepthMoveControls } from "./CabinetAttributesDialog";

afterEach(cleanup);

describe("CabinetDepthMoveControls interaction", () => {
  it("moves inward by an entered 30-inch distance", () => {
    const onMove = vi.fn();
    const view = render(<CabinetDepthMoveControls onMove={onMove} />);
    const input = view.getByLabelText("Depth move distance in inches");
    fireEvent.change(input, { target: { value: "30" } });
    fireEvent.click(view.getByRole("button", { name: "Move In 30″" }));
    expect(onMove).toHaveBeenCalledWith("in", 30);
  });

  it("normalizes a mixed fraction to one-eighth inch and moves outward by that exact value", () => {
    const onMove = vi.fn();
    const view = render(<CabinetDepthMoveControls onMove={onMove} />);
    const input = view.getByLabelText("Depth move distance in inches");
    fireEvent.change(input, { target: { value: "30 3/8" } });
    fireEvent.click(view.getByRole("button", { name: "Move Out 30.375″" }));
    expect(onMove).toHaveBeenCalledWith("out", 30.375);
  });

  it("keeps the field and both touch-sized actions in one wrapping responsive group", () => {
    const view = render(<CabinetDepthMoveControls onMove={vi.fn()} />);
    const controls = view.getByTestId("cabinet-depth-move-controls");
    expect(controls.className).toContain("flex-wrap");
    expect(view.getAllByRole("button")).toHaveLength(2);
  });
});

describe("CabinetAttachedFillerControls interaction", () => {
  it("edits independent eighth-inch left/right cuts and can remove attached fillers", () => {
    const onApply = vi.fn();
    const view = render(<CabinetAttachedFillerControls value={{ leftAllowed: true, rightAllowed: true, leftIn: 0.5, rightIn: 1.5 }} onApply={onApply} />);
    fireEvent.change(view.getByLabelText("Left attached filler size in inches"), { target: { value: "1.125" } });
    fireEvent.change(view.getByLabelText("Right attached filler size in inches"), { target: { value: "2" } });
    fireEvent.click(view.getByRole("button", { name: "Update attached fillers" }));
    expect(onApply).toHaveBeenCalledWith({ leftIn: 1.125, rightIn: 2 });
    fireEvent.click(view.getByRole("button", { name: "Remove attached fillers" }));
    expect(onApply).toHaveBeenLastCalledWith({ leftIn: 0, rightIn: 0 });
  });

  it("does not render an exposed-side input", () => {
    const view = render(<CabinetAttachedFillerControls value={{ leftAllowed: true, rightAllowed: false, leftIn: 0, rightIn: 0 }} onApply={vi.fn()} />);
    expect(view.getByLabelText("Left attached filler size in inches")).toBeTruthy();
    expect(view.queryByLabelText("Right attached filler size in inches")).toBeNull();
  });
});

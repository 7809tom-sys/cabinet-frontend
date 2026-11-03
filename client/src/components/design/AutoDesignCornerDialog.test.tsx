// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutoDesignCornerDialog } from "./AutoDesignCornerDialog";

afterEach(cleanup);

const baseOptions = [
  { id: 8, masterCode: "LSB36", description: "36 inch Lazy Susan Corner Base", placement: "base", cornerType: "lazy-susan", width: "36" },
  { id: 12, masterCode: "LSB33", description: "33 inch Lazy Susan Corner Base", placement: "base", cornerType: "lazy-susan", width: "33" },
  { id: 9, masterCode: "BBC36", description: "36 inch Blind Corner Base", placement: "base", cornerType: "blind-corner", width: "36" },
  { id: 14, masterCode: "CSB36", description: "36 inch Diagonal Corner Sink Base", placement: "base", cornerType: "diagonal", width: "36" },
];
const wallOptions = [
  { id: 20, masterCode: "DCW2430", description: "24 inch Diagonal Corner Wall", placement: "wall", cornerType: "diagonal", width: "24" },
];
const slot = { id: "wall-1-wall-2", label: "Corner between Wall 1 and Wall 2", firstWall: "Wall 1", secondWall: "Wall 2" } as never;

function renderDialog(overrides: Partial<Parameters<typeof AutoDesignCornerDialog>[0]> = {}) {
  const onConfirm = vi.fn(() => ({ ok: true }) as const);
  render(
    <AutoDesignCornerDialog
      open
      slots={[slot]}
      options={baseOptions as never}
      wallOptions={wallOptions as never}
      onCancel={vi.fn()}
      onConfirm={onConfirm}
      {...overrides}
    />,
  );
  return { onConfirm };
}

describe("AutoDesignCornerDialog: the homeowner picks type, then size", () => {
  it("renders the dialog with a type dropdown and a size dropdown, and no preselected corner", () => {
    renderDialog();
    expect(screen.getByTestId("auto-design-corner-selection-dialog")).toBeTruthy();
    expect(screen.getByTestId("auto-design-corner-type-wall-1-wall-2")).toBeTruthy();
    expect(screen.getByTestId("auto-design-corner-size-wall-1-wall-2")).toBeTruthy();
    // Nothing is assumed: the size dropdown is locked until a type is picked,
    // and the confirm button says what is still missing.
    expect(screen.getByTestId("auto-design-corner-pending-wall-1-wall-2")).toBeTruthy();
    expect(screen.getByTestId("auto-design-corner-confirm").textContent).toMatch(/Pick 1 corner first/i);
    expect((screen.getByTestId("auto-design-corner-confirm") as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers only the corner kinds this line actually sells, in plain words", () => {
    renderDialog();
    fireEvent.click(screen.getByTestId("auto-design-corner-type-wall-1-wall-2"));
    expect(screen.getByTestId("auto-design-corner-type-option-lazy-susan").textContent).toMatch(/Lazy Susan corner/);
    expect(screen.getByTestId("auto-design-corner-type-option-blind").textContent).toMatch(/Blind corner/);
    expect(screen.getByTestId("auto-design-corner-type-option-diagonal").textContent).toMatch(/Angled corner/);
    // A type the line does not carry is simply not offered.
    expect(screen.queryByTestId("auto-design-corner-type-option-corner-drawer")).toBeNull();
  });

  it("asks for the size after the kind, then confirms that exact cabinet", () => {
    const { onConfirm } = renderDialog();
    fireEvent.click(screen.getByTestId("auto-design-corner-type-wall-1-wall-2"));
    fireEvent.click(screen.getByTestId("auto-design-corner-type-option-lazy-susan"));
    fireEvent.click(screen.getByTestId("auto-design-corner-size-wall-1-wall-2"));
    expect(screen.getByTestId("auto-design-corner-size-option-12").textContent).toBe("33 in wide");
    expect(screen.getByTestId("auto-design-corner-size-option-8").textContent).toBe("36 in wide");
    fireEvent.click(screen.getByTestId("auto-design-corner-size-option-12"));
    fireEvent.click(screen.getByTestId("auto-design-corner-confirm"));
    expect(onConfirm).toHaveBeenCalledWith({ "wall-1-wall-2": expect.objectContaining({ cabinetId: 12 }) });
  });

  it("clears the size when the kind changes, so a stale SKU is never carried over", () => {
    const { onConfirm } = renderDialog();
    fireEvent.click(screen.getByTestId("auto-design-corner-type-wall-1-wall-2"));
    fireEvent.click(screen.getByTestId("auto-design-corner-type-option-lazy-susan"));
    fireEvent.click(screen.getByTestId("auto-design-corner-size-wall-1-wall-2"));
    fireEvent.click(screen.getByTestId("auto-design-corner-size-option-12"));
    // Switch to blind: the LSB33 id must not survive.
    fireEvent.click(screen.getByTestId("auto-design-corner-type-wall-1-wall-2"));
    fireEvent.click(screen.getByTestId("auto-design-corner-type-option-blind"));
    expect((screen.getByTestId("auto-design-corner-confirm") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("auto-design-corner-size-wall-1-wall-2"));
    fireEvent.click(screen.getByTestId("auto-design-corner-size-option-9"));
    fireEvent.click(screen.getByTestId("auto-design-corner-confirm"));
    expect(onConfirm).toHaveBeenCalledWith({ "wall-1-wall-2": expect.objectContaining({ cabinetId: 9 }) });
  });

  it("mentions the upper corners the line makes, without deciding them", () => {
    renderDialog();
    const note = screen.getByTestId("auto-design-corner-upper-note");
    expect(note.textContent).toMatch(/angled corner/i);
  });

  it("says plainly when the line sells no corner cabinet at all", () => {
    renderDialog({ options: [] as never, wallOptions: [] as never });
    expect(screen.getByTestId("auto-design-corner-none")).toBeTruthy();
    expect((screen.getByTestId("auto-design-corner-confirm") as HTMLButtonElement).disabled).toBe(true);
  });
});

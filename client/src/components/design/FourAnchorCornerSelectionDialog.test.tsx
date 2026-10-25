// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FourAnchorCornerSelectionDialog } from "./FourAnchorCornerSelectionDialog";

afterEach(cleanup);

describe("FourAnchorCornerSelectionDialog", () => {
  it("preselects a real catalog corner after anchors are seated and never offers an open corner", () => {
    const onConfirm = vi.fn((): { ok: true } => ({ ok: true }));
    render(
      <FourAnchorCornerSelectionDialog
        open
        slots={[{ id: "wall-1-wall-2", label: "Corner between Wall 1 and Wall 2", firstWall: "Wall 1", secondWall: "Wall 2" }]}
        options={[
          { id: 8, masterCode: "LSB36", description: "36 inch Lazy Susan Corner Base", placement: "base", cornerType: "lazy-susan" },
          { id: 9, masterCode: "BBC39", description: "39 inch Blind Corner Base", placement: "base", cornerType: "blind-corner" },
        ]}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Appliances are seated — choose corner cabinets")).toBeTruthy();
    expect(screen.getByText("Corner between Wall 1 and Wall 2")).toBeTruthy();
    expect(screen.queryByText("Leave this corner open")).toBeNull();
    fireEvent.click(screen.getByTestId("four-anchor-corner-confirm"));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      "wall-1-wall-2": expect.objectContaining({ cabinetId: 8 }),
    }));
  });

  it("asks for an explicit 3–6 inch pull when the selected source option is a base blind corner", () => {
    const onConfirm = vi.fn((): { ok: true } => ({ ok: true }));
    render(
      <FourAnchorCornerSelectionDialog
        open
        slots={[{ id: "wall-1-wall-2", label: "Corner between Wall 1 and Wall 2", firstWall: "Wall 1", secondWall: "Wall 2" }]}
        options={[{ id: 9, masterCode: "BBC39", description: "39 inch Blind Corner Base", placement: "base", cornerType: "blind-corner" }]}
        initialChoices={{ "wall-1-wall-2": { cabinetId: 9, blindPullIn: 6 } }}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Blind-corner pull from wall")).toBeTruthy();
    fireEvent.click(screen.getByTestId("four-anchor-corner-confirm"));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      "wall-1-wall-2": expect.objectContaining({ cabinetId: 9, blindPullIn: 6 }),
    }));
  });
});

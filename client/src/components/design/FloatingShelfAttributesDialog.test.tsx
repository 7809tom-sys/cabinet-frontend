// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FloatingShelfAttributesDialog } from "./FloatingShelfAttributesDialog";

const shelf = {
  uid: "floating-1",
  cabinetId: 1,
  masterCode: "FS36",
  description: "Floating Shelf",
  placement: "wall",
  x: 0,
  y: 0,
  width: 36,
  nominalWidth: 36,
  depth: 12,
  height: 0.75,
  rotation: 0,
  mountBottom: 54,
} as any;

describe("FloatingShelfAttributesDialog", () => {
  afterEach(() => cleanup());

  it("persists a chosen bottom height and a length that does not exceed the catalog shelf", () => {
    const onApply = vi.fn();
    render(
      <FloatingShelfAttributesDialog
        shelf={shelf}
        open
        onOpenChange={vi.fn()}
        ceilingHeight={96}
        shelvesOnRun={2}
        onApply={onApply}
        onDuplicate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Shelf bottom height from floor"), { target: { value: "66" } });
    fireEvent.change(screen.getByLabelText("Shelf length in inches"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply shelf placement" }));
    expect(onApply).toHaveBeenCalledWith("floating-1", 66, 30);
    expect(screen.getByText(/2 of 4/i)).toBeTruthy();
  });

  it("duplicates the current installed shelf length at the separately entered bottom height", () => {
    const onDuplicate = vi.fn();
    render(
      <FloatingShelfAttributesDialog
        shelf={{ ...shelf, width: 30 }}
        open
        onOpenChange={vi.fn()}
        ceilingHeight={96}
        shelvesOnRun={2}
        onApply={vi.fn()}
        onDuplicate={onDuplicate}
        onRemove={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Shelf bottom height from floor"), { target: { value: "78" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm duplicate shelf" }));
    expect(onDuplicate).toHaveBeenCalledWith("floating-1", 78);
    expect(screen.getByText(/currently installed length of 30/i)).toBeTruthy();
    expect(screen.getByLabelText("Duplicate shelf placement preview")).toBeTruthy();
    expect(screen.getByText(/New duplicate · bottom 78/i)).toBeTruthy();
  });

  it("lets the customer drag the duplicate preview to update its proposed bottom height", () => {
    render(
      <FloatingShelfAttributesDialog
        shelf={shelf}
        open
        onOpenChange={vi.fn()}
        ceilingHeight={96}
        shelvesOnRun={2}
        onApply={vi.fn()}
        onDuplicate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    const preview = screen.getByRole("slider", { name: "Duplicate shelf preview height" });
    Object.defineProperty(preview.parentElement, "getBoundingClientRect", {
      value: () => ({ bottom: 176, height: 176 }),
    });
    fireEvent.pointerDown(preview, { pointerId: 1, clientY: 100 });
    fireEvent.pointerMove(preview, { pointerId: 1, clientY: 130 });
    fireEvent.pointerUp(preview, { pointerId: 1, clientY: 130 });
    const input = screen.getByLabelText("Shelf bottom height from floor") as HTMLInputElement;
    expect(Number(input.value)).toBeGreaterThan(20);
    expect(Number(input.value)).toBeLessThan(30);
  });

  it("keeps duplication unavailable when the current wall span already has four shelves", () => {
    render(
      <FloatingShelfAttributesDialog
        shelf={shelf}
        open
        onOpenChange={vi.fn()}
        ceilingHeight={96}
        shelvesOnRun={4}
        onApply={vi.fn()}
        onDuplicate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect((screen.getByRole("button", { name: "Confirm duplicate shelf" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("allows a fourth shelf on the same wall span when its proposed height is clear", () => {
    render(
      <FloatingShelfAttributesDialog
        shelf={shelf}
        open
        onOpenChange={vi.fn()}
        ceilingHeight={96}
        shelvesOnRun={3}
        onApply={vi.fn()}
        onDuplicate={vi.fn()}
        getDuplicateOverlapWarning={() => null}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("3 of 4")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Confirm duplicate shelf" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows a live overlap warning and blocks confirmation for a conflicting duplicate height", () => {
    render(
      <FloatingShelfAttributesDialog
        shelf={shelf}
        open
        onOpenChange={vi.fn()}
        ceilingHeight={96}
        shelvesOnRun={2}
        onApply={vi.fn()}
        onDuplicate={vi.fn()}
        getDuplicateOverlapWarning={() => "Overlap warning: this duplicate shelf overlaps W2430, a cabinet, by 6 inches."}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert").textContent).toMatch(/overlaps W2430/i);
    expect((screen.getByRole("button", { name: "Confirm duplicate shelf" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("snaps a dropped duplicate preview to the provided nearest clear height", () => {
    render(
      <FloatingShelfAttributesDialog
        shelf={shelf}
        open
        onOpenChange={vi.fn()}
        ceilingHeight={96}
        shelvesOnRun={2}
        onApply={vi.fn()}
        onDuplicate={vi.fn()}
        getDuplicateOverlapWarning={() => null}
        getNearestDuplicateClearHeight={() => 66}
        onRemove={vi.fn()}
      />,
    );
    const preview = screen.getByRole("slider", { name: "Duplicate shelf preview height" });
    Object.defineProperty(preview.parentElement, "getBoundingClientRect", { value: () => ({ bottom: 176, height: 176 }) });
    fireEvent.pointerDown(preview, { pointerId: 1, clientY: 100 });
    fireEvent.pointerUp(preview, { pointerId: 1, clientY: 100 });
    expect((screen.getByLabelText("Shelf bottom height from floor") as HTMLInputElement).value).toBe("66");
    expect(screen.getByRole("status").textContent).toMatch(/snapped to clear height/i);
  });
});

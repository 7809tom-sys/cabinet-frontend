// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DraggableOverlayDialog } from "./DraggableOverlayDialog";
import { PopupDragGrip } from "./PopupDragGrip";

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

function drag(handle: Element, pointerId = 41) {
  fireEvent.pointerDown(handle, { pointerId, clientX: 460, clientY: 390, button: 0, buttons: 1 });
  fireEvent.pointerMove(handle, { pointerId, clientX: 460, clientY: 110, buttons: 1 });
  fireEvent.pointerUp(handle, { pointerId, clientX: 460, clientY: 110, buttons: 0 });
}

describe("DraggableOverlayDialog", () => {
  it("moves a manually composed popup only from its explicit Drag to move grip", () => {
    render(
      <DraggableOverlayDialog data-testid="manual-popup" aria-label="Choose a sink option">
        <div><PopupDragGrip />Choose a sink option</div>
        <button type="button">Keep current option</button>
      </DraggableOverlayDialog>
    );

    const popup = screen.getByTestId("manual-popup");
    const heading = screen.getByText("Choose a sink option");
    const grip = screen.getByRole("button", { name: "Drag to move this popup" });
    fireEvent.pointerDown(heading, { pointerId: 40, clientX: 460, clientY: 390, button: 0 });
    fireEvent.pointerMove(heading, { pointerId: 40, clientX: 460, clientY: 110, buttons: 1 });
    fireEvent.pointerUp(heading, { pointerId: 40, clientX: 460, clientY: 110 });
    expect(popup.style.translate).toBe("calc(-50% + 0px) calc(-50% + 0px)");

    drag(grip);

    expect(popup.style.translate).toContain("-280px");
  });

  it("does not move when ordinary popup controls are clicked and clears a canceled grip drag", () => {
    render(
      <DraggableOverlayDialog data-testid="manual-popup" aria-label="Choose placement">
        <div><PopupDragGrip /><button type="button">Back</button>Choose placement</div>
      </DraggableOverlayDialog>
    );

    const popup = screen.getByTestId("manual-popup");
    drag(screen.getByRole("button", { name: "Back" }));

    const grip = screen.getByRole("button", { name: "Drag to move this popup" });
    fireEvent.pointerDown(grip, { pointerId: 71, clientX: 460, clientY: 390, button: 0 });
    fireEvent.pointerCancel(grip, { pointerId: 71, clientX: 460, clientY: 390 });
    fireEvent.pointerMove(grip, { pointerId: 71, clientX: 460, clientY: 110, buttons: 1 });

    expect(popup.style.translate).toBe("calc(-50% + 0px) calc(-50% + 0px)");
  });

  it("cancels an abandoned grip drag before later unheld pointer movement can move a legacy popup", () => {
    render(
      <DraggableOverlayDialog data-testid="manual-popup" aria-label="Choose placement">
        <div><PopupDragGrip />Choose placement</div>
      </DraggableOverlayDialog>,
    );

    const popup = screen.getByTestId("manual-popup");
    const grip = screen.getByRole("button", { name: "Drag to move this popup" });
    fireEvent.pointerDown(grip, { pointerId: 72, clientX: 460, clientY: 390, button: 0, buttons: 1 });
    fireEvent.pointerMove(grip, { pointerId: 72, clientX: 460, clientY: 110, buttons: 0 });
    fireEvent.pointerMove(grip, { pointerId: 72, clientX: 460, clientY: 40, buttons: 1 });

    expect(popup.style.translate).toBe("calc(-50% + 0px) calc(-50% + 0px)");
  });

  it("does not invoke a legacy backdrop close from the completion click of a grip drag", () => {
    const onBackdropClick = vi.fn();
    render(
      <DraggableOverlayDialog data-testid="manual-popup" aria-label="Choose placement" onBackdropClick={onBackdropClick}>
        <div><PopupDragGrip />Choose placement</div>
      </DraggableOverlayDialog>,
    );

    const grip = screen.getByRole("button", { name: "Drag to move this popup" });
    const backdrop = document.querySelector("[aria-hidden='true']") as HTMLElement;
    fireEvent.pointerDown(grip, { pointerId: 75, clientX: 460, clientY: 390, button: 0, buttons: 1 });
    fireEvent.pointerMove(grip, { pointerId: 75, clientX: 460, clientY: 110, buttons: 1 });
    fireEvent.pointerUp(grip, { pointerId: 75, clientX: 460, clientY: 110, buttons: 0 });
    fireEvent.click(backdrop);

    expect(onBackdropClick).not.toHaveBeenCalled();
    expect(screen.getByTestId("manual-popup")).not.toBeNull();
  });

  it("restores a manual Designer popup to its last dragged position when reopened in the same session", () => {
    const first = render(
      <DraggableOverlayDialog>
        <h2><PopupDragGrip />Choose a sink option</h2>
      </DraggableOverlayDialog>,
    );
    const movedPopup = screen.getByRole("heading", { name: "Choose a sink option" }).parentElement as HTMLElement;
    drag(screen.getByRole("button", { name: "Drag to move this popup" }), 55);
    const savedTranslate = movedPopup.style.translate;
    expect(savedTranslate).toContain("-280px");

    first.unmount();
    render(
      <DraggableOverlayDialog>
        <h2><PopupDragGrip />Choose a sink option</h2>
      </DraggableOverlayDialog>,
    );

    expect((screen.getByRole("heading", { name: "Choose a sink option" }).parentElement as HTMLElement).style.translate).toBe(savedTranslate);
  });
});

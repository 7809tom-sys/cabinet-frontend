// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "./alert-dialog";
import { FillerAttributesDialog } from "@/components/design/FillerAttributesDialog";

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

function TitleOnlyDialog() {
  return (
    <Dialog open>
      <DialogContent showCloseButton={false} data-testid="title-only-dialog">
        <DialogTitle>Title-only popup</DialogTitle>
        <DialogDescription>Ordinary clicks must not move or dismiss this popup.</DialogDescription>
      </DialogContent>
    </Dialog>
  );
}

function HeaderDialog() {
  return (
    <Dialog open>
      <DialogContent showCloseButton={false} data-testid="header-dialog">
        <DialogHeader>
          <DialogTitle>Header popup</DialogTitle>
          <DialogDescription>Use the dedicated grip to move me.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

function TitleOnlyConfirmationDialog() {
  return (
    <AlertDialog open>
      <AlertDialogContent data-testid="title-only-confirmation-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmation popup</AlertDialogTitle>
          <AlertDialogDescription>Its dedicated grip remains draggable while centered.</AlertDialogDescription>
        </AlertDialogHeader>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function drag(handle: HTMLElement, pointerId = 7) {
  const content = handle.closest("[data-slot='dialog-content'], [data-slot='alert-dialog-content']") as HTMLElement;
  if (content && typeof content.setPointerCapture !== "function") {
    Object.defineProperty(content, "setPointerCapture", { configurable: true, value: () => undefined });
  }
  fireEvent.pointerDown(handle, { pointerId, button: 0, buttons: 1, clientX: 400, clientY: 450 });
  fireEvent.pointerMove(handle, { pointerId, buttons: 1, clientX: 400, clientY: 180 });
  fireEvent.pointerUp(handle, { pointerId, buttons: 0, clientX: 400, clientY: 180 });
}

describe("Dialog popup dragging", () => {
  it("moves a title-only popup only from its explicit Drag to move grip", () => {
    render(<TitleOnlyDialog />);
    const dialog = screen.getByTestId("title-only-dialog");
    const title = screen.getByText("Title-only popup");
    const grip = screen.getByRole("button", { name: "Drag to move this popup" });

    expect(title.getAttribute("data-dialog-drag-handle")).toBeNull();
    expect(grip.getAttribute("data-popup-drag-handle")).toBe("true");
    expect(grip.getAttribute("title")).toBe("Drag to move");
    drag(grip);
    expect(dialog.style.translate).toContain("-270px");
  });

  it("keeps title and content clicks in place instead of beginning a drag or dismissing the popup", () => {
    render(<HeaderDialog />);
    const dialog = screen.getByTestId("header-dialog");
    const title = screen.getByText("Header popup");
    const description = screen.getByText("Use the dedicated grip to move me.");

    fireEvent.pointerDown(title, { pointerId: 31, button: 0, clientX: 400, clientY: 450 });
    fireEvent.pointerMove(title, { pointerId: 31, clientX: 400, clientY: 180 });
    fireEvent.pointerUp(title, { pointerId: 31, clientX: 400, clientY: 180 });
    fireEvent.click(description);

    expect(dialog.style.translate).toBe("calc(-50% + 0px) calc(-50% + 0px)");
    expect(screen.getByTestId("header-dialog")).not.toBeNull();
  });

  it("restores a standard popup to its last grip-dragged position when reopened in the same Designer session", async () => {
    const first = render(<HeaderDialog />);
    const movedDialog = screen.getByTestId("header-dialog");
    drag(screen.getByRole("button", { name: "Drag to move this popup" }), 70);
    const savedTranslate = movedDialog.style.translate;
    expect(savedTranslate).toContain("-270px");
    expect(window.sessionStorage.length).toBeGreaterThan(0);
    expect([...Array(window.sessionStorage.length)].map((_, index) => window.sessionStorage.key(index))).toContain("cabinet-dealz:popup-position:v2:dialog:header-dialog");

    first.unmount();
    render(<HeaderDialog />);

    await waitFor(() => expect(screen.getByTestId("header-dialog").style.translate).toBe(savedTranslate));
  });

  it("clears a canceled touch drag so later pointer movement cannot move the popup", () => {
    render(<HeaderDialog />);
    const dialog = screen.getByTestId("header-dialog");
    const grip = screen.getByRole("button", { name: "Drag to move this popup" });

    fireEvent.pointerDown(grip, { pointerId: 73, button: 0, clientX: 400, clientY: 450 });
    fireEvent.pointerCancel(grip, { pointerId: 73, clientX: 400, clientY: 450 });
    fireEvent.pointerMove(grip, { pointerId: 73, clientX: 400, clientY: 180 });

    expect(dialog.style.translate).toBe("calc(-50% + 0px) calc(-50% + 0px)");
    expect(window.sessionStorage.length).toBe(0);
  });

  it("stops an abandoned grip drag when pointer movement reports no pressed input", () => {
    render(<HeaderDialog />);
    const dialog = screen.getByTestId("header-dialog");
    const grip = screen.getByRole("button", { name: "Drag to move this popup" });

    fireEvent.pointerDown(grip, { pointerId: 74, button: 0, buttons: 1, clientX: 400, clientY: 450 });
    fireEvent.pointerMove(grip, { pointerId: 74, buttons: 0, clientX: 400, clientY: 180 });
    fireEvent.pointerMove(grip, { pointerId: 74, buttons: 1, clientX: 400, clientY: 80 });

    expect(dialog.style.translate).toBe("calc(-50% + 0px) calc(-50% + 0px)");
    expect(window.sessionStorage.length).toBe(0);
  });

  it("gives the actual Filler attributes popup the same dedicated grip", () => {
    render(
      <FillerAttributesDialog
        open
        onOpenChange={() => undefined}
        measuredOpening={2}
        onApply={() => undefined}
        onResizeStandalone={() => undefined}
        onRemove={() => undefined}
        filler={{
          uid: "qa-filler",
          cabinetId: 1,
          masterCode: "F342",
          description: "3 inch filler",
          placement: "base",
          x: 0,
          y: 0,
          width: 1,
          depth: 24,
          height: 34.5,
          rotation: 0,
          fillerPieceGroupId: "qa-filler-group",
          fillerTotalWidth: 1,
          fillerPlacementMode: "right",
        } as any}
      />,
    );

    const dialog = screen.getByTestId("filler-attributes-dialog");
    const title = screen.getByText("Filler attributes");
    const grip = screen.getByRole("button", { name: "Drag to move this popup" });
    expect(title.closest("[data-popup-drag-handle]")).toBeNull();
    expect(grip.getAttribute("data-popup-drag-handle")).toBe("true");
    drag(grip, 8);
    expect(dialog.style.translate).toContain("-270px");
  });

  it("moves a confirmation popup by its explicit grip without replacing its centered translate", () => {
    render(<TitleOnlyConfirmationDialog />);
    const dialog = screen.getByTestId("title-only-confirmation-dialog");
    const title = screen.getByText("Confirmation popup");
    const grip = screen.getByRole("button", { name: "Drag to move this popup" });

    expect(title.getAttribute("data-alert-dialog-drag-handle")).toBeNull();
    expect(grip.getAttribute("data-popup-drag-handle")).toBe("true");
    drag(grip, 9);
    expect(dialog.style.translate).toContain("calc(-50% + 0px) calc(-50% + -270px)");
  });

  it("restores a confirmation popup to its last grip-dragged position when reopened in the same session", async () => {
    const first = render(<TitleOnlyConfirmationDialog />);
    const movedDialog = screen.getByTestId("title-only-confirmation-dialog");
    drag(screen.getByRole("button", { name: "Drag to move this popup" }), 90);
    const savedTranslate = movedDialog.style.translate;
    expect(savedTranslate).toContain("-270px");

    first.unmount();
    render(<TitleOnlyConfirmationDialog />);

    await waitFor(() => expect(screen.getByTestId("title-only-confirmation-dialog").style.translate).toBe(savedTranslate));
  });
});

// @vitest-environment jsdom
/**
 * The bathroom sink / faucet picker is a `DraggableOverlayDialog` — a plain div
 * overlay, not a Radix Dialog. It only wired a backdrop click, so a long list
 * could scroll its own "Skip" link out of reach and the popup had no X and no
 * Escape handling at all: the exact "pop-up I cannot dismiss" the owner hit.
 *
 * Each dismissal is asserted separately so a regression names the path that broke.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { DraggableOverlayDialog } from "./DraggableOverlayDialog";

afterEach(cleanup);

function Picker({ onClose }: { onClose: () => void }) {
  return (
    <DraggableOverlayDialog
      onBackdropClick={onClose}
      overlayClassName="bg-black/60 pointer-events-auto"
      contentClassName="bg-card rounded-2xl p-6"
    >
      <h2>Choose a vanity sink</h2>
      <button type="button">Long list item</button>
    </DraggableOverlayDialog>
  );
}

function Host({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>reopen</button>
      {open ? <Picker onClose={() => { setOpen(false); onClose(); }} /> : <p>closed</p>}
    </div>
  );
}

describe("DraggableOverlayDialog always offers a way out", () => {
  it("closes from the X control", async () => {
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    await act(async () => { fireEvent.click(screen.getByTestId("popup-dialog-close")); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText("closed")).toBeTruthy();
  });

  it("closes from Escape", async () => {
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    await act(async () => {
      fireEvent.keyDown(document.body, { key: "Escape", bubbles: true, cancelable: true });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText("closed")).toBeTruthy();
  });

  it("closes from a tap outside on the backdrop", async () => {
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    const backdrop = document.querySelector("div[aria-hidden='true']") as HTMLElement;
    await act(async () => { fireEvent.click(backdrop); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the X reachable above the scrolled content", () => {
    render(<Picker onClose={() => {}} />);
    const close = screen.getByTestId("popup-dialog-close");
    expect(close.getAttribute("aria-label")).toBe("Close this popup");
    // The control must sit inside the scroll container, so it travels with the
    // popup when it is dragged, and be positioned absolutely at its top-right.
    expect(close.className).toContain("absolute");
    expect(close.className).toContain("right-2");
    expect(close.className).toContain("h-9");
    expect(close.className).toContain("w-9");
  });

  it("leaves Escape to a nested popup that owns the key", async () => {
    const onClose = vi.fn();
    render(<Picker onClose={onClose} />);
    // A Radix Select menu opened from the picker renders this wrapper.
    const popper = document.createElement("div");
    popper.setAttribute("data-radix-popper-content-wrapper", "true");
    document.body.appendChild(popper);
    try {
      await act(async () => {
        fireEvent.keyDown(document.body, { key: "Escape", bubbles: true, cancelable: true });
      });
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      popper.remove();
    }
  });

  it("ignores Escape with a browser modifier, so Cmd/Ctrl+Esc still reaches the browser", async () => {
    const onClose = vi.fn();
    render(<Picker onClose={onClose} />);
    await act(async () => {
      fireEvent.keyDown(document.body, { key: "Escape", metaKey: true, bubbles: true, cancelable: true });
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});

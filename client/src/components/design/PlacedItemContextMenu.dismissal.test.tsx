// @vitest-environment jsdom
/**
 * The placed-item right-click menu floats over the plan and never takes focus.
 * Escape did nothing and the menu had no close control, so on a tablet (where
 * there is no Escape key and a long-press is what opened it) it stayed on screen
 * over the cabinet the user was trying to delete.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PlacedItemContextMenu } from "./PlacedItemContextMenu";

afterEach(cleanup);

const menu = { x: 40, y: 60, uid: "vanity-1", label: "VSB24" };

function renderMenu(onClose = vi.fn()) {
  const onRemove = vi.fn();
  render(<PlacedItemContextMenu menu={menu} onEdit={() => {}} onMove={() => {}} onRemove={onRemove} onClose={onClose} />);
  return { onClose, onRemove };
}

describe("placed item menu can always be dismissed", () => {
  it("offers a labelled close control", async () => {
    const { onClose } = renderMenu();
    const close = screen.getByTestId("placed-item-menu-close");
    expect(close.getAttribute("aria-label")).toBe("Close the VSB24 actions");
    await act(async () => { fireEvent.click(close); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", async () => {
    const { onClose } = renderMenu();
    await act(async () => {
      fireEvent.keyDown(document.body, { key: "Escape", bubbles: true, cancelable: true });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the user presses anywhere outside it", async () => {
    const { onClose } = renderMenu();
    await act(async () => { fireEvent.pointerDown(document.body, { bubbles: true }); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when the user presses the menu itself", async () => {
    const { onClose } = renderMenu();
    await act(async () => { fireEvent.pointerDown(screen.getByTestId("placed-item-context-menu")); });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("still runs Remove and dismisses in one action", async () => {
    const { onClose, onRemove } = renderMenu();
    await act(async () => { fireEvent.click(screen.getByTestId("placed-item-menu-remove")); });
    expect(onRemove).toHaveBeenCalledWith("vanity-1");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves Escape to a nested dialog that owns the key", async () => {
    const { onClose } = renderMenu();
    const dialog = document.createElement("div");
    dialog.setAttribute("data-slot", "dialog-content");
    const inner = document.createElement("button");
    dialog.appendChild(inner);
    document.body.appendChild(dialog);
    try {
      await act(async () => {
        fireEvent.keyDown(inner, { key: "Escape", bubbles: true, cancelable: true });
      });
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      dialog.remove();
    }
  });
});

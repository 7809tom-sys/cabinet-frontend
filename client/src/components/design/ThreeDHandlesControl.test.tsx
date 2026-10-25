// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreeDHandlesControl } from "./ThreeDHandlesControl";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: ReturnType<typeof createRoot> | undefined;
let host: HTMLDivElement;
afterEach(() => { if (root) act(() => root?.unmount()); host?.remove(); root = undefined; });
function render(value: "none" | "bar-pull" = "none") {
  host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host); const change = vi.fn();
  act(() => root!.render(<ThreeDHandlesControl value={value} onChange={change} />));
  return { button: host.querySelector("button")!, change };
}
describe("3D Handles access", () => {
  it("uses a small labeled touch button rather than leaving a second selector open on the canvas", () => {
    const { button } = render();
    expect(button.textContent).toContain("Handles");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("Cabinet handles in 3D");
    expect(button.className).toContain("min-h-11");
    expect(host.querySelector("select")).toBeNull();
    act(() => button.click());
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(host.querySelector('[data-testid="three-d-handles-popover"]')!.id).toBe(button.getAttribute("aria-controls"));
  });
  it("shows a restored None accurately and enables handles through the existing persisted-state callback", () => {
    const { button, change } = render();
    act(() => button.click());
    const select = host.querySelector("select")!;
    expect(select.value).toBe("none");
    expect(host.textContent).toContain("No handles selected");
    expect(host.textContent).toContain("no added price");
    act(() => { select.value = "bar-pull"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(change).toHaveBeenCalledTimes(1);
    expect(change).toHaveBeenCalledWith("bar-pull");
    expect(host.querySelector("select")).toBeNull();
  });
  it("shows a compact door-and-drawer hardware preview for each selected style", () => {
    const { button } = render("bar-pull");
    act(() => button.click());
    const preview = host.querySelector('[data-testid="hardware-preview"]')!;
    expect(preview.textContent).toContain("Hardware preview");
    expect(preview.textContent).toContain("Door");
    expect(preview.textContent).toContain("Drawer");
    expect(preview.querySelector('[aria-label="bar pull preview"]')).not.toBeNull();
  });
  it("closes on Escape, returns focus and does not invoke the canvas handlers", () => {
    const { button } = render("bar-pull"); const bubble = vi.fn();
    document.body.addEventListener("keydown", bubble);
    act(() => button.click());
    const select = host.querySelector("select")!;
    expect(select.value).toBe("bar-pull");
    act(() => select.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
    expect(bubble).not.toHaveBeenCalled();
    document.body.removeEventListener("keydown", bubble);
  });
});

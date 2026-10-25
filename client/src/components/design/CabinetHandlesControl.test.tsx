// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CabinetHandlesControl, DEFAULT_DESIGNER_HARDWARE_STYLE_ID } from "./CabinetHandlesControl";
import { DEFAULT_HARDWARE_STYLE_ID } from "@/lib/hardware";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: ReturnType<typeof createRoot> | undefined;
let host: HTMLDivElement | undefined;
afterEach(() => { if (root) act(() => root?.unmount()); host?.remove(); root = undefined; });

function render(value: "none" | "bar-pull" = "none") {
  host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host); const change = vi.fn();
  act(() => root!.render(<CabinetHandlesControl value={value} onChange={change} tablet />));
  return { select: host.querySelector("select")!, change };
}

describe("visible cabinet Handles control", () => {
  it("defaults new regular Designer plans to bar pulls without changing shared renderers", () => {
    expect(DEFAULT_DESIGNER_HARDWARE_STYLE_ID).toBe("bar-pull");
    expect(DEFAULT_HARDWARE_STYLE_ID).toBe("none");
  });
  it("preserves an explicitly saved None and exposes all existing hardware styles", () => {
    const { select } = render();
    expect(select.value).toBe("none");
    expect(select.getAttribute("aria-label")).toBe("Cabinet handles");
    expect(Array.from(select.options).map(o => o.value)).toEqual(["none", "knob", "bar-pull", "cup-pull", "knob-and-pull"]);
  });
  it("changes the real select value through the original hardware callback", () => {
    const { select, change } = render();
    act(() => { select.value = "bar-pull"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(change).toHaveBeenCalledWith("bar-pull");
    expect(host!.textContent).toContain("Handles");
    expect(host!.querySelector("label")!.title).toContain("unpriced");
    expect(host!.querySelector("label")!.className).toContain("min-h-10");
  });
});

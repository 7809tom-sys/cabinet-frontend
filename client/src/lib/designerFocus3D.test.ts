// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canRequestDesignerFullscreen,
  exitDesignerFullscreen,
  isDesignerFocusExitKey,
  requestDesignerFullscreen,
  shouldIgnoreFocusExitKey,
} from "./designerFocus3D";

afterEach(() => {
  delete (HTMLElement.prototype as unknown as Record<string, unknown>)
    .requestFullscreen;
  delete (document as unknown as Record<string, unknown>).exitFullscreen;
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => null,
  });
});

describe("designer Focus 3D browser helpers", () => {
  it("reports fullscreen support instead of assuming it", () => {
    const element = document.createElement("div");
    expect(canRequestDesignerFullscreen(element)).toBe(false);
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: async () => {},
    });
    expect(canRequestDesignerFullscreen(element)).toBe(true);
    expect(canRequestDesignerFullscreen(null)).toBe(false);
  });

  it("never throws when fullscreen is refused or unavailable", async () => {
    const element = document.createElement("div");
    await expect(requestDesignerFullscreen(element)).resolves.toBe(false);

    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: vi.fn(async () => {
        throw new Error("denied");
      }),
    });
    await expect(requestDesignerFullscreen(element)).resolves.toBe(false);

    await expect(exitDesignerFullscreen()).resolves.toBeUndefined();
  });

  it("stops listening to Esc only for Esc, and never for a dialog or a text field", () => {
    expect(isDesignerFocusExitKey("Escape")).toBe(true);
    expect(isDesignerFocusExitKey("Esc")).toBe(true);
    expect(isDesignerFocusExitKey("Enter")).toBe(false);

    expect(shouldIgnoreFocusExitKey({ key: "Escape" })).toBe(false);
    expect(shouldIgnoreFocusExitKey({ key: "Enter" })).toBe(true);
    expect(
      shouldIgnoreFocusExitKey({ key: "Escape", defaultPrevented: true }),
    ).toBe(true);

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const insideDialog = document.createElement("button");
    dialog.appendChild(insideDialog);
    document.body.appendChild(dialog);
    expect(
      shouldIgnoreFocusExitKey({ key: "Escape", target: insideDialog }),
    ).toBe(true);
    dialog.remove();

    const input = document.createElement("input");
    document.body.appendChild(input);
    expect(shouldIgnoreFocusExitKey({ key: "Escape", target: input })).toBe(
      true,
    );
    input.remove();
  });
});

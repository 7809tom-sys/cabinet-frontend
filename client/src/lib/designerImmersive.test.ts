import { describe, expect, it } from "vitest";
import {
  browserFullscreenOwnsElement,
  canRequestBrowserFullscreen,
  immersiveEscapePressed,
  immersiveStateAfterFullscreenChange,
  immersiveToggleLabel,
  shouldRequestBrowserFullscreen,
  DESIGNER_IMMERSIVE_CHROME,
} from "./designerImmersive";

/** A fake element that looks like a fullscreen-able node. */
function fullscreenElement() {
  return { requestFullscreen: () => Promise.resolve() };
}

describe("canvas-only (immersive) mode", () => {
  it("names every bar the owner asked to hide", () => {
    // Two app/browser chrome bars plus the two designer toolbars.
    expect(DESIGNER_IMMERSIVE_CHROME).toHaveLength(4);
    expect(DESIGNER_IMMERSIVE_CHROME).toEqual([
      "site-header",
      "history-nav",
      "designer-toolbar",
      "mobile-bottom-bar",
    ]);
  });

  it("treats the Fullscreen API as an enhancement, never a requirement", () => {
    expect(canRequestBrowserFullscreen(null)).toBe(false);
    expect(canRequestBrowserFullscreen({})).toBe(false);
    expect(canRequestBrowserFullscreen({ requestFullscreen: "nope" })).toBe(false);
    expect(canRequestBrowserFullscreen(fullscreenElement())).toBe(true);
    // Entering immersive mode asks only when it can, and only once.
    expect(shouldRequestBrowserFullscreen({ entering: true, element: fullscreenElement(), alreadyOwned: false })).toBe(true);
    expect(shouldRequestBrowserFullscreen({ entering: true, element: {}, alreadyOwned: false })).toBe(false);
    expect(shouldRequestBrowserFullscreen({ entering: false, element: fullscreenElement(), alreadyOwned: false })).toBe(false);
    expect(shouldRequestBrowserFullscreen({ entering: true, element: fullscreenElement(), alreadyOwned: true })).toBe(false);
  });

  it("recognises its own fullscreen session and nothing else", () => {
    const ours = fullscreenElement();
    expect(browserFullscreenOwnsElement({ fullscreenElement: ours }, ours)).toBe(true);
    expect(browserFullscreenOwnsElement({ fullscreenElement: fullscreenElement() }, ours)).toBe(false);
    expect(browserFullscreenOwnsElement({ fullscreenElement: null }, ours)).toBe(false);
    // Older WebKit exposes only the prefixed property.
    expect(browserFullscreenOwnsElement({ webkitFullscreenElement: ours }, ours)).toBe(true);
    expect(browserFullscreenOwnsElement(undefined, ours)).toBe(false);
  });

  it("clears the hidden-chrome flag when the browser ends fullscreen without us (the stranded-user bug)", () => {
    const ours = fullscreenElement();
    expect(immersiveStateAfterFullscreenChange({
      immersive: true,
      element: ours,
      documentLike: { fullscreenElement: ours },
    })).toEqual({ keepImmersive: true, clearImmersive: false });
    expect(immersiveStateAfterFullscreenChange({
      immersive: true,
      element: ours,
      documentLike: { fullscreenElement: null },
    })).toEqual({ keepImmersive: false, clearImmersive: true });
    // Not immersive: nothing to clear, so an unrelated fullscreen change is inert.
    expect(immersiveStateAfterFullscreenChange({
      immersive: false,
      element: ours,
      documentLike: { fullscreenElement: null },
    })).toEqual({ keepImmersive: false, clearImmersive: false });
  });

  it("exits on Esc even when the Fullscreen API was never used", () => {
    expect(immersiveEscapePressed({ key: "Escape" })).toBe(true);
    expect(immersiveEscapePressed({ key: "Esc" })).toBe(false);
    expect(immersiveEscapePressed({ key: "Enter" })).toBe(false);
    expect(immersiveEscapePressed(null)).toBe(false);
    // Browser shortcuts that include Esc are left to the browser.
    expect(immersiveEscapePressed({ key: "Escape", metaKey: true })).toBe(false);
    expect(immersiveEscapePressed({ key: "Escape", ctrlKey: true })).toBe(false);
    expect(immersiveEscapePressed({ key: "Escape", altKey: true })).toBe(false);
  });

  it("labels the button by the action it performs, in both states", () => {
    expect(immersiveToggleLabel(false).ariaLabel).toBe("Fullscreen view");
    expect(immersiveToggleLabel(true).ariaLabel).toBe("Exit fullscreen");
    expect(immersiveToggleLabel(false).title).toContain("Fullscreen view");
    expect(immersiveToggleLabel(true).title).toContain("Exit fullscreen");
    // The tooltip also has to say what pressing it returns to.
    expect(immersiveToggleLabel(true).title.toLowerCase()).toContain("edit mode");
  });
});

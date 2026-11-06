// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import DesignerHistoryNav from "@/components/design/DesignerHistoryNav";
import { LanguageProvider } from "@/contexts/LanguageContext";
import {
  HISTORY_INDEX_STATE_KEY,
  historyNavigationSnapshot,
  historySnapshotAfterPop,
  installHistoryIndex,
  readHistoryIndex,
  readStampedHistoryIndex,
  resetHistoryNavigationForTests,
  setHistoryNavigationForTests,
} from "@/lib/browserHistoryNav";

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  resetHistoryNavigationForTests();
  installHistoryIndex();
});

afterEach(() => {
  cleanup();
  resetHistoryNavigationForTests();
  vi.restoreAllMocks();
});

describe("history depth tracking", () => {
  it("stamps a depth on every entry so Back knows a previous page exists", () => {
    expect(readStampedHistoryIndex()).toBe(0);

    window.history.pushState(null, "", "/styles");
    expect(readStampedHistoryIndex()).toBe(1);
    expect(historyNavigationSnapshot()).toMatchObject({ index: 1, canGoBack: true, canGoForward: false });

    window.history.pushState(null, "", "/design");
    expect(readStampedHistoryIndex()).toBe(2);
    expect(historyNavigationSnapshot()).toMatchObject({ index: 2, furthestIndex: 2, canGoForward: false });
  });

  it("keeps the depth of the entry replaceState overwrites instead of counting a new page", () => {
    window.history.pushState(null, "", "/styles");
    window.history.replaceState({ other: "kept" }, "", "/styles?door=Shaker");

    expect(readStampedHistoryIndex()).toBe(1);
    expect(historyNavigationSnapshot().index).toBe(1);
    // Unrelated state written by other code survives the stamp.
    expect((window.history.state as Record<string, unknown>).other).toBe("kept");
  });

  it("opens a forward stack after Back and closes it again at the deepest entry", () => {
    window.history.pushState(null, "", "/styles");
    window.history.pushState(null, "", "/design");

    // Going back lands on the /styles entry the browser restored.
    const afterBack = historySnapshotAfterPop(historyNavigationSnapshot(), { [HISTORY_INDEX_STATE_KEY]: 1 });
    expect(afterBack).toMatchObject({ index: 1, furthestIndex: 2, canGoBack: true, canGoForward: true });

    const backHome = historySnapshotAfterPop(afterBack, { [HISTORY_INDEX_STATE_KEY]: 0 });
    expect(backHome).toMatchObject({ index: 0, canGoBack: false, canGoForward: true });

    const forwardAgain = historySnapshotAfterPop(backHome, { [HISTORY_INDEX_STATE_KEY]: 2 });
    expect(forwardAgain).toMatchObject({ index: 2, canGoForward: false, canGoBack: true });
  });

  it("treats an entry this app did not stamp as the first page of the tab", () => {
    expect(readHistoryIndex(null)).toBe(0);
    expect(readHistoryIndex({ unrelated: true })).toBe(0);
    expect(readHistoryIndex({ [HISTORY_INDEX_STATE_KEY]: -3 })).toBe(0);
    expect(readHistoryIndex({ [HISTORY_INDEX_STATE_KEY]: 4 })).toBe(4);
  });

  it("reports nothing to go forward to when the app is opened from a direct link", () => {
    expect(historyNavigationSnapshot()).toEqual({
      index: 0,
      furthestIndex: 0,
      canGoBack: false,
      canGoForward: false,
    });
  });
});

function renderNav(fallbackHref?: string) {
  // wouter's hook returns [location, navigate]; the test drives the same
  // browser History the real app uses, so navigate is a plain pushState.
  const hook = (): [string, (to: string, opts?: { replace?: boolean }) => void] => [
    window.location.pathname,
    (to, opts) => {
      if (opts?.replace) window.history.replaceState(null, "", to);
      else window.history.pushState(null, "", to);
    },
  ];
  return render(
    <LanguageProvider>
      <Router hook={hook}>
        <DesignerHistoryNav fallbackHref={fallbackHref} />
      </Router>
    </LanguageProvider>,
  );
}

describe("Designer Back / Forward controls", () => {
  it("goes to the previous page when this tab has one behind it", () => {
    window.history.pushState(null, "", "/styles");
    window.history.pushState(null, "", "/design");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    renderNav();

    act(() => screen.getByTestId("designer-history-back").click());

    expect(back).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/design");
  });

  it("falls back to the front page from a direct link", () => {
    renderNav();
    expect(window.location.pathname).toBe("/");

    act(() => screen.getByTestId("designer-history-back").click());

    expect(window.location.pathname).toBe("/");
    expect(window.history.length).toBeGreaterThan(0);
  });

  it("uses the storefront the designer belongs to as the direct-link fallback", () => {
    window.history.replaceState(null, "", "/store/toms-store/design");
    resetHistoryNavigationForTests();
    installHistoryIndex();
    renderNav("/store/toms-store");

    act(() => screen.getByTestId("designer-history-back").click());

    expect(window.location.pathname).toBe("/store/toms-store");
  });

  it("disables Forward until a Back has something to undo, then re-enables it", () => {
    window.history.pushState(null, "", "/styles");
    window.history.pushState(null, "", "/design");
    renderNav();

    const forward = () => screen.getByTestId("designer-history-forward") as HTMLButtonElement;
    expect(forward().disabled).toBe(true);
    expect(forward().getAttribute("aria-disabled")).toBe("true");

    // The browser popped back one entry inside the same tab.
    act(() => {
      setHistoryNavigationForTests(1, 2);
    });
    expect(forward().disabled).toBe(false);
    expect(forward().getAttribute("aria-disabled")).toBe("false");

    act(() => {
      setHistoryNavigationForTests(2, 2);
    });
    expect(forward().disabled).toBe(true);
  });

  it("asks the browser to move forward only when there is somewhere to go", () => {
    window.history.pushState(null, "", "/styles");
    window.history.pushState(null, "", "/design");
    const forwardSpy = vi.spyOn(window.history, "forward").mockImplementation(() => {});
    renderNav();

    act(() => screen.getByTestId("designer-history-forward").click());
    expect(forwardSpy).not.toHaveBeenCalled();

    act(() => setHistoryNavigationForTests(1, 2));
    act(() => screen.getByTestId("designer-history-forward").click());
    expect(forwardSpy).toHaveBeenCalledTimes(1);
  });

  it("offers both controls together under one accessible group", () => {
    renderNav();
    const group = screen.getByTestId("designer-history-nav");
    expect(group.getAttribute("role")).toBe("group");
    expect(group.getAttribute("aria-label")).toBe("Page history");
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Forward" })).toBeTruthy();
  });
});

import { useSyncExternalStore } from "react";

/**
 * Depth tracking for the Designer's Back / Forward controls.
 *
 * The History API cannot answer "is there a page behind me?" or "is there a page
 * ahead of me?". `history.length` counts every entry the tab has ever created and
 * never shrinks, so it says "there is history" for a link opened in a fresh tab
 * and keeps saying it after you press Back, which would leave Forward permanently
 * greyed out. What the browser's own stack knows — and what these controls need —
 * is a depth: how far the current entry sits from the first entry this app made,
 * and how deep this tab has ever been.
 *
 * So each entry we create carries its depth in `history.state` (the same
 * pushState/replaceState patching wouter already does to observe navigation),
 * and the deepest depth reached in this tab is the end of the Forward stack:
 *
 *   canGoBack    = depth > 0            (a real previous entry exists)
 *   canGoForward = depth < deepest      (we came back from somewhere)
 *
 * A direct link, or the app's first entry, has depth 0, so Back has no previous
 * entry to restore and the Designer answers that case by going to the front page.
 *
 * Known limit: the browser keeps its Forward stack across a full page reload, but
 * the deepest depth only lives in this page's memory, so after a reload Forward
 * starts greyed out even if the browser itself could still go forward.
 */

export const HISTORY_INDEX_STATE_KEY = "__cdHistoryIndex";

export type HistoryNavigationSnapshot = {
  /** Depth of the entry we are on, counted from this app's first entry in the tab. */
  index: number;
  /** Deepest depth reached in this tab: the top of the Forward stack. */
  furthestIndex: number;
  /** A real previous entry exists, so Back can use the browser's own stack. */
  canGoBack: boolean;
  /** An entry exists ahead of us, so Forward can use the browser's own stack. */
  canGoForward: boolean;
};

const EMPTY_SNAPSHOT: HistoryNavigationSnapshot = {
  index: 0,
  furthestIndex: 0,
  canGoBack: false,
  canGoForward: false,
};

const PATCH_KEY = Symbol.for("cabinet_dealz_history_index");

let snapshot: HistoryNavigationSnapshot = EMPTY_SNAPSHOT;
let installed = false;
let originals: { pushState: History["pushState"]; replaceState: History["replaceState"] } | null = null;
const listeners = new Set<() => void>();

/** The depth stamped on an entry, or 0 for an entry this app did not create. */
export function readHistoryIndex(state: unknown): number {
  if (!state || typeof state !== "object") return 0;
  const value = (state as Record<string, unknown>)[HISTORY_INDEX_STATE_KEY];
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

/** The state a popstate lands us in: where we are now, and how deep the tab has been. */
export function historySnapshotAfterPop(
  previous: HistoryNavigationSnapshot,
  state: unknown,
): HistoryNavigationSnapshot {
  const index = readHistoryIndex(state);
  const furthestIndex = Math.max(previous.furthestIndex, index);
  return { index, furthestIndex, canGoBack: index > 0, canGoForward: index < furthestIndex };
}

function publish(next: HistoryNavigationSnapshot): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function publishPosition(index: number, furthestIndex: number): void {
  publish({
    index,
    furthestIndex,
    canGoBack: index > 0,
    canGoForward: index < furthestIndex,
  });
}

export function historyNavigationSnapshot(): HistoryNavigationSnapshot {
  return snapshot;
}

export function subscribeToHistoryNavigation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Starts tracking. Call once before the app navigates anywhere (main.tsx does),
 * so an in-app click from the front page is already one step deep by the time the
 * Designer asks whether it can go back.
 */
export function installHistoryIndex(): void {
  if (installed || typeof window === "undefined") return;
  const flagged = window as unknown as Record<symbol, unknown>;
  // Hot reload replaces this module's variables but not the patched methods.
  if (flagged[PATCH_KEY]) {
    installed = true;
    return;
  }
  flagged[PATCH_KEY] = true;
  installed = true;

  const { history } = window;
  const startIndex = readHistoryIndex(history.state);
  publishPosition(startIndex, startIndex);

  originals = { pushState: history.pushState, replaceState: history.replaceState };

  for (const method of ["pushState", "replaceState"] as const) {
    const original = originals[method];
    history[method] = function patchedHistoryMethod(this: History, ...args: unknown[]) {
      const [state, , url] = args as [unknown, string, string | URL | undefined];
      // pushState opens a new entry; replaceState overwrites the current one.
      const index = method === "pushState" ? snapshot.index + 1 : snapshot.index;
      const furthestIndex = Math.max(snapshot.furthestIndex, index);
      const stamped = {
        ...(state && typeof state === "object" ? (state as Record<string, unknown>) : {}),
        [HISTORY_INDEX_STATE_KEY]: index,
      };
      const result = original.call(this, stamped, "", url);
      publishPosition(index, furthestIndex);
      return result;
    } as History["pushState"];
  }

  window.addEventListener("popstate", () => {
    publish(historySnapshotAfterPop(snapshot, history.state));
  });
}

/** Test-only: restores the original history methods and clears all tracking. */
export function resetHistoryNavigationForTests(): void {
  if (typeof window === "undefined") return;
  if (originals) {
    window.history.pushState = originals.pushState;
    window.history.replaceState = originals.replaceState;
    originals = null;
  }
  delete (window as unknown as Record<symbol, unknown>)[PATCH_KEY];
  installed = false;
  snapshot = EMPTY_SNAPSHOT;
  listeners.clear();
}

/** Test-only: place the tracker on an entry the browser would have restored. */
export function setHistoryNavigationForTests(index: number, furthestIndex: number): void {
  publishPosition(index, Math.max(index, furthestIndex));
}

/** Test-only: the depth stamped by any pushState/replaceState in this tab. */
export function readStampedHistoryIndex(): number {
  return typeof window === "undefined" ? 0 : readHistoryIndex(window.history.state);
}

export function useHistoryNavigation(): HistoryNavigationSnapshot {
  return useSyncExternalStore(
    subscribeToHistoryNavigation,
    historyNavigationSnapshot,
    () => EMPTY_SNAPSHOT,
  );
}

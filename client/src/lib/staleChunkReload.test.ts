import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STALE_CHUNK_RELOAD_FLAG,
  STALE_CHUNK_STABLE_MS,
  guardedPageReload,
  installStaleChunkReload,
  isChunkLoadError,
  pageReloadEnv,
  pageReloadPending,
  reloadForStaleChunk,
  resetPageReloadState,
} from "./staleChunkReload";

function memoryStorage(stored: Record<string, string> = {}): Storage {
  return {
    getItem: (key: string) => stored[key] ?? null,
    setItem: (key: string, value: string) => { stored[key] = value; },
    removeItem: (key: string) => { delete stored[key]; },
    clear: () => { for (const key of Object.keys(stored)) delete stored[key]; },
    key: (index: number) => Object.keys(stored)[index] ?? null,
    get length() { return Object.keys(stored).length; },
  };
}

const realEnv = { ...pageReloadEnv };
let reload: ReturnType<typeof vi.fn>;
let stored: Record<string, string>;

beforeEach(() => {
  vi.useFakeTimers();
  reload = vi.fn();
  stored = {};
  const storage = memoryStorage(stored);
  Object.assign(pageReloadEnv, { reload, storage: () => storage, now: () => 1_000_000 });
  resetPageReloadState();
});

afterEach(() => {
  Object.assign(pageReloadEnv, realEnv);
  vi.useRealTimers();
});

describe("stale build chunks", () => {
  it("recognizes a failed chunk load in Chrome, Edge, Firefox and Safari", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://www.cabinetdealz.com/assets/DesignTool-BF--MoSG.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("error loading dynamically imported module: https://www.cabinetdealz.com/assets/DesignTool-x.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new Error("Unable to preload CSS for /assets/DesignTool-x.css"))).toBe(true);
    expect(isChunkLoadError(Object.assign(new Error("Loading chunk 812 failed."), { name: "ChunkLoadError" }))).toBe(true);
    expect(isChunkLoadError(new Error("Maximum update depth exceeded"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });

  it("reloads once, then leaves a repeat failure to the error panel", () => {
    expect(reloadForStaleChunk("page")).toBe(true);
    expect(reload).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(pageReloadPending()).toBe(true);
    expect(JSON.parse(stored[STALE_CHUNK_RELOAD_FLAG]!)).toMatchObject({ surface: "page", reason: "chunk-load" });
    resetPageReloadState();
    expect(reloadForStaleChunk("page")).toBe(false);
    expect(reloadForStaleChunk("designer", ["cabinetdealz.designerBoundaryReload:designer"])).toBe(false);
    vi.runAllTimers();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("never reloads by itself without session storage, or when it throws", () => {
    pageReloadEnv.storage = () => null;
    expect(reloadForStaleChunk("page")).toBe(false);
    expect(guardedPageReload(["any"], { reason: "repeated-crash" })).toBe(false);
    pageReloadEnv.storage = () => { throw new Error("SecurityError"); };
    expect(reloadForStaleChunk("page")).toBe(false);
    pageReloadEnv.storage = () => ({ ...memoryStorage(), getItem: () => { throw new Error("blocked"); } }) as Storage;
    expect(reloadForStaleChunk("page")).toBe(false);
    pageReloadEnv.storage = () => ({ ...memoryStorage(), setItem: () => { throw new Error("QuotaExceededError"); } }) as Storage;
    expect(reloadForStaleChunk("page")).toBe(false);
    vi.runAllTimers();
    expect(reload).not.toHaveBeenCalled();
  });

  it("handles Vite's preload error by reloading instead of throwing, once", () => {
    const target = new EventTarget();
    installStaleChunkReload(target as unknown as Window);
    const event = new Event("vite:preloadError", { cancelable: true });
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    vi.advanceTimersByTime(0);
    expect(reload).toHaveBeenCalledTimes(1);
    const repeat = new Event("vite:preloadError", { cancelable: true });
    target.dispatchEvent(repeat);
    expect(repeat.defaultPrevented).toBe(false);
    // A stale chunk this load keeps the guard set.
    vi.advanceTimersByTime(STALE_CHUNK_STABLE_MS + 1);
    expect(stored[STALE_CHUNK_RELOAD_FLAG]).toBeDefined();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("re-arms the guard after a page load runs cleanly", () => {
    stored[STALE_CHUNK_RELOAD_FLAG] = "{}";
    installStaleChunkReload(new EventTarget() as unknown as Window);
    vi.advanceTimersByTime(STALE_CHUNK_STABLE_MS - 1);
    expect(stored[STALE_CHUNK_RELOAD_FLAG]).toBe("{}");
    vi.advanceTimersByTime(1);
    expect(stored[STALE_CHUNK_RELOAD_FLAG]).toBeUndefined();
  });
});

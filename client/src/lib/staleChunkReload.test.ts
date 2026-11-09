import { describe, expect, it, vi } from "vitest";
import { installStaleChunkReload, isChunkLoadError, reloadForStaleChunk, STALE_CHUNK_RELOAD_KEY, type StaleChunkReloadEnv } from "./staleChunkReload";

function env(now: number, stored: Record<string, string> = {}): StaleChunkReloadEnv & { reload: ReturnType<typeof vi.fn>; stored: Record<string, string> } {
  return {
    stored,
    storage: { getItem: (key) => stored[key] ?? null, setItem: (key, value) => { stored[key] = value; } },
    reload: vi.fn(),
    now: () => now,
  };
}

describe("stale build chunks", () => {
  it("recognizes a failed chunk load in Chrome, Edge, Firefox and Safari", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://www.cabinetdealz.com/assets/DesignTool-BF--MoSG.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("error loading dynamically imported module: https://www.cabinetdealz.com/assets/DesignTool-x.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new Error("Unable to preload CSS for /assets/DesignTool-x.css"))).toBe(true);
    expect(isChunkLoadError(new Error("Maximum update depth exceeded"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });

  it("reloads once, then leaves a repeat failure to the error panel", () => {
    const first = env(1_000_000);
    expect(reloadForStaleChunk(first)).toBe(true);
    expect(first.reload).toHaveBeenCalledTimes(1);
    const again = env(1_010_000, first.stored);
    expect(reloadForStaleChunk(again)).toBe(false);
    expect(again.reload).not.toHaveBeenCalled();
    const later = env(1_100_000, first.stored);
    expect(reloadForStaleChunk(later)).toBe(true);
    expect(later.stored[STALE_CHUNK_RELOAD_KEY]).toBe("1100000");
  });

  it("handles Vite's preload error by reloading instead of throwing", () => {
    const target = new EventTarget();
    const reloadEnv = env(5_000_000);
    installStaleChunkReload(target as unknown as Window, reloadEnv);
    const event = new Event("vite:preloadError", { cancelable: true });
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(reloadEnv.reload).toHaveBeenCalledTimes(1);
    const repeat = new Event("vite:preloadError", { cancelable: true });
    target.dispatchEvent(repeat);
    expect(repeat.defaultPrevented).toBe(false);
  });
});

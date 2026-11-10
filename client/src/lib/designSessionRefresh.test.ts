import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  SHARED_DESIGN_AUTO_REFRESH_MS,
  sharedDesignAutoRefreshQueryOptions,
  sharedDesignRefreshInterval,
  sharedDesignRefreshIntervalMs,
  sharedDesignRefreshLabel,
  retainUnchangedValue,
} from "./designSessionRefresh";

const sharedRoomSource = readFileSync(new URL("../pages/SharedRoom3D.tsx", import.meta.url), "utf8");

describe("shared design auto-refresh", () => {
  it("checks the confirmed saved design every three seconds, and not while the tab is hidden", () => {
    expect(SHARED_DESIGN_AUTO_REFRESH_MS).toBe(3_000);
    expect(sharedDesignRefreshIntervalMs({ hidden: false, fetching: false, failureCount: 0 })).toBe(3_000);
    expect(sharedDesignAutoRefreshQueryOptions).toMatchObject({
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: "always",
      retry: false,
    });
    expect(sharedDesignAutoRefreshQueryOptions.refetchInterval).toBe(sharedDesignRefreshInterval);
  });

  it("does not start another fetch while one is in flight or the tab is hidden", () => {
    expect(sharedDesignRefreshIntervalMs({ hidden: true, fetching: false, failureCount: 0 })).toBe(false);
    expect(sharedDesignRefreshIntervalMs({ hidden: false, fetching: true, failureCount: 0 })).toBe(false);
    expect(sharedDesignRefreshInterval({ state: { fetchStatus: "fetching", fetchFailureCount: 0 } })).toBe(false);
  });

  it("backs off after repeated errors and keeps a ceiling", () => {
    expect(sharedDesignRefreshIntervalMs({ hidden: false, fetching: false, failureCount: 1 })).toBe(6_000);
    expect(sharedDesignRefreshIntervalMs({ hidden: false, fetching: false, failureCount: 2 })).toBe(12_000);
    expect(sharedDesignRefreshIntervalMs({ hidden: false, fetching: false, failureCount: 8 })).toBe(24_000);
  });

  it("keeps the same design object when a refresh did not change it", () => {
    const design = { placed: [{ uid: "a" }], room: { width: 60 } };
    const repeat = { placed: [{ uid: "a" }], room: { width: 60 } };
    expect(retainUnchangedValue(design, repeat)).toBe(design);
    const changed = { placed: [{ uid: "b" }], room: { width: 60 } };
    expect(retainUnchangedValue(design, changed)).toBe(changed);
    expect(retainUnchangedValue(design, null)).toBe(design);
  });

  it("labels connection and refresh state without implying that a viewer can edit", () => {
    expect(sharedDesignRefreshLabel(true, Date.now())).toBe("Refreshing saved design…");
    expect(sharedDesignRefreshLabel(false, 0)).toBe("Connecting to saved design…");
    expect(sharedDesignRefreshLabel(false, 1_704_067_200_000)).toMatch(/^Last checked /);
  });

  it("refreshes only the shared design on the 3D page, not the catalog scene or the renderer", () => {
    expect(sharedRoomSource).toContain("sharedDesignAutoRefreshQueryOptions");
    expect(sharedRoomSource).toContain("retainUnchangedValue");
    expect(sharedRoomSource).toContain("refetchOnWindowFocus: false, refetchOnReconnect: false");
    expect(sharedRoomSource).not.toContain("location.reload");
    expect(sharedRoomSource).not.toContain("requestFullscreen");
    // The scene query is the second useQuery and must not take the design timer.
    const sceneQuery = sharedRoomSource.slice(sharedRoomSource.indexOf("trpc.roomLayouts.scene.useQuery"));
    expect(sceneQuery).not.toContain("sharedDesignAutoRefreshQueryOptions");
  });
});

import { describe, expect, it } from "vitest";
import {
  SHARED_DESIGN_AUTO_REFRESH_MS,
  sharedDesignAutoRefreshQueryOptions,
  sharedDesignRefreshLabel,
} from "./designSessionRefresh";

describe("shared design auto-refresh", () => {
  it("checks the confirmed saved design every four seconds, including while the view is backgrounded", () => {
    expect(SHARED_DESIGN_AUTO_REFRESH_MS).toBe(4_000);
    expect(sharedDesignAutoRefreshQueryOptions).toMatchObject({
      refetchInterval: 4_000,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: "always",
      retry: false,
    });
  });

  it("labels connection and refresh state without implying that a viewer can edit", () => {
    expect(sharedDesignRefreshLabel(true, Date.now())).toBe("Refreshing saved design…");
    expect(sharedDesignRefreshLabel(false, 0)).toBe("Connecting to saved design…");
    expect(sharedDesignRefreshLabel(false, 1_704_067_200_000)).toMatch(/^Last checked /);
  });
});

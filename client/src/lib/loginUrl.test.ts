import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// getLoginUrl reads window.location at call time, so it must work on localhost,
// a preview host AND a custom domain without code changes. All sign-in happens
// on the CabinetDealz /signin page via Supabase Auth.

const ORIGIN = "https://cabinetdeals.com";

describe("getLoginUrl", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { location: { origin: ORIGIN } });
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "https://portal.manus.im");
    vi.stubEnv("VITE_APP_ID", "app_123");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function load() {
    // Import fresh so the stubbed env/window are picked up.
    const mod = await import("@/const");
    return mod.getLoginUrl;
  }

  it("keeps ordinary sign-in on the CabinetDealz route", async () => {
    const getLoginUrl = await load();
    expect(getLoginUrl()).toBe("/signin");
  });

  it("preserves a safe current CabinetDealz page as the post-login return path", async () => {
    vi.stubGlobal("window", { location: { origin: ORIGIN, pathname: "/admin", search: "?tab=cabinet-attention", hash: "" } });
    const getLoginUrl = await load();
    expect(getLoginUrl()).toBe("/signin?returnTo=%2Fadmin%3Ftab%3Dcabinet-attention");
  });

  it("never sends sign-in to the retired Manus OAuth portal", async () => {
    vi.stubGlobal("window", { location: { origin: ORIGIN, pathname: "/store/sales-demo/design", search: "", hash: "" } });
    const getLoginUrl = await load();
    const url = getLoginUrl();
    expect(url).toBe("/signin?returnTo=%2Fstore%2Fsales-demo%2Fdesign");
    expect(url).not.toContain("manus");
  });

  it("rejects external and recursive return destinations", async () => {
    const mod = await import("@/const");
    expect(mod.isSafeSiteReturnPath("https://manus.im/login")).toBe(false);
    expect(mod.isSafeSiteReturnPath("//manus.im/login")).toBe(false);
    expect(mod.isSafeSiteReturnPath("/signin?again=1")).toBe(false);
    expect(mod.isSafeSiteReturnPath("/admin?tab=cabinet-attention")).toBe(true);
  });
});

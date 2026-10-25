import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchDeployedVersion } from "./versionWatcher";

const watcherSource = readFileSync(resolve(process.cwd(), "client/src/lib/versionWatcher.ts"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const toasterSource = readFileSync(resolve(process.cwd(), "client/src/components/ui/sonner.tsx"), "utf8");

function mockFetch(body: string, contentType: string, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? contentType : null) },
    json: async () => JSON.parse(body),
    text: async () => body,
  } as unknown as Response);
}

describe("fetchDeployedVersion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses a valid JSON version payload", async () => {
    vi.stubGlobal("fetch", mockFetch('{"version":"abc123"}', "application/json"));
    await expect(fetchDeployedVersion()).resolves.toBe("abc123");
  });

  it("returns null when the response is the HTML SPA shell", async () => {
    vi.stubGlobal("fetch", mockFetch("<!doctype html><html></html>", "text/html"));
    await expect(fetchDeployedVersion()).resolves.toBeNull();
  });

  it("returns null when the request fails (non-ok)", async () => {
    vi.stubGlobal("fetch", mockFetch("{}", "application/json", false));
    await expect(fetchDeployedVersion()).resolves.toBeNull();
  });

  it("returns null when fetch throws (network/offline)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(fetchDeployedVersion()).resolves.toBeNull();
  });

  it("returns null when JSON lacks a string version field", async () => {
    vi.stubGlobal("fetch", mockFetch('{"version":123}', "application/json"));
    await expect(fetchDeployedVersion()).resolves.toBeNull();
  });

  it("parses JSON even when content-type is generic but body is JSON", async () => {
    vi.stubGlobal("fetch", mockFetch('{"version":"x9"}', "text/plain"));
    await expect(fetchDeployedVersion()).resolves.toBe("x9");
  });

  it("does not defer a refresh notice behind an open dialog or focused field", () => {
    expect(watcherSource).not.toContain("isSafeToPrompt");
    expect(watcherSource).toContain("notifyNewVersion();");
    expect(watcherSource).not.toContain("[role=\"dialog\"]");
  });

  it("keeps the user-controlled refresh notice visible above Designer overlays", () => {
    expect(appSource).toContain('id: "cabinet-dealz-version-update"');
    expect(appSource).toContain("duration: Infinity");
    expect(appSource).toContain('cancel: { label: "Later"');
    expect(toasterSource).toContain("zIndex: 2147483647");
    expect(watcherSource).toContain("fallbackBanner(onReload);");
    expect(watcherSource).toContain("top:max(16px, env(safe-area-inset-top))");
    expect(watcherSource).toContain('target.searchParams.set("__cd_refresh"');
  });
});

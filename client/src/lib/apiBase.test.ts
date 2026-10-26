import { describe, expect, it } from "vitest";
import { apiUrl, sameSiteApiUrl } from "./apiBase";

describe("sameSiteApiUrl", () => {
  it("stays on the storefront host so the QuickBooks state cookie matches the callback", () => {
    expect(sameSiteApiUrl("/api/qbo/connect", "www.cabinetdealz.com")).toBe("/api/qbo/connect");
    expect(sameSiteApiUrl("/api/qbo/disconnect", "cabinetdealz.com")).toBe("/api/qbo/disconnect");
  });

  it("uses the configured API host from local Vite, which does not proxy /api", () => {
    expect(sameSiteApiUrl("/api/qbo/connect", "localhost")).toBe(apiUrl("/api/qbo/connect"));
    expect(sameSiteApiUrl("/api/qbo/connect", "127.0.0.1")).toBe(apiUrl("/api/qbo/connect"));
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hideAdminEditModeBarForRoute } from "./adminChrome";

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("admin strip on the CRM and order views", () => {
  it("skips the strip on the admin panel, where the CRM and Incoming Orders live", () => {
    expect(hideAdminEditModeBarForRoute("/admin")).toBe(true);
    expect(hideAdminEditModeBarForRoute("/admin", "?tab=crm")).toBe(true);
    expect(hideAdminEditModeBarForRoute("/admin", "?tab=orders")).toBe(true);
    expect(hideAdminEditModeBarForRoute("/admin/", "")).toBe(true);
  });

  it("skips the strip on the full-page admin order detail", () => {
    expect(hideAdminEditModeBarForRoute("/admin/orders/18")).toBe(true);
    expect(hideAdminEditModeBarForRoute("/admin/orders/18/")).toBe(true);
  });

  it("keeps the strip everywhere else", () => {
    expect(hideAdminEditModeBarForRoute("/")).toBe(false);
    expect(hideAdminEditModeBarForRoute("/admin", "?tab=payments")).toBe(false);
    expect(hideAdminEditModeBarForRoute("/catalog")).toBe(false);
    expect(hideAdminEditModeBarForRoute("/store/house/order")).toBe(false);
  });

  it("gates the bar on the shared route rule instead of rendering it unconditionally", () => {
    const layout = app.slice(app.indexOf("function AppLayout"), app.indexOf("function CartWithLayout"));
    expect(layout).toContain("hideAdminEditModeBarForRoute(");
    expect(layout).toContain("{showAdminEditModeBar && <AdminEditModeBar />}");
    expect(layout).not.toContain("\n      <AdminEditModeBar />");
  });
});

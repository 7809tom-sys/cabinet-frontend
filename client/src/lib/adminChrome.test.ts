import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hideAdminEditModeBarForRoute } from "./adminChrome";

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("purple admin strip on the admin page", () => {
  it("skips the strip on the admin panel and every admin tab", () => {
    expect(hideAdminEditModeBarForRoute("/admin")).toBe(true);
    expect(hideAdminEditModeBarForRoute("/admin/")).toBe(true);
  });

  it("skips the strip on the full-page admin order detail and the other admin screens", () => {
    expect(hideAdminEditModeBarForRoute("/admin/orders/18")).toBe(true);
    expect(hideAdminEditModeBarForRoute("/admin/orders/18/")).toBe(true);
    expect(hideAdminEditModeBarForRoute("/admin/catalog-import")).toBe(true);
    expect(hideAdminEditModeBarForRoute("/admin/fee-system")).toBe(true);
  });

  it("keeps the strip everywhere else", () => {
    expect(hideAdminEditModeBarForRoute("/")).toBe(false);
    expect(hideAdminEditModeBarForRoute("/catalog")).toBe(false);
    expect(hideAdminEditModeBarForRoute("/store/house/order")).toBe(false);
    expect(hideAdminEditModeBarForRoute("/affiliate")).toBe(false);
    // Not an admin route just because the word appears in the path.
    expect(hideAdminEditModeBarForRoute("/administrators")).toBe(false);
  });

  it("gates the bar on the shared route rule instead of rendering it unconditionally", () => {
    const layout = app.slice(app.indexOf("function AppLayout"), app.indexOf("function CartWithLayout"));
    expect(layout).toContain("hideAdminEditModeBarForRoute(");
    expect(layout).toContain("{showAdminEditModeBar && <AdminEditModeBar />}");
    expect(layout).not.toContain("\n      <AdminEditModeBar />");
  });
});

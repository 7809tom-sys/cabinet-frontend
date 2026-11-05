/**
 * Staff screens that already say where you are, so the fixed admin strip is
 * just noise there.
 *
 * AdminEditModeBar is the purple "Admin Edit Mode" bar pinned to the top of the
 * page; it ends with an "Admin Panel" link back to /admin. The sales CRM and the
 * incoming-orders views carry that context in their own headers, so the strip is
 * skipped there. Kept pure so the route rule is unit-testable.
 */
const ADMIN_TABS_WITHOUT_STRIP = new Set(["crm", "orders"]);

export function hideAdminEditModeBarForRoute(pathname: string, search = ""): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  // Full-page admin order detail, e.g. /admin/orders/18.
  if (path.startsWith("/admin/orders/")) return true;
  if (path !== "/admin") return false;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const tab = params.get("tab");
  // The admin panel opens on the Sales CRM tab when no tab is named.
  return tab == null || ADMIN_TABS_WITHOUT_STRIP.has(tab);
}

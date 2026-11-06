/**
 * Staff screens that already say where you are, so the fixed admin strip is
 * just noise there.
 *
 * AdminEditModeBar is the purple "Admin Edit Mode" bar (#7c3aed to #4f46e5)
 * pinned to the top of the page; it ends with an "Admin Panel" link back to
 * /admin. The admin panel is its own staff surface — it has a page header and
 * grouped tabs — so the strip never renders anywhere under /admin: not on the
 * panel itself whatever tab is open, not on a full-page admin order, and not on
 * the admin catalog importer. Every other route keeps it. Kept pure so the
 * route rule is unit-testable.
 */
export function hideAdminEditModeBarForRoute(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === "/admin" || path.startsWith("/admin/");
}

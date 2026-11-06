import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { HelperNoticeBadge } from "@/components/design/designerHelperCards";
import { helperNoticeRows, useDesignerHelperProcedures } from "@/lib/designerHelperProcedures";

/**
 * In-app notice for a signed-on designer anywhere in the site: a badge in the
 * header saying an available designer helper is needed, plus a one-time toast
 * whose action opens the customer's shared design.
 *
 * Only a designer whose Helper sign is on receives requests. The queries are
 * gated on a signed-in designer, so a customer's or a visitor's page makes no
 * helper calls at all, and nothing renders before the backend patch answers.
 */
export function DesignerHelperNotice() {
  const helper = useDesignerHelperProcedures();
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const canHoldSign = user?.role === "designer" || user?.role === "admin";
  const enabled = isAuthenticated && canHoldSign;

  const sign = helper.designerHelper.mySign.useQuery(undefined, {
    retry: false,
    enabled,
    refetchInterval: enabled ? 30_000 : false,
  });
  const notices = helper.designerHelper.myNotices.useQuery(undefined, {
    retry: false,
    enabled,
    refetchInterval: enabled ? 30_000 : false,
  });

  const rows = helperNoticeRows(notices.data);
  const signedOn = sign.data?.available === true;
  const announced = useRef<Set<number>>(new Set());
  const newestId = rows[0]?.request.id;
  // The Designer and the admin pages show their own notice, so the header only
  // speaks up elsewhere and never doubles the same toast.
  const showsOwnNotice = location.startsWith("/design") || location.startsWith("/admin");

  useEffect(() => {
    if (!signedOn || !newestId || announced.current.has(newestId) || showsOwnNotice) return;
    const newest = rows.find((row) => row.request.id === newestId);
    if (!newest) return;
    announced.current.add(newestId);
    toast.info("An available designer helper is needed", {
      description: `${newest.request.customerName ?? "A customer"} · ${newest.request.designName ?? "their design"}`,
      duration: 12_000,
      action: { label: "Open design", onClick: () => window.location.assign(newest.designPath) },
    });
  }, [newestId, rows, signedOn, showsOwnNotice]);

  if (!signedOn || rows.length === 0) return null;

  return <HelperNoticeBadge count={rows.length} href={rows[0]!.designPath} />;
}
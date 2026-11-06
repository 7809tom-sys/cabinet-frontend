import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { AdminHelperRequestCard } from "@/components/design/designerHelperCards";
import { helperNoticeRows, type HelperNoticeList, useDesignerHelperProcedures } from "@/lib/designerHelperProcedures";

/**
 * Admin pop-up: a small toast the moment a customer asks for a designer helper.
 *
 * It carries the customer's name and contact, which design, what they need help
 * with, when they asked, and the status and who accepted. Two actions open the
 * request, or join the customer's design directly — joining records who joined
 * and when before the Designer opens on that plan.
 *
 * This sits on the admin pages only, next to the admin tabs, so it never fires
 * for a customer or a designer.
 */
export function AdminHelperRequestToast() {
  const helper = useDesignerHelperProcedures();
  const inbox = helper.designerHelper.adminInbox.useQuery(undefined, {
    retry: false,
    refetchInterval: 20_000,
  });
  const rows = helperNoticeRows(inbox.data);
  const announced = useRef<Set<number>>(new Set());

  const join = useCallback((row: HelperNoticeList) => {
    toast.dismiss(`admin-helper-request-${row.request.id}`);
    window.location.assign(row.joinPath);
  }, []);

  const openRequest = useCallback((row: HelperNoticeList) => {
    toast.dismiss(`admin-helper-request-${row.request.id}`);
    window.location.assign(`/admin?tab=helper-requests&request=${row.request.id}`);
  }, []);

  useEffect(() => {
    for (const row of rows) {
      const id = row.request.id;
      if (announced.current.has(id)) continue;
      announced.current.add(id);
      toast.custom(
        () => (
          <div className="w-[min(26rem,calc(100vw-2rem))]" data-testid="admin-helper-request-toast">
            <AdminHelperRequestCard
              request={row.request}
              onJoin={() => join(row)}
              onOpenRequest={() => openRequest(row)}
            />
          </div>
        ),
        { id: `admin-helper-request-${id}`, duration: Number.POSITIVE_INFINITY },
      );
    }
  }, [rows, join, openRequest]);

  // A request that stopped waiting — someone else joined it, or it was closed —
  // has its pop-up taken down rather than left on screen as stale work.
  useEffect(() => {
    const stillWaiting = new Set(rows.filter((row) => row.request.status === "open").map((row) => row.request.id));
    for (const id of Array.from(announced.current)) {
      if (stillWaiting.has(id)) continue;
      toast.dismiss(`admin-helper-request-${id}`);
    }
  }, [rows]);

  return null;
}

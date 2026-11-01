import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { normalizeDoorAuditList } from "@/lib/doorRenderingAudit";
import {
  approvalSummary,
  approveDoorInput,
  normalizeSharedApprovals,
  type ApproveDoorRequest,
} from "@/lib/sharedDoorApproval";

type Raw = {
  doorRenderingAudit: {
    approvedDoors: { useQuery: (input: { styleIds: number[] }, options?: object) => { data?: unknown; refetch: () => Promise<unknown> } };
    approveDoor: { useMutation: () => { mutateAsync: (input: never) => Promise<unknown>; isPending: boolean } };
    listStyles: { useQuery: (input: object, options?: object) => { refetch: () => Promise<{ data?: unknown }> } };
  };
  useUtils: () => { doorRenderingAudit: { approvedDoors: { invalidate: () => Promise<void> }; listStyles: { invalidate: () => Promise<void> } } };
};

/**
 * Admin-only "Approve this door". It writes the one shared approval, so the
 * Designer, the Door Rendering Audit and Featured Styles all show it.
 *  - designer: captures the door with the locked audit capture using the current Designer appearance.
 *  - featured: approves the style's door and drawer photos as the reference images.
 */
export function ApproveDoorButton({
  styleId,
  place,
  doorImageUrl,
  drawerImageUrl,
  compact = false,
}: {
  styleId: number | null;
  place: "designer" | "featured";
  doorImageUrl?: string | null;
  drawerImageUrl?: string | null;
  compact?: boolean;
}) {
  const api = trpc as unknown as Raw;
  const utils = api.useUtils();
  const enabled = styleId != null && styleId > 0;
  const approvals = api.doorRenderingAudit.approvedDoors.useQuery({ styleIds: enabled ? [styleId] : [] }, { enabled });
  const list = api.doorRenderingAudit.listStyles.useQuery({}, { enabled: false });
  const approve = api.doorRenderingAudit.approveDoor.useMutation();
  const [busy, setBusy] = useState(false);
  if (!enabled) return null;
  const current = normalizeSharedApprovals(approvals.data).get(styleId);

  async function run() {
    setBusy(true);
    try {
      let request: ApproveDoorRequest;
      if (place === "featured") {
        const door = doorImageUrl?.trim();
        if (!door) throw new Error("Add a door photo before approving.");
        request = { styleId: styleId as number, source: "featured", doorImageUrl: door, drawerImageUrl };
      } else {
        const fetched = await list.refetch();
        const row = normalizeDoorAuditList(fetched.data).styles.find((item) => item.styleId === styleId);
        if (!row) throw new Error("This door style is not in the audit list.");
        const loaded = await import("@/lib/doorAuditDoorRender");
        const session = loaded.createDoorAuditCapture();
        try {
          const png = await session.capture(row as never);
          if (!png?.base64) throw new Error("The door render came back empty.");
          request = { styleId: styleId as number, source: "designer", imageBase64: png.base64, renderHex: row.renderHex };
        } finally {
          session.dispose();
        }
      }
      await approve.mutateAsync(approveDoorInput(request) as never);
      await Promise.all([utils.doorRenderingAudit.approvedDoors.invalidate(), utils.doorRenderingAudit.listStyles.invalidate()]);
      toast.success("Door approved. The Designer, the audit and Featured Styles now use it.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not approve this door.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "inline-flex items-center gap-2" : "flex items-center gap-2"} data-testid={`approve-door-${place}`}>
      <Badge variant={current ? "default" : "outline"} className="text-[11px]" data-testid="approve-door-status">
        {approvalSummary(current)}
      </Badge>
      <Button type="button" size="sm" variant="outline" disabled={busy || approve.isPending} onClick={() => void run()}>
        {busy ? "Approving..." : current ? "Approve again" : "Approve this door"}
      </Button>
    </div>
  );
}

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type PendingMeasurement = {
  id: number;
  vendorLineName: string;
  vendorStyleCode: string;
  vendorStyleName: string;
  appliesToStyleIds: number[];
  measuredBy: string;
  measuredOn: string;
  citation: string;
  measurementData: Record<string, unknown>;
  submittedAt: Date;
};

type StyleWidths = { id: number; ourName?: string | null; railWidth?: number | string | null; stileWidth?: number | string | null; centerRailWidth?: number | string | null };

/** Existing pending-submissions query (shared cache, one request for every badge). */
export function usePendingMeasurements(): PendingMeasurement[] {
  const { data } = trpc.distributorPortal.listDoorMeasurementSubmissions.useQuery({ status: "pending", limit: 100 });
  return Array.isArray(data) ? (data as PendingMeasurement[]) : [];
}

const show = (v: unknown) => (v == null || v === "" ? "—" : `${v}″`);

export const MEASUREMENT_ROWS: Array<{ label: string; vendorKey: string; current: keyof StyleWidths }> = [
  { label: "Top rail", vendorKey: "topRailWidth", current: "railWidth" },
  { label: "Bottom rail", vendorKey: "bottomRailWidth", current: "railWidth" },
  { label: "Left stile", vendorKey: "leftStileWidth", current: "stileWidth" },
  { label: "Right stile", vendorKey: "rightStileWidth", current: "stileWidth" },
  { label: "Center rail", vendorKey: "centerRailWidth", current: "centerRailWidth" },
];

/** Compact "Vendor update" button shown on a style that has a pending vendor measurement submission. */
export function VendorUpdateBadge({ style, styleNames }: { style: StyleWidths; styleNames?: Record<number, string> }) {
  const pending = usePendingMeasurements().filter((p) => (p.appliesToStyleIds ?? []).includes(style.id));
  const [open, setOpen] = useState<PendingMeasurement | null>(null);
  if (pending.length === 0) return null;
  return (
    <span onClick={(e) => e.stopPropagation()} className="inline-flex">
      <button type="button" data-testid="vendor-update-badge" onClick={() => setOpen(pending[0])}
        className="rounded-full border border-[#d7a46c] bg-[#fffdf9] px-2 py-0.5 text-xs font-semibold text-[#244338] hover:bg-[#d7a46c]/20">
        Vendor update{pending.length > 1 ? ` (${pending.length})` : ""}
      </button>
      {open && <VendorUpdateDialog submission={open} style={style} styleNames={styleNames} onClose={() => setOpen(null)} />}
    </span>
  );
}

function VendorUpdateDialog({ submission, style, styleNames, onClose }: { submission: PendingMeasurement; style: StyleWidths; styleNames?: Record<number, string>; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [rail, setRail] = useState("");
  const [stile, setStile] = useState("");
  const [centerRail, setCenterRail] = useState("");
  const [physicalSampleMeasured, setPhysicalSampleMeasured] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const review = trpc.distributorPortal.reviewDoorMeasurementSubmission.useMutation({
    onSuccess: (result: { approved?: boolean }) => {
      utils.distributorPortal.listDoorMeasurementSubmissions.invalidate();
      utils.doorStyles.listForAdmin.invalidate();
      toast.success(result?.approved ? "Designer profile approved from the physical sample." : "Vendor measurement submission rejected.");
      onClose();
    },
    onError: (error: { message: string }) => toast.error(error.message),
  });
  const measured = submission.measurementData ?? {};
  const decide = (approved: boolean) => {
    const asNumber = (value: string) => (value.trim() ? Number(value) : null);
    review.mutate({
      id: submission.id,
      approve: approved,
      physicalSampleMeasured,
      railWidth: approved ? asNumber(rail) : undefined,
      stileWidth: approved ? asNumber(stile) : undefined,
      centerRailWidth: approved ? asNumber(centerRail) : undefined,
      reviewNote: reviewNote.trim() || undefined,
    });
  };
  const applies = submission.appliesToStyleIds ?? [];
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl border-[#244338]/20 bg-[#fffdf9] text-[#244338]" data-testid="vendor-update-dialog">
        <DialogHeader><DialogTitle>Vendor update · {style.ourName ?? `Style #${style.id}`}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p><strong>Vendor source:</strong> {submission.vendorLineName} · {submission.vendorStyleName} · <span className="font-mono">{submission.vendorStyleCode}</span></p>
          <p className="text-[#244338]/80">Measured by {submission.measuredBy} on {submission.measuredOn}</p>
          <p className="text-[#244338]/80"><strong>Citation:</strong> {submission.citation || "—"}</p>
          <table className="w-full text-left text-sm" data-testid="vendor-update-diff">
            <thead><tr className="border-b border-[#d7a46c]"><th className="py-1">Field</th><th>Current</th><th></th><th>Vendor</th></tr></thead>
            <tbody>
              {MEASUREMENT_ROWS.map((r) => (
                <tr key={r.vendorKey} data-testid={`vendor-diff-${r.vendorKey}`} className="border-b border-[#244338]/10">
                  <td className="py-1">{r.label}</td><td>{show(style[r.current])}</td><td aria-hidden>→</td><td className="font-semibold">{show(measured[r.vendorKey])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[#244338]/80" data-testid="vendor-update-applies">Applies to {applies.length} style{applies.length === 1 ? "" : "s"}: {applies.map((id) => styleNames?.[id] ?? `#${id}`).join(", ") || "—"}</p>
          <label className="flex items-start gap-2 rounded-lg border border-[#d7a46c] bg-[#d7a46c]/10 p-3">
            <input type="checkbox" checked={physicalSampleMeasured} onChange={(e) => setPhysicalSampleMeasured(e.target.checked)} />
            <span><strong>CabinetDealz measured the physical sample door.</strong><br /><span className="text-[#244338]/70">Required before these values may render in Designer.</span></span>
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label>Team-measured rail (in)</Label><Input type="number" step="0.0625" min="0.01" value={rail} onChange={(e) => setRail(e.target.value)} /></div>
            <div className="space-y-1"><Label>Team-measured stile (in)</Label><Input type="number" step="0.0625" min="0.01" value={stile} onChange={(e) => setStile(e.target.value)} /></div>
            <div className="space-y-1"><Label>Center rail (in)</Label><Input type="number" step="0.0625" min="0.01" value={centerRail} onChange={(e) => setCenterRail(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Review note (optional)</Label><Input value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="e.g. matches the delivered sample" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={review.isPending}>Cancel</Button>
          <Button variant="outline" className="border-[#244338] text-[#244338]" data-testid="vendor-update-reject" onClick={() => decide(false)} disabled={review.isPending}>Reject</Button>
          <Button className="bg-[#244338] text-[#fffdf9] hover:bg-[#244338]/90" data-testid="vendor-update-approve" onClick={() => decide(true)} disabled={review.isPending || !physicalSampleMeasured || !rail || !stile}>{review.isPending ? "Saving…" : "Approve for Designer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

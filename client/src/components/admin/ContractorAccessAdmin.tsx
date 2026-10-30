import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  affiliateSubmitterLabel,
  affiliateSubmitterOptions,
  contractorAccessListInput,
  contractorAccessSourceLabel,
  contractorRequestStatusLabel,
  listRowContractorEmail,
  listRowContractorName,
  listRowSubmitter,
} from "@/lib/contractorAccessForm";
import { useContractorAccessProcedures } from "@/lib/contractorAccessProcedures";

export default function ContractorAccessAdmin() {
  const utils = trpc.useUtils();
  const api = useContractorAccessProcedures();
  const [affiliateUserId, setAffiliateUserId] = useState<number | null>(null);
  const directory = api.contractorAccess.list.useQuery(undefined, { retry: false });
  const list = api.contractorAccess.list.useQuery(contractorAccessListInput(affiliateUserId), { retry: false });
  const review = trpc.contractorAccess.review.useMutation({
    onSuccess: () => {
      toast.success("Request updated");
      void utils.contractorAccess.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const rows = list.data ?? [];
  const submitters = useMemo(() => affiliateSubmitterOptions(directory.data ?? []), [directory.data]);
  const selectedSubmitter = submitters.find((option) => option.userId === affiliateUserId) ?? null;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold">Contractor access</h2>
        <p className="text-sm text-muted-foreground">Approve a request to grant the contractor role. Reject leaves the account as a customer. Affiliate and admin roles are not changed.</p>
      </div>
      <Label className="text-sm block max-w-md">
        Affiliate
        <select
          aria-label="Filter by affiliate"
          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
          value={affiliateUserId == null ? "" : String(affiliateUserId)}
          onChange={(event) => {
            const value = event.target.value;
            setAffiliateUserId(value ? Number(value) : null);
          }}
        >
          <option value="">All pending requests</option>
          {submitters.map((option) => (
            <option key={option.userId} value={String(option.userId)}>{affiliateSubmitterLabel(option)}</option>
          ))}
        </select>
      </Label>
      {selectedSubmitter ? (
        <p className="text-sm text-muted-foreground">
          Showing every request from {affiliateSubmitterLabel(selectedSubmitter)}. This is the same set they see under My contractor requests. Follow up if this affiliate is not responding.
        </p>
      ) : null}
      {list.isLoading ? <p className="text-sm text-muted-foreground">Loading requests…</p> : null}
      {list.error ? <p className="text-sm text-destructive">{list.error.message}</p> : null}
      {directory.error && !list.error ? <p className="text-sm text-destructive">{directory.error.message}</p> : null}
      {!list.isLoading && rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
          {affiliateUserId == null ? "No pending contractor requests." : "This affiliate has no contractor requests."}
        </p>
      ) : null}
      <div className="space-y-3">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl border border-border p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{row.businessName}</h3>
              <Badge variant="outline">{contractorRequestStatusLabel(row.status)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{row.name || "Customer"} · {row.email || "No email"} · {row.phone}</p>
            <p className="text-sm">Source: {contractorAccessSourceLabel(row.source)}</p>
            <p className="text-sm">Submitted by: {listRowSubmitter(row)}</p>
            <p className="text-sm">Contractor: {listRowContractorName(row)} · {listRowContractorEmail(row)}</p>
            {row.licenseNumber ? <p className="text-sm">License {row.licenseNumber}</p> : null}
            {row.status === "pending" ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ id: row.id, decision: "approved" })}>Approve</Button>
                <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => review.mutate({ id: row.id, decision: "rejected" })}>Reject</Button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

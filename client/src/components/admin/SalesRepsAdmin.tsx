import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { selectableSalesReps } from "@shared/salesRepCommission";
import { useMembershipProgramProcedures } from "@/lib/membershipProgramProcedures";
import { trpc } from "@/lib/trpc";

export default function SalesRepsAdmin() {
  const api = useMembershipProgramProcedures();
  const utils = api.useUtils();
  const applications = api.salesRepProgram.listApplications.useQuery(undefined, { retry: false });
  const affiliates = trpc.affiliates.adminList.useQuery();
  const [repId, setRepId] = useState("");
  const [affiliateId, setAffiliateId] = useState("");
  const rows = applications.data?.rows ?? [];
  const approved = selectableSalesReps(rows.filter((row) => row.userId != null).map((row) => ({ ...row, status: row.status })));

  const setStatus = api.salesRepProgram.setApplicationStatus.useMutation({
    onSuccess: () => {
      toast.success("Sales rep updated");
      void utils.salesRepProgram.listApplications.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const assign = api.salesRepProgram.assignRep.useMutation({
    onSuccess: () => toast.success("Rep saved on that affiliate"),
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold">Authorized sales reps</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Only approved reps appear in the checkout dropdown and can be credited with an affiliate account.
          Signup does not collect a tax id. After approval, the rep still finishes Job Boarding (information, non-compete, W-9, government ID) on the salesperson onboarding flow.
        </p>
        {applications.data?.schemaMissing && (
          <p className="mt-2 text-sm text-amber-800">Run docs/sql/0278_affiliate_membership_checkout.tidb.sql before approving reps.</p>
        )}
      </div>

      <div className="rounded-xl border border-border p-4 space-y-3">
        <h3 className="font-semibold">Credit a rep for an affiliate</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select value={repId} onValueChange={setRepId}>
            <SelectTrigger aria-label="Approved sales rep">
              <SelectValue placeholder="Approved sales rep" />
            </SelectTrigger>
            <SelectContent>
              {approved.map((rep) => (
                <SelectItem key={rep.id} value={String(rep.userId)}>
                  {rep.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={affiliateId} onValueChange={setAffiliateId}>
            <SelectTrigger aria-label="Affiliate">
              <SelectValue placeholder="Affiliate" />
            </SelectTrigger>
            <SelectContent>
              {(affiliates.data ?? []).map((affiliate) => (
                <SelectItem key={affiliate.id} value={String(affiliate.id)}>{affiliate.storeName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          disabled={!repId || !affiliateId || assign.isPending}
          onClick={() => assign.mutate({ affiliateId: Number(affiliateId), salesRepUserId: Number(repId) })}
        >
          Save rep on affiliate
        </Button>
      </div>

      <ul className="space-y-3">
        {rows.length === 0 && <li className="text-sm text-muted-foreground">No applications yet. The signup page is /sales-rep/apply.</li>}
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
            <div>
              <div className="font-semibold">{row.fullName}</div>
              <div className="text-sm text-muted-foreground">{row.email}{row.state ? ` · ${row.state}` : ""}</div>
            </div>
            <Badge variant="outline" className="capitalize">{row.status}</Badge>
            {row.status !== "approved" && (
              <Button size="sm" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: row.id, status: "approved" })}>Approve</Button>
            )}
            {row.status !== "rejected" && (
              <Button size="sm" variant="outline" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: row.id, status: "rejected" })}>Reject</Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

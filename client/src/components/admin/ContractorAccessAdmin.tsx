import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function ContractorAccessAdmin() {
  const utils = trpc.useUtils();
  const list = trpc.contractorAccess.list.useQuery({ status: "pending" }, { retry: false });
  const review = trpc.contractorAccess.review.useMutation({
    onSuccess: () => {
      toast.success("Request updated");
      void utils.contractorAccess.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const rows = list.data ?? [];

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold">Contractor access</h2>
        <p className="text-sm text-muted-foreground">Approve a request to grant the contractor role. Reject leaves the account as a customer. Affiliate and admin roles are not changed.</p>
      </div>
      {list.isLoading ? <p className="text-sm text-muted-foreground">Loading requests…</p> : null}
      {list.error ? <p className="text-sm text-destructive">{list.error.message}</p> : null}
      {!list.isLoading && rows.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">No pending contractor requests.</p> : null}
      <div className="space-y-3">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl border border-border p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{row.businessName}</h3>
              <Badge variant="outline">{row.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{row.name || "Customer"} · {row.email || "No email"} · {row.phone}</p>
            {row.licenseNumber ? <p className="text-sm">License {row.licenseNumber}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ id: row.id, decision: "approved" })}>Approve</Button>
              <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => review.mutate({ id: row.id, decision: "rejected" })}>Reject</Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

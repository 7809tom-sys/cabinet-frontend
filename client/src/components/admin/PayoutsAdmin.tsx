import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { BadgeDollarSign, Check, Send } from "lucide-react";

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

type WeekRow = {
  affiliateId: number;
  affiliateName: string;
  weekKey: string;
  weekStart: Date | string;
  orderCount: number;
  amountCents: number;
  status: "pending" | "issued" | "paid";
  method: string | null;
  reference: string | null;
  paidAt: Date | string | null;
  issuedAt: Date | string | null;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-200",
  issued: "bg-blue-100 text-blue-900 border-blue-200",
  paid: "bg-emerald-100 text-emerald-900 border-emerald-200",
};

export default function PayoutsAdmin() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.affiliates.adminWeeklyPayouts.useQuery();
  const mark = trpc.affiliates.adminMarkPayout.useMutation({
    onSuccess: () => {
      utils.affiliates.adminWeeklyPayouts.invalidate();
      toast.success("Payout updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const rows = useMemo(() => (data?.weeks ?? []) as WeekRow[], [data]);

  const totals = useMemo(() => {
    let owed = 0, issued = 0, paid = 0;
    for (const r of rows) {
      if (r.status === "paid") paid += r.amountCents;
      else if (r.status === "issued") issued += r.amountCents;
      else owed += r.amountCents;
    }
    return { owed, issued, paid };
  }, [rows]);

  const setStatus = (r: WeekRow, status: "issued" | "paid") => {
    mark.mutate({
      affiliateId: r.affiliateId,
      weekKey: r.weekKey,
      amountCents: r.amountCents,
      orderCount: r.orderCount,
      status,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BadgeDollarSign className="h-5 w-5" /> Weekly affiliate payouts
        </CardTitle>
        <CardDescription>
          Commission owed to each affiliate, grouped by ISO week (Mon–Sun) from their
          confirmed orders. Mark a week <strong>issued</strong> when a check is cut and{" "}
          <strong>paid</strong> when it clears. Amounts are snapshotted when you mark a week.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-amber-50 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-amber-800">Pending</div>
            <div className="mt-1 text-2xl font-semibold text-amber-900">{fmt(totals.owed)}</div>
          </div>
          <div className="rounded-lg border bg-blue-50 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-blue-800">Issued</div>
            <div className="mt-1 text-2xl font-semibold text-blue-900">{fmt(totals.issued)}</div>
          </div>
          <div className="rounded-lg border bg-emerald-50 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-emerald-800">Paid</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-900">{fmt(totals.paid)}</div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Spinner /></div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            No confirmed affiliate orders yet. Once an affiliate's referred order is
            confirmed, it shows up here as commission owed for its week.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead>Affiliate</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Owed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={`${r.affiliateId}-${r.weekKey}`}>
                    <TableCell className="font-mono text-xs">{r.weekKey}</TableCell>
                    <TableCell className="font-medium">{r.affiliateName}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.orderCount}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{fmt(r.amountCents)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLES[r.status]}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {r.status === "pending" && (
                          <Button size="sm" variant="outline" className="bg-background"
                            disabled={mark.isPending}
                            onClick={() => setStatus(r, "issued")}>
                            <Send className="mr-1 h-3.5 w-3.5" /> Mark issued
                          </Button>
                        )}
                        {r.status !== "paid" && (
                          <Button size="sm"
                            disabled={mark.isPending}
                            onClick={() => setStatus(r, "paid")}>
                            <Check className="mr-1 h-3.5 w-3.5" /> Mark paid
                          </Button>
                        )}
                        {r.status === "paid" && (
                          <span className="text-xs text-muted-foreground">Settled</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

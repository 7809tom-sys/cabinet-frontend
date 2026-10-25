import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { DollarSign, Check, RotateCcw } from "lucide-react";

function money(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function fmt(d: Date | string | number) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function SalesCommissionsAdmin() {
  const utils = trpc.useUtils();
  const { data: rows, isLoading } = trpc.crm.listCommissions.useQuery({ status: "all" });

  const setStatus = trpc.crm.setCommissionStatus.useMutation({
    onSuccess: () => {
      utils.crm.listCommissions.invalidate();
      toast.success("Commission updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const totals = useMemo(() => {
    const list = rows ?? [];
    const pending = list.filter((r) => r.status === "pending");
    const paid = list.filter((r) => r.status === "paid");
    return {
      pendingCount: pending.length,
      pendingCents: pending.reduce((s, r) => s + r.amountCents, 0),
      paidCents: paid.reduce((s, r) => s + r.amountCents, 0),
    };
  }, [rows]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-6 w-6 text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pending payout</p>
            <p className="text-2xl font-bold">{money(totals.pendingCents)}</p>
            <p className="text-xs text-muted-foreground mt-1">{totals.pendingCount} commission(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Paid to date</p>
            <p className="text-2xl font-bold">{money(totals.paidCents)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Rate</p>
            <p className="text-2xl font-bold">$400</p>
            <p className="text-xs text-muted-foreground mt-1">flat, one-time per won deal (1099)</p>
          </CardContent>
        </Card>
      </div>

      {!rows || rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-40" />
          No commissions yet. A $400 commission is recorded automatically when a sales rep's deal is
          marked <span className="font-medium">Won</span> in the CRM.
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rep</TableHead>
                  <TableHead>Deal</TableHead>
                  <TableHead>Won</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.repName ?? `User #${r.repUserId}`}</TableCell>
                    <TableCell className="text-muted-foreground">{r.dealTitle ?? `Deal #${r.dealId}`}</TableCell>
                    <TableCell className="text-muted-foreground">{fmt(r.wonAt)}</TableCell>
                    <TableCell className="text-right font-semibold">{money(r.amountCents)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={r.status === "paid" ? "default" : r.status === "void" ? "destructive" : "outline"}
                        className="capitalize"
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "pending" ? (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                          disabled={setStatus.isPending}
                          onClick={() => setStatus.mutate({ id: r.id, status: "paid" })}
                        >
                          <Check className="h-3.5 w-3.5" /> Mark paid
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1"
                          disabled={setStatus.isPending}
                          onClick={() => setStatus.mutate({ id: r.id, status: "pending" })}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Reopen
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

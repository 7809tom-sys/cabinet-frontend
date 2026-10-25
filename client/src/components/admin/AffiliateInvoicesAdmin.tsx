import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, Check, Plus } from "lucide-react";

function money(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function fmt(d: Date | string | number | null) {
  return d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
}

export default function AffiliateInvoicesAdmin() {
  const utils = trpc.useUtils();
  const { data: invoices, isLoading } = trpc.affiliateMembership.adminListInvoices.useQuery({ status: "all" });
  const { data: affiliateList } = trpc.affiliates.adminList.useQuery();

  const [createForId, setCreateForId] = useState<string>("");
  const [payFor, setPayFor] = useState<{ id: number; number: string; amountCents: number } | null>(null);
  const [payMethod, setPayMethod] = useState<"stripe" | "external_card" | "manual">("external_card");
  const [payRef, setPayRef] = useState("");

  const affiliateName = useMemo(() => {
    const m = new Map<number, string>();
    (affiliateList ?? []).forEach((a) => m.set(a.id, a.storeName));
    return m;
  }, [affiliateList]);

  const createInvoice = trpc.affiliateMembership.adminCreateInvoice.useMutation({
    onSuccess: () => {
      utils.affiliateMembership.adminListInvoices.invalidate();
      setCreateForId("");
      toast.success("Invoice created");
    },
    onError: (e) => toast.error(e.message),
  });

  const markPaid = trpc.affiliateMembership.adminMarkPaid.useMutation({
    onSuccess: () => {
      utils.affiliateMembership.adminListInvoices.invalidate();
      utils.affiliates.adminList.invalidate();
      setPayFor(null);
      setPayRef("");
      toast.success("Payment recorded — membership activated for 1 year");
    },
    onError: (e) => toast.error(e.message),
  });

  const totals = useMemo(() => {
    const list = invoices ?? [];
    const open = list.filter((i) => i.status === "open");
    const paid = list.filter((i) => i.status === "paid");
    return {
      openCount: open.length,
      openCents: open.reduce((s, i) => s + i.amountCents, 0),
      paidCents: paid.reduce((s, i) => s + i.amountCents, 0),
    };
  }, [invoices]);

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
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className="text-2xl font-bold">{money(totals.openCents)}</p>
            <p className="text-xs text-muted-foreground mt-1">{totals.openCount} open invoice(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Collected</p>
            <p className="text-2xl font-bold">{money(totals.paidCents)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Annual fee</p>
            <p className="text-2xl font-bold">$1,195</p>
            <p className="text-xs text-muted-foreground mt-1">per affiliate / year</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1.5 block">Generate annual invoice for affiliate</label>
            <Select value={createForId} onValueChange={setCreateForId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an affiliate…" />
              </SelectTrigger>
              <SelectContent>
                {(affiliateList ?? []).map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.storeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="gap-1.5"
            disabled={!createForId || createInvoice.isPending}
            onClick={() => createInvoice.mutate({ affiliateId: Number(createForId) })}
          >
            <Plus className="h-4 w-4" /> Create $1,195 invoice
          </Button>
        </CardContent>
      </Card>

      {!invoices || invoices.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
          No membership invoices yet. Generate one above, or an affiliate can request theirs from their
          partner dashboard.
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Affiliate</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Term ends</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                    <TableCell>{affiliateName.get(inv.affiliateId) ?? `#${inv.affiliateId}`}</TableCell>
                    <TableCell className="text-muted-foreground">{fmt(inv.issuedAt)}</TableCell>
                    <TableCell className="text-right font-semibold">{money(inv.amountCents)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={inv.status === "paid" ? "default" : inv.status === "void" ? "destructive" : "outline"}
                        className="capitalize"
                      >
                        {inv.status}
                      </Badge>
                      {inv.status === "paid" && (
                        <span className="block text-xs text-muted-foreground mt-0.5 capitalize">
                          {inv.paymentMethod.replace("_", " ")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fmt(inv.periodEnd)}</TableCell>
                    <TableCell className="text-right">
                      {inv.status === "open" ? (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                          onClick={() => {
                            setPayFor({ id: inv.id, number: inv.invoiceNumber, amountCents: inv.amountCents });
                            setPayMethod("external_card");
                            setPayRef("");
                          }}
                        >
                          <Check className="h-3.5 w-3.5" /> Record payment
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">{fmt(inv.paidAt)}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment — {payFor?.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Recording {payFor ? money(payFor.amountCents) : ""} activates this affiliate's membership for one
              year from today.
            </p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Payment method</label>
              <Select value={payMethod} onValueChange={(v) => setPayMethod(v as typeof payMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="external_card">Credit card (our processor)</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="manual">Manual / check / other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Reference (optional)</label>
              <Input
                placeholder="Last 4, txn id, or memo"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFor(null)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={markPaid.isPending}
              onClick={() =>
                payFor &&
                markPaid.mutate({
                  invoiceId: payFor.id,
                  paymentMethod: payMethod,
                  paymentRef: payRef || undefined,
                })
              }
            >
              {markPaid.isPending ? "Saving…" : "Confirm payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

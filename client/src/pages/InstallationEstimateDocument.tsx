import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Printer, Wrench } from "lucide-react";

const money = (value: number | string | null | undefined) => `$${Number(value ?? 0).toFixed(2)}`;

type DocumentLine = {
  description: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  costType?: "labor" | "material";
};

export default function InstallationEstimateDocument({ token }: { token: string }) {
  const documentQuery = trpc.installationEstimates.customerDocument.useQuery({ token }, { retry: false });
  if (documentQuery.isLoading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading installation document…</div>;
  if (!documentQuery.data) return <div className="min-h-screen grid place-items-center p-6 text-center"><div><h1 className="text-2xl font-bold">Installation document unavailable</h1><p className="mt-2 text-muted-foreground">Please contact your installation provider for an updated link.</p></div></div>;
  const { estimate, affiliate } = documentQuery.data;
  const lines = (estimate.lineItems ?? []) as DocumentLine[];
  return <main className="mx-auto max-w-3xl space-y-8 p-5 sm:p-10 print:p-0">
    <header className="flex items-start justify-between gap-4 border-b pb-6">
      <div className="flex gap-3"><div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary"><Wrench className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Installation estimate / invoice</p><h1 className="text-2xl font-bold">{affiliate?.storeName ?? "Affiliate installation"}</h1><p className="text-sm text-muted-foreground">{estimate.roomType} installation services only</p></div></div>
      <Button variant="outline" className="print:hidden" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
    </header>
    <section className="rounded-xl border border-border p-5"><p className="text-sm text-muted-foreground">Customer</p><p className="font-semibold">{estimate.customerName || estimate.customerEmail || "Customer"}</p>{estimate.customerEmail && <p className="text-sm text-muted-foreground">{estimate.customerEmail}</p>}{estimate.cabinetBreakdown && <p className="mt-3 text-sm text-muted-foreground">Saved Kitchen plan cabinet count: {estimate.cabinetBreakdown.base} Base · {estimate.cabinetBreakdown.wall} Wall · {estimate.cabinetBreakdown.tall} Tall · {estimate.cabinetBreakdown.total} total</p>}</section>
    <section className="overflow-hidden rounded-xl border border-border"><div className="flex items-center justify-between gap-3 bg-muted/50 px-5 py-3 font-semibold"><span>{estimate.roomType} installation services</span><span className="text-xs font-normal text-muted-foreground">Labor and materials</span></div><div className="divide-y">{lines.map((line, index) => <div key={index} className="flex justify-between gap-4 px-5 py-3 text-sm"><span>{line.quantity} × {line.description} <span className="text-xs text-muted-foreground">({line.costType ?? "labor"})</span></span><span className="font-medium tabular-nums">{money(line.lineTotal)}</span></div>)}</div><div className="space-y-1 border-t px-5 py-4 text-sm"><div className="flex justify-between"><span>Installation subtotal</span><span>{money(estimate.subtotal)}</span></div>{Number(estimate.markupPercent) > 0 && <div className="flex justify-between"><span>Markup ({Number(estimate.markupPercent).toFixed(2)}%)</span><span>{money(estimate.markupAmount)}</span></div>}<div className="flex justify-between pt-1 text-lg font-bold"><span>Installation total</span><span>{money(estimate.totalAmount)}</span></div></div></section>
    <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"><strong>Separate material invoice:</strong> Cabinet Dealz issues cabinetry and material invoices independently. This document covers only installation services provided by {affiliate?.storeName ?? "your affiliate"}.{estimate.orderRequestId ? ` This installation estimate is associated with Cabinet Dealz material order #${estimate.orderRequestId}.` : ""}</section>
    {estimate.notes && <section><h2 className="font-semibold">Notes</h2><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{estimate.notes}</p></section>}
  </main>;
}

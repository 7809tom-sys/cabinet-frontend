// ─── Demo distributor: example kitchens ──────────────────────────────────────

import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, PackageCheck, PenTool } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DEMO_DISTRIBUTOR, demoDesignerPath, demoLineScene, formatUsd, type DemoLineId } from "@/lib/demoDistributor";
import {
  EXAMPLE_KITCHENS,
  EXAMPLE_KITCHENS_COPY,
  exampleKitchenById,
  exampleKitchenPath,
  exampleKitchenRows,
  exampleKitchensForLine,
  exampleLine,
  type ExampleKitchen,
} from "@/lib/demoExampleKitchens";
import { useDemoPublicPricing } from "@/lib/demoPricing";
import { DealerGateDialog } from "./DistributorDealerGate";

export const EXAMPLES_ROUTE = "/distributor-preview/examples";

function ExampleCard({ kitchen }: { kitchen: ExampleKitchen }) {
  const line = exampleLine(kitchen);
  return (
    <article className="overflow-hidden rounded-xl border bg-white shadow-sm" data-example-id={kitchen.id}>
      <Link href={exampleKitchenPath(kitchen.id)} className="block aspect-[16/10] bg-muted" aria-label={kitchen.name}>
        <img src={demoLineScene(line)} alt={`${line.name} door style (example photo)`} className="h-full w-full object-cover" loading="lazy" />
      </Link>
      <div className="space-y-1.5 p-4">
        <Badge variant="outline" className="text-[11px]">{line.name}</Badge>
        <h3 className="font-semibold"><Link href={exampleKitchenPath(kitchen.id)} className="hover:underline">{kitchen.name}</Link></h3>
        <p className="text-xs text-muted-foreground">{kitchen.layout} · {kitchen.size}</p>
        <p className="text-sm text-muted-foreground">{kitchen.summary}</p>
        <Link href={exampleKitchenPath(kitchen.id)} className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: DEMO_DISTRIBUTOR.primaryColor }}>
          {EXAMPLE_KITCHENS_COPY.itemsUsed} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

/** Front-page section. */
export function ExampleKitchensStrip() {
  return (
    <section className="border-b py-10 sm:py-14" id="example-kitchens" aria-labelledby="example-kitchens-heading">
      <div className="container space-y-5">
        <div className="max-w-3xl space-y-2">
          <h2 id="example-kitchens-heading" className="text-2xl sm:text-3xl font-bold">{EXAMPLE_KITCHENS_COPY.title}</h2>
          <p className="text-muted-foreground">{EXAMPLE_KITCHENS_COPY.intro}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EXAMPLE_KITCHENS.map((k) => <ExampleCard key={k.id} kitchen={k} />)}
        </div>
      </div>
    </section>
  );
}

/** One or two example links on a line card. */
export function LineCardExamples({ lineId }: { lineId: DemoLineId }) {
  const examples = exampleKitchensForLine(lineId).slice(0, 2);
  if (examples.length === 0) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Example:{" "}
      {examples.map((k, i) => (
        <span key={k.id}>
          {i > 0 && " · "}
          <Link href={exampleKitchenPath(k.id)} className="font-medium underline underline-offset-2" style={{ color: DEMO_DISTRIBUTOR.primaryColor }}>{k.name}</Link>
        </span>
      ))}
    </p>
  );
}

/** Compact "Start from an example" strip in the designer shell. */
export function DesignerExamplesStrip() {
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b bg-muted/30 px-3 sm:px-4 py-1.5 text-xs" data-testid="designer-examples">
      <span className="shrink-0 font-semibold">{EXAMPLE_KITCHENS_COPY.strip}:</span>
      {EXAMPLE_KITCHENS.map((k) => (
        <Link key={k.id} href={exampleKitchenPath(k.id)} className="shrink-0 rounded-full border bg-white px-2.5 py-0.5 hover:bg-muted">{k.name}</Link>
      ))}
      <span className="hidden lg:inline shrink-0 text-muted-foreground">{EXAMPLE_KITCHENS_COPY.stripNote}</span>
    </div>
  );
}

function ExampleDetail({ kitchen }: { kitchen: ExampleKitchen }) {
  const showPrices = useDemoPublicPricing();
  const [gateOpen, setGateOpen] = useState(false);
  const line = exampleLine(kitchen);
  const { rows, totalCents } = exampleKitchenRows(kitchen);
  return (
    <section className="container py-10 space-y-6" data-example-id={kitchen.id}>
      <Link href={EXAMPLES_ROUTE} className="text-sm underline">{EXAMPLE_KITCHENS_COPY.viewAll}</Link>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-2">
          <img src={demoLineScene(line)} alt={`${line.name} door style (example photo)`} className="w-full rounded-xl object-cover aspect-[16/10]" />
          <p className="text-xs text-muted-foreground">{EXAMPLE_KITCHENS_COPY.photoNote}</p>
        </div>
        <div className="space-y-3">
          <Badge className="gap-1 text-white" style={{ backgroundColor: DEMO_DISTRIBUTOR.primaryColor }}><PackageCheck className="h-3.5 w-3.5" aria-hidden /> {EXAMPLE_KITCHENS_COPY.badge}</Badge>
          <h1 className="text-2xl sm:text-3xl font-bold">{kitchen.name}</h1>
          <p className="text-sm text-muted-foreground">{line.name} · {kitchen.layout} · {kitchen.size}</p>
          <p>{kitchen.summary}</p>
          <div className="flex flex-wrap gap-2">
            <Button className="text-white" style={{ backgroundColor: DEMO_DISTRIBUTOR.primaryColor }} onClick={() => setGateOpen(true)} data-testid="example-order">{EXAMPLE_KITCHENS_COPY.order}</Button>
            <Link href={demoDesignerPath(kitchen.lineId)}><Button variant="outline" className="gap-1"><PenTool className="h-4 w-4" aria-hidden /> {EXAMPLE_KITCHENS_COPY.design}</Button></Link>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{EXAMPLE_KITCHENS_COPY.itemsUsed}</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Code</th>
                <th className="px-3 py-2 text-left font-medium">Item</th>
                <th className="px-3 py-2 text-left font-medium">Where</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                {showPrices && <th className="px-3 py-2 text-right font-medium">Price</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code} className="border-t" data-item-code={r.code}>
                  <td className="px-3 py-1.5 font-mono text-xs">{r.code}</td>
                  <td className="px-3 py-1.5">{r.name}</td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground">{r.note ?? ""}</td>
                  <td className="px-3 py-1.5 text-right">{r.qty}</td>
                  {showPrices && <td className="px-3 py-1.5 text-right" data-testid="demo-price">{r.lineCents != null ? formatUsd(r.lineCents) : "—"}</td>}
                </tr>
              ))}
            </tbody>
            {showPrices && (
              <tfoot>
                <tr className="border-t font-semibold">
                  <td colSpan={4} className="px-3 py-2 text-right">{EXAMPLE_KITCHENS_COPY.total} <span className="font-normal text-xs text-muted-foreground">(placeholder prices)</span></td>
                  <td className="px-3 py-2 text-right" data-testid="demo-price">{formatUsd(totalCents)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      <DealerGateDialog open={gateOpen} onOpenChange={setGateOpen} />
    </section>
  );
}

/** /distributor-preview/examples and /distributor-preview/examples/:id */
export function ExampleKitchensSection({ exampleId }: { exampleId?: string }) {
  const kitchen = exampleKitchenById(exampleId);
  if (kitchen) return <ExampleDetail kitchen={kitchen} />;
  return (
    <section className="container py-10 space-y-5">
      <div className="max-w-3xl space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold">{EXAMPLE_KITCHENS_COPY.title}</h1>
        <p className="text-muted-foreground">{EXAMPLE_KITCHENS_COPY.intro}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {EXAMPLE_KITCHENS.map((k) => <ExampleCard key={k.id} kitchen={k} />)}
      </div>
    </section>
  );
}

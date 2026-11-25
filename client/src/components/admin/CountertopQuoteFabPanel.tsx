// Countertop Quotes card add-on: the fabrication shops nearest the quote's ZIP
// and the quote's countertop line drawing (SVG / PDF), ready to hand to a shop.
// Nothing is emailed or sent from here. Follow-up status is set by hand.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, ExternalLink, Mail, MapPin } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FAB_SHOP_EMAIL_DRAFTS_ENABLED } from "@shared/fabricationShops";
import {
  buildCountertopLineArtPdf,
  buildCountertopLineArtSvg,
  lineArtFileName,
  quoteFabricationInput,
  quoteFabricationSheet,
  type CountertopQuoteSnapshot,
} from "@/lib/countertopLineArt";
import { downloadFabricationSheetPdf } from "@/lib/countertopFabricationSheetPdf";

export type QuoteFabShop = {
  fabShopId: number; name: string; city: string | null; state: string; zip: string | null; address: string | null;
  phone: string | null; email: string | null; website: string | null; confidence: string | null;
  googleRating: number | null; reviewCount: number | null; distanceMiles: number | null; method: string;
  status: "suggested" | "matched" | "contacted" | "quoted" | "declined"; note: string | null;
};

const STATUS_LABELS: Record<QuoteFabShop["status"], string> = {
  suggested: "Suggested",
  matched: "Matched",
  contacted: "Contacted",
  quoted: "Quoted",
  declined: "Declined",
};

export function fabShopDistanceLabel(shop: Pick<QuoteFabShop, "distanceMiles" | "method">): string {
  if (shop.method === "same_zip") return "same ZIP";
  if (shop.distanceMiles == null) return shop.method === "state" ? "same state" : "distance unknown";
  const miles = `about ${Math.round(shop.distanceMiles)} mi`;
  return shop.method === "state" ? `${miles} (nearest in state)` : miles;
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Quote = CountertopQuoteSnapshot & { zip?: string | null };

export function CountertopQuoteLineArt({ quote }: { quote: Quote }) {
  const [open, setOpen] = useState(false);
  const sheet = useMemo(() => (open ? quoteFabricationSheet(quote) : null), [open, quote]);
  const title = `Countertop quote #${quote.id}${quote.zip ? ` · ZIP ${quote.zip}` : ""}`;
  const svg = useMemo(() => (sheet ? buildCountertopLineArtSvg(sheet, { title }) : null), [sheet, title]);
  const hasRoom = useMemo(() => quoteFabricationInput(quote) != null, [quote]);
  if (!hasRoom) return <p className="text-xs text-muted-foreground">No design was saved with this quote, so there is no line drawing.</p>;

  return (
    <div className="space-y-2" data-testid={`countertop-quote-lineart-${quote.id}`}>
      <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>{open ? "Hide line drawing" : "Line drawing"}</Button>
      {open && sheet && svg && (
        <div className="space-y-2 rounded-md border bg-white p-2">
          <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt={`Countertop line drawing for quote ${quote.id}`} className="max-h-[480px] w-full object-contain" />
          {sheet.empty && <p className="text-xs text-muted-foreground">The saved design has no countertop run.</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => saveBlob(new Blob([svg], { type: "image/svg+xml" }), lineArtFileName(quote.id, "svg"))}><Download className="mr-1 h-3.5 w-3.5" /> SVG</Button>
            <Button size="sm" variant="secondary" onClick={async () => {
              try { (await buildCountertopLineArtPdf(sheet, { title })).save(lineArtFileName(quote.id, "pdf")); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not build the PDF."); }
            }}><Download className="mr-1 h-3.5 w-3.5" /> PDF</Button>
            <Button size="sm" variant="ghost" onClick={async () => {
              try { await downloadFabricationSheetPdf(sheet); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not build the sheet."); }
            }}><Download className="mr-1 h-3.5 w-3.5" /> Full fabrication sheet (PDF)</Button>
          </div>
          <p className="text-xs text-muted-foreground">Drawn from the design saved with the quote. Older quotes may not include the island or sinks.</p>
        </div>
      )}
    </div>
  );
}

export function CountertopQuoteFabShops({ quote, shops, ready }: { quote: Quote; shops: QuoteFabShop[]; ready: boolean }) {
  const utils = trpc.useUtils();
  const attach = trpc.fabShops.attachToQuote.useMutation({
    onSuccess: (result: { added: number }) => { toast.success(result.added ? `Saved ${result.added} shop${result.added === 1 ? "" : "s"} on this quote.` : "No new shops to save."); utils.fabShops.forQuotes.invalidate(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const setStatus = trpc.fabShops.setQuoteShopStatus.useMutation({
    onSuccess: () => utils.fabShops.forQuotes.invalidate(),
    onError: (e: { message: string }) => toast.error(e.message),
  });

  if (!ready) return <p className="text-xs text-muted-foreground">Fabrication shop list not set up yet (docs/sql/0291).</p>;
  if (!quote.zip) return <p className="text-xs text-muted-foreground">No ZIP on this quote, so no fabrication shops can be matched.</p>;
  const suggestedOnly = shops.length > 0 && shops.every((shop) => shop.status === "suggested");

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3" data-testid={`countertop-quote-fabshops-${quote.id}`}>
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
        <MapPin className="h-4 w-4" /> Fabrication shops near ZIP {quote.zip}
        {suggestedOnly && <Button size="sm" variant="outline" className="ml-auto h-7" disabled={attach.isPending} onClick={() => attach.mutate({ quoteId: quote.id })}>Save these on the quote</Button>}
      </div>
      {shops.length === 0 && <p className="text-xs text-muted-foreground">No fabrication shops on the list for this area yet.</p>}
      <ul className="space-y-2">
        {shops.map((shop) => (
          <li key={shop.fabShopId} className="flex flex-wrap items-start justify-between gap-2 text-sm">
            <div className="min-w-0">
              <div><strong>{shop.name}</strong> <span className="text-muted-foreground">· {shop.city ?? "—"}, {shop.state} {shop.zip ?? ""} · {fabShopDistanceLabel(shop)}</span></div>
              <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                {shop.phone && <a href={`tel:${shop.phone.replace(/[^0-9+]/g, "")}`} className="hover:underline">{shop.phone}</a>}
                {shop.website && <a href={shop.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">Website <ExternalLink className="h-3 w-3" /></a>}
                {shop.googleRating != null && <span>{shop.googleRating.toFixed(1)}★{shop.reviewCount != null ? ` (${shop.reviewCount})` : ""}</span>}
                {shop.confidence && <span className="capitalize">{shop.confidence} confidence</span>}
                {FAB_SHOP_EMAIL_DRAFTS_ENABLED && shop.email && (
                  <a href={`mailto:${encodeURIComponent(shop.email)}?subject=${encodeURIComponent(`Countertop quote request #${quote.id}`)}`} className="inline-flex items-center gap-1 hover:underline"><Mail className="h-3 w-3" /> Draft email</a>
                )}
              </div>
            </div>
            <Select value={shop.status} onValueChange={(value) => { if (value !== "suggested") setStatus.mutate({ quoteId: quote.id, fabShopId: shop.fabShopId, status: value as "matched" }); }}>
              <SelectTrigger className="h-8 w-[130px]" aria-label={`Follow-up status for ${shop.name}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                {shop.status === "suggested" && <SelectItem value="suggested">{STATUS_LABELS.suggested}</SelectItem>}
                {(["matched", "contacted", "quoted", "declined"] as const).map((status) => <SelectItem key={status} value={status}>{STATUS_LABELS[status]}</SelectItem>)}
              </SelectContent>
            </Select>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Distances are approximate (by ZIP area). Nothing is sent to these shops from here.</p>
    </div>
  );
}

export function useQuoteFabShops(quoteIds: number[]) {
  const query = trpc.fabShops.forQuotes.useQuery({ quoteIds }, { enabled: quoteIds.length > 0, retry: false });
  return {
    ready: query.error ? false : (query.data?.ready ?? true),
    byQuote: (query.data?.byQuote ?? {}) as Record<number, QuoteFabShop[]>,
    loading: query.isLoading,
  };
}

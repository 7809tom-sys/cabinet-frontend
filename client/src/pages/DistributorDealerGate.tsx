// ─── Demo distributor: dealer-only purchase gate + sample dealers page ───────
// Distributors sell only through dealers. In /distributor-preview/design the
// shell catches any navigation to a cart, checkout or order route (see
// useDealerGatedLocation) and opens this gate instead: it finds the nearest
// fictional dealer (browser location, or a ZIP), "sends" the plan with no
// network call, and says the distributor will follow up. Demo only.

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useSearch } from "wouter";
import { useBrowserLocation } from "wouter/use-browser-location";
import { CheckCircle2, Loader2, MapPin, Phone, Mail, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_BRAND_NAME, DEMO_DISTRIBUTOR } from "@/lib/demoDistributor";
import {
  DEALERS_PAGE_COPY,
  DEALER_GATE_COPY,
  DEMO_DEALERS,
  DEMO_DEFAULT_ZIP,
  dealersByDistance,
  formatMiles,
  isDemoPurchasePath,
  nearestDealer,
  normalizeZip,
  zipToPoint,
  type DealerMatch,
  type LatLng,
} from "@/lib/demoDealers";

export const DEALERS_ROUTE = "/distributor-preview/dealers";
const SEND_DELAY_MS = 1200;
const GEO_TIMEOUT_MS = 4000;

// ── Route-level interception (no DesignTool change needed) ──

type NavigateOptions = { replace?: boolean; state?: unknown };
type BrowserLocationHook = (opts?: { ssrPath?: string }) => [string, (to: string, options?: NavigateOptions) => void];

/**
 * A wouter location hook for a nested <Router hook={...}> around the designer.
 * Navigation to a purchase route calls onBlocked instead of leaving the page;
 * everything else navigates normally. Create it once (useMemo) per shell.
 */
export function createDealerGatedLocationHook(onBlocked: (to: string) => void): BrowserLocationHook {
  return function useDealerGatedLocation(opts) {
    const [location, navigate] = useBrowserLocation(opts);
    const gated = useCallback(
      (to: string, options?: NavigateOptions) => {
        if (isDemoPurchasePath(String(to))) {
          onBlocked(String(to));
          return;
        }
        navigate(to, options as Parameters<typeof navigate>[1]);
      },
      [navigate],
    );
    return [location, gated];
  };
}

// ── Gate dialog ──

export type DealerGateStage = "locating" | "sending" | "sent";

export function DealerGateContent({
  stage,
  match,
  zip,
  locationSource,
  onZipChange,
  onZipSubmit,
}: {
  stage: DealerGateStage;
  match: DealerMatch | null;
  zip: string;
  locationSource: "browser" | "zip" | null;
  onZipChange: (value: string) => void;
  onZipSubmit: () => void;
}) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onZipSubmit();
  };
  return (
    <div className="space-y-4">
      {stage === "locating" || !match ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {DEALER_GATE_COPY.locating}</p>
      ) : (
        <div className="rounded-lg border p-3" data-testid="dealer-gate-card">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: DEMO_DISTRIBUTOR.primaryColor }}>{DEALER_GATE_COPY.recommended}</p>
          <p className="mt-1 font-semibold">{match.dealer.name}</p>
          <p className="text-sm text-muted-foreground">{match.dealer.city}, {match.dealer.state} · {formatMiles(match.miles)}</p>
          <p className="text-sm text-muted-foreground">{match.dealer.phone}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Sample dealer{locationSource === "browser" ? " · based on your location" : ` · based on ZIP ${zip}`}</p>
        </div>
      )}

      {match && stage === "sending" && (
        <p className="flex items-center gap-2 text-sm" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {DEALER_GATE_COPY.sending}</p>
      )}
      {match && stage === "sent" && (
        <div className="space-y-1" role="status">
          <p className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden /> {DEALER_GATE_COPY.sent(match.dealer.name)}</p>
          <p className="text-sm">{DEALER_GATE_COPY.final(DEMO_BRAND_NAME, match.dealer.name)}</p>
          <p className="text-[11px] text-muted-foreground">{DEALER_GATE_COPY.demoNote}</p>
        </div>
      )}

      <form onSubmit={submit} className="flex items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="dealer-gate-zip" className="text-xs">{DEALER_GATE_COPY.zipLabel}</Label>
          <Input id="dealer-gate-zip" inputMode="numeric" maxLength={5} value={zip} onChange={(e) => onZipChange(e.target.value)} className="h-8 w-28" />
        </div>
        <Button type="submit" size="sm" variant="outline">{DEALER_GATE_COPY.zipButton}</Button>
      </form>
      <p className="text-[11px] text-muted-foreground">{DEALER_GATE_COPY.zipHelp}</p>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <Link href={`${DEALERS_ROUTE}?zip=${encodeURIComponent(normalizeZip(zip) ?? DEMO_DEFAULT_ZIP)}`} className="text-sm underline" style={{ color: DEMO_DISTRIBUTOR.primaryColor }}>
          {DEALER_GATE_COPY.other}
        </Link>
      </div>
    </div>
  );
}

function getBrowserPoint(): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    let done = false;
    const finish = (value: LatLng | null) => {
      if (!done) {
        done = true;
        resolve(value);
      }
    };
    const timer = setTimeout(() => finish(null), GEO_TIMEOUT_MS + 500);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(timer); finish({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => { clearTimeout(timer); finish(null); },
      { timeout: GEO_TIMEOUT_MS, maximumAge: 600000 },
    );
  });
}

/** The gate: location → nearest dealer → plan "sent" (demo, no network). */
export function DealerGateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [stage, setStage] = useState<DealerGateStage>("locating");
  const [match, setMatch] = useState<DealerMatch | null>(null);
  const [zip, setZip] = useState(DEMO_DEFAULT_ZIP);
  const [source, setSource] = useState<"browser" | "zip" | null>(null);
  const runId = useRef(0);

  const recommend = useCallback((point: LatLng, from: "browser" | "zip") => {
    const id = ++runId.current;
    setMatch(nearestDealer(point));
    setSource(from);
    setStage("sending");
    setTimeout(() => { if (runId.current === id) setStage("sent"); }, SEND_DELAY_MS);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = ++runId.current;
    setStage("locating");
    setMatch(null);
    void getBrowserPoint().then((point) => {
      if (runId.current !== id) return;
      if (point) recommend(point, "browser");
      else recommend(zipToPoint(zip) ?? zipToPoint(DEMO_DEFAULT_ZIP)!, "zip");
    });
    // zip intentionally read once per open; the form handles changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recommend]);

  const submitZip = () => {
    const point = zipToPoint(zip);
    if (point) recommend(point, "zip");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dealer-gate">
        <DialogHeader>
          <DialogTitle>{DEALER_GATE_COPY.headline}</DialogTitle>
          <DialogDescription>{DEALER_GATE_COPY.framing}</DialogDescription>
        </DialogHeader>
        <DealerGateContent stage={stage} match={match} zip={zip} locationSource={source} onZipChange={setZip} onZipSubmit={submitZip} />
        <div className="flex justify-end">
          <Button size="sm" className="text-white" style={{ backgroundColor: DEMO_DISTRIBUTOR.primaryColor }} onClick={() => onOpenChange(false)}>{DEALER_GATE_COPY.close}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Sample dealers page (/distributor-preview/dealers) ──

export function DealersSection() {
  const search = useSearch();
  const zip = normalizeZip(new URLSearchParams(search).get("zip") ?? "");
  const point = zip ? zipToPoint(zip) : null;
  const rows = useMemo(
    () => (point ? dealersByDistance(point) : DEMO_DEALERS.map((dealer) => ({ dealer, miles: null as number | null }))),
    [point?.lat, point?.lng], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [sent, setSent] = useState<Record<string, boolean>>({});

  return (
    <section className="container py-10 space-y-5">
      <div className="max-w-3xl space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold">{DEALERS_PAGE_COPY.title}</h1>
        <p className="text-muted-foreground">{DEALERS_PAGE_COPY.intro}</p>
        <p className="rounded-md border border-[#e9d8a6] bg-[#fff8e1] px-3 py-2 text-sm text-[#7a5f10]" role="note">{DEALERS_PAGE_COPY.sample}</p>
        {zip && <p className="text-xs text-muted-foreground">Sorted by distance from ZIP {zip}.</p>}
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ dealer, miles }) => (
          <li key={dealer.id} data-dealer-id={dealer.id}>
            <Card className="h-full">
              <CardContent className="flex h-full flex-col gap-2 p-4 text-sm">
                <div>
                  <p className="font-semibold">{dealer.name}</p>
                  <p className="text-xs text-muted-foreground">Sample dealer{miles != null ? ` · ${formatMiles(miles)}` : ""}</p>
                </div>
                <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {dealer.street}, {dealer.city}, {dealer.state} {dealer.zip}</p>
                <p className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" aria-hidden /> {dealer.phone}</p>
                <p className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0" aria-hidden /> {dealer.email}</p>
                <p className="flex items-center gap-2"><Clock className="h-4 w-4 shrink-0" aria-hidden /> {dealer.hours}</p>
                <div className="mt-auto pt-2">
                  {sent[dealer.id] ? (
                    <p className="flex items-center gap-2 font-medium text-green-700" role="status"><CheckCircle2 className="h-4 w-4" aria-hidden /> {DEALERS_PAGE_COPY.sent}</p>
                  ) : (
                    <Button size="sm" className="gap-2 text-white" style={{ backgroundColor: DEMO_DISTRIBUTOR.primaryColor }} onClick={() => setSent((s) => ({ ...s, [dealer.id]: true }))}>
                      <Send className="h-4 w-4" aria-hidden /> {DEALERS_PAGE_COPY.send}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

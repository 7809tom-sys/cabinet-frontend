import { useEffect, useState } from "react";
import { AlertTriangle, Calculator, Loader2, PackageCheck, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";

type SimulationMode = "pallet_preview" | "saved_configuration";
type SavedDesignSimulationResult = inferRouterOutputs<AppRouter>["freight"]["adminSimulateSavedDesignFreight"];
type SimulationResultMode = SimulationMode | "plan_b";

const money = (cents: number | null | undefined) =>
  cents == null ? "Not configured" : `$${(cents / 100).toFixed(2)}`;

const modeLabel: Record<SimulationResultMode, string> = {
  pallet_preview: "Pallets only",
  saved_configuration: "Configured carrier quote",
  // Kept only to render a historic cached result; Saved Design Shipping Test
  // can no longer submit a Plan B request.
  plan_b: "Historic Plan B result",
};

function formatCooldown(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function carrierEnvironmentLabel(provider: string, environment: "sandbox" | "production" | null): string {
  if (provider === "worldwideexpress" && environment === "sandbox") {
    return "Worldwide Express sandbox — non-production test rate";
  }
  if (environment === "production") return "Production carrier connection";
  return environment ? `${provider} · ${environment}` : provider;
}

export default function FreightTestLab() {
  const [selectedDesignId, setSelectedDesignId] = useState("none");
  const [destinationZip, setDestinationZip] = useState("30303");
  const [deliveryType, setDeliveryType] = useState<"business" | "residential">("business");
  const [liftgate, setLiftgate] = useState(false);
  const [insideDelivery, setInsideDelivery] = useState(false);
  const [limitedAccess, setLimitedAccess] = useState(false);
  const [mode, setMode] = useState<SimulationMode>("saved_configuration");
  const [resultsByMode, setResultsByMode] = useState<Partial<Record<SimulationMode, SavedDesignSimulationResult>>>({});
  const [missingOriginGroup, setMissingOriginGroup] = useState<SavedDesignSimulationResult["groups"][number] | null>(null);
  const [originZipDraft, setOriginZipDraft] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [carrierRetryAt, setCarrierRetryAt] = useState<number | null>(null);

  const designsQuery = trpc.freight.adminListSimulationDesigns.useQuery(undefined, { staleTime: 30_000 });
  const simulate = trpc.freight.adminSimulateSavedDesignFreight.useMutation({
    onSuccess: (result) => {
      setResultsByMode((current) => ({ ...current, [result.mode]: result }));
      if (result.mode === "saved_configuration") setCarrierRetryAt(result.carrierRetryAt ?? null);
      toast.success(`${modeLabel[result.mode]} complete. No order or payment was created.`);
    },
    onError: (error) => toast.error(error.message),
  });
  const updateDoorStyle = trpc.doorStyles.adminUpdateDoorStyle.useMutation({
    onSuccess: () => {
      toast.success(`Shipping Origin ZIP saved for ${missingOriginGroup?.missingOriginStyle?.distributorName ?? "the distributor"}. Run the test again to use it.`);
      setResultsByMode({});
      setMissingOriginGroup(null);
      setOriginZipDraft("");
    },
    onError: (error) => toast.error(error.message),
  });

  function invalidateResults() {
    setResultsByMode({});
  }

  function openMissingOriginDialog(group: SavedDesignSimulationResult["groups"][number]) {
    setMissingOriginGroup(group);
    setOriginZipDraft("");
  }

  function saveMissingOriginZip() {
    const affectedStyle = missingOriginGroup?.missingOriginStyle;
    const normalizedZip = originZipDraft.trim();
    if (!affectedStyle) return;
    if (!/^\d{5}$/.test(normalizedZip)) {
      toast.error("Enter a valid 5-digit Shipping Origin ZIP.");
      return;
    }
    updateDoorStyle.mutate({ id: affectedStyle.id, warehouseZips: [normalizedZip] });
  }

  function runSimulation() {
    const designId = Number(selectedDesignId);
    if (!Number.isInteger(designId) || designId <= 0) {
      toast.error("Choose a saved design before running the freight test.");
      return;
    }
    if (!/^\d{5}$/.test(destinationZip.trim())) {
      toast.error("Enter a valid 5-digit destination ZIP.");
      return;
    }
    simulate.mutate({
      designId,
      destinationZip: destinationZip.trim(),
      mode,
      accessorials: {
        residential: deliveryType === "residential",
        liftgate,
        insideDelivery,
        limitedAccess,
      },
    });
  }

  const result = resultsByMode[mode];
  const selectedDesign = designsQuery.data?.find((design) => String(design.id) === selectedDesignId);
  const carrierRateLimited = /temporarily rate-limited/i.test(result?.quote?.reason ?? "");
  const activeCarrierRetryAt = result?.carrierRetryAt ?? carrierRetryAt;
  const carrierCooldownRemainingMs = activeCarrierRetryAt == null ? 0 : Math.max(0, activeCarrierRetryAt - now);
  const carrierCooldownActive = mode === "saved_configuration" && carrierCooldownRemainingMs > 0;
  const usesWwexSandbox = result?.provider === "worldwideexpress" && result.providerEnvironment === "sandbox";

  useEffect(() => {
    if (!carrierCooldownActive) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [carrierCooldownActive]);

  return (
    <Card className="border-amber-300/70 bg-amber-50/30 dark:bg-amber-950/10">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Calculator className="h-5 w-5 text-amber-700" /> Freight Test Lab
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
            Test only
          </span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose a saved kitchen design, enter the delivery ZIP, and inspect each style-origin pallet before going live. This test never creates an order, checkout, signed customer quote, or payment.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3" aria-labelledby="freight-test-items-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 id="freight-test-items-heading" className="font-semibold">1. Saved design</h3>
              <p className="text-xs text-muted-foreground">Use the cabinet selections already saved in a design. Appliances and unresolved catalog selections are never assigned an invented package.</p>
            </div>
            {selectedDesign && <span className="text-sm font-medium">{selectedDesign.cabinetUnits} cabinet unit(s)</span>}
          </div>

          <div className="max-w-2xl space-y-2">
            <Label htmlFor="freight-test-saved-design">Saved design</Label>
            <Select value={selectedDesignId} onValueChange={(value) => { setSelectedDesignId(value); invalidateResults(); }}>
              <SelectTrigger id="freight-test-saved-design" aria-label="Saved design for freight simulation"><SelectValue placeholder="Choose a saved design" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Choose a saved design</SelectItem>
                {designsQuery.data?.map((design) => (
                  <SelectItem key={design.id} value={String(design.id)} disabled={!design.readyForFreight}>
                    {design.name} · {design.cabinetUnits} cabinet unit{design.cabinetUnits === 1 ? "" : "s"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {designsQuery.isLoading && <p className="text-xs text-muted-foreground">Loading saved designs…</p>}
            {designsQuery.data?.length === 0 && <p className="border border-dashed p-3 text-sm text-muted-foreground">No saved designs with cabinet selections are available yet.</p>}
            {selectedDesign && !selectedDesign.readyForFreight && <p className="text-xs text-destructive">This saved design needs a selected door style and distributor before it can be tested.</p>}
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="freight-test-settings-heading">
          <div>
            <h3 id="freight-test-settings-heading" className="font-semibold">2. Delivery ZIP and test path</h3>
              <p className="text-xs text-muted-foreground">Enter the delivery ZIP here, then request a quote from the carrier configured in Operations. A saved-design test never substitutes a Plan B fee, estimate, or staging connection for a carrier response. The test never creates an order, payment, shipment, or customer quote. Use Pallets only when you need dimensions and weight without a carrier request.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Destination ZIP</Label>
              <Input value={destinationZip} onChange={(event) => { setDestinationZip(event.target.value); invalidateResults(); }} inputMode="numeric" maxLength={5} />
            </div>
            <div className="space-y-1.5">
              <Label>Delivery type</Label>
              <Select
                value={deliveryType}
                onValueChange={(value) => {
                  const next = value as "business" | "residential";
                  setDeliveryType(next);
                  if (next === "residential") setLiftgate(true);
                  invalidateResults();
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="residential">Residential</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Simulation path</Label>
              <Select value={mode} onValueChange={(value) => { setMode(value as SimulationMode); invalidateResults(); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="saved_configuration">Configured carrier quote — live response only</SelectItem>
                  <SelectItem value="pallet_preview">Pallets only — no shipping cost</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 border p-3 text-sm">
              <Switch checked={liftgate} onCheckedChange={(checked) => { setLiftgate(checked); invalidateResults(); }} /> Lift gate
            </label>
            <label className="flex items-center gap-2 border p-3 text-sm">
              <Switch checked={insideDelivery} onCheckedChange={(checked) => { setInsideDelivery(checked); invalidateResults(); }} /> Inside delivery
            </label>
            <label className="flex items-center gap-2 border p-3 text-sm">
              <Switch checked={limitedAccess} onCheckedChange={(checked) => { setLimitedAccess(checked); invalidateResults(); }} /> Limited access
            </label>
          </div>
          <div className="space-y-2">
            <Button
              type="button"
              onClick={runSimulation}
              disabled={simulate.isPending || carrierCooldownActive || selectedDesignId === "none" || selectedDesign?.readyForFreight === false}
              aria-busy={simulate.isPending}
              aria-describedby={carrierCooldownActive ? "wwex-retry-countdown" : undefined}
            >
              {simulate.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Requesting carrier quote…</>
              ) : carrierCooldownActive ? (
                <>Retry carrier quote in {formatCooldown(carrierCooldownRemainingMs)}</>
              ) : mode === "pallet_preview" ? "Build pallet preview" : "Get configured carrier quote"}
            </Button>
            {carrierCooldownActive && (
              <p id="wwex-retry-countdown" role="status" aria-live="polite" className="text-xs font-medium tabular-nums text-amber-800 dark:text-amber-200">
                WWEX retry available in {formatCooldown(carrierCooldownRemainingMs)}. No carrier request will be sent until the countdown ends.
              </p>
            )}
          </div>
        </section>

        {result && (
          <section className="space-y-4 border-t pt-5" aria-labelledby="freight-test-results-heading">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 id="freight-test-results-heading" className="flex items-center gap-2 font-semibold">
                  <PackageCheck className="h-4 w-4 text-emerald-700" /> Test result
                </h3>
                <p className="text-xs text-muted-foreground">{result.note}</p>
                <p className="mt-1 text-xs text-muted-foreground">Saved design: <span className="font-medium text-foreground">{result.savedDesign.name}</span> · {result.savedDesign.quotedCabinetUnits} catalog cabinet unit(s) tested</p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>{modeLabel[result.mode]}</div>
                <div>{carrierEnvironmentLabel(result.provider, result.providerEnvironment)}</div>
              </div>
            </div>

            {usesWwexSandbox && (
              <div className="flex items-start gap-2 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100" role="status">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span><strong>Sandbox result only.</strong> This is a non-production WWEX test rate for Operations validation. It is not a customer-facing production quote, order, payment, or shipment.</span>
              </div>
            )}

            <div className={`border p-4 ${result.quote?.available ? "border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/10" : "border-amber-300 bg-amber-50/40 dark:bg-amber-950/10"}`} aria-label="Carrier shipping quote summary">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Carrier shipping quote</div>
              {result.quote?.available ? (
                <div className="mt-1 text-2xl font-semibold text-foreground">{money(result.quote.totalCents)}</div>
              ) : result.mode === "pallet_preview" ? (
                <p className="mt-1 text-sm text-muted-foreground">Pallets only does not request a carrier price. Select Carrier shipping quote to price this saved design and ZIP.</p>
              ) : (
                <div className="mt-1 space-y-2">
                  <p className="text-sm text-destructive">{result.quote?.reason ?? "Carrier shipping cost is unavailable for this test."}</p>
                  {carrierRateLimited ? (
                    <p className="text-sm font-medium text-foreground">{carrierCooldownActive ? `WWEX is temporarily busy. Retry available in ${formatCooldown(carrierCooldownRemainingMs)}; your saved credentials do not need to be replaced.` : "WWEX is temporarily busy. The cooldown has ended, so you can retry; your saved credentials do not need to be replaced."}</p>
                  ) : (
                    <a className="inline-flex text-sm font-medium text-primary underline underline-offset-4" href="/admin?tab=shipping#shipping-live-provider">Open carrier setup</a>
                  )}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Test only — no order, payment, quote commitment, or shipment was created.
              </p>
            </div>

            {(result.savedDesign.excludedPlacementUnits > 0 || result.savedDesign.unmatchedCatalogUnits > 0 || result.savedDesign.unpricedCatalogUnits > 0) && (
              <div className="flex items-start gap-2 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {result.savedDesign.excludedPlacementUnits > 0 && `${result.savedDesign.excludedPlacementUnits} non-cabinet or unconfigured design unit(s) skipped. `}
                  {result.savedDesign.unmatchedCatalogUnits > 0 && `${result.savedDesign.unmatchedCatalogUnits} cabinet unit(s) no longer match the current catalog and were not tested. `}
                  {result.savedDesign.unpricedCatalogUnits > 0 && `${result.savedDesign.unpricedCatalogUnits} tested cabinet unit(s) have no current price, so they are excluded from the merchandise subtotal.`}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="border p-3"><div className="text-xs text-muted-foreground">Units</div><div className="text-xl font-semibold">{result.totalUnits}</div></div>
              <div className="border p-3"><div className="text-xs text-muted-foreground">Origin groups</div><div className="text-xl font-semibold">{result.groups.length}</div></div>
              <div className="border p-3"><div className="text-xs text-muted-foreground">Loaded weight</div><div className="text-xl font-semibold">{result.totalBillableWeightLbs.toFixed(0)} lbs</div></div>
            </div>

            <div className="space-y-3">
              {result.groups.map((group) => (
                <div key={group.key} className="border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{group.label}</div>
                      <div className="text-xs text-muted-foreground">Origin {group.originZip} · {group.palletCount} pallet(s) · {group.totalCubicFt.toFixed(2)} cu ft</div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold uppercase tracking-wide">{group.source.replace("_", " ")}</div>
                      <div>Plan B: {money(group.planBFeeCents)}</div>
                      {group.baseAmountCents != null && <div>Selected base: {money(group.baseAmountCents)}</div>}
                    </div>
                  </div>
                  {group.liveError && (
                    <div className="mt-3 flex items-start gap-2 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{group.liveError}</span>
                    </div>
                  )}
                  {group.usedOperationsOriginFallback && (
                    <div className="mt-3 flex items-start gap-2 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0 space-y-2">
                        <p>
                          <strong>{group.missingOriginStyle?.distributorName ?? "This distributor"}</strong> — {group.missingOriginStyle?.name ?? "this style"} has no Shipping Origin ZIP. This test uses the Operations origin only; customer quotes still require the style’s own origin ZIP.
                        </p>
                        {group.missingOriginStyle && (
                          <Button type="button" size="sm" variant="outline" className="border-amber-400 bg-white" onClick={() => openMissingOriginDialog(group)}>
                            Add {group.missingOriginStyle.distributorName} Shipping Origin ZIP
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="mt-3 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pallet</TableHead>
                          <TableHead>Dimensions</TableHead>
                          <TableHead>Loaded weight</TableHead>
                          <TableHead>Contents</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.pallets.map((pallet, index) => (
                          <TableRow key={`${group.key}:pallet:${index}`}>
                            <TableCell>#{index + 1}</TableCell>
                            <TableCell className="whitespace-nowrap">{pallet.lengthIn} × {pallet.widthIn} × {pallet.heightIn} in</TableCell>
                            <TableCell className="whitespace-nowrap font-medium">{pallet.weightLbs} lbs</TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{pallet.contentsWeightLbs} lbs · {pallet.contentsCubicFt.toFixed(2)} cu ft</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>

            {result.quote && (
              <div className={`border p-4 ${result.quote.available ? "border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/10" : "border-destructive/40 bg-destructive/5"}`}>
                <div className="flex items-center gap-2 font-semibold">
                  {result.quote.available ? <ShieldCheck className="h-4 w-4 text-emerald-700" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                  {result.quote.available ? "Carrier shipping quote details" : "Simulation could not produce a price"}
                </div>
                {!result.quote.available && <p className="mt-2 text-sm text-destructive">{result.quote.reason}</p>}
                {result.quote.available && (
                  <div className="mt-3 space-y-2 text-sm">
                    {result.quote.lines.map((line, index) => (
                      <div key={`${line.label}:${index}`} className="flex justify-between gap-4"><span>{line.label}</span><span>{money(line.amountCents)}</span></div>
                    ))}
                    <div className="flex justify-between gap-4 border-t pt-2"><span>Operations markup</span><span>{money(result.quote.markupCents)}</span></div>
                    {result.quote.damageFeeCents > 0 && <div className="flex justify-between gap-4"><span>Damage coverage</span><span>{money(result.quote.damageFeeCents)}</span></div>}
                    <div className="flex justify-between gap-4 border-t pt-2 text-lg font-semibold"><span>Test total</span><span>{money(result.quote.totalCents)}</span></div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      <Dialog open={Boolean(missingOriginGroup)} onOpenChange={(open) => { if (!open && !updateDoorStyle.isPending) setMissingOriginGroup(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Shipping Origin ZIP</DialogTitle>
            <DialogDescription>
              {missingOriginGroup?.missingOriginStyle ? (
                <>
                  Save the warehouse ZIP for <strong>{missingOriginGroup.missingOriginStyle.distributorName}</strong> — {missingOriginGroup.missingOriginStyle.name}. The next Shipping Test and customer quote will use this style-specific origin.
                </>
              ) : "Save the warehouse ZIP for this door style."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="missing-origin-zip">Shipping Origin ZIP</Label>
            <Input id="missing-origin-zip" value={originZipDraft} onChange={(event) => setOriginZipDraft(event.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" maxLength={5} placeholder="e.g. 30303" />
            <p className="text-xs text-muted-foreground">This saves the selected door style’s first Shipping Origin ZIP. Add additional origin ZIPs later in Featured Door Styles if needed.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMissingOriginGroup(null)} disabled={updateDoorStyle.isPending}>Cancel</Button>
            <Button type="button" onClick={saveMissingOriginZip} disabled={updateDoorStyle.isPending || !/^\d{5}$/.test(originZipDraft)}>
              {updateDoorStyle.isPending ? "Saving…" : "Save Shipping Origin ZIP"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </CardContent>
    </Card>
  );
}

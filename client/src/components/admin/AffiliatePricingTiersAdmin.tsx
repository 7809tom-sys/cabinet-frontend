import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Basis = "cost_multiplier" | "list_discount";

type TierRow = {
  id: number;
  tierCode: string;
  tierName: string;
  basis: Basis;
  basisPoints: number;
  volumeThresholdCents: number | null;
  examplePlaceholder: boolean;
  sortOrder: number;
  active: boolean;
  notes: string | null;
  summary: string;
};

const EMPTY = {
  id: null as number | null,
  tierName: "",
  basis: "cost_multiplier" as Basis,
  value: "1.00",
  volumeDollars: "",
  examplePlaceholder: true,
  active: true,
  sortOrder: "0",
  notes: "",
};

function valueFromTier(tier: TierRow): string {
  return tier.basis === "cost_multiplier"
    ? (tier.basisPoints / 10000).toFixed(2)
    : (tier.basisPoints / 100).toFixed(2);
}

export default function AffiliatePricingTiersAdmin({ seedRows }: { seedRows?: TierRow[] } = {}) {
  const utils = trpc.useUtils();
  const tiers = trpc.affiliates.adminPricingTiers.useQuery(undefined, { enabled: seedRows == null, retry: false });
  const [form, setForm] = useState(EMPTY);

  const save = trpc.affiliates.adminSavePricingTier.useMutation({
    onSuccess: () => {
      toast.success("Pricing tier saved");
      utils.affiliates.adminPricingTiers.invalidate();
      utils.affiliates.adminList.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const rows = seedRows ?? ((tiers.data ?? []) as TierRow[]);
  const selected = useMemo(
    () => rows.find((row) => row.id === form.id) ?? null,
    [rows, form.id],
  );

  function edit(row: TierRow) {
    setForm({
      id: row.id,
      tierName: row.tierName,
      basis: row.basis,
      value: valueFromTier(row),
      volumeDollars: row.volumeThresholdCents == null ? "" : String(row.volumeThresholdCents / 100),
      examplePlaceholder: row.examplePlaceholder,
      active: row.active,
      sortOrder: String(row.sortOrder),
      notes: row.notes ?? "",
    });
  }

  function onSave() {
    const numeric = Number(form.value);
    if (!Number.isFinite(numeric)) {
      toast.error(form.basis === "cost_multiplier" ? "Enter a cost multiplier." : "Enter a discount percent.");
      return;
    }
    const basisPoints = form.basis === "cost_multiplier"
      ? Math.round(numeric * 10000)
      : Math.round(numeric * 100);
    const volume = form.volumeDollars.trim();
    const volumeDollars = volume === "" ? null : Number(volume);
    if (volumeDollars != null && (!Number.isFinite(volumeDollars) || volumeDollars < 0)) {
      toast.error("Volume threshold must be empty or a dollar amount.");
      return;
    }
    save.mutate({
      id: form.id ?? undefined,
      tierName: form.tierName,
      basis: form.basis,
      basisPoints,
      volumeThresholdCents: volumeDollars == null ? null : Math.round(volumeDollars * 100),
      examplePlaceholder: form.examplePlaceholder,
      active: form.active,
      sortOrder: Number(form.sortOrder) || 0,
      notes: form.notes.trim() || null,
    });
  }

  if (seedRows == null && tiers.isLoading) {
    return <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-primary" /></div>;
  }
  if (seedRows == null && tiers.error) {
    return (
      <div className="space-y-3 py-8 text-center">
        <p className="text-destructive">Couldn’t load affiliate pricing tiers: {tiers.error.message}</p>
        <p className="text-sm text-muted-foreground">Run docs/sql/0234_affiliate_pricing_tiers.tidb.sql in the TiDB editor, then retry.</p>
        <Button variant="outline" size="sm" onClick={() => tiers.refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Affiliate pricing tiers</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A tier sets what an affiliate pays Cabinetdealz. Their own markup still applies on top for their customers. Example rows are placeholders, not live discounts.
          </p>
        </div>
        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              No tiers yet. The hand-run SQL seeds Tier 1, Tier 2, and Tier 3 as examples. You can also add one here.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => edit(row)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${form.id === row.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{row.tierName}</span>
                  {!row.active && <Badge variant="secondary">Inactive</Badge>}
                  {row.examplePlaceholder && <Badge variant="outline">Example</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{row.summary}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{selected ? "Edit tier" : "New tier"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tier-name">Name</Label>
            <Input id="tier-name" value={form.tierName} onChange={(event) => setForm({ ...form, tierName: event.target.value })} placeholder="Tier 1 (example)" />
          </div>
          <div className="space-y-1.5">
            <Label>How the cost is calculated</Label>
            <Select value={form.basis} onValueChange={(value) => setForm({ ...form, basis: value as Basis, value: value === "cost_multiplier" ? "1.00" : "0" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cost_multiplier">Cost multiplier</SelectItem>
                <SelectItem value="list_discount">Discount off list</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tier-value">{form.basis === "cost_multiplier" ? "Multiplier (1.00 = pay Cabinetdealz cost)" : "Percent off list"}</Label>
            <Input id="tier-value" inputMode="decimal" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tier-volume">Volume threshold (optional dollars)</Label>
            <Input id="tier-volume" inputMode="decimal" value={form.volumeDollars} onChange={(event) => setForm({ ...form, volumeDollars: event.target.value })} placeholder="Leave blank" />
            <p className="text-xs text-muted-foreground">Shown as assignment guidance. It does not change a price until you assign the tier.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tier-sort">Sort order</Label>
            <Input id="tier-sort" inputMode="numeric" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tier-notes">Notes</Label>
            <Textarea id="tier-notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="tier-example">Example placeholder</Label>
            <Switch id="tier-example" checked={form.examplePlaceholder} onCheckedChange={(checked) => setForm({ ...form, examplePlaceholder: checked })} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="tier-active">Active</Label>
            <Switch id="tier-active" checked={form.active} onCheckedChange={(checked) => setForm({ ...form, active: checked })} />
          </div>
          <div className="flex gap-2">
            <Button onClick={onSave} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save tier"}</Button>
            <Button variant="outline" onClick={() => setForm(EMPTY)}>New tier</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

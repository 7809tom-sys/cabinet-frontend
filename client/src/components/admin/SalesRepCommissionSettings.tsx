import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  defaultCommissionSettings,
  normalizeCommissionSettings,
  SALES_REP_FEE_TODO,
  type SalesRepCommissionSettings,
} from "@shared/salesRepCommission";
import { useMembershipProgramProcedures, type AffiliateSaleCommission } from "@/lib/membershipProgramProcedures";

function money(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function SalesRepCommissionSettings() {
  const { user } = useAuth();
  const api = useMembershipProgramProcedures();
  const utils = api.useUtils();
  const settingsQuery = api.salesRepProgram.commissionSettings.useQuery(undefined, { retry: false });
  const commissions = api.salesRepProgram.listAffiliateSaleCommissions.useQuery(undefined, { retry: false });
  const [draft, setDraft] = useState<SalesRepCommissionSettings>(defaultCommissionSettings());
  const [feeText, setFeeText] = useState("");

  useEffect(() => {
    if (!settingsQuery.data) return;
    setDraft({
      flatFeeUsd: settingsQuery.data.flatFeeUsd,
      residualRate: settingsQuery.data.residualRate,
      residualBase: "confirmed_order_gross",
      repFeeUsd: settingsQuery.data.repFeeUsd,
      repFeeCheckoutEnabled: settingsQuery.data.repFeeCheckoutEnabled,
    });
    setFeeText(settingsQuery.data.repFeeUsd == null ? "" : String(settingsQuery.data.repFeeUsd));
  }, [settingsQuery.data]);

  const save = api.salesRepProgram.saveCommissionSettings.useMutation({
    onSuccess: () => {
      toast.success("Commission settings saved. Past commissions keep the rate they were earned at.");
      void utils.salesRepProgram.commissionSettings.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const rows = commissions.data ?? [];
  const byRep = new Map<number, { name: string; flat: number; residual: number }>();
  for (const row of rows) {
    const current = byRep.get(row.repUserId) ?? { name: row.repName, flat: 0, residual: 0 };
    if (row.kind === "flat") current.flat += row.amountCents;
    if (row.kind === "residual") current.residual += row.amountCents;
    byRep.set(row.repUserId, current);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border p-4 space-y-4">
        <div>
          <h3 className="font-semibold">Affiliate-sale commission settings</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Seeded defaults are a $400 flat fee and 0.5% of the affiliate&apos;s confirmed order sales.
            Confirmed order sales are the same gross the affiliate commission uses: orders with status confirmed.
            Saving changes future sales only. Each commission keeps the rate from the day it was earned.
          </p>
        </div>
        {user?.role === "admin" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="flat-fee">Flat fee (dollars)</Label>
              <Input id="flat-fee" type="number" min={0} step="0.01" value={draft.flatFeeUsd} onChange={(event) => setDraft({ ...draft, flatFeeUsd: Number(event.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="residual-rate">Residual rate (0.005 = 0.5%)</Label>
              <Input id="residual-rate" type="number" min={0} max={1} step="0.0001" value={draft.residualRate} onChange={(event) => setDraft({ ...draft, residualRate: Number(event.target.value) })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Residual base</Label>
              <p className="text-sm">Confirmed order gross. This is not editable to a different base until Tom names one.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rep-fee">{SALES_REP_FEE_TODO}</Label>
              <Input id="rep-fee" type="number" min={0} step="0.01" placeholder="Leave blank" value={feeText} onChange={(event) => setFeeText(event.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.repFeeCheckoutEnabled}
                onChange={(event) => setDraft({ ...draft, repFeeCheckoutEnabled: event.target.checked })}
              />
              Turn on rep fee checkout once an amount is set
            </label>
            <div>
              <Button
                className="bg-[var(--color-navy)] text-white"
                disabled={save.isPending}
                onClick={() => {
                  const normalized = normalizeCommissionSettings({
                    ...draft,
                    repFeeUsd: feeText.trim() === "" ? null : Number(feeText),
                  });
                  if (!normalized.ok) {
                    toast.error(normalized.message);
                    return;
                  }
                  save.mutate(normalized.settings);
                }}
              >
                Save settings
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Flat and residual by rep</h3>
        {byRep.size === 0 ? (
          <p className="text-sm text-muted-foreground">No affiliate-sale commissions yet. A flat fee is recorded when a credited affiliate pays for membership. Residual lines follow that affiliate&apos;s confirmed orders.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {[...byRep.entries()].map(([id, totals]) => (
              <li key={id} className="rounded-lg border border-border px-3 py-2">
                {totals.name}: flat {money(totals.flat)} · residual {money(totals.residual)}
              </li>
            ))}
          </ul>
        )}
        {rows.length > 0 && (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {rows.map((row: AffiliateSaleCommission) => (
              <li key={row.id}>
                {row.repName} · {row.affiliateName} · {row.kind} · {money(row.amountCents)} · rate snapshot {row.kind === "flat" ? money(row.flatFeeCents) : `${(row.residualRateBps / 100).toFixed(2)}% of ${row.residualBase}`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

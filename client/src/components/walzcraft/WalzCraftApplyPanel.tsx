import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { doorForStyle, doorDisplayName } from "@shared/walzcraftDistributorMatches";
import { applyFill, planProfileFill, type FillPlan, type ProfileFormValues, type GlazeColorChoice } from "@shared/walzcraftProfileFill";

/**
 * Approve → preview (old → new) → Fill form → Undo. Only changes the in-dialog form state;
 * nothing persists until the admin presses the dialog's normal Save.
 */
export function WalzCraftApplyPanel({ style, values, onApply }: {
  style: { ourName: string; distributorName?: string | null; aliasName?: string | null };
  values: ProfileFormValues;
  onApply: (next: ProfileFormValues) => void;
}) {
  const door = useMemo(() => doorForStyle(style), [style]);
  const [plan, setPlan] = useState<FillPlan | null>(null);
  const [undo, setUndo] = useState<ProfileFormValues | null>(null);
  if (!door) return null;
  return (
    <div data-testid="walzcraft-apply-panel" className="mt-2 rounded-md border border-[#d7a46c] bg-[#fffdf9] p-2 text-xs text-[#244338]">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" className="h-7 bg-[#244338] text-[#fffdf9] hover:bg-[#244338]/90" data-testid="walzcraft-approve-fill" onClick={() => setPlan(planProfileFill(door, values))}>
          Approve &amp; preview form fill
        </Button>
        {undo && (
          <Button type="button" size="sm" variant="outline" className="h-7" data-testid="walzcraft-undo-fill" onClick={() => { onApply(undo); setUndo(null); }}>
            Undo fill
          </Button>
        )}
        <span className="text-muted-foreground">Fills this form only · nothing is saved until you press Save</span>
      </div>
      {plan && (
        <div data-testid="walzcraft-fill-preview" className="mt-2 space-y-1">
          <p className="font-semibold">{doorDisplayName(door)} ({door.distributor}) → WalzCraft {plan.catalog?.style ?? plan.styleCode ?? "—"}</p>
          {plan.changes.length === 0 ? <p>No field changes (form already matches the source).</p> : (
            <table className="w-full text-left">
              <thead><tr><th className="pr-2">Field</th><th className="pr-2">Old</th><th className="pr-2">New</th><th>Source</th></tr></thead>
              <tbody>
                {plan.changes.map((c) => (
                  <tr key={c.field} data-testid={`fill-row-${c.field}`}><td className="pr-2">{c.label}</td><td className="pr-2 text-muted-foreground">{c.from || "(empty)"}</td><td className="pr-2 font-medium">{c.to}</td><td className="text-muted-foreground">{c.source}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {plan.missing.length > 0 && (
            <ul data-testid="walzcraft-fill-missing" className="list-disc pl-4 text-muted-foreground">
              {plan.missing.map((m) => <li key={m}>{m} (left unchanged)</li>)}
            </ul>
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" className="h-7 bg-[#d7a46c] text-[#244338] hover:bg-[#d7a46c]/90" data-testid="walzcraft-confirm-fill" disabled={plan.changes.length === 0}
              onClick={() => { setUndo(values); onApply(applyFill(values, plan)); setPlan(null); }}>
              Fill form
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setPlan(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Glazing control (no backend column yet → localStorage, "not saved yet"). */
export function GlazingControl({ glazed, glazeColor, glazeColorOther, onChange }: {
  glazed: "" | "yes" | "no"; glazeColor: GlazeColorChoice; glazeColorOther: string;
  onChange: (next: { glazed: "" | "yes" | "no"; glazeColor: GlazeColorChoice; glazeColorOther: string }) => void;
}) {
  return (
    <div data-testid="glazing-control" className="space-y-1.5">
      <label className="text-sm font-medium" htmlFor="ed-glazed">Glazed <span className="text-xs font-normal text-muted-foreground">(not saved yet · this browser only)</span></label>
      <div className="flex flex-wrap items-center gap-2">
        <select id="ed-glazed" data-testid="glazed-select" className="h-9 rounded-md border px-2 text-sm" value={glazed} onChange={(e) => onChange({ glazed: e.target.value as "" | "yes" | "no", glazeColor, glazeColorOther })}>
          <option value="">—</option><option value="no">No</option><option value="yes">Yes</option>
        </select>
        {glazed === "yes" && (
          <>
            <label className="sr-only" htmlFor="ed-glaze-color">Glazing color</label>
            <select id="ed-glaze-color" data-testid="glaze-color-select" className="h-9 rounded-md border px-2 text-sm" value={glazeColor} onChange={(e) => onChange({ glazed, glazeColor: e.target.value as GlazeColorChoice, glazeColorOther })}>
              <option value="">Glazing color…</option><option value="gold">Gold</option><option value="black">Black</option><option value="other">Other</option>
            </select>
            {glazeColor === "other" && (
              <input data-testid="glaze-color-other" aria-label="Glazing color name" maxLength={40} className="h-9 w-32 rounded-md border px-2 text-sm" value={glazeColorOther} onChange={(e) => onChange({ glazed, glazeColor, glazeColorOther: e.target.value })} placeholder="Name" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

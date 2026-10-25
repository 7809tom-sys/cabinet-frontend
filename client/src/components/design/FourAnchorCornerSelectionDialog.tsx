import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  isFourAnchorBlindCornerOption,
  type AutoBuildCornerCandidate,
  type FourAnchorCornerChoice,
  type FourAnchorCornerSlot,
} from "@/lib/fourAnchorCornerStage";

export type FourAnchorCornerConfirmResult = { ok: true } | { ok: false; message: string };

type Props = {
  open: boolean;
  slots: readonly FourAnchorCornerSlot[];
  options: readonly AutoBuildCornerCandidate[];
  /** Test-only seed; ordinary Designer launches default to the largest eligible real corner. */
  initialChoices?: Record<string, FourAnchorCornerChoice>;
  onCancel: () => void;
  onConfirm: (choices: Record<string, FourAnchorCornerChoice>) => FourAnchorCornerConfirmResult;
};

function initialChoices(slots: readonly FourAnchorCornerSlot[], options: readonly AutoBuildCornerCandidate[]): Record<string, FourAnchorCornerChoice> {
  const defaultCorner = options[0] ?? null;
  return Object.fromEntries(slots.map((slot) => [slot.id, {
    cabinetId: defaultCorner?.id ?? null,
    ...(defaultCorner && isFourAnchorBlindCornerOption(defaultCorner) ? { blindPullIn: defaultCorner.pullMax ?? 6 } : {}),
  }]));
}

export function FourAnchorCornerSelectionDialog({ open, slots, options, initialChoices: seededChoices, onCancel, onConfirm }: Props) {
  const [choices, setChoices] = useState<Record<string, FourAnchorCornerChoice>>(() => seededChoices ?? initialChoices(slots, options));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setChoices(seededChoices ?? initialChoices(slots, options));
      setError(null);
    }
  }, [open, seededChoices, slots, options]);

  const optionById = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);
  const selectCorner = (slotId: string, value: string) => {
    const cabinetId = Number(value);
    const selected = optionById.get(cabinetId);
    setChoices((current) => ({
      ...current,
      [slotId]: {
        cabinetId,
        ...(selected && isFourAnchorBlindCornerOption(selected) ? { blindPullIn: selected.pullMax ?? 6 } : {}),
      },
    }));
    setError(null);
  };

  const confirm = () => {
    const result = onConfirm(choices);
    if (!result.ok) setError(result.message);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto" data-testid="four-anchor-corner-selection-dialog">
        <DialogHeader>
          <DialogTitle>Appliances are seated — choose corner cabinets</DialogTitle>
          <DialogDescription>
            A source-priced base-corner cabinet is required at every real Four-anchor corner. The largest eligible corner is selected first; change it to another source-priced corner when needed. A corner is never substituted into a straight run.
          </DialogDescription>
          <p className="text-sm text-muted-foreground" data-testid="four-anchor-corner-build-order">After your corners are placed, the builder fills the remaining runs with larger regular base cabinets, then adds aligned wall cabinets at your selected height.</p>
        </DialogHeader>
        <div className="grid gap-4">
          {slots.length === 0 ? (
            <p className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">This layout has no shared corner selected for the measured build. The remaining cabinet runs are ready to fill.</p>
          ) : slots.map((slot) => {
            const choice = choices[slot.id] ?? { cabinetId: options[0]?.id ?? null };
            const selected = choice.cabinetId == null ? null : optionById.get(choice.cabinetId);
            const isBlind = selected != null && isFourAnchorBlindCornerOption(selected);
            const minPull = selected?.pullMin ?? 3;
            const maxPull = selected?.pullMax ?? 6;
            return (
              <section key={slot.id} className="rounded-lg border p-3" data-testid={`four-anchor-corner-slot-${slot.id}`}>
                <Label htmlFor={`four-anchor-corner-${slot.id}`} className="font-semibold">{slot.label}</Label>
                <Select value={choice.cabinetId == null ? undefined : String(choice.cabinetId)} onValueChange={(value) => selectCorner(slot.id, value)}>
                  <SelectTrigger id={`four-anchor-corner-${slot.id}`} aria-label={`${slot.label} cabinet type`} className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {options.map((option) => <SelectItem key={option.id} value={String(option.id)}>{option.masterCode} — {option.description}</SelectItem>)}
                  </SelectContent>
                </Select>
                {isBlind && (
                  <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
                    <Label htmlFor={`four-anchor-corner-pull-${slot.id}`}>Blind-corner pull from wall</Label>
                    <Select value={String(choice.blindPullIn ?? maxPull)} onValueChange={(value) => setChoices((current) => ({ ...current, [slot.id]: { ...current[slot.id]!, blindPullIn: Number(value) } }))}>
                      <SelectTrigger id={`four-anchor-corner-pull-${slot.id}`} aria-label={`${slot.label} blind corner pull`} className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{[3, 4, 5, 6].filter((pull) => pull >= minPull && pull <= maxPull).map((pull) => <SelectItem key={pull} value={String(pull)}>{pull}″ pull</SelectItem>)}</SelectContent>
                    </Select>
                    <p className="mt-2 text-xs text-amber-950">The required 3″ blind-side filler stays fixed; this choice moves only the configured blind-corner cabinet within its allowed pull range.</p>
                  </div>
                )}
              </section>
            );
          })}
          {!options.length && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">The selected line has no source-priced base-corner cabinet available. Choose a different cabinet line; no corner will be guessed.</div>}
          {error && <div role="alert" data-testid="four-anchor-corner-error" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel measured build</Button>
          <Button type="button" data-testid="four-anchor-corner-confirm" onClick={confirm} disabled={options.length === 0 && slots.length > 0}>Place corners, fill bases, then walls</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

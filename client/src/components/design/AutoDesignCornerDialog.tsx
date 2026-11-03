import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  isAutoDesignBlindCornerOption,
  type AutoBuildCornerCandidate,
  type AutoDesignCornerChoice,
  type AutoDesignCornerSlot,
} from "@/lib/autoDesignCornerStage";
import { cornerChoiceGroups, cornerTypeOf, type CornerChoiceGroup, type CornerType } from "@/lib/autoDesignCornerChoice";

export type AutoDesignCornerConfirmResult = { ok: true } | { ok: false; message: string };

export type AutoDesignCornerFitView = {
  offeredIds: number[];
  selectedId: number | null;
  rejected: readonly { id: number; masterCode: string; reason: string }[];
  blockedMessage: string | null;
  fallbackNote: string | null;
};

type Props = {
  open: boolean;
  slots: readonly AutoDesignCornerSlot[];
  /** Base-corner rows from the selected line. */
  options: readonly AutoBuildCornerCandidate[];
  /**
   * Wall-corner rows from the selected line. Asked separately because a line's
   * diagonal upper is a different product from its diagonal base, and a line can
   * sell one without the other.
   */
  wallOptions?: readonly AutoBuildCornerCandidate[];
  /** Per-slot fit. Corners that miss the sink or the leg length are flagged and not offered. */
  fitBySlot?: Readonly<Record<string, AutoDesignCornerFitView>>;
  /** Test-only seed. There is no default corner: the homeowner picks. */
  initialChoices?: Record<string, AutoDesignCornerChoice>;
  onCancel: () => void;
  onConfirm: (choices: Record<string, AutoDesignCornerChoice>) => AutoDesignCornerConfirmResult;
};

/** A choice is a type AND a size. Nothing is preselected. */
type SlotPick = { type: CornerType | null; cabinetId: number | null };

function pickFrom(choice: AutoDesignCornerChoice | undefined, options: readonly AutoBuildCornerCandidate[]): SlotPick {
  if (!choice?.cabinetId) return { type: null, cabinetId: null };
  const candidate = options.find((option) => option.id === choice.cabinetId);
  return { type: candidate ? cornerTypeOf(candidate) : null, cabinetId: choice.cabinetId };
}

/**
 * Corner cabinets, chosen by the homeowner.
 *
 * One dropdown picks the TYPE the line actually sells, the next picks the SIZE
 * of that type. Nothing is assumed and nothing is defaulted: the confirm button
 * stays off until every corner has both answers. Plain homeowner wording only.
 */
export function AutoDesignCornerDialog({
  open,
  slots,
  options,
  wallOptions = [],
  fitBySlot,
  initialChoices: seededChoices,
  onCancel,
  onConfirm,
}: Props) {
  const baseGroups = useMemo(() => cornerChoiceGroups(options), [options]);
  const wallGroups = useMemo(() => cornerChoiceGroups(wallOptions), [wallOptions]);
  const [picks, setPicks] = useState<Record<string, SlotPick>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPicks(Object.fromEntries(slots.map((slot) => [slot.id, pickFrom(seededChoices?.[slot.id], options)])));
    setError(null);
  }, [open, seededChoices, slots, options]);

  const allOptions = useMemo(() => [...options, ...wallOptions], [options, wallOptions]);
  const optionById = useMemo(() => new Map(allOptions.map((option) => [option.id, option])), [allOptions]);

  /** The base-corner type/size answers, which is what the build places. */
  const choiceFor = (slotId: string): AutoDesignCornerChoice => {
    const pick = picks[slotId];
    const selected = pick?.cabinetId != null ? optionById.get(pick.cabinetId) : undefined;
    return {
      cabinetId: selected?.id ?? null,
      ...(selected && isAutoDesignBlindCornerOption(selected) ? { blindPullIn: selected.pullMax ?? 6 } : {}),
    };
  };

  const missing = slots.filter((slot) => picks[slot.id]?.cabinetId == null);
  const ready = missing.length === 0;
  const noBaseCorners = slots.length > 0 && baseGroups.length === 0;

  const confirm = () => {
    const choices = Object.fromEntries(slots.map((slot) => [slot.id, choiceFor(slot.id)]));
    const result = onConfirm(choices);
    if (!result.ok) setError(result.message);
  };

  const chooseType = (slotId: string, groups: readonly CornerChoiceGroup[], type: string) => {
    setPicks((current) => ({
      ...current,
      // Changing the type clears the size: the old SKU may not exist in the new
      // type. The size is always an explicit pick, never filled in for them.
      [slotId]: { type: type as CornerType, cabinetId: null },
    }));
    setError(null);
  };

  const chooseSize = (slotId: string, cabinetId: string) => {
    setPicks((current) => ({ ...current, [slotId]: { type: current[slotId]?.type ?? null, cabinetId: Number(cabinetId) } }));
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="auto-design-corner-selection-dialog">
        <DialogHeader>
          <DialogTitle>Choose your corner cabinets</DialogTitle>
          <DialogDescription>
            The appliances are in place. A corner needs a corner cabinet, and you pick which kind. Pick the type, then the size.
            We only show the ones this cabinet line actually makes.
          </DialogDescription>
          <p className="text-sm text-muted-foreground" data-testid="auto-design-corner-build-order">
            After the corners go in, the rest of the run is filled with real cabinets, then the upper cabinets.
          </p>
        </DialogHeader>
        <div className="grid gap-4">
          {slots.length === 0 ? (
            <p className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">This layout has no shared corner. The cabinet runs are ready to fill.</p>
          ) : slots.map((slot) => {
            const fit = fitBySlot?.[slot.id];
            const pick = picks[slot.id] ?? { type: null, cabinetId: null };
            const allowed = (group: CornerChoiceGroup) => (fit ? group.options.some((option) => fit.offeredIds.includes(option.id)) : true);
            const groups = baseGroups.filter(allowed);
            const group = groups.find((entry) => entry.type === pick.type) ?? null;
            const selected = pick.cabinetId != null ? optionById.get(pick.cabinetId) ?? null : null;
            const isBlind = selected != null && isAutoDesignBlindCornerOption(selected);
            const minPull = selected?.pullMin ?? 3;
            const maxPull = selected?.pullMax ?? 6;
            return (
              <section key={slot.id} className="rounded-lg border p-3" data-testid={`auto-design-corner-slot-${slot.id}`}>
                <Label className="font-semibold">{slot.label}</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`auto-design-corner-type-${slot.id}`} className="text-xs text-muted-foreground">Kind of corner cabinet</Label>
                    <Select value={pick.type ?? undefined} onValueChange={(value) => chooseType(slot.id, groups, value)}>
                      <SelectTrigger id={`auto-design-corner-type-${slot.id}`} data-testid={`auto-design-corner-type-${slot.id}`} aria-label={`${slot.label} kind of corner cabinet`}>
                        <SelectValue placeholder="Pick a kind" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((entry) => (
                          <SelectItem key={entry.type} value={entry.type} data-testid={`auto-design-corner-type-option-${entry.type}`}>
                            {entry.label} · {entry.options.length} size{entry.options.length === 1 ? "" : "s"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`auto-design-corner-size-${slot.id}`} className="text-xs text-muted-foreground">Size</Label>
                    <Select
                      value={pick.cabinetId == null ? undefined : String(pick.cabinetId)}
                      onValueChange={(value) => chooseSize(slot.id, value)}
                      disabled={!group}
                    >
                      <SelectTrigger id={`auto-design-corner-size-${slot.id}`} data-testid={`auto-design-corner-size-${slot.id}`} aria-label={`${slot.label} corner cabinet size`}>
                        <SelectValue placeholder={group ? "Pick a size" : "Pick a kind first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(group?.options ?? []).map((option) => (
                          <SelectItem key={option.id} value={String(option.id)} data-testid={`auto-design-corner-size-option-${option.id}`}>
                            {option.sizeLabel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {group && (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground" data-testid={`auto-design-corner-help-${slot.id}`}>
                    {group.help}
                  </p>
                )}
                {pick.cabinetId == null && (
                  <p className="mt-2 text-xs font-medium text-amber-900" data-testid={`auto-design-corner-pending-${slot.id}`}>
                    Pick a kind and a size for this corner. We will not guess one.
                  </p>
                )}
                {fit?.fallbackNote && <p className="mt-2 text-xs text-muted-foreground" data-testid={`auto-design-corner-fallback-${slot.id}`}>{fit.fallbackNote}</p>}
                {isBlind && (
                  <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
                    <Label htmlFor={`auto-design-corner-pull-${slot.id}`} className="text-xs">How far the door pulls out</Label>
                    <Select value={String(selected?.pullMax != null && pick.cabinetId === selected.id ? maxPull : maxPull)} onValueChange={(value) => setPicks((current) => ({ ...current, [slot.id]: { ...current[slot.id]!, cabinetId: current[slot.id]!.cabinetId! } }))}>
                      <SelectTrigger id={`auto-design-corner-pull-${slot.id}`} aria-label={`${slot.label} blind corner pull`} className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{[3, 4, 5, 6].filter((pull) => pull >= minPull && pull <= maxPull).map((pull) => <SelectItem key={pull} value={String(pull)}>{pull} inches</SelectItem>)}</SelectContent>
                    </Select>
                    <p className="mt-2 text-xs text-muted-foreground">The small filler on the blind side stays where it is; this only moves the door within the range the maker allows.</p>
                  </div>
                )}
              </section>
            );
          })}
          {wallGroups.length > 0 && (
            <section className="rounded-lg border border-border bg-muted/20 p-3" data-testid="auto-design-corner-upper-note">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Upper corners follow the same kind you pick below. This line makes {wallGroups.map((group) => group.label.toLowerCase()).join(", ")} for the upper run,
                and they will be matched to the corner you choose.
              </p>
            </section>
          )}
          {noBaseCorners && (
            <div role="status" data-testid="auto-design-corner-none" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              This cabinet line does not make a corner cabinet, so this corner cannot be filled from it. Choose a different line, or leave the corner open.
            </div>
          )}
          {error && <div role="alert" data-testid="auto-design-corner-error" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel the build</Button>
          <Button type="button" data-testid="auto-design-corner-confirm" onClick={confirm} disabled={!ready || noBaseCorners}>
            {ready ? "Place the corners, then fill the runs" : `Pick ${missing.length} corner${missing.length === 1 ? "" : "s"} first`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

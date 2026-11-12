import type { Dispatch, ReactNode } from "react";
import {
  DOOR_COLOR_SOURCES,
  DOOR_COLOR_SOURCE_LABELS,
  awaitingConfirm,
  effectiveDoorColorSource,
  needsConfirm,
  normalizeHex,
  type DoorColorSourceAction,
  type DoorColorSourceDraft,
  type DoorColorSourceOption,
} from "@shared/doorColorSourceSelection";

const OPTION_HINTS: Record<DoorColorSourceOption, string> = {
  "original-image": "The supplier's uploaded door photo. The truth, and the default.",
  "approved-ai-image": "The accepted AI render for this door.",
  "sherwin-williams": "A Sherwin-Williams stain or paint chip. Needs Confirm.",
  hex: "A hand-picked hex color. Needs Confirm.",
};

export type DoorColorSourceSelectorProps = {
  draft: DoorColorSourceDraft;
  dispatch: Dispatch<DoorColorSourceAction>;
  /** True when this style has an accepted AI render. */
  aiAvailable: boolean;
  /** Supplier photo shown for the Original image option. */
  supplierPhotoUrl?: string | null;
  /** Accepted AI render shown for the Approved AI image option. */
  aiImageUrl?: string | null;
  /** The existing Sherwin-Williams picker (WalzCraft wizard wheels), shown when that option is active. */
  sherwinPicker?: ReactNode;
  /** The existing hex picker (hex field, color input, photo eyedropper), shown when Hex is active. */
  hexPicker?: ReactNode;
  /** Opens the existing AI render tool. It is never started from here. */
  onOpenAiMaker?: () => void;
  now?: () => string;
};

/**
 * ONE door color source selector at the top of the door editor's color panel.
 * Four mutually exclusive options; the ones not selected are shaded. Sherwin-Williams
 * and Hex each have a small Confirm button; until it is pressed the door uses its
 * supplier photo. The existing pickers are reused underneath, not replaced, and the
 * AI render path is only linked, never triggered or changed.
 */
export function DoorColorSourceSelector({
  draft,
  dispatch,
  aiAvailable,
  supplierPhotoUrl,
  aiImageUrl,
  sherwinPicker,
  hexPicker,
  onOpenAiMaker,
  now = () => new Date().toISOString(),
}: DoorColorSourceSelectorProps) {
  const effective = effectiveDoorColorSource(draft.stored, aiAvailable ? { approvedVersionId: 1, approvedReferenceImageUrl: aiImageUrl || "accepted" } : null);
  const waiting = awaitingConfirm(draft);
  const canConfirm = (option: DoorColorSourceOption) => {
    if (draft.active !== option) return false;
    if (option === "hex") return Boolean(normalizeHex(draft.pendingHex));
    if (option === "sherwin-williams") return Boolean(draft.pendingSherwin);
    return false;
  };
  const confirm = () => dispatch({ type: "confirm", now: now() });

  return (
    <section data-testid="door-color-source-selector" className="space-y-3 rounded-lg border border-[#d4a75a]/70 bg-[#fffaf1] px-3 py-3">
      <div>
        <span className="text-xs font-semibold">Door color source</span>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pick one. The supplier photo is the default. Sherwin-Williams and Hex only count after Confirm.
        </p>
      </div>
      <div role="radiogroup" aria-label="Door color source" className="grid gap-2 sm:grid-cols-2">
        {DOOR_COLOR_SOURCES.map((option) => {
          const selected = draft.active === option;
          const confirmed = draft.stored?.source === option && needsConfirm(option);
          return (
            <div key={option} className="flex items-stretch gap-1">
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`door-color-source-${option}`}
                data-state={selected ? "on" : "off"}
                title={OPTION_HINTS[option]}
                onClick={() => dispatch({ type: "choose", option, aiAvailable, now: now() })}
                className={
                  "flex-1 rounded-md border px-2 py-1.5 text-left text-xs transition-colors " +
                  (selected
                    ? "border-[#1a2744] bg-white font-semibold text-[#1a2744] shadow-sm"
                    : "border-border bg-muted/60 text-muted-foreground opacity-60 hover:opacity-90")
                }
              >
                {DOOR_COLOR_SOURCE_LABELS[option]}
                {option === "original-image" ? " (default)" : ""}
                {confirmed ? " ✓" : ""}
              </button>
              {needsConfirm(option) && (
                <button
                  type="button"
                  data-testid={`door-color-source-${option}-confirm`}
                  disabled={!canConfirm(option)}
                  onClick={confirm}
                  title="That's the one"
                  className="shrink-0 rounded-md border border-emerald-600 px-2 text-[11px] font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground disabled:opacity-50"
                >
                  Confirm
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p data-testid="door-color-source-effective" className="text-xs">
        Door uses: <span className="font-semibold">{DOOR_COLOR_SOURCE_LABELS[effective.source]}</span>
        {draft.stored?.source === "hex" ? ` · ${draft.stored.hex}` : ""}
        {draft.stored?.source === "sherwin-williams" ? ` · ${draft.stored.color.label || draft.stored.color.code} · ${draft.stored.color.hex}` : ""}
        {waiting ? " (waiting for Confirm)" : ""}
      </p>
      {draft.notice && (
        <p data-testid="door-color-source-notice" className="text-xs text-amber-800">{draft.notice}</p>
      )}

      {draft.active === "original-image" && supplierPhotoUrl ? (
        <img data-testid="door-color-source-supplier-photo" src={supplierPhotoUrl} alt="Supplier door photo" className="h-24 w-auto rounded border object-contain" />
      ) : null}

      {draft.active === "approved-ai-image" && (
        <div data-testid="door-color-source-ai" className="space-y-1 text-xs">
          {aiAvailable && aiImageUrl ? (
            <img src={aiImageUrl} alt="Accepted AI render" className="h-24 w-auto rounded border object-contain" />
          ) : (
            <p data-testid="door-color-source-ai-missing">No accepted AI render exists for this door.</p>
          )}
          {onOpenAiMaker && (
            <button type="button" data-testid="door-color-source-open-ai-maker" onClick={onOpenAiMaker} className="rounded border px-2 py-1 text-xs font-semibold">
              {aiAvailable ? "Open the AI render tool" : "Make one with the AI render tool"}
            </button>
          )}
        </div>
      )}

      {draft.active === "sherwin-williams" && (
        <div data-testid="door-color-source-sherwin-picker" className="space-y-1">
          {draft.pendingSherwin && (
            <p className="text-xs">Picked {draft.pendingSherwin.label || draft.pendingSherwin.code} · {draft.pendingSherwin.hex}. Press Confirm to use it.</p>
          )}
          {sherwinPicker}
        </div>
      )}

      {draft.active === "hex" && (
        <div data-testid="door-color-source-hex-picker" className="space-y-1">{hexPicker}</div>
      )}
    </section>
  );
}

export default DoorColorSourceSelector;

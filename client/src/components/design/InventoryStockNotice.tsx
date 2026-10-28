import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { InventoryCabinetNotice, InventoryChoicePrompt, InventorySuggestion } from "@/lib/inventoryAlternatives";
import type { StockPromptChoice } from "@/lib/stockPrompt";

function suggestionLabel(suggestion: InventorySuggestion): string {
  if (suggestion.kind === "single") return suggestion.displayLabel ?? suggestion.candidate.masterCode;
  return suggestion.candidates.map((candidate) => candidate.masterCode).join(" + ");
}

function ChoiceButtons({
  prompt,
  disabled,
  onChoose,
}: {
  prompt: InventoryChoicePrompt;
  disabled?: boolean;
  onChoose: (choice: StockPromptChoice & { suggestion: InventorySuggestion | null }) => void;
}) {
  if (prompt.choices.length === 0) {
    return <p className="text-xs text-muted-foreground" data-testid="stock-prompt-none">None of the configured replacements are in stock. Nothing was changed.</p>;
  }
  return (
    <ul className="space-y-2">
      {prompt.choices.map((choice) => (
        <li key={choice.id}>
          <button
            type="button"
            disabled={disabled}
            data-testid={`stock-prompt-${choice.id}`}
            className="flex w-full items-center justify-between gap-2 rounded-md border border-[#1a2744]/20 bg-white px-2 py-2 text-left text-xs font-semibold text-[#1a2744] hover:bg-amber-50 disabled:opacity-50"
            onClick={() => onChoose(choice)}
          >
            <span>{choice.buttonLabel}</span>
            {choice.candidate ? <span className="font-mono text-[11px]">{choice.candidate.masterCode}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function InventorySuggestionList({
  notice,
  disabled,
  loading,
  alternativesUnlocked,
  onChoose,
  onSwap,
}: {
  notice: InventoryCabinetNotice;
  disabled?: boolean;
  loading?: boolean;
  alternativesUnlocked?: boolean;
  onChoose?: (choice: StockPromptChoice & { suggestion: InventorySuggestion | null }) => void;
  onSwap: (suggestion: InventorySuggestion) => void;
}) {
  if (notice.choicePrompt && !alternativesUnlocked) {
    return (
      <div data-testid="inventory-suggestions" className="space-y-2">
        <div>
          <p className="text-sm font-semibold text-[#1a2744]">{notice.masterCode} is out of stock</p>
          <p className="text-xs text-muted-foreground">Choose one option. Nothing changes until you do.</p>
        </div>
        <ChoiceButtons prompt={notice.choicePrompt} disabled={disabled} onChoose={onChoose ?? (() => undefined)} />
      </div>
    );
  }
  return (
    <div data-testid="inventory-suggestions" className="space-y-2">
      <div>
        <p className="text-sm font-semibold text-[#1a2744]">{notice.masterCode} is out of stock</p>
        <p className="text-xs text-muted-foreground">
          Choose a substitute. Nothing changes until you swap. Prices stay the catalog price of the cabinet you pick.
        </p>
      </div>
      {notice.suggestions.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-testid="inventory-no-alternatives">
          {loading
            ? "Checking this vendor's other door styles…"
            : "No in-stock alternative fits this opening without breaking the cabinet rules."}
        </p>
      ) : (
        <ul className="space-y-2">
          {notice.suggestions.map((suggestion) => (
            <li key={suggestion.id} data-testid={`inventory-suggestion-${suggestion.id}`} className="flex items-start justify-between gap-2 rounded-md border border-border bg-white px-2 py-1.5">
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold text-foreground">{suggestionLabel(suggestion)}</p>
                <p className="text-[11px] leading-snug text-muted-foreground">{suggestion.reason}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 shrink-0 px-2 text-[11px] font-semibold"
                disabled={disabled}
                data-testid={`inventory-swap-${suggestion.id}`}
                aria-label={`Swap ${notice.masterCode} for ${suggestionLabel(suggestion)}`}
                onClick={() => onSwap(suggestion)}
              >
                Swap
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Non-blocking warning for one out-of-stock cabinet. Renders nothing when stock is unknown. */
export function OutOfStockChoiceDialog({
  notice,
  phase,
  disabled,
  onChoose,
  onSwap,
  onBack,
  onDismiss,
  message,
  hiddenChoiceIds,
}: {
  notice: InventoryCabinetNotice | null;
  phase: "choose" | "readjust";
  disabled?: boolean;
  onChoose: (choice: StockPromptChoice & { suggestion: InventorySuggestion | null }) => void;
  onSwap: (suggestion: InventorySuggestion) => void;
  onBack: () => void;
  onDismiss: () => void;
  message?: string | null;
  hiddenChoiceIds?: readonly string[];
}) {
  if (!notice?.choicePrompt) return null;
  const prompt = hiddenChoiceIds?.length
    ? { ...notice.choicePrompt, choices: notice.choicePrompt.choices.filter((choice) => !hiddenChoiceIds.includes(choice.id)) }
    : notice.choicePrompt;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div role="dialog" aria-labelledby="stock-prompt-title" data-testid="stock-prompt-dialog" className="w-full max-w-md space-y-3 rounded-lg border border-amber-300 bg-white p-4 shadow-xl">
        <div>
          <h2 id="stock-prompt-title" className="text-base font-semibold text-[#1a2744]">{notice.masterCode} is out of stock</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {phase === "choose"
              ? "Choose one option before anything in the plan changes. Readjust slides this run by at most the jog limit and refills the opening with in-stock cabinets."
              : "Readjust this opening with an in-stock alternative. The run stays as drawn until you swap."}
          </p>
        </div>
        {message ? <p role="alert" data-testid="stock-prompt-fallback" className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-950">{message}</p> : null}
        {phase === "choose" ? (
          <ChoiceButtons prompt={prompt} disabled={disabled} onChoose={onChoose} />
        ) : notice.suggestions.length === 0 ? (
          <p className="text-xs text-muted-foreground" data-testid="stock-prompt-no-alternatives">No in-stock alternative fits this opening. {notice.masterCode} stays where it is.</p>
        ) : (
          <InventorySuggestionList notice={{ ...notice, choicePrompt: undefined }} disabled={disabled} onSwap={onSwap} />
        )}
        <div className="flex justify-end gap-2">
          {phase === "readjust" ? (
            <button type="button" className="rounded border border-border px-2 py-1 text-xs font-semibold" onClick={onBack}>Back</button>
          ) : null}
          <button type="button" data-testid="stock-prompt-dismiss" className="rounded border border-border px-2 py-1 text-xs font-semibold" onClick={onDismiss}>Not now</button>
        </div>
      </div>
    </div>
  );
}

export function InventoryStockBadge({
  notice,
  disabled,
  loading,
  alternativesUnlocked,
  onChoose,
  onSwap,
}: {
  notice: InventoryCabinetNotice | null;
  disabled?: boolean;
  loading?: boolean;
  alternativesUnlocked?: boolean;
  onChoose?: (choice: StockPromptChoice & { suggestion: InventorySuggestion | null }) => void;
  onSwap: (suggestion: InventorySuggestion) => void;
}) {
  if (!notice || notice.status !== "out_of_stock") return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="inventory-stock-badge"
          data-cabinet-uid={notice.uid}
          data-stock-status="out_of_stock"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950 hover:bg-amber-100"
          aria-haspopup="dialog"
          aria-label={`${notice.masterCode} is out of stock. Show alternatives.`}
        >
          <TriangleAlert className="h-3 w-3" aria-hidden="true" />
          Out of stock
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3" data-testid="inventory-suggestions-panel">
        <InventorySuggestionList notice={notice} disabled={disabled} loading={loading} alternativesUnlocked={alternativesUnlocked} onChoose={onChoose} onSwap={onSwap} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Design-level stock summary. Hidden when every cabinet is unknown or in stock
 * and simulation is off. Out-of-stock cabinets stay listed so the warning does
 * not depend on selecting each one.
 */
export function SinkBaseSubstitutionNotice({
  swaps,
  onUndo,
}: {
  swaps: readonly { uid: string; fromCode: string; toCode: string; orderNote: string }[];
  onUndo: (uid: string) => void;
}) {
  if (swaps.length === 0) return null;
  return (
    <div role="status" data-testid="sink-base-substitution-notice" className="flex w-full flex-wrap items-center gap-2 border-b border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
      {swaps.map((swap) => (
        <p key={swap.uid} className="flex flex-wrap items-center gap-2">
          <span>{swap.fromCode} was out of stock, so it was replaced with {swap.toCode}. {swap.orderNote}</span>
          <button type="button" className="rounded border border-amber-700 bg-white px-2 py-0.5 font-semibold text-amber-950" onClick={() => onUndo(swap.uid)}>Undo</button>
        </p>
      ))}
    </div>
  );
}

export function InventoryDesignStockControl({
  simulationActive,
  forcedOutOfStock,
  notices,
  disabled,
  loading,
  onSwap,
  onSelect,
  unlockedUids,
  onChoose,
}: {
  simulationActive: boolean;
  forcedOutOfStock: readonly string[];
  notices: readonly InventoryCabinetNotice[];
  disabled?: boolean;
  loading?: boolean;
  onSwap: (uid: string, suggestion: InventorySuggestion) => void;
  onSelect?: (uid: string) => void;
  unlockedUids?: ReadonlySet<string>;
  onChoose?: (uid: string, choice: StockPromptChoice & { suggestion: InventorySuggestion | null }) => void;
}) {
  if (!simulationActive && notices.length === 0) return null;
  if (notices.length === 0) {
    return (
      <Badge variant="outline" data-testid="inventory-simulation-chip" className="border-slate-300 text-[10px] font-medium text-slate-600">
        Stock simulation — none of the marked SKUs are in this design
      </Badge>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="inventory-design-stock"
          className="inline-flex items-center gap-1 rounded-md border border-amber-400 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-950 hover:bg-amber-100"
          aria-label={`${notices.length} out of stock cabinets. Show alternatives.`}
        >
          <TriangleAlert className="h-3 w-3" aria-hidden="true" />
          Out of stock ({notices.length})
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-96 w-96 space-y-3 overflow-y-auto p-3" data-testid="inventory-design-stock-panel">
        {simulationActive && (
          <p className="text-[11px] text-muted-foreground" data-testid="inventory-simulation-note">
            Stock simulation for {forcedOutOfStock.join(", ") || "the fixture"}. This is not a live vendor feed.
          </p>
        )}
        {notices.map((notice) => (
          <div key={notice.uid} className="space-y-2 border-b border-border pb-2 last:border-b-0 last:pb-0">
            <button
              type="button"
              className="text-left text-xs font-semibold text-[#1a2744] underline-offset-2 hover:underline"
              onClick={() => onSelect?.(notice.uid)}
            >
              Select {notice.masterCode}
            </button>
            <InventorySuggestionList
              notice={notice}
              disabled={disabled}
              loading={loading}
              alternativesUnlocked={unlockedUids?.has(notice.uid)}
              onChoose={(choice) => onChoose?.(notice.uid, choice)}
              onSwap={(suggestion) => onSwap(notice.uid, suggestion)}
            />
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

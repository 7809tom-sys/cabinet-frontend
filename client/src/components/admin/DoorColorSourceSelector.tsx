import type { Dispatch, ReactNode } from "react";
import {
  DOOR_COLOR_SOURCES,
  DOOR_COLOR_SOURCE_LABELS,
  PAINT_BRANDS,
  PAINT_BRAND_CODE_MAX,
  PAINT_BRAND_NAME_MAX,
  awaitingConfirm,
  effectiveDoorColorSource,
  needsConfirm,
  normalizeHex,
  paintBrandDraftForSelection,
  serializePaintBrandColor,
  type DoorColorSourceAction,
  type DoorColorSourceDraft,
  type DoorColorSourceOption,
  type PaintBrand,
  type PaintBrandDraft,
} from "@shared/doorColorSourceSelection";

const OPTION_HINTS: Record<DoorColorSourceOption, string> = {
  "original-image": "The supplier's uploaded door photo. The truth, and the default.",
  "approved-ai-image": "The accepted AI render for this door.",
  "sherwin-williams": "A Sherwin-Williams stain or paint chip. Needs Confirm.",
  hex: "A hand-picked hex color. Needs Confirm.",
};

type TileVisual =
  | { kind: "image"; url: string }
  | { kind: "color"; hex: string }
  | null;

export type DoorColorSourceSelectorProps = {
  draft: DoorColorSourceDraft;
  dispatch: Dispatch<DoorColorSourceAction>;
  /** True when 3D can use an AI picture: an accepted render or a saved Gemini picture. */
  aiAvailable: boolean;
  /** True when that picture is an accepted render (default). False: a saved Gemini picture. */
  aiAccepted?: boolean;
  /** Supplier photo shown for the Original image tile. */
  supplierPhotoUrl?: string | null;
  /** Saved approved AI picture shown for the Approved image tile (accepted render or official AI profile image). */
  aiImageUrl?: string | null;
  /** The Sherwin-Williams chip the swatch tile paints: the confirmed pick, or the pending one. */
  sherwinHex?: string | null;
  /** The hex the swatch tile paints: the confirmed pick, the pending one, or the current render hex. */
  hexSwatch?: string | null;
  /** The Sherwin-Williams picker, when the caller keeps it inside the tile editor. Null shows a hint pointing at the WalzCraft wizard. */
  sherwinPicker?: ReactNode;
  /** The existing hex picker (hex field, color input, photo eyedropper), shown when the Hex tile is selected. */
  hexPicker?: ReactNode;
  /** Opens the existing AI render tool. It is never started from here. */
  onOpenAiMaker?: () => void;
  /** Current render hex, used to prefill the paint-brand hex field. */
  hexSeed?: string | null;
  /** True when the caller already draws the surrounding card (the door color panel). */
  bare?: boolean;
  now?: () => string;
};

/**
 * ONE door color source selector at the top of the door editor's color panel:
 * four same-size square picture tiles in a single row — Original image (the
 * supplier photo, the default and the truth), Approved image (the accepted AI
 * render), a Sherwin-Williams swatch and a Hex swatch. The selected tile carries
 * a blue border and a check mark; an empty tile shows the striped placeholder
 * with a warning dot; and only the selected tile's editor opens below the row.
 *
 * Sherwin-Williams, Hex, and Paint brand each have a Confirm button; until it is
 * pressed the door keeps its current source. The hex box (input, swatch, and
 * eyedropper) and the paint-brand fields stay visible for every source tile.
 * The AI render path is only linked, never triggered or changed.
 */
export function DoorColorSourceSelector({
  draft,
  dispatch,
  aiAvailable,
  aiAccepted = true,
  supplierPhotoUrl,
  aiImageUrl,
  sherwinHex,
  hexSwatch,
  sherwinPicker,
  hexPicker,
  onOpenAiMaker,
  hexSeed,
  bare = false,
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
  const confirm = (source?: "hex" | "sherwin-williams" | "paint-brand") => dispatch({ type: "confirm", now: now(), source });
  const savedPaint = paintBrandDraftForSelection(draft.stored);
  const paintDraft: PaintBrandDraft = draft.pendingPaint ?? savedPaint;
  const paintReady = Boolean(serializePaintBrandColor({ ...paintDraft, chosenAt: now() }));
  const paintSwatch = normalizeHex(paintDraft.hex) ?? normalizeHex(hexSeed);
  const hexField = draft.pendingHex ?? (draft.stored?.source === "hex" ? draft.stored.hex : "");
  const hexReady = Boolean(normalizeHex(hexField));

  const tileVisual = (option: DoorColorSourceOption): TileVisual => {
    if (option === "original-image") {
      const url = (supplierPhotoUrl ?? "").trim();
      return url ? { kind: "image", url } : null;
    }
    if (option === "approved-ai-image") {
      // Any saved approved image shows here: the accepted run's picture or the official
      // AI profile picture. Whether the door can USE it is a separate rule (aiAvailable).
      const url = (aiImageUrl ?? "").trim();
      return url ? { kind: "image", url } : null;
    }
    const hex = normalizeHex(option === "hex" ? hexSwatch : sherwinHex);
    return hex ? { kind: "color", hex } : null;
  };

  const pendingNote = draft.active === "sherwin-williams" && draft.pendingSherwin
    ? `Picked ${draft.pendingSherwin.label || draft.pendingSherwin.code} · ${draft.pendingSherwin.hex}. Press Confirm to use it.`
    : null;

  return (
    <section data-testid="door-color-source-selector" className={bare ? "space-y-3" : "space-y-3 rounded-lg border border-[#d4a75a]/70 bg-[#fffaf1] px-3 py-3"}>
      <div>
        <span className="text-xs font-semibold">Door color source</span>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pick one picture. The supplier photo is the default. Sherwin-Williams and Hex only count after Confirm.
        </p>
      </div>

      <div role="radiogroup" aria-label="Door color source" className="grid grid-cols-4 gap-2">
        {DOOR_COLOR_SOURCES.map((option) => {
          const selected = draft.active === option;
          const confirmed = draft.stored?.source === option && needsConfirm(option);
          const visual = tileVisual(option);
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`door-color-source-${option}`}
              data-state={selected ? "on" : "off"}
              aria-label={DOOR_COLOR_SOURCE_LABELS[option]}
              title={OPTION_HINTS[option]}
              onClick={() => dispatch({ type: "choose", option, aiAvailable, now: now() })}
              className={
                "group relative flex flex-col items-stretch gap-1 rounded-md border-2 bg-white p-1 text-left transition-colors " +
                (selected
                  ? "border-[#2563eb] shadow-sm"
                  : "border-border opacity-60 hover:opacity-90")
              }
            >
              <span className="relative block aspect-square w-full overflow-hidden rounded border border-border/70 bg-[#f6f2e9]">
                {visual?.kind === "image" ? (
                  <img
                    data-testid={option === "original-image" ? "door-color-source-supplier-photo" : "door-color-source-approved-photo"}
                    src={visual.url}
                    alt={DOOR_COLOR_SOURCE_LABELS[option]}
                    className="h-full w-full object-cover"
                  />
                ) : visual?.kind === "color" ? (
                  <span
                    data-testid={`door-color-source-${option}-swatch`}
                    aria-label={`${DOOR_COLOR_SOURCE_LABELS[option]} ${visual.hex}`}
                    className="block h-full w-full"
                    style={{ backgroundColor: visual.hex }}
                  />
                ) : (
                  <span
                    data-testid={`door-color-source-${option}-empty`}
                    title={`${DOOR_COLOR_SOURCE_LABELS[option]} has no picture yet`}
                    className="flex h-full w-full items-center justify-center"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(135deg, #ece4d4 0 6px, #f8f4ec 6px 12px)",
                    }}
                  >
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
                  </span>
                )}
                {selected && needsConfirm(option) && canConfirm(option) && (
                  <span
                    data-testid={`door-color-source-${option}-pending`}
                    className="absolute left-1 top-1 rounded bg-amber-500 px-1 py-0.5 text-[9px] font-bold uppercase leading-none text-white shadow"
                  >
                    Confirm
                  </span>
                )}
                {selected && (
                  <span
                    data-testid={`door-color-source-${option}-check`}
                    aria-hidden="true"
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#2563eb] text-[11px] font-bold leading-none text-white shadow"
                  >
                    ✓
                  </span>
                )}
              </span>
              <span className="block truncate text-[11px] font-semibold leading-tight text-[#1a2744]">
                {DOOR_COLOR_SOURCE_LABELS[option]}
                {option === "original-image" ? " (default)" : ""}
                {confirmed ? " ✓" : ""}
              </span>
            </button>
          );
        })}
      </div>

      <p data-testid="door-color-source-effective" className="text-xs">
        Door uses: <span className="font-semibold">{draft.stored?.source === "paint-brand" ? "Paint brand" : DOOR_COLOR_SOURCE_LABELS[effective.source]}</span>
        {draft.stored?.source === "hex" ? ` · ${draft.stored.hex}` : ""}
        {draft.stored?.source === "sherwin-williams" ? ` · ${draft.stored.color.label || draft.stored.color.code} · ${draft.stored.color.hex}` : ""}
        {draft.stored?.source === "paint-brand" ? ` · ${draft.stored.brand} ${draft.stored.code} ${draft.stored.name} · ${draft.stored.hex}` : ""}
        {waiting ? " (waiting for Confirm)" : ""}
      </p>
      {draft.notice && (
        <p data-testid="door-color-source-notice" className="text-xs text-amber-800">{draft.notice}</p>
      )}

      {draft.active === "original-image" && (
        <p data-testid="door-color-source-original-note" className="text-xs text-muted-foreground">
          {supplierPhotoUrl
            ? "The supplier photo is the source of truth for this door. Click it above to view it full size."
            : "No supplier photo is uploaded for this door yet; upload one to make Original image usable."}
        </p>
      )}

      {draft.active === "approved-ai-image" && (
        <div data-testid="door-color-source-ai" className="space-y-1 text-xs">
          {aiAvailable && aiImageUrl && !aiAccepted ? (
            <p data-testid="door-color-source-ai-saved-used">The saved Gemini picture above is used for this door.</p>
          ) : aiAvailable && aiImageUrl ? (
            <p data-testid="door-color-source-ai-present">The approved AI render above is used for this door.</p>
          ) : aiImageUrl ? (
            <p data-testid="door-color-source-ai-saved">The saved AI picture above is not an accepted render yet, so the door keeps its supplier photo until one is accepted.</p>
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
        <div data-testid="door-color-source-sherwin-picker" className="space-y-2">
          {pendingNote && <p className="text-xs">{pendingNote}</p>}
          {sherwinPicker ?? (
            <p data-testid="door-color-source-sherwin-hint" className="text-xs text-muted-foreground">
              Pick the stain or paint chip in the WalzCraft wizard below, then press Confirm here.
            </p>
          )}
          <button
            type="button"
            data-testid="door-color-source-sherwin-williams-confirm"
            disabled={!canConfirm("sherwin-williams")}
            onClick={() => confirm("sherwin-williams")}
            title="That's the one"
            className="rounded-md border border-emerald-600 px-2 py-1 text-[11px] font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      )}

      <div data-testid="door-color-source-hex-picker" className="space-y-2">
        {hexPicker}
        <button
          type="button"
          data-testid="door-color-source-hex-confirm"
          disabled={!hexReady}
          onClick={() => confirm("hex")}
          title="That's the one"
          className="rounded-md border border-emerald-600 px-2 py-1 text-[11px] font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground disabled:opacity-50"
        >
          Confirm
        </button>
      </div>

      <div data-testid="door-color-source-paint-brand" className={"space-y-2 rounded-md border bg-white p-2 " + (draft.stored?.source === "paint-brand" ? "border-[#2563eb]" : "border-border")}>
        <p data-testid="door-color-source-paint-brand-open" className="text-left text-[11px] font-semibold text-[#1a2744]">
          Paint brand
          {draft.stored?.source === "paint-brand" ? " ✓" : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          Match from a colorimeter. Sherwin-Williams, Behr, Benjamin Moore, Valspar, PPG, or Clark + Kensington. Needs Confirm. The hex is what the 3D view paints.
        </p>
        <div className="space-y-2">
          <label className="block text-xs font-semibold" htmlFor="paint-brand-select">Paint brand</label>
          <select
            id="paint-brand-select"
            data-testid="paint-brand-select"
            value={paintDraft.brand}
            onChange={(event) => dispatch({ type: "pendingPaint", patch: { brand: event.target.value as PaintBrand | "" } })}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Choose a brand</option>
            {PAINT_BRANDS.map((brand) => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
          <label className="block text-xs font-semibold" htmlFor="paint-brand-code">Color code</label>
          <input
            id="paint-brand-code"
            data-testid="paint-brand-code"
            value={paintDraft.code}
            maxLength={PAINT_BRAND_CODE_MAX}
            placeholder="SW 7012"
            onChange={(event) => dispatch({ type: "pendingPaint", patch: { code: event.target.value } })}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          />
          <label className="block text-xs font-semibold" htmlFor="paint-brand-name">Color name</label>
          <input
            id="paint-brand-name"
            data-testid="paint-brand-name"
            value={paintDraft.name}
            maxLength={PAINT_BRAND_NAME_MAX}
            placeholder="Alabaster"
            onChange={(event) => dispatch({ type: "pendingPaint", patch: { name: event.target.value } })}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          />
          <label className="block text-xs font-semibold" htmlFor="paint-brand-hex">Hex</label>
          <div className="flex items-center gap-2">
            <input
              id="paint-brand-hex"
              data-testid="paint-brand-hex"
              value={paintDraft.hex}
              placeholder="#RRGGBB"
              onChange={(event) => dispatch({ type: "pendingPaint", patch: { hex: event.target.value } })}
              className="h-9 w-full rounded-md border border-input bg-background px-2 font-mono text-sm"
            />
            <input
              aria-label="Pick paint hex"
              type="color"
              value={paintSwatch ?? "#f2f0ea"}
              onChange={(event) => dispatch({ type: "pendingPaint", patch: { hex: event.target.value } })}
            />
          </div>
          <button
            type="button"
            data-testid="door-color-source-paint-brand-confirm"
            disabled={!paintReady}
            onClick={() => confirm("paint-brand")}
            title="That's the one"
            className="rounded-md border border-emerald-600 px-2 py-1 text-[11px] font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      </div>
    </section>
  );
}

export default DoorColorSourceSelector;

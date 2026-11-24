import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { DoorAuditDoorProfile, DoorAuditRenderInput } from "@/lib/doorRenderingAudit";
import {
  sampleDoorComparisonRenderInput,
  type SampleDoorComparisonStyle,
} from "@/lib/sampleDoorCompare";
import { paintForSlot, type FourSlot } from "@/lib/doorColorSourceSlots";
import type { CabinetSnapshotResult, SnapshotCabinetKind } from "@/lib/doorColorSourceCabinetSnapshots";
import { normalizeHex } from "@shared/doorColorSourceSelection";

/** Wide enough that a color pick feels live, short enough that typing a hex does not spawn a render per key. */
export const FOUR_SOURCE_RENDER_DEBOUNCE_MS = 250;

/**
 * The render input for one slot, built from the Designer's own comparison input
 * (`sampleDoorComparisonRenderInput`): same door profile math, sample-photo crop,
 * sheen and door lights as the 3D viewer. A color slot paints its exact hex with no
 * photo; a photo slot paints its picture. Colors are best effort: the paint is nudged
 * toward the picked hex under the render lights and a miss never refuses the picture.
 */
export function fourSourceRenderInput(input: {
  style: SampleDoorComparisonStyle;
  doorProfile: DoorAuditDoorProfile | null;
  slot: FourSlot | undefined;
}): DoorAuditRenderInput | null {
  const paint = paintForSlot(input.slot);
  const base = sampleDoorComparisonRenderInput({
    style: input.style,
    doorProfile: input.doorProfile,
    samplePhotoUrl: paint.kind === "photo" ? paint.url : null,
  });
  if (!base) return null;
  if (paint.kind === "hex") {
    return { ...base, renderHex: paint.hex, color: paint.hex, colorDeltaEMax: null, bestEffortColor: true };
  }
  return { ...base, bestEffortColor: true };
}

export type DoorColorSourceFourPreviewProps = {
  slots: FourSlot[];
  /** Called with the slot whose check mark was pressed. The caller saves it. */
  onChoose: (slot: FourSlot) => void;
  style: SampleDoorComparisonStyle;
  doorProfile: DoorAuditDoorProfile | null;
  /** True once the backend sources table answered, so all four slots can be filled at once. */
  allSlotsSaved: boolean;
  /** True while the choice is being written. */
  saving?: boolean;
  /** A saved confirmed color is locked: no slot can be checked, filled or confirmed. */
  locked?: boolean;
  /** An empty Hex tile: confirm this hex. The caller fills, checks and saves it. */
  onPickHex?: (hex: string) => void;
  /** An empty Sherwin-Williams tile: open the Sherwin-Williams picker. */
  onRequestSherwin?: () => void;
  /** A Sherwin-Williams chip picked in the wizard and not confirmed yet. */
  pendingSherwin?: { label: string; hex: string; finish?: "stain" | "paint" | null } | null;
  /** Confirm the pending Sherwin-Williams chip. The caller fills, checks and saves it. */
  onConfirmSherwin?: () => void;
  /**
   * Starting text for the Hex tile's draft: the picked or stored Sherwin-Williams chip's hex,
   * else the render hex. Only a draft: it fills the box until the admin types, and nothing is
   * confirmed or saved until "Use this hex" is pressed.
   */
  hexSeed?: string | null;
};

/** How many cabinet pictures stay in memory while colors are being tried. */
const SNAPSHOT_CACHE_LIMIT = 24;

const KIND_LABELS: Record<SnapshotCabinetKind, string> = { base: "Base cabinet", wall: "Wall cabinet" };

/**
 * Four tiles side by side (Original image, Approved AI / Gemini, Sherwin-Williams, Hex).
 * Each tile has a check mark and a small cabinet painted the way that source would paint
 * it, drawn in 3D (a base cabinet, drawer over door, or a wall cabinet). The checked tile
 * is the source the 3D Designer uses: pressing a check mark saves that choice through the
 * editor's existing save. All four cabinets come from one shared offscreen renderer, one
 * after another; a tile that cannot be drawn says why and the others still show. An empty
 * Hex or Sherwin-Williams tile lets you pick right there. No slot is ever filled or
 * changed by merely looking at it, and nothing here starts AI image generation.
 */
export function DoorColorSourceFourPreview({
  slots,
  onChoose,
  style,
  doorProfile,
  allSlotsSaved,
  saving = false,
  locked = false,
  onPickHex,
  onRequestSherwin,
  pendingSherwin = null,
  onConfirmSherwin,
  hexSeed = null,
}: DoorColorSourceFourPreviewProps) {
  const [kind, setKind] = useState<SnapshotCabinetKind>("base");
  // null = untouched: the box follows the seed. Once the admin types it is theirs and never overwritten.
  const [typedHex, setHexDraft] = useState<string | null>(null);
  const hexDraft = typedHex ?? normalizeHex(hexSeed) ?? "";
  const draftHex = normalizeHex(hexDraft);
  const pendingSherwinHex = normalizeHex(pendingSherwin?.hex);

  // What each tile shows and paints: an unconfirmed pick previews on its empty tile.
  const shown = useMemo(
    () =>
      slots.map((slot): FourSlot => {
        if (slot.source === "sherwin-williams" && !slot.filled && pendingSherwin && pendingSherwinHex) {
          return {
            ...slot,
            hex: pendingSherwinHex,
            filled: true,
            finishKind: pendingSherwin.finish ?? null,
            caption: `${pendingSherwin.label || pendingSherwinHex} · ${pendingSherwinHex} (not confirmed yet)`,
          };
        }
        if (slot.source === "hex" && !slot.filled && draftHex) {
          return { ...slot, hex: draftHex, filled: true, caption: `${draftHex} (not confirmed yet)` };
        }
        return slot;
      }),
    [slots, pendingSherwin, pendingSherwinHex, draftHex],
  );

  const jobs = useMemo(
    () =>
      shown.flatMap((slot) => {
        if (!slot.hex && !slot.imageUrl) return [];
        const input = fourSourceRenderInput({ style, doorProfile, slot });
        return input ? [{ source: slot.source, key: `${slot.source}|${kind}|${JSON.stringify(input)}`, input }] : [];
      }),
    [shown, style, doorProfile, kind],
  );
  const jobsKey = jobs.map((job) => job.key).join("\n");

  // Finished pictures by job key, so a tile redraws only when what it paints changes.
  const store = useRef(new Map<string, CabinetSnapshotResult>());
  const [, setTick] = useState(0);
  // Batches run one after another: the shared renderer is never opened twice at once.
  const lane = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const pending = jobs.filter((job) => !store.current.has(job.key));
    if (pending.length === 0) return undefined;
    let cancelled = false;
    const remember = (key: string, result: CabinetSnapshotResult) => {
      store.current.set(key, result);
      while (store.current.size > SNAPSHOT_CACHE_LIMIT) {
        const oldest = store.current.keys().next().value;
        if (oldest === undefined) break;
        store.current.delete(oldest);
      }
      if (!cancelled) setTick((value) => value + 1);
    };
    const timer = setTimeout(() => {
      lane.current = lane.current.then(async () => {
        if (cancelled) return;
        try {
          const loaded = await import("@/lib/doorColorSourceCabinetSnapshots");
          await loaded.snapshotCabinets(
            pending.map(({ key, input }) => ({ key, input })),
            kind,
            remember,
            () => cancelled,
          );
        } catch (error) {
          const message = error instanceof Error && error.message.trim() ? error.message.trim() : "The cabinet pictures could not be created in this browser.";
          for (const job of pending) if (!store.current.has(job.key)) remember(job.key, { error: message });
        }
      });
    }, FOUR_SOURCE_RENDER_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // jobsKey is the serialized job list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsKey]);

  const jobBySource = new Map(jobs.map((job) => [job.source, job]));
  const anyBusy = jobs.some((job) => !store.current.has(job.key));

  return (
    <section data-testid="door-four-source-preview" className="space-y-3 rounded-lg border border-[#d4a75a]/70 bg-white px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="text-xs font-semibold">All four color sources, side by side</span>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Check the one the 3D Designer should use. Each tile shows a cabinet in that source's color.
            {anyBusy ? " Drawing…" : ""}
          </p>
        </div>
        <div role="radiogroup" aria-label="Cabinet shown" className="flex overflow-hidden rounded-md border border-border text-[11px] font-semibold">
          {(["base", "wall"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={kind === option}
              data-testid={`four-source-kind-${option}`}
              onClick={() => setKind(option)}
              className={"px-2 py-1 " + (kind === option ? "bg-[#1a2744] text-white" : "bg-white text-[#1a2744]")}
            >
              {KIND_LABELS[option]}
            </button>
          ))}
        </div>
      </div>
      {!doorProfile && (
        <p data-testid="door-four-source-no-profile" role="alert" className="text-xs text-amber-900">
          This door style has no profile yet, so there is nothing to render.
        </p>
      )}
      {!allSlotsSaved && (
        <p data-testid="door-four-source-legacy-note" className="text-xs text-amber-800">
          Until the door color sources table is set up, the database keeps one choice per door, so only the slot in use shows its saved color. Original and Approved AI always show.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4" role="group" aria-label="Door color sources">
        {shown.map((slot) => {
          const job = jobBySource.get(slot.source);
          const result = job ? store.current.get(job.key) : undefined;
          return (
            <figure
              key={slot.source}
              data-testid={`four-source-slot-${slot.source}`}
              data-state={slot.checked ? "on" : "off"}
              className={
                "relative flex flex-col gap-1 rounded-md border-2 bg-white p-1 " +
                (slot.checked ? "border-[#2563eb] shadow-sm" : "border-border")
              }
            >
              <div className="relative block aspect-[4/3] w-full overflow-hidden rounded border border-border/70 bg-[#f6f2e9]">
                {slot.imageUrl ? (
                  <img data-testid={`four-source-image-${slot.source}`} src={slot.imageUrl} alt={slot.label} className="h-full w-full object-cover" />
                ) : slot.hex ? (
                  <span
                    data-testid={`four-source-swatch-${slot.source}`}
                    aria-label={`${slot.label} ${slot.hex}`}
                    className="block h-full w-full"
                    style={{ backgroundColor: slot.hex }}
                  />
                ) : (
                  <span
                    data-testid={`four-source-empty-${slot.source}`}
                    className="flex h-full w-full items-center justify-center"
                    style={{ backgroundImage: "repeating-linear-gradient(135deg, #ece4d4 0 6px, #f8f4ec 6px 12px)" }}
                  >
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
                  </span>
                )}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={slot.checked}
                  aria-label={`Use ${slot.label} for 3D`}
                  data-testid={`four-source-check-${slot.source}`}
                  disabled={!slot.checkable || saving || locked}
                  onClick={() => {
                    if (!slot.checked) onChoose(slot);
                  }}
                  title={slot.checkable ? `Use ${slot.label} for 3D` : slot.reason ?? slot.caption}
                  className={
                    "absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md border-2 shadow " +
                    (slot.checked ? "border-[#2563eb] bg-[#2563eb] text-white" : "border-slate-400 bg-white text-transparent") +
                    " disabled:cursor-not-allowed disabled:opacity-50"
                  }
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="flex aspect-[360/440] w-full items-center justify-center overflow-hidden rounded border border-border/70 bg-neutral-200">
                {result && "url" in result ? (
                  <img
                    data-testid={`four-source-cabinet-${slot.source}`}
                    src={result.url}
                    alt={`${KIND_LABELS[kind]} using ${slot.label}`}
                    className="h-full w-full object-contain"
                  />
                ) : result && "error" in result ? (
                  <p data-testid={`four-source-cabinet-error-${slot.source}`} role="alert" className="px-2 text-center text-[10px] leading-tight text-amber-900">
                    {result.error}
                  </p>
                ) : job ? (
                  <p data-testid={`four-source-cabinet-wait-${slot.source}`} className="px-2 text-center text-[10px] text-muted-foreground">
                    Drawing the cabinet…
                  </p>
                ) : (
                  <p data-testid={`four-source-cabinet-empty-${slot.source}`} className="px-2 text-center text-[10px] leading-tight text-muted-foreground">
                    Nothing to draw yet.
                  </p>
                )}
              </div>

              <figcaption className="space-y-0.5">
                <span className="block truncate text-[11px] font-semibold leading-tight text-[#1a2744]">{slot.label}</span>
                {slot.finishKind && (
                  <span data-testid={`four-source-finish-${slot.source}`} className="block text-[10px] font-semibold uppercase leading-tight tracking-wide text-[#1a2744]">
                    {slot.finishKind === "stain" ? "Stain" : "Paint"}
                  </span>
                )}
                <span data-testid={`four-source-caption-${slot.source}`} className="block text-[10px] leading-tight text-muted-foreground">
                  {slot.caption}
                </span>
                {!slot.checkable && slot.reason && (
                  <span data-testid={`four-source-reason-${slot.source}`} className="block text-[10px] leading-tight text-amber-800">
                    {slot.reason}
                  </span>
                )}
              </figcaption>

              {slot.source === "hex" && !slot.checkable && onPickHex && (
                <div className="flex flex-wrap items-center gap-1">
                  <input
                    data-testid="four-source-hex-input"
                    disabled={locked}
                    aria-label="Hex color for this door"
                    value={hexDraft}
                    onChange={(event) => setHexDraft(event.target.value)}
                    placeholder="#2a211c"
                    className="h-7 w-20 rounded border border-border px-1 font-mono text-[11px]"
                  />
                  <input
                    aria-label="Pick hex"
                    disabled={locked}
                    type="color"
                    value={draftHex ?? "#f2f0ea"}
                    onChange={(event) => setHexDraft(event.target.value)}
                    className="h-7 w-7 cursor-pointer rounded border border-border p-0"
                  />
                  <button
                    type="button"
                    data-testid="four-source-hex-use"
                    disabled={!draftHex || saving || locked}
                    onClick={() => {
                      if (!draftHex) return;
                      onPickHex(draftHex);
                      setHexDraft(null);
                    }}
                    className="rounded-md border border-emerald-600 px-2 py-1 text-[11px] font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground"
                  >
                    Use this hex
                  </button>
                </div>
              )}

              {slot.source === "sherwin-williams" && !slot.checkable && (pendingSherwin ? onConfirmSherwin : onRequestSherwin) && (
                pendingSherwin ? (
                  <button
                    type="button"
                    data-testid="four-source-sherwin-confirm"
                    disabled={saving || locked}
                    onClick={onConfirmSherwin}
                    className="rounded-md border border-emerald-600 px-2 py-1 text-[11px] font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground"
                  >
                    Confirm this chip
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="four-source-sherwin-pick"
                    disabled={locked}
                    onClick={onRequestSherwin}
                    className="rounded-md border border-[#1a2744] px-2 py-1 text-[11px] font-semibold text-[#1a2744]"
                  >
                    Pick a Sherwin-Williams color
                  </button>
                )
              )}
            </figure>
          );
        })}
      </div>
    </section>
  );
}

export default DoorColorSourceFourPreview;

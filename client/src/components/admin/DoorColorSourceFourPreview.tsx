import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { DoorAuditDoorProfile, DoorAuditRenderInput } from "@/lib/doorRenderingAudit";
import {
  sampleDoorComparisonErrorText,
  sampleDoorComparisonRenderInput,
  type SampleDoorComparisonStyle,
} from "@/lib/sampleDoorCompare";
import { paintForSlot, type FourSlot } from "@/lib/doorColorSourceSlots";

/** Wide enough that a color pick feels live, short enough that typing a hex does not spawn a render per key. */
export const FOUR_SOURCE_RENDER_DEBOUNCE_MS = 250;

/**
 * The render input for the checked slot, built from the Designer's own comparison
 * input (`sampleDoorComparisonRenderInput`): same door profile math, sample-photo
 * crop, sheen and door lights as the 3D viewer, via `createDoorAuditCapture`.
 * A color slot paints its exact hex with no photo; a photo slot paints its picture.
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
    // A very loose delta-E ceiling: the picked color is painted exactly as chosen and the
    // gate can never refuse the preview (it is a check, not a requirement, for an admin pick).
    return { ...base, renderHex: paint.hex, color: paint.hex, colorDeltaEMax: 1000 };
  }
  return base;
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
};

/**
 * Four pictures side by side (Original image, Approved AI / Gemini, Sherwin-Williams,
 * Hex), each with a check mark. The checked one is the source the 3D renderer uses:
 * pressing a check mark saves that choice through the editor's existing save, and the
 * door render underneath redraws with it. No slot is ever filled or changed by merely
 * looking at it, and nothing here starts AI image generation.
 */
export function DoorColorSourceFourPreview({ slots, onChoose, style, doorProfile, allSlotsSaved, saving = false }: DoorColorSourceFourPreviewProps) {
  const checkedSlot = slots.find((slot) => slot.checked);
  const renderInput = useMemo(
    () => fourSourceRenderInput({ style, doorProfile, slot: checkedSlot }),
    [style, doorProfile, checkedSlot],
  );
  // Re-render only when what is painted changes, not on every parent render.
  const renderKey = renderInput ? JSON.stringify(renderInput) : "";

  const [renderUrl, setRenderUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The capture is a WebGL context: never more than one at a time.
  const requestRef = useRef(0);

  useEffect(() => {
    if (!renderInput) {
      setRenderUrl(null);
      setRenderError("This door style has no profile yet, so there is nothing to render.");
      return undefined;
    }
    const request = requestRef.current + 1;
    requestRef.current = request;
    let cancelled = false;
    const timer = setTimeout(() => {
      setBusy(true);
      setRenderError(null);
      void (async () => {
        try {
          const loaded = await import("@/lib/doorAuditDoorRender");
          const session = loaded.createDoorAuditCapture();
          try {
            const png = await session.capture(renderInput);
            if (cancelled || requestRef.current !== request) return;
            setRenderUrl(`data:image/png;base64,${png.base64}`);
          } finally {
            session.dispose();
          }
        } catch (error) {
          if (cancelled || requestRef.current !== request) return;
          setRenderUrl(null);
          setRenderError(sampleDoorComparisonErrorText(error));
        } finally {
          if (!cancelled && requestRef.current === request) setBusy(false);
        }
      })();
    }, FOUR_SOURCE_RENDER_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // renderKey is the serialized renderInput.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderKey]);

  return (
    <section data-testid="door-four-source-preview" className="space-y-3 rounded-lg border border-[#d4a75a]/70 bg-white px-3 py-3">
      <div>
        <span className="text-xs font-semibold">All four color sources, side by side</span>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Check the one the 3D door should use. The render below shows the checked one.
        </p>
        {!allSlotsSaved && (
          <p data-testid="door-four-source-legacy-note" className="mt-0.5 text-xs text-amber-800">
            Until the door color sources table is set up, the database keeps one choice per door, so only the slot in use shows its saved color. Original and Approved AI always show.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4" role="group" aria-label="Door color sources">
        {slots.map((slot) => (
          <figure
            key={slot.source}
            data-testid={`four-source-slot-${slot.source}`}
            data-state={slot.checked ? "on" : "off"}
            className={
              "relative flex flex-col gap-1 rounded-md border-2 bg-white p-1 " +
              (slot.checked ? "border-[#2563eb] shadow-sm" : "border-border")
            }
          >
            <div className="relative block aspect-square w-full overflow-hidden rounded border border-border/70 bg-[#f6f2e9]">
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
                disabled={!slot.checkable || saving}
                onClick={() => {
                  if (!slot.checked) onChoose(slot);
                }}
                title={slot.checkable ? `Use ${slot.label} for 3D` : slot.caption}
                className={
                  "absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md border-2 shadow " +
                  (slot.checked ? "border-[#2563eb] bg-[#2563eb] text-white" : "border-slate-400 bg-white text-transparent") +
                  " disabled:cursor-not-allowed disabled:opacity-50"
                }
              >
                <Check className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <figcaption className="space-y-0.5">
              <span className="block truncate text-[11px] font-semibold leading-tight text-[#1a2744]">{slot.label}</span>
              <span data-testid={`four-source-caption-${slot.source}`} className="block text-[10px] leading-tight text-muted-foreground">
                {slot.caption}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>

      <figure data-testid="door-four-source-render" className="space-y-1">
        <figcaption className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          3D door · {checkedSlot ? checkedSlot.label : "Original image"}
          {busy ? " · drawing…" : ""}
        </figcaption>
        <div className="flex min-h-[12rem] items-center justify-center overflow-hidden rounded-xl border border-border bg-neutral-200">
          {renderUrl ? (
            <img data-testid="door-four-source-render-image" src={renderUrl} alt={`3D door using ${checkedSlot?.label ?? "Original image"}`} className="max-h-72 w-auto object-contain" />
          ) : renderError ? (
            <p data-testid="door-four-source-render-error" role="alert" className="px-3 py-6 text-center text-xs text-amber-900">{renderError}</p>
          ) : (
            <p data-testid="door-four-source-render-wait" className="px-3 py-6 text-xs text-muted-foreground">Drawing the 3D door…</p>
          )}
        </div>
      </figure>
    </section>
  );
}

export default DoorColorSourceFourPreview;

/**
 * Side-by-side sample-door comparison.
 *
 * The owner's complaint: the sample door photograph in the right panel is a
 * ~40px thumbnail, so it is impossible to judge whether the render matches the
 * photograph. The comparison view shows both, large, at the same size.
 *
 * Two rules shape this module:
 *
 * 1. The sample photograph is the SAME image the Designer already shows. It is
 *    `paletteFinishSwatch` in `DesignTool` (the accepted render, then the door
 *    record's own sample, then the catalog thumbnail) falling back to the 3D
 *    viewer's own door texture. Nothing new is hard-coded here.
 * 2. The "Your design" pane is a real render of that door, not a screenshot of
 *    the room. It reuses `createDoorAuditCapture` — the door renderer the app
 *    already ships (same profile math, same sample-photo crop, same finish
 *    sheen, same door lights) — so it is the same door the 3D viewer draws, at
 *    a size where colour and grain are judgeable.
 */
import type { DoorAuditDoorProfile, DoorAuditRenderInput } from "@/lib/doorRenderingAudit";

/** Two equal panes on desktop; stacked on a phone so neither becomes a sliver. */
export const SAMPLE_DOOR_COMPARE_GRID_CLASS = "grid min-h-0 flex-1 gap-3 md:grid-cols-2";

/** Each pane grows as tall as the dialog allows and keeps the image inside it. */
export const SAMPLE_DOOR_COMPARE_PANE_CLASS =
  "flex min-h-[min(38dvh,22rem)] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-neutral-50";

/**
 * The capture renders a flat white-painted door on a white background, so a
 * light pane makes it read as empty. The render pane uses the capture's own
 * mid-grey stage colour and an inner ring so the door edges are visible even
 * for a white finish.
 */
export const SAMPLE_DOOR_COMPARE_RENDER_PANE_CLASS =
  "flex min-h-[min(38dvh,22rem)] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-neutral-200";

export const SAMPLE_DOOR_COMPARE_IMAGE_CLASS = "h-full w-full object-contain";

export const SAMPLE_DOOR_COMPARE_PANE_LABELS = {
  sample: "Sample door",
  design: "Your design",
} as const;

/**
 * The sample photograph the Designer already displays, in the app's own
 * priority order: the accepted render, then the door record's sample, then the
 * 3D viewer's door texture. Returns null when the style has no photograph at
 * all, so the pane can say so instead of rendering a broken image.
 */
export function sampleDoorComparisonPhotoUrl(input: {
  /** The accepted render / door sample the finish swatch already resolved. */
  paletteSwatchUrl?: string | null;
  /** The texture the 3D viewer maps onto the door face. */
  threeDDoorSampleUrl?: string | null;
}): string | null {
  const preferred = input.paletteSwatchUrl?.trim();
  if (preferred) return preferred;
  const threeD = input.threeDDoorSampleUrl?.trim();
  return threeD || null;
}

export type SampleDoorComparisonStyle = {
  styleId?: number | null;
  name?: string | null;
  code?: string | null;
  distributorName?: string | null;
  /** Everything the finish resolver reads (renderHex, color, finish, woodSpecies…). */
  identity?: Record<string, unknown> | null;
};

/**
 * Maps the Designer's active style onto the door capture's input.
 *
 * `renderHex` is deliberately null here and only here: the audit path uses a
 * stored render hex as a colour gate and THROWS on a mismatch, which would be a
 * broken comparison view for a customer. With no gate, the capture paints the
 * exact resolved finish hex the 3D viewer uses.
 */
export function sampleDoorComparisonRenderInput(input: {
  style: SampleDoorComparisonStyle | null | undefined;
  /** The resolved catalog door profile the 3D viewer builds its fronts from. */
  doorProfile: DoorAuditDoorProfile | null | undefined;
  /** The sample photograph, from `sampleDoorComparisonPhotoUrl`. */
  samplePhotoUrl: string | null;
  /** The Designer's own exposure setting so both panes share one light level. */
  renderExposure?: number | null;
}): DoorAuditRenderInput | null {
  const profile = input.doorProfile;
  if (!profile) return null;
  const style = input.style ?? {};
  const styleId = Number(style.styleId);
  const identity = { ...(style.identity ?? {}) };
  // The identity carries the style's own `renderHex`. Drop it here: the colour
  // gate would compare against it and refuse to render on a mismatch.
  delete (identity as Record<string, unknown>).renderHex;
  return {
    styleId: Number.isFinite(styleId) && styleId > 0 ? styleId : 0,
    name: (style.name ?? "").trim() || "This door",
    code: style.code ?? null,
    distributorName: style.distributorName ?? null,
    samplePhotoUrl: input.samplePhotoUrl,
    color: null,
    renderHex: null,
    renderExposure: input.renderExposure ?? null,
    // No colour gate: a customer comparison must always produce a picture.
    colorDeltaEMax: null,
    sourceFingerprint: "designer-sample-door-compare",
    doorProfile: profile,
    // The finish resolver reads these straight off the style.
    ...identity,
  } as DoorAuditRenderInput;
}

/** Human wording for a failed capture, so the pane is never silently blank. */
export function sampleDoorComparisonErrorText(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message) return "The door render could not be created in this browser.";
  return message;
}

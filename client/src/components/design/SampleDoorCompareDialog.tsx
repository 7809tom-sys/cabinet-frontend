import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Maximize2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resolveDoorStyleAppearance } from "@/lib/doorStyleAppearance";
import {
  SAMPLE_DOOR_COMPARE_GRID_CLASS,
  SAMPLE_DOOR_COMPARE_IMAGE_CLASS,
  SAMPLE_DOOR_COMPARE_PANE_CLASS,
  SAMPLE_DOOR_COMPARE_PANE_LABELS,
  SAMPLE_DOOR_COMPARE_RENDER_PANE_CLASS,
  sampleDoorComparisonErrorText,
  sampleDoorComparisonRenderInput,
  type SampleDoorComparisonStyle,
} from "@/lib/sampleDoorCompare";
import type { DoorAuditDoorProfile } from "@/lib/doorRenderingAudit";

export type SampleDoorCompareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  styleName: string;
  /** The same photograph the Designer's finish swatch shows. */
  samplePhotoUrl: string | null;
  /** The resolved catalog profile the 3D viewer builds this style's fronts from. */
  doorProfile: DoorAuditDoorProfile | null;
  style: SampleDoorComparisonStyle | null;
  renderExposure?: number | null;
  /** Shown under the sample pane so the comparison names its exact product. */
  distributorName?: string | null;
};

/**
 * Large side-by-side comparison of the sample door photograph and the render
 * of that same door. Two equal panes on a desktop, stacked on a phone.
 *
 * The render pane reuses `createDoorAuditCapture`, the door renderer the app
 * already ships for approvals: same profile math, same sample-photo crop into
 * the raised panel, same finish sheen, same door lights. It renders one 18×30
 * door front-on at 720×1080, so colour and grain are judgeable instead of the
 * ~40px thumbnail the right panel shows.
 */
export function SampleDoorCompareDialog({
  open,
  onOpenChange,
  styleName,
  samplePhotoUrl,
  doorProfile,
  style,
  renderExposure = null,
  distributorName = null,
}: SampleDoorCompareDialogProps) {
  const [renderUrl, setRenderUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The capture is a WebGL context; never more than one at a time.
  const requestRef = useRef(0);

  const renderInput = useMemo(
    () => sampleDoorComparisonRenderInput({ style, doorProfile, samplePhotoUrl, renderExposure }),
    [style, doorProfile, samplePhotoUrl, renderExposure],
  );
  // Shown as a chip so a photo-only finish still names the exact colour.
  const finishHex = useMemo(() => {
    try {
      return resolveDoorStyleAppearance(style?.identity as never).finishHex;
    } catch {
      return null;
    }
  }, [style]);

  useEffect(() => {
    if (!open) {
      setRenderUrl(null);
      setRenderError(null);
      setBusy(false);
      requestRef.current += 1;
      return undefined;
    }
    if (!renderInput) {
      setRenderUrl(null);
      setRenderError("This door style has no profile yet, so there is nothing to render.");
      return undefined;
    }
    const request = requestRef.current + 1;
    requestRef.current = request;
    setBusy(true);
    setRenderError(null);
    setRenderUrl(null);
    let cancelled = false;
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
        setRenderError(sampleDoorComparisonErrorText(error));
      } finally {
        if (!cancelled && requestRef.current === request) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, renderInput]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="sample-door-compare-dialog"
        className="flex h-[min(92dvh,900px)] w-[calc(100vw-0.75rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:w-[96vw]"
      >
        <DialogHeader className="shrink-0 border-b px-4 py-3 text-left">
          <DialogTitle className="flex items-center gap-2 font-serif text-base">
            <Maximize2 className="h-4 w-4 shrink-0 text-[#a87f33]" aria-hidden="true" />
            Compare the sample door with your design
          </DialogTitle>
          <DialogDescription className="text-xs">
            {styleName}
            {distributorName ? ` · ${distributorName}` : ""}
            {finishHex ? (
              <span className="ml-1 inline-flex items-center gap-1 align-middle">
                <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full border border-black/20" style={{ backgroundColor: finishHex }} />
                <span className="font-mono text-[10px] text-muted-foreground">{finishHex}</span>
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className={`${SAMPLE_DOOR_COMPARE_GRID_CLASS} overflow-y-auto p-3`}>
          <figure data-testid="sample-door-compare-sample" className={SAMPLE_DOOR_COMPARE_PANE_CLASS}>
            <figcaption className="shrink-0 border-b bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {SAMPLE_DOOR_COMPARE_PANE_LABELS.sample}
            </figcaption>
            <div className="min-h-0 flex-1 p-2">
              {samplePhotoUrl ? (
                <img
                  src={samplePhotoUrl}
                  alt={`${styleName} sample door photograph`}
                  data-testid="sample-door-compare-sample-image"
                  className={SAMPLE_DOOR_COMPARE_IMAGE_CLASS}
                  decoding="async"
                />
              ) : (
                <p data-testid="sample-door-compare-no-photo" className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
                  This door style has no sample photograph on file. The render on the right is built from the style's profile and finish.
                </p>
              )}
            </div>
          </figure>

          <figure data-testid="sample-door-compare-render" className={SAMPLE_DOOR_COMPARE_RENDER_PANE_CLASS}>
            <figcaption className="shrink-0 border-b bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {SAMPLE_DOOR_COMPARE_PANE_LABELS.design}
            </figcaption>
            <div className="relative min-h-0 flex-1 p-2">
              {renderUrl ? (
                <img
                  src={renderUrl}
                  alt={`3D render of the ${styleName} door`}
                  data-testid="sample-door-compare-render-image"
                  className="h-full w-full rounded-md object-contain ring-1 ring-inset ring-black/10"
                  decoding="async"
                />
              ) : renderError ? (
                <p data-testid="sample-door-compare-render-error" role="alert" className="flex h-full items-center justify-center px-4 text-center text-xs text-amber-900">
                  {renderError}
                </p>
              ) : (
                <p data-testid="sample-door-compare-render-busy" role="status" className="flex h-full items-center justify-center gap-2 px-4 text-center text-xs text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Rendering this door…
                </p>
              )}
              {busy && renderUrl ? <span className="sr-only">Rendering</span> : null}
            </div>
          </figure>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t px-3 py-2">
          <p className="min-w-0 text-[10px] leading-snug text-muted-foreground">
            The render uses this door style's profile, sample crop, and finish under the Designer's own door lighting. Both panes are the same 18×30 inch door.
          </p>
          <button
            type="button"
            data-testid="sample-door-compare-close"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-white px-3 text-xs font-semibold text-[#1a2744] transition hover:bg-muted active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2744]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

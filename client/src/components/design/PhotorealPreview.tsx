import { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Sparkles, Loader2, Download, RotateCcw, X, ImageOff, Camera, Sun } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Camera framing options exposed in the preview modal. */
export type CameraAngle = "three-quarter" | "straight-on" | "wide";
/** Lighting mood options exposed in the preview modal. */
export type TimeOfDay = "daylight" | "golden-hour" | "evening";

/**
 * Input the caller assembles from the current design state. This mirrors the
 * `design.photorealPreview` server mutation input schema.
 */
export type PhotorealSceneInput = {
  roomWidthFt: number;
  roomDepthFt: number;
  ceilingFt?: number;
  finishName?: string;
  doorStyle?: string;
  secondFinishName?: string;
  countertop?: string;
  hardware?: string;
  flooring?: string;
  backsplash?: string;
  sink?: string;
  faucet?: string;
  wallSummaries?: string[];
  cabinetWalls?: string[];
  appliances?: string[];
  layoutType?:
    | "one-wall"
    | "galley"
    | "L-shaped"
    | "U-shaped"
    | "peninsula"
    | "multi-wall";
  hasIsland?: boolean;
  notes?: string;
  /** Every visible saved-plan material/product reference, keyed to plan items. */
  materialManifest?: Array<{
    id: string;
    role: string;
    label: string;
    itemIds: string[];
    referenceUrl: string;
  }>;
  /** Exact visible inputs that prevent generation when no saved reference exists. */
  missingMaterialInputs?: string[];
  cameraAngle?: CameraAngle;
  timeOfDay?: TimeOfDay;
};

type Props = {
  /** Whether the trigger button is enabled (e.g. false when nothing placed). */
  disabled?: boolean;
  /**
   * Lazily builds the scene input at click time from the LIVE design state.
   * Returning null aborts (e.g. no cabinets placed).
   */
  buildScene: () => PhotorealSceneInput | null;
  /**
   * Trigger presentation:
   * - "toolbar": desktop pill button (hidden on mobile)
   * - "menu": full-width row for the mobile "More" menu
   * - "headless": render NO trigger; the dialog is driven entirely by
   *   `controlledOpen` / `onControlledOpenChange` (used by the mobile bottom bar).
   */
  variant?: "toolbar" | "menu" | "headless";
  /** Localized label for the trigger (defaults to "AI Preview"). */
  label?: string;
  /** When provided, the dialog open state is controlled by the parent. */
  controlledOpen?: boolean;
  onControlledOpenChange?: (open: boolean) => void;
  /**
   * Optional gate for the self-owned triggers (toolbar/menu). Return false to
   * veto opening (e.g. the design isn't render-ready) — the caller is expected
   * to surface its own message. Ignored for the headless variant.
   */
  onBeforeOpen?: () => boolean;
};

const ANGLE_OPTIONS: { value: CameraAngle; label: string }[] = [
  { value: "three-quarter", label: "Angle view" },
  { value: "straight-on", label: "Straight on" },
  { value: "wide", label: "Wide room" },
];

const LIGHT_OPTIONS: { value: TimeOfDay; label: string }[] = [
  { value: "daylight", label: "Daylight" },
  { value: "golden-hour", label: "Golden hour" },
  { value: "evening", label: "Evening" },
];

/**
 * AI Photoreal Preview: renders a magazine-quality photo of the user's current
 * kitchen design via the `design.photorealPreview` mutation. The heavy lifting
 * (prompt building + image generation) happens server-side; this component only
 * assembles the scene input, exposes a couple of photographic controls (camera
 * angle + lighting), shows a loading state (generation can take 10-30s), and
 * displays / lets the user download the result.
 */
export function PhotorealPreview({
  disabled,
  buildScene,
  variant = "toolbar",
  label = "AI Preview",
  controlledOpen,
  onControlledOpenChange,
  onBeforeOpen,
}: Props) {
  const isControlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = useCallback(
    (v: boolean) => {
      if (isControlled) onControlledOpenChange?.(v);
      else setUncontrolledOpen(v);
    },
    [isControlled, onControlledOpenChange],
  );
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [angle, setAngle] = useState<CameraAngle>("three-quarter");
  const [light, setLight] = useState<TimeOfDay>("daylight");

  const gen = trpc.design.photorealPreview.useMutation({
    onSuccess: (data) => {
      setImageUrl(data.url);
    },
    onError: (err) => {
      toast.error(err.message || "Could not generate a preview. Please try again.");
    },
  });

  const run = useCallback(
    (opts?: { cameraAngle?: CameraAngle; timeOfDay?: TimeOfDay }) => {
      const scene = buildScene();
      if (!scene) {
        toast.error("Place at least one cabinet before generating a preview.");
        return;
      }
      setImageUrl(null);
      gen.mutate({
        ...scene,
        cameraAngle: opts?.cameraAngle ?? angle,
        timeOfDay: opts?.timeOfDay ?? light,
      });
    },
    [buildScene, gen, angle, light]
  );

  const onOpen = useCallback(() => {
    if (onBeforeOpen && !onBeforeOpen()) return;
    setOpen(true);
    run();
  }, [run, onBeforeOpen]);

  // When the parent drives the dialog open (mobile bottom bar), kick off a
  // render on the transition to open — mirrors what onOpen does for the
  // self-owned triggers, without duplicating the click handler.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current && isControlled) {
      run();
    }
    wasOpenRef.current = open;
  }, [open, isControlled, run]);

  // Changing a control re-renders immediately with the new setting so the
  // controls feel live rather than requiring a separate "apply" click.
  const pickAngle = useCallback(
    (value: CameraAngle) => {
      setAngle(value);
      if (!gen.isPending) run({ cameraAngle: value });
    },
    [gen.isPending, run]
  );
  const pickLight = useCallback(
    (value: TimeOfDay) => {
      setLight(value);
      if (!gen.isPending) run({ timeOfDay: value });
    },
    [gen.isPending, run]
  );

  const download = useCallback(() => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `cabinet-dealz-preview-${Date.now()}.png`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [imageUrl]);

  const loading = gen.isPending;

  return (
    <>
      {variant === "headless" ? null : variant === "toolbar" ? (
        <button
          type="button"
          onClick={onOpen}
          disabled={disabled}
          title="Generate a photorealistic AI preview of your design"
          className="hidden lg:flex items-center gap-1.5 rounded-lg border border-[#1a2744]/25 bg-gradient-to-r from-[#1a2744] to-[#2d3f66] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:from-muted disabled:to-muted disabled:text-muted-foreground disabled:shadow-none"
        >
          <Sparkles className="h-3.5 w-3.5" /> {label}
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          disabled={disabled}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Sparkles className="h-5 w-5 shrink-0 text-[#1a2744]" />
          <span className="font-medium">{label}</span>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden gap-0">
          <DialogHeader className="px-6 pt-6 pb-3">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-[#1a2744]" /> AI Photoreal Preview
            </DialogTitle>
            <DialogDescription>
              A magazine-quality render of your current design. This is an illustrative concept, not an exact
              construction drawing.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-6">
            {/* Photographic controls */}
            <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="flex rounded-lg border border-border p-0.5">
                  {ANGLE_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      disabled={loading}
                      onClick={() => pickAngle(o.value)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                        angle === o.value ? "bg-[#1a2744] text-white" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Sun className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="flex rounded-lg border border-border p-0.5">
                  {LIGHT_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      disabled={loading}
                      onClick={() => pickLight(o.value)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                        light === o.value ? "bg-[#1a2744] text-white" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative w-full aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted/40">
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[#1a2744]" />
                  <div className="text-sm font-medium text-foreground">Rendering your kitchen…</div>
                  <div className="text-xs text-muted-foreground max-w-xs">
                    This usually takes 10–30 seconds. Hang tight while we stage the lighting.
                  </div>
                </div>
              )}

              {!loading && gen.isError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                  <ImageOff className="h-8 w-8 text-muted-foreground" />
                  <div className="text-sm font-medium text-foreground">We couldn't generate a preview.</div>
                  <div className="text-xs text-muted-foreground max-w-xs">
                    {gen.error?.message || "Something went wrong. Please try again."}
                  </div>
                </div>
              )}

              {!loading && imageUrl && (
                <img
                  src={imageUrl}
                  alt="AI photoreal preview of your kitchen design"
                  className="h-full w-full object-cover"
                />
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} className="bg-background">
                <X className="mr-1.5 h-4 w-4" /> Close
              </Button>
              <Button variant="outline" onClick={() => run()} disabled={loading} className="bg-background">
                <RotateCcw className="mr-1.5 h-4 w-4" /> Generate Again
              </Button>
              <Button onClick={download} disabled={loading || !imageUrl} className="bg-[#1a2744] hover:bg-[#2d3f66]">
                <Download className="mr-1.5 h-4 w-4" /> Download
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

export type TabletPreviewMode = "portrait" | "landscape";

const FRAMES: Record<TabletPreviewMode, { width: number; height: number; label: string }> = {
  portrait: { width: 820, height: 1180, label: "iPad portrait 820×1180" },
  landscape: { width: 1180, height: 820, label: "iPad landscape 1180×820" },
};

/**
 * Desktop-only testing frame. The iframe's own viewport is the tablet size, so
 * Designer breakpoints (including hidden toolbar controls) match a real tablet.
 */
export function TabletPreviewOverlay({
  mode,
  onMode,
  onClose,
}: {
  mode: TabletPreviewMode;
  onMode: (mode: TabletPreviewMode) => void;
  onClose: () => void;
}) {
  const frame = FRAMES[mode];
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 1440 : window.innerWidth,
    height: typeof window === "undefined" ? 900 : window.innerHeight,
  }));
  useEffect(() => {
    const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  // The query flag only marks this document as the preview. Orientation changes
  // the iframe's own viewport, so Designer breakpoints update without a reload
  // and the email gate is not shown again.
  const src = useMemo(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tabletPreview", "1");
    return url.toString();
  }, []);
  const scale = Math.min(1, (viewport.width - 48) / frame.width, (viewport.height - 132) / frame.height);

  return (
    <div
      data-testid="tablet-preview-overlay"
      className="fixed inset-0 z-[80] flex flex-col bg-[#1a2744]/80"
      role="dialog"
      aria-modal="true"
      aria-label="Tablet preview"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-3 text-white">
        <p className="mr-2 text-sm font-semibold">Tablet preview</p>
        <span className="text-xs text-white/80">Testing control — this is the layout a customer sees on a tablet.</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            data-testid="tablet-preview-portrait"
            variant={mode === "portrait" ? "default" : "outline"}
            className={mode === "portrait" ? "bg-white text-[#1a2744] hover:bg-white/90" : "border-white/40 bg-transparent text-white hover:bg-white/10"}
            onClick={() => onMode("portrait")}
          >
            Portrait 820×1180
          </Button>
          <Button
            type="button"
            size="sm"
            data-testid="tablet-preview-landscape"
            variant={mode === "landscape" ? "default" : "outline"}
            className={mode === "landscape" ? "bg-white text-[#1a2744] hover:bg-white/90" : "border-white/40 bg-transparent text-white hover:bg-white/10"}
            onClick={() => onMode("landscape")}
          >
            Landscape 1180×820
          </Button>
          <Button type="button" size="sm" data-testid="tablet-preview-close" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10" onClick={onClose}>
            Back to desktop
          </Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 justify-center overflow-auto px-4 pb-4">
        <div style={{ width: frame.width * scale, height: frame.height * scale }} className="relative shrink-0">
          <iframe
            title={`Tablet preview of the Designer (${frame.label})`}
            data-testid="tablet-preview-frame"
            src={src}
            style={{
              width: frame.width,
              height: frame.height,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            className="absolute left-0 top-0 border border-white/30 bg-white shadow-2xl"
          />
        </div>
      </div>
    </div>
  );
}

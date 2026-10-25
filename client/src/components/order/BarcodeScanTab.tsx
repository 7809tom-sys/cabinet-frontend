import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Barcode, Camera, CameraOff, Loader2, Plus, ScanLine, Trash2, X,
} from "lucide-react";
import {
  addScan, setScanQty, removeScan, totalScanQty, type ScanItem,
} from "@/lib/scanList";
import { useLanguage } from "@/contexts/LanguageContext";

type ResultPayload = {
  lines: unknown[];
  matchedCount: number;
  unmatchedCount: number;
};

// Minimal typing for the experimental BarcodeDetector API (not in lib.dom yet).
type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
};
type BarcodeDetectorCtor = {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

function getBarcodeDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return ctor ?? null;
}

export function BarcodeScanTab({ onResult }: { onResult: (r: ResultPayload) => void }) {
  const { t } = useLanguage();
  const [items, setItems] = useState<ScanItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [lastScan, setLastScan] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const lastHitRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const supported = getBarcodeDetectorCtor() !== null;

  const match = trpc.orders.matchCodes.useMutation({
    onSuccess: (r) => onResult(r as ResultPayload),
    onError: (e) => toast.error(t("bc_match_err"), { description: e.message }),
  });

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  // Clean up camera on unmount.
  useEffect(() => () => stopCamera(), [stopCamera]);

  const handleHit = useCallback((raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const now = Date.now();
    // Debounce the same code for 1.5s so a held barcode doesn't spam +1s.
    if (lastHitRef.current.code === code && now - lastHitRef.current.at < 1500) return;
    lastHitRef.current = { code, at: now };
    setItems((prev) => addScan(prev, code, 1));
    setLastScan(code);
    toast.success(t("bc_scanned", { code }));
    // Best-effort haptic feedback on mobile.
    try { navigator.vibrate?.(40); } catch { /* no-op */ }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    const Ctor = getBarcodeDetectorCtor();
    if (!Ctor) {
      setCameraError(t("bc_no_support"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      detectorRef.current = new Ctor({
        formats: ["code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "qr_code", "itf"],
      });
      setScanning(true);

      const tick = async () => {
        const video = videoRef.current;
        const detector = detectorRef.current;
        if (!video || !detector || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        try {
          const hits = await detector.detect(video);
          if (hits.length > 0) handleHit(hits[0].rawValue);
        } catch {
          /* transient detect errors are fine; keep looping */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera unavailable";
      setCameraError(
        /denied|permission/i.test(msg)
          ? t("bc_perm_denied")
          : t("bc_cam_err", { msg })
      );
      stopCamera();
    }
  }, [handleHit, stopCamera]);

  function addManual() {
    const code = manualCode.trim();
    if (!code) return;
    setItems((prev) => addScan(prev, code, 1));
    setManualCode("");
  }

  function submit() {
    if (items.length === 0) return;
    stopCamera();
    match.mutate({ items: items.map((i) => ({ code: i.code, qty: i.qty })) });
  }

  const total = totalScanQty(items);

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      {/* Camera viewport */}
      <div className="space-y-3">
        {scanning ? (
          <div className="relative overflow-hidden rounded-lg border border-border bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="w-full max-h-72 object-contain" playsInline muted />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-24 w-3/4 rounded-lg border-2 border-[var(--color-gold)]/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
            <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
              <ScanLine className="h-3.5 w-3.5 animate-pulse" /> {t("bc_point")}
            </div>
            <Button
              variant="secondary" size="icon"
              className="absolute top-2 right-2 h-8 w-8"
              onClick={stopCamera}
              aria-label={t("bc_stop_camera")}
            >
              <X className="h-4 w-4" />
            </Button>
            {lastScan && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-gold)] px-3 py-1 text-xs font-medium text-[var(--color-navy)]">
                {t("bc_last", { code: lastScan })}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={startCamera}
            disabled={!supported}
            className="w-full flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border py-12 text-center transition-colors enabled:hover:border-[var(--color-gold)] enabled:hover:bg-muted/40 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-navy)]/10">
              {supported ? <Camera className="h-6 w-6 text-[var(--color-navy)]" /> : <CameraOff className="h-6 w-6 text-muted-foreground" />}
            </div>
            <div>
              <p className="font-medium">{supported ? t("bc_start_scanner") : t("bc_not_available")}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {supported ? t("bc_start_sub") : t("bc_not_available_sub")}
              </p>
            </div>
          </button>
        )}

        {cameraError && (
          <p className="text-sm text-destructive">{cameraError}</p>
        )}
      </div>

      {/* Manual add (always available, and the fallback when no camera) */}
      <div className="flex gap-2">
        <Input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManual(); } }}
          placeholder={t("bc_add_by_hand_ph")}
          className="font-mono"
          aria-label={t("bc_add_aria")}
        />
        <Button variant="outline" onClick={addManual} disabled={!manualCode.trim()} className="gap-1 shrink-0">
          <Plus className="h-4 w-4" /> {t("bc_add")}
        </Button>
      </div>

      {/* Running scan list */}
      {items.length > 0 ? (
        <div className="rounded-lg border border-border divide-y divide-border">
          <div className="flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>{t("bc_summary", { c: items.length, cs: items.length === 1 ? "" : "s", u: total, us: total === 1 ? "" : "s" })}</span>
            <button className="hover:text-destructive" onClick={() => setItems([])}>{t("bc_clear_all")}</button>
          </div>
          {items.map((it, idx) => (
            <div key={`${it.code}-${idx}`} className="flex items-center gap-3 px-3 py-2">
              <Barcode className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-mono text-sm flex-1 truncate">{it.code}</span>
              <Input
                type="number" min={1} max={999} value={it.qty}
                onChange={(e) => setItems((prev) => setScanQty(prev, idx, parseInt(e.target.value, 10) || 1))}
                className="h-8 w-16 text-center"
                aria-label={t("bc_qty_for", { code: it.code })}
              />
              <Button
                variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => setItems((prev) => removeScan(prev, idx))}
                aria-label={t("bc_remove", { code: it.code })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-2">
          {t("bc_empty")}
        </p>
      )}

      <Button
        onClick={submit}
        disabled={match.isPending || items.length === 0}
        className="w-full bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90 gap-2"
      >
        {match.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Barcode className="h-4 w-4" />}
        {match.isPending ? t("bc_matching") : t("bc_match_n", { n: items.length || "", s: items.length === 1 ? "" : "s" })}
      </Button>
    </div>
  );
}

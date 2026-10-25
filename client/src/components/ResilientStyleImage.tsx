import { useState } from "react";
import { DoorStyleSwatch, type DoorStyleLike } from "./DoorStyleSwatch";

/** A unique URL bypasses a browser's cached failure without replacing the source image. */
export function styleImageRetryUrl(src: string, nonce: string): string {
  if (/^(data:|blob:)/i.test(src)) return src;
  return `${src}${src.includes("?") ? "&" : "?"}cd-image-retry-nonce=${encodeURIComponent(nonce)}`;
}

/** The public platform redirects /manus-storage to a generic-type CDN before Express. */
export function doorStylePhotoUrl(src: string): string {
  const match = /^\/manus-storage\/media-library\/([A-Za-z0-9][A-Za-z0-9_.-]*)$/.exec(src);
  return match ? `/api/door-style-photo/${match[1]}` : src;
}

interface ResilientStyleImageProps {
  src: string | null | undefined;
  alt: string;
  style: DoorStyleLike;
  className: string;
  loading?: "eager" | "lazy";
  decoding?: "async" | "sync" | "auto";
  unavailableLabel?: string;
  onFallback?: () => void;
}

export function ResilientStyleImage({ src, alt, style, className, loading, decoding, unavailableLabel, onFallback }: ResilientStyleImageProps) {
  const [failed, setFailed] = useState<{ src: string; attempts: number; nonce: string } | null>(null);
  const attempts = src && failed?.src === src ? failed.attempts : 0;
  const swatchStyle: DoorStyleLike = { ...style, thumbnailImageUrl: null, doorSampleImageUrl: null };
  const photoSrc = src ? doorStylePhotoUrl(src) : "";

  if (!src || attempts >= 2) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/40 p-3" data-testid="style-image-fallback">
        <DoorStyleSwatch style={swatchStyle} className="max-h-[80%] w-auto max-w-[65%] drop-shadow-sm" />
        {unavailableLabel && <span className="text-center text-xs font-medium text-muted-foreground">{unavailableLabel}</span>}
      </div>
    );
  }

  return (
    <img
      src={attempts === 1 ? styleImageRetryUrl(photoSrc, failed!.nonce) : src}
      alt={alt}
      loading={loading}
      decoding={decoding}
      className={className}
      onError={() => {
        setFailed({ src, attempts: attempts + 1, nonce: failed?.src === src ? failed.nonce : `${Date.now()}-${Math.random().toString(36).slice(2)}` });
        if (attempts >= 1) onFallback?.();
      }}
    />
  );
}

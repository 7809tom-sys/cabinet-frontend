import { useState } from "react";
import { CabinetImage } from "@/components/CabinetImage";
import type { CabinetLike } from "@/lib/cabinetGraphics";
import { catalogMediaRecoveryUrl, newCatalogMediaRetryNonce } from "@/lib/catalogMediaImage";

interface CatalogSkuImageProps {
  src: string;
  alt: string;
  cabinet: CabinetLike;
  finishColor?: string;
  className?: string;
}

/** The supplier image is authoritative. Never substitute another SKU's photograph. */
export function CatalogSkuImage({ src, alt, cabinet, finishColor, className }: CatalogSkuImageProps) {
  const [failure, setFailure] = useState<{ src: string; attempts: number; retryUrl: string | null } | null>(null);
  const attempts = failure?.src === src ? failure.attempts : 0;
  if (attempts >= 2) {
    return (
      <div className="relative flex h-full w-full items-center justify-center" data-testid="catalog-sku-illustration-fallback">
        <CabinetImage cabinet={cabinet} finishColor={finishColor} className="h-full w-auto max-w-full object-contain" />
        <span className="absolute bottom-0 left-1 rounded bg-white/90 px-1 text-[10px] text-slate-700">Catalog illustration</span>
      </div>
    );
  }
  return (
    <img
      src={attempts === 1 ? failure!.retryUrl ?? src : src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        if (attempts === 0) {
          const retryUrl = catalogMediaRecoveryUrl(src, newCatalogMediaRetryNonce());
          setFailure({ src, attempts: retryUrl ? 1 : 2, retryUrl });
        } else setFailure({ src, attempts: 2, retryUrl: failure?.retryUrl ?? null });
      }}
    />
  );
}

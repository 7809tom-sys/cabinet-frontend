import { useState } from "react";
import { CabinetDrawing } from "@/components/CabinetDrawing";
import { cabinetAltText, isSquareDoubleDoorBaseEnd, type CabinetLike } from "@/lib/cabinetGraphics";
import { catalogMediaRecoveryUrl, newCatalogMediaRetryNonce } from "@/lib/catalogMediaImage";

interface CabinetImageProps {
  cabinet: CabinetLike;
  /** Optional door/finish color applied only to the code-drawn fallback. */
  finishColor?: string;
  className?: string;
  /**
   * An explicitly approved distributor-line image for the selected detail view.
   * Catalog cards continue to use the canonical master image so a finish never
   * changes the structural product identity.
   */
  overrideImageUrl?: string | null;
}

/**
 * Displays the approved neutral catalog drawing assigned to the canonical master
 * code. When a detail view has an explicitly approved distributor override, that
 * selected-line drawing takes precedence. The deterministic CabinetDrawing library
 * remains the dependable fallback for a missing or failed catalog asset; it does
 * not replace approved product artwork.
 */
export function CabinetImage({ cabinet, finishColor, className, overrideImageUrl }: CabinetImageProps) {
  // BEC24's legacy thumbnail shows a diagonal/quarter-octagon that contradicts
  // its owner-approved square double-door end shape. Only this code falls back
  // to the shared deterministic drawing; other catalog art is untouched.
  const url = isSquareDoubleDoorBaseEnd(cabinet)
    ? null
    : overrideImageUrl?.trim() || cabinet.catalogImageUrl?.trim() || null;
  const [failed, setFailed] = useState<{ url: string; attempts: number; retryUrl: string | null } | null>(null);
  const attempts = url && failed?.url === url ? failed.attempts : 0;
  if (!url || attempts >= 2) {
    return <CabinetDrawing cabinet={cabinet} finishColor={finishColor} className={className} />;
  }

  return (
    <img
      src={attempts === 1 ? failed!.retryUrl ?? url : url}
      alt={cabinetAltText(cabinet)}
      className={className}
      loading="lazy"
      onError={() => {
        if (attempts === 0) {
          const retryUrl = catalogMediaRecoveryUrl(url, newCatalogMediaRetryNonce());
          setFailed({ url, attempts: retryUrl ? 1 : 2, retryUrl });
        } else {
          setFailed({ url, attempts: 2, retryUrl: failed?.retryUrl ?? null });
        }
      }}
      style={{ objectFit: "contain" }}
    />
  );
}

export default CabinetImage;

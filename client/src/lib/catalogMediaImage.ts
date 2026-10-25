const MEDIA_LIBRARY_IMAGE = /^\/manus-storage\/media-library\/([A-Za-z0-9][A-Za-z0-9_.-]*)$/;
const SKU_IMAGE = /^\/manus-storage\/sku-images\/([A-Za-z0-9][A-Za-z0-9_.-]*)$/;

/** Never replace the approved artwork: only change its delivery path on error. */
export function catalogMediaRecoveryUrl(src: string, nonce: string): string | null {
  const match = MEDIA_LIBRARY_IMAGE.exec(src);
  if (match) return `/api/catalog-media/${match[1]}?cd-image-retry-nonce=${encodeURIComponent(nonce)}`;
  const sku = SKU_IMAGE.exec(src);
  if (sku) return `/api/catalog-sku-photo/${sku[1]}?cd-image-retry-nonce=${encodeURIComponent(nonce)}`;
  return null;
}

export function newCatalogMediaRetryNonce(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

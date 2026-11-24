/**
 * Photo tiles for the sink, faucet and countertop pickers.
 *
 * Modelled on the door style picker's card grid (ColorSlotButton's StyleGrid):
 * the whole tile is one button, the catalog photo fills the top of the tile,
 * the name sits underneath, and the chosen tile gets the gold border, ring and
 * corner check. The door picker itself is untouched; this is its look applied
 * to fixtures.
 *
 * Presentation only. Each tile calls the picker's existing handler, so what is
 * selected, placed and billed does not change. Only real catalog photos are
 * shown. A product with no photo, or a photo that fails to load, gets a plain
 * placeholder with its name instead.
 */
import { useState, type ReactNode } from "react";
import { Check, Droplets } from "lucide-react";

/**
 * Customer-facing wording for a catalog brand. StoneCreek is the store's own
 * name for the supplier line, so the supplier's name is never shown.
 */
export function customerFacingBrand(brand: string): string {
  return /^pelican\b/i.test(brand.trim()) ? "StoneCreek" : brand;
}

/** Same rule for a product name that carries the supplier's name. */
export function customerFacingProductName(name: string): string {
  return name.replace(/\bPelican\b/g, "StoneCreek");
}

/**
 * Stands in for a missing photo. The product name is printed right under the
 * photo area on every tile and card, so the placeholder only says there is no
 * photo; the name is still read out through its label.
 */
export function ProductPhotoPlaceholder({ name, className = "" }: { name: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={`${name} (no photo yet)`}
      data-testid="product-photo-placeholder"
      className={`flex h-full w-full flex-col items-center justify-center gap-1 bg-[#f6f3ed] px-2 text-center text-muted-foreground ${className}`}
    >
      <Droplets className="h-5 w-5 text-[#a87f33]/50" aria-hidden="true" />
      <span className="text-[9px] font-medium uppercase tracking-wide text-[#6b6255]/80">No photo yet</span>
    </div>
  );
}

/** A catalog photo that falls back to the placeholder when it is missing or broken. */
export function ProductPhoto({
  imageUrl,
  name,
  fit = "contain",
}: {
  imageUrl?: string | null;
  name: string;
  fit?: "contain" | "cover";
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!imageUrl || failedUrl === imageUrl) return <ProductPhotoPlaceholder name={name} />;
  return (
    <img
      src={imageUrl}
      alt={name}
      loading="lazy"
      onError={() => setFailedUrl(imageUrl)}
      className={`h-full w-full ${fit === "cover" ? "object-cover" : "object-contain p-1.5"}`}
    />
  );
}

export type ProductPhotoTileProps = {
  testId: string;
  imageUrl?: string | null;
  name: string;
  /** Catalog code, shown under the name when the name does not already carry it. */
  code?: string | null;
  /** A short second line such as the finish. */
  detail?: ReactNode;
  /** The customer price exactly as the picker already formats it. */
  price: string;
  selected: boolean;
  onSelect: () => void;
  fit?: "contain" | "cover";
};

export function ProductPhotoTile({
  testId,
  imageUrl,
  name,
  code,
  detail,
  price,
  selected,
  onSelect,
  fit = "contain",
}: ProductPhotoTileProps) {
  const displayName = customerFacingProductName(name);
  const showCode = Boolean(code && !displayName.includes(code));
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={selected}
      title={displayName}
      onClick={onSelect}
      className={[
        "relative flex min-w-0 flex-col gap-1 rounded-lg border p-1.5 text-left transition-all",
        "touch-manipulation hover:border-[#d4a75a]/70 hover:bg-accent/60 active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a75a]",
        selected
          ? "border-[#d4a75a] bg-[#d4a75a]/10 ring-1 ring-[#d4a75a] shadow-sm"
          : "border-border bg-white",
      ].join(" ")}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded bg-white">
        <ProductPhoto imageUrl={imageUrl} name={displayName} fit={fit} />
      </div>
      <span className="block min-w-0">
        <span className={`line-clamp-2 text-[11px] leading-snug ${selected ? "font-semibold text-[#1a2744]" : "font-medium text-foreground"}`}>
          {displayName}
        </span>
        {showCode && <span className="block truncate text-[9px] text-muted-foreground">{code}</span>}
        {detail && <span className="block truncate text-[10px] text-muted-foreground">{detail}</span>}
        <span className="mt-0.5 block text-[11px] font-bold text-[#1a2744] dark:text-foreground">{price}</span>
      </span>
      {selected && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#d4a75a] text-white shadow">
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

/**
 * The grid the tiles sit in: two across on a phone, more as the pop-up widens,
 * the same way the door picker steps from two to three columns.
 */
export function ProductPhotoGrid({
  children,
  testId,
  className = "grid-cols-2 sm:grid-cols-3",
}: {
  children: ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <div data-testid={testId} className={`grid gap-2 p-1 ${className}`}>
      {children}
    </div>
  );
}

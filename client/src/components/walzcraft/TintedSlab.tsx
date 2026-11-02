import { WALZCRAFT_SHADE_COLORS } from "@shared/walzcraftDoorTemplates";

/** One generic grayscale WalzCraft slab reference (S660 Hale), tinted client-side. */
export const SLAB_REFERENCE_SRC = "/walzcraft/doors/walzcraft-slab-reference-s660-hale.webp";

export function walzColorHex(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hit = WALZCRAFT_SHADE_COLORS.find((s) => n.startsWith(s.name.toLowerCase().replace(/[^a-z0-9]/g, "")));
  return hit?.hex ?? null;
}

export interface SlabTint { hex: string | null; colorName: string; estimated: boolean }

/** Catalog renderHex wins; otherwise the matched WalzCraft color hex (estimated). */
export function resolveSlabTint(opts: { catalogHex?: string | null; catalogColorName?: string | null; walzColorName?: string | null }): SlabTint {
  if (opts.catalogHex) return { hex: opts.catalogHex, colorName: opts.catalogColorName ?? opts.walzColorName ?? opts.catalogHex, estimated: false };
  const hex = walzColorHex(opts.walzColorName);
  return { hex, colorName: opts.walzColorName ?? "unknown color", estimated: true };
}

export function TintedSlab({ tint, className = "h-36 w-20" }: { tint: SlabTint; className?: string }) {
  return (
    <figure data-testid="tinted-slab" className="shrink-0 text-center">
      {tint.hex ? (
        <div className={`relative overflow-hidden rounded border border-[#244338]/20 ${className}`} style={{ backgroundColor: tint.hex }}>
          <img src={SLAB_REFERENCE_SRC} alt="" aria-hidden="true" className="h-full w-full object-cover" style={{ mixBlendMode: "multiply", filter: "grayscale(1)" }} />
        </div>
      ) : (
        <div className={`flex items-center justify-center rounded border border-dashed border-[#244338]/30 p-1 text-[11px] text-[#244338]/70 ${className}`}>No slab photo yet</div>
      )}
      <figcaption className="mt-1 max-w-[7rem] text-[11px] text-[#244338]">
        Slab preview · {tint.colorName}
        {tint.hex && tint.estimated && <span className="block italic text-[#244338]/60">estimated color</span>}
      </figcaption>
    </figure>
  );
}

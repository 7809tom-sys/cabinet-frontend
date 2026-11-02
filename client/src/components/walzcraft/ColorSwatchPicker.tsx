import { woodGrainBadge } from "@shared/walzcraftColorPatterns";
import { useRef, useState } from "react";
import { WALZCRAFT_SHADE_COLORS } from "@shared/walzcraftDoorTemplates";
import {
  colorPatternFor,
  nearestShade,
  readColorSelections,
  saveColorSelection,
  type ColorSelection,
} from "@shared/walzcraftColorPatterns";
import type { DistributorDoorMatch } from "@shared/walzcraftDistributorMatches";
import { SLAB_REFERENCE_SRC } from "@/components/walzcraft/TintedSlab";

type Swatch = { name: string; hex: string; matchPct: number | "estimated" };

function toHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function ColorSwatchPicker({ door, styleGrainDirection }: { door: DistributorDoorMatch; styleGrainDirection?: string | null }) {
  const record = colorPatternFor(door);
  const matched: Swatch[] = record.candidates.filter((c) => c.hex).map((c) => ({ name: c.name, hex: c.hex!, matchPct: c.matchPct }));
  const matchedNames = new Set(matched.map((m) => m.name));
  const woodGrain = record.colorType === "woodGrain";
  const grainLabel = woodGrainBadge(record, styleGrainDirection);
  const grainHorizontal = grainLabel?.endsWith("Horizontal") ?? false;
  // Stain / wood-grain doors browse stain swatches only (no paint-only colors).
  const browse: Swatch[] = WALZCRAFT_SHADE_COLORS.filter((s) => !matchedNames.has(s.name) && (record.colorType === "paint" || /stain/i.test(s.finish ?? ""))).map((s) => ({ name: s.name, hex: s.hex, matchPct: "estimated" }));
  const [selected, setSelected] = useState<ColorSelection | null>(() => {
    const saved = readColorSelections()[door.id];
    if (saved) return saved;
    return matched[0] ? { shadeName: matched[0].name, hex: matched[0].hex, matchPct: matched[0].matchPct } : null;
  });
  const [hover, setHover] = useState<Swatch | null>(null);
  const [sampling, setSampling] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const preview = hover ? { shadeName: hover.name, hex: hover.hex } : selected;
  const isSlab = /slab/i.test(door.group);
  const previewSrc = woodGrain && door.photo ? door.photo : isSlab || !door.photo ? SLAB_REFERENCE_SRC : door.photo;

  const choose = (sel: ColorSelection) => {
    saveColorSelection(door.id, sel);
    setSelected(sel);
  };
  const fromHex = (hex: string) => {
    const { shade, matchPct } = nearestShade(hex);
    choose({ shadeName: shade.name, hex: shade.hex, matchPct, pickedHex: hex });
  };
  const eyedropper = async () => {
    const ED = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (ED) {
      try { fromHex((await new ED().open()).sRGBHex); } catch { /* cancelled */ }
    } else setSampling(true);
  };
  const samplePixel = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!sampling || !imgRef.current) return;
    const img = imgRef.current;
    const rect = img.getBoundingClientRect();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * img.naturalWidth);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * img.naturalHeight);
    const px = ctx.getImageData(x, y, 1, 1).data;
    const r = px[0], g = px[1], b = px[2];
    setSampling(false);
    fromHex(toHex(r, g, b));
  };

  const SwatchBtn = ({ s, tag }: { s: Swatch; tag?: string }) => {
    const on = selected?.shadeName === s.name;
    return (
      <button type="button" data-testid={`swatch-${door.id}-${s.name}`} title={`${s.name} ${s.hex}`}
        onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(s)} onBlur={() => setHover(null)}
        onClick={() => choose({ shadeName: s.name, hex: s.hex, matchPct: s.matchPct })}
        className={`flex flex-col items-center rounded border-2 p-1 text-[10px] text-[#244338] ${on ? "border-[#d7a46c]" : tag ? "border-[#244338]/40" : "border-transparent"}`}>
        <span className="h-8 w-8 rounded border border-[#244338]/20" style={{ backgroundColor: s.hex }} />
        <span className="mt-0.5 max-w-[4.5rem] truncate">{s.name}</span>
        {tag && <span className="font-semibold text-[#244338]">{tag}</span>}
      </button>
    );
  };

  return (
    <div data-testid={`swatch-picker-${door.id}`} className="mt-3 rounded border border-[#244338]/20 bg-white p-2">
      <div className="flex flex-wrap gap-3">
        <figure className="shrink-0 text-center">
          <div className="relative h-36 w-20 overflow-hidden rounded border border-[#244338]/20" style={{ backgroundColor: woodGrain ? undefined : preview?.hex ?? "#fffdf9" }}>
            <img ref={imgRef} src={previewSrc} alt={`${door.doorName ?? door.code} color preview`} crossOrigin="anonymous" onClick={samplePixel}
              className={`h-full w-full object-cover ${sampling ? "cursor-crosshair" : ""}`}
              style={sampling ? undefined : woodGrain ? (grainHorizontal ? { transform: "rotate(90deg) scale(1.8)" } : undefined) : { mixBlendMode: "multiply", filter: "grayscale(1)" }} />
          </div>
          <figcaption data-testid={`swatch-preview-${door.id}`} className="mt-1 max-w-[6rem] text-[11px] text-[#244338]">
            {woodGrain ? <span data-testid={`color-type-${door.id}`}>{grainLabel}</span> : <>{preview ? <>{preview.shadeName}<br />{preview.hex}</> : "No match yet"}
            <br /><span data-testid={`color-type-${door.id}`}>{record.colorType === "stain" ? "Stain" : "Paint"}</span></>}
          </figcaption>
        </figure>
        <div className="min-w-[12rem] flex-1">
          {matched.length > 0 ? (
            <>
              <div className="text-xs font-semibold uppercase tracking-wide text-[#244338]">Matched</div>
              <div className="flex flex-wrap gap-1">{matched.map((s, i) => <SwatchBtn key={s.name} s={s} tag={i === 0 ? "Matched · top" : "Matched"} />)}</div>
            </>
          ) : (
            <div className="text-xs font-semibold text-[#244338]">No match yet</div>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-semibold text-[#244338]">Browse more</summary>
            <div className="mt-1 flex flex-wrap gap-1">{browse.map((s) => <SwatchBtn key={s.name} s={s} />)}</div>
          </details>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#244338]">
            <button type="button" data-testid={`eyedropper-${door.id}`} onClick={eyedropper} className="rounded border-2 border-[#244338] px-2 py-0.5 font-semibold">
              {sampling ? "Click a pixel on the door photo" : "Eyedropper"}
            </button>
            {selected && (
              <span data-testid={`swatch-selected-${door.id}`}>
                Selected: {selected.shadeName}{woodGrain ? "" : ` ${selected.hex}`}
                {selected.pickedHex ? ` · picked ${selected.pickedHex}` : ""} · {selected.matchPct === "estimated" ? "estimated match" : `${selected.matchPct}% match`}
              </span>
            )}
            <span className="italic text-[#244338]/70">not saved to catalog yet</span>
          </div>
        </div>
      </div>
    </div>
  );
}

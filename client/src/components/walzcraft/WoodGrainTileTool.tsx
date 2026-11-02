import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  applyHomography, homography, laplacianVariance, rectSizeForQuad, readTileSets, saveTileSet, tileQualityNote,
  type Pt, type WoodGrainTile, type WoodGrainTileSet,
} from "@shared/woodGrainTiles";

const MAX_OUT = 1024;

/** Warp one quad (TL, TR, BR, BL in image px) to a straight rectangle and return RGBA + size. */
export function warpQuad(src: ImageData, quad: Pt[]): { data: Uint8ClampedArray; w: number; h: number } {
  const size = rectSizeForQuad(quad);
  const scale = Math.min(1, MAX_OUT / Math.max(size.w, size.h));
  const w = Math.max(1, Math.round(size.w * scale)), h = Math.max(1, Math.round(size.h * scale));
  const H = homography([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], quad);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = applyHomography(H, { x: x + 0.5, y: y + 0.5 });
    const sx = Math.min(src.width - 1, Math.max(0, Math.round(p.x))), sy = Math.min(src.height - 1, Math.max(0, Math.round(p.y)));
    const si = (sy * src.width + sx) * 4, di = (y * w + x) * 4;
    out[di] = src.data[si]; out[di + 1] = src.data[si + 1]; out[di + 2] = src.data[si + 2]; out[di + 3] = 255;
  }
  // Native resolution (before the 1024 cap) decides the low-res rejection.
  return { data: out, w, h, ...{ nativeW: size.w, nativeH: size.h } } as { data: Uint8ClampedArray; w: number; h: number };
}

function lumOf(d: Uint8ClampedArray, n: number) {
  const l = new Float32Array(n);
  for (let i = 0; i < n; i++) l[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
  return l;
}
/** Separable box blur (low-frequency luminance). */
function boxBlur(src: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) { let acc = 0; for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) { tmp[y * w + x] = acc / (2 * r + 1); acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)]; } }
  for (let x = 0; x < w; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) { out[y * w + x] = acc / (2 * r + 1); acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } }
  return out;
}
/** Flatten lighting (subtract low-frequency luminance) and normalize to target mean/std. */
export function evenLighting(data: Uint8ClampedArray, w: number, h: number, target?: { mean: number; std: number }) {
  const n = w * h, lum = lumOf(data, n), blur = boxBlur(lum, w, h, Math.max(4, Math.round(Math.max(w, h) / 8)));
  let mean = 0; for (let i = 0; i < n; i++) mean += lum[i]; mean /= n;
  const flat = new Float32Array(n); for (let i = 0; i < n; i++) flat[i] = lum[i] - blur[i] + mean;
  let m2 = 0, v = 0; for (let i = 0; i < n; i++) m2 += flat[i]; m2 /= n; for (let i = 0; i < n; i++) v += (flat[i] - m2) ** 2; const std = Math.sqrt(v / n) || 1;
  const t = target ?? { mean: m2, std };
  for (let i = 0; i < n; i++) {
    const nl = (flat[i] - m2) / std * t.std + t.mean, k = lum[i] > 1 ? nl / lum[i] : 1;
    data[i * 4] *= k; data[i * 4 + 1] *= k; data[i * 4 + 2] *= k;
  }
  return { stats: { mean: m2, std }, target: t, sharpness: laplacianVariance(lumOf(data, n), w, h) };
}

export function WoodGrainTileTool({ styleId, colorName, sceneUrls }: { styleId: number; colorName: string; sceneUrls: string[] }) {
  const [imgUrl, setImgUrl] = useState<string | null>(sceneUrls[0] ?? null);
  const [quads, setQuads] = useState<Pt[][]>([]);
  const [pending, setPending] = useState<Pt[]>([]);
  const [set, setSet] = useState<WoodGrainTileSet>(() => readTileSets()[String(styleId)] ?? { styleId, colorName, tiles: [], approvedAt: null });
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => { saveTileSet(set); }, [set]);

  const onImgClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const img = imgRef.current; if (!img) return;
    const r = img.getBoundingClientRect();
    const p = { x: (e.clientX - r.left) * (img.naturalWidth / r.width), y: (e.clientY - r.top) * (img.naturalHeight / r.height) };
    const next = [...pending, p];
    if (next.length === 4) { if (quads.length < 10) setQuads([...quads, next]); setPending([]); } else setPending(next);
  };
  const extract = () => {
    const img = imgRef.current; if (!img) return;
    try {
      const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0);
      const src = ctx.getImageData(0, 0, c.width, c.height);
      let target: { mean: number; std: number } | undefined;
      const tiles: WoodGrainTile[] = quads.map((q, i) => {
        const wq = warpQuad(src, q) as ReturnType<typeof warpQuad> & { nativeW: number; nativeH: number };
        const ev = evenLighting(wq.data, wq.w, wq.h, target); target ??= ev.target;
        const oc = document.createElement("canvas"); oc.width = wq.w; oc.height = wq.h;
        oc.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(wq.data), wq.w, wq.h), 0, 0);
        const note = tileQualityNote(wq.nativeW, wq.nativeH, ev.sharpness);
        return { id: `t${Date.now()}-${i}`, dataUrl: oc.toDataURL("image/jpeg", 0.82), w: wq.w, h: wq.h, keep: !note, note };
      });
      setSet({ styleId, colorName, tiles, approvedAt: null }); setError(null);
    } catch (err) {
      setError(`Could not read the photo pixels (${(err as Error).message}). Upload the photo file instead.`);
    }
  };
  return (
    <div data-testid="wood-grain-tile-tool" className="space-y-2 rounded-md border border-[#d7a46c] bg-[#fffdf9] p-2 text-xs text-[#244338]">
      <div className="font-semibold">Wood grain tiles · {colorName} <span className="font-normal text-muted-foreground">(draft: stored in this browser only, not saved to the catalog)</span></div>
      <div className="flex flex-wrap items-center gap-2">
        {sceneUrls.length > 0 && (
          <select className="h-8 rounded border px-1" value={imgUrl ?? ""} onChange={(e) => { setImgUrl(e.target.value); setQuads([]); setPending([]); }}>
            {sceneUrls.map((u) => <option key={u} value={u}>{u.split("/").pop()}</option>)}
          </select>
        )}
        <input type="file" accept="image/*" data-testid="tile-upload" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setImgUrl(URL.createObjectURL(f)); setQuads([]); setPending([]); } }} />
        <span>Click 4 corners (top-left, top-right, bottom-right, bottom-left) per door/drawer panel · {quads.length}/10 panels{pending.length ? ` · ${pending.length}/4 corners` : ""}</span>
        <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => { setQuads([]); setPending([]); }}>Clear</Button>
        <Button type="button" size="sm" className="h-7 bg-[#244338] text-[#fffdf9]" data-testid="tile-extract" disabled={quads.length < 1} onClick={extract}>Extract tiles</Button>
      </div>
      {imgUrl && (
        <div className="relative inline-block max-w-full">
          <img ref={imgRef} src={imgUrl} crossOrigin="anonymous" alt="Room scene for wood grain tiles" onClick={onImgClick} className="max-h-[420px] max-w-full cursor-crosshair" />
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${imgRef.current?.naturalWidth ?? 1} ${imgRef.current?.naturalHeight ?? 1}`} preserveAspectRatio="none">
            {quads.map((q, i) => <polygon key={i} points={q.map((p) => `${p.x},${p.y}`).join(" ")} fill="rgba(215,164,108,0.25)" stroke="#d7a46c" strokeWidth={4} />)}
            {pending.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={8} fill="#244338" />)}
          </svg>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {set.tiles.length > 0 && (
        <div data-testid="tile-grid" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {set.tiles.map((t) => (
            <figure key={t.id} className={`rounded border p-1 ${t.keep ? "border-[#244338]" : "opacity-50"}`}>
              <img src={t.dataUrl} alt="Wood grain tile" className="h-24 w-full object-cover" />
              <figcaption className="mt-1 space-y-1">
                <div>{t.w}×{t.h}{t.note ? ` · ${t.note}` : ""}</div>
                <div className="flex gap-1">
                  <button type="button" disabled={!!t.note} className="rounded border px-1" onClick={() => setSet({ ...set, approvedAt: null, tiles: set.tiles.map((x) => x.id === t.id ? { ...x, keep: true } : x) })}>Keep</button>
                  <button type="button" className="rounded border px-1" onClick={() => setSet({ ...set, approvedAt: null, tiles: set.tiles.map((x) => x.id === t.id ? { ...x, keep: false } : x) })}>Discard</button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {set.tiles.length > 0 && (
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" className="h-7 bg-[#d7a46c] text-[#244338]" data-testid="tile-approve" disabled={!set.tiles.some((t) => t.keep && !t.note)} onClick={() => setSet({ ...set, approvedAt: new Date().toISOString() })}>Approve tile set</Button>
          <span>{set.approvedAt ? `Approved · ${set.tiles.filter((t) => t.keep && !t.note).length} tiles used by the 3D Designer in this browser` : "Not approved yet"}</span>
        </div>
      )}
    </div>
  );
}

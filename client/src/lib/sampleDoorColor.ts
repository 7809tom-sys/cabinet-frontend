/**
 * Colour of a door sample photo, used so the drawn drawer front on the style confirmation screen matches the door
 * (the finish colour from the style record can sit well away from the photo: Versa Shaker was a darker tan).
 * Pure pixel maths is separate from the canvas read so it can be tested without a browser.
 */

/** Median colour of the central panel of an RGBA pixel buffer, as #rrggbb. Null if there is nothing to read. */
export function medianPanelColor(data: ArrayLike<number>, width: number, height: number): string | null {
  if (!(width > 0) || !(height > 0)) return null;
  const x0 = Math.floor(width * 0.3), x1 = Math.ceil(width * 0.7);
  const y0 = Math.floor(height * 0.35), y1 = Math.ceil(height * 0.8);
  const ch: [number[], number[], number[]] = [[], [], []];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      if ((data[i + 3] ?? 255) < 200) continue; // transparent
      ch[0].push(data[i]!); ch[1].push(data[i + 1]!); ch[2].push(data[i + 2]!);
    }
  }
  if (ch[0].length === 0) return null;
  const med = (a: number[]) => { a.sort((p, q) => p - q); return a[Math.floor(a.length / 2)]!; };
  return `#${ch.map((a) => med(a).toString(16).padStart(2, "0")).join("")}`;
}

/** A darker shade of a #rrggbb colour, for the drawer's outline. */
export function darkenHex(hex: string, factor = 0.78): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  return `#${[0, 2, 4].map((i) => Math.round(parseInt(m[1]!.slice(i, i + 2), 16) * factor).toString(16).padStart(2, "0")).join("")}`;
}

/** Reads the loaded door photo. Null when the canvas is unavailable or tainted (cross-origin); callers fall back. */
export function readDoorPhotoColor(img: HTMLImageElement): string | null {
  try {
    const w = 48;
    const h = Math.max(1, Math.round((img.naturalHeight / Math.max(1, img.naturalWidth)) * w));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return medianPanelColor(ctx.getImageData(0, 0, w, h).data, w, h);
  } catch {
    return null;
  }
}

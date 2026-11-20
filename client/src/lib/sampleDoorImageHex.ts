/**
 * The colour of an approved AI door image (Tom, Nov 20 2026).
 *
 * The Designer paints a door from a hex, and until now the only hex it trusted was an
 * accepted render or a hand-typed one. The AI profile stores an IMAGE, so the kitchen
 * kept painting the catalogue colour - "its coming up with its own colour" on Slate
 * Gray.
 *
 * This samples the image once, in the browser, when the admin accepts it: the median of
 * the central panel, ignoring highlights (glare) and shadows (edges). Median rather than
 * average so a specular streak or a dark hinge line cannot drag the colour.
 */
const SAMPLE_INSET = 0.25;
const IGNORE_ABOVE = 246;
const IGNORE_BELOW = 12;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function toHex(r: number, g: number, b: number): string {
  const part = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Median colour of the central panel, or null when the image cannot be read. */
export async function sampleDoorImageHex(url: string | null | undefined): Promise<string | null> {
  const src = (url ?? "").trim();
  if (!src || typeof document === "undefined") return null;
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.crossOrigin = "anonymous";
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("image could not be loaded"));
      element.src = src;
    });
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (width < 8 || height < 8) return null;

    // Scale down first: a 2000 px photo does not need 4 million samples.
    const scale = Math.min(1, 96 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(8, Math.round(width * scale));
    canvas.height = Math.max(8, Math.round(height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const insetX = Math.round(canvas.width * SAMPLE_INSET);
    const insetY = Math.round(canvas.height * SAMPLE_INSET);
    const w = Math.max(1, canvas.width - insetX * 2);
    const h = Math.max(1, canvas.height - insetY * 2);
    const data = context.getImageData(insetX, insetY, w, h).data;

    const reds: number[] = [];
    const greens: number[] = [];
    const blues: number[] = [];
    let transparent = 0;
    for (let index = 0; index < data.length; index += 4) {
      const alpha = data[index + 3] ?? 0;
      if (alpha < 200) { transparent += 1; continue; }
      const r = data[index] ?? 0;
      const g = data[index + 1] ?? 0;
      const b = data[index + 2] ?? 0;
      const lightest = Math.max(r, g, b);
      const darkest = Math.min(r, g, b);
      if (lightest >= IGNORE_ABOVE || darkest <= IGNORE_BELOW) continue;
      reds.push(r); greens.push(g); blues.push(b);
    }
    if (reds.length < 24) return null;
    if (transparent > reds.length) return null;
    return toHex(median(reds), median(greens), median(blues));
  } catch {
    return null;
  }
}
/**
 * Pre-tinted, higher-resolution stain grain for the Designer (Tom, Nov 20 2026).
 *
 * The 3D view (frozen) multiplies a 56 px grain template by a per-channel colour and
 * then runs it through ACES tone mapping, which is why Honey Core came out flat and
 * washed out while the elevation view (the same template, untinted, drawn by the
 * browser in sRGB) looked better. This module builds the stain's own texture in the
 * browser instead: the best wood template for the species, upscaled to >= 512 px with
 * fine grain streaks, tinted in CIELAB (luminance-preserving), plus a normal map from
 * the grain. `withPretintedStainGrain` then hands 3D a finished door-colour texture
 * exactly like a DL finish photo crop: identity tint, `grainSubstituted: false`, so the
 * existing DL photo path (light compensation, tone mapping off) draws it, and the
 * elevation view draws the same texture.
 *
 * Nothing new is downloaded: the templates are the catalog grains already in the repo.
 */
import { useEffect, useState } from "react";
import type { CabinetFacePlan } from "@shared/doorFaceRecognition";
import { grainNormalMap, pickStainGrainTemplate, stainGrainTexture, type RgbaImage } from "@shared/stainGrain";

export type PretintedStainGrain = { door: string; drawer: string | null; normal: string; slug: string };

type Builder = (key: StainTextureKey) => Promise<PretintedStainGrain | null>;

export type StainTextureKey = {
  doorTemplate: string;
  drawerTemplate: string | null;
  hex: string;
  slug: string;
  direction: "vertical" | "horizontal";
};

const ready = new Map<string, PretintedStainGrain | null>();
const pending = new Set<string>();
const listeners = new Set<() => void>();
let builder: Builder = buildInBrowser;

function cacheKey(key: StainTextureKey): string {
  return [key.doorTemplate, key.drawerTemplate ?? "", key.hex.toLowerCase(), key.direction].join("|");
}

function loadImage(url: string): Promise<RgbaImage> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return reject(new Error("no 2d context"));
      context.drawImage(image, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height);
      resolve({ width: data.width, height: data.height, data: data.data });
    };
    image.onerror = () => reject(new Error(`grain ${url} could not be loaded`));
    image.src = url;
  });
}

function toObjectUrl(image: RgbaImage, type = "image/png"): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("no 2d context"));
  context.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error("toBlob failed"))), type);
  });
}

async function buildInBrowser(key: StainTextureKey): Promise<PretintedStainGrain | null> {
  if (typeof document === "undefined" || typeof URL?.createObjectURL !== "function") return null;
  const door = stainGrainTexture(await loadImage(key.doorTemplate), key.hex, { direction: key.direction });
  const drawer = key.drawerTemplate
    ? stainGrainTexture(await loadImage(key.drawerTemplate), key.hex, { direction: "horizontal", seed: 11 })
    : null;
  return {
    door: await toObjectUrl(door),
    drawer: drawer ? await toObjectUrl(drawer) : null,
    normal: await toObjectUrl(grainNormalMap(door)),
    slug: key.slug,
  };
}

/** The finished texture for this stain, or null while it is being built (or when it cannot be). */
export function pretintedStainGrain(key: StainTextureKey): PretintedStainGrain | null {
  return ready.get(cacheKey(key)) ?? null;
}

/** Starts building the texture once; listeners hear when it is ready. */
export function requestPretintedStainGrain(key: StainTextureKey): void {
  const id = cacheKey(key);
  if (ready.has(id) || pending.has(id)) return;
  pending.add(id);
  void builder(key)
    .catch(() => null)
    .then((result) => {
      ready.set(id, result);
      pending.delete(id);
      if (result) listeners.forEach((listener) => listener());
    });
}

/** Bumps whenever a stain texture finishes, so memoised face plans recompute. */
export function useStainGrainTextureVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion((current) => current + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return version;
}

/**
 * The texture request for a stain face plan, or null when the plan is not a tinted grain
 * template (a paint, a real DL photo crop, a door photo).
 */
export function stainTextureKeyFor(
  plan: CabinetFacePlan | null | undefined,
  names: { grainName?: string | null; species?: string | null; finishName?: string | null; grainDirection?: string | null } = {},
): StainTextureKey | null {
  const crop = plan?.dlcCrop;
  if (!crop || crop.grainSubstituted !== true || !crop.solidColor || !plan?.doorUrl) return null;
  const choice = pickStainGrainTemplate({ ...names, targetHex: crop.solidColor });
  const entry = choice.entry;
  return {
    doorTemplate: entry.faceDoor,
    drawerTemplate: plan.drawerUrl ? entry.faceDrawer : null,
    hex: crop.solidColor.toLowerCase(),
    slug: entry.slug,
    direction: names.grainDirection === "horizontal" ? "horizontal" : "vertical",
  };
}

/**
 * A stain face plan with its pre-tinted texture swapped in when ready. Until then the plan
 * is returned unchanged (the old template + multiply) and the build is started.
 */
export function withPretintedStainGrain(
  plan: CabinetFacePlan | null,
  names: Parameters<typeof stainTextureKeyFor>[1] = {},
): CabinetFacePlan | null {
  const key = stainTextureKeyFor(plan, names);
  if (!plan || !key) return plan;
  const texture = pretintedStainGrain(key);
  if (!texture) {
    requestPretintedStainGrain(key);
    return plan;
  }
  const entry = pickStainGrainTemplate({ ...names, targetHex: key.hex }).entry;
  return {
    ...plan,
    doorUrl: texture.door,
    drawerUrl: plan.drawerUrl ? texture.drawer ?? texture.door : null,
    dlcCrop: {
      ...plan.dlcCrop!,
      slug: `stain-${texture.slug}`,
      grainUrl: texture.door,
      faceTileIn: entry.faceTileIn,
      faceTileDrawerIn: entry.faceTileDrawerIn,
      normalUrl: texture.normal,
      // The texture already IS the door colour: no multiplier, and it is drawn like a
      // DL photo crop (light compensation, tone mapping off) instead of a borrowed grain.
      tintHex: null,
      tintLinear: null,
      grainSubstituted: false,
    },
  };
}

/** Tests only. */
export function __setStainTextureBuilderForTests(next: Builder | null): void {
  builder = next ?? buildInBrowser;
  ready.clear();
  pending.clear();
}

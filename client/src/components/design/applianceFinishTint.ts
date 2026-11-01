/**
 * Appliance package color for appliances that only have a stainless catalog photo (refrigerator, dishwasher,
 * microwave, hood). The 3D view keeps the photo's handles, seams and shading and remaps its brightness range to
 * the requested finish. This is a stand-in until real photos exist in each color.
 */
import * as THREE from "three";
import type { PlacedCabinet } from "@/lib/design";

export type ApplianceTintFinish = NonNullable<PlacedCabinet["applianceFinish"]>;

/** Output = floor + gain * luma, with a per-channel multiplier for a slight cast. Stainless is the untouched photo. */
const TINTS: Record<Exclude<ApplianceTintFinish, "stainless">, { floor: number; gain: number; cast: [number, number, number] }> = {
  white: { floor: 0.6, gain: 0.4, cast: [1, 1, 1.01] },
  black: { floor: 0.03, gain: 0.3, cast: [1, 1, 1.03] },
  "black-stainless": { floor: 0.1, gain: 0.5, cast: [0.96, 0.98, 1.05] },
};

export function applianceFinishNeedsTint(finish: PlacedCabinet["applianceFinish"] | undefined): finish is Exclude<ApplianceTintFinish, "stainless"> {
  return finish === "white" || finish === "black" || finish === "black-stainless";
}

/** Recolor one 0-255 RGB pixel; alpha is handled by the caller and never changes. */
export function tintApplianceRgb(finish: Exclude<ApplianceTintFinish, "stainless">, r: number, g: number, b: number): [number, number, number] {
  const tint = TINTS[finish];
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const base = tint.floor + tint.gain * luma;
  const out = (cast: number) => Math.max(0, Math.min(255, Math.round(base * cast * 255)));
  return [out(tint.cast[0]), out(tint.cast[1]), out(tint.cast[2])];
}

/** Front photo texture; recolored once the image arrives when a non-stainless finish is chosen. */
export function loadApplianceFrontTexture(url: string, finish: PlacedCabinet["applianceFinish"] | undefined): THREE.Texture {
  if (!applianceFinishNeedsTint(finish)) return new THREE.TextureLoader().load(url);
  const texture = new THREE.Texture();
  texture.colorSpace = THREE.SRGBColorSpace;
  new THREE.ImageLoader().setCrossOrigin("anonymous").load(
    url,
    (image) => {
      let source: CanvasImageSource | HTMLImageElement = image;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext("2d");
        if (context && canvas.width > 0 && canvas.height > 0) {
          context.drawImage(image, 0, 0);
          const data = context.getImageData(0, 0, canvas.width, canvas.height);
          const px = data.data;
          for (let i = 0; i < px.length; i += 4) {
            if (px[i + 3] === 0) continue;
            const [r, g, b] = tintApplianceRgb(finish, px[i], px[i + 1], px[i + 2]);
            px[i] = r; px[i + 1] = g; px[i + 2] = b;
          }
          context.putImageData(data, 0, 0);
          source = canvas;
        }
      } catch {
        // A cross-origin image can't be read back; show the catalog photo as supplied.
      }
      texture.image = source;
      texture.needsUpdate = true;
    },
    undefined,
    () => undefined,
  );
  return texture;
}

/** Refrigerator side/top shell color to match the recolored front. */
export function refrigeratorBodyMaterialParams(finish: PlacedCabinet["applianceFinish"] | undefined): THREE.MeshPhysicalMaterialParameters {
  const common = { clearcoat: 0.08, clearcoatRoughness: 0.28, envMapIntensity: 1.02 };
  switch (finish) {
    case "white": return { ...common, color: "#e6e8ea", roughness: 0.4, metalness: 0.08 };
    case "black": return { ...common, color: "#17191c", roughness: 0.34, metalness: 0.2 };
    case "black-stainless": return { ...common, color: "#3b4148", roughness: 0.3, metalness: 0.5 };
    default: return { ...common, color: "#5f666d", roughness: 0.3, metalness: 0.58 };
  }
}

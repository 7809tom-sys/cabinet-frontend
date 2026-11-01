/**
 * Read the uploaded door photo and remember its panel color on the texture.
 * Structural surfaces pick that up the next time the side finish is applied.
 */
import type { Texture } from "three";
import { doorPanelMedianHex } from "@shared/exposedSideFinish";

type ReadableImage = CanvasImageSource & { width?: number; height?: number };

export function rememberDoorPanelHex(texture: Texture | null | undefined): string | null {
  const image = texture?.image as ReadableImage | null | undefined;
  const sourceWidth = Number(image?.width ?? 0);
  const sourceHeight = Number(image?.height ?? 0);
  if (!texture || !image || sourceWidth < 4 || sourceHeight < 4 || typeof document === "undefined") return null;
  const width = Math.min(sourceWidth, 240);
  const height = Math.min(sourceHeight, 320);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, width, height);
  const hex = doorPanelMedianHex(width, height, context.getImageData(0, 0, width, height).data);
  if (!hex) return null;
  texture.userData = { ...texture.userData, doorPanelHex: hex };
  return hex;
}

import { finishColors } from "@/lib/design";

/**
 * Side, back, and end-panel faces of one run share one finish.
 * Forest Rust must not split between the forest/green match and the rust stain.
 * The uploaded door sample remains the Designer face reference. This color is
 * only the solid finish used when a face has no sample, and it is never a
 * generic hickory grain texture.
 */
export const RUN_PANEL_FACES = ["left", "right", "back", "end"] as const;
export type RunPanelFace = (typeof RUN_PANEL_FACES)[number];

export function panelFaceHex(...styleParts: Array<string | null | undefined>): string {
  return finishColors(...styleParts).face.toLowerCase();
}

export function runPanelFaceColors(...styleParts: Array<string | null | undefined>): Record<RunPanelFace, string> {
  const hex = panelFaceHex(...styleParts);
  return {
    left: hex,
    right: hex,
    back: hex,
    end: hex,
  };
}

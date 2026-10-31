/**
 * DLC_FR26 (20-20 Design catalog) door/drawer texture lookup.
 *
 * Data comes from data/dlc-fr26/manifest.json (produced by scripts/dlc_fr26_process.py).
 * Rules: every photo is cropped before it becomes a texture; door and drawer are separate surfaces
 * from different pixels; a finish whose photo has no drawer front returns drawer = null and the
 * caller must NOT reuse the door photo for the drawer.
 */

export interface DlcFaceFile {
  file: string;
  size: [number, number];
  enhanced?: { file: string; withinLimits: boolean };
}
export interface DlcFinishEntry {
  slug: string;
  sourceFile: string;
  hasDrawerFront: boolean;
  door: DlcFaceFile;
  drawer: DlcFaceFile | null;
  softness: { tier: "soft" | "medium" | "sharp" | "flat-finish" };
  flags: string[];
}
export interface DlcManifest {
  finishes: DlcFinishEntry[];
  skipped: { file: string }[];
}

export type DlcFace = "door" | "drawer";

/** Return the processed (cropped) file for a face, or null if the photo has no such face. */
export function dlcFaceFile(
  entry: DlcFinishEntry,
  face: DlcFace,
  opts: { enhanced?: boolean } = {},
): string | null {
  const f = face === "door" ? entry.door : entry.drawer;
  if (!f) return null;
  if (opts.enhanced && f.enhanced?.withinLimits) return f.enhanced.file;
  return f.file;
}

/**
 * "Cover" fit without stretching: the largest window of the cropped image that has the face's
 * aspect ratio, centred. Returns texture offset/repeat (0..1). The image is never scaled
 * non-uniformly, and nothing outside the cropped image is ever sampled, so a texture can never
 * repeat or pick up margins.
 */
export function fitWithoutStretch(
  imgW: number,
  imgH: number,
  faceW: number,
  faceH: number,
): { offsetX: number; offsetY: number; repeatX: number; repeatY: number } {
  if (!(imgW > 0 && imgH > 0 && faceW > 0 && faceH > 0)) {
    return { offsetX: 0, offsetY: 0, repeatX: 1, repeatY: 1 };
  }
  const imgAspect = imgW / imgH;
  const faceAspect = faceW / faceH;
  if (imgAspect > faceAspect) {
    const repeatX = faceAspect / imgAspect;
    return { offsetX: (1 - repeatX) / 2, offsetY: 0, repeatX, repeatY: 1 };
  }
  const repeatY = imgAspect / faceAspect;
  return { offsetX: 0, offsetY: (1 - repeatY) / 2, repeatX: 1, repeatY };
}

/** True when the manifest is safe to texture from: no placeholder, door/drawer files differ. */
export function validateDlcManifest(m: DlcManifest): string[] {
  const problems: string[] = [];
  for (const e of m.finishes) {
    if (/^img\.jpg$/i.test(e.sourceFile.split("/").pop() ?? "")) problems.push(`${e.slug}: placeholder used`);
    if (e.drawer && e.drawer.file === e.door.file) problems.push(`${e.slug}: drawer reuses door file`);
    if (!e.hasDrawerFront && e.drawer) problems.push(`${e.slug}: drawer present without a drawer front`);
    if (e.hasDrawerFront && !e.drawer) problems.push(`${e.slug}: drawer front flagged but no drawer crop`);
  }
  return problems;
}

/**
 * Real grain textures from the catalog. Only European White Oak has one that matches a finish photo
 * (1024px, with normal maps). For these, prefer the grain for panel/frame finish and use the normal
 * map for grain depth; keep the cropped door/drawer photo for profile and reveal. Rails take the
 * horizontal grain, stiles the vertical grain. Tileability still needs a visual check in the Designer.
 */
export const DLC_GRAIN_TEXTURES: Record<string, { horizontal: string; vertical: string; horizontalNormal: string; verticalNormal: string }> = {
  ewo: {
    horizontal: "source/textures/EWO_H.jpg",
    vertical: "source/textures/EWO_V.jpg",
    horizontalNormal: "source/textures/EWO_H.jpg_nm,5.png",
    verticalNormal: "source/textures/EWO_V.jpg_nm,5.png",
  },
};

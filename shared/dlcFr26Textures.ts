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

/** The crop sizes the 3D renderer needs. Same shape as CabinetFacePlan.dlcCrop minus the slug. */
export interface DlcFaceCrop {
  doorSize: [number, number];
  drawerSize: [number, number] | null;
  drawerSolidColor: string | null;
  /** The door finish colour. Sides, end panels, skins and the carcass use exactly this (never the door photo). */
  solidColor: string;
  /** Frame-free grain patch for sides, end panels and skins; null = solid colour only. */
  grainUrl: string | null;
  /** Face grain: physical tile size in inches for door and drawer faces. Present = faces use grain, not a photo. */
  faceTileIn?: [number, number];
  faceTileDrawerIn?: [number, number];
  /** Normal map for grain depth (European White Oak). */
  normalUrl?: string | null;
  /** Multiplier colour that brings the grain texture to the sample colour. */
  tintHex?: string | null;
}

/**
 * Grain faces: tile the frame-free grain at its real physical size across the face (mirrored tiles, so
 * no seams). No photo frame lines are ever on a face; the 3D rails and stiles supply the frame.
 */
export function dlcFaceGrainRepeat(
  face: DlcFace,
  crop: DlcFaceCrop,
  cabinet: { widthIn: number; heightIn: number; isWall: boolean },
): { offsetX: number; offsetY: number; repeatX: number; repeatY: number } | null {
  const tile = face === "door" ? crop.faceTileIn : crop.faceTileDrawerIn ?? crop.faceTileIn;
  if (!tile || !(tile[0] > 0) || !(tile[1] > 0)) return null;
  const p = dlcFaceProportions(face, cabinet);
  return { offsetX: 0, offsetY: 0, repeatX: Math.max(0.05, p.widthIn / tile[0]), repeatY: Math.max(0.05, p.heightIn / tile[1]) };
}

function srgbLuminanceLinear(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const ch = (i: number) => {
    const c = Number.parseInt(m[1]!.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
}

/**
 * DLC photo materials are rendered with tone mapping OFF (toneMapped = false). ACES compresses bright
 * colours, which flattened light finishes (grain contrast about a third of the photo's) and darkened
 * whites. Without tone mapping the rig only multiplies the albedo by its light sum on a front-facing
 * surface: hemisphere (average of sky and ground), key and fill. This returns the linear multiplier
 * (<= 1) that cancels that sum, so the render reproduces the sample photo with full grain contrast, and
 * the sRGB grey to use as the material colour (THREE.Color.set takes sRGB and converts to linear).
 * The environment map is not modelled, so treat the result as a first-order estimate.
 */
export function dlcPhotoLightCompensation(rig: {
  hemisphere: { sky: string; ground: string; intensity: number };
  key: { intensity: number; position: readonly [number, number, number] };
  fill: { intensity: number; position: readonly [number, number, number] };
}): { linear: number; hex: string } {
  const cosZ = (p: readonly [number, number, number]) => p[2] / Math.hypot(p[0], p[1], p[2]);
  const hemi = rig.hemisphere.intensity * (srgbLuminanceLinear(rig.hemisphere.sky) + srgbLuminanceLinear(rig.hemisphere.ground)) / 2;
  const sum = hemi + rig.key.intensity * cosZ(rig.key.position) + rig.fill.intensity * cosZ(rig.fill.position);
  const linear = Math.min(1, Math.max(0.4, sum > 0 ? 1 / sum : 1));
  const srgb = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
  const v = Math.round(Math.min(1, Math.max(0, srgb)) * 255).toString(16).padStart(2, "0");
  return { linear, hex: `#${v}${v}${v}` };
}

export const DLC_DRAWER_FRONT_HEIGHT_IN = 6;
/** Toe kick plus the drawer rail above a base door; the door itself is what is left. */
export const DLC_BASE_DOOR_TRIM_IN = 10;

/**
 * Real proportions of one door or drawer front on a cabinet (inches). Cabinets 24in and wider carry
 * two doors; base doors sit under the drawer rail. This is an approximation used only to choose
 * how much of a cropped photo to show; the texture is never stretched to it.
 */
export function dlcFaceProportions(
  face: DlcFace,
  cabinet: { widthIn: number; heightIn: number; isWall: boolean },
): { widthIn: number; heightIn: number } {
  const w = Math.max(1, cabinet.widthIn);
  const h = Math.max(1, cabinet.heightIn);
  if (face === "drawer") return { widthIn: w, heightIn: DLC_DRAWER_FRONT_HEIGHT_IN };
  const doorW = w >= 24 ? w / 2 : w;
  const doorH = cabinet.isWall || h > 48 ? h : Math.max(6, h - DLC_BASE_DOOR_TRIM_IN);
  return { widthIn: doorW, heightIn: doorH };
}

/** Texture window (centre crop, no stretch, no repeat) for one face of a DLC-cropped cabinet. */
export function dlcFaceTextureWindow(
  face: DlcFace,
  crop: DlcFaceCrop,
  cabinet: { widthIn: number; heightIn: number; isWall: boolean },
): { offsetX: number; offsetY: number; repeatX: number; repeatY: number } | null {
  const size = face === "door" ? crop.doorSize : crop.drawerSize;
  if (!size) return null;
  const p = dlcFaceProportions(face, cabinet);
  return fitWithoutStretch(size[0], size[1], p.widthIn, p.heightIn);
}

/**
 * Frame definition for DL shaker frames (Tom, Oct 31). First-guess strengths, kept as one object so a
 * single preview round can tune them. Shadow strips sit on the panel just inside the opening along the
 * top and left edges (the room's key light comes from the upper right); thin highlights sit on the
 * opposite edges. Everything is semi-transparent, so the door finish itself is not darkened.
 */
export const DLC_FRAME_DETAIL = {
  /** Rail/stile depth in scene units. The standard frame is 0.026; +20% = 0.031. */
  standardRailDepth: 0.026,
  railDepth: 0.031,
  /** Local z of the strips: just in front of the panel surface, behind the rails' front. */
  stripZ: -0.0035,
  stripDepth: 0.002,
  /** Two stacked shadow strips fake a soft falloff: [width, opacity]. */
  shadow: [
    [0.012, 0.22],
    [0.024, 0.1],
  ] as ReadonlyArray<readonly [number, number]>,
  highlight: { width: 0.006, opacity: 0.12 },
} as const;

export interface DlcFrameStrip {
  /** Centre in the frame group's local space. */
  x: number;
  y: number;
  /** Size of the strip. */
  w: number;
  h: number;
  kind: "shadow" | "highlight";
  opacity: number;
}

/** Strip layout for the opening inside a frame. Pure so it can be tested; the renderer only draws it. */
export function dlcFrameStrips(openingW: number, openingH: number): DlcFrameStrip[] {
  if (!(openingW > 0.04) || !(openingH > 0.04)) return [];
  const out: DlcFrameStrip[] = [];
  for (const [width, opacity] of DLC_FRAME_DETAIL.shadow) {
    const t = Math.min(width, openingW / 3, openingH / 3);
    out.push({ kind: "shadow", opacity, w: openingW, h: t, x: 0, y: openingH / 2 - t / 2 }); // top
    out.push({ kind: "shadow", opacity, w: t, h: openingH, x: -openingW / 2 + t / 2, y: 0 }); // left
  }
  const hw = Math.min(DLC_FRAME_DETAIL.highlight.width, openingW / 3, openingH / 3);
  const hop = DLC_FRAME_DETAIL.highlight.opacity;
  out.push({ kind: "highlight", opacity: hop, w: openingW, h: hw, x: 0, y: -openingH / 2 + hw / 2 }); // bottom
  out.push({ kind: "highlight", opacity: hop, w: hw, h: openingH, x: openingW / 2 - hw / 2, y: 0 }); // right
  return out;
}

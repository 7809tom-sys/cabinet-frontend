/**
 * Door studio lights.
 *
 * Pre-#101 (commit 542103b) values are the default for every style. The dimmer
 * rig from that PR is kept only for very dark stains, where the bright key
 * lifted charcoal toward gray. An admin exposure replaces tone-mapping
 * exposure for both rigs and is shared by the audit and the Designer.
 */
import { CABINET_NAME_COLORS } from "./cabinetColorNames";

export const DOOR_RENDERER_VERSION = "2";

export type DoorLightRig = {
  background: string;
  exposure: number;
  environment: number;
  hemisphere: { sky: string; ground: string; intensity: number };
  key: { color: string; intensity: number; position: readonly [number, number, number] };
  fill: { color: string; intensity: number; position: readonly [number, number, number] };
};

/** Designer scene lights before PR #101, plus environment intensity 1 (the Three.js default that PR #101 lowered to 0.22). */
export const RESTORED_DOOR_LIGHTS: DoorLightRig = {
  background: "#f6f3ed",
  exposure: 0.84,
  environment: 1,
  hemisphere: { sky: "#fffaf2", ground: "#718096", intensity: 0.92 },
  key: { color: "#fff5e6", intensity: 1.5, position: [0.85, 1.35, 1.6] },
  fill: { color: "#cfe0f4", intensity: 0.38, position: [-1.1, 0.4, 1.8] },
};

/** The softer PR #101 rig. Used only when the resolved stain is very dark. */
export const DARK_STAIN_DOOR_LIGHTS: DoorLightRig = {
  background: "#f3f0ea",
  exposure: 0.68,
  environment: 0.22,
  hemisphere: { sky: "#f7f4ee", ground: "#5c564e", intensity: 0.42 },
  key: { color: "#fff6ea", intensity: 0.72, position: [0.28, 1.05, 2.4] },
  fill: { color: "#f3efe8", intensity: 0.5, position: [-0.45, 0.15, 2.15] },
};

export function clampRenderExposure(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isFinite(numeric)) return null;
  return Math.min(2, Math.max(0.2, Math.round(numeric * 100) / 100));
}

function linearize(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of an sRGB hex. Very dark stains are below 0.08. */
export function relativeLuminance(hex: string | null | undefined): number | null {
  const match = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!match) return null;
  const raw = match[1];
  const r = linearize(Number.parseInt(raw.slice(0, 2), 16));
  const g = linearize(Number.parseInt(raw.slice(2, 4), 16));
  const b = linearize(Number.parseInt(raw.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isVeryDarkCabinetStain(hex: string | null | undefined): boolean {
  const luminance = relativeLuminance(hex);
  return luminance != null && luminance < 0.08;
}

export function doorLightsForFinish(hex: string | null | undefined, exposureOverride?: number | null): DoorLightRig {
  const rig = isVeryDarkCabinetStain(hex) ? DARK_STAIN_DOOR_LIGHTS : RESTORED_DOOR_LIGHTS;
  const exposure = clampRenderExposure(exposureOverride);
  return exposure == null ? rig : { ...rig, exposure };
}

export const DEFAULT_CABINET_HEX = CABINET_NAME_COLORS.default;

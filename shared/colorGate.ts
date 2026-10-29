/**
 * Door color gate. A flat patch is measured under the same lights as the
 * door. The render proceeds when CIEDE2000 against the reference swatch is
 * at or below the threshold (default 3). Otherwise the base color is nudged
 * toward the swatch and measured again, up to three retries.
 */
import { deltaE2000Hex, parseHex, rgbToHex } from "./ciede2000";

export const DEFAULT_COLOR_DELTA_E = 3;
export const COLOR_GATE_RETRIES = 3;

export type ColorGateStatus = "pass" | "color-mismatch" | "needs-swatch";

export type ColorGateResult = {
  status: ColorGateStatus;
  /** Best base color to paint. On a block this is the closest attempt, not a blank. */
  hex: string;
  deltaE: number | null;
  attempts: number;
  label: string;
};

export function colorGateLabel(status: ColorGateStatus, deltaE: number | null): string {
  if (status === "needs-swatch") return "Needs swatch";
  if (status === "color-mismatch") {
    const shown = deltaE == null || Number.isNaN(deltaE) ? "?" : deltaE.toFixed(1);
    return `Color mismatch (dE ${shown})`;
  }
  return "Pass";
}

export function clampColorDeltaE(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isFinite(numeric)) return null;
  return Math.min(20, Math.max(0.5, Math.round(numeric * 10) / 10));
}

/** Move the base color so the lit patch lands closer to the swatch. */
export function nudgeHexToward(baseHex: string, measuredHex: string, swatchHex: string): string {
  const base = parseHex(baseHex);
  const measured = parseHex(measuredHex);
  const swatch = parseHex(swatchHex);
  if (!base || !measured || !swatch) return baseHex;
  const channels = [0, 1, 2].map((index) => {
    const baseChannel = [base.r, base.g, base.b][index] ?? 0;
    const measuredChannel = Math.max(1, [measured.r, measured.g, measured.b][index] ?? 1);
    const swatchChannel = [swatch.r, swatch.g, swatch.b][index] ?? 0;
    const scaled = baseChannel * (swatchChannel / measuredChannel);
    return baseChannel + (scaled - baseChannel) * 0.85;
  });
  return rgbToHex(channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0);
}

export async function runColorGate(input: {
  baseHex: string;
  swatchHex: string | null | undefined;
  threshold?: number | null;
  measure: (hex: string) => Promise<string>;
}): Promise<ColorGateResult> {
  const baseHex = input.baseHex.trim().toLowerCase();
  const swatchHex = input.swatchHex?.trim().toLowerCase() || null;
  const threshold = input.threshold ?? DEFAULT_COLOR_DELTA_E;
  if (!swatchHex || !parseHex(swatchHex)) {
    return { status: "needs-swatch", hex: baseHex, deltaE: null, attempts: 0, label: colorGateLabel("needs-swatch", null) };
  }
  if (!parseHex(baseHex)) {
    return { status: "color-mismatch", hex: baseHex, deltaE: null, attempts: 0, label: colorGateLabel("color-mismatch", null) };
  }

  let candidate = baseHex;
  let best = { hex: baseHex, deltaE: Number.POSITIVE_INFINITY };
  const attempts = 1 + COLOR_GATE_RETRIES;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const measured = (await input.measure(candidate)).trim().toLowerCase();
    const deltaE = deltaE2000Hex(measured, swatchHex);
    if (deltaE == null) {
      return { status: "color-mismatch", hex: best.hex, deltaE: null, attempts: attempt, label: colorGateLabel("color-mismatch", null) };
    }
    if (deltaE < best.deltaE) best = { hex: candidate, deltaE };
    if (deltaE <= threshold) {
      return { status: "pass", hex: candidate, deltaE, attempts: attempt, label: colorGateLabel("pass", deltaE) };
    }
    if (attempt < attempts) candidate = nudgeHexToward(candidate, measured, swatchHex);
  }
  return {
    status: "color-mismatch",
    hex: best.hex,
    deltaE: best.deltaE,
    attempts,
    label: colorGateLabel("color-mismatch", best.deltaE),
  };
}

export class ColorGateBlock extends Error {
  readonly gateStatus: "color-mismatch" | "needs-swatch";
  readonly deltaE: number | null;

  constructor(result: ColorGateResult) {
    super(result.label);
    this.name = "ColorGateBlock";
    this.gateStatus = result.status === "needs-swatch" ? "needs-swatch" : "color-mismatch";
    this.deltaE = result.deltaE;
  }
}

export function isColorGateBlock(error: unknown): error is ColorGateBlock {
  return error instanceof ColorGateBlock || (error instanceof Error && error.name === "ColorGateBlock");
}

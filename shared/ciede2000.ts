/**
 * CIEDE2000 (Sharma, Wu, Dalal 2005) and sRGB → CIE L*a*b* (D65, 2°).
 * Lab white point is the standard D65 XYZ (95.047, 100, 108.883).
 */

export type Lab = { L: number; a: number; b: number };

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

export function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const raw = match[1];
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((channel) => clampByte(channel).toString(16).padStart(2, "0")).join("")}`;
}

function linearize(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** sRGB hex to CIE L*a*b* under D65. */
export function labFromHex(hex: string): Lab | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const r = linearize(rgb.r);
  const g = linearize(rgb.g);
  const b = linearize(rgb.b);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
  const z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
  const pivot = (value: number) => (value > 0.008856 ? Math.cbrt(value) : (7.787 * value) + (16 / 116));
  const fx = pivot(x);
  const fy = pivot(y);
  const fz = pivot(z);
  return {
    L: (116 * fy) - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function hypot(a: number, b: number): number {
  return Math.sqrt(a * a + b * b);
}

/**
 * CIEDE2000 color difference. Identical colors return 0.
 * The reference pair used in tests is Sharma 2005 pair 1 (ΔE ≈ 2.0425).
 */
export function deltaE2000(first: Lab, second: Lab): number {
  const avgLp = (first.L + second.L) / 2;
  const c1 = hypot(first.a, first.b);
  const c2 = hypot(second.a, second.b);
  const avgC = (c1 + c2) / 2;
  const avgC7 = Math.pow(avgC, 7);
  const g = 0.5 * (1 - Math.sqrt(avgC7 / (avgC7 + Math.pow(25, 7))));
  const a1p = first.a * (1 + g);
  const a2p = second.a * (1 + g);
  const c1p = hypot(a1p, first.b);
  const c2p = hypot(a2p, second.b);
  const avgCp = (c1p + c2p) / 2;
  const h1p = Math.atan2(first.b, a1p);
  const h2p = Math.atan2(second.b, a2p);
  const h1 = h1p >= 0 ? h1p : h1p + 2 * Math.PI;
  const h2 = h2p >= 0 ? h2p : h2p + 2 * Math.PI;
  let deltahp = h2 - h1;
  if (c1p * c2p === 0) deltahp = 0;
  else if (Math.abs(deltahp) > Math.PI) deltahp += deltahp > 0 ? -2 * Math.PI : 2 * Math.PI;
  const deltaLp = second.L - first.L;
  const deltaCp = c2p - c1p;
  const deltaHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(deltahp / 2);
  let avgHp = (h1 + h2) / 2;
  if (c1p * c2p === 0) avgHp = h1 + h2;
  else if (Math.abs(h1 - h2) > Math.PI) avgHp += h1 + h2 < 2 * Math.PI ? Math.PI : -Math.PI;
  const t = 1
    - 0.17 * Math.cos(avgHp - Math.PI / 6)
    + 0.24 * Math.cos(2 * avgHp)
    + 0.32 * Math.cos(3 * avgHp + Math.PI / 30)
    - 0.20 * Math.cos(4 * avgHp - (63 * Math.PI) / 180);
  const avgLp50 = avgLp - 50;
  const sL = 1 + (0.015 * avgLp50 * avgLp50) / Math.sqrt(20 + avgLp50 * avgLp50);
  const sC = 1 + 0.045 * avgCp;
  const sH = 1 + 0.015 * avgCp * t;
  const avgCp7 = Math.pow(avgCp, 7);
  const rC = 2 * Math.sqrt(avgCp7 / (avgCp7 + Math.pow(25, 7)));
  const hueDegrees = (avgHp * 180) / Math.PI;
  const deltaTheta = (30 * Math.PI / 180) * Math.exp(-Math.pow((hueDegrees - 275) / 25, 2));
  const rT = -rC * Math.sin(2 * deltaTheta);
  const lTerm = deltaLp / sL;
  const cTerm = deltaCp / sC;
  const hTerm = deltaHp / sH;
  return Math.sqrt(lTerm * lTerm + cTerm * cTerm + hTerm * hTerm + rT * cTerm * hTerm);
}

export function deltaE2000Hex(firstHex: string, secondHex: string): number | null {
  const first = labFromHex(firstHex);
  const second = labFromHex(secondHex);
  if (!first || !second) return null;
  return deltaE2000(first, second);
}

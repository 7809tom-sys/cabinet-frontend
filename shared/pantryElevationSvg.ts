import type { PantryMasterCode } from "./pantryMasterCodes";

const PX_PER_INCH = 4;

/**
 * Simple front elevation of one pantry stack. The base is the lower rectangle.
 * Dimensions are the master definition, in inches.
 */
export function pantryElevationSvg(master: PantryMasterCode): string {
  const base = master.components.find((part) => part.role === "base");
  const top = master.components.find((part) => part.role === "top");
  if (!base || !top) throw new Error(`Pantry ${master.masterCode} needs a base and a top`);
  const boxW = master.widthIn * PX_PER_INCH;
  const baseH = base.heightIn * PX_PER_INCH;
  const topH = top.heightIn * PX_PER_INCH;
  const padL = 64;
  const padR = 72;
  const padT = 16;
  const padB = 36;
  const width = padL + boxW + padR;
  const height = padT + topH + baseH + padB;
  const x = padL;
  const yTop = padT;
  const yBase = padT + topH;
  const drawers = drawerBands(x, yBase, boxW, baseH, base.drawerCount ?? 0);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(master.shoppingDescription)}">`,
    `<rect x="${x}" y="${yTop}" width="${boxW}" height="${topH}" fill="#f4f1ea" stroke="#1f2933" stroke-width="1.5"/>`,
    `<rect x="${x}" y="${yBase}" width="${boxW}" height="${baseH}" fill="#f4f1ea" stroke="#1f2933" stroke-width="1.5"/>`,
    drawers,
    text(x + boxW / 2, yTop + topH / 2, top.code, "middle"),
    text(x + boxW / 2, yBase + baseH / 2, base.code, "middle"),
    text(x - 8, yTop + topH / 2, `${trim(top.heightIn)}"`, "end"),
    text(x - 8, yBase + baseH / 2, `${trim(base.heightIn)}"`, "end"),
    text(x + boxW + 8, yTop + (topH + baseH) / 2, `${trim(master.heightIn)}"`, "start"),
    text(x + boxW / 2, yBase + baseH + 22, `${trim(master.widthIn)}" W`, "middle"),
    `</svg>`,
  ].filter(Boolean).join("");
}

function drawerBands(x: number, y: number, width: number, height: number, count: number): string {
  if (count < 2) return "";
  const lines: string[] = [];
  for (let index = 1; index < count; index += 1) {
    const yLine = round(y + (height * index) / count);
    lines.push(`<line x1="${x}" y1="${yLine}" x2="${x + width}" y2="${yLine}" stroke="#1f2933" stroke-width="1"/>`);
  }
  return lines.join("");
}

function text(x: number, y: number, value: string, anchor: "start" | "middle" | "end"): string {
  return `<text x="${round(x)}" y="${round(y)}" text-anchor="${anchor}" dominant-baseline="middle" font-family="sans-serif" font-size="12" fill="#1f2933">${escapeXml(value)}</text>`;
}

function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

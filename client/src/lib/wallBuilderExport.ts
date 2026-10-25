import { formatEighthInches } from "./design";
import { wallBuilderGeometry, wallBuilderMetrics, type WallBuilderSegment } from "./polygonRoom";

const EXPORT_WIDTH = 1400;
const EXPORT_HEIGHT = 1000;
const PLAN_LEFT = 90;
const PLAN_TOP = 185;
const PLAN_WIDTH = EXPORT_WIDTH - PLAN_LEFT * 2;
const PLAN_HEIGHT = EXPORT_HEIGHT - PLAN_TOP - 95;

function rotatePoint(point: { x: number; y: number }, rotationDeg: number) {
  const rotation = ((rotationDeg % 360) + 360) % 360;
  if (rotation === 90) return { x: -point.y, y: point.x };
  if (rotation === 180) return { x: -point.x, y: -point.y };
  if (rotation === 270) return { x: point.y, y: -point.x };
  return point;
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}

export interface WallBuilderExportDocument {
  svg: string;
  width: number;
  height: number;
}

export function buildWallBuilderExportSvg(
  segments: WallBuilderSegment[],
  viewRotationDeg = 0,
  wallHeightIn = 96,
): WallBuilderExportDocument {
  if (segments.length === 0) throw new Error("Add at least one wall before exporting the room layout.");
  const geometry = wallBuilderGeometry(segments);
  const metrics = wallBuilderMetrics(segments);
  if (geometry.error) throw new Error(geometry.error);
  const points = geometry.points.map((point) => rotatePoint(point, viewRotationDeg));
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const sourceWidth = Math.max(36, maxX - minX);
  const sourceHeight = Math.max(36, maxY - minY);
  const scale = Math.min(PLAN_WIDTH / sourceWidth, PLAN_HEIGHT / sourceHeight);
  const renderedWidth = (maxX - minX) * scale;
  const renderedHeight = (maxY - minY) * scale;
  const offsetX = PLAN_LEFT + (PLAN_WIDTH - renderedWidth) / 2 - minX * scale;
  const offsetY = PLAN_TOP + (PLAN_HEIGHT - renderedHeight) / 2 - minY * scale;
  const mapPoint = (point: { x: number; y: number }) => ({
    x: offsetX + point.x * scale,
    y: offsetY + point.y * scale,
  });
  const mapped = points.map(mapPoint);
  const path = mapped.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const wallRows = segments.map((segment, index) => {
    const start = mapped[index];
    const end = mapped[index + 1];
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const label = escapeXml(`Wall ${index + 1} · ${formatEighthInches(segment.lengthIn)}`);
    const labelWidth = Math.max(126, label.length * 8.2);
    return `<g data-wall="${index + 1}">
      <rect x="${(midX - labelWidth / 2).toFixed(2)}" y="${(midY - 19).toFixed(2)}" width="${labelWidth.toFixed(2)}" height="38" rx="10" fill="#ffffff" stroke="#d4a75a" stroke-width="2"/>
      <text x="${midX.toFixed(2)}" y="${(midY + 6).toFixed(2)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#1a2744">${label}</text>
    </g>`;
  }).join("\n");
  const endpointDots = mapped.map((point, index) => `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${index === 0 ? 9 : 7}" fill="${index === 0 ? "#d4a75a" : "#1a2744"}" stroke="#ffffff" stroke-width="3"/>`).join("\n");
  const status = geometry.closed ? "Closed room" : "Open connected wall path";
  const title = "CabinetDealz Room Layout";
  const areaLabel = metrics.areaSqFt == null ? "Area pending closure" : `${metrics.areaSqFt.toFixed(1)} sq ft`;
  const subtitle = `${segments.length} wall${segments.length === 1 ? "" : "s"} · ${formatEighthInches(metrics.perimeterIn)} perimeter · ${areaLabel} · ${formatEighthInches(wallHeightIn)} wall height · ${status}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${EXPORT_WIDTH}" height="${EXPORT_HEIGHT}" viewBox="0 0 ${EXPORT_WIDTH} ${EXPORT_HEIGHT}" role="img" aria-label="${escapeXml(title)}">
    <defs>
      <pattern id="export-grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d9e5df" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="${EXPORT_WIDTH}" height="${EXPORT_HEIGHT}" fill="#fbfaf6"/>
    <rect x="40" y="40" width="${EXPORT_WIDTH - 80}" height="${EXPORT_HEIGHT - 80}" rx="24" fill="#ffffff" stroke="#d8c7a1" stroke-width="2"/>
    <text x="${PLAN_LEFT}" y="92" font-family="Georgia, serif" font-size="40" font-weight="700" fill="#1a2744">${escapeXml(title)}</text>
    <text x="${PLAN_LEFT}" y="132" font-family="Arial, sans-serif" font-size="19" fill="#546174">${escapeXml(subtitle)}</text>
    <text x="${EXPORT_WIDTH - PLAN_LEFT}" y="92" text-anchor="end" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#765416">VIEW ${((viewRotationDeg % 360) + 360) % 360}°</text>
    <rect x="${PLAN_LEFT}" y="${PLAN_TOP}" width="${PLAN_WIDTH}" height="${PLAN_HEIGHT}" rx="18" fill="url(#export-grid)" stroke="#d9e5df" stroke-width="2"/>
    ${geometry.closed ? `<path d="${path} Z" fill="#d4a75a" fill-opacity="0.12" stroke="none"/>` : ""}
    <path d="${path}" fill="none" stroke="#1a2744" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    ${endpointDots}
    ${wallRows}
    <text x="${PLAN_LEFT}" y="${EXPORT_HEIGHT - 58}" font-family="Arial, sans-serif" font-size="16" fill="#6b7280">Measurements are in inches and preserved to the nearest 1/8 inch.</text>
    <text x="${EXPORT_WIDTH - PLAN_LEFT}" y="${EXPORT_HEIGHT - 58}" text-anchor="end" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#1a2744">Generated by CabinetDealz 3D Designer</text>
  </svg>`;

  return { svg, width: EXPORT_WIDTH, height: EXPORT_HEIGHT };
}

async function exportCanvas(
  segments: WallBuilderSegment[],
  viewRotationDeg: number,
  wallHeightIn: number,
): Promise<HTMLCanvasElement> {
  const document = buildWallBuilderExportSvg(segments, viewRotationDeg, wallHeightIn);
  const blob = new Blob([document.svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The room layout image could not be generated."));
    });
    const canvas = window.document.createElement("canvas");
    canvas.width = document.width;
    canvas.height = document.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The room layout image could not be generated.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, document.width, document.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The room layout file could not be generated."));
    }, type, 1);
  });
}

export async function downloadWallBuilderPng(
  segments: WallBuilderSegment[],
  viewRotationDeg: number,
  wallHeightIn: number,
) {
  const canvas = await exportCanvas(segments, viewRotationDeg, wallHeightIn);
  downloadBlob(await canvasToBlob(canvas, "image/png"), "cabinetdealz-room-layout.png");
}

export async function downloadWallBuilderPdf(
  segments: WallBuilderSegment[],
  viewRotationDeg: number,
  wallHeightIn: number,
) {
  const canvas = await exportCanvas(segments, viewRotationDeg, wallHeightIn);
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const ratio = Math.min((pageWidth - margin * 2) / canvas.width, (pageHeight - margin * 2) / canvas.height);
  const width = canvas.width * ratio;
  const height = canvas.height * ratio;
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", (pageWidth - width) / 2, (pageHeight - height) / 2, width, height, undefined, "FAST");
  pdf.save("cabinetdealz-room-layout.pdf");
}

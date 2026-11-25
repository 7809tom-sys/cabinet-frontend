/**
 * Countertop line drawing for a countertop quote: a black-line, top-down plan of
 * every slab in the design with its edge lengths, the sink/cooktop openings and
 * the room outline, ready to hand to a fabrication shop (SVG or one-page PDF).
 *
 * The geometry is the Countertop Fabrication Sheet's (same slabs the plan, 3D
 * and cart use), rebuilt from the design snapshot saved on the quote. Nothing
 * is guessed: a slab the snapshot does not hold is not drawn, and the sheet's
 * "not in this design" list is printed under the drawing.
 */
import {
  buildCountertopFabricationSheet,
  type CountertopFabricationInput,
  type CountertopFabricationSheet,
  type FabricationPoint,
  type FabricationRun,
  type FabricationSurfacePick,
} from "@/lib/countertopFabricationSheet";
import { fabricationLength } from "@/lib/countertopFabricationSheetPdf";
import type { IslandZone, PlacedCabinet, PonyWall, RoomData, SinkFixture } from "@/lib/design";

// ── rebuilding the design from a saved quote ─────────────────────────────────

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return record(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function list<T>(value: unknown): T[] {
  if (typeof value === "string") {
    try {
      return list<T>(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? (value as T[]) : [];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Extra fabrication facts the quote dialog saves under roomData.quoteFabrication. */
export type QuoteFabricationExtras = {
  selectedSurfaces?: FabricationSurfacePick[];
  edgeProfileId?: string | null;
  backsplash?: { heightIn?: number | null; fullHeight?: boolean | null } | null;
  job?: CountertopFabricationInput["job"];
};

export type CountertopQuoteSnapshot = {
  id: number;
  roomData?: unknown;
  placedCabinets?: unknown;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  createdAt?: unknown;
};

/**
 * Fabrication input from the design snapshot saved on a countertop quote, or
 * null when the quote has no usable room. Island, sinks and pony walls come
 * from roomData.persistedEntities when the snapshot carries them.
 */
export function quoteFabricationInput(quote: CountertopQuoteSnapshot): CountertopFabricationInput | null {
  const room = record(quote.roomData);
  const width = Number(room?.width);
  const depth = Number(room?.depth);
  if (!room || !(width > 0) || !(depth > 0)) return null;
  const placed = list<PlacedCabinet>(quote.placedCabinets);
  const entities = record(room.persistedEntities);
  const extras = (record(room.quoteFabrication) ?? {}) as QuoteFabricationExtras;
  const created = quote.createdAt ? new Date(quote.createdAt as string) : null;
  return {
    room: room as unknown as RoomData,
    placed,
    island: (record(entities?.island) as IslandZone | null) ?? null,
    sinks: list<SinkFixture>(entities?.sinks),
    ponyWalls: list<PonyWall>(entities?.ponyWalls),
    selectedSurfaces: Array.isArray(extras.selectedSurfaces) ? extras.selectedSurfaces : [],
    edgeProfileId: text(extras.edgeProfileId),
    backsplash: extras.backsplash ?? null,
    job: {
      ...(extras.job ?? {}),
      projectName: text(extras.job?.projectName) ?? `Countertop quote #${quote.id}`,
      customerName: text(quote.contactName) ?? text(extras.job?.customerName),
      customerEmail: text(quote.contactEmail) ?? text(extras.job?.customerEmail),
      customerPhone: text(quote.contactPhone) ?? text(extras.job?.customerPhone),
    },
    now: created && !Number.isNaN(created.getTime()) ? created : undefined,
  };
}

/** The fabrication sheet for a saved quote, or null when the quote has no room. */
export function quoteFabricationSheet(quote: CountertopQuoteSnapshot): CountertopFabricationSheet | null {
  const input = quoteFabricationInput(quote);
  return input ? buildCountertopFabricationSheet(input) : null;
}

// ── shared drawing model (SVG and PDF draw the same thing) ───────────────────

const HIDDEN_BRANDS = /pelican|us\s*cabinet\s*depot|\buscd\b|hardware\s*resources|line\s*dl/gi;

/** Supplier names never print on a drawing that leaves the building. */
export function lineArtText(value: string): string {
  return value.replace(HIDDEN_BRANDS, "").replace(/\s{2,}/g, " ").replace(/^[\s·,-]+|[\s·,-]+$/g, "").trim();
}

export type LineArtSegment = { from: FabricationPoint; to: FabricationPoint; weight: "room" | "slab" | "finished" | "dim" | "cutout" };
export type LineArtLabel = { at: FabricationPoint; text: string; size: "title" | "label" | "dim" | "note"; angle?: number; anchor?: "start" | "middle" };

export type LineArtModel = {
  width: number;
  height: number;
  segments: LineArtSegment[];
  labels: LineArtLabel[];
  /** Font size unit (plan inches) the labels scale from. */
  unit: number;
};

const add = (a: FabricationPoint, b: FabricationPoint): FabricationPoint => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: FabricationPoint, k: number): FabricationPoint => ({ x: a.x * k, y: a.y * k });
const sub = (a: FabricationPoint, b: FabricationPoint): FabricationPoint => ({ x: a.x - b.x, y: a.y - b.y });

function centroid(points: readonly FabricationPoint[]): FabricationPoint {
  const sum = points.reduce((acc, point) => add(acc, point), { x: 0, y: 0 });
  return scale(sum, 1 / Math.max(points.length, 1));
}

function pointInPolygon(point: FabricationPoint, polygon: readonly FabricationPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Readable angle (degrees) for text along a direction, never upside down. */
function textAngle(direction: FabricationPoint): number {
  let angle = (Math.atan2(direction.y, direction.x) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle <= -90) angle += 180;
  return Math.round(angle * 10) / 10;
}

function runSegments(run: FabricationRun, unit: number, segments: LineArtSegment[], labels: LineArtLabel[]) {
  const plan = run.planOutline;
  if (plan.length < 3) return;
  run.edges.forEach((edge, index) => {
    const from = plan[index]!;
    const to = plan[(index + 1) % plan.length]!;
    segments.push({ from, to, weight: edge.exposed ? "finished" : "slab" });
    if (edge.lengthIn < 3) return;
    // Dimension line just outside the slab, parallel to the edge, with end ticks.
    const direction = sub(to, from);
    const length = Math.hypot(direction.x, direction.y) || 1;
    const along = scale(direction, 1 / length);
    let normal = { x: along.y, y: -along.x };
    const mid = scale(add(from, to), 0.5);
    if (pointInPolygon(add(mid, scale(normal, 0.5)), plan)) normal = scale(normal, -1);
    const offset = unit * 1.6;
    const a = add(from, scale(normal, offset));
    const b = add(to, scale(normal, offset));
    segments.push({ from: a, to: b, weight: "dim" });
    const tick = scale(normal, unit * 0.5);
    segments.push({ from: sub(a, tick), to: add(a, tick), weight: "dim" });
    segments.push({ from: sub(b, tick), to: add(b, tick), weight: "dim" });
    labels.push({ at: add(scale(add(a, b), 0.5), scale(normal, unit * 0.9)), text: fabricationLength(edge.lengthIn), size: "dim", angle: textAngle(along), anchor: "middle" });
  });

  const along = sub(plan[1]!, plan[0]!);
  const alongLength = Math.hypot(along.x, along.y) || 1;
  const u = scale(along, 1 / alongLength);
  const v = { x: -u.y, y: u.x };
  for (const cutout of run.cutouts) {
    if (!cutout.planCenter) continue;
    const center = cutout.planCenter;
    if (cutout.alongIn && cutout.acrossIn) {
      const hu = scale(u, cutout.alongIn / 2);
      const hv = scale(v, cutout.acrossIn / 2);
      const corners = [sub(sub(center, hu), hv), sub(add(center, hu), hv), add(add(center, hu), hv), add(sub(center, hu), hv)];
      corners.forEach((corner, i) => segments.push({ from: corner, to: corners[(i + 1) % 4]!, weight: "cutout" }));
    } else {
      const r = unit;
      segments.push({ from: add(center, { x: -r, y: -r }), to: add(center, { x: r, y: r }), weight: "cutout" });
      segments.push({ from: add(center, { x: -r, y: r }), to: add(center, { x: r, y: -r }), weight: "cutout" });
    }
    const kind = cutout.kind === "sink" ? "Sink" : "Cooktop";
    const size = cutout.alongIn && cutout.acrossIn ? ` ${fabricationLength(cutout.alongIn)} x ${fabricationLength(cutout.acrossIn)}` : "";
    labels.push({ at: center, text: `${kind} cutout${size}`, size: "note", angle: textAngle(u), anchor: "middle" });
  }

  const label = lineArtText(`${run.label} · ${fabricationLength(run.lengthIn)} x ${fabricationLength(run.depthIn)}`);
  // Put the run label in the longest stretch of the slab that has no opening.
  const center = centroid(plan);
  const project = (p: FabricationPoint) => (p.x - center.x) * u.x + (p.y - center.y) * u.y;
  const ends = plan.map(project);
  const busy = run.cutouts
    .filter((cutout) => cutout.planCenter)
    .map((cutout) => {
      const c = project(cutout.planCenter!);
      const half = (cutout.alongIn ?? unit * 2) / 2;
      return [c - half, c + half] as const;
    })
    .sort((a, b) => a[0] - b[0]);
  let best = { from: Math.min(...ends), to: Math.max(...ends) };
  if (busy.length) {
    const gaps: { from: number; to: number }[] = [];
    let cursor = Math.min(...ends);
    for (const [from, to] of busy) {
      gaps.push({ from: cursor, to: from });
      cursor = Math.max(cursor, to);
    }
    gaps.push({ from: cursor, to: Math.max(...ends) });
    best = gaps.reduce((a, b) => (b.to - b.from > a.to - a.from ? b : a));
  }
  const labelAt = add(center, scale(u, (best.from + best.to) / 2));
  labels.push({ at: labelAt, text: label, size: "label", angle: textAngle(u), anchor: "middle" });
}

/**
 * The plan as plain segments and labels in room inches, origin at the room's
 * top-left, plus a title block below the room. Empty sheets give a model with
 * only the room and the title.
 */
export function buildLineArtModel(sheet: CountertopFabricationSheet, options: { title?: string | null } = {}): LineArtModel {
  const points = [
    { x: 0, y: 0 },
    { x: sheet.room.widthIn, y: sheet.room.depthIn },
    ...sheet.runs.flatMap((run) => run.planOutline),
  ];
  const minX = Math.min(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxX = Math.max(...points.map((p) => p.x));
  const maxY = Math.max(...points.map((p) => p.y));
  const span = Math.max(maxX - minX, maxY - minY, 24);
  const unit = Math.max(span / 60, 1.2);
  const margin = unit * 6;
  const shift = { x: margin - minX, y: margin - minY };
  const move = (p: FabricationPoint) => add(p, shift);

  const segments: LineArtSegment[] = [];
  const labels: LineArtLabel[] = [];
  const roomCorners = [{ x: 0, y: 0 }, { x: sheet.room.widthIn, y: 0 }, { x: sheet.room.widthIn, y: sheet.room.depthIn }, { x: 0, y: sheet.room.depthIn }];
  roomCorners.forEach((corner, i) => segments.push({ from: corner, to: roomCorners[(i + 1) % 4]!, weight: "room" }));
  labels.push({ at: { x: sheet.room.widthIn / 2, y: -unit * 3.6 }, text: `Room ${fabricationLength(sheet.room.widthIn)} wide`, size: "note", anchor: "middle" });
  labels.push({ at: { x: -unit * 3.6, y: sheet.room.depthIn / 2 }, text: `Room ${fabricationLength(sheet.room.depthIn)} deep`, size: "note", angle: -90, anchor: "middle" });
  for (const run of sheet.runs) runSegments(run, unit, segments, labels);

  const height = maxY - minY + margin * 2;
  const blockTop = height + unit;
  const title = lineArtText(options.title?.trim() || "Countertop line drawing");
  const notes = [
    `${sheet.totals.runCount} piece${sheet.totals.runCount === 1 ? "" : "s"} · ${sheet.totals.squareFeet} sq ft · ${sheet.totals.linearFeet} lin ft · ${sheet.totals.cutoutCount} cutout${sheet.totals.cutoutCount === 1 ? "" : "s"}`,
    "Top-down plan. Dimensions in inches. Heavy lines are finished (profiled) edges; thin lines sit against a wall or seam.",
    "Verify every dimension on site before cutting.",
    ...(sheet.empty ? ["This design has no countertop run yet, so there is nothing to fabricate."] : []),
    ...sheet.unknowns.slice(0, 6).map((unknown) => `Not in this design: ${unknown}`),
  ].map(lineArtText);
  const left = { x: -shift.x + unit, y: 0 };
  labels.push({ at: { x: left.x, y: blockTop - shift.y + unit * 1.2 }, text: title, size: "title", anchor: "start" });
  notes.forEach((note, i) => labels.push({ at: { x: left.x, y: blockTop - shift.y + unit * (3.2 + i * 1.6) }, text: note, size: "note", anchor: "start" }));
  const totalHeight = blockTop + unit * (3.2 + notes.length * 1.6) + unit;

  return {
    width: Math.round((maxX - minX + margin * 2) * 100) / 100,
    height: Math.round(totalHeight * 100) / 100,
    segments: segments.map((s) => ({ ...s, from: move(s.from), to: move(s.to) })),
    labels: labels.map((l) => ({ ...l, at: move(l.at) })),
    unit,
  };
}

const STROKE: Record<LineArtSegment["weight"], { width: number; dash?: string }> = {
  room: { width: 0.08, dash: "0.6 0.4" },
  slab: { width: 0.12 },
  finished: { width: 0.3 },
  dim: { width: 0.05 },
  cutout: { width: 0.1, dash: "0.5 0.3" },
};
const FONT: Record<LineArtLabel["size"], number> = { title: 1.3, label: 0.95, dim: 0.8, note: 0.75 };

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const n = (value: number) => String(Math.round(value * 100) / 100);

/** Standalone SVG: black lines on white, no colour, no fills. */
export function buildCountertopLineArtSvg(sheet: CountertopFabricationSheet, options: { title?: string | null } = {}): string {
  const model = buildLineArtModel(sheet, options);
  const u = model.unit;
  const lines = model.segments.map((segment) => {
    const stroke = STROKE[segment.weight];
    return `<line x1="${n(segment.from.x)}" y1="${n(segment.from.y)}" x2="${n(segment.to.x)}" y2="${n(segment.to.y)}" stroke="#000" stroke-width="${n(stroke.width * u)}"${stroke.dash ? ` stroke-dasharray="${stroke.dash.split(" ").map((d) => n(Number(d) * u)).join(" ")}"` : ""} stroke-linecap="round"/>`;
  });
  const texts = model.labels.map((label) => {
    const size = FONT[label.size] * u;
    const transform = label.angle ? ` transform="rotate(${label.angle} ${n(label.at.x)} ${n(label.at.y)})"` : "";
    const weight = label.size === "title" || label.size === "label" ? ` font-weight="bold"` : "";
    return `<text x="${n(label.at.x)}" y="${n(label.at.y)}" font-size="${n(size)}"${weight} text-anchor="${label.anchor ?? "middle"}" dominant-baseline="middle" fill="#000"${transform}>${xml(label.text)}</text>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(model.width)} ${n(model.height)}" width="${n(model.width * 8)}" height="${n(model.height * 8)}" font-family="Helvetica, Arial, sans-serif">`,
    `<rect x="0" y="0" width="${n(model.width)}" height="${n(model.height)}" fill="#fff"/>`,
    ...lines,
    ...texts,
    `</svg>`,
  ].join("\n");
}

export function lineArtFileName(quoteId: number, extension: "svg" | "pdf"): string {
  return `countertop-quote-${quoteId}-line-drawing.${extension}`;
}

type JsPdfDoc = import("jspdf").jsPDF;

/** One-page landscape PDF of the same drawing (jsPDF loaded on demand). */
export async function buildCountertopLineArtPdf(sheet: CountertopFabricationSheet, options: { title?: string | null } = {}): Promise<JsPdfDoc> {
  const { jsPDF } = await import("jspdf");
  const model = buildLineArtModel(sheet, options);
  const landscape = model.width >= model.height;
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 28;
  const k = Math.min((pageWidth - margin * 2) / model.width, (pageHeight - margin * 2) / model.height);
  const ox = (pageWidth - model.width * k) / 2;
  const oy = (pageHeight - model.height * k) / 2;
  const map = (p: FabricationPoint) => ({ x: ox + p.x * k, y: oy + p.y * k });
  doc.setDrawColor(0, 0, 0);
  doc.setTextColor(0, 0, 0);
  for (const segment of model.segments) {
    const stroke = STROKE[segment.weight];
    doc.setLineWidth(Math.max(stroke.width * model.unit * k, 0.3));
    doc.setLineDashPattern(stroke.dash ? stroke.dash.split(" ").map((d) => Number(d) * model.unit * k) : [], 0);
    const a = map(segment.from);
    const b = map(segment.to);
    doc.line(a.x, a.y, b.x, b.y);
  }
  doc.setLineDashPattern([], 0);
  for (const label of model.labels) {
    const at = map(label.at);
    doc.setFont("helvetica", label.size === "title" || label.size === "label" ? "bold" : "normal");
    doc.setFontSize(Math.max(FONT[label.size] * model.unit * k, 5));
    doc.text(label.text, at.x, at.y, { align: label.anchor === "start" ? "left" : "center", baseline: "middle", angle: label.angle ? -label.angle : 0 });
  }
  return doc;
}

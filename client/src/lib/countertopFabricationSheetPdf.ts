import {
  fabricationSheetFileName,
  fabricationSheetSummaryLines,
  type CountertopFabricationSheet,
  type FabricationCutout,
  type FabricationPoint,
  type FabricationRun,
} from "@/lib/countertopFabricationSheet";

/**
 * Print-ready Countertop Fabrication Sheet for the granite/quartz fabricator.
 *
 * The drawing is generated from the slab outlines the Designer already uses, so
 * every dimension on the page is a measured number from the design. Anything the
 * design does not hold is printed as an em dash and repeated in the "not in this
 * design" list — never filled with a shop default.
 */

const PAGE = { width: 612, height: 792 };
const MARGIN = 40;
const FOOTER_Y = 760;
const INK = "#111827";
const MUTED = "#4b5563";
const RULE = "#d1d5db";
const SLAB = "#eef2f6";
const SLAB_EDGE = "#1f2937";
const FINISHED_EDGE = "#1d4ed8";
const CUTOUT = "#b91c1c";
const WALL_EDGE = "#9ca3af";

type Doc = import("jspdf").jsPDF;

const em = "\u2014";

/** Inches without trailing zeros, or an em dash when the design has no value. */
export function fabricationLength(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return em;
  return Number.isInteger(value) ? `${value}"` : `${Math.round(value * 100) / 100}"`;
}

/** Feet-and-inches for the header sizes the shop reads at a glance. */
export function fabricationFeetInches(inches: number | null | undefined): string {
  if (inches == null || !Number.isFinite(inches)) return em;
  const rounded = Math.round(inches * 8) / 8;
  const feet = Math.floor(rounded / 12);
  const rest = Math.round((rounded - feet * 12) * 8) / 8;
  if (feet <= 0) return `${rest}"`;
  return rest === 0 ? `${feet}'` : `${feet}'-${rest}"`;
}

/** A field value that is genuinely absent from the design. */
export function fabricationField(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed || em;
}

function drawHeader(doc: Doc, sheet: CountertopFabricationSheet, brandName: string): number {
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("Countertop Fabrication Sheet", MARGIN, 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  const generated = new Date(sheet.job.generatedAt);
  doc.text(
    `${brandName} · generated ${Number.isNaN(generated.getTime()) ? em : generated.toLocaleString()}`,
    MARGIN,
    60,
  );
  doc.setDrawColor(RULE);
  doc.setLineWidth(0.75);
  doc.line(MARGIN, 68, PAGE.width - MARGIN, 68);
  return 82;
}

type KeyValue = [string, string];

/** A key/value grid whose rows grow with wrapped values, so text never bleeds into the next column. */
function drawKeyValues(doc: Doc, rows: KeyValue[], top: number, columns = 3): number {
  const gutter = 10;
  const width = (PAGE.width - MARGIN * 2) / columns;
  const labelHeight = 9;
  const valueLineHeight = 11;
  const valueLines = rows.map((row) => doc.splitTextToSize(row[1], width - gutter) as string[]);
  const rowHeights: number[] = [];
  for (let index = 0; index < rows.length; index += columns) {
    let tallest = 1;
    for (let offset = 0; offset < columns && index + offset < rows.length; offset += 1) {
      tallest = Math.max(tallest, valueLines[index + offset]!.length);
    }
    rowHeights.push(tallest);
  }

  let y = top;
  for (let index = 0; index < rows.length; index += columns) {
    const linesInRow = rowHeights[Math.floor(index / columns)]!;
    for (let offset = 0; offset < columns && index + offset < rows.length; offset += 1) {
      const x = MARGIN + offset * width;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(MUTED);
      doc.text(rows[index + offset]![0].toUpperCase(), x, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(INK);
      doc.text(valueLines[index + offset]!, x, y + labelHeight);
    }
    y += labelHeight + linesInRow * valueLineHeight + 7;
  }
  return y;
}

function drawSectionTitle(doc: Doc, title: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(INK);
  doc.text(title.toUpperCase(), MARGIN, y);
  doc.setDrawColor(RULE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y + 4, PAGE.width - MARGIN, y + 4);
  return y + 18;
}

/**
 * Draw one slab at a stated scale with its outline, finished edges, cutouts and
 * dimensions. Everything is in inches so the numbers match the design exactly.
 */
export function drawRun(
  doc: Doc,
  run: FabricationRun,
  originX: number,
  originY: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const padding = 26;
  const scale = Math.min(
    (maxWidth - padding * 2) / Math.max(run.lengthIn, 1),
    (maxHeight - padding * 2) / Math.max(run.depthIn, 1),
  );
  const drawWidth = run.lengthIn * scale;
  const drawHeight = run.depthIn * scale;
  const left = originX + padding;
  const top = originY + padding;
  const map = (point: FabricationPoint) => ({ x: left + point.x * scale, y: top + point.y * scale });
  const mapped = run.outline.map(map);

  // Slab fill.
  doc.setFillColor(SLAB);
  doc.setDrawColor(SLAB_EDGE);
  doc.setLineWidth(0.9);
  mapped.forEach((point, index) => {
    const next = mapped[(index + 1) % mapped.length]!;
    if (index === 0) doc.moveTo(point.x, point.y);
    doc.lineTo(next.x, next.y);
  });
  doc.close();
  doc.fill();

  // Outline, then the finished edges drawn heavier in the profile colour.
  doc.setDrawColor(SLAB_EDGE);
  doc.setLineWidth(0.9);
  mapped.forEach((point, index) => {
    const next = mapped[(index + 1) % mapped.length]!;
    doc.line(point.x, point.y, next.x, next.y);
  });
  doc.setDrawColor(FINISHED_EDGE);
  doc.setLineWidth(2.4);
  run.edges.forEach((edge) => {
    if (!edge.exposed) return;
    const from = map(edge.from);
    const to = map(edge.to);
    doc.line(from.x, from.y, to.x, to.y);
  });

  // Wall/seam edges get a dashed reminder so the shop knows which side is raw.
  doc.setDrawColor(WALL_EDGE);
  doc.setLineWidth(0.8);
  run.edges.forEach((edge) => {
    if (edge.exposed) return;
    const from = map(edge.from);
    const to = map(edge.to);
    const segments = Math.max(2, Math.round(edge.lengthIn / 2));
    for (let step = 0; step < segments; step += 1) {
      const t0 = step / segments;
      const t1 = Math.min(1, t0 + 0.55 / segments);
      doc.line(
        from.x + (to.x - from.x) * t0,
        from.y + (to.y - from.y) * t0,
        from.x + (to.x - from.x) * t1,
        from.y + (to.y - from.y) * t1,
      );
    }
  });

  // Cutouts.
  doc.setFontSize(6.5);
  run.cutouts.forEach((cutout) => {
    if (cutout.centerFromStartIn == null || cutout.centerFromFrontIn == null) return;
    const across = cutout.alongIn ?? 0;
    const deep = cutout.acrossIn ?? 0;
    const cx = left + cutout.centerFromStartIn * scale;
    const cy = top + cutout.centerFromFrontIn * scale;
    const w = across * scale;
    const h = deep * scale;
    doc.setDrawColor(CUTOUT);
    doc.setLineWidth(1.1);
    doc.setFillColor("#ffffff");
    doc.rect(cx - w / 2, cy - h / 2, w, h, "FD");
    doc.setTextColor(CUTOUT);
    doc.text(
      `${cutout.kind === "sink" ? "SINK" : "COOKTOP"} ${fabricationLength(cutout.alongIn)} x ${fabricationLength(cutout.acrossIn)}`,
      cx,
      cy - h / 2 - 3,
      { align: "center" },
    );
  });

  // Overall dimensions.
  doc.setDrawColor(MUTED);
  doc.setLineWidth(0.6);
  doc.setTextColor(MUTED);
  doc.setFontSize(7.5);
  const dimY = top + drawHeight + 16;
  doc.line(left, dimY, left + drawWidth, dimY);
  doc.line(left, dimY - 4, left, dimY + 4);
  doc.line(left + drawWidth, dimY - 4, left + drawWidth, dimY + 4);
  doc.text(`${fabricationLength(run.lengthIn)} long`, left + drawWidth / 2, dimY - 4, { align: "center" });
  const dimX = left + drawWidth + 16;
  doc.line(dimX, top, dimX, top + drawHeight);
  doc.line(dimX - 4, top, dimX + 4, top);
  doc.line(dimX - 4, top + drawHeight, dimX + 4, top + drawHeight);
  doc.text(`${fabricationLength(run.depthIn)} deep`, dimX + 6, top + drawHeight / 2, { angle: 90 });

  // A corner-shaped slab gets a note instead of a bounding-box claim.
  if (run.hasPolygon) {
    doc.setTextColor(MUTED);
    doc.setFontSize(6.5);
    doc.text("Shaped slab: cut to the outline above, not to the overall box.", left, top - 8);
  }

  return { width: maxWidth, height: Math.min(maxHeight, drawHeight + padding * 2 + 18) };
}

function drawRunTable(doc: Doc, sheet: CountertopFabricationSheet, y: number): number {
  const columns = [
    { label: "Run", width: 150 },
    { label: "Length", width: 66 },
    { label: "Depth", width: 66 },
    { label: "Finished edge", width: 84 },
    { label: "Area", width: 62 },
    { label: "Openings", width: 104 },
  ];
  let cursorX = MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED);
  for (const column of columns) {
    doc.text(column.label.toUpperCase(), cursorX, y);
    cursorX += column.width;
  }
  let rowY = y + 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  for (const run of sheet.runs) {
    if (rowY > 706) {
      doc.addPage();
      rowY = 60;
    }
    const cells = [
      run.label,
      fabricationLength(run.lengthIn),
      fabricationLength(run.depthIn),
      run.finishedEdgeLengthIn > 0 ? fabricationLength(run.finishedEdgeLengthIn) : em,
      `${run.areaSqFt} sq ft`,
      run.cutouts.length === 0
        ? "none"
        : run.cutouts.map((cutout) => `${cutout.kind === "sink" ? "sink" : "cooktop"} ${fabricationLength(cutout.alongIn)} x ${fabricationLength(cutout.acrossIn)}`).join("; "),
    ];
    cursorX = MARGIN;
    doc.setTextColor(INK);
    cells.forEach((cell, index) => {
      const column = columns[index]!;
      const wrapped = doc.splitTextToSize(cell, column.width - 6) as string[];
      doc.text(wrapped[0] ?? "", cursorX, rowY);
      cursorX += column.width;
    });
    doc.setDrawColor(RULE);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, rowY + 4, PAGE.width - MARGIN, rowY + 4);
    rowY += 14;
  }
  return rowY + 10;
}

function drawCutoutDetail(doc: Doc, sheet: CountertopFabricationSheet, y: number): number {
  const everyCutout: Array<{ run: string; cutout: FabricationCutout }> = [
    ...sheet.runs.flatMap((run) => run.cutouts.map((cutout) => ({ run: run.label, cutout }))),
    ...sheet.unmatchedCutouts.map((cutout) => ({ run: "Not located in a slab", cutout })),
  ];
  if (everyCutout.length === 0) return y;
  y = drawSectionTitle(doc, "Openings", y);
  doc.setFontSize(8);
  for (const { run, cutout } of everyCutout) {
    if (y > 726) {
      doc.addPage();
      y = 60;
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(INK);
    doc.text(`${cutout.kind === "sink" ? "Sink" : "Cooktop"} — ${cutout.label}`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(MUTED);
    doc.text(`on ${run}`, MARGIN + 190, y);
    y += 11;
    doc.setTextColor(INK);
    doc.text(
      `Opening ${fabricationLength(cutout.alongIn)} along x ${fabricationLength(cutout.acrossIn)} deep · `
      + `center ${fabricationLength(cutout.centerFromStartIn)} from run start, `
      + `${fabricationLength(cutout.centerFromFrontIn)} from the finished front edge`,
      MARGIN + 10,
      y,
    );
    y += 10;
    if (cutout.notes.length > 0) {
      doc.setTextColor(MUTED);
      for (const note of cutout.notes) {
        const wrapped = doc.splitTextToSize(`• ${note}`, PAGE.width - MARGIN * 2 - 10) as string[];
        doc.text(wrapped, MARGIN + 10, y);
        y += wrapped.length * 9;
      }
    }
    y += 5;
  }
  return y + 6;
}

function drawCornersAndNotes(doc: Doc, sheet: CountertopFabricationSheet, y: number): number {
  if (sheet.corners.length > 0) {
    if (y > 640) {
      doc.addPage();
      y = 60;
    }
    y = drawSectionTitle(doc, "Corners & joints", y);
    doc.setFontSize(8);
    for (const corner of sheet.corners) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(INK);
      doc.text(corner.kind, MARGIN, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(MUTED);
      const detail = [
        corner.runs.length > 0 ? corner.runs.join(" + ") : null,
        corner.legsIn.some((leg) => leg != null) ? `legs ${corner.legsIn.map((leg) => fabricationFeetInches(leg)).join(" / ")}` : null,
      ].filter(Boolean).join(" · ");
      if (detail) doc.text(detail, MARGIN + 150, y);
      y += 10;
      for (const note of corner.notes) {
        const wrapped = doc.splitTextToSize(`• ${note}`, PAGE.width - MARGIN * 2) as string[];
        doc.text(wrapped, MARGIN + 10, y);
        y += wrapped.length * 9;
      }
      y += 3;
    }
    y += 6;
  }

  if (y > 620) {
    doc.addPage();
    y = 60;
  }
  y = drawSectionTitle(doc, "Not stored on this design", y);
  doc.setFontSize(8);
  doc.setTextColor(INK);
  for (const unknown of sheet.unknowns) {
    const wrapped = doc.splitTextToSize(`• ${unknown}`, PAGE.width - MARGIN * 2) as string[];
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 10 + 2;
  }

  if (y > 690) {
    doc.addPage();
    y = 60;
  }
  y = drawSectionTitle(doc, "Fabrication notes", y);
  doc.setFontSize(8);
  doc.setTextColor(INK);
  const notes = [
    "All dimensions are nominal and taken from the customer's design; field-verify before cutting.",
    `Finished front overhang on wall runs: ${fabricationLength(sheet.frontOverhangIn)} past the cabinet face.`,
    sheet.edgeProfile
      ? `Edge profile: ${sheet.edgeProfile.name} on every finished edge (drawn blue).`
      : "Edge profile: not selected in the design.",
    sheet.backsplash
      ? `Backsplash: ${sheet.backsplash.fullHeight ? "full height" : fabricationLength(sheet.backsplash.heightIn)}.`
      : "Backsplash: not specified in the design.",
  ];
  for (const note of notes) {
    const wrapped = doc.splitTextToSize(`• ${note}`, PAGE.width - MARGIN * 2) as string[];
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 10 + 2;
  }
  return y;
}

/** Build the whole fabrication sheet. Pure: no DOM, no downloads, no I/O. */
export function buildFabricationSheetPdf(
  sheet: CountertopFabricationSheet,
  brandName?: string | null,
  jsPDFConstructor?: JsPdfConstructor,
): Doc {
  if (!jsPDFConstructor && !defaultJsPdf) {
    throw new Error("Call ensureJsPdf() before building a PDF outside the async helpers.");
  }
  const JsPdf = jsPDFConstructor ?? defaultJsPdf!;
  const doc = new JsPdf({ orientation: "portrait", unit: "pt", format: "letter" });
  const brand = (brandName ?? "").trim() || "CabinetDealz";
  let y = drawHeader(doc, sheet, brand);

  y = drawKeyValues(doc, [
    ["Job / project", fabricationField(sheet.job.projectName)],
    ["Design", fabricationField(sheet.job.designName)],
    ["Room", fabricationField(sheet.job.roomLabel)],
    ["Customer", fabricationField(sheet.job.customerName)],
    ["Customer email", fabricationField(sheet.job.customerEmail)],
    ["Customer phone", fabricationField(sheet.job.customerPhone)],
    ["Room size", `${fabricationFeetInches(sheet.room.widthIn)} x ${fabricationFeetInches(sheet.room.depthIn)}`],
    ["Runs", `${sheet.totals.runCount}`],
    ["Total area", `${sheet.totals.squareFeet} sq ft · ${sheet.totals.linearFeet} lin ft`],
  ], y);

  y += 6;
  const perimeter = sheet.materials[0];
  const islandMaterial = sheet.materials[1];
  const materialLine = [
    perimeter?.name ? `${perimeter.name}${perimeter.code ? ` (${perimeter.code})` : ""}` : em,
    perimeter?.size ? `slab ${perimeter.size}` : null,
    islandMaterial?.name && islandMaterial.name !== perimeter?.name
      ? `island: ${islandMaterial.name}${islandMaterial.code ? ` (${islandMaterial.code})` : ""}`
      : null,
  ].filter(Boolean).join(" · ");
  y = drawKeyValues(doc, [
    ["Countertop material", materialLine],
    ["Edge profile", sheet.edgeProfile ? sheet.edgeProfile.name : em],
    ["Backsplash", sheet.backsplash
      ? (sheet.backsplash.fullHeight ? "Full height" : fabricationLength(sheet.backsplash.heightIn))
      : em],
  ], y, 3);

  if (sheet.empty) {
    doc.setFontSize(11);
    doc.setTextColor(MUTED);
    doc.text("This design has no countertop-bearing run, so there is nothing to fabricate yet.", MARGIN, y + 20);
    return doc;
  }

  y += 10;
  y = drawSectionTitle(doc, "Slab plan & dimensions", y);
  let drawingY = y;
  for (const run of sheet.runs) {
    const available = 720 - drawingY;
    if (available < 120) {
      doc.addPage();
      drawingY = 56;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(INK);
    doc.text(`${run.label} — ${run.lengthIn}" x ${run.depthIn}"`, MARGIN, drawingY);
    const drawn = drawRun(doc, run, MARGIN, drawingY + 6, PAGE.width - MARGIN * 2, 190);
    drawingY += 6 + Math.max(drawn.height, 90) + 12;
  }

  let tableY = drawingY + 4;
  if (tableY > 640) {
    doc.addPage();
    tableY = 56;
  }
  tableY = drawSectionTitle(doc, "Cut list", tableY);
  tableY = drawRunTable(doc, sheet, tableY);
  tableY = drawCutoutDetail(doc, sheet, tableY);
  drawCornersAndNotes(doc, sheet, tableY);

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(MUTED);
    doc.text(
      `${fabricationSheetFileName(sheet, brand)} · page ${page} of ${pageCount}`,
      MARGIN,
      FOOTER_Y,
    );
  }
  return doc;
}

/** Summary lines the email body uses, so the message reads without the PDF. */
export function fabricationSheetEmailBody(
  sheet: CountertopFabricationSheet,
  options: { brandName?: string | null; note?: string | null } = {},
): { subject: string; text: string } {
  const brand = (options.brandName ?? "").trim() || "CabinetDealz";
  const job = fabricationField(sheet.job.projectName);
  const design = fabricationField(sheet.job.designName);
  const subject = `Countertop fabrication sheet — ${job !== em ? job : design !== em ? design : "kitchen design"}`;
  const lines = [
    `Please find the countertop fabrication sheet for ${job !== em ? job : "this job"} attached as a PDF.`,
    "",
    `Job / project: ${job}`,
    `Design: ${design}`,
    `Customer: ${fabricationField(sheet.job.customerName)}`,
    `Countertop material: ${fabricationField(sheet.materials[0]?.name)}`,
    `Edge profile: ${sheet.edgeProfile ? sheet.edgeProfile.name : em}`,
    `Total: ${sheet.totals.squareFeet} sq ft · ${sheet.totals.linearFeet} lin ft`,
    "",
    "Runs:",
    ...fabricationSheetSummaryLines(sheet).map((line) => `  ${line}`),
  ];
  if (sheet.unknowns.length > 0) {
    lines.push("", "Not stored on the design (confirm before fabrication):");
    for (const unknown of sheet.unknowns) lines.push(`  - ${unknown}`);
  }
  if (options.note?.trim()) lines.push("", options.note.trim());
  lines.push("", `Sent from ${brand}.`);
  return { subject, text: lines.join("\n") };
}

/**
 * jsPDF is imported dynamically by the caller (`ensureJsPdf`) so the Designer
 * bundle never pays for it until a sheet is actually requested. The module is
 * cached here after the first load.
 */
type JsPdfConstructor = typeof import("jspdf").jsPDF;
let defaultJsPdf: JsPdfConstructor | null = null;

export async function ensureJsPdf(): Promise<JsPdfConstructor> {
  if (!defaultJsPdf) {
    const module = await import("jspdf");
    defaultJsPdf = module.jsPDF;
  }
  return defaultJsPdf;
}

/** Save the PDF through the browser download dialog. */
export async function downloadFabricationSheetPdf(
  sheet: CountertopFabricationSheet,
  brandName?: string | null,
): Promise<string> {
  const fileName = fabricationSheetFileName(sheet, brandName);
  const JsPdf = await ensureJsPdf();
  buildFabricationSheetPdf(sheet, brandName, JsPdf).save(fileName);
  return fileName;
}

/** Base64 payload of the generated PDF, for attaching it to an email. */
export async function fabricationSheetPdfBase64(
  sheet: CountertopFabricationSheet,
  brandName?: string | null,
): Promise<string> {
  const JsPdf = await ensureJsPdf();
  const doc = buildFabricationSheetPdf(sheet, brandName, JsPdf);
  const dataUri = doc.output("datauristring") as string;
  return dataUri.slice(dataUri.indexOf(",") + 1);
}

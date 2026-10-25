import type { InstallationRoomType } from "@shared/installationEstimate";

export type InstallationEstimateExportLine = {
  description: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  costType?: "labor" | "material";
};

export type InstallationEstimateExportData = {
  id?: number;
  roomType: InstallationRoomType | string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  lineItems: InstallationEstimateExportLine[];
  subtotal: number | string;
  markupPercent?: number | string | null;
  markupAmount?: number | string | null;
  totalAmount: number | string;
  cabinetBreakdown?: { base: number; wall: number; tall: number; total: number } | null;
};

const money = (value: number | string | null | undefined) => Number(value ?? 0).toFixed(2);
const safeFilePart = (value: string) => value.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "estimate";

function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function installationEstimateCsv(data: InstallationEstimateExportData): string {
  const rows: Array<Array<string | number>> = [
    ["Installation estimate", data.id ? `#${data.id}` : ""],
    ["Room type", data.roomType],
    ["Customer", data.customerName ?? ""],
    ["Email", data.customerEmail ?? ""],
    ["Phone", data.customerPhone ?? ""],
    ...(data.cabinetBreakdown ? [["Saved plan cabinets", `Base ${data.cabinetBreakdown.base}`, `Wall ${data.cabinetBreakdown.wall}`, `Tall ${data.cabinetBreakdown.tall}`, `Total ${data.cabinetBreakdown.total}`] as Array<string | number>] : []),
    [],
    ["Description", "Cost type", "Quantity", "Unit cost", "Line total"],
    ...data.lineItems.map((line) => [line.description, line.costType ?? "labor", line.quantity, money(line.unitCost), money(line.lineTotal)]),
    [],
    ["Installation subtotal", "", "", "", money(data.subtotal)],
    ["Markup percent", "", "", "", money(data.markupPercent)],
    ["Markup amount", "", "", "", money(data.markupAmount)],
    ["Installation total", "", "", "", money(data.totalAmount)],
  ];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadInstallationEstimateCsv(data: InstallationEstimateExportData) {
  downloadBlob(new Blob([installationEstimateCsv(data)], { type: "text/csv;charset=utf-8" }), `installation-estimate-${safeFilePart(data.customerName ?? data.roomType)}.csv`);
}

export async function downloadInstallationEstimatePdf(data: InstallationEstimateExportData) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const left = 42;
  const right = 570;
  let y = 48;
  const addLine = (text: string, x = left, size = 10, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.text(text, x, y);
    y += size + 7;
    if (y > 740) { pdf.addPage(); y = 48; }
  };

  addLine("Installation estimate", left, 18, true);
  addLine(`${data.roomType} installation services`, left, 12, true);
  y += 4;
  addLine(`Customer: ${data.customerName || "Customer"}`);
  if (data.customerEmail) addLine(`Email: ${data.customerEmail}`);
  if (data.customerPhone) addLine(`Phone: ${data.customerPhone}`);
  if (data.cabinetBreakdown) addLine(`Saved plan cabinets: ${data.cabinetBreakdown.base} Base · ${data.cabinetBreakdown.wall} Wall · ${data.cabinetBreakdown.tall} Tall · ${data.cabinetBreakdown.total} total`, left, 10, true);
  y += 8;
  pdf.setDrawColor(190, 190, 190);
  pdf.line(left, y, right, y);
  y += 20;
  addLine("Description                                      Type        Qty       Unit       Total", left, 9, true);
  for (const line of data.lineItems) {
    const description = line.description.length > 42 ? `${line.description.slice(0, 39)}…` : line.description;
    addLine(`${description.padEnd(44)} ${(line.costType ?? "labor").padEnd(10)} ${String(line.quantity).padStart(5)} ${money(line.unitCost).padStart(10)} ${money(line.lineTotal).padStart(10)}`, left, 9);
  }
  y += 8;
  pdf.line(left, y, right, y);
  y += 18;
  addLine(`Installation subtotal: ${money(data.subtotal)}`, left, 11, true);
  if (Number(data.markupPercent ?? 0) > 0) addLine(`Markup (${money(data.markupPercent)}%): ${money(data.markupAmount)}`, left, 10);
  addLine(`Installation total: ${money(data.totalAmount)}`, left, 13, true);
  addLine("Cabinet Dealz material pricing and invoices are separate from this installation document.", left, 8);
  pdf.save(`installation-estimate-${safeFilePart(data.customerName ?? data.roomType)}.pdf`);
}

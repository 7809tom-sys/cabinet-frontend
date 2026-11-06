import { jsPDF } from "jspdf";
import { buildPoCsv, formatPoUsd, poPricingWarning, poSummaryRows, type PoDocument } from "@shared/poDocument";

/**
 * Printable / downloadable PO. Every row comes from the same `buildPoDocument`
 * result the admin page renders, so a printed PO, the CSV and the screen can
 * never disagree about a line price or the total.
 */

/** The line block as the PDF prints it: one item row plus its price row. */
export function poPdfLineRows(doc: PoDocument): string[] {
  const rows: string[] = [];
  for (const line of doc.lines) {
    const style = line.doorStyle ? ` · ${line.doorStyle}` : "";
    rows.push(`${line.qty} × ${line.sku || "ITEM"} — ${line.description}${style}`);
    rows.push(`    Unit ${formatPoUsd(line.unitPriceCents)} × ${line.qty} = Line total ${formatPoUsd(line.lineTotalCents)}`);
  }
  if (doc.lines.length === 0) rows.push("No line items were assigned to this distributor.");
  return rows;
}

/** Subtotal → shipping → tax → total, exactly as the summary block shows them. */
export function poPdfSummaryRows(doc: PoDocument): string[] {
  return poSummaryRows(doc).map((row) => `${row.label}: ${formatPoUsd(row.cents)}${row.recorded ? "" : " (not recorded)"}`);
}

export function poPdfBasisNote(doc: PoDocument): string {
  if (doc.basis === "distributor_cost") return "Prices shown are Cabinet Dealz distributor cost.";
  if (doc.basis === "customer_price") return "Prices shown are customer price (no distributor cost is stored on this order).";
  if (doc.basis === "mixed") return "Prices shown mix distributor cost and customer price; review this PO before sending.";
  return "This PO has no prices.";
}

/** Render the PO PDF and return it as a Blob URL (and the jsPDF document). */
export function renderPoPdf(doc: PoDocument): { url: string; output: () => Blob } {
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const left = 44;
  const right = 552;
  let y = 56;

  pdf.setTextColor(17, 32, 51);
  pdf.setFontSize(18);
  pdf.text("Purchase Order", left, y);
  y += 22;

  pdf.setFontSize(10);
  pdf.setTextColor(82, 96, 116);
  const meta = [
    `Order ${doc.orderNumber}`,
    doc.distributorName ? `Distributor: ${doc.distributorName}` : null,
    doc.poNumber ? `PO number: ${doc.poNumber}` : null,
    doc.customerName ? `Reference: ${doc.customerName}` : null,
    doc.styleName ? `Door Style / Finish: ${doc.styleName}` : null,
    `Date: ${doc.orderDate}`,
    `Fulfillment: ${doc.deliveryMethod === "pickup" ? "Local pickup" : "Ship"}`,
    doc.deliveryMethod === "pickup" && doc.pickupAddress ? `Pickup location: ${doc.pickupAddress}` : null,
  ].filter((row): row is string => Boolean(row));
  for (const row of meta) {
    pdf.text(row, left, y);
    y += 14;
  }
  y += 10;

  pdf.setFontSize(8);
  pdf.text("QTY / ITEM", left, y);
  pdf.text("UNIT", 420, y, { align: "right" });
  pdf.text("LINE TOTAL", right, y, { align: "right" });
  pdf.setDrawColor(203, 213, 225);
  pdf.line(left, y + 4, right, y + 4);
  y += 18;

  pdf.setFontSize(9);
  pdf.setTextColor(17, 32, 51);
  for (const line of doc.lines) {
    const style = line.doorStyle ? ` · ${line.doorStyle}` : "";
    const wrapped = pdf.splitTextToSize(`${line.qty} × ${line.sku || "ITEM"} — ${line.description}${style}`, 330) as string[];
    pdf.text(wrapped, left, y);
    pdf.text(formatPoUsd(line.unitPriceCents), 420, y, { align: "right" });
    pdf.text(formatPoUsd(line.lineTotalCents), right, y, { align: "right" });
    y += wrapped.length * 12 + 4;
  }
  if (doc.lines.length === 0) {
    pdf.text("No line items were assigned to this distributor.", left, y);
    y += 16;
  }

  y += 6;
  pdf.setDrawColor(203, 213, 225);
  pdf.line(340, y, right, y);
  y += 16;
  for (const row of poSummaryRows(doc)) {
    pdf.setFont("helvetica", row.emphasized ? "bold" : "normal");
    pdf.text(`${row.label}${row.recorded ? "" : " (not recorded)"}`, 420, y, { align: "right" });
    pdf.text(formatPoUsd(row.cents), right, y, { align: "right" });
    y += 15;
  }
  pdf.setFont("helvetica", "normal");

  const warning = poPricingWarning(doc);
  if (warning) {
    y += 10;
    pdf.setTextColor(180, 83, 9);
    pdf.setFontSize(8);
    const lines = pdf.splitTextToSize(`WARNING: ${warning}`, 500) as string[];
    pdf.text(lines, left, y);
    y += lines.length * 11 + 8;
  }

  pdf.setTextColor(82, 96, 116);
  pdf.setFontSize(8);
  pdf.text(poPdfBasisNote(doc), left, Math.min(y, 748));

  return {
    url: String(pdf.output("bloburl")),
    output: () => pdf.output("blob") as Blob,
  };
}

export function poCsvFileName(doc: PoDocument): string {
  return `PO-${doc.orderNumber}.csv`;
}

export function poPdfFileName(doc: PoDocument): string {
  return `PO-${doc.orderNumber}.pdf`;
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Download the PO CSV. Returns the exact text that was written. */
export function downloadPoCsv(doc: PoDocument): string {
  const csv = buildPoCsv(doc);
  saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), poCsvFileName(doc));
  return csv;
}

export function downloadPoPdf(doc: PoDocument): void {
  saveBlob(renderPoPdf(doc).output(), poPdfFileName(doc));
}

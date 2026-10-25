import type { VendorFulfillmentItem } from "@shared/vendorFulfillment";

/**
 * Printable documents for a vendor's part of an order. These are ship-to
 * address labels and packing slips only: they contain no prices, totals,
 * margins, affiliate names or other vendors' items. Buying carrier postage is a
 * separate step the vendor does with their own carrier account.
 */
export type FulfillmentDocOrder = {
  requestNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  shipTo: { line1: string | null; line2: string | null; city: string | null; state: string | null; zip: string | null };
  deliveryLocationType: "business" | "residential";
  liftgateRequired: boolean;
  shipFrom: string;
  items: readonly VendorFulfillmentItem[];
};

export function shipToLines(order: Pick<FulfillmentDocOrder, "customerName" | "shipTo">): string[] {
  const { shipTo } = order;
  const cityLine = [shipTo.city, [shipTo.state, shipTo.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [order.customerName, shipTo.line1, shipTo.line2, cityLine]
    .map((line) => (line ?? "").trim())
    .filter(Boolean);
}

export function totalPieces(items: readonly VendorFulfillmentItem[]): number {
  return items.reduce((sum, item) => sum + item.qty, 0);
}

async function qrDataUrl(value: string): Promise<string | null> {
  try {
    const QRCode = (await import("qrcode")).default;
    return await QRCode.toDataURL(value, { errorCorrectionLevel: "M", margin: 1, width: 180 });
  } catch {
    return null;
  }
}

/**
 * Open the tab that will show the PDF. This must run synchronously inside the
 * click so the browser does not block it. It deliberately does NOT pass
 * "noopener": browsers return null for a noopener window, which would leave an
 * empty tab and force a download. The tab is same-origin about:blank, so we cut
 * its opener ourselves instead.
 */
function openPreviewTab(): Window | null {
  const tab = window.open("", "_blank");
  if (tab) {
    try {
      tab.opener = null;
    } catch {
      /* cross-origin opener assignment can throw; the tab is still usable */
    }
  }
  return tab;
}

function openPdf(preview: Window | null, pdf: { output: (type: "bloburl") => unknown; save: (name: string) => unknown }, fileName: string) {
  const url = String(pdf.output("bloburl"));
  if (preview) {
    preview.location.href = url;
    preview.focus();
  } else {
    pdf.save(fileName);
  }
}

/** One 4x6 inch label per package ("Package 2 of 3"). */
export async function printShippingLabels(order: FulfillmentDocOrder, packageCount: number): Promise<boolean> {
  const address = shipToLines(order);
  if (address.length < 2) return false;
  // Open from the click so the browser does not block the PDF tab.
  const preview = openPreviewTab();
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: [288, 432], compress: true });
  const qr = await qrDataUrl(order.requestNumber);
  const packages = Math.max(1, Math.min(99, Math.floor(packageCount) || 1));
  for (let index = 1; index <= packages; index += 1) {
    if (index > 1) pdf.addPage([288, 432], "portrait");
    pdf.setTextColor(17, 24, 39);
    pdf.setFontSize(8);
    pdf.text("FROM", 18, 24);
    pdf.setFontSize(9);
    const from = pdf.splitTextToSize(order.shipFrom || "—", 252) as string[];
    pdf.text(from.slice(0, 3), 18, 36);
    pdf.setLineWidth(1.5);
    pdf.line(18, 76, 270, 76);

    pdf.setFontSize(9);
    pdf.text("SHIP TO", 18, 96);
    pdf.setFontSize(17);
    let y = 120;
    for (const line of address) {
      const wrapped = pdf.splitTextToSize(line, 252) as string[];
      pdf.text(wrapped, 18, y);
      y += wrapped.length * 20;
    }
    if (order.customerPhone) {
      pdf.setFontSize(10);
      pdf.text(`Phone ${order.customerPhone}`, 18, y + 4);
    }

    pdf.setFontSize(12);
    const flags = [order.deliveryLocationType === "residential" ? "RESIDENTIAL" : "BUSINESS", order.liftgateRequired ? "LIFTGATE" : ""].filter(Boolean);
    pdf.text(flags.join("  ·  "), 18, 300);

    pdf.setLineWidth(1.5);
    pdf.line(18, 316, 270, 316);
    pdf.setFontSize(10);
    pdf.text("ORDER", 18, 336);
    pdf.setFontSize(15);
    pdf.text(order.requestNumber, 18, 356);
    pdf.setFontSize(12);
    pdf.text(`Package ${index} of ${packages}`, 18, 380);
    pdf.setFontSize(9);
    pdf.text(`${totalPieces(order.items)} piece${totalPieces(order.items) === 1 ? "" : "s"} on this order`, 18, 396);
    // One alias so every page reuses the same embedded QR image.
    if (qr) pdf.addImage(qr, "PNG", 196, 332, 74, 74, "order-qr", "FAST");
  }
  openPdf(preview, pdf, `label-${order.requestNumber}.pdf`);
  return true;
}

/** US Letter packing slip listing this vendor's items only. */
export async function printPackingSlip(order: FulfillmentDocOrder, packageCount: number): Promise<boolean> {
  if (order.items.length === 0) return false;
  const preview = openPreviewTab();
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter", compress: true });
  const left = 44;
  const bottom = 730;
  let y = 52;
  const header = () => {
    pdf.setTextColor(17, 24, 39);
    pdf.setFontSize(20);
    pdf.text("Packing Slip", left, y);
    pdf.setFontSize(11);
    pdf.text(`Order ${order.requestNumber}`, 400, y);
    y += 24;
    pdf.setFontSize(9);
    pdf.setTextColor(82, 97, 116);
    pdf.text(`${packageCount} package${packageCount === 1 ? "" : "s"} · ${totalPieces(order.items)} pieces · printed ${new Date().toLocaleDateString()}`, left, y);
    y += 22;
  };
  header();
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(9);
  pdf.text("SHIP FROM", left, y);
  pdf.text("SHIP TO", 320, y);
  y += 14;
  pdf.setFontSize(11);
  const from = pdf.splitTextToSize(order.shipFrom || "—", 250) as string[];
  const to = shipToLines(order);
  pdf.text(from, left, y);
  pdf.text(to, 320, y);
  y += Math.max(from.length, to.length) * 14 + 12;
  if (order.liftgateRequired || order.deliveryLocationType === "residential") {
    pdf.setFontSize(10);
    pdf.text([order.deliveryLocationType === "residential" ? "Residential delivery" : "", order.liftgateRequired ? "Liftgate required" : ""].filter(Boolean).join("  ·  "), 320, y - 8);
  }
  pdf.setLineWidth(0.8);
  pdf.line(left, y, 568, y);
  y += 16;
  const columns = () => {
    pdf.setFontSize(9);
    pdf.setTextColor(82, 97, 116);
    pdf.text("QTY", left, y);
    pdf.text("SKU", left + 40, y);
    pdf.text("DESCRIPTION", left + 170, y);
    pdf.text("PACKED", 520, y);
    y += 12;
    pdf.setTextColor(31, 41, 55);
  };
  columns();
  for (const item of order.items) {
    const description = [item.description, item.doorStyle ? `Style: ${item.doorStyle}` : ""].filter(Boolean).join(" — ");
    const wrappedDescription = pdf.splitTextToSize(description || "—", 330) as string[];
    const wrappedSku = pdf.splitTextToSize(item.sku, 120) as string[];
    const height = Math.max(wrappedDescription.length, wrappedSku.length) * 12 + 8;
    if (y + height > bottom) {
      pdf.addPage();
      y = 52;
      header();
      columns();
    }
    pdf.setFontSize(10);
    pdf.text(String(item.qty), left, y);
    pdf.text(wrappedSku, left + 40, y);
    pdf.text(wrappedDescription, left + 170, y);
    pdf.rect(522, y - 9, 11, 11);
    y += height;
  }
  pdf.setFontSize(8);
  pdf.setTextColor(82, 97, 116);
  pdf.text("Packing slip — contents only. No pricing is shown.", left, 760);
  openPdf(preview, pdf, `packing-slip-${order.requestNumber}.pdf`);
  return true;
}

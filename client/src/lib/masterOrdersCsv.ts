/**
 * CSV export of the filtered Master Orders list. The columns and the order match
 * the table exactly, so a downloaded file reconciles against the screen.
 *
 * Values are written plainly (cents as dollars with two decimals, timestamps in
 * Central time) and quoted only when they need it.
 */

import { formatCentralForCsv } from "./orderStatusActor";
import {
  ORDER_STATUS_BUCKET_LABELS,
  orderStatusBucket,
  type OrderStatusRow,
} from "./orderStatusReport";

export const MASTER_ORDERS_CSV_COLUMNS = [
  "Order #",
  "Date",
  "Affiliate",
  "Affiliate site",
  "Customer",
  "Dealer",
  "Distributor",
  "Items",
  "Customer total",
  "Distributor cost",
  "Margin",
  "Payment",
  "Status",
  "Order received email",
  "Distributor emailed",
  "Verified",
  "Shipped",
  "Signed",
] as const;

/** RFC-4180-ish cell escaping. */
export function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** "$1,234.56" → "1234.56" so a spreadsheet reads it as a number. */
export function csvMoney(cents: number | null): string {
  if (cents == null) return "";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

function stepCell(row: OrderStatusRow, key: string): string {
  const step = row.steps.find((entry) => entry.key === key);
  if (!step || !step.done) return "";
  const when = formatCentralForCsv(step.at);
  const who = step.by ? ` by ${step.by}` : "";
  const detail = step.detail ? ` (${step.detail})` : "";
  return `${when}${who}${detail}`.trim();
}

/** One line per order, identical to the on-screen columns. */
export function masterOrdersCsv(rows: readonly OrderStatusRow[]): string {
  const lines: string[] = [MASTER_ORDERS_CSV_COLUMNS.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push([
      row.orderNumber,
      formatCentralForCsv(row.createdAt),
      row.affiliateName ?? "",
      row.affiliateSite ?? "",
      row.customer ?? "",
      row.dealer ?? "",
      row.distributor ?? "",
      row.itemCount,
      csvMoney(row.totalCents),
      csvMoney(row.distributorCostCents),
      csvMoney(row.marginCents),
      row.paymentStatus,
      ORDER_STATUS_BUCKET_LABELS[orderStatusBucket(row)],
      stepCell(row, "order_received_email"),
      stepCell(row, "distributor_email"),
      stepCell(row, "verified"),
      stepCell(row, "shipped"),
      stepCell(row, "signed"),
    ].map(csvCell).join(","));
  }
  return lines.join("\r\n");
}

export function masterOrdersCsvFileName(now: Date = new Date()): string {
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return `master-orders-${stamp}.csv`;
}

/** Trigger the download in the browser. Returns the text that was written. */
export function downloadMasterOrdersCsv(rows: readonly OrderStatusRow[], now: Date = new Date()): string {
  const csv = masterOrdersCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = masterOrdersCsvFileName(now);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return csv;
}

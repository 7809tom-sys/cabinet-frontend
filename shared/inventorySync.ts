/**
 * Vendor inventory upload validation and the wholesale-increase rule.
 *
 * Setting name: pricing_settings.wholesaleIncreaseRequiresApproval
 * Owner decision, default ON: a vendor wholesale increase waits for the
 * existing upcoming-price-increase review. Decreases, and the first price on
 * an unpriced item, apply immediately. An equal price is a no-op.
 *
 * InventorySource is the adapter seam for a later NetSuite connector.
 * A NetSuite adapter needs: a saved search or RESTlet, TBA credentials stored
 * for that vendor (not built here), a field map onto the columns below, and a
 * schedule that calls the same validate/apply path as CSV and the sync API.
 * distributors.fulfillmentMode already has netsuite_email / netsuite_api stubs.
 */

export const WHOLESALE_INCREASE_REQUIRES_APPROVAL = "wholesaleIncreaseRequiresApproval" as const;

export type InventorySyncSource = "manual" | "upload" | "api";

export type InventoryRowInput = {
  sku: string;
  quantityOnHand?: number | null;
  leadTimeDays?: number | null;
  notes?: string | null;
  discontinued?: boolean | null;
  backorder?: boolean | null;
  minimumOrderQty?: number | null;
  restockDate?: string | null;
  outOfStock?: boolean | null;
};

export type InventoryRowIssue = { row: number; sku: string; message: string };

export type ParsedInventoryRow = InventoryRowInput & { row: number };

const LOW_STOCK_AT = 2;

export function parseCsvRecords(text: string): string[][] {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch !== "\r") cell += ch;
  }
  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function headerIndex(headers: string[], names: string[]): number {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  return headers.findIndex((header) => wanted.has(header.trim().toLowerCase()));
}

function intOrNull(value: string | undefined): number | null | "bad" {
  if (value == null || value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return "bad";
  return n;
}

function boolOrNull(value: string | undefined): boolean | null | "bad" {
  if (value == null || value.trim() === "") return null;
  const text = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(text)) return true;
  if (["0", "false", "no", "n"].includes(text)) return false;
  return "bad";
}

export function parseInventoryCsv(text: string): { rows: ParsedInventoryRow[]; issues: InventoryRowIssue[] } {
  const table = parseCsvRecords(text);
  if (table.length === 0) return { rows: [], issues: [{ row: 1, sku: "", message: "The file is empty." }] };
  const headers = table[0]!.map((header) => header.trim());
  const skuAt = headerIndex(headers, ["sku", "distributor sku", "platform sku"]);
  if (skuAt < 0) return { rows: [], issues: [{ row: 1, sku: "", message: "A SKU column is required." }] };
  const qtyAt = headerIndex(headers, ["quantity on hand", "on hand", "qty", "onhandqty"]);
  const leadAt = headerIndex(headers, ["lead time days", "lead time", "leadtimedays"]);
  const notesAt = headerIndex(headers, ["notes", "note"]);
  const discAt = headerIndex(headers, ["discontinued"]);
  const backAt = headerIndex(headers, ["backorder"]);
  const moqAt = headerIndex(headers, ["minimum order quantity", "moq", "minimumorderqty"]);
  const restockAt = headerIndex(headers, ["restock date", "restockdate"]);
  const oosAt = headerIndex(headers, ["out of stock", "outofstock", "oos"]);
  const rows: ParsedInventoryRow[] = [];
  const issues: InventoryRowIssue[] = [];
  table.slice(1).forEach((cells, index) => {
    const row = index + 2;
    const sku = (cells[skuAt] ?? "").trim();
    if (!sku) {
      issues.push({ row, sku: "", message: "SKU is required." });
      return;
    }
    const quantityOnHand = qtyAt >= 0 ? intOrNull(cells[qtyAt]) : null;
    const leadTimeDays = leadAt >= 0 ? intOrNull(cells[leadAt]) : null;
    const minimumOrderQty = moqAt >= 0 ? intOrNull(cells[moqAt]) : null;
    const discontinued = discAt >= 0 ? boolOrNull(cells[discAt]) : null;
    const backorder = backAt >= 0 ? boolOrNull(cells[backAt]) : null;
    const outOfStock = oosAt >= 0 ? boolOrNull(cells[oosAt]) : null;
    const restockDate = restockAt >= 0 ? (cells[restockAt] ?? "").trim() : "";
    if (quantityOnHand === "bad" || (typeof quantityOnHand === "number" && quantityOnHand < 0)) {
      issues.push({ row, sku, message: "Quantity on hand must be a whole number, zero or more." });
      return;
    }
    if (leadTimeDays === "bad" || (typeof leadTimeDays === "number" && leadTimeDays < 0)) {
      issues.push({ row, sku, message: "Lead time days must be a whole number, zero or more." });
      return;
    }
    if (minimumOrderQty === "bad" || (typeof minimumOrderQty === "number" && minimumOrderQty < 0)) {
      issues.push({ row, sku, message: "Minimum order quantity must be a whole number, zero or more." });
      return;
    }
    if (discontinued === "bad" || backorder === "bad" || outOfStock === "bad") {
      issues.push({ row, sku, message: "Yes/no columns must be yes or no." });
      return;
    }
    if (restockDate && !/^\d{4}-\d{2}-\d{2}$/.test(restockDate)) {
      issues.push({ row, sku, message: "Restock date must be YYYY-MM-DD." });
      return;
    }
    rows.push({
      row,
      sku,
      quantityOnHand: quantityOnHand as number | null,
      leadTimeDays: leadTimeDays as number | null,
      notes: notesAt >= 0 ? (cells[notesAt] ?? "").trim() : null,
      discontinued: discontinued as boolean | null,
      backorder: backorder as boolean | null,
      minimumOrderQty: minimumOrderQty as number | null,
      restockDate: restockDate || null,
      outOfStock: outOfStock as boolean | null,
    });
  });
  return { rows, issues };
}

export function classifyInventoryRows(
  rows: readonly ParsedInventoryRow[],
  knownSkus: ReadonlySet<string>,
): { applicable: ParsedInventoryRow[]; unknown: InventoryRowIssue[] } {
  const applicable: ParsedInventoryRow[] = [];
  const unknown: InventoryRowIssue[] = [];
  const known = new Set(Array.from(knownSkus).map((sku) => sku.trim().toUpperCase()));
  for (const row of rows) {
    if (!known.has(row.sku.trim().toUpperCase())) {
      unknown.push({ row: row.row, sku: row.sku, message: "Unknown SKU. It was not created." });
    } else applicable.push(row);
  }
  return { applicable, unknown };
}

export function isLowStock(quantityOnHand: number | null | undefined): boolean {
  return quantityOnHand != null && quantityOnHand <= LOW_STOCK_AT;
}

export function isOutOfStock(input: { quantityOnHand?: number | null; outOfStock?: boolean | null }): boolean {
  if (input.outOfStock) return true;
  return input.quantityOnHand === 0;
}

export type WholesaleDisposition = "apply" | "queue" | "noop";

/**
 * current null or ≤ 0 → apply (first price).
 * next < current → apply (decrease).
 * next > current → queue when wholesaleIncreaseRequiresApproval is on, else apply.
 * equal → noop.
 */
export function wholesalePriceDisposition(
  current: number | null | undefined,
  next: number,
  wholesaleIncreaseRequiresApproval: boolean,
): WholesaleDisposition {
  if (!Number.isFinite(next) || next < 0) throw new Error("INVALID_WHOLESALE");
  const currentValue = current == null || !Number.isFinite(current) ? null : current;
  if (currentValue == null || currentValue <= 0) return "apply";
  if (next < currentValue) return "apply";
  if (next > currentValue) return wholesaleIncreaseRequiresApproval ? "queue" : "apply";
  return "noop";
}

export type WholesaleUploadRow = { row: number; sku: string; wholesale: number };

export function parseWholesaleCsv(text: string): { rows: WholesaleUploadRow[]; issues: InventoryRowIssue[] } {
  const table = parseCsvRecords(text);
  if (table.length === 0) return { rows: [], issues: [{ row: 1, sku: "", message: "The file is empty." }] };
  const headers = table[0]!;
  const skuAt = headerIndex(headers, ["sku", "distributor sku", "platform sku"]);
  const priceAt = headerIndex(headers, ["wholesale", "wholesale price", "vendor wholesale"]);
  if (skuAt < 0 || priceAt < 0) {
    return { rows: [], issues: [{ row: 1, sku: "", message: "SKU and wholesale columns are required." }] };
  }
  const rows: WholesaleUploadRow[] = [];
  const issues: InventoryRowIssue[] = [];
  table.slice(1).forEach((cells, index) => {
    const row = index + 2;
    const sku = (cells[skuAt] ?? "").trim();
    const wholesale = Number(cells[priceAt]);
    if (!sku) {
      issues.push({ row, sku: "", message: "SKU is required." });
      return;
    }
    if (!Number.isFinite(wholesale) || wholesale < 0) {
      issues.push({ row, sku, message: "Wholesale must be a number, zero or more." });
      return;
    }
    rows.push({ row, sku, wholesale: Math.round(wholesale * 100) / 100 });
  });
  return { rows, issues };
}

export function priceChangeAllowed(input: {
  lockedFields: readonly string[] | null | undefined;
  conflictStatus: string | null | undefined;
  field: string;
}): string | null {
  if ((input.conflictStatus ?? "none") === "conflict") {
    return "This product is in conflict review. The vendor cannot change it until an admin clears the review.";
  }
  const locked = input.lockedFields ?? [];
  if (locked.includes(input.field) || (input.field === "vendorWholesale" && locked.includes("listPrice"))) {
    return `The field ${input.field} is locked by import.`;
  }
  return null;
}

export const VENDOR_DESCRIPTIVE_FIELDS = ["supplierCabinetName", "supplierDescription", "inventoryNotes"] as const;

export function descriptiveEditAllowed(input: {
  field: string;
  lockedFields: readonly string[] | null | undefined;
}): string | null {
  if (input.field === "conflictStatus" || input.field === "conflictReason") {
    return "Vendors cannot change conflict review.";
  }
  if (!(VENDOR_DESCRIPTIVE_FIELDS as readonly string[]).includes(input.field)) {
    return "That field is not editable by the vendor.";
  }
  if ((input.lockedFields ?? []).includes(input.field)) return `The field ${input.field} is locked by import.`;
  return null;
}

export type InventorySourceKind = "manual" | "upload" | "api" | "netsuite";

/**
 * Future NetSuite adapter implements this and feeds the same row validator.
 * Do not call NetSuite from here.
 */
export interface InventorySource {
  kind: InventorySourceKind;
  pull(scope: string): Promise<InventoryRowInput[]>;
}

export type RateBucket = { count: number; windowStartedAt: number };

/** Per-process limit. A second server process has its own window. */
export function takeRateLimit(
  buckets: Map<string, RateBucket>,
  key: string,
  now: number,
  limit = 30,
  windowMs = 60_000,
): boolean {
  const current = buckets.get(key);
  if (!current || now - current.windowStartedAt >= windowMs) {
    buckets.set(key, { count: 1, windowStartedAt: now });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

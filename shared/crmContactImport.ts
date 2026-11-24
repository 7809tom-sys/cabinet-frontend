// ─── Admin CRM customer list import (CSV / XLSX, column mapping, batches) ────
// Shared by the admin import dialog (preview + validation in the browser) and
// the server (the same rules are re-applied to every batch it receives).
// Only the house CRM uses this; the affiliate "Customer list" import is
// unchanged and lives in crmCustomerListImport.ts.

export const CONTACT_IMPORT_FIELDS = [
  "name",
  "firstName",
  "lastName",
  "email",
  "phone",
  "address",
  "city",
  "state",
  "zip",
  "lastPurchaseDate",
  "notes",
] as const;
export type ContactImportField = (typeof CONTACT_IMPORT_FIELDS)[number];

export const CONTACT_IMPORT_FIELD_LABELS: Record<ContactImportField, string> = {
  name: "Full name",
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone",
  address: "Street address",
  city: "City",
  state: "State",
  zip: "ZIP",
  lastPurchaseDate: "Last purchase date",
  notes: "Notes",
};

/** Rows per server call. Small enough for one request, big enough for 50k rows. */
export const CONTACT_IMPORT_BATCH_SIZE = 500;
export const CONTACT_IMPORT_MAX_ROWS = 200_000;

const HEADER_ALIASES: Record<ContactImportField, string[]> = {
  name: ["name", "fullname", "customername", "contactname", "customer", "client", "clientname"],
  firstName: ["firstname", "first", "fname", "givenname"],
  lastName: ["lastname", "last", "lname", "surname", "familyname"],
  email: ["email", "emailaddress", "customeremail", "mail", "e-mail", "emailaddr"],
  phone: ["phone", "telephone", "phonenumber", "mobile", "cell", "customerphone", "tel"],
  address: ["address", "street", "streetaddress", "address1", "addressline1", "mailingaddress"],
  city: ["city", "town"],
  state: ["state", "st", "province", "region"],
  zip: ["zip", "zipcode", "postalcode", "postcode", "zip5"],
  lastPurchaseDate: ["lastpurchasedate", "lastpurchase", "lastorder", "lastorderdate", "purchasedate", "orderdate", "lastsale", "lastsaledate", "date"],
  notes: ["notes", "note", "comments", "comment", "remarks", "memo"],
};

export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export type ContactColumnMapping = Partial<Record<ContactImportField, number>>;

/** Best-guess mapping from header names. Each column is used at most once. */
export function guessContactColumnMapping(headers: readonly string[]): ContactColumnMapping {
  const normalized = headers.map((header) => normalizeHeader(header ?? ""));
  const used = new Set<number>();
  const mapping: ContactColumnMapping = {};
  for (const field of CONTACT_IMPORT_FIELDS) {
    const aliases = HEADER_ALIASES[field].map(normalizeHeader);
    const index = normalized.findIndex((header, i) => !used.has(i) && aliases.includes(header));
    if (index >= 0) {
      mapping[field] = index;
      used.add(index);
    }
  }
  return mapping;
}

export type ContactImportRow = {
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lastPurchaseDate: string | null;
  notes: string | null;
};

export type ContactImportRejectReason = "invalid_email" | "missing_email" | "duplicate_in_file";

export type ContactImportReject = {
  rowNumber: number;
  email: string;
  reason: ContactImportRejectReason;
};

// Practical address check: one @, a dotted domain, no spaces. Stricter than
// "contains @", looser than full RFC 5322 (which rejects real customer data).
const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function normalizeContactEmail(raw: string | null | undefined): string {
  return String(raw ?? "").trim().replace(/^mailto:/i, "").toLowerCase();
}

export function isValidContactEmail(email: string): boolean {
  if (!email || email.length > 320) return false;
  if (!EMAIL_PATTERN.test(email)) return false;
  const [local, domain] = email.split("@");
  if (!local || local.length > 64 || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  const tld = domain.split(".").pop() ?? "";
  return tld.length >= 2 && !/^\d+$/.test(tld);
}

function clean(value: unknown, max: number): string | null {
  if (value == null) return null;
  const text = (value instanceof Date ? value.toISOString().slice(0, 10) : String(value)).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

function cellAt(row: readonly unknown[], index: number | undefined): unknown {
  return index == null ? undefined : row[index];
}

/** Excel serial date (e.g. 44562) or common text dates → YYYY-MM-DD; else the trimmed text. */
export function normalizeLastPurchaseDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4,5}(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial > 20000 && serial < 80000) {
      const ms = Math.round((serial - 25569) * 86400 * 1000);
      return new Date(ms).toISOString().slice(0, 10);
    }
    if (serial >= 1900 && serial <= 2100) return text; // a bare year
  }
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const us = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(text);
  if (us) {
    const year = us[3].length === 2 ? (Number(us[3]) > 40 ? `19${us[3]}` : `20${us[3]}`) : us[3];
    return `${year}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }
  return text.slice(0, 32);
}

/** Apply a column mapping to one raw spreadsheet row. Email is normalized, not yet validated. */
export function mapContactRow(row: readonly unknown[], mapping: ContactColumnMapping): ContactImportRow {
  const first = clean(cellAt(row, mapping.firstName), 128);
  const last = clean(cellAt(row, mapping.lastName), 128);
  const full = clean(cellAt(row, mapping.name), 256);
  const email = normalizeContactEmail(clean(cellAt(row, mapping.email), 320));
  const name = (full ?? [first, last].filter(Boolean).join(" ")).trim() || email.split("@")[0] || "Customer";
  return {
    name: name.slice(0, 256),
    email,
    phone: clean(cellAt(row, mapping.phone), 32),
    address: clean(cellAt(row, mapping.address), 512),
    city: clean(cellAt(row, mapping.city), 128),
    state: clean(cellAt(row, mapping.state), 64),
    zip: clean(cellAt(row, mapping.zip), 16),
    lastPurchaseDate: normalizeLastPurchaseDate(cellAt(row, mapping.lastPurchaseDate)),
    notes: clean(cellAt(row, mapping.notes), 4000),
  };
}

export type ContactImportPlan = {
  valid: Array<ContactImportRow & { rowNumber: number }>;
  rejected: ContactImportReject[];
};

/**
 * Validate a whole upload: every row needs a valid email, and an email that
 * appears twice keeps only its first row. rowNumber is the 1-based spreadsheet
 * row (header = row 1).
 */
export function planContactImport(
  dataRows: readonly (readonly unknown[])[],
  mapping: ContactColumnMapping,
): ContactImportPlan {
  const valid: ContactImportPlan["valid"] = [];
  const rejected: ContactImportReject[] = [];
  const seen = new Set<string>();
  dataRows.forEach((raw, index) => {
    if (!raw || !raw.some((cell) => String(cell ?? "").trim())) return; // blank line
    const rowNumber = index + 2;
    const row = mapContactRow(raw, mapping);
    if (!row.email) { rejected.push({ rowNumber, email: "", reason: "missing_email" }); return; }
    if (!isValidContactEmail(row.email)) { rejected.push({ rowNumber, email: row.email, reason: "invalid_email" }); return; }
    if (seen.has(row.email)) { rejected.push({ rowNumber, email: row.email, reason: "duplicate_in_file" }); return; }
    seen.add(row.email);
    valid.push({ ...row, rowNumber });
  });
  return { valid, rejected };
}

export function chunkRows<T>(rows: readonly T[], size = CONTACT_IMPORT_BATCH_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

export function contactLocation(row: Pick<ContactImportRow, "city" | "state" | "zip">): string | null {
  const cityState = [row.city, row.state].filter(Boolean).join(", ");
  const text = [cityState, row.zip].filter(Boolean).join(" ").trim();
  return text ? text.slice(0, 256) : null;
}

/** The note written on each imported CRM contact. Facts only, from the file. */
export function importedContactNote(
  row: Pick<ContactImportRow, "address" | "city" | "state" | "zip" | "lastPurchaseDate" | "notes">,
  sourceTag: string,
  importedOn: string,
): string {
  const lines = [`Imported from customer list "${sourceTag}" on ${importedOn}.`];
  const street = [row.address, contactLocation(row)].filter(Boolean).join(", ");
  if (street) lines.push(`Address: ${street}`);
  if (row.lastPurchaseDate) lines.push(`Last purchase: ${row.lastPurchaseDate}`);
  if (row.notes) lines.push(`Notes from the list: ${row.notes}`);
  return lines.join("\n");
}

export function cleanSourceTag(tag: string): string {
  return tag.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 128);
}

export type CrmCustomerImportRow = {
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  company: string | null;
  location: string | null;
  notes: string | null;
};

export type CrmCustomerImportSkippedRow = {
  rowNumber: number;
  contactName: string;
  reason: string;
};

export type ParsedCrmCustomerList = {
  rows: CrmCustomerImportRow[];
  skipped: CrmCustomerImportSkippedRow[];
};

export const CRM_CUSTOMER_LIST_TEMPLATE = [
  "Name,Email,Phone,Company,City,Notes",
  "Example Customer,customer@example.com,555-010-0100,Example Company,Tampa,Kitchen remodel inquiry",
].join("\r\n");

function clean(value: string | undefined): string | null {
  const result = value?.trim() ?? "";
  return result || null;
}

function cell(record: Record<string, string>, aliases: string[]): string | undefined {
  return aliases.map((alias) => record[alias]).find((value) => value != null);
}

/** A small CSV reader for customer lists exported from common spreadsheet tools. */
export function parseCsvRecords(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value); value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value); value = "";
      if (row.some((entry) => entry.trim())) rows.push(row);
      row = [];
    } else value += char;
  }
  row.push(value);
  if (row.some((entry) => entry.trim())) rows.push(row);
  return rows;
}

/** Reserves the final portion of the indicator for synchronous CSV parsing. */
export function crmCustomerFileReadProgress(loaded: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 5;
  return Math.max(5, Math.min(85, Math.round((Math.max(0, loaded) / total) * 85)));
}

export function parseCrmCustomerListCsv(text: string): ParsedCrmCustomerList {
  const records = parseCsvRecords(text);
  if (records.length < 2) return { rows: [], skipped: [] };
  const headers = records[0].map((header) => header.trim().toLowerCase().replace(/[^a-z0-9]+/g, ""));
  const seen = new Set<string>();
  const rows: CrmCustomerImportRow[] = [];
  const skipped: CrmCustomerImportSkippedRow[] = [];
  for (let index = 1; index < records.length; index += 1) {
    const source = records[index];
    const record = Object.fromEntries(headers.map((header, index) => [header, source[index] ?? ""]));
    const contactName = clean(cell(record, ["contactname", "name", "customername", "fullname"]));
    const contactEmail = clean(cell(record, ["email", "emailaddress", "customeremail"]))?.toLowerCase() ?? null;
    const contactPhone = clean(cell(record, ["phone", "telephone", "mobile", "customerphone"]));
    const candidate = {
      contactName,
      contactEmail,
      contactPhone,
      company: clean(cell(record, ["company", "business", "companyname"])),
      location: clean(cell(record, ["location", "city", "zip", "zipcode", "postalcode", "address"])),
      notes: clean(cell(record, ["notes", "note", "comments"])),
    };
    const identities = crmCustomerImportIdentities(candidate);
    const displayName = contactName ?? contactEmail ?? contactPhone ?? `Row ${index + 1}`;
    if (!contactName) { skipped.push({ rowNumber: index + 1, contactName: displayName, reason: "Missing customer name." }); continue; }
    if (!identities.length) { skipped.push({ rowNumber: index + 1, contactName, reason: "Email or phone is required." }); continue; }
    if (identities.some((identity) => seen.has(identity))) { skipped.push({ rowNumber: index + 1, contactName, reason: "Duplicate email or phone in this upload." }); continue; }
    identities.forEach((identity) => seen.add(identity));
    rows.push(candidate as CrmCustomerImportRow);
  }
  return { rows, skipped };
}

export function crmCustomerImportIdentities(row: Pick<CrmCustomerImportRow, "contactEmail" | "contactPhone">): string[] {
  const identities: string[] = [];
  if (row.contactEmail?.trim()) identities.push(`email:${row.contactEmail.trim().toLowerCase()}`);
  const phone = row.contactPhone?.replace(/\D/g, "");
  if (phone) identities.push(`phone:${phone}`);
  return identities;
}

export function crmCustomerImportIdentity(row: Pick<CrmCustomerImportRow, "contactEmail" | "contactPhone">): string | null {
  return crmCustomerImportIdentities(row)[0] ?? null;
}

export function prepareCrmCustomerImport(
  rows: readonly CrmCustomerImportRow[],
  existingIdentities: ReadonlySet<string>,
): { accepted: CrmCustomerImportRow[]; skipped: CrmCustomerImportSkippedRow[] } {
  const seen = new Set(existingIdentities);
  const accepted: CrmCustomerImportRow[] = [];
  const skipped: CrmCustomerImportSkippedRow[] = [];
  rows.forEach((row, index) => {
    const identities = crmCustomerImportIdentities(row);
    if (!identities.length) { skipped.push({ rowNumber: index + 1, contactName: row.contactName, reason: "Email or phone is required." }); return; }
    const existingEmail = identities.find((identity) => identity.startsWith("email:") && existingIdentities.has(identity));
    const existingPhone = identities.find((identity) => identity.startsWith("phone:") && existingIdentities.has(identity));
    if (existingEmail || existingPhone) { skipped.push({ rowNumber: index + 1, contactName: row.contactName, reason: existingEmail ? "Duplicate email already exists in this CRM." : "Duplicate phone already exists in this CRM." }); return; }
    if (identities.some((identity) => seen.has(identity))) { skipped.push({ rowNumber: index + 1, contactName: row.contactName, reason: "Duplicate email or phone in this import." }); return; }
    identities.forEach((identity) => seen.add(identity));
    accepted.push(row);
  });
  return { accepted, skipped };
}

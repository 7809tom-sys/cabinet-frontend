// Site legal pages an admin publishes from Operations.
// Each slot has its own history. Saving adds a version and publishes it.
// Rolling back republishes an older version. It does not delete history.
//
// A version whose source is "migration" means "keep the existing site page".
// That is how Terms, Privacy, and the warranty wording stay verbatim until
// Tom uploads a replacement. A warranty spreadsheet is extra: it never
// replaces the warranty prose.

export type LegalVersionSource = "migration" | "text" | "file" | "sheet";

export type LegalSheet = {
  headers: string[];
  rows: string[][];
};

export type LegalFile = {
  fileName: string;
  mimeType: string;
};

export type LegalVersion = {
  version: number;
  source: LegalVersionSource;
  bodyText: string | null;
  file: LegalFile | null;
  sheet: LegalSheet | null;
  uploadedAt: string;
  uploadedBy: string;
};

export type LegalSlot = {
  slug: string;
  title: string;
  publicPath: string;
  publishedVersion: number;
  versions: LegalVersion[];
};

export type LegalUpload = {
  bodyText?: string | null;
  file?: LegalFile | null;
  sheet?: LegalSheet | null;
};

export const LEGAL_PAGE_SEED_SLOTS: readonly { slug: string; title: string; publicPath: string }[] = [
  { slug: "warranty", title: "Warranty", publicPath: "/warranty" },
  { slug: "terms", title: "Terms of Service / Terms and Conditions", publicPath: "/terms" },
  { slug: "affiliate-agreement", title: "Affiliate Agreement", publicPath: "/affiliate-agreement" },
  { slug: "privacy", title: "Privacy", publicPath: "/privacy-policy" },
  { slug: "sales-rep-agreement", title: "Sales Rep Agreement", publicPath: "/sales-rep-agreement" },
];

export function seedLegalSlots(uploadedAt: string, uploadedBy: string): LegalSlot[] {
  return LEGAL_PAGE_SEED_SLOTS.map((slot) => ({
    ...slot,
    publishedVersion: 1,
    versions: [
      {
        version: 1,
        source: "migration",
        bodyText: null,
        file: null,
        sheet: null,
        uploadedAt,
        uploadedBy,
      },
    ],
  }));
}

export function publishedVersion(slot: LegalSlot): LegalVersion | null {
  return slot.versions.find((version) => version.version === slot.publishedVersion) ?? null;
}

export function slugifyLegalSlot(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function addLegalSlot(
  slots: LegalSlot[],
  input: { title: string; publicPath: string },
  uploadedAt: string,
  uploadedBy: string,
): { ok: true; slots: LegalSlot[] } | { ok: false; message: string } {
  const title = input.title.trim();
  const publicPath = input.publicPath.trim();
  const slug = slugifyLegalSlot(title);
  if (!title || !slug) return { ok: false, message: "Enter a name for the new legal page." };
  if (!publicPath.startsWith("/")) return { ok: false, message: "The public address must start with /." };
  if (slots.some((slot) => slot.slug === slug || slot.publicPath === publicPath)) {
    return { ok: false, message: "That page already exists." };
  }
  const slot: LegalSlot = {
    slug,
    title,
    publicPath,
    publishedVersion: 1,
    versions: [
      {
        version: 1,
        source: "migration",
        bodyText: null,
        file: null,
        sheet: null,
        uploadedAt,
        uploadedBy,
      },
    ],
  };
  return { ok: true, slots: [...slots, slot] };
}

/**
 * Publish a new version. A warranty sheet is added on top of the current
 * prose. It does not clear bodyText. A text or file upload becomes the page.
 */
export function publishLegalUpload(
  slot: LegalSlot,
  upload: LegalUpload,
  meta: { uploadedAt: string; uploadedBy: string },
): { ok: true; slot: LegalSlot } | { ok: false; message: string } {
  const current = publishedVersion(slot);
  const text = (upload.bodyText ?? "").trim();
  const file = upload.file ?? null;
  const sheet = upload.sheet ?? null;
  if (!text && !file && !sheet) {
    return { ok: false, message: "Add text, a document, or a spreadsheet before saving." };
  }
  const warrantySheetOnly = slot.slug === "warranty" && sheet != null && !text && !file;
  let source: LegalVersionSource = "text";
  if (file && !text) source = "file";
  else if (warrantySheetOnly) source = "sheet";
  else if (sheet && !text && !file) source = "sheet";

  const next: LegalVersion = {
    version: Math.max(0, ...slot.versions.map((version) => version.version)) + 1,
    source,
    bodyText: text ? text : warrantySheetOnly ? current?.bodyText ?? null : text ? text : null,
    file: file ?? (warrantySheetOnly ? current?.file ?? null : null),
    sheet: sheet ?? (text || file ? current?.sheet ?? null : null),
    uploadedAt: meta.uploadedAt,
    uploadedBy: meta.uploadedBy,
  };
  if (warrantySheetOnly) {
    next.bodyText = current?.bodyText ?? null;
    next.file = current?.file ?? null;
    next.sheet = sheet;
  }
  return {
    ok: true,
    slot: { ...slot, publishedVersion: next.version, versions: [...slot.versions, next] },
  };
}

export function rollbackLegalSlot(
  slot: LegalSlot,
  version: number,
): { ok: true; slot: LegalSlot } | { ok: false; message: string } {
  if (!slot.versions.some((row) => row.version === version)) {
    return { ok: false, message: "That version is not in the history." };
  }
  return { ok: true, slot: { ...slot, publishedVersion: version } };
}

export type LegalPagePresentation = {
  /** "site-page" keeps the existing React page and its wording. */
  render: "site-page" | "text" | "file";
  bodyText: string | null;
  file: LegalFile | null;
  sheet: LegalSheet | null;
  version: number | null;
  versionLabel: string | null;
};

export function presentLegalSlot(slot: LegalSlot | null): LegalPagePresentation {
  const published = slot ? publishedVersion(slot) : null;
  if (!published || published.source === "migration") {
    return {
      render: "site-page",
      bodyText: null,
      file: null,
      sheet: published?.sheet ?? null,
      version: published?.version ?? null,
      versionLabel: slot && published ? `${slot.slug}@${published.version}` : null,
    };
  }
  if (published.source === "file" && published.file) {
    return {
      render: "file",
      bodyText: published.bodyText,
      file: published.file,
      sheet: published.sheet,
      version: published.version,
      versionLabel: `${slot!.slug}@${published.version}`,
    };
  }
  if (published.source === "sheet" && !published.bodyText) {
    return {
      render: "site-page",
      bodyText: null,
      file: published.file,
      sheet: published.sheet,
      version: published.version,
      versionLabel: `${slot!.slug}@${published.version}`,
    };
  }
  return {
    render: "text",
    bodyText: published.bodyText,
    file: published.file,
    sheet: published.sheet,
    version: published.version,
    versionLabel: `${slot!.slug}@${published.version}`,
  };
}

/** Parse a CSV sheet. Quoted commas are kept inside the cell. */
export function parseCsvTable(text: string): LegalSheet | { error: string } {
  const rows = parseCsvRows(text).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (rows.length === 0) return { error: "The spreadsheet has no rows." };
  const [headers, ...body] = rows;
  if (!headers || headers.every((cell) => cell.trim() === "")) return { error: "The spreadsheet needs a header row." };
  return { headers: headers.map((cell) => cell.trim()), rows: body.map((row) => headers.map((_, index) => (row[index] ?? "").trim())) };
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function sheetFromRows(headers: string[], rows: string[][]): LegalSheet | { error: string } {
  if (headers.length === 0) return { error: "The spreadsheet needs a header row." };
  return {
    headers,
    rows: rows.map((row) => headers.map((_, index) => String(row[index] ?? ""))),
  };
}

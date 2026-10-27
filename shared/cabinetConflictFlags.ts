/**
 * Public cabinet-conflict reviews.
 *
 * `conflict` still hides a product from the catalog. These flags use `review`
 * so the same Conflicts tab can list them while the rows stay public.
 * Resolving a flag (Save & clear, or Clear conflict) records the flagged
 * fields on `cabinets.importLockedFields`. Later spreadsheet imports skip
 * those fields; the resolved value stays the source of truth.
 *
 * Workbook: cabinet-descriptions-corrected-2026-10-26.xlsx
 * (sheet cabinet-dealz-distributor-conne). Grok Bot comments that contain
 * "not verified" or "unverified" are only B90 SGH30 and B189 B30. Both are
 * in this list. No other comment matched.
 */

export const PUBLIC_CATALOG_REVIEW_STATUS = "review";
export const HIDDEN_CONFLICT_STATUS = "conflict";

export const RESOLVED_FIELDS_LABEL = "Resolved fields:";

/** Cabinet columns a resolved conflict edit can protect from spreadsheet import. */
export const IMPORT_LOCKABLE_FIELDS = [
  "description",
  "category",
  "subCategory",
  "width",
  "height",
  "depth",
  "numberOfDoors",
  "numberOfDrawers",
  "specNotes",
] as const;

export type ImportLockableField = (typeof IMPORT_LOCKABLE_FIELDS)[number];

export type CabinetConflictFlag = {
  masterCode: string;
  sheetRow: number;
  issue: string;
  currentValue: string;
  source: string;
  needed: string;
  resolvedFields: ImportLockableField[];
};

export const CABINET_CONFLICT_FLAGS: CabinetConflictFlag[] = [
  {
    masterCode: "PGWDC30",
    sheetRow: 69,
    issue: 'Door thickness set to 1" D from a Faircrest dealer listing, not Faircrest\'s own catalog. Glass pane thickness is unpublished.',
    currentValue: 'Plain Glass (PG) Door Only — 15" W x 30" H x 1" D; fits DCW2430 / WDC2430 diagonal corner wall',
    source: "Faircrest (CS) dealer listing CabinetryStock, not Faircrest's own catalog. Workbook row 69.",
    needed: "Manufacturer confirmation of door thickness and glass pane thickness.",
    resolvedFields: ["description", "depth"],
  },
  {
    masterCode: "PGWDC36",
    sheetRow: 70,
    issue: 'Door thickness set to 1" D from a Faircrest dealer listing, not Faircrest\'s own catalog. Glass pane thickness is unpublished.',
    currentValue: 'Plain Glass (PG) Door Only — 15" W x 36" H x 1" D; fits DCW2436 / WDC2436 diagonal corner wall',
    source: "Faircrest (CS) dealer listing CabinetryStock, not Faircrest's own catalog. Workbook row 70.",
    needed: "Manufacturer confirmation of door thickness and glass pane thickness.",
    resolvedFields: ["description", "depth"],
  },
  {
    masterCode: "PGWDC42",
    sheetRow: 71,
    issue: 'Door thickness set to 1" D from a Faircrest dealer listing, not Faircrest\'s own catalog. Glass pane thickness is unpublished.',
    currentValue: 'Plain Glass (PG) Door Only — 15" W x 42" H x 1" D; fits DCW2442 / WDC2442 diagonal corner wall',
    source: "Faircrest (CS) dealer listing CabinetryStock, not Faircrest's own catalog. Workbook row 71.",
    needed: "Manufacturer confirmation of door thickness and glass pane thickness.",
    resolvedFields: ["description", "depth"],
  },
  {
    masterCode: "SPW",
    sheetRow: 330,
    issue: "Description is based on Faircrest dealer listings, not Faircrest's own catalog.",
    currentValue: 'Stained Plywood Panel - 96"W x 36"H x 1/4"D',
    source: "Faircrest dealer listings thewhiteshaker.com and rtacabinets365.com (BC-SPW), not Faircrest's own catalog. Distributor CS. Workbook row 330.",
    needed: "Faircrest catalog confirmation of the stained plywood panel size and description.",
    resolvedFields: ["description"],
  },
  {
    masterCode: "SGH30",
    sheetRow: 90,
    issue: "Size verified only from US Cabinet Depot. Skyline version is not verified.",
    currentValue: 'Stem Glass Holder — 30" W x 1-1/2" H x 12" D',
    source: "US Cabinet Depot listing. Sheet distributors: SK; USCD. Workbook row 90. Grok Bot comment: SK version not verified.",
    needed: "Skyline (SK) confirmation of the stem glass holder size.",
    resolvedFields: ["description", "width", "height", "depth"],
  },
  {
    masterCode: "B30",
    sheetRow: 189,
    issue: "Drawer count is 1 or 2 by distributor. USCD is phasing B30 out for B30S and does not offer it in Oxford or Edgeline. Faircrest and Skyline drawer counts are not verified.",
    currentValue: '30" W x 34-1/2" H x 24" D Base Cabinet — 2 Doors, 1 or 2 Drawers by distributor (see Brand Attributes); 1 shelf',
    source: "Workbook row 189. Distributors: CS; SK; USCD. Grok Bot comment: CS/SK versions not verified.",
    needed: "Confirm Faircrest and Skyline drawer counts, and whether USCD still sells B30 or only B30S.",
    resolvedFields: ["description", "numberOfDrawers"],
  },
];

export function formatConflictReason(flag: CabinetConflictFlag): string {
  return [
    `Issue: ${flag.issue}`,
    `Current value: ${flag.currentValue}`,
    `Source: ${flag.source}`,
    `Needed: ${flag.needed}`,
    `${RESOLVED_FIELDS_LABEL} ${flag.resolvedFields.join(", ")}`,
  ].join("\n");
}

export function isImportLockableField(value: string): value is ImportLockableField {
  return (IMPORT_LOCKABLE_FIELDS as readonly string[]).includes(value);
}

export function parseResolvedFields(reason: string | null | undefined): ImportLockableField[] {
  if (!reason) return [];
  const line = reason
    .split(/\r?\n/)
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith(RESOLVED_FIELDS_LABEL.toLowerCase()));
  if (!line) return [];
  const raw = line.slice(line.indexOf(":") + 1);
  const seen = new Set<ImportLockableField>();
  for (const part of raw.split(",")) {
    const field = part.trim();
    if (isImportLockableField(field)) seen.add(field);
  }
  return Array.from(seen);
}

export function normalizeImportLocks(value: unknown): ImportLockableField[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
      ? safeJsonArray(value)
      : [];
  const seen = new Set<ImportLockableField>();
  for (const entry of list) {
    if (typeof entry === "string" && isImportLockableField(entry)) seen.add(entry);
  }
  return Array.from(seen);
}

function safeJsonArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function mergeImportLocks(existing: unknown, added: readonly string[]): ImportLockableField[] {
  const seen = new Set<ImportLockableField>(normalizeImportLocks(existing));
  for (const field of added) {
    if (isImportLockableField(field)) seen.add(field);
  }
  return Array.from(seen).sort();
}

/**
 * Fields to freeze when an admin resolves a conflict-tab item.
 * Declared flag fields stay locked even if the admin confirms them unchanged.
 * Fields the admin actually edited are locked too.
 */
export function locksAfterResolve(args: {
  existingLocks: unknown;
  conflictReason: string | null | undefined;
  editedFields?: readonly string[];
}): ImportLockableField[] {
  return mergeImportLocks(args.existingLocks, [
    ...parseResolvedFields(args.conflictReason),
    ...(args.editedFields ?? []),
  ]);
}

function sameCatalogValue(before: unknown, after: unknown): boolean {
  if ((before == null || before === "") && (after == null || after === "")) return true;
  if (typeof before === "number" || typeof after === "number") return Number(before) === Number(after);
  const left = String(before ?? "");
  const right = String(after ?? "");
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (left.trim() !== "" && right.trim() !== "" && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber === rightNumber;
  }
  return left === right;
}

/** Lockable fields whose incoming value actually differs from the stored cabinet. */
export function changedLockableFields(
  before: Partial<Record<ImportLockableField, unknown>> | null | undefined,
  patch: Record<string, unknown>,
): ImportLockableField[] {
  return IMPORT_LOCKABLE_FIELDS.filter((field) => (
    Object.prototype.hasOwnProperty.call(patch, field) && !sameCatalogValue(before?.[field], patch[field])
  ));
}

/** Drop locked catalog fields from an import patch. Other keys pass through. */
export function omitImportLockedFields<T extends Record<string, unknown>>(
  patch: T,
  locked: unknown,
): T {
  const skip = new Set<string>(normalizeImportLocks(locked));
  if (skip.size === 0) return patch;
  const next = { ...patch };
  for (const key of Object.keys(next)) {
    if (skip.has(key)) delete next[key];
  }
  return next;
}

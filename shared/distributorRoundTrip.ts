import { csvEscape } from "./catalogExport";
import { splitCsvLine, splitCsvRows } from "./distributorImport";

export const DISTRIBUTOR_ROUND_TRIP_VERSION = "1";

export const DISTRIBUTOR_ROUND_TRIP_HEADERS = [
  "TemplateVersion",
  "ItemCode",
  "ReplacementMasterCode",
  "Aliases",
  "EligibleDistributorCodes",
  "Description",
  "Category",
  "SubCategory",
] as const;

const REQUIRED_HEADERS = DISTRIBUTOR_ROUND_TRIP_HEADERS.filter(
  (header) => header !== "ReplacementMasterCode"
);

export type DistributorRoundTripRow = {
  templateVersion: string;
  itemCode: string;
  replacementMasterCode: string | null;
  aliases: string[];
  eligibleDistributorCodes: string[];
  description: string;
  category: string;
  subCategory: string;
  rowNumber?: number;
};

const HEADER_INDEX = new Map(
  DISTRIBUTOR_ROUND_TRIP_HEADERS.map((header, index) => [header.toLowerCase(), index])
);

export function normalizeDistributorRoundTripCode(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function splitRoundTripCodes(value: string | undefined): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(";")
        .map(normalizeDistributorRoundTripCode)
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
}

export function joinRoundTripCodes(values: Iterable<string | null | undefined>): string {
  return Array.from(
    new Set(
      Array.from(values)
        .filter((value): value is string => Boolean(value?.trim()))
        .map(normalizeDistributorRoundTripCode)
        .filter(Boolean)
    )
  )
    .sort((left, right) => left.localeCompare(right))
    .join("; ");
}

/** Build an ordinary CSV so the downloaded file can be uploaded unchanged. */
export function buildDistributorRoundTripCsv(rows: DistributorRoundTripRow[]): string {
  const lines = [DISTRIBUTOR_ROUND_TRIP_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        DISTRIBUTOR_ROUND_TRIP_VERSION,
        normalizeDistributorRoundTripCode(row.itemCode),
        row.replacementMasterCode ? normalizeDistributorRoundTripCode(row.replacementMasterCode) : "",
        joinRoundTripCodes(row.aliases),
        joinRoundTripCodes(row.eligibleDistributorCodes),
        row.description.trim(),
        row.category.trim(),
        row.subCategory.trim(),
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return `${lines.join("\n")}\n`;
}

export type DistributorRoundTripParseResult = {
  rows: DistributorRoundTripRow[];
  errors: string[];
};

/** Parse only the explicit round-trip contract, never arbitrary catalog CSV. */
export function parseDistributorRoundTripCsv(csv: string): DistributorRoundTripParseResult {
  const rawRows = splitCsvRows(csv).filter((line) => line.trim().length > 0);
  if (rawRows.length === 0) return { rows: [], errors: ["The file is empty."] };

  const headers = splitCsvLine(rawRows[0]);
  const indexes = new Map<string, number>();
  headers.forEach((header, index) => {
    const knownIndex = HEADER_INDEX.get(header.trim().toLowerCase());
    if (knownIndex !== undefined) indexes.set(DISTRIBUTOR_ROUND_TRIP_HEADERS[knownIndex], index);
  });
  const missing = REQUIRED_HEADERS.filter((header) => !indexes.has(header));
  if (missing.length > 0) {
    return { rows: [], errors: [`Missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`] };
  }

  const rows: DistributorRoundTripRow[] = [];
  const errors: string[] = [];
  for (let index = 1; index < rawRows.length; index += 1) {
    const cells = splitCsvLine(rawRows[index]);
    const get = (header: (typeof DISTRIBUTOR_ROUND_TRIP_HEADERS)[number]) => {
      const columnIndex = indexes.get(header);
      return columnIndex === undefined ? "" : (cells[columnIndex] ?? "").trim();
    };
    const templateVersion = get("TemplateVersion");
    const itemCode = normalizeDistributorRoundTripCode(get("ItemCode"));
    const replacementMasterCode = normalizeDistributorRoundTripCode(get("ReplacementMasterCode")) || null;
    const rowNumber = index + 1;
    if (templateVersion !== DISTRIBUTOR_ROUND_TRIP_VERSION) {
      errors.push(`Row ${rowNumber}: unsupported TemplateVersion "${templateVersion || "blank"}".`);
      continue;
    }
    if (!itemCode || itemCode.length > 64) {
      errors.push(`Row ${rowNumber}: ItemCode is required and must be 64 characters or fewer.`);
      continue;
    }
    if (replacementMasterCode && replacementMasterCode.length > 64) {
      errors.push(`Row ${rowNumber}: ReplacementMasterCode must be 64 characters or fewer.`);
      continue;
    }
    rows.push({
      templateVersion,
      itemCode,
      replacementMasterCode,
      aliases: splitRoundTripCodes(get("Aliases")),
      eligibleDistributorCodes: splitRoundTripCodes(get("EligibleDistributorCodes")),
      description: get("Description"),
      category: get("Category"),
      subCategory: get("SubCategory"),
      rowNumber,
    });
  }
  return { rows, errors };
}

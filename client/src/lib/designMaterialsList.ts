import type { BuildSheetRow } from "@/components/design/DesignActions";
import type { CartItem } from "@/contexts/CartContext";
import type { SelectedSurface } from "@/components/design/SurfacesPickerDialog";
import { isApplianceCode } from "@/lib/design";
import { isCatalogFiller } from "@/lib/catalogFiller";
import { normalizeFinalMaterialSelections } from "@/lib/surfaceSelection";
import { equivalentTrimMasterCodes } from "@/lib/trimCart";

export type MaterialsListSection = "cabinet" | "other";
export type MaterialsListPriceStatus = "priced" | "quote_required" | "unavailable";

export type MaterialsListSupplement = {
  code: string;
  description: string;
  category: string;
  qty: number;
  supplier?: string | null;
  styleColor?: string | null;
  dimensions?: string | null;
  unitPrice?: number | null;
  notes?: string | null;
};

export type MaterialsListRow = {
  /** Placed cabinet IDs represented by this row; absent for quote-only items. */
  sourceUids?: string[];
  label: string;
  section: MaterialsListSection;
  code: string;
  description: string;
  category: string;
  supplier: string;
  styleColor: string;
  dimensions: string;
  qty: number;
  unitPrice: number | null;
  lineTotal: number | null;
  /** An unpriced placed cabinet cannot be sold until a verified supplier price exists. */
  priceStatus: MaterialsListPriceStatus;
  notes: string;
};

export type MaterialsListArgs = {
  buildRows: readonly BuildSheetRow[];
  pricingLines: readonly CartItem[];
  selectedSurfaces?: readonly SelectedSurface[];
  supplements?: readonly MaterialsListSupplement[];
  distributorNames?: ReadonlyMap<number, string>;
  defaultDistributorId?: number | null;
  defaultDistributorName?: string | null;
  defaultStyleName?: string | null;
};

function dimensionsFor(row: Pick<BuildSheetRow, "widthIn" | "heightIn" | "depthIn">): string {
  const cell = (value: number) => Number.isFinite(value) && value > 0 ? `${Math.round(value * 100) / 100}\"` : "—";
  return `${cell(row.widthIn)} W × ${cell(row.heightIn)} H × ${cell(row.depthIn)} D`;
}

const CABINET_PART_PATTERN = /\bcabinet\b|\bfiller\b|\bpanel\b|\bskin\b|\btrim\b|mold(?:ing)?|mould(?:ing)?|\bcrown\b|light rail|base rail|toe kick|\bscribe\b|\bvalance\b|\bbatten\b|starter strip|roll[ -]?out (?:shelf|tray)|glass door|decorative door/i;
const NON_CABINET_HARDWARE_PATTERN = /\bhandle\b|\bpull\b|\bknob\b|handles?\s*&\s*hardware|cabinet hardware/i;

export function materialsListSectionFor(item: {
  code: string;
  description: string;
  category?: string | null;
  placement?: string | null;
}): MaterialsListSection {
  const category = item.category?.trim().toLowerCase() ?? "";
  const placement = item.placement?.trim().toLowerCase() ?? "";
  const descriptor = `${item.code} ${item.description} ${category}`;
  if (isApplianceCode(item.code) || category === "appliance" || category === "appliances" || placement === "appliance") return "other";
  if (NON_CABINET_HARDWARE_PATTERN.test(descriptor)) return "other";
  if (["base", "wall", "tall", "vanity", "ada"].includes(placement)) return "cabinet";
  if (isCatalogFiller({ masterCode: item.code, description: item.description, category, subCategory: category })) return "cabinet";
  return CABINET_PART_PATTERN.test(descriptor) ? "cabinet" : "other";
}

function cabinetPartCategory(item: { code: string; description: string; category?: string | null }): string {
  const text = `${item.code} ${item.description} ${item.category ?? ""}`.toLowerCase();
	  if (isCatalogFiller({ masterCode: item.code, description: item.description, category: item.category ?? null, subCategory: item.category ?? null }) || /\bfiller\b/.test(text)) return "Filler";
  if (/\bpanel\b|\bskin\b/.test(text)) return "Panel";
  if (/\btrim\b|mold(?:ing)?|mould(?:ing)?|\bcrown\b|light rail|base rail|toe kick|\bscribe\b|\bvalance\b|\bbatten\b|starter strip/.test(text)) return "Cabinet trim";
  if (/roll[ -]?out (?:shelf|tray)|glass door|decorative door/.test(text)) return "Cabinet accessory";
  return "Cabinet";
}

function alphaLabel(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function supplierFor(line: Pick<CartItem, "distributorId" | "category" | "productKind">, names: ReadonlyMap<number, string>, fallback: string): string {
  if (line.productKind === "hardware") return "Hardware Resources";
  if (line.distributorId != null) return names.get(line.distributorId) ?? fallback;
  return line.category?.trim() || "Surfaces & Fixtures";
}

function safePrice(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function priceStatusFor(args: {
  section: MaterialsListSection;
  unitPrice: number | null;
  sourceUids?: readonly string[];
}): MaterialsListPriceStatus {
  if (args.unitPrice != null) return "priced";
  // Historical placed cabinet geometry stays visible for repair, but a cabinet,
  // filler, panel, trim, or cabinet accessory without a verified source price is
  // unavailable—not a sellable $0 or vague unresolved state.
  if (args.section === "cabinet" && (args.sourceUids?.length ?? 0) > 0) return "unavailable";
  return "quote_required";
}

function unpricedNote(status: MaterialsListPriceStatus): string {
  return status === "unavailable"
    ? "Not purchasable — verified supplier price required"
    : "Quote required";
}

function appendNote(primary: string, secondary: string): string {
  if (!primary) return secondary;
  if (!secondary) return primary;
  return `${primary} · ${secondary}`;
}

export function buildMaterialsListRows(args: MaterialsListArgs): MaterialsListRow[] {
  const names = args.distributorNames ?? new Map<number, string>();
  const defaultSupplier = args.defaultDistributorName?.trim() || (args.defaultDistributorId != null ? names.get(args.defaultDistributorId) : null) || "Cabinet supplier";
  const finalSelectedSurfaces = normalizeFinalMaterialSelections(args.selectedSurfaces ?? []);
  const finalFloorCode = finalSelectedSurfaces.find((surface) => /floor/i.test(surface.category))?.id ?? null;
  const finalBacksplashCode = finalSelectedSurfaces.find((surface) => /tile|mosaic|backsplash/i.test(surface.category))?.id ?? null;
  const pricing = args.pricingLines
    // Surface cart rows are derived exclusively from the final installed floor
    // and backsplash. Retain independent historic PEL rows when this list does
    // not identify a replacement for that material role.
    .filter((line) => {
      if (!line.masterCode.startsWith("PEL-")) return true;
      const category = line.category?.toLowerCase() ?? "";
      if (finalFloorCode != null && category.includes("floor")) return line.masterCode === `PEL-${finalFloorCode}`;
      if (finalBacksplashCode != null && /tile|mosaic|backsplash/.test(category)) return line.masterCode === `PEL-${finalBacksplashCode}`;
      return true;
    })
    .map((line, index) => ({ line, index, consumed: false }));
  const rows: Omit<MaterialsListRow, "label">[] = [];

  for (const build of args.buildRows.filter((row) => {
    if (!(row.qty > 0)) return false;
    // Design cabinet price-locked lines already include the one-time custom-size
    // fee in their adjusted unit price. CUSTOM-ADJ remains on the fabrication
    // build sheet for transparency, but must not become a second priced material
    // line when authoritative cart pricing is available.
    if (row.code === "CUSTOM-ADJ" && args.pricingLines.length > 0) return false;
    return true;
  })) {
    // A legacy build sheet can retain a shared trim key (TK-8) while the
    // selected supplier's verified buyable line keeps its source SKU
    // (TK-8(TKC)). Treat only approved trim-family aliases as the same line;
    // do not broaden regular cabinet matching or invent a substitute price.
    const sameCode = pricing.filter(({ line }) => (
      line.masterCode === build.code || equivalentTrimMasterCodes(line.masterCode, build.code)
    ));
    const lockedBuildPrice = safePrice(build.pricingUnitPrice);
    const exactLocked = lockedBuildPrice == null ? null : sameCode.find(({ line }) =>
      (!build.color || line.styleLabel === build.color) &&
      safePrice(line.unitPrice) != null &&
      Math.abs(Number(line.unitPrice) - lockedBuildPrice) < 0.0001
    );
    const exact = exactLocked
      ?? sameCode.find(({ line }) => build.color && line.styleLabel === build.color)
      ?? (sameCode.length === 1 ? sameCode[0] : null);
    if (exact) exact.consumed = true;
    const unitPrice = safePrice(exact?.line.unitPrice ?? build.pricingUnitPrice ?? build.unitPrice);
    const section = materialsListSectionFor({ code: build.code, description: build.description, category: build.placement, placement: build.placement });
    const priceStatus = priceStatusFor({ section, unitPrice, sourceUids: build.sourceUids });
    rows.push({
      sourceUids: build.sourceUids,
      section,
      code: exact?.line.masterCode ?? build.code,
      description: exact?.line.name ?? build.description,
      category: section === "cabinet" ? cabinetPartCategory({ code: build.code, description: build.description, category: build.placement }) : build.placement || "Other",
      supplier: exact ? supplierFor(exact.line, names, defaultSupplier) : defaultSupplier,
      styleColor: build.color?.trim() || exact?.line.styleLabel?.trim() || args.defaultStyleName?.trim() || "—",
      dimensions: dimensionsFor(build),
      qty: build.qty,
      unitPrice,
      lineTotal: unitPrice == null ? null : unitPrice * build.qty,
      priceStatus,
      notes: appendNote(build.swing ? `${build.swing} hinge` : "", unitPrice == null ? unpricedNote(priceStatus) : ""),
    });
  }

  for (const entry of pricing.filter((value) => !value.consumed && value.line.qty > 0)) {
    const line = entry.line;
    const unitPrice = safePrice(line.unitPrice);
    const section = materialsListSectionFor({ code: line.masterCode, description: line.name, category: line.category });
    const priceStatus = priceStatusFor({ section, unitPrice });
    rows.push({
      section,
      code: line.masterCode,
      description: line.name,
      category: section === "cabinet" ? cabinetPartCategory({ code: line.masterCode, description: line.name, category: line.category }) : line.category?.trim() || "Parts & materials",
      supplier: supplierFor(line, names, defaultSupplier),
      styleColor: line.styleLabel?.trim() || "—",
      dimensions: "—",
      qty: line.qty,
      unitPrice,
      lineTotal: unitPrice == null ? null : unitPrice * line.qty,
      priceStatus,
      notes: appendNote(line.qtyNote?.trim() || "", unitPrice == null ? unpricedNote(priceStatus) : ""),
    });
  }

  const pricedSurfaceCodes = new Set(pricing.map(({ line }) => line.masterCode));
  // Only materials retained in the final kitchen selection belong in the BOM.
  // This defensive normalization protects exports from legacy drafts that still
  // contain an earlier floor or backsplash after the customer picked a replacement.
  for (const surface of finalSelectedSurfaces) {
    const code = `PEL-${surface.id}`;
    if (pricedSurfaceCodes.has(code)) continue;
    // The Materials & Parts total is the exact merchandise total that will be
    // handed to cart and checkout. A selected surface without a current cart
    // line may be a stale saved pick or a fixture with no installed quantity;
    // preserve it on the plan for review, but never resurrect its historical
    // sell price into the invoice total. It stays explicitly quote-required
    // until an active, measured cart line exists.
    const unitPrice = null;
    const priceStatus = priceStatusFor({ section: "other", unitPrice });
    rows.push({
      section: "other",
      code,
      description: surface.name,
      category: surface.category,
      supplier: surface.category || "Surfaces & Fixtures",
      styleColor: surface.subCategory?.trim() || "—",
      dimensions: surface.size?.trim() || "—",
      qty: 1,
      unitPrice,
      lineTotal: unitPrice,
      priceStatus,
      notes: unitPrice == null ? unpricedNote(priceStatus) : "",
    });
  }

  for (const item of args.supplements ?? []) {
    if (!(item.qty > 0)) continue;
    const unitPrice = safePrice(item.unitPrice);
    const section = materialsListSectionFor({ code: item.code, description: item.description, category: item.category });
    const priceStatus = priceStatusFor({ section, unitPrice });
    rows.push({
      section,
      code: item.code,
      description: item.description,
      category: section === "cabinet" ? cabinetPartCategory(item) : item.category,
      supplier: item.supplier?.trim() || defaultSupplier,
      styleColor: item.styleColor?.trim() || "—",
      dimensions: item.dimensions?.trim() || "—",
      qty: item.qty,
      unitPrice,
      lineTotal: unitPrice == null ? null : unitPrice * item.qty,
      priceStatus,
      notes: item.notes?.trim() || (unitPrice == null ? unpricedNote(priceStatus) : ""),
    });
  }

  const cabinets = rows
    .filter((row) => row.section === "cabinet")
    .sort((left, right) => left.code.localeCompare(right.code, undefined, { numeric: true }) || left.description.localeCompare(right.description));
  const others = rows
    .filter((row) => row.section === "other")
    .sort((left, right) => left.description.localeCompare(right.description) || left.code.localeCompare(right.code, undefined, { numeric: true }));
  return [
    ...cabinets.map((row, index) => ({ ...row, label: String(index + 1) })),
    ...others.map((row, index) => ({ ...row, label: alphaLabel(index) })),
  ];
}

function csvEscape(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function materialsListCsv(rows: readonly MaterialsListRow[]): string {
  const header = ["No.", "Section", "Item Code", "Description", "Category", "Distributor", "Color / Style", "Dimensions", "Qty", "Unit Price", "Line Total", "Notes"];
  const lines = [header.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push([
      row.label, row.section === "cabinet" ? "Cabinets & cabinet parts" : "Other materials", row.code, row.description, row.category,
      row.supplier, row.styleColor, row.dimensions, row.qty,
      row.unitPrice == null ? "" : row.unitPrice.toFixed(2), row.lineTotal == null ? "" : row.lineTotal.toFixed(2), row.notes,
    ].map(csvEscape).join(","));
  }
  return lines.join("\n");
}

export function materialsListPricedTotal(rows: readonly MaterialsListRow[]): number {
  return Math.round(rows.reduce((sum, row) => sum + (row.lineTotal ?? 0), 0) * 100) / 100;
}

function htmlEscape(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function materialsListPrintHtml(args: {
  rows: readonly MaterialsListRow[];
  title?: string | null;
  roomLabel?: string | null;
  styleName?: string | null;
  generatedAt?: string | null;
}): string {
  const title = args.title?.trim() || "Kitchen Design Materials & Parts List";
  const meta = [args.roomLabel?.trim(), args.styleName?.trim() ? `Cabinet color / style: ${args.styleName.trim()}` : null, args.generatedAt?.trim()]
    .filter(Boolean).join(" · ");
  const table = (section: MaterialsListSection, heading: string) => {
    const rows = args.rows.filter((row) => row.section === section);
    if (rows.length === 0) return "";
    const priceLabel = (row: MaterialsListRow, value: number | null) => value == null
      ? (row.priceStatus === "unavailable" ? "Unavailable" : "Quote required")
      : `$${value.toFixed(2)}`;
    return `<h2>${htmlEscape(heading)}</h2><table><thead><tr><th>No.</th><th>Item code</th><th>Description</th><th>Category</th><th>Distributor</th><th>Color / style</th><th>Dimensions</th><th>Qty</th><th>Unit price</th><th>Line total</th><th>Notes</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${htmlEscape(row.label)}</td><td>${htmlEscape(row.code)}</td><td>${htmlEscape(row.description)}</td><td>${htmlEscape(row.category)}</td><td>${htmlEscape(row.supplier)}</td><td>${htmlEscape(row.styleColor)}</td><td>${htmlEscape(row.dimensions)}</td><td class="number">${row.qty}</td><td class="number">${priceLabel(row, row.unitPrice)}</td><td class="number">${priceLabel(row, row.lineTotal)}</td><td>${htmlEscape(row.notes)}</td></tr>`).join("")}</tbody></table>`;
  };
  const unavailable = args.rows.filter((row) => row.priceStatus === "unavailable").length;
  const quoteRequired = args.rows.filter((row) => row.priceStatus === "quote_required").length;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${htmlEscape(title)}</title><style>@page{size:letter landscape;margin:.35in}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;margin:0}h1{font-size:18px;margin:0 0 4px;color:#1a2744}p{font-size:9px;margin:0 0 12px;color:#5b6472}h2{font-size:12px;margin:12px 0 4px;color:#8a6422}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.5px;margin-bottom:10px}th,td{border:1px solid #c8ced8;padding:4px;vertical-align:top;overflow-wrap:anywhere}th{background:#e9edf3;text-align:left;font-size:7px;text-transform:uppercase}.number{text-align:right;white-space:nowrap}.summary{display:flex;justify-content:flex-end;gap:18px;font-size:10px;font-weight:700}.unavailable{color:#9f1239}.quote{color:#8a6422}@media print{button{display:none}}</style></head><body><h1>${htmlEscape(title)}</h1><p>${htmlEscape(meta)}</p>${table("cabinet", "Numbered Cabinets & Cabinet Parts")}${table("other", "Other Materials & Parts — Alphabetical")}<div class="summary"><span>Priced total: $${materialsListPricedTotal(args.rows).toFixed(2)}</span>${unavailable ? `<span class="unavailable">Unavailable cabinet lines: ${unavailable}</span>` : ""}${quoteRequired ? `<span class="quote">Quote-required lines: ${quoteRequired}</span>` : ""}</div></body></html>`;
}

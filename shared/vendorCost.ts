/**
 * What a vendor row's COST is, and where it is allowed to come from.
 *
 * Two sources, in this order — never a third:
 *
 *  1. "on file"     — the SKU's stored `vendorWholesale`, which is our real landed
 *                     cost for that item. This is the same number the PO prices
 *                     from, and the one the vendor page already shows.
 *  2. "calculated"  — `listPrice × that vendor's cost factor`, used only when no
 *                     stored cost exists AND the vendor has a factor set. The
 *                     factor is `(baseMultiplier × (1 + freightMultiplier))`, the
 *                     admin "Distributor Multipliers" lever per supply line.
 *
 * If neither exists the row is "missing": we show an em dash. We never copy the
 * list price, never borrow another vendor's factor, and never fall back to the
 * global homeowner markup — that is a *sell*-side multiplier, so using it would
 * present a retail price as our cost.
 *
 * Verified against the real order CD-20261022-OLOUT: distributor cost 284.39,
 * list 449.34. cost / list = 284.39 / 449.34 = 0.632906, so the landed factor is
 * 0.6329 and 449.34 × 0.6329 = 284.39 — which is exactly the stored cost. The
 * sell side is the inverse (1 / 0.6329 = 1.58, a 36.7% margin); that is a
 * different number and is never used here.
 */

export type VendorCostKind = "on_file" | "calculated" | "missing";

export type VendorCostResult = {
  kind: VendorCostKind;
  /** Whole cents, or null when unknown. */
  cents: number | null;
  /** The list price the calculation started from, in cents. */
  listCents: number | null;
  /** The landed-cost factor used, e.g. 0.6329. Null unless kind is "calculated". */
  factor: number | null;
  /** One-line explanation for the tooltip / report. */
  note: string;
};

export const VENDOR_COST_ON_FILE_LABEL = "on file";
export const VENDOR_COST_CALCULATED_LABEL = "calculated";
export const VENDOR_COST_MISSING_LABEL = "—";

/**
 * The landed-cost factor for one supply line:
 * `base × (1 + freight)`, exactly as the Distributor Multipliers tab describes it
 * ("Our cost = (list × Base) × (1 + Tariff)").
 *
 * Returns null unless both parts are usable numbers and the result is a sane
 * fraction (0.01 … 1.00 of list) — the same bounds the admin form enforces. A
 * factor outside that range would be a data-entry error, and inventing a cost
 * from it would be worse than showing "—".
 */
export function vendorCostFactor(
  baseMultiplier: number | string | null | undefined,
  freightMultiplier: number | string | null | undefined,
): number | null {
  const base = numeric(baseMultiplier);
  const freight = numeric(freightMultiplier) ?? 0;
  if (base == null || base <= 0) return null;
  const factor = base * (1 + freight);
  if (!Number.isFinite(factor) || factor < 0.01 || factor > 1) return null;
  return Math.round(factor * 1e6) / 1e6;
}

function numeric(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function toCents(value: number | string | null | undefined): number | null {
  const parsed = numeric(value);
  return parsed == null ? null : Math.round(parsed * 100);
}

/**
 * Resolve the cost to show for one vendor row.
 *
 * @param vendorWholesale the SKU's stored cost ("on file"), when it has one
 * @param listPrice       the SKU's list price, the calculation's only input
 * @param factor          this vendor's landed-cost factor, from vendorCostFactor()
 */
export function resolveVendorCost(
  vendorWholesale: number | string | null | undefined,
  listPrice: number | string | null | undefined,
  factor: number | null,
): VendorCostResult {
  const stored = toCents(vendorWholesale);
  if (stored != null && stored > 0) {
    return { kind: "on_file", cents: stored, listCents: toCents(listPrice), factor: null, note: "Stored vendor cost" };
  }

  const list = toCents(listPrice);
  if (list != null && list > 0 && factor != null) {
    const cents = Math.round(list * factor);
    if (cents > 0) {
      return {
        kind: "calculated",
        cents,
        listCents: list,
        factor,
        note: `List ${formatCents(list)} × ${factor.toFixed(2)} landed-cost factor`,
      };
    }
  }

  return {
    kind: "missing",
    cents: null,
    listCents: list,
    factor: null,
    note: list == null
      ? "No list price and no stored cost"
      : factor == null
        ? "No stored cost and no cost factor set for this vendor"
        : "No stored cost and no usable list price",
  };
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** "$284.39", or the em dash when the cost is unknown. */
export function formatVendorCostCents(result: VendorCostResult): string {
  return result.cents == null ? VENDOR_COST_MISSING_LABEL : formatCents(result.cents);
}

/** "calculated" / "on file" / "—" — the badge next to the number. */
export function vendorCostKindLabel(kind: VendorCostKind): string {
  if (kind === "on_file") return VENDOR_COST_ON_FILE_LABEL;
  if (kind === "calculated") return VENDOR_COST_CALCULATED_LABEL;
  return VENDOR_COST_MISSING_LABEL;
}

export type VendorCostSummary = {
  onFile: number;
  calculated: number;
  missing: number;
  /** Percent of rows that show a number at all. */
  coveragePercent: number;
};

export function summarizeVendorCosts(results: readonly VendorCostResult[]): VendorCostSummary {
  let onFile = 0;
  let calculated = 0;
  let missing = 0;
  for (const result of results) {
    if (result.kind === "on_file") onFile += 1;
    else if (result.kind === "calculated") calculated += 1;
    else missing += 1;
  }
  const total = results.length;
  return {
    onFile,
    calculated,
    missing,
    coveragePercent: total === 0 ? 0 : Math.round(((onFile + calculated) / total) * 1000) / 10,
  };
}

// ─── Per-vendor reporting ─────────────────────────────────────────────────────

export type VendorCostRowInput = {
  vendorId: number;
  vendorName: string;
  vendorWholesale: number | string | null | undefined;
  listPrice: number | string | null | undefined;
};

export type VendorCostReport = {
  vendorId: number;
  vendorName: string;
  /** This vendor's landed-cost factor, or null when none is set. */
  factor: number | null;
  /** Where the factor came from, in words. */
  factorSource: string;
  rows: number;
  onFile: number;
  calculated: number;
  missing: number;
  coveragePercent: number;
};

/**
 * Summarise cost coverage per vendor. A vendor with no factor reports every
 * unpriced row as missing, which is the list an administrator has to fix on the
 * Distributor Multipliers tab.
 */
export function vendorCostReport(
  input: {
    vendorId: number;
    vendorName: string;
    baseMultiplier?: number | string | null;
    freightMultiplier?: number | string | null;
    rows: readonly Omit<VendorCostRowInput, "vendorId" | "vendorName">[];
  },
): VendorCostReport {
  const factor = vendorCostFactor(input.baseMultiplier, input.freightMultiplier);
  const results = input.rows.map((row) => resolveVendorCost(row.vendorWholesale, row.listPrice, factor));
  const summary = summarizeVendorCosts(results);
  const source = factor == null
    ? "no cost factor set on Distributor Multipliers"
    : input.freightMultiplier == null || numeric(input.freightMultiplier) === 0
      ? "Distributor Multipliers base multiplier"
      : "Distributor Multipliers base × (1 + freight rate)";
  return {
    vendorId: input.vendorId,
    vendorName: input.vendorName,
    factor,
    factorSource: source,
    rows: input.rows.length,
    onFile: summary.onFile,
    calculated: summary.calculated,
    missing: summary.missing,
    coveragePercent: summary.coveragePercent,
  };
}

/** Vendors that still cannot show a cost for at least one row — Tom's fix list. */
export function vendorsWithoutFactor(reports: readonly VendorCostReport[]): VendorCostReport[] {
  return reports.filter((report) => report.factor == null && report.missing > 0);
}

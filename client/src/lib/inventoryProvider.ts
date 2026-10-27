/**
 * Vendor inventory seam for the Designer.
 *
 * There is no live inventory feed. Production uses UnknownInventoryProvider,
 * which reports every SKU as `unknown`. The Designer shows nothing for that
 * status, so a missing feed never flags a cabinet.
 *
 * A real feed plugs in later by mapping vendor rows through
 * `stockStatusFromVendorRecord` and returning them from a provider. Until that
 * feed exists, VendorApiInventoryProvider is an unwired placeholder and also
 * reports `unknown`.
 */

export const INVENTORY_STOCK_STATUSES = ["in_stock", "low", "out_of_stock", "unknown"] as const;

export type InventoryStockStatus = (typeof INVENTORY_STOCK_STATUSES)[number];

export type StockStatusResult = {
  sku: string;
  status: InventoryStockStatus;
  qtyAvailable?: number;
  vendor?: string;
  asOf?: string;
};

export type InventoryProviderId = "unknown" | "stub" | "vendor-api";

export interface InventoryProvider {
  readonly id: InventoryProviderId;
  getStockStatus(
    skus: readonly string[],
  ): readonly StockStatusResult[] | Promise<readonly StockStatusResult[]>;
}

/** Below or equal to this on-hand quantity, a known feed is "low" rather than in stock. Matches the vendor upload rule. */
export const INVENTORY_LOW_STOCK_AT = 2;

export function normalizeInventorySku(sku: string): string {
  return sku.trim().toUpperCase();
}

/**
 * Stock identity, most specific first.
 * Door styles often share a master code, so a style-qualified key can be out
 * while the same code in another style from the same vendor is in stock.
 * A bare master code applies to every style when no more specific key is known.
 */
export function inventoryStockKeys(item: {
  masterCode: string;
  sku?: string | null;
  vendorSku?: string | null;
  styleId?: number | null;
}): string[] {
  const master = item.masterCode.trim();
  const keys: string[] = [];
  const vendorSku = item.vendorSku?.trim();
  const sku = item.sku?.trim();
  if (vendorSku) keys.push(vendorSku);
  if (sku && sku.toUpperCase() !== vendorSku?.toUpperCase()) keys.push(sku);
  if (item.styleId != null && master) keys.push(`${item.styleId}:${master}`);
  if (master) keys.push(master);
  const seen = new Set<string>();
  return keys.filter((key) => {
    const normalized = normalizeInventorySku(key);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export class UnknownInventoryProvider implements InventoryProvider {
  readonly id = "unknown" as const;

  getStockStatus(skus: readonly string[]): StockStatusResult[] {
    return skus.map((sku) => ({ sku, status: "unknown" }));
  }
}

export type VendorStockRecord = {
  sku: string;
  /** Null means the feed has no quantity for this SKU. That stays `unknown`. */
  quantityOnHand: number | null;
  outOfStock?: boolean | null;
  vendor?: string;
  asOf?: string;
};

/**
 * Map one future vendor row onto the Designer status. A missing quantity with
 * no explicit out-of-stock flag stays `unknown` so an empty feed cannot flag
 * cabinets. This function does not fetch anything.
 */
export function stockStatusFromVendorRecord(record: VendorStockRecord): StockStatusResult {
  const base = { sku: record.sku, vendor: record.vendor, asOf: record.asOf };
  if (record.outOfStock === true || record.quantityOnHand === 0) {
    return { ...base, status: "out_of_stock", qtyAvailable: 0 };
  }
  if (record.quantityOnHand == null) return { ...base, status: "unknown" };
  if (record.quantityOnHand <= INVENTORY_LOW_STOCK_AT) {
    return { ...base, status: "low", qtyAvailable: record.quantityOnHand };
  }
  return { ...base, status: "in_stock", qtyAvailable: record.quantityOnHand };
}

/**
 * Placeholder for a future vendor API. Not selected in production.
 *
 * When a feed exists, implement `getStockStatus` by requesting these SKUs and
 * mapping each row with `stockStatusFromVendorRecord`. Leave SKUs the feed
 * does not mention as `unknown`. Then return this provider from
 * `resolveDesignerInventoryProvider` only after the feed is live.
 * See docs/inventory-integration.md.
 */
export class VendorApiInventoryProvider implements InventoryProvider {
  readonly id = "vendor-api" as const;
  /** False until a live feed is wired. The Designer must not treat this as data. */
  readonly configured = false;

  getStockStatus(skus: readonly string[]): StockStatusResult[] {
    return skus.map((sku) => ({ sku, status: "unknown" }));
  }
}

export type StubInventoryOptions = {
  /** Master codes (`B36`) or style-qualified codes (`11:B36`). */
  outOfStock: readonly string[];
  low?: readonly string[];
  vendor?: string;
  asOf?: string;
};

/**
 * Admin/dev simulation. Listed SKUs are out of stock or low. Every other SKU
 * is `unknown` here; the Designer treats unlisted simulation SKUs as in stock
 * so alternatives can be offered. Production never uses this provider.
 */
export class StubInventoryProvider implements InventoryProvider {
  readonly id = "stub" as const;
  private readonly outOfStock: Set<string>;
  private readonly low: Set<string>;
  private readonly vendor: string;
  private readonly asOf: string;

  constructor(options: StubInventoryOptions) {
    this.outOfStock = new Set(options.outOfStock.map(normalizeInventorySku));
    this.low = new Set((options.low ?? []).map(normalizeInventorySku));
    this.vendor = options.vendor ?? "simulation";
    this.asOf = options.asOf ?? INVENTORY_SIM_AS_OF;
  }

  getStockStatus(skus: readonly string[]): StockStatusResult[] {
    return skus.map((sku) => {
      const key = normalizeInventorySku(sku);
      if (this.outOfStock.has(key)) {
        return { sku, status: "out_of_stock", qtyAvailable: 0, vendor: this.vendor, asOf: this.asOf };
      }
      if (this.low.has(key)) {
        return { sku, status: "low", qtyAvailable: 1, vendor: this.vendor, asOf: this.asOf };
      }
      return { sku, status: "unknown" };
    });
  }
}

/** Sample codes the admin fixture marks out of stock in every door style. */
export const INVENTORY_SIM_FIXTURE_OUT_OF_STOCK = ["B36", "W3012", "SB36", "BBC36", "DB24"] as const;

export const INVENTORY_SIM_AS_OF = "2026-01-15T00:00:00.000Z";

export const INVENTORY_SIM_STORAGE_KEY = "cabinetdealz.inventorySim";

export const INVENTORY_SIM_QUERY = "inventorySim";

export type InventorySimulationRequest =
  | { enabled: false }
  | { enabled: true; skus: readonly string[] | null };

const SIM_OFF = new Set(["0", "false", "off", "none"]);
const SIM_ON = new Set(["1", "true", "on", "yes", "fixture"]);

export function parseInventorySimulationValue(raw: string | null | undefined): InventorySimulationRequest {
  if (raw == null) return { enabled: false };
  const value = raw.trim();
  if (value === "" || SIM_ON.has(value.toLowerCase())) return { enabled: true, skus: null };
  if (SIM_OFF.has(value.toLowerCase())) return { enabled: false };
  const skus = value.split(/[,|\s]+/).map((sku) => sku.trim()).filter(Boolean);
  return skus.length > 0 ? { enabled: true, skus } : { enabled: false };
}

/**
 * URL `inventorySim` wins over localStorage. `1` uses the fixture. A list such
 * as `B36,11:W3012` marks those SKUs. `0` turns simulation off.
 */
export function readInventorySimulation(search: string, stored: string | null): InventorySimulationRequest {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (params.has(INVENTORY_SIM_QUERY)) return parseInventorySimulationValue(params.get(INVENTORY_SIM_QUERY));
  if (stored == null || stored.trim() === "") return { enabled: false };
  return parseInventorySimulationValue(stored);
}

/**
 * Production and every non-admin session get the unknown provider, even if
 * the simulation query or localStorage flag is present.
 */
export function resolveDesignerInventoryProvider(input: {
  isAdmin: boolean;
  search: string;
  storedFlag: string | null;
}): InventoryProvider {
  if (!input.isAdmin) return new UnknownInventoryProvider();
  const request = readInventorySimulation(input.search, input.storedFlag);
  if (!request.enabled) return new UnknownInventoryProvider();
  return new StubInventoryProvider({
    outOfStock: request.skus ?? INVENTORY_SIM_FIXTURE_OUT_OF_STOCK,
    asOf: INVENTORY_SIM_AS_OF,
    vendor: "simulation",
  });
}

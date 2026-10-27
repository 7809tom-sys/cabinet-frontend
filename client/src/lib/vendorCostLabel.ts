/** Display for pelican_products.vendorWholesale / distributor vendorWholesale. Never falls back to retail. */
export function pelicanVendorCostLabel(value: unknown): string {
  if (value == null || value === "") return "No cost on file";
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "No cost on file";
  return `$${parsed.toFixed(2)}`;
}

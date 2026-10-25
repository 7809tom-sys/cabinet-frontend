export type FreightQuoteDeliveryAddress = {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  zip: string;
};

export type NormalizedFreightQuoteDeliveryAddress = {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  zip: string;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

/**
 * Normalize the minimum complete delivery address required before Cabinet Dealz
 * requests or authorizes freight. This is intentionally a syntax check only;
 * provider-specific address verification remains a separate workflow.
 */
export function normalizeFreightQuoteDeliveryAddress(
  address: FreightQuoteDeliveryAddress,
): NormalizedFreightQuoteDeliveryAddress | null {
  const line1 = normalizeText(address.line1);
  const line2 = normalizeText(address.line2) || null;
  const city = normalizeText(address.city);
  const state = normalizeText(address.state).toUpperCase();
  const zip = normalizeText(address.zip).replace(/\D/g, "").slice(0, 5);

  if (line1.length < 3 || city.length < 2 || !/^[A-Z]{2}$/.test(state) || !/^\d{5}$/.test(zip)) {
    return null;
  }

  return { line1, line2, city, state, zip };
}

export function hasCompleteFreightQuoteDeliveryAddress(
  address: FreightQuoteDeliveryAddress,
): boolean {
  return normalizeFreightQuoteDeliveryAddress(address) != null;
}

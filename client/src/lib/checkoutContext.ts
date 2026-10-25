export type CheckoutTier = "Homeowner" | "Contractor" | "Wholesale";

export function resolveCheckoutTier(initialTier: string | null | undefined, accountTier: string | null | undefined): CheckoutTier {
  if (initialTier === "Homeowner" || initialTier === "homeowner") return "Homeowner";
  if (initialTier === "Wholesale" || initialTier === "wholesale") return "Wholesale";
  if (initialTier === "Contractor" || initialTier === "contractor") return "Contractor";
  if (accountTier === "Homeowner" || accountTier === "homeowner") return "Homeowner";
  return accountTier === "Wholesale" || accountTier === "wholesale" ? "Wholesale" : "Contractor";
}

export function checkoutUsesReadOnlyContext() {
  return { styleEditable: false, pricingEditable: false } as const;
}

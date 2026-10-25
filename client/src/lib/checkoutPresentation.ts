import type { CheckoutTier } from "@/lib/checkoutContext";

export function checkoutPresentation(styleName: string | null | undefined, tier: CheckoutTier) {
  return {
    doorStyle: styleName ?? "No compatible style is available for all matched cabinets.",
    pricingTier: tier === "Wholesale" ? "Wholesale" : tier === "Homeowner" ? "Homeowner" : "Contractor",
    styleEditable: false,
    pricingEditable: false,
  };
}

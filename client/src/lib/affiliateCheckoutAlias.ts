import { styleDisplayName } from "@/lib/styleDisplayName";

export type CheckoutAliasStyle = { styleId: number; name: string } | null | undefined;

/** Resolves the display name used throughout the order-review summary. */
export function resolveCheckoutAlias(
  selectedStyle: CheckoutAliasStyle,
  styleNames: Record<number, string> | null | undefined,
): string | null {
  if (!selectedStyle) return null;
  const rawName = styleNames?.[selectedStyle.styleId] || selectedStyle.name;
  return styleDisplayName({ aliasName: rawName, styleCode: selectedStyle.name }) || selectedStyle.name;
}

import { styleDisplayName } from "@/lib/styleDisplayName";

export type CheckoutAliasStyle = { styleId: number; name: string } | null | undefined;

/**
 * The name to send for one checkout line: that line's style, after the
 * affiliate store rename. Falls back to the catalog name for the same styleId.
 */
export function checkoutLineStyleName(
  styleId: number | null | undefined,
  styles: Array<{ styleId: number; name: string }>,
  styleNames: Record<number, string> | null | undefined,
): string | null {
  if (styleId == null || !Number.isFinite(styleId) || styleId <= 0) return null;
  const option = styles.find((style) => style.styleId === styleId);
  const resolved = resolveCheckoutAlias({ styleId, name: option?.name ?? "" }, styleNames);
  return resolved?.trim() || null;
}

/** Resolves the display name used throughout the order-review summary. */
export function resolveCheckoutAlias(
  selectedStyle: CheckoutAliasStyle,
  styleNames: Record<number, string> | null | undefined,
): string | null {
  if (!selectedStyle) return null;
  const rawName = styleNames?.[selectedStyle.styleId] || selectedStyle.name;
  return styleDisplayName({ aliasName: rawName, styleCode: selectedStyle.name }) || selectedStyle.name;
}

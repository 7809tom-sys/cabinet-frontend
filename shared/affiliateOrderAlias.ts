export type AliasOrderLine = { styleId?: number | null; doorStyle?: string | null };

/**
 * Applies aliases that belong to one affiliate only. Central names remain the
 * fallback when that affiliate has not provided an override for a style.
 */
export function applyAffiliateOrderAliases<T extends AliasOrderLine>(
  lines: T[],
  aliases: Map<number, string>,
): T[] {
  return lines.map((line) => ({
    ...line,
    doorStyle: (line.styleId != null ? aliases.get(line.styleId) : undefined) ?? line.doorStyle ?? null,
  })) as T[];
}

export function resolveAffiliateOrderStyleName(
  styleId: number | null | undefined,
  submittedName: string | null | undefined,
  aliases: Map<number, string>,
): string | null {
  return (styleId != null ? aliases.get(styleId) : undefined) ?? submittedName ?? null;
}

/**
 * The canonical alias-bearing values used when a request is persisted and its
 * submitted-order CRM payload is built. Keeping these values together prevents
 * a central catalog name from leaking into one downstream surface.
 */
export function buildAffiliateOrderPersistence<T extends AliasOrderLine>(args: {
  styleId: number | null | undefined;
  submittedStyleName: string | null | undefined;
  lines: T[];
  aliases: Map<number, string>;
}) {
  const styleName = resolveAffiliateOrderStyleName(args.styleId, args.submittedStyleName, args.aliases);
  const lineItems = applyAffiliateOrderAliases(args.lines, args.aliases);
  return {
    styleName,
    lineItems,
    crmData: { styleName },
  };
}

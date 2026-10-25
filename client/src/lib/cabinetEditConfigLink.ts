export type CabinetEditConfigLink = {
  href: string;
  target: "_blank";
  rel: "noopener noreferrer";
};

/**
 * Builds the exact catalog-detail route that opens a cabinet's configuration
 * editor. The cabinet ID is required so duplicate SKUs cannot open the wrong
 * master record from the designer.
 */
export function cabinetEditConfigHref(
  masterCode?: string | null,
  cabinetId?: number | null,
): string | null {
  const code = masterCode?.trim();
  if (!code || !Number.isInteger(cabinetId) || (cabinetId ?? 0) <= 0) return null;

  return `/catalog/${encodeURIComponent(code)}?edit=1&cabinetId=${cabinetId}`;
}

/**
 * Returns the safe external-navigation contract for a cabinet's Edit Config
 * destination. An absent master-config URL means the current viewer is not
 * entitled to see an edit destination.
 */
export function cabinetEditConfigLink(masterConfigHref?: string): CabinetEditConfigLink | null {
  if (!masterConfigHref) return null;

  return {
    href: masterConfigHref,
    target: "_blank",
    rel: "noopener noreferrer",
  };
}

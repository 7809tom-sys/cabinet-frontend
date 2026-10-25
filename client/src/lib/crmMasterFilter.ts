export const MASTER_AFFILIATE_FILTER_ALL = "all";

export function masterAffiliateFilterId(value: string): number | undefined {
  if (value === MASTER_AFFILIATE_FILTER_ALL) return undefined;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

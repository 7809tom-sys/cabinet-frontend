export type AffiliateDashboardSelection =
  | { kind: "admin-view-as"; affiliateId: number }
  | { kind: "admin-picker" }
  | { kind: "my-affiliate" };

export function resolveAffiliateDashboardSelection(viewAsId: string | null | undefined, isAdmin: boolean): AffiliateDashboardSelection {
  if (!isAdmin) return { kind: "my-affiliate" };
  const affiliateId = Number(viewAsId);
  if (Number.isInteger(affiliateId) && affiliateId > 0) return { kind: "admin-view-as", affiliateId };
  return { kind: "admin-picker" };
}

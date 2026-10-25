export type InstallationEstimateAccessUser = { id: number; email: string | null; role: string };
export type InstallationEstimateAffiliateRecord = { id: number; userId: number | null; email: string | null };
export type InstallationEstimateMembership = { affiliateId: number; userId: number | null; email: string | null; isActive: boolean; accessCrm: boolean; accessDesigner?: boolean };

export function resolveInstallationEstimateAffiliateId({
  user,
  requestedAffiliateId,
  affiliates,
  memberships,
  requireDesigner = false,
}: {
  user: InstallationEstimateAccessUser;
  requestedAffiliateId?: number;
  affiliates: InstallationEstimateAffiliateRecord[];
  memberships: InstallationEstimateMembership[];
  requireDesigner?: boolean;
}): number | null {
  if (user.role === "admin" && requestedAffiliateId && requestedAffiliateId > 0) return requestedAffiliateId;

  const email = (user.email ?? "").trim().toLowerCase();
  const direct = affiliates.find((affiliate) => affiliate.userId === user.id)
    ?? affiliates.find((affiliate) => email.length > 0 && (affiliate.email ?? "").trim().toLowerCase() === email);
  if (direct) return direct.id;

  const membership = memberships.find((candidate) => {
    const memberEmail = (candidate.email ?? "").trim().toLowerCase();
    return candidate.isActive
      && candidate.accessCrm
      && (!requireDesigner || candidate.accessDesigner === true)
      && (candidate.userId === user.id || (email.length > 0 && memberEmail === email));
  });
  return membership?.affiliateId ?? null;
}

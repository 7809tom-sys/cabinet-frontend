export type InstallationEstimateStatus = "draft" | "shared" | "accepted" | "cancelled";

export function isCustomerVisibleInstallationEstimate(status: InstallationEstimateStatus): boolean {
  return status === "shared" || status === "accepted";
}

export function installationEstimateStatusAction(status: InstallationEstimateStatus): "share" | null {
  return status === "draft" ? "share" : null;
}

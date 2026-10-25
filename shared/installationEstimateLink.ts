export function installationEstimateDocumentPath(shareToken: string): string {
  return `/installation-estimate/${encodeURIComponent(shareToken)}`;
}

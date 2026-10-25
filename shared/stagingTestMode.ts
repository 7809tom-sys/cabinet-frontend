export function isStagingTestHost(hostname: string | null | undefined): boolean {
  const host = (hostname ?? "").split(":", 1)[0].trim().toLowerCase();
  return host.endsWith(".manus.space") || host === "manus.space";
}

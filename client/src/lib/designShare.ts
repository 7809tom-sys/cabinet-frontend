export function buildDesignShareUrl({
  origin,
  designId,
  affiliateSlug,
}: {
  origin: string;
  designId: number;
  affiliateSlug?: string | null;
}) {
  const url = new URL("/design", origin);
  url.searchParams.set("load", String(designId));
  if (affiliateSlug) url.searchParams.set("affiliate", affiliateSlug);
  return url.toString();
}

export function buildRemoteDesignSessionUrl({
  origin,
  token,
}: {
  origin: string;
  token: string;
}) {
  const url = new URL(`/design/session/${encodeURIComponent(token)}`, origin);
  return url.toString();
}

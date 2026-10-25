export function affiliateCabinetDetailHref({
  slug,
  masterCode,
  styleId,
  cabinetId,
}: {
  slug?: string;
  masterCode: string;
  styleId: number;
  cabinetId?: number;
}): string {
  const code = encodeURIComponent(masterCode);
  const id = cabinetId != null && Number.isInteger(cabinetId) && cabinetId > 0
    ? `&cabinetId=${cabinetId}`
    : "";
  const query = `?style=${styleId}${id}`;
  return slug ? `/store/${slug}/catalog/${code}${query}` : `/catalog/${code}${query}`;
}

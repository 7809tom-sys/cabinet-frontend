export type PhotoCartMatchRow = {
  masterCode: string | null;
  description: string | null;
  matched: boolean;
  quantity: number;
};

export type PhotoCartStyle = { id: number; label: string };

export function buildPhotoCartItems(
  rows: PhotoCartMatchRow[],
  style: PhotoCartStyle,
  tier: "wholesale" | "contractor",
) {
  return rows
    .filter((row) => row.matched && Boolean(row.masterCode))
    .map((row) => ({
      masterCode: row.masterCode!,
      name: row.description ?? row.masterCode!,
      styleId: style.id,
      styleLabel: style.label,
      distributorId: null as number | null,
      tier,
      unitPrice: null as number | null,
      qty: Math.max(1, Math.floor(row.quantity || 1)),
    }));
}

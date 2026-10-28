/**
 * Wall wine racks are real upper cabinets (WRC, WXR, WWC, LWR).
 * Suppliers file them under several labels: "Wall Wine Rack",
 * "Wine Rack / Open Display", "Accessories / Wine Storage", and
 * "Specialty / Wine Rack". Those labels still belong on the Wall
 * catalog and in the Designer wall picker. Auto-Design keeps its own
 * rule and does not treat them as straight uppers.
 *
 * WR#### is a refrigerator wall cabinet, not a wine rack.
 */

export type WallWineRackFields = {
  id?: number | string | null;
  masterCode?: string | null;
  category?: string | null;
  subCategory?: string | null;
  description?: string | null;
  placement?: string | null;
};

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function wallWineRackCode(masterCode: string | null | undefined): string {
  return (masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** True for a wall wine-rack box, including the supplier category names above. */
export function isWallWineRackCabinet(cabinet: WallWineRackFields): boolean {
  const code = wallWineRackCode(cabinet.masterCode);
  if (/^(?:WRC|WXR|WWC|LWR)\d/.test(code)) return true;
  const category = normalized(cabinet.category);
  const subCategory = normalized(cabinet.subCategory);
  if (category === "wall wine rack") return true;
  if (
    subCategory === "wine rack"
    || subCategory === "wine rack / open display"
    || subCategory === "wine storage"
  ) {
    return true;
  }
  if (
    (category === "specialty" || category === "accessory" || category === "accessories")
    && subCategory.includes("wine")
  ) {
    return true;
  }
  return false;
}

function rowKey(row: WallWineRackFields): string {
  if (row.id != null && String(row.id) !== "") return `id:${Number(row.id)}`;
  return `code:${wallWineRackCode(row.masterCode)}`;
}

/**
 * Keep every wall-placement row, and add wine racks that a category filter
 * sent to Base or Accessories. Added rows are placed as wall cabinets.
 */
export function withWallWineRacks<T extends WallWineRackFields>(
  wallRows: readonly T[],
  otherRows: readonly T[],
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const row of wallRows) {
    const key = rowKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(isWallWineRackCabinet(row) ? { ...row, placement: "wall" } : row);
  }
  for (const row of otherRows) {
    if (!isWallWineRackCabinet(row)) continue;
    const key = rowKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ ...row, placement: "wall" });
  }
  return result;
}

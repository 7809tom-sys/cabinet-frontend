/**
 * LS3612 is a Lazy Susan version of the 36-inch shelf-corner body. When its
 * active catalog line has no approved price, users may explicitly choose one
 * of these shelf-body alternatives; the designer must never substitute one.
 */
export const LS3612_SHELF_REPLACEMENT_CODES = ["ER36", "BER36"] as const;

export function isUnpricedLs3612(masterCode: string | null | undefined, unitPrice: number | null | undefined): boolean {
  return (masterCode ?? "").trim().toUpperCase() === "LS3612" && unitPrice == null;
}

export function availableLs3612ShelfReplacementChoices<T extends { masterCode: string }>(catalog: T[]): T[] {
  const byCode = new Map<string, T>();
  for (const item of catalog) {
    const code = item.masterCode.trim().toUpperCase();
    if ((code === "ER36" || code === "BER36") && !byCode.has(code)) byCode.set(code, item);
  }
  return LS3612_SHELF_REPLACEMENT_CODES.flatMap((code) => {
    const item = byCode.get(code);
    return item ? [item] : [];
  });
}

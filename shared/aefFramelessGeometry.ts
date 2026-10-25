import { AEF_EXPANDED_SOURCE_GEOMETRY } from "./aefFramelessExpandedGeometry";

export type AefPrintedGeometry = {
  constructionType: "frameless";
  width: number;
  height: number;
  depth: number;
  toeKickHeight: number | null;
  sourcePage: string;
  status: "verified";
};

/** Marker carried from an AEF distributor SKU into the Designer palette and placed cabinet. */
export const AEF_PRINTED_GEOMETRY_MARKER =
  "Frameless; distributor geometry is printed in AltaEuro Collection Full Spec Book V8.2";

export function hasAefPrintedGeometry(cabinet: { constructionMethod?: string | null }): boolean {
  return cabinet.constructionMethod === AEF_PRINTED_GEOMETRY_MARKER;
}

function inches(value: string): number {
  const match = value.match(/^(\d+)(?:([0-9]+)\/(\d+))?$/);
  if (!match) throw new Error(`Unsupported inch value: ${value}`);
  return Number(match[1]) + (match[2] ? Number(match[2]) / Number(match[3]) : 0);
}

/**
 * Printed AEF V10.2026 geometry for the rows that have a safe spec-book match.
 * The shared cabinet master is intentionally not consulted or changed here.
 */
export function aefPrintedGeometryForSku(rawSku: string): AefPrintedGeometry | null {
  const sku = rawSku.trim().toUpperCase();
  if (!sku) return null;

  // Complete-line geometry comes from the exact AltaEuro V8.2 drawing table.
  // This is intentionally checked before the compact pattern rules below: a
  // source model such as WFD241824-BLUM or TOS2DB3084 must never be reduced to
  // a generic shared-master profile. The source table is distributor scoped;
  // framed master dimensions remain untouched.
  const expanded = AEF_EXPANDED_SOURCE_GEOMETRY[sku];
  if (expanded) {
    return {
      constructionType: "frameless",
      width: expanded.width,
      height: expanded.height,
      depth: expanded.depth,
      toeKickHeight: expanded.toeKickHeight,
      sourcePage: expanded.sourcePage,
      status: "verified",
    };
  }

  const baseSku = sku.replace(/S$/, "");
  const base = baseSku.match(/^(VSB|SB|B)(\d{2})(FH)?$/);
  if (base) {
    const family = base[1];
    const width = Number(base[2]);
    const isVanity = family === "VSB";
    const sourcePage = isVanity ? "64-65" : family === "SB" ? "27-28" : base[3] ? "20" : "21-22";
    return {
      constructionType: "frameless",
      width,
      height: 34.75, // 30-1/4" box + 4-1/2" legs, printed in the base drawings
      depth: isVanity ? 21 : 24,
      toeKickHeight: 4.5,
      sourcePage,
      status: "verified",
    };
  }

  const easyReach = sku.match(/^BER(33|36)$/);
  if (easyReach) {
    return {
      constructionType: "frameless",
      width: Number(easyReach[1]),
      height: 34.75,
      depth: 24,
      toeKickHeight: 4.5,
      sourcePage: "32-33",
      status: "verified",
    };
  }

  const wall = sku.replace(/S$/, "").match(/^W(ER)?(\d{2})(12|15|18|23|30|35|40)(24)?$/);
  if (wall) {
    const isEasyReach = Boolean(wall[1]);
    const heightByNominal: Record<string, number> = {
      "12": inches("125/8"),
      "15": inches("151/8"),
      "18": inches("175/8"),
      "23": inches("225/8"),
      "30": inches("301/4"),
      "35": inches("351/4"),
      "40": inches("401/4"),
    };
    const heightKey = wall[3];
    const sourcePage = isEasyReach
      ? "43"
      : wall[4]
        ? ({ "12": "46", "15": "47", "18": "47", "23": "48" }[heightKey] ?? "46-48")
        : ({ "12": "43", "15": "44", "18": "44", "23": "45", "30": "37", "35": "38", "40": "39" }[heightKey] ?? "37-45");
    return {
      constructionType: "frameless",
      width: Number(wall[2]),
      height: heightByNominal[heightKey],
      depth: wall[4] ? 24 : 13.5,
      toeKickHeight: null,
      sourcePage,
      status: "verified",
    };
  }

  const tall = sku.match(/^(T|VT)(\d{2})(84|89|94)$/);
  if (tall) {
    return {
      constructionType: "frameless",
      width: Number(tall[2]),
      height: 79.5,
      depth: tall[1] === "VT" ? 21 : 24,
      toeKickHeight: null,
      sourcePage: tall[1] === "VT" ? "69-70" : "50-57",
      status: "verified",
    };
  }

  return null;
}

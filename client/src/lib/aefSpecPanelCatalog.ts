import {
  AEF_BEP2535,
  AEF_END_PANEL_THICKNESS_IN,
  AEF_TEP3096,
  AEF_WEP_STOCK,
  type AefEndPanelStock,
} from "./aefEndPanelStock";

/**
 * Printed AltaEuro end-panel SKUs. `design.placeableCabinets` omits them for
 * the frameless line: their placement column is empty, and TEP3096 is kept off
 * the accessory palette. They are still priced per door style, so the Designer
 * resolves them by code when an AltaEuro style is selected.
 */
export const AEF_SPEC_END_PANEL_CODES = [
  AEF_BEP2535.masterCode,
  ...AEF_WEP_STOCK.map((stock) => stock.masterCode),
  AEF_TEP3096.masterCode,
] as const;

const SPEC_STOCK: readonly AefEndPanelStock[] = [AEF_BEP2535, ...AEF_WEP_STOCK, AEF_TEP3096];

export type AefSpecPanelSource = {
  id?: number | null;
  masterCode?: string | null;
  description?: string | null;
  category?: string | null;
  subCategory?: string | null;
};

export type AefSpecPanelCabinet = {
  id: number;
  masterCode: string;
  description: string;
  category: string | null;
  subCategory: string | null;
  /** Face that covers the cabinet side, from the printed sheet. */
  width: string;
  height: string;
  /** 3/4" sheet. A reused code must not keep a cabinet-box depth. */
  depth: string;
  placement: "base" | "wall" | "tall";
  numberOfDoors: null;
  numberOfDrawers: null;
  isCornerCabinet: null;
};

function specFor(masterCode: string): AefEndPanelStock | null {
  const code = masterCode.trim().toUpperCase();
  return SPEC_STOCK.find((stock) => stock.masterCode === code) ?? null;
}

/**
 * A catalog row for one printed end panel. Dimensions come from the spec sheet
 * so a code stored with a 12" cabinet depth still covers the side as a 3/4" skin.
 */
export function aefSpecPanelCabinet(source: AefSpecPanelSource | null | undefined): AefSpecPanelCabinet | null {
  const id = Number(source?.id);
  const spec = source?.masterCode ? specFor(source.masterCode) : null;
  if (!Number.isFinite(id) || id <= 0 || !spec) return null;
  const placement = spec.family === "wall" ? "wall" : spec.family === "tall" ? "tall" : "base";
  return {
    id,
    masterCode: spec.masterCode,
    description: source?.description?.trim() || `${spec.masterCode} 3/4" end panel`,
    category: source?.category ?? "Accessory",
    subCategory: source?.subCategory ?? "End panel",
    width: String(spec.stockWidth),
    height: String(spec.stockHeight),
    depth: String(AEF_END_PANEL_THICKNESS_IN),
    placement,
    numberOfDoors: null,
    numberOfDrawers: null,
    isCornerCabinet: null,
  };
}

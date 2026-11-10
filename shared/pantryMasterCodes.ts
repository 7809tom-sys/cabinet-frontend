/**
 * Pantry order codes.
 *
 * A customer orders one master code. The order includes the component SKUs
 * listed here. No existing bundle, kit, or composite cabinet table was found
 * in this repo, and no code 1830 is a pantry kit. W1830 is the regular
 * 18 x 30 x 12 wall cabinet and is not one of these masters.
 *
 * 1884 is the code Tom named: UCB1854 (54" base) + W183024 (30" top) = 84".
 * 1890 and 1896 use that same height sum and are waiting on Tom's confirmation.
 * They do not replace 1830.
 *
 * 1876 is the confined-space stack: 3DB18, the 18 x 34.5 x 24 three-drawer
 * base, on the floor, with W184224 (18 x 42 x 24) on top. 34.5 + 42 = 76.5.
 * The code 1876 follows the height-number pattern and still needs Tom's OK.
 * It is not part of the UCB1854 stacks.
 */

export type PantryComponentRole = "base" | "top";

export type PantryMasterComponent = {
  code: string;
  role: PantryComponentRole;
  /** Piece height used by the elevation. Base sits on the floor. */
  heightIn: number;
  /** Catalog or November 2026 guide description. Not a rewritten sentence. */
  description: string;
  /** Drawer bands drawn on the elevation. Omitted when the piece is not a drawer stack. */
  drawerCount?: number;
};

export type PantryMasterCode = {
  masterCode: "1884" | "1890" | "1896" | "1876";
  /** Overall stacked height, base height plus top height. */
  heightIn: 84 | 90 | 96 | 76.5;
  widthIn: 18;
  depthIn: 24;
  /** Sentence shown on the preload shopping list. */
  shoppingDescription: string;
  /** Public path of the assembled elevation. */
  diagramPath: string;
  /** Tom named 1884. The others follow the same sum and still need his yes. */
  confirmedByTom: boolean;
  components: readonly [PantryMasterComponent, PantryMasterComponent];
};

export const PANTRY_MASTER_CODES: readonly PantryMasterCode[] = [
  {
    masterCode: "1884",
    heightIn: 84,
    widthIn: 18,
    depthIn: 24,
    confirmedByTom: true,
    shoppingDescription: '18" utility base UCB1854, 54" H, with the 30" stacker W183024 on top, 84" total',
    diagramPath: "/pantry/1884.svg",
    components: [
      { code: "UCB1854", role: "base", heightIn: 54, description: '18" x 54" Utility Base Cabinet' },
      { code: "W183024", role: "top", heightIn: 30, description: '18" x 30" x 24" Wall Cabinet' },
    ],
  },
  {
    masterCode: "1890",
    heightIn: 90,
    widthIn: 18,
    depthIn: 24,
    confirmedByTom: false,
    shoppingDescription: '18" utility base UCB1854, 54" H, with the 36" stacker W183624 on top, 90" total',
    diagramPath: "/pantry/1890.svg",
    components: [
      { code: "UCB1854", role: "base", heightIn: 54, description: '18" x 54" Utility Base Cabinet' },
      { code: "W183624", role: "top", heightIn: 36, description: '18" x 36" x 24" Wall Cabinet' },
    ],
  },
  {
    masterCode: "1896",
    heightIn: 96,
    widthIn: 18,
    depthIn: 24,
    confirmedByTom: false,
    shoppingDescription: '18" utility base UCB1854, 54" H, with the 42" stacker W184224 on top, 96" total',
    diagramPath: "/pantry/1896.svg",
    components: [
      { code: "UCB1854", role: "base", heightIn: 54, description: '18" x 54" Utility Base Cabinet' },
      { code: "W184224", role: "top", heightIn: 42, description: '18" x 42" x 24" Wall Cabinet' },
    ],
  },
  {
    masterCode: "1876",
    heightIn: 76.5,
    widthIn: 18,
    depthIn: 24,
    confirmedByTom: false,
    shoppingDescription: '18" three-drawer base, 34.5" H, with the 42" stacker W184224 on top, 76.5" total, for confined spaces',
    diagramPath: "/pantry/1876.svg",
    components: [
      { code: "3DB18", role: "base", heightIn: 34.5, description: '18" 3 Drawer Base Cabinet', drawerCount: 3 },
      { code: "W184224", role: "top", heightIn: 42, description: '18" x 42" x 24" Wall Cabinet' },
    ],
  },
];

export function pantryMasterByCode(masterCode: string): PantryMasterCode | null {
  return PANTRY_MASTER_CODES.find((master) => master.masterCode === masterCode) ?? null;
}

export type ComponentPrice = {
  listPrice: number | null;
  yourCost: number | null;
};

export type PantryPriceRow = ComponentPrice & {
  componentCode: string;
  distributorId: number;
  styleId: number | null;
};

export type PantryDistributorPrice = {
  distributorId: number;
  styleId: number | null;
  listPrice: number | null;
  yourCost: number | null;
};

function moneySum(values: readonly (number | null)[]): number | null {
  if (values.some((value) => value == null || !Number.isFinite(value))) return null;
  const cents = values.reduce((sum, value) => sum + Math.round((value as number) * 100), 0);
  return cents / 100;
}

/**
 * One distributor and one door style. The bundle price is the sum of the
 * component prices. A missing component, a missing amount, or two different
 * amounts for the same component makes that amount NULL.
 */
export function pantryMasterPrice(
  master: PantryMasterCode,
  rows: readonly PantryPriceRow[],
  distributorId: number,
  styleId: number | null,
): PantryDistributorPrice {
  const matching = rows.filter((row) => row.distributorId === distributorId && row.styleId === styleId);
  const amount = (field: "listPrice" | "yourCost"): number | null => {
    const parts: Array<number | null> = [];
    for (const component of master.components) {
      const hits = matching.filter((row) => row.componentCode === component.code);
      if (hits.length !== 1) {
        parts.push(null);
        continue;
      }
      parts.push(hits[0][field]);
    }
    return moneySum(parts);
  };
  return {
    distributorId,
    styleId,
    listPrice: amount("listPrice"),
    yourCost: amount("yourCost"),
  };
}

/** Every distributor and door style that prices at least one component of this master. */
export function pantryMasterPricesByDistributor(
  master: PantryMasterCode,
  rows: readonly PantryPriceRow[],
): PantryDistributorPrice[] {
  const keys = new Map<string, { distributorId: number; styleId: number | null }>();
  const componentCodes = new Set(master.components.map((component) => component.code));
  for (const row of rows) {
    if (!componentCodes.has(row.componentCode)) continue;
    keys.set(`${row.distributorId}:${row.styleId ?? ""}`, {
      distributorId: row.distributorId,
      styleId: row.styleId,
    });
  }
  return [...keys.values()]
    .sort((a, b) => a.distributorId - b.distributorId || (a.styleId ?? 0) - (b.styleId ?? 0))
    .map((key) => pantryMasterPrice(master, rows, key.distributorId, key.styleId));
}

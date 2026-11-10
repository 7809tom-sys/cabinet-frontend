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
 */

export type PantryComponentRole = "base" | "top";

export type PantryMasterComponent = {
  code: string;
  role: PantryComponentRole;
};

export type PantryMasterCode = {
  masterCode: "1884" | "1890" | "1896";
  /** Overall stacked height, base height plus top height. */
  heightIn: 84 | 90 | 96;
  widthIn: 18;
  depthIn: 24;
  /** Tom named 1884. The other two follow the same sum and still need his yes. */
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
    components: [
      { code: "UCB1854", role: "base" },
      { code: "W183024", role: "top" },
    ],
  },
  {
    masterCode: "1890",
    heightIn: 90,
    widthIn: 18,
    depthIn: 24,
    confirmedByTom: false,
    components: [
      { code: "UCB1854", role: "base" },
      { code: "W183624", role: "top" },
    ],
  },
  {
    masterCode: "1896",
    heightIn: 96,
    widthIn: 18,
    depthIn: 24,
    confirmedByTom: false,
    components: [
      { code: "UCB1854", role: "base" },
      { code: "W184224", role: "top" },
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

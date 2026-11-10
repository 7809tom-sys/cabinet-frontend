import { pantryMasterByCode, type PantryMasterCode } from "./pantryMasterCodes";

export const PANTRY_PRICE_PENDING = "price pending";

export type PantryShoppingLine = {
  code: string;
  description: string;
  qty: number;
  /** List price for the chosen distributor and door style. NULL when that component has none. */
  price: number | null;
  priceLabel: string;
};

export type PantryShoppingList = {
  masterCode: PantryMasterCode["masterCode"];
  description: string;
  diagramPath: string;
  lines: readonly PantryShoppingLine[];
  /** Sum of the line prices. NULL when any line is pending. */
  total: number | null;
};

/**
 * Preload list for one pantry master. Pass each component's list price for
 * the distributor and door style the customer is shopping. A missing code or
 * a NULL price is "price pending", and the total stays NULL.
 */
export function pantryShoppingList(
  masterCode: string,
  pricesByCode: Readonly<Record<string, number | null | undefined>>,
): PantryShoppingList | null {
  const master = pantryMasterByCode(masterCode);
  if (!master) return null;
  const lines = master.components.map((part): PantryShoppingLine => {
    const price = pricesByCode[part.code];
    const pending = price == null || !Number.isFinite(price);
    return {
      code: part.code,
      description: part.description,
      qty: 1,
      price: pending ? null : price,
      priceLabel: pending ? PANTRY_PRICE_PENDING : money(price),
    };
  });
  const total = lines.some((line) => line.price == null)
    ? null
    : lines.reduce((sum, line) => sum + Math.round((line.price as number) * 100), 0) / 100;
  return {
    masterCode: master.masterCode,
    description: master.shoppingDescription,
    diagramPath: master.diagramPath,
    lines,
    total,
  };
}

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

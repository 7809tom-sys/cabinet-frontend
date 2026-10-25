export const INSTALLATION_ROOM_TYPES = ["Kitchen", "Bathroom", "Laundry", "Closets"] as const;
export type InstallationRoomType = (typeof INSTALLATION_ROOM_TYPES)[number];

export const INSTALLATION_COST_TYPES = ["labor", "material"] as const;
export type InstallationCostType = (typeof INSTALLATION_COST_TYPES)[number];

export type InstallationEstimateDraftLine = {
  description: string;
  quantity: number;
  unitCost: number;
  costType?: InstallationCostType;
};

export type InstallationEstimateLine = InstallationEstimateDraftLine & {
  costType: InstallationCostType;
  lineTotal: number;
};

export function calculateInstallationEstimate(
  lines: InstallationEstimateDraftLine[],
  taxAmount = 0,
  markupPercent = 0,
) {
  if (lines.some((line) => !Number.isInteger(line.quantity) || line.quantity <= 0)) {
    throw new Error("Quantity must be a positive whole number.");
  }
  const lineItems: InstallationEstimateLine[] = lines.map((line) => ({
    ...line,
    costType: line.costType ?? "labor",
    quantity: line.quantity,
    unitCost: Number(line.unitCost.toFixed(2)),
    lineTotal: Number((line.quantity * line.unitCost).toFixed(2)),
  }));
  const subtotal = Number(lineItems.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2));
  const tax = Number(taxAmount.toFixed(2));
  const markup = Number(Math.max(0, markupPercent).toFixed(2));
  const markupAmount = Number((subtotal * (markup / 100)).toFixed(2));
  return {
    lineItems,
    subtotal,
    markupPercent: markup,
    markupAmount,
    taxAmount: tax,
    totalAmount: Number((subtotal + markupAmount + tax).toFixed(2)),
  };
}

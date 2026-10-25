/** Returns the subtotal used by the live cart from its persisted line-item prices. */
export function calculateCartSubtotal(items: Array<{ unitPrice: number | null; qty: number }>): number {
  return items.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.qty, 0);
}

/**
 * This exception is intentionally limited to the temporary one-dollar product
 * created to exercise the real payment flow. It does not grant free freight to
 * ordinary catalog products or change any supplier freight rule.
 */
export const TEMPORARY_ONE_DOLLAR_TEST_SKU = "TEST-ONE-DOLLAR-1789756227567";

type TestItemIdentity = {
  masterCode?: string | null;
  rawCode?: string | null;
};

export function isTemporaryOneDollarCheckoutTestItem(item: TestItemIdentity): boolean {
  return [item.masterCode, item.rawCode].some(
    (value) => typeof value === "string" && value.trim().toUpperCase() === TEMPORARY_ONE_DOLLAR_TEST_SKU,
  );
}

export function isTemporaryOneDollarFreeShippingOrder(items: TestItemIdentity[]): boolean {
  return items.length > 0 && items.every(isTemporaryOneDollarCheckoutTestItem);
}

import { describe, expect, it } from "vitest";
import { sessionSellableStyleIds, unavailableSavedStyleIds } from "./unavailableSavedStyles";

describe("unavailable saved Designer styles", () => {
  it("flags a missing historic finish without silently swapping the plan to another active style", () => {
    expect(unavailableSavedStyleIds(30002, [30002, 390019, null], [390019, 330005])).toEqual([30002]);
  });

  it("detects an unavailable per-cabinet override even when the active plan style is sellable", () => {
    expect(unavailableSavedStyleIds(330005, [30002, 330005, undefined], [330005])).toEqual([30002]);
  });

  it("does not flag a fresh, unselected plan or styles that remain sellable", () => {
    expect(unavailableSavedStyleIds(null, [null], [330005])).toEqual([]);
    expect(unavailableSavedStyleIds(330005, [330005], [330005])).toEqual([]);
  });

  it("treats a Featured Styles door style as sellable once it is opened, even when the public list omits it", () => {
    const catalog = [330005, 540005];
    const opened = sessionSellableStyleIds(catalog, { styleId: 330001, usable: true });
    expect(opened).toEqual([330005, 540005, 330001]);
    expect(unavailableSavedStyleIds(330001, [330001], opened)).toEqual([]);
    expect(unavailableSavedStyleIds(330001, [330001], sessionSellableStyleIds(catalog, { styleId: 330001, usable: false }))).toEqual([330001]);
    expect(sessionSellableStyleIds(catalog, { styleId: 540005, usable: true })).toEqual(catalog);
  });
});

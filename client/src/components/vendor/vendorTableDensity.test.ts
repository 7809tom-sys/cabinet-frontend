import { describe, expect, it } from "vitest";
import {
  VENDOR_CATALOG_WIDTHS,
  VENDOR_PROFILE_WIDTHS,
  vendorCell,
  vendorCellMoney,
  vendorHead,
  vendorPageTitle,
  vendorStatCard,
  vendorTable,
  vendorTruncate,
  vendorTitle,
} from "./vendorTableDensity";

/**
 * The catalog has to fit 1280px without wrapping or a horizontal scrollbar, and
 * never double a row's height. These assertions pin the density tokens and the
 * column budget so a future "just add one more column" is caught here.
 */

/** Sum the pixel budgets declared in the width map; `w-` classes are 0.25rem each. */
function pxOf(widthClass: string): number {
  const rem = 16;
  const tw = /^w-(\d+(?:\.\d+)?)$/.exec(widthClass);
  if (tw) return Number(tw[1]) * 4 * (rem / 16);
  const arbitrary = /^w-\[(\d+)px\]$/.exec(widthClass);
  if (arbitrary) return Number(arbitrary[1]);
  throw new Error(`Unmeasurable width: ${widthClass}`);
}

describe("vendor table density", () => {
  it("uses 13px cells and 11px headers, one line", () => {
    expect(vendorCell).toContain("text-[13px]");
    expect(vendorCell).toContain("leading-tight");
    expect(vendorCell).toContain("whitespace-nowrap");
    expect(vendorHead).toContain("text-[11px]");
  });

  it("keeps cells at px-1.5 py-1 so rows do not grow", () => {
    expect(vendorCell).toContain("px-1.5");
    expect(vendorCell).toContain("py-1");
    expect(vendorCell).not.toContain("py-2");
    expect(vendorCell).not.toContain("py-3");
  });

  it("right-aligns and tabular-aligns money", () => {
    expect(vendorCellMoney).toContain("text-right");
    expect(vendorCellMoney).toContain("tabular-nums");
  });

  it("sets a tighter base type scale on the table itself", () => {
    expect(vendorTable).toContain("text-[13px]");
  });

  it("keeps the page heading on one line without a stacked subtitle", () => {
    expect(vendorPageTitle).toContain("text-lg");
    expect(vendorPageTitle).toContain("leading-tight");
  });

  it("lays stat cards out on one row", () => {
    expect(vendorStatCard).toContain("flex");
    expect(vendorStatCard).toContain("flex-1");
    expect(vendorStatCard).toContain("items-center");
    expect(vendorStatCard).toContain("justify-between");
  });
});

describe("column budget at 1280px", () => {
  it("fits the catalog inside a 1280px viewport without scrolling", () => {
    const total = Object.values(VENDOR_CATALOG_WIDTHS).reduce((sum, width) => sum + pxOf(width), 0);
    // 1280 viewport − ~48px of portal shell padding each side leaves ~1184px.
    expect(total).toBeLessThanOrEqual(1184);
  });

  it("fits the read-only profile catalog inside the card", () => {
    const total = Object.values(VENDOR_PROFILE_WIDTHS).reduce((sum, width) => sum + pxOf(width), 0);
    expect(total).toBeLessThanOrEqual(900);
  });

  it("spends the most width on description and little on counts", () => {
    const description = pxOf(VENDOR_CATALOG_WIDTHS.description);
    expect(description).toBeGreaterThan(pxOf(VENDOR_CATALOG_WIDTHS.onHand));
    expect(pxOf(VENDOR_CATALOG_WIDTHS.visible)).toBeLessThanOrEqual(56);
  });
});

describe("truncation and tooltips", () => {
  it("ellipsizes a long name", () => {
    const long = "Three Drawer Base Cabinet with Full Extension Soft Close Drawers";
    expect(vendorTruncate(long, 20)).toHaveLength(20);
    expect(vendorTruncate(long, 20).endsWith("…")).toBe(true);
  });

  it("keeps a short value intact and gives it no tooltip", () => {
    expect(vendorTruncate("B24", 20)).toBe("B24");
    expect(vendorTitle("B24", 20)).toBeUndefined();
  });

  it("exposes the full text as the tooltip only when it was cut", () => {
    const long = "Three Drawer Base Cabinet with Full Extension Soft Close Drawers";
    expect(vendorTitle(long, 20)).toBe(long);
  });

  it("renders an em dash for an empty value and no tooltip", () => {
    expect(vendorTruncate(null)).toBe("—");
    expect(vendorTruncate("   ")).toBe("—");
    expect(vendorTitle(null)).toBeUndefined();
  });
});

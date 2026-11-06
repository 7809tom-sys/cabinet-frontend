/**
 * Density tokens for the vendor portal tables and header cards.
 *
 * The vendor overview and catalog are dense operational screens: an
 * administrator scans a hundred SKUs at 1280–1440px. The stock `Table` primitives
 * use a 14px base, `px-2 py-2` cells and a fixed header height, which pushes the
 * numeric columns past the viewport so the browser either wraps rows or forces a
 * horizontal scroll.
 *
 * These tokens tighten that without inventing a second table component:
 *
 *   - 13px text, 11px headers, single-line rows (`leading-tight`)
 *   - `px-1.5 py-1` cells, no doubled row height from padding + line-height
 *   - fixed narrow widths for the money and count columns so they never grow
 *   - `truncate` + `title` on the free-text columns (SKU, description, style,
 *     category) so a long name ellipsizes instead of wrapping
 *
 * Horizontal scroll stays available on the wrapper as a last resort, not the
 * primary way to reach a column.
 */

/** Cells: tight padding, one line, no wrap. */
export const vendorCell = "px-1.5 py-1 text-[13px] leading-tight whitespace-nowrap align-middle";

/** Header cells: smaller type, same tight padding. */
export const vendorHead = "h-7 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap";

/** A free-text cell that ellipsizes rather than wrapping. */
export const vendorCellTruncate = "overflow-hidden text-ellipsis";

/** A numeric/money cell, right aligned and tabular so the column reads as a column. */
export const vendorCellMoney = `${vendorCell} text-right tabular-nums`;

/** Rows: no extra vertical growth. */
export const vendorRow = "h-8";

/** Tight table type scale. */
export const vendorTable = "w-full table-fixed text-[13px]";

/**
 * Column widths, in the order the catalog renders them. Sized to the widest
 * realistic content at 13px so the row fits 1280px without scrolling.
 *
 * Image 40 · SKU 96 · Description 200 · Vendor cost 76 · Style 110 · Category 80
 * · List 68 · Cost 72 · Wholesale 72 · Contractor 74 · On hand 56 · Visible 50
 * · Status 78 · Actions 56  →  ~1128px, inside the 1214px the portal leaves at
 * 1280px wide, so the table fits with no horizontal scroll. Description and
 * Style get the slack because they are the two free-text columns; every numeric
 * column is sized to its widest realistic value and never grows.
 */
export const VENDOR_CATALOG_WIDTHS = {
  image: "w-10",
  sku: "w-24",
  description: "w-[200px]",
  vendorCost: "w-[76px]",
  style: "w-[110px]",
  category: "w-20",
  list: "w-[68px]",
  cost: "w-[72px]",
  wholesale: "w-[72px]",
  contractor: "w-[74px]",
  onHand: "w-14",
  visible: "w-[50px]",
  status: "w-[78px]",
  actions: "w-14",
} as const;

/** The read-only catalog on the supplier profile page: five columns. */
export const VENDOR_PROFILE_WIDTHS = {
  sku: "w-24",
  description: "w-[320px]",
  style: "w-[120px]",
  category: "w-[120px]",
  status: "w-[96px]",
} as const;

/** Compact page heading: one line, no stack. */
export const vendorPageTitle = "text-lg font-semibold tracking-tight leading-tight";

/** One-row stat card: label and value side by side, never stacked. */
export const vendorStatCard =
  "flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md border px-2.5 py-1.5";
export const vendorStatLabel = "truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground";
export const vendorStatValue = "shrink-0 text-[13px] font-semibold tabular-nums";

/** Card chrome used behind dense tables: minimal padding, no double gaps. */
export const vendorDenseCardHeader = "flex flex-row flex-wrap items-center justify-between gap-2 px-3 py-2";
export const vendorDenseCardBody = "space-y-2 px-3 pb-2 pt-0";

/** The scroll wrapper: horizontal scroll only when the viewport truly cannot fit. */
export const vendorTableWrap = "overflow-x-auto rounded-md border";

/** Truncate a long label for a cell, keeping the tooltip source intact. */
export function vendorTruncate(value: string | null | undefined, max = 48): string {
  const text = (value ?? "").trim();
  if (!text) return "—";
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** The `title` for a truncated cell: the full text, or undefined when it is short. */
export function vendorTitle(value: string | null | undefined, max = 48): string | undefined {
  const text = (value ?? "").trim();
  if (!text) return undefined;
  return text.length <= max ? undefined : text;
}

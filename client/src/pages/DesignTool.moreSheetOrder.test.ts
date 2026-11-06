import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

/**
 * The More sheet is the menu the phone and tablet workspaces fold every
 * secondary Designer action into, and the trigger is labelled "More tools".
 * Start New Design leads that list, so it cannot drift back down the menu.
 */
function moreSheetSource(): string {
  const start = source.indexOf('{/* ── Main "More" sheet');
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf("</SheetContent>", start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

const START_NEW_TESTID = 'data-testid="more-sheet-start-new-design"';

/** The menu as a reader meets it: Start New Design, every section heading, and every labelled row. */
const MENU_ITEMS = [
  START_NEW_TESTID,
  "Appliance color",
  '{t("dt_sh_active_wall")}',
  '{t("dt_wall_height_label")}',
  ">Workspace<",
  "Materials &amp; Parts",
  "Surfaces — flooring, countertops, backsplash, sinks",
  '{showWallLayer ? "Hide wall cabinets" : "Show wall cabinets"}',
  ">Save design<",
  ">Room layout<",
  '{island ? "Edit island zone" : "Add island zone"}',
  "Drag 45° wall handle",
  "Show side panels",
  '{t("dt_sh_consultant_title")}',
  '{t("dt_sh_print_title")}',
  "Export Floor Plan PDF",
  ">Selected cabinet<",
  ">Interactive 3D Preview<",
  ">Peninsula Wizard<",
  '{t("dt_sh_autofill_active")}',
  '{t("dt_sh_builtin_fridge")}',
  '{t("dt_sh_lock_layout")}',
  '{t("dt_sh_measure")}',
  "Measure real room with phone",
  '{t("dt_ann_add")}',
  '{t("dt_sh_auto_dim")}',
  "Floor Plan dimension units",
  ">Export Floor Plan image<",
  "Export Floor Plan PDF",
  '{t("dt_sh_island_zone")}',
  ">Add Pony Wall<",
  '{t("dt_sh_add_filler")}',
  '{t("dt_sh_ceiling_filler")}',
  '{t("dt_sh_swing_door")}',
  '{t("dt_sh_save_plan")}',
  '{t("dt_sh_my_plans")}',
  ">Import Existing Design<",
  ">Save as Kitchen Package<",
  "Customer &amp; Affiliate Prices",
  "Finishes &amp; Trim",
  ">Flooring, Backsplash &amp; Surfaces<",
  ">Handles &amp; knobs<",
  '{t("dt_sh_trim_front")}',
  '{t("dt_sh_order_section")}',
  '{t("dt_sh_add_to_cart")}',
  ">Visualization<",
];

/** Where each item first appears after the previous one, or -1 when it is out of order. */
function menuOrder(sheet: string): number[] {
  let cursor = 0;
  return MENU_ITEMS.map((item) => {
    const at = sheet.indexOf(item, cursor);
    if (at >= 0) cursor = at + item.length;
    return at;
  });
}

describe("Designer More tools menu order", () => {
  it("lists Start New Design as the very first item", () => {
    const sheet = moreSheetSource();

    const startNewAt = sheet.indexOf(START_NEW_TESTID);
    expect(startNewAt).toBeGreaterThan(-1);

    // No heading and no other row appears above it.
    for (const earlier of ['<p className="px-3 pt-', "<button", "<a href="]) {
      const at = sheet.indexOf(earlier);
      if (at >= 0) expect(at).toBeGreaterThan(startNewAt);
    }

    // One action, one row: the old bottom Danger-zone copy moved, not copied.
    expect(sheet.split(START_NEW_TESTID)).toHaveLength(2);
    expect(sheet.match(/onClick=\{clearCurrentDesign\}/g)).toHaveLength(1);
    expect(sheet).not.toContain("Danger zone");

    // The row still runs the one authoritative reset transaction.
    const row = sheet.slice(startNewAt, sheet.indexOf("{/* Appliance package by color */}"));
    expect(row).toContain("onClick={clearCurrentDesign}");
    expect(row).toContain('{t("dt_sh_start_new")}');
  });

  it("leaves every other item in its existing order beneath it", () => {
    const positions = menuOrder(moreSheetSource());

    expect(positions.filter((at) => at < 0)).toEqual([]);
    // Start New Design first, then monotonically increasing positions.
    expect(positions[0]).toBeGreaterThan(-1);
    for (let index = 1; index < positions.length; index += 1) {
      expect(positions[index], `${MENU_ITEMS[index]} must follow ${MENU_ITEMS[index - 1]}`).toBeGreaterThan(
        positions[index - 1],
      );
    }
  });
});

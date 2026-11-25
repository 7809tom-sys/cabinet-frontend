// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { parseInventoryCsv } from "@shared/inventorySync";
import { INVENTORY_SYNC_CSV_EXAMPLE, INVENTORY_SYNC_JSON_EXAMPLE, InventorySyncHowItWorks } from "./InventorySyncHowItWorks";

afterEach(cleanup);

describe("InventorySyncHowItWorks", () => {
  it("renders the collapsible vendor instructions", () => {
    render(<InventorySyncHowItWorks />);
    const panel = screen.getByTestId("inventory-sync-how-it-works");
    expect(panel.tagName).toBe("DETAILS");
    expect(screen.getByText("How this works")).toBeTruthy();
    const text = panel.textContent ?? "";
    expect(text).toContain("password for your own inventory system");
    expect(text).toContain("/api/vendor-inventory/sync");
    expect(text).toContain("shown only once");
    expect(text).toContain("about 30 updates a minute");
    expect(text).toContain("does not turn off older keys");
    expect(text).not.toMatch(/Pelican|US Cabinet Depot|Hardware Resources|Line DL/i);
  });

  it("uses a placeholder key and the payload shape the sync route accepts", () => {
    expect(INVENTORY_SYNC_JSON_EXAMPLE).toContain("Bearer vif_YOUR_KEY_HERE");
    const body = JSON.parse(INVENTORY_SYNC_JSON_EXAMPLE.slice(INVENTORY_SYNC_JSON_EXAMPLE.indexOf("{")));
    expect(Array.isArray(body.rows)).toBe(true);
    expect(body.rows[0]).toMatchObject({ sku: "B36", quantityOnHand: 0, outOfStock: true, backorder: true, restockDate: "2026-12-15" });
    const csv = JSON.parse(INVENTORY_SYNC_CSV_EXAMPLE);
    expect(csv.csv.split("\n")[0]).toBe("sku,on hand,out of stock,backorder,discontinued,restock date");
    const parsed = parseInventoryCsv(csv.csv);
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({ sku: "B36", quantityOnHand: 0, outOfStock: true, backorder: true, discontinued: false, restockDate: "2026-12-15" });
  });
});

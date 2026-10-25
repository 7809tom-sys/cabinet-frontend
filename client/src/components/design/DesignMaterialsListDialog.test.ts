import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("complete Design materials and parts dialog", () => {
  it("provides a structured priced table with print and CSV export actions", () => {
    const dialogSource = readFileSync(new URL("./DesignMaterialsListDialog.tsx", import.meta.url), "utf8");
    const designToolSource = readFileSync(new URL("../../pages/DesignTool.tsx", import.meta.url), "utf8");

    expect(dialogSource).toContain("Complete Materials & Parts List");
	    expect(dialogSource).toContain("Numbered cabinets & cabinet parts");
	    expect(dialogSource).toContain("Numbered cabinets, panels, fillers, and cabinet trim first");
    expect(dialogSource).toContain("Other materials & parts — alphabetical");
    expect(dialogSource).toContain("> Print");
    expect(dialogSource).toContain("Export CSV");
    expect(dialogSource).toContain("Add priced items to cart");
    expect(dialogSource).toContain("onAddPricedItemsToCart");
    expect(dialogSource).toContain("pricedCartItemCount");
    expect(dialogSource).toContain("Quote-required and unavailable lines remain on this materials list and are not added to the cart.");
    expect(dialogSource).toContain("onClick={printList}");
    expect(dialogSource).toContain("onClick={downloadCsv}");
    expect(dialogSource).toContain("flex shrink-0 flex-wrap gap-2");
    expect(dialogSource).toContain("Unit price");
    expect(dialogSource).toContain("Line total");
    expect(dialogSource).toContain('"Unavailable"');
    expect(dialogSource).toContain('"Quote required"');
    expect(dialogSource).toContain("unavailable cabinet line");
    expect(dialogSource).toContain("Use the red trash button at the left of each placed item");
    expect(dialogSource).toContain("<Trash2 className=\"h-4 w-4\" />");
    expect(dialogSource).toContain("sticky left-0");
    expect(dialogSource).toContain("Remove ${row.description} from this design");
    expect(designToolSource).toContain('title={materialsConflictCount > 0 ? `${materialsConflictCount} placement conflict${materialsConflictCount === 1 ? "" : "s"} — open Materials & Parts to review` : "View, print, or export complete materials & parts list"}');
    expect(designToolSource).toContain("buildMaterialsListRows({");
    expect(designToolSource).toContain("<DesignMaterialsListDialog");
    expect(designToolSource).toContain("onAddPricedItemsToCart={() => void addAllToCart()}");
    expect(designToolSource).toContain("pricedCartItemCount={cartableLines.reduce((count, line) => count + line.qty, 0)}");
    expect(designToolSource).toContain('toast.success("Items successfully added to cart"');
    expect(designToolSource).toContain('design item${itemCount === 1 ? " is" : "s are"} ready to review in your cart.');
    expect(designToolSource).toContain("duration: 5000");
    expect(designToolSource.match(/showCartSuccessToast\(/g)).toHaveLength(1);
  });

  it("offers a reversible conflict-only view that retains only rows sourced by affected placement IDs", () => {
    const dialogSource = readFileSync(new URL("./DesignMaterialsListDialog.tsx", import.meta.url), "utf8");
    const designToolSource = readFileSync(new URL("../../pages/DesignTool.tsx", import.meta.url), "utf8");

    expect(dialogSource).toContain('conflictUids?: ReadonlySet<string>');
    expect(dialogSource).toContain('const rowHasConflict = (row: MaterialsListRow) => (row.sourceUids ?? []).some((uid) => conflictUids?.has(uid));');
    expect(dialogSource).toContain('const [showConflictsOnly, setShowConflictsOnly] = useState(false);');
    expect(dialogSource).toContain('const visibleRows = showConflictsOnly ? rows.filter(rowHasConflict) : rows;');
    expect(dialogSource).toContain('Conflicts only');
    expect(dialogSource).toContain('Show all items');
    expect(dialogSource).toContain('No affected items are currently in the Materials &amp; Parts list.');
    expect(designToolSource).toContain('conflictUids={conflictUids}');
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyDistributorRoundTripInlineEdit, DISTRIBUTOR_PREVIEW_PAGE_SIZE, filterDistributorRoundTripPreviewRows, paginateDistributorRoundTripPreviewRows, type DistributorRoundTripPreview } from "./DistributorRoundTripTransfer";
import { buildDistributorRoundTripCsv, parseDistributorRoundTripCsv } from "@shared/distributorRoundTrip";

const source = readFileSync(new URL("./DistributorRoundTripTransfer.tsx", import.meta.url), "utf8");

describe("DistributorRoundTripTransfer", () => {
  it("offers downloadable and uploadable CSV actions with a preview before import", () => {
    expect(source).toContain("Download connections CSV");
    expect(source).toContain("Upload connections CSV");
    expect(source).toContain("Preview changes");
    expect(source).toContain("Import aliases & eligible distributors");
  });

  it("explains that the connection workflow cannot update pricing or product visibility", () => {
    expect(source).toContain("never changes prices, door styles, sellable SKUs, availability, or publication status");
  });

  it("explains the explicit master-code replacement field and shows its preview count", () => {
    expect(source).toContain("ReplacementMasterCode");
    expect(source).toContain("master codes to replace");
  });

  it("filters the visible review table by uploaded code, resolved code, replacement, alias, or eligible distributor without changing full validation data", () => {
    const rows: DistributorRoundTripPreview["rows"] = [
      { rowNumber: 2, itemCode: "B-24", resolvedMasterCode: "B-24", replacementMasterCode: "B-24-NEW", replacesMasterCode: true, aliases: ["BASE24", "B24"], eligibleDistributorCodes: ["PRESTON"], aliasesToAdd: 0, distributorLinksToAdd: 0, errors: [] },
      { rowNumber: 3, itemCode: "W-30", resolvedMasterCode: "W-30", replacementMasterCode: null, replacesMasterCode: false, aliases: ["WALL30"], eligibleDistributorCodes: ["ASHFORD"], aliasesToAdd: 0, distributorLinksToAdd: 0, errors: ["Inactive distributor"] },
    ];
    expect(filterDistributorRoundTripPreviewRows(rows, "base24")).toEqual([rows[0]]);
    expect(filterDistributorRoundTripPreviewRows(rows, "ashford")).toEqual([rows[1]]);
    expect(filterDistributorRoundTripPreviewRows(rows, "B-24-new")).toEqual([rows[0]]);
    expect(filterDistributorRoundTripPreviewRows(rows, "not-found")).toEqual([]);
    expect(rows.some((row) => row.errors.length)).toBe(true);
  });

  it("renders an accessible search input, visible-versus-total count, table, and no-results message before the same import action", () => {
    expect(source).toContain('htmlFor="distributor-preview-search"');
    expect(source).toContain("Item code, master code, alias, or distributor");
    expect(source).toContain("visiblePreviewRows.length");
    expect(source).toContain('aria-label="Distributor connection upload preview"');
    expect(source).toContain("No uploaded rows match");
    expect(source).toContain("hasBlockingErrors");
  });

  it("paginates large result sets in bounded 50-row pages and clamps an invalid page number", () => {
    const rows = Array.from({ length: 121 }, (_, index) => `row-${index + 1}`);
    expect(DISTRIBUTOR_PREVIEW_PAGE_SIZE).toBe(50);
    expect(paginateDistributorRoundTripPreviewRows(rows, 2)).toEqual(expect.objectContaining({ page: 2, pageCount: 3, startIndex: 50, endIndex: 100, rows: rows.slice(50, 100) }));
    expect(paginateDistributorRoundTripPreviewRows(rows, 99)).toEqual(expect.objectContaining({ page: 3, startIndex: 100, endIndex: 121, rows: rows.slice(100, 121) }));
    expect(paginateDistributorRoundTripPreviewRows([], 3)).toEqual(expect.objectContaining({ page: 1, pageCount: 1, startIndex: 0, endIndex: 0, rows: [] }));
  });

  it("resets the page when search or source preview data changes and exposes keyboard-accessible pagination controls", () => {
    expect(source).toContain("setPreviewPage(1)");
    expect(source).toContain('aria-label="Preview table pagination"');
    expect(source).toContain('aria-label="Previous preview page"');
    expect(source).toContain('aria-label="Next preview page"');
    expect(source).toContain("Showing {pagedPreviewRows.startIndex + 1}–{pagedPreviewRows.endIndex}");
    expect(source).toContain("hasBlockingErrors");
  });

  it("rebuilds one edited row through the versioned CSV contract while preserving unedited rows and descriptive fields", () => {
    const originalCsv = buildDistributorRoundTripCsv([
      { templateVersion: "1", itemCode: "B-24", replacementMasterCode: null, aliases: ["BASE24"], eligibleDistributorCodes: ["PRESTON"], description: "Base 24", category: "Base", subCategory: "Base Cabinets", rowNumber: 2 },
      { templateVersion: "1", itemCode: "W-30", replacementMasterCode: null, aliases: ["WALL30"], eligibleDistributorCodes: ["ASHFORD"], description: "Wall 30", category: "Wall", subCategory: "Wall Cabinets", rowNumber: 3 },
    ]);
    const editedCsv = applyDistributorRoundTripInlineEdit(originalCsv, 2, { itemCode: " b-24a ", replacementMasterCode: " b-24-new ", aliases: "base24a; B24A", eligibleDistributorCodes: "preston; ashford" });
    const parsed = parseDistributorRoundTripCsv(editedCsv);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toEqual(expect.objectContaining({ itemCode: "B-24A", replacementMasterCode: "B-24-NEW", aliases: ["B24A", "BASE24A"], eligibleDistributorCodes: ["ASHFORD", "PRESTON"], description: "Base 24", category: "Base", subCategory: "Base Cabinets" }));
    expect(parsed.rows[1]).toEqual(expect.objectContaining({ itemCode: "W-30", aliases: ["WALL30"], eligibleDistributorCodes: ["ASHFORD"], description: "Wall 30" }));
  });

  it("rejects editing a row that is not in the uploaded CSV and requires full revalidation before import", () => {
    const csv = buildDistributorRoundTripCsv([{ templateVersion: "1", itemCode: "B-24", replacementMasterCode: null, aliases: [], eligibleDistributorCodes: [], description: "", category: "", subCategory: "", rowNumber: 2 }]);
    expect(() => applyDistributorRoundTripInlineEdit(csv, 99, { itemCode: "B-24", replacementMasterCode: "", aliases: "", eligibleDistributorCodes: "" })).toThrow("Could not find uploaded row 99");
    expect(source).toContain("revalidateEditedRow");
    expect(source).toContain("roundTripPreview");
    expect(source).toContain("hasUnreviewedEdits");
    expect(source).toContain("Save and revalidate the edited row");
  });

  it("renders named inline edit fields with explicit edit, save-and-revalidate, and cancel actions", () => {
    expect(source).toContain('aria-label={`Edit row ${row.rowNumber}`}');
    expect(source).toContain('aria-label={`Item code for row ${row.rowNumber}`}');
    expect(source).toContain('aria-label={`Aliases for row ${row.rowNumber}`}');
    expect(source).toContain('aria-label={`Eligible distributors for row ${row.rowNumber}`}');
    expect(source).toContain('aria-label={`Save and revalidate row ${row.rowNumber}`}');
    expect(source).toContain('aria-label={`Cancel editing row ${row.rowNumber}`}');
  });
});

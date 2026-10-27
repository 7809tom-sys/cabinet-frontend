import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  CONFLICT_REVIEW_MESSAGE,
  SUMMARY_EXPLANATIONS,
  adminListInput,
  badRequestMessage,
  completedConflictHref,
  conflictCabinetIdFromSearch,
  conflictEditorHref,
  conflictReviewSentence,
  draftFromRow,
  drawerFieldState,
  flaggedRowsOnly,
  ingestInputFromPrepared,
  isNineInchBase,
  parseOnboardingSheetGrid,
  prepareOnboardingUpload,
  submitDetailsInput,
  type OnboardingRow,
} from "./vendorOnboarding";

function row(overrides: Partial<OnboardingRow> = {}): OnboardingRow {
  return {
    id: 1,
    importId: 7,
    distributorId: 4,
    rowNumber: 2,
    sku: "B12",
    status: "flagged",
    flagReason: "missing_special",
    missingFields: ["price"],
    needsFullDetails: false,
    cabinetId: 90,
    masterCode: "B12",
    matchedVia: "master",
    candidateMasterCodes: [],
    reviewCabinetId: null,
    distributorName: "Line A",
    style: "Shaker",
    color: "White",
    price: null,
    styleId: null,
    skuId: null,
    category: null,
    subCategory: null,
    width: null,
    height: null,
    depth: null,
    description: null,
    numberOfDoors: null,
    numberOfDrawers: null,
    trimHeld: false,
    trimSupplierId: null,
    message: null,
    inherited: {
      cabinetId: 90,
      masterCode: "B12",
      description: "12 inch base",
      category: "Base",
      subCategory: null,
      width: "12.000",
      height: "34.500",
      depth: "24.000",
      numberOfDoors: 1,
      numberOfDrawers: 1,
    },
    ...overrides,
  };
}

describe("vendor onboarding sheet and submission rules", () => {
  it("explains the summary counts in plain language", () => {
    expect(SUMMARY_EXPLANATIONS.matched.explanation).toBe("Matched SKUs only needed distributor, style, color and price.");
    expect(SUMMARY_EXPLANATIONS.trimHeld.explanation).toBe("Trim stays with the supplier that already sells it.");
    expect(SUMMARY_EXPLANATIONS.styleUnmapped.explanation).toBe("The style text didn't match a door on their line, so no price was published.");
  });

  it("reads a headed sheet and a headerless sheet the same way the server does", () => {
    const headed = parseOnboardingSheetGrid([
      ["SKU", "Door Style", "Color", "List Price"],
      ["B-12", "Shaker", "White", "189.00"],
    ]);
    expect(headed.notes).toEqual([]);
    expect(headed.rows[0]).toMatchObject({ rowNumber: 2, sku: "B-12", style: "Shaker", color: "White", price: "189.00" });

    const headerless = parseOnboardingSheetGrid([["W3030", "Depot", "Oxford", "Grey", "210"]]);
    expect(headerless.notes[0]).toMatch(/No header row found/);
    expect(headerless.rows[0]).toMatchObject({
      rowNumber: 1,
      sku: "W3030",
      distributorName: "Depot",
      style: "Oxford",
      color: "Grey",
      price: "210",
    });
  });

  it("sends csv text through and xlsx as rows", async () => {
    const csv = new File(["SKU,Style,Color,Price\nB12,Shaker,White,10\n"], "prices.csv", { type: "text/csv" });
    const textUpload = await prepareOnboardingUpload(csv);
    expect(textUpload.ok).toBe(true);
    if (!textUpload.ok) return;
    expect(textUpload.text).toContain("B12");
    expect(textUpload.rows).toBeUndefined();
    expect(ingestInputFromPrepared(textUpload).text).toContain("B12");

    const book = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["SKU", "Style", "Color", "Price"],
      ["B-12", "Shaker", "White", "189.00"],
    ]);
    XLSX.utils.book_append_sheet(book, sheet, "Prices");
    const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const xlsx = new File([new Uint8Array(bytes)], "prices.xlsx");
    const sheetUpload = await prepareOnboardingUpload(xlsx);
    expect(sheetUpload.ok).toBe(true);
    if (!sheetUpload.ok) return;
    expect(sheetUpload.rows?.[0]).toMatchObject({ sku: "B-12", style: "Shaker", price: "189.00" });
    expect(sheetUpload.text).toBeUndefined();
    expect(ingestInputFromPrepared(sheetUpload, 4)).toMatchObject({
      distributorId: 4,
      fileName: "prices.xlsx",
      rows: [expect.objectContaining({ sku: "B-12" })],
    });
  });

  it("forces a 9-inch base to zero drawers", () => {
    expect(isNineInchBase({ masterCode: "BT9" })).toBe(true);
    expect(isNineInchBase({ width: "9", category: "Base" })).toBe(true);
    expect(isNineInchBase({ width: 9, category: "Wall" })).toBe(false);
    expect(drawerFieldState({ width: "9", category: "Base", numberOfDrawers: "2" })).toEqual({ value: "0", locked: true });

    const nine = row({
      sku: "BT9",
      masterCode: null,
      needsFullDetails: true,
      flagReason: "unknown_sku",
      missingFields: [],
      numberOfDrawers: 2,
      inherited: null,
    });
    const draft = draftFromRow(nine);
    draft.numberOfDrawers = "2";
    draft.category = "Base";
    draft.width = "9";
    const submitted = submitDetailsInput(nine, draft, 4);
    expect("input" in submitted && submitted.input.numberOfDrawers).toBe(0);
  });

  it("submits only the missing vendor fields for a matched row", () => {
    const draft = draftFromRow(row());
    draft.price = "12.50";
    expect(submitDetailsInput(row(), draft, 4)).toEqual({
      input: { rowId: 1, distributorId: 4, price: 12.5 },
    });
    draft.price = "abc";
    expect(submitDetailsInput(row(), draft)).toEqual({ error: "Price is not a valid amount." });
  });

  it("keeps the flagged list and the conflict link on the right ids", () => {
    const flagged = row();
    const matched = row({ id: 2, sku: "DONE", status: "matched", cabinetId: 9, reviewCabinetId: null });
    const completed = row({ id: 3, sku: "NEW", status: "completed", cabinetId: null, reviewCabinetId: 44 });
    expect(flaggedRowsOnly([flagged, matched, completed]).map((item) => item.sku)).toEqual(["B12"]);
    expect(completedConflictHref(completed)).toBe("/admin?tab=conflicts&cabinetId=44");
    expect(completedConflictHref(matched)).toBeNull();
    expect(conflictEditorHref(44)).not.toContain("9");
    expect(conflictCabinetIdFromSearch("?tab=conflicts&cabinetId=44")).toBe(44);
    expect(conflictReviewSentence("NEW")).toContain(CONFLICT_REVIEW_MESSAGE);
    expect(badRequestMessage({ message: "9-inch base cabinets are tray or full-height and never have drawers.", data: { code: "BAD_REQUEST" } }))
      .toMatch(/never have drawers/);
    expect(badRequestMessage({ message: "Missing", data: { code: "NOT_FOUND" } })).toBeNull();
    expect(adminListInput({})).toEqual({ limit: 200 });
    expect(adminListInput({ distributorId: 4, importId: 7, status: "completed" })).toEqual({
      limit: 200,
      distributorId: 4,
      importId: 7,
      status: "completed",
    });
  });
});

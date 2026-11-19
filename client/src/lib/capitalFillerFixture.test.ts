/**
 * USCD Capital (style 330014 in the matrix fixture) fillers, fixed with Tom's go (voice, Nov 19 2026, 8:42 AM CT).
 *
 * Source: USCD Capital spec book V8 p55 (Framed Panels, Fillers & Mouldings) and the Jan 2026 Capital price list, SW column:
 *   https://www.uscabinetdepot.com/media/wysiwyg/PDF/sales_materials/Capital_Single_Pages_V8_DIGITAL_ONLY_1.pdf
 *   https://www.uscabinetdepot.com/media/wysiwyg/PDF/sales_materials/Capital_Collection_PA_V1.2026_3.pdf
 *   local text: /workspace/cb/research/capital_spec_book_text.txt
 *   F342 3 x 42 x 3/4 $46 · F642 6 x 42 x 3/4 $90 · F396 3 x 96 x 3/4 $142 · F696 6 x 96 x 3/4 $227 (USCD list, SW)
 *   FOL630 / FOL636 / FOL642: Filler Overlay 5-1/2 W x 29 / 35 / 41 H x 3/4, "6" filler required for application
 *   (purchased separately)", $55 / $66 / $78. Fixture rows carry no price field; prices are noted here and in PR 463.
 */
import { describe, expect, it } from "vitest";
import matrix from "./__fixtures__/autoDesignMatrixCatalog.json";
import { catalogFillerForGap, isCatalogFiller, isFillerOverlay, isFlutedFiller } from "./catalogFiller";

const accessory = (matrix as any)["330014"].accessory as Array<Record<string, any>>;
const row = (code: string) => accessory.find((r) => r.masterCode === code)!;

describe("330014 Capital fillers and filler overlays", () => {
  it("sells the plain F342 / F642 / F396 / F696 fillers", () => {
    expect([row("F342"), row("F642"), row("F396"), row("F696")].map((r) => `${r.masterCode} ${Number(r.width)}x${Number(r.height)}`))
      .toEqual(["F342 3x42", "F642 6x42", "F396 3x96", "F696 6x96"]);
    for (const code of ["F342", "F642", "F396", "F696"]) expect(isCatalogFiller(row(code) as never)).toBe(true);
  });

  it("FOL630/636/642 are 5-1/2 in filler overlays that require a 6 in filler", () => {
    expect(["FOL630", "FOL636", "FOL642"].map((code) => [Number(row(code).width), Number(row(code).height), Number(row(code).depth)]))
      .toEqual([[5.5, 29, 0.75], [5.5, 35, 0.75], [5.5, 41, 0.75]]);
    for (const code of ["FOL630", "FOL636", "FOL642"]) {
      expect(row(code).description).toMatch(/^Filler Overlay — requires 6" filler/);
      expect(isFillerOverlay(row(code))).toBe(true);
    }
  });

  it("the engine never uses an overlay as a standalone filler", () => {
    for (const code of ["FOL630", "FOL636", "FOL642"]) {
      expect(isCatalogFiller(row(code) as never)).toBe(false);
      expect(isFlutedFiller(row(code))).toBe(true); // excluded by every automatic filler pick
    }
    // Even when an overlay is the only 5-1/2 in candidate, the gap gets the real F642.
    expect(catalogFillerForGap(accessory as never, 5.5, "base")?.masterCode).toBe("F642");
    expect(catalogFillerForGap(accessory as never, 2, "base")?.masterCode).toBe("F342");
    expect(catalogFillerForGap(accessory.filter((r) => /^FOL/.test(r.masterCode)) as never, 5, "base")).toBeNull();
  });

  it("AltaEuro's OF 3-inch filler overlay keeps its documented filler-stock job", () => {
    expect(isFillerOverlay({ masterCode: "OF3", description: '3" Filler Overlay' })).toBe(false);
  });
});

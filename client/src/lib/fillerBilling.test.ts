import { describe, expect, it } from "vitest";
import { buildDesignCabinetCartLines, buildDesignPreviewPricingLines } from "./designCartLines";
import { buildMaterialsListRows } from "./designMaterialsList";
import { FILLER_CUT_GROUP_MAX_IN, combinedFillerNote, isCombinedSmallFiller } from "./fillerBilling";
import { buildTrimCartLines, TRIM_CRAFTSMANSHIP_STICK_NOTE } from "./trimCart";
import { trimPiecesNeeded, type PlacedCabinet } from "./design";

function filler(partial: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "width">): PlacedCabinet {
  return {
    cabinetId: 342,
    masterCode: "BF3",
    description: '3" Base Filler',
    category: "Filler",
    subCategory: "Filler",
    placement: "base",
    x: 0,
    y: 0,
    depth: 24,
    height: 34.5,
    rotation: 0,
    nominalWidth: 3,
    fillerBillingRole: "primary",
    fillerTotalWidth: partial.width,
    styleId: 11,
    ...partial,
  } as PlacedCabinet;
}

const priceArgs = (placed: PlacedCabinet[]) => ({
  placed,
  styleId: 11,
  distributorId: 4,
  tier: "homeowner" as const,
  styleNameById: new Map([[11, "White Shaker"]]),
  unitPriceFor: () => 30,
});

describe("filler cutting optimization", () => {
  it("orders one stock filler when the pieces add up to 2.5 inches", () => {
    expect(FILLER_CUT_GROUP_MAX_IN).toBe(2.5);
    const placed = [
      filler({ uid: "one", width: 1, x: 0 }),
      filler({ uid: "one-half", width: 1.5, x: 1 }),
    ];
    const lines = buildDesignCabinetCartLines(priceArgs(placed));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ masterCode: "BF3", qty: 1, unitPrice: 30 });
    expect(lines[0]?.qtyNote).toBe('1" and 1.5" pieces cut from one 3" filler');
    expect(isCombinedSmallFiller(placed[0]!, placed)).toBe(true);
    expect(combinedFillerNote(placed[0]!, placed)).toContain('1" and 1.5"');
    const preview = buildDesignPreviewPricingLines(priceArgs(placed));
    expect(preview).toHaveLength(1);
    expect(preview[0]?.qtyNote).toBe(lines[0]?.qtyNote);
    const rows = buildMaterialsListRows({
      buildRows: [],
      pricingLines: lines,
      defaultStyleName: "White Shaker",
    });
    expect(rows[0]).toMatchObject({ code: "BF3", qty: 1, lineTotal: 30 });
    expect(rows[0]?.notes).toContain('1" and 1.5" pieces cut from one 3" filler');
  });

  it("keeps separate fillers when the pieces add up to 2.75 inches", () => {
    const placed = [
      filler({ uid: "wide", width: 1.5, x: 0 }),
      filler({ uid: "wider", width: 1.25, x: 2 }),
    ];
    const lines = buildDesignCabinetCartLines(priceArgs(placed));
    expect(lines).toHaveLength(2);
    expect(lines.reduce((sum, line) => sum + line.qty, 0)).toBe(2);
    expect(lines.every((line) => !line.qtyNote)).toBe(true);
  });

  it("does not mix door styles or filler types onto one stock board", () => {
    const placed = [
      filler({ uid: "base-a", width: 1, styleId: 11 }),
      filler({ uid: "base-b", width: 1, styleId: 22, x: 2 }),
      filler({ uid: "wall", width: 1, placement: "wall", masterCode: "WF3", description: '3" Wall Filler', x: 4 }),
    ];
    const lines = buildDesignCabinetCartLines({
      ...priceArgs(placed),
      styleNameById: new Map([[11, "White"], [22, "Oak"]]),
    });
    expect(lines).toHaveLength(3);
  });

  it("still cuts a sub-inch piece from a larger filler when the group is above 2.5 inches", () => {
    const placed = [
      filler({ uid: "stock", width: 3, fillerTotalWidth: 3 }),
      filler({ uid: "sliver", width: 0.5, fillerTotalWidth: 0.5, x: 4 }),
    ];
    const lines = buildDesignCabinetCartLines(priceArgs(placed));
    expect(lines).toHaveLength(1);
    expect(lines[0]?.qtyNote).toContain('Includes 0.5" field-cut from BF3 already on order');
  });
});

describe("extra molding stick", () => {
  it("adds one priced stick beyond the measured count and keeps the note", () => {
    const order = trimPiecesNeeded(63);
    expect(order).toMatchObject({ measuredPieces: 1, extraStick: 1, pieces: 2 });
    const lines = buildTrimCartLines(
      [{ kind: "toeKick", pieces: order.pieces, craftsmanshipStick: true }],
      11,
      "White Shaker",
      new Map([["TK-8", { cabinetId: 8, masterCode: "TK-8", description: "Toe kick 8 ft", unitPrice: 12 }]]),
    );
    expect(lines[0]).toMatchObject({ masterCode: "TK-8", qty: 2, unitPrice: 12, qtyNote: TRIM_CRAFTSMANSHIP_STICK_NOTE });
    const rows = buildMaterialsListRows({
      buildRows: [],
      pricingLines: [{
        masterCode: lines[0]!.masterCode,
        name: lines[0]!.name,
        styleId: 11,
        styleLabel: "White Shaker",
        distributorId: 4,
        tier: "homeowner",
        unitPrice: 12,
        qty: lines[0]!.qty,
        qtyNote: lines[0]!.qtyNote,
        category: "Trim & Moulding",
      }],
    });
    expect(rows[0]).toMatchObject({ qty: 2, unitPrice: 12, lineTotal: 24 });
    expect(rows[0]?.notes).toContain(TRIM_CRAFTSMANSHIP_STICK_NOTE);
  });
});

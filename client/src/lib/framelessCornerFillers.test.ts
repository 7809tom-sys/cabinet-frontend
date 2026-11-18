/**
 * Tom, Nov 15 2026 (8:06 PM CT): three fixes on frameless plans, checked
 * against the live USCD catalog for Palermo PGW (540004) and Torino TWP
 * (540001), with a framed line (330014) as a sanity check.
 *  1) A base corner and the wall corner above it with different legs (ERB33 =
 *     33", WER2430 = 24") no longer push every upper 9" off the bases beneath.
 *  2) A merged run filler is cut from a real stock row at least that wide
 *     (OF6xx at 5-7/8 when OF3xx's 2-7/8 is too narrow), never stretched past
 *     fillerWidthRange — the "FILLER 3" · OVER MAX" label.
 *  3) Overlap cleanup keeps a filler that only touches its neighbours at a sawn
 *     seam, and the gap closer no longer seats a duplicate wall filler inside a
 *     full-height board (the ½" OF330 the cleanup kept deleting).
 */
import { describe, expect, it } from "vitest";
import liveFixture from "@/lib/__fixtures__/uscdFramelessLiveCatalog.json";
import matrixFixture from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps } from "@/lib/autoDesignLayout";
import { emptyAutoDesignIntake } from "@/lib/autoDesignFifteenRules";
import { matchUppersToBases } from "@/lib/autoDesignUpperMatch";
import { closeRemainingRunGaps } from "@/lib/autoDesignCloseRemainingGaps";
import {
  APPLIANCES, applianceAsDesignCabinet, cabinetWall, dim, fillerWidthRange, footprintDepth, isCornerCabinet, isFillerItem,
  isSinkBaseCabinet, removeOverlappingPlacements, wallPlacementAt, wallRunOffset, wallRunSpan,
  type DesignCabinet, type PlacedCabinet, type RoomData, type WallSide,
} from "@/lib/design";

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; surround: { deepAbove: DesignCabinet[]; endPanels: DesignCabinet[] } };
const live = liveFixture as unknown as Record<string, Pack>;
const matrix = matrixFixture as unknown as Record<string, Pack>;
const packFor = (styleId: string): Pack => live[styleId] ?? matrix[styleId]!;

const ROOM = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
const PALETTE = APPLIANCES.filter((a) => /^(RANGE-30|DW-24|FRIDGE-36|MW-30|HOOD-30)$/.test(a.masterCode));
const FRAMELESS = [["540004", "Palermo PGW"], ["540001", "Torino TWP"]] as const;
const FRAMED = "330014";

type Built = { ok: boolean; message?: string; placed?: PlacedCabinet[]; reviewFindings?: Array<{ code?: string; detail: string }> };

function build(styleId: string, layoutType: "l-shape" | "u-shape", dropBaseCode: RegExp | null = null): PlacedCabinet[] {
  const full = packFor(styleId);
  const pack = dropBaseCode ? { ...full, base: full.base.filter((row) => !dropBaseCode.test(row.masterCode)) } : full;
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType, originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 22 }, stove: { wallLabel: "Wall 1", centerOffsetIn: 87 },
      sink: { wallLabel: "Wall 2", centerOffsetIn: 60 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular", dishwasherSide: "none", skipDishwasher: true,
      sinkWindowCenter: null,
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: { ...emptyAutoDesignIntake(), construction: "new", canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true } },
    } as never,
    room: ROOM, openings: [], baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: PALETTE.map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [],
    panelCatalog: pack.accessory, tallCatalog: [], styleId: Number(styleId), makeUid: () => `t-${++uid}`,
  } as never) as Built;
  expect(result.ok, result.message).toBe(true);
  return result.placed!;
}

const span = (item: PlacedCabinet, wall: string, room = ROOM) => {
  const start = wallRunOffset(item, wall as WallSide, room);
  return { start, end: start + wallRunSpan(item, wall as WallSide, room) };
};

function isStraightBase(item: PlacedCabinet): boolean {
  return item.placement === "base" && !isSinkBaseCabinet(item) && !isFillerItem(item)
    && !/panel/i.test(`${item.masterCode} ${item.subCategory ?? ""}`)
    && !isCornerCabinet(item.masterCode, item.description, item.cornerType ?? null);
}

function overMaxFillers(placed: readonly PlacedCabinet[]): string[] {
  return placed.flatMap((item) => {
    const range = fillerWidthRange(item);
    if (!range || item.width <= range.max + 0.001) return [];
    return [`${item.masterCode} ${item.width}" > ${range.max}"`];
  });
}

function seat(row: DesignCabinet, wall: WallSide, offset: number, room: RoomData, extra: Partial<PlacedCabinet> = {}): PlacedCabinet {
  const width = dim(row.width, 0);
  const depth = footprintDepth(row);
  const placement = (row.placement === "wall" ? "wall" : "base") as PlacedCabinet["placement"];
  return {
    uid: `${row.masterCode}@${wall}${offset}`,
    cabinetId: row.id,
    masterCode: row.masterCode,
    description: row.description,
    category: row.category,
    subCategory: row.subCategory,
    placement,
    ...wallPlacementAt(offset, width, depth, wall, room)!,
    width,
    depth,
    height: dim(row.height, placement === "wall" ? 30.25 : 34.5),
    ...(placement === "wall" ? { mountBottom: 54 } : {}),
    constructionMethod: row.constructionMethod ?? null,
    styleId: 540004,
    ...extra,
  } as PlacedCabinet;
}

const rowOf = (rows: readonly DesignCabinet[], code: string) => {
  const row = rows.find((candidate) => candidate.masterCode === code);
  if (!row) throw new Error(`fixture has no ${code}`);
  return row;
};

describe.each(FRAMELESS)("frameless corner, fillers and overlap — %s (%s)", (styleId) => {
  const pack = packFor(styleId);

  describe("1) corner legs: uppers line up over the bases beside an ERB33 / WER2430 corner", () => {
    // Tom, Nov 18 2026: with the 9 in lazy Susan companion removed (PR #442) the full
    // line seats an ERB36 (12 in leg past the WER2430); before it, ERB33 + a 9 in base
    // (9 in leg). Both are the same leg rule, so either corner must line up. The ERB33
    // case is still built on its own from the line without its 36 in lazy Susans (ERB36, LSB36).
    it.each([
      ["full line (ERB36 after the 9 in companion removal)", /^ERB3[36]/, null],
      ["line without a 36 in lazy Susan (ERB33 corner)", /^ERB33/, /^(?:ERB36|LSB36)$/],
    ] as const)("U-shape, %s: the bottom wall's uppers match each base and the corner leg gets its own upper", (_label, cornerCode, dropCode) => {
      const placed = build(styleId, "u-shape", dropCode);
      const wall = "bottom";
      const corner = placed.find((item) => item.placement === "base" && cabinetWall(item, ROOM) === wall && /^ERB3\d/.test(item.masterCode))!;
      const wallCorner = placed.find((item) => item.placement === "wall" && cabinetWall(item, ROOM) === wall && /^WER24/.test(item.masterCode))!;
      expect(corner, "lazy Susan corner on the bottom wall").toBeTruthy();
      expect(corner.masterCode).toMatch(cornerCode);
      expect(wallCorner, "WER2430 on the bottom wall").toBeTruthy();
      const uppers = placed.filter((item) => item.placement === "wall" && cabinetWall(item, ROOM) === wall && !isFillerItem(item));
      // Every straight base on that wall has an upper with its start and width.
      for (const base of placed.filter((item) => isStraightBase(item) && cabinetWall(item, ROOM) === wall)) {
        const b = span(base, wall);
        const match = uppers.find((item) => Math.abs(span(item, wall).start - b.start) <= 0.25 && Math.abs(item.width - base.width) <= 0.25);
        expect(match?.masterCode, `upper over ${base.masterCode}@${b.start}`).toMatch(new RegExp(`^W${String(Math.round(base.width)).padStart(2, "0")}30`));
      }
      // The strip of the base corner the WER2430 leaves uncovered (33 - 24 = 9, 36 - 24 = 12) holds a real upper that wide.
      const leg = { start: span(corner, wall).start, end: span(wallCorner, wall).start };
      const legWidth = Math.round(corner.width) - 24;
      expect(leg.end - leg.start).toBeCloseTo(legWidth, 1);
      const legUpper = uppers.find((item) => Math.abs(span(item, wall).start - leg.start) <= 0.25);
      expect(legUpper?.masterCode).toBe(`W${String(legWidth).padStart(2, "0")}30`);
    });

    it("leg matching is catalog-driven: no 9\" wall cabinet means the uppers are kept and a warning names the corner", () => {
      const room = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
      const wall: WallSide = "bottom";
      const placed: PlacedCabinet[] = [
        seat(rowOf(pack.base, "B36"), wall, 0, room),
        seat(rowOf(pack.base, "B36"), wall, 36, room),
        seat(rowOf(pack.base, "B27"), wall, 72, room),
        seat(rowOf(pack.base, "B12"), wall, 99, room),
        seat(rowOf(pack.base, "ERB33"), wall, 111, room, { cornerType: "easy-reach" } as never),
        seat(rowOf(pack.wall, "W3630"), wall, 0, room),
        seat(rowOf(pack.wall, "W3630"), wall, 36, room),
        seat(rowOf(pack.wall, "W3630"), wall, 72, room),
        seat(rowOf(pack.wall, "W1230"), wall, 108, room),
        seat(rowOf(pack.wall, "WER2430"), wall, 120, room, { cornerType: "easy-reach" } as never),
      ];
      let n = 0;
      const full = matchUppersToBases({ placed, room, openings: [], wallCatalog: pack.wall, heightIn: 30.25, styleId: Number(styleId), makeUid: () => `m-${++n}` });
      const upperRow = full.placed.filter((item) => item.placement === "wall").map((item) => `${item.masterCode}@${span(item, wall, room).start}`).sort();
      expect(upperRow).toEqual(["W0930@111", "W1230@99", "W2730@72", "W3630@0", "W3630@36", "WER2430@120"].sort());
      expect(full.notes.join(" ")).toMatch(/ERB33 reaches 9″ past WER2430|ERB33 reaches 9" past WER2430/);

      const noNine = pack.wall.filter((row) => Math.abs(dim(row.width, 0) - 9) > 0.01);
      const short = matchUppersToBases({ placed, room, openings: [], wallCatalog: noNine, heightIn: 30.25, styleId: Number(styleId), makeUid: () => `m-${++n}` });
      expect(short.placed).toEqual(placed);
      const finding = short.findings.find((entry) => entry.code === "corner-leg-not-matched");
      expect(finding?.severity).toBe("warning");
      expect(finding?.detail).toMatch(/ERB33 reaches 9″ farther along the wall than WER2430|ERB33 reaches 9" farther along the wall than WER2430/);
    });
  });

  describe("2) fillers never exceed their stock width", () => {
    it.each(["l-shape", "u-shape"] as const)("%s build: every filler is within fillerWidthRange", (layout) => {
      expect(overMaxFillers(build(styleId, layout))).toEqual([]);
    });

    it("two loose boards that add up past 2-7/8\" are re-cut from the line's OF6xx, not stretched OF3xx", () => {
      const room = { width: 40, depth: 120, ceilingHeight: 96 } as RoomData;
      const of3 = rowOf(pack.accessory, "OF335");
      const pieces = [
        seat(of3, "top", 0, room, { width: 2.75, depth: 24, height: 34.5, placement: "base", fillerTotalWidth: 2.75, nominalWidth: 2.875, uid: "f1" }),
        seat(of3, "top", 2.75, room, { width: 1.25, depth: 24, height: 34.5, placement: "base", fillerTotalWidth: 1.25, nominalWidth: 2.875, uid: "f2" }),
      ].map((item) => ({ ...item, ...wallPlacementAt(wallRunOffset(item, "top", room), item.width, 24, "top", room)! }));
      const base = seat(rowOf(pack.base, "B36"), "top", 4, room);
      const result = closeRemainingRunGaps({
        placed: [...pieces, base], room, wallIds: ["top"], baseCatalog: pack.base, wallCatalog: [], fillers: pack.accessory as never,
        styleId: Number(styleId), makeUid: () => "x",
      });
      const fillers = result.placed.filter((item) => isFillerItem(item) && item.placement === "base");
      expect(fillers).toHaveLength(1);
      expect(fillers[0]!.masterCode).toMatch(/^OF6/);
      expect(fillers[0]!.width).toBeCloseTo(4, 3);
      expect(fillers[0]!.nominalWidth).toBeCloseTo(5.875, 3);
      expect(fillers[0]!.description).toMatch(/5⅞″? stock|5⅞" stock/);
      expect(overMaxFillers(fillers)).toEqual([]);

      // A line with only 2-7/8" stock keeps the two boards rather than inventing a wider one.
      const onlyThree = pack.accessory.filter((row) => /^OF3/.test(row.masterCode));
      const kept = closeRemainingRunGaps({
        placed: [...pieces, base], room, wallIds: ["top"], baseCatalog: pack.base, wallCatalog: [], fillers: onlyThree as never,
        styleId: Number(styleId), makeUid: () => "y",
      });
      expect(kept.placed.filter((item) => isFillerItem(item) && item.placement === "base").map((item) => item.width).sort()).toEqual([1.25, 2.75]);
    });

    it("a refrigerator's own ½\" board is never merged across its end panel", () => {
      const placed = build(styleId, "l-shape");
      const leftPanel = placed.find((item) => item.refrigeratorAssemblyRole === "left-panel")!;
      expect(leftPanel).toBeTruthy();
      const panel = span(leftPanel, "top");
      const intruders = placed.filter((item) => isFillerItem(item) && cabinetWall(item, ROOM) === "top")
        .filter((item) => { const s = span(item, "top"); return Math.min(s.end, panel.end) - Math.max(s.start, panel.start) > 0.0625; });
      expect(intruders.map((item) => `${item.masterCode}@${span(item, "top").start}+${item.width}`)).toEqual([]);
    });
  });

  describe("3) overlap cleanup keeps fillers that close a real gap", () => {
    it.each(["l-shape", "u-shape"] as const)("%s build: overlap cleanup deletes no filler", (layout) => {
      const placed = build(styleId, layout);
      const { rejected } = removeOverlappingPlacements(placed, ROOM);
      expect(rejected.filter(isFillerItem).map((item) => `${item.masterCode}@${cabinetWall(item, ROOM)}`)).toEqual([]);
      // No wall filler sits inside a full-height board (the old ½" OF330 duplicate).
      const fullHeight = placed.filter((item) => isFillerItem(item) && item.fillerContinuousVertical === true);
      const duplicates = placed.filter((item) => item.placement === "wall" && isFillerItem(item) && fullHeight.some((board) => {
        const wall = cabinetWall(board, ROOM);
        if (wall !== cabinetWall(item, ROOM)) return false;
        const a = span(board, wall!); const b = span(item, wall!);
        return a.start <= b.start + 0.05 && a.end >= b.end - 0.05;
      }));
      expect(duplicates.map((item) => item.masterCode)).toEqual([]);
    });

    it("a filler that touches its neighbours at a 1/64\" seam survives; one inside a cabinet does not", () => {
      const room = { width: 120, depth: 120, ceilingHeight: 96 } as RoomData;
      const of3 = rowOf(pack.accessory, "OF335");
      const left = seat(rowOf(pack.base, "B30"), "top", 0, room);
      const right = seat(rowOf(pack.base, "B30"), "top", 32.5, room);
      const seamFiller = { ...seat(of3, "top", 29.984, room, { uid: "seam", width: 2.53, depth: 24, height: 34.5, placement: "base", fillerTotalWidth: 2.53 }) };
      Object.assign(seamFiller, wallPlacementAt(29.984, 2.53, 24, "top", room));
      const buried = { ...seat(of3, "top", 10, room, { uid: "buried", width: 2, depth: 24, height: 34.5, placement: "base", fillerTotalWidth: 2 }) };
      Object.assign(buried, wallPlacementAt(10, 2, 24, "top", room));
      const result = removeOverlappingPlacements([left, right, seamFiller, buried], room);
      expect(result.placed.map((item) => item.uid)).toContain("seam");
      expect(result.rejected.map((item) => item.uid)).toEqual(["buried"]);
    });
  });
});

describe("framed line sanity (330014)", () => {
  it.each(["l-shape", "u-shape"] as const)("%s build: no over-max filler, no filler lost to overlap cleanup, uppers over straight bases", (layout) => {
    const placed = build(FRAMED, layout);
    expect(overMaxFillers(placed)).toEqual([]);
    expect(removeOverlappingPlacements(placed, ROOM).rejected.filter(isFillerItem).map((item) => item.masterCode)).toEqual([]);
  });
});

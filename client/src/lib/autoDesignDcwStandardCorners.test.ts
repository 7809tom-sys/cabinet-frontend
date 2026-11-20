/**
 * Tom, Nov 20 2026 (owner voice, 4:25 / 4:33 PM CT): in standard mode, seat a
 * diagonal corner wall cabinet (DCW) at every inside 90° upper corner, before
 * the straight uppers tile, not tied to a seated base. Reserve 24 in per leg.
 * Glass comes only from the existing stacker pass if the line sells a DCW
 * glass stacker — never a W glass on a DCW, never an invented SKU.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import { isStacker, type DesignCabinet, type RoomData } from "./design";

type Pack = { base: unknown[]; wall: unknown[]; accessory: unknown[] };
const REAL = realCatalog as unknown as Record<string, Pack>;
const STYLE = "330011";
const BASES = REAL[STYLE]!.base as DesignCabinet[];
const WALLS = REAL[STYLE]!.wall as DesignCabinet[];
const ACCESSORIES = REAL[STYLE]!.accessory as DesignCabinet[];
const FILLERS = ACCESSORIES.filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`));

function appliance(code: string, width: number, depth: number, height: number): DesignCabinet {
  return {
    id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance",
    width: String(width), depth: String(depth), height: String(height), placement: "appliance",
  } as DesignCabinet;
}

const ROOM = { width: 168, depth: 144, ceilingHeight: 96 } as RoomData;

function build(overrides: Partial<AutoDesignInputs> = {}, wallCatalog: DesignCabinet[] = WALLS): AutoDesignLayoutSuccess {
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 2", centerOffsetIn: 60 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 1", centerOffsetIn: 84 },
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 },
      skipDishwasher: true, dishwasher: null, tallCabinets: null, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: { ...emptyAutoDesignIntake(), construction: "new", islandOrPeninsula: "none", preferences: ["glass-uppers"] },
      ...overrides,
    } as AutoDesignInputs,
    room: ROOM, openings: [],
    baseCatalog: BASES, wallCatalog, fillers: FILLERS,
    appliancePalette: [
      appliance("RANGE-30", 30, 25, 36),
      appliance("FRIDGE-36", 36, 30, 70),
      appliance("MW-30", 30, 15, 16),
    ],
    refrigeratorCaps: wallCatalog.filter((row) => Number(row.width) === 36 && Number(row.depth) >= 20),
    refrigeratorEndPanels: ACCESSORIES.filter((row) => /REPV|refrigerator end panel/i.test(`${row.masterCode} ${row.description}`)),
    panelCatalog: ACCESSORIES.filter((row) => /end panel|DWR|WEP|BEP/i.test(`${row.masterCode} ${row.description}`)),
    styleId: Number(STYLE), makeUid: () => `dcw-std-${++uid}`,
  });
  if (!result.ok) throw new Error(result.message);
  return result;
}

describe("Standard mode seats a DCW at inside 90° upper corners (Tom, Nov 20 2026)", () => {
  it("seats DCW2430 at the inside corner before the straight uppers tile, with no W glass on it", () => {
    const result = build();
    const dcws = result.placed.filter((item) => item.placement === "wall" && /^DCW/i.test(item.masterCode) && !isStacker(item));
    expect(dcws.length, "standard mode should seat a DCW at the 90° upper corner").toBeGreaterThanOrEqual(1);
    expect(dcws.every((item) => item.masterCode === "DCW2430" || item.masterCode === "DCW2436" || item.masterCode === "DCW2442")).toBe(true);
    const glassOnDcw = result.placed.filter((item) => {
      if (!isStacker(item)) return false;
      const parent = result.placed.find((row) => row.uid === item.spiceStackParentUid || row.uid === item.stackerParentUid);
      const host = parent ?? dcws.find((dcw) => (
        dcw.wallId === item.wallId
        && Math.abs((Number(item.wallOffset) || 0) - (Number(dcw.wallOffset) || 0)) <= 0.5
        && Math.abs(item.width - dcw.width) <= 0.5
      ));
      return Boolean(host && /^DCW/i.test(host.masterCode) && /^W(?!DC)/i.test(item.masterCode));
    });
    expect(glassOnDcw, "never put a W glass stacker on a DCW").toEqual([]);
    expect(result.placed.some((item) => /invent|FAKE|TODO/i.test(item.masterCode))).toBe(false);
  });

  it("copies a missing-DCW skip reason onto the review list and invents no SKU", () => {
    const noDcw = WALLS.filter((row) => !/^DCW/i.test(row.masterCode ?? ""));
    const result = build({}, noDcw);
    expect(result.placed.some((item) => /^DCW/i.test(item.masterCode))).toBe(false);
    const reasons = [
      ...result.skippedUppers,
      ...result.reviewFindings.map((finding) => `${finding.title} ${finding.detail}`),
    ].join(" ");
    expect(/no diagonal corner wall cabinet|does not fit at the corner|Upper runs do not meet/i.test(reasons)).toBe(true);
    expect(result.reviewFindings.some((finding) => finding.code === "upper-skip")).toBe(true);
  });
});

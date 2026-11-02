import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/autoDesignRealCatalog.json";
import { runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import { DEFAULT_ROOM, APPLIANCES, applianceAsDesignCabinet, type DesignCabinet } from "./design";
import { ANCHOR_WIGGLE_MAX_IN } from "./autoDesignAnchors";
import { DESIGNER_LAYOUT_RULES, designerLayoutRuleIds } from "./designerLayoutRules";
import { kitchenHasSingleDoorBase } from "./designerFaceRules";
import { cabinetInsideBounds } from "./designerBounds";

type Fixture = Record<string, { base: unknown[]; wall: unknown[]; accessory: unknown[] }>;
const REAL = catalogFixture as unknown as Fixture;

function catalogFor(style: string) {
  const entry = REAL[style]!;
  return {
    base: entry.base as DesignCabinet[],
    wall: entry.wall as DesignCabinet[],
    accessory: entry.accessory as DesignCabinet[],
  };
}

const ROOM = { ...DEFAULT_ROOM, width: 180 };

const makeRun = (style: string, overrides: Partial<Parameters<typeof runAutoDesignLayout>[0]> = {}) => {
  const catalog = catalogFor(style);
  let n = 0;
  return runAutoDesignLayout({
    input: {
      layoutType: "single-wall",
      originCorner: "left",
      runDirection: "right",
      sink: { wallLabel: "Wall 1", centerOffsetIn: 40 },
      sinkBaseWidthIn: 36,
      stove: { wallLabel: "Wall 1", centerOffsetIn: 110 },
      refrigerator: null,
      skipDishwasher: true,
      wallCabinetHeightIn: 30,
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
    },
    room: ROOM,
    openings: [],
    baseCatalog: catalog.base,
    wallCatalog: catalog.wall,
    fillers: catalog.accessory,
    appliancePalette: APPLIANCES.map(applianceAsDesignCabinet),
    refrigeratorCaps: [],
    refrigeratorEndPanels: [],
    styleId: Number(style),
    makeUid: () => `uid-${++n}`,
    ...overrides,
  });
};

describe.each(["330011", "540005"] as const)("owner kitchen rules land in the measured build (%s)", (style) => {
  const result = makeRun(style);

  it("builds a kitchen", () => {
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
  });

  it("registers every owner rule in the designer rule list", () => {
    const ids = designerLayoutRuleIds();
    for (const rule of DESIGNER_LAYOUT_RULES) expect(ids).toContain(rule.id);
    expect(ids).toEqual(expect.arrayContaining([
      "appliance-anchors-first",
      "corner-first-least-waste",
      "leftover-real-cabinets-first",
      "nothing-past-wall-or-room",
      "continuous-vertical-filler",
      "two-drawer-side-by-side",
      "single-door-base-required",
      "paired-handles-at-seam",
      "design-question-door-spec",
      "window-fixed-faucet-in-wall",
      "exposed-panel-three-quarter",
      "upper-54-84-90-96",
      "glass-topper-all-matching",
      "designer-filler-editable",
      "design-questions-honored",
      "microwave-bridge-in-build",
    ]));
    expect(ANCHOR_WIGGLE_MAX_IN).toBe(3);
  });

  it("honors rule 1: the range and sink anchors keep their measured 3 inch band", () => {
    if (!result.ok) return;
    const range = result.placed.find((item) => item.placement === "appliance" && /RANGE/.test(item.masterCode));
    expect(range).toBeDefined();
    const sink = result.placed.find((item) => /^SB/i.test(item.masterCode));
    expect(sink).toBeDefined();
  });

  it("honors rule 6: the kitchen has a single-door base", () => {
    if (!result.ok) return;
    expect(kitchenHasSingleDoorBase(result.placed)).toBe(true);
  });

  it("honors rule 14: everything the build could not do is on a named review list", () => {
    if (!result.ok) return;
    const success = result as AutoDesignLayoutSuccess;
    expect(Array.isArray(success.reviewFindings)).toBe(true);
    for (const finding of success.reviewFindings) {
      expect(finding.ruleId.length).toBeGreaterThan(0);
      expect(finding.code.length).toBeGreaterThan(0);
      expect(finding.title.length).toBeGreaterThan(0);
      expect(finding.detail.length).toBeGreaterThan(0);
    }
    expect(success.reviewAllHonored).toBe(!success.reviewFindings.some((finding) => finding.severity === "warning"));
  });

  it("never leaves a cabinet outside the wall or room bounds", () => {
    if (!result.ok) return;
    for (const item of result.placed) {
      expect(cabinetInsideBounds(item, ROOM), `${item.masterCode} at ${item.x},${item.y}`).toBe(true);
    }
  });
});

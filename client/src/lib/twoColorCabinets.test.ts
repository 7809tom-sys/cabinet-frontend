/**
 * Issue #352: an Auto Design kitchen showed two colors — one wall group in the
 * chosen finish and the rest in another — although the customer never set a
 * cabinet to a different finish.
 *
 * Root cause: cabinets without their own finish inherited the Designer's active
 * *brush* (`styleId`), which follows the highlighted Color 1/Color 2 slot. With
 * Color 2 active, every inherited cabinet repainted and repriced as Color 2
 * while stamped cabinets kept Color 1. A draft autosaved with Color 2 active
 * restored the same split, because Color 1 was never saved with it.
 *
 * The rule these tests hold: a cabinet uses the design's Color 1 unless it was
 * deliberately given another finish, and the plan, the cart price and the 3D
 * view resolve the same finish for every cabinet.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout } from "@/lib/autoDesignLayout";
import type { AutoDesignInputs } from "@/lib/autoDesignAutoBuild";
import { designerThreeDAssignments, type DesignerStyleRow } from "@/lib/designerThreeDStyles";
import {
  designDefaultStyleId,
  distinctStyleIds,
  effectiveStyleId,
  inferColorOneStyleId,
  pricingStyleId,
  rebaseFormerDefaultStyleOverrides,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "@/lib/design";

const designToolSource = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");

const DISTRIBUTOR = 210001;
const style = (id: number, finish: string, color: string): DesignerStyleRow => ({
  id, distributorId: DISTRIBUTOR, styleCode: `S${id}`, ourName: finish, finish, color, doorStyle: "Shaker",
} as DesignerStyleRow);
const AERO_BLANC = style(390016, "Aero Blanc", "#F2F1EC");
const AERO_SAGE = style(390017, "Aero Sage", "#8A9A7B");
const AERO_OBSIDIAN = style(390018, "Aero Obsidian", "#1E1E1E");
const DOOR_STYLES = [AERO_BLANC, AERO_SAGE, AERO_OBSIDIAN];
const DISTRIBUTOR_BY_STYLE = new Map(DOOR_STYLES.map((row) => [row.id, DISTRIBUTOR]));

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; surround?: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } };
const pack = (matrixCatalog as unknown as Record<string, Pack>)["330002"]!;
const ROOM: RoomData = { width: 144, depth: 144, ceilingHeight: 96 };

function appliance(code: string, width: number, depth: number, height: number): DesignCabinet {
  return {
    id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance",
    width: String(width), depth: String(depth), height: String(height), placement: "appliance",
  } as DesignCabinet;
}
const APPLIANCES = [
  appliance("RANGE-30", 30, 25, 36),
  appliance("DW-24", 24, 24, 34.5),
  appliance("FRIDGE-36", 36, 30, 70),
  appliance("HOOD-30", 30, 18, 18),
  appliance("HOOD-36", 36, 18, 18),
];

/** A measured 144 × 144 L-shape with uppers and bases, built in Aero Blanc. */
function autoDesignL(): PlacedCabinet[] {
  let uid = 0;
  const run = runAutoDesignLayout({
    input: {
      layoutType: "l-shape",
      originCorner: "left",
      runDirection: "right",
      wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 2", centerOffsetIn: 72 },
      sinkBaseWidthIn: 36,
      sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 1", centerOffsetIn: 44 },
      dishwasher: null,
      dishwasherSide: "right",
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 112 },
      refrigeratorWidthIn: 36,
      refrigeratorPanels: "both",
      refrigeratorEnclosure: "cabinet-above",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
    } as AutoDesignInputs,
    room: ROOM,
    openings: [],
    baseCatalog: pack.base,
    wallCatalog: pack.wall,
    fillers: pack.accessory,
    appliancePalette: APPLIANCES,
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [],
    styleId: AERO_BLANC.id,
    makeUid: () => `auto-${++uid}`,
  });
  if (!run.ok) throw new Error(run.message);
  return run.placed as PlacedCabinet[];
}

const fronts = (placed: PlacedCabinet[]) =>
  placed.filter((cabinet) => cabinet.placement === "base" || cabinet.placement === "wall" || cabinet.placement === "tall");

/** The Designer's slot state: the brush and the two color slots. */
type Slots = { styleId: number | null; styleA: number | null; styleB: number | null; activeSlot: "A" | "B" };

/** The finish each surface resolves for each cabinet, the way the Designer reads them. */
function surfaces(placed: PlacedCabinet[], slots: Slots) {
  const inherited = designDefaultStyleId(slots.styleId, slots.styleA, slots.activeSlot);
  const threeD = new Map(designerThreeDAssignments({
    placed, defaultStyleId: inherited, doorStyles: DOOR_STYLES, acceptedRows: [],
  }).map((assignment) => [assignment.uid, assignment]));
  return placed.map((cabinet) => ({
    uid: cabinet.uid,
    code: cabinet.masterCode,
    placement: cabinet.placement,
    plan: effectiveStyleId(cabinet, inherited),
    cart: pricingStyleId(cabinet, inherited, DISTRIBUTOR, DISTRIBUTOR_BY_STYLE),
    threeD: threeD.get(cabinet.uid)?.styleId ?? null,
    threeDFinish: threeD.get(cabinet.uid)?.style?.finish ?? null,
  }));
}

function expectOneFinish(rows: ReturnType<typeof surfaces>, styleId: number) {
  for (const row of rows) {
    expect({ plan: row.plan, cart: row.cart, threeD: row.threeD }, `${row.code} (${row.placement})`)
      .toEqual({ plan: styleId, cart: styleId, threeD: styleId });
  }
}

/** Selecting a slot swaps only the brush (selectColorSlot). */
const selectSlot = (slots: Slots, slot: "A" | "B"): Slots => ({
  ...slots, activeSlot: slot, styleId: (slot === "A" ? slots.styleA : slots.styleB) ?? slots.styleId,
});

describe("#352: every cabinet uses the design's finish unless it was deliberately changed", () => {
  it("an Auto Design L-shape with uppers and bases is one finish in the plan, cart and 3D", () => {
    const placed = autoDesignL();
    const kinds = new Set(fronts(placed).map((cabinet) => cabinet.placement));
    expect(kinds.has("wall") && kinds.has("base")).toBe(true);
    const slots: Slots = { styleId: AERO_BLANC.id, styleA: AERO_BLANC.id, styleB: null, activeSlot: "A" };
    expectOneFinish(surfaces(fronts(placed), slots), AERO_BLANC.id);
  });

  it("a finish change after placement repaints the whole kitchen, and making Color 2 the brush repaints nothing", () => {
    // Change Color 1 after Auto Design placed the kitchen (single finish).
    const placed = rebaseFormerDefaultStyleOverrides(autoDesignL(), AERO_BLANC.id, AERO_SAGE.id, false);
    let slots: Slots = { styleId: AERO_SAGE.id, styleA: AERO_SAGE.id, styleB: null, activeSlot: "A" };
    expectOneFinish(surfaces(fronts(placed), slots), AERO_SAGE.id);
    expect(fronts(placed).every((cabinet) => cabinet.styleId == null)).toBe(true);

    // Add Color 2 and highlight it to place a few cabinets in it later. No
    // existing cabinet was assigned Color 2, so none may change.
    slots = selectSlot({ ...slots, styleB: AERO_OBSIDIAN.id }, "B");
    expect(slots.styleId).toBe(AERO_OBSIDIAN.id);
    expectOneFinish(surfaces(fronts(placed), slots), AERO_SAGE.id);
    expect(distinctStyleIds(placed, designDefaultStyleId(slots.styleId, slots.styleA, slots.activeSlot))).toEqual([AERO_SAGE.id]);

    // Under the old rule (inherit the brush), the whole inherited kitchen turned Obsidian.
    expect(fronts(placed).map((cabinet) => effectiveStyleId(cabinet, slots.styleId))).not.toContain(AERO_SAGE.id);

    // Back on Color 1 the kitchen is unchanged.
    slots = selectSlot(slots, "A");
    expectOneFinish(surfaces(fronts(placed), slots), AERO_SAGE.id);
  });

  it("a mixed run: only cabinets deliberately placed in Color 2 use it, everywhere", () => {
    const placed = autoDesignL();
    let slots: Slots = { styleId: AERO_BLANC.id, styleA: AERO_BLANC.id, styleB: AERO_OBSIDIAN.id, activeSlot: "A" };
    slots = selectSlot(slots, "B");
    // Two base cabinets painted with the Color 2 brush (addCabinet stamps the brush).
    const painted = new Set(fronts(placed).filter((cabinet) => cabinet.placement === "base").slice(0, 2).map((cabinet) => cabinet.uid));
    // An inherited run next to them (a later finish pass cleared its stamps).
    const inheritedUids = new Set(fronts(placed).filter((cabinet) => cabinet.placement === "wall").map((cabinet) => cabinet.uid));
    const mixed = placed.map((cabinet) => (
      painted.has(cabinet.uid) ? { ...cabinet, styleId: slots.styleId }
        : inheritedUids.has(cabinet.uid) ? { ...cabinet, styleId: null }
          : cabinet
    ));
    const rows = surfaces(fronts(mixed), slots);
    for (const row of rows) {
      const expected = painted.has(row.uid) ? AERO_OBSIDIAN.id : AERO_BLANC.id;
      expect({ plan: row.plan, cart: row.cart, threeD: row.threeD }, `${row.code} (${row.placement})`)
        .toEqual({ plan: expected, cart: expected, threeD: expected });
    }
    expect(rows.filter((row) => row.threeDFinish === "Aero Obsidian")).toHaveLength(2);
    expect(distinctStyleIds(mixed, designDefaultStyleId(slots.styleId, slots.styleA, slots.activeSlot)))
      .toEqual([AERO_BLANC.id, AERO_OBSIDIAN.id]);
  });

  it("recovers Color 1 from a draft autosaved with Color 2 active, but never guesses a third accent", () => {
    const AERO_TERRA = 390019;
    const kitchen = fronts(autoDesignL());
    // Auto Design stamped Color 1; a later pass left half inherited; one cabinet was painted Color 2.
    const stamped = kitchen.map((cabinet, index) => (index % 2 === 0 ? { ...cabinet, styleId: null } : cabinet));
    stamped[0] = { ...stamped[0]!, styleId: AERO_OBSIDIAN.id };
    expect(inferColorOneStyleId(stamped, AERO_OBSIDIAN.id, AERO_OBSIDIAN.id)).toBe(AERO_BLANC.id);

    // A deliberate third accent makes the stamps ambiguous: keep what the
    // inherited cabinets were showing when the draft was saved.
    const withAccent = stamped.map((cabinet, index) => (index === 1 || index === 3 || index === 5 ? { ...cabinet, styleId: AERO_TERRA } : cabinet));
    expect(inferColorOneStyleId(withAccent, AERO_OBSIDIAN.id, AERO_OBSIDIAN.id)).toBe(AERO_OBSIDIAN.id);
    expect(inferColorOneStyleId(withAccent, AERO_OBSIDIAN.id, AERO_SAGE.id)).toBe(AERO_SAGE.id);

    // Nothing stamped besides Color 2: the inherited finish stands.
    expect(inferColorOneStyleId(kitchen.map((cabinet) => ({ ...cabinet, styleId: null })), AERO_OBSIDIAN.id, AERO_SAGE.id)).toBe(AERO_SAGE.id);
  });

  it("Auto Design run with Color 2 lit still builds a one-color Color 1 kitchen", () => {
    // The Designer hands Auto Design the design's Color 1, not the lit swatch.
    const slots: Slots = { styleId: AERO_OBSIDIAN.id, styleA: AERO_BLANC.id, styleB: AERO_OBSIDIAN.id, activeSlot: "B" };
    const built = autoDesignL();
    expect(fronts(built).every((cabinet) => cabinet.styleId == null || cabinet.styleId === AERO_BLANC.id)).toBe(true);
    expectOneFinish(surfaces(fronts(built), slots), AERO_BLANC.id);
    const autoDesign = designToolSource.slice(
      designToolSource.indexOf("const buildAutoDesignLayout = useCallback("),
      designToolSource.indexOf("const closetGroups = useMemo("),
    );
    expect(autoDesign.match(/designStyleIdRef\.current \?\? null/g)?.length ?? 0).toBeGreaterThanOrEqual(10);
    expect(autoDesign).not.toMatch(/(?<!design)styleIdRef\.current/);
    expect(designToolSource).toContain("useEffect(() => { designStyleIdRef.current = designStyleId; }, [designStyleId]);");
  });

  it("the Designer resolves inherited cabinets, saves and drafts against Color 1, not the brush", () => {
    expect(designToolSource).toContain("const designStyleId = designDefaultStyleId(styleId, styleA, activeSlot);");
    expect(designToolSource).toContain("return pricingStyleId(priced, designStyleId, lockedDistributorId, styleDistributorIdById);");
    expect(designToolSource).toContain("return effectiveStyleId(cab, designStyleId);");
    expect(designToolSource).toContain("defaultStyleId: designStyleId ?? null,");
    expect(designToolSource).toContain("selectedStyleId: designStyleId ?? null,");
    expect(designToolSource).toMatch(/threeDPresentation=\{threeDPresentationForSave\}\s+styleId=\{designStyleId\}/);
    expect(designToolSource).toContain("styleA: designStyleId,");
    // Package (bundle) save, the wall/island color summary, trims and the
    // materials list name and price Color 1, not the lit swatch.
    const bundleSave = designToolSource.slice(designToolSource.indexOf("const handleSaveBundle = () => {"), designToolSource.indexOf("const [csvImportOpen, setCsvImportOpen]"));
    expect(bundleSave).toContain("doorColor: bundleDraft.doorColor.trim() || designStyleName || undefined,");
    expect(bundleSave).toContain("styleId: designStyleId,");
    expect(bundleSave).toContain("styleId: designStyleId ?? undefined,");
    expect(bundleSave).toContain("styleName: designStyleName ?? undefined,");
    expect(bundleSave).not.toMatch(/\bactiveStyleName\b|\bstyleId: styleId\b|^\s*styleId,$/m);
    const summary = designToolSource.slice(designToolSource.indexOf("const selectedFinishSummary = useMemo"), designToolSource.indexOf("const selectedFinishSummary = useMemo") + 400);
    expect(summary).toContain("const wallStyleId = designStyleId;");
    expect(summary).not.toMatch(/: styleId;|= styleId;/);
    expect(designToolSource).toContain("() => (designStyleId ? [designStyleId] : ([] as number[])),");
    expect(designToolSource).toContain("buildTrimCartLines(activeTrims, designStyleId, designStyleName");
    expect(designToolSource).toContain("defaultStyleName: designStyleName,");
    expect(designToolSource).not.toMatch(/pricingStyleIdFor\([^)]*\) \?\? styleId\b/);
  });
});

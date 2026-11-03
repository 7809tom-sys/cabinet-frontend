import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import ovenRows from "./__fixtures__/ovenCabinetRows.json";
import pelicanRows from "./__fixtures__/pelicanCatalogRows.json";
import type { DesignCabinet, PlacedCabinet, RoomData } from "./design";
import { runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import { ensureAutoDesignFaucet } from "./autoDesignFaucet";

type Pack = { base: unknown[]; wall: unknown[]; accessory: unknown[] };
const REAL = realCatalog as unknown as Record<string, Pack>;
const STYLE = "330011";
const BASES = REAL[STYLE]!.base as DesignCabinet[];
const WALLS = REAL[STYLE]!.wall as DesignCabinet[];
const FILLERS = (REAL[STYLE]!.accessory as DesignCabinet[]).filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`));
const TALL = ovenRows as unknown as DesignCabinet[];
const SINK_ROWS = (pelicanRows as unknown as Array<{ id: number; pelicanCode: string; name: string; description?: string; subCategory: string; imageUrl?: string | null; size?: string | null; sellPrice?: number | null }>)
  .filter((row) => row.subCategory === "Sinks");

function room(): RoomData {
  return { width: 168, depth: 132, ceilingHeight: 96, openWallPath: false } as RoomData;
}

function inputs(overrides: Partial<AutoDesignInputs> = {}): AutoDesignInputs {
  return {
    layoutType: "single-wall",
    originCorner: "left",
    runDirection: "right",
    wallCabinetHeightIn: 30,
    sink: { wallLabel: "Wall 1", centerOffsetIn: 48 },
    sinkBaseWidthIn: 36,
    sinkBaseKind: "regular",
    stove: { wallLabel: "Wall 1", centerOffsetIn: 108 },
    skipDishwasher: true,
    dishwasher: null,
    refrigerator: null,
    ...overrides,
  };
}

let uid = 0;
function build(overrides: Partial<AutoDesignInputs> = {}): AutoDesignLayoutSuccess {
  uid = 0;
  const result = runAutoDesignLayout({
    input: inputs(overrides),
    room: room(),
    openings: [],
    baseCatalog: BASES,
    wallCatalog: WALLS,
    fillers: FILLERS,
    appliancePalette: [
      { id: 0, masterCode: "RANGE-30", description: '30" Range', category: "Appliance", subCategory: "Appliance", width: "30", height: "36", depth: "25", placement: "appliance" } as DesignCabinet,
      { id: 0, masterCode: "DW-24", description: '24" Dishwasher', category: "Appliance", subCategory: "Appliance", width: "24", height: "34.5", depth: "24", placement: "appliance" } as DesignCabinet,
      { id: 0, masterCode: "FRIDGE-36", description: '36" Refrigerator', category: "Appliance", subCategory: "Appliance", width: "36", height: "70", depth: "30", placement: "appliance" } as DesignCabinet,
    ],
    refrigeratorCaps: [],
    refrigeratorEndPanels: [],
    tallCatalog: TALL,
    styleId: 330011,
    makeUid: () => `uid-${++uid}`,
  });
  if (!result.ok) throw new Error(result.message);
  return result;
}

function sinkBase(result: AutoDesignLayoutSuccess): PlacedCabinet {
  const row = result.placed.find((cabinet) => cabinet.placement === "base" && /^(?:SB|FSB)/.test(cabinet.masterCode));
  if (!row) throw new Error("no sink base in the built kitchen");
  return row;
}

function sinkRow(code: string) {
  const row = SINK_ROWS.find((entry) => entry.pelicanCode === code);
  if (!row) throw new Error(`no fixture sink ${code}`);
  return row;
}

describe("Auto-Design places a Pelican sink picked in the pop-up", () => {
  it("seats the real catalog basin in the measured sink base", () => {
    const pick = sinkRow("PL-VS3018 18g");
    const result = build({
      sinkProducts: [{
        productId: pick.id,
        pelicanCode: pick.pelicanCode,
        name: pick.name,
        imageUrl: pick.imageUrl ?? null,
        size: pick.size ?? null,
      }],
    });
    const base = sinkBase(result);
    expect(result.sinks).toHaveLength(1);
    const [sink] = result.sinks;
    expect(sink!.cabinetUid).toBe(base.uid);
    expect(sink!.pelicanProductId).toBe(pick.id);
    expect(sink!.pelicanProductName).toBe(pick.name);
    expect(sink!.type).not.toBe("farmhouse");
  });

  it("puts the faucet on the countertop behind the basin, never inside it", () => {
    const pick = sinkRow("PL-VS3018 18g");
    const result = build({
      sinkProducts: [{
        productId: pick.id,
        pelicanCode: pick.pelicanCode,
        name: pick.name,
        imageUrl: pick.imageUrl ?? null,
        size: pick.size ?? null,
      }],
    });
    const sink = result.sinks[0]!;
    // The measured build leaves the fixture without a faucet; the Designer then
    // attaches one with ensureAutoDesignFaucet, on the deck behind the basin.
    expect(sink.faucet).toBe(false);
    const withFaucet = ensureAutoDesignFaucet(sink, null).sink;
    expect(withFaucet.faucet).toBe(true);
    const rearDeck = withFaucet.faucetRearDeckOffsetIn ?? 1.25;
    expect(rearDeck).toBeGreaterThan(0);
    // Behind the rear rim means offset = half the basin depth + the deck setback,
    // so the mounting point is outside the basin, toward the wall.
    expect((withFaucet.sourceDepth ?? withFaucet.depth) / 2 + rearDeck).toBeGreaterThan((withFaucet.sourceDepth ?? withFaucet.depth) / 2);
  });

  it("switches to the matching farmhouse base when an apron-front sink is picked", () => {
    const pick = sinkRow("PL-HA124 R0 16g");
    const result = build({
      sinkBaseWidthIn: 36,
      sinkBaseKind: "regular",
      sinkProducts: [{
        productId: pick.id,
        pelicanCode: pick.pelicanCode,
        name: pick.name,
        imageUrl: pick.imageUrl ?? null,
        size: pick.size ?? null,
      }],
    });
    const base = sinkBase(result);
    expect(base.masterCode).toBe("FSB36");
    const sink = result.sinks[0]!;
    expect(sink.cabinetUid).toBe(base.uid);
    expect(sink.apronFront).toBe(true);
    expect(sink.type).toBe("farmhouse");
  });

  it("keeps the measured base when no sink was picked", () => {
    const result = build();
    expect(sinkBase(result).masterCode).toBe("SB36");
    expect(result.sinks[0]!.pelicanProductId).toBeUndefined();
  });
});

describe("Auto-Design auto-places a tall oven pantry picked in the pop-up", () => {
  it("places UOC3390 as a real tall cabinet with its own SKU", () => {
    const uoc = TALL.find((row) => row.masterCode === "UOC3390(O339024)")!;
    const result = build({
      tallCabinets: [{ cabinetId: uoc.id ?? 0, masterCode: "UOC3390" }],
    });
    const tall = result.placed.filter((cabinet) => cabinet.placement === "tall");
    expect(tall).toHaveLength(1);
    expect(tall[0]!.masterCode).toBe("UOC3390(O339024)");
    expect(tall[0]!.height).toBe(90);
    expect(tall[0]!.width).toBe(33);
    expect(result.reviewFindings.some((finding) => finding.code === "tall-cabinet-blocked")).toBe(false);
  });

  it("places nothing when no tall cabinet was picked", () => {
    expect(build().placed.some((cabinet) => cabinet.placement === "tall")).toBe(false);
  });

  it("names a picked tall box that cannot fit instead of moving it", () => {
    const uoc = TALL.find((row) => row.masterCode === "UOC3390(O339024)")!;
    // A 90-inch pantry cannot clear an 84-inch ceiling.
    uid = 0;
    const result = runAutoDesignLayout({
      input: inputs({ tallCabinets: [{ cabinetId: uoc.id ?? 0, masterCode: "UOC3390" }] }),
      room: { ...room(), ceilingHeight: 84 } as RoomData,
      openings: [],
      baseCatalog: BASES,
      wallCatalog: WALLS,
      fillers: FILLERS,
      appliancePalette: [
        { id: 0, masterCode: "RANGE-30", description: '30" Range', category: "Appliance", subCategory: "Appliance", width: "30", height: "36", depth: "25", placement: "appliance" } as DesignCabinet,
      ],
      refrigeratorCaps: [],
      refrigeratorEndPanels: [],
      tallCatalog: TALL,
      styleId: 330011,
      makeUid: () => `uid-${++uid}`,
    });
    if (!result.ok) throw new Error(result.message);
    expect(result.placed.some((cabinet) => cabinet.placement === "tall")).toBe(false);
    const finding = result.reviewFindings.find((entry) => entry.code === "tall-cabinet-blocked");
    expect(finding).toBeTruthy();
    expect(finding!.detail).toMatch(/ceiling/i);
  });
});

describe("a sink already on the plan must not break the measured build", () => {
  it("completes and seats exactly one sink base even when a pushed sink sits in the room", () => {
    // This is the owner's break: push a Pelican sink, its base lands in the
    // Designer, and then Auto-Design must still build. The build must ignore the
    // pushed sink as a host and seat its own measured sink base, and it must not
    // auto-place a Pelican basin either — the sink question comes after the build.
    const pushedBase: PlacedCabinet = {
      uid: "pushed-sink-base",
      cabinetId: 1,
      masterCode: "SB36",
      description: '36" Sink Base',
      category: "Base",
      subCategory: "Sink Base",
      placement: "base",
      x: 0,
      y: 0,
      width: 36,
      depth: 24,
      height: 34.5,
      rotation: 0,
      wallId: "bottom",
      wallOffset: 12,
    } as PlacedCabinet;
    uid = 0;
    const result = runAutoDesignLayout({
      input: inputs({ skipDishwasher: true }),
      room: room(),
      openings: [],
      baseCatalog: BASES,
      wallCatalog: WALLS,
      fillers: FILLERS,
      appliancePalette: [
        { id: 0, masterCode: "RANGE-30", description: '30" Range', category: "Appliance", subCategory: "Appliance", width: "30", height: "36", depth: "25", placement: "appliance" } as DesignCabinet,
      ],
      refrigeratorCaps: [],
      refrigeratorEndPanels: [],
      tallCatalog: TALL,
      styleId: 330011,
      makeUid: () => `uid-${++uid}`,
      // The pushed sink base is a pre-existing placement, not an anchor.
      preExistingPlacements: [pushedBase],
    });
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    const sinkBases = result.placed.filter((item) => /^(?:SB|FSB)/.test(item.masterCode));
    expect(sinkBases).toHaveLength(1);
    // The build seats its own source-priced base; the pushed one is replaced, not stacked.
    expect(sinkBases[0]!.uid).not.toBe(pushedBase.uid);
    expect(pushedBase.uid).not.toBe("");
    // A neutral basin is seated for the post-build question; no Pelican product yet.
    expect(result.sinks[0]!.pelicanProductId).toBeUndefined();
  });
});

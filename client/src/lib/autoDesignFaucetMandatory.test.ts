/**
 * HARD RULE (owner, Nov 5 2026): auto-design ALWAYS places a faucet at the sink.
 *
 * Mandatory like the over-range bridge. Every build — `runAutoDesignLayout` and the
 * DesignTool builder — places one deck-mounted faucet per sink fixture, centered on
 * the sink base, seated on the countertop, and drawn in 3D. On every layout load an
 * older plan that has no faucet gets one too.
 *
 * Add-only: a sink that already has a faucet (chosen catalog row, a previous
 * auto-placed one, or the default fixture) is never replaced or removed. When the
 * selected line sells no faucet row, the built-in default fixture is used and
 * reported.
 *
 * How a faucet is modelled: it is a property of the `SinkFixture` record —
 * `faucet: true` plus the verified Pelican profile identity and its published
 * dimensions. 3D draws the assembly from those dimensions via
 * `addSinkFixture`, and the faucet moves/deletes/saves with the sink.
 */
import { describe, expect, it } from "vitest";
import matrixCatalog from "./__fixtures__/autoDesignMatrixCatalog.json";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import { runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import {
  DEFAULT_PELICAN_KITCHEN_FAUCET,
  defaultPelicanKitchenFaucetProfile,
  verifiedPelicanFaucetProfile,
} from "./pelicanFixtureProfiles";
import {
  defaultAutoDesignFaucet,
  ensureMandatorySinkFaucets,
  everySinkHasFaucet,
  sinkFaucetIsSatisfied,
  sinkHasDefaultFaucet,
  sinkHasFaucet,
  withDefaultFaucet,
  type AutoDesignFaucetProduct,
} from "./autoDesignFaucet";
import {
  DEFAULT_ROOM,
  makeDefaultSinkForCabinet,
  makeSink,
  sinkFaucetPlanPoint,
  wallPlacementAt,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type SinkFixture,
} from "./design";
import { raiseWindowsForDeckFaucet, resolveDeckFaucetPlacement } from "./faucetPlacement";

type StylePack = { name: string; base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[] };
const catalog = matrixCatalog as unknown as Record<string, StylePack>;
const REAL = realCatalog as unknown as Record<string, { wall: DesignCabinet[] }>;

const APPLIANCES = [
  { id: 0, masterCode: "RANGE-30", description: '30" Range', category: "Appliance", subCategory: "Appliance", width: "30", depth: "25", height: "36", placement: "appliance" },
  { id: 2, masterCode: "DW-24", description: '24" Dishwasher', category: "Appliance", subCategory: "Appliance", width: "24", depth: "24", height: "34.5", placement: "appliance" },
] as DesignCabinet[];

/** A real Pelican kitchen faucet row, as the catalog API returns it. */
const CATALOG_FAUCET: AutoDesignFaucetProduct = {
  id: 8203,
  pelicanCode: "PL-8203",
  name: "PL-8203 Fountain Series Pull-Down Kitchen Faucet",
  category: "Sinks & Faucets",
  subCategory: "Faucets",
  sellPrice: 28900,
};

function sinkFixture(overrides: Partial<SinkFixture> = {}): SinkFixture {
  return {
    uid: "sink-1",
    type: "single",
    x: 60,
    y: 0,
    width: 30,
    depth: 22,
    faucet: true,
    wallSide: "top",
    ...overrides,
  } as SinkFixture;
}

function build(styleId: string, overrides: Partial<AutoDesignInputs> = {}, room: RoomData = { ...DEFAULT_ROOM, width: 168, depth: 132, ceilingHeight: 96 }, faucetCatalog?: readonly AutoDesignFaucetProduct[]) {
  const pack = catalog[styleId]!;
  let uid = 0;
  return runAutoDesignLayout({
    input: {
      layoutType: "single-wall",
      originCorner: "left",
      runDirection: "right",
      wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 1", centerOffsetIn: 30 },
      sinkBaseWidthIn: 36,
      sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 1", centerOffsetIn: 110 },
      skipDishwasher: true,
      dishwasher: null,
      refrigerator: null,
      ...overrides,
    } as AutoDesignInputs,
    room,
    openings: [],
    baseCatalog: pack.base,
    wallCatalog: pack.wall,
    fillers: pack.accessory,
    appliancePalette: APPLIANCES,
    refrigeratorCaps: [],
    refrigeratorEndPanels: [],
    faucetCatalog,
    styleId: Number(styleId),
    makeUid: () => `f-${++uid}`,
  } as never);
}

/** The one faucet assertion every build path must satisfy. */
function expectFaucetAtSink(result: AutoDesignLayoutSuccess, room: RoomData, label: string) {
  expect(result.sinks.length, `${label}: the build must place a sink`).toBeGreaterThan(0);
  expect(result.everySinkHasFaucet, `${label}: every sink must report a faucet`).toBe(true);
  for (const sink of result.sinks) {
    expect(sink.faucet, `${label}: ${sink.uid} has no faucet`).toBe(true);
    // The 3D assembly needs real dimensions, or there is nothing to draw.
    expect(sink.faucetForm, `${label}: ${sink.uid} has no faucet form`).toBeTruthy();
    expect(sink.faucetOverallHeight, `${label}: ${sink.uid} has no overall height`).toBeGreaterThan(0);
    expect(sink.faucetSpoutLength, `${label}: ${sink.uid} has no spout length`).toBeGreaterThan(0);
    expect(sink.faucetSpoutHeight, `${label}: ${sink.uid} has no spout height`).toBeGreaterThan(0);
    expect(sink.faucetFinish, `${label}: ${sink.uid} has no finish`).toBeTruthy();
    expect(sink.faucetRearDeckOffsetIn, `${label}: ${sink.uid} has no rear deck datum`).toBeGreaterThan(0);
    // Seated on the countertop, behind the basin, centered on the sink base.
    const placement = resolveDeckFaucetPlacement(sink, room, [], []);
    expect(placement.anchored, `${label}: ${sink.uid} faucet is not anchored`).toBe(true);
    expect(placement.renderFaucet, `${label}: ${sink.uid} faucet would not render`).toBe(true);
    expect(placement.onCountertop, `${label}: ${sink.uid} faucet is off the countertop`).toBe(true);
    expect(placement.conflict, `${label}: ${sink.uid} faucet hits a window frame`).toBeNull();
  }
}

describe("a faucet is always placed at the sink", () => {
  for (const styleId of ["540005", "540007", "330014", "330020", "330002", "510004"]) {
    it(`places one on a single-wall build (${styleId})`, () => {
      const room = { ...DEFAULT_ROOM, width: 168, depth: 132, ceilingHeight: 96 };
      const result = build(styleId, {}, room, [CATALOG_FAUCET]);
      expect(result.ok, result.ok ? "" : result.message).toBe(true);
      if (!result.ok) return;
      expectFaucetAtSink(result, room, styleId);
      // The catalog row the line offers is the one used.
      expect(result.sinks[0]!.pelicanFaucetProductId).toBe(CATALOG_FAUCET.id);
      expect(result.usedDefaultFaucet).toBe(false);
      expect(result.notes.some((note) => /faucet/i.test(note))).toBe(true);
    });
  }

  it("places one on every layout shape", () => {
    const cases: Array<{ layout: AutoDesignInputs["layoutType"]; room: RoomData; stove: AutoDesignInputs["stove"] }> = [
      { layout: "single-wall", room: { ...DEFAULT_ROOM, width: 168, depth: 132 }, stove: { wallLabel: "Wall 1", centerOffsetIn: 110 } },
      { layout: "l-shape", room: { ...DEFAULT_ROOM, width: 168, depth: 132 }, stove: { wallLabel: "Wall 2", centerOffsetIn: 60 } },
      { layout: "galley", room: { ...DEFAULT_ROOM, width: 180, depth: 132 }, stove: { wallLabel: "Wall 1", centerOffsetIn: 110 } },
    ];
    for (const entry of cases) {
      const result = build("540005", { layoutType: entry.layout, stove: entry.stove }, entry.room, [CATALOG_FAUCET]);
      expect(result.ok, `${entry.layout}: ${result.ok ? "" : result.message}`).toBe(true);
      if (!result.ok) continue;
      expectFaucetAtSink(result, entry.room, entry.layout);
    }
  });

  it("places one on every cabinet line, with and without a catalog faucet", () => {
    for (const styleId of ["540005", "330014"]) {
      for (const faucetCatalog of [[CATALOG_FAUCET], []]) {
        const room = { ...DEFAULT_ROOM, width: 168, depth: 132, ceilingHeight: 96 };
        const result = build(styleId, {}, room, faucetCatalog);
        expect(result.ok).toBe(true);
        if (!result.ok) continue;
        expectFaucetAtSink(result, room, `${styleId} catalog=${faucetCatalog.length}`);
      }
    }
  });
});

describe("the default fixture is used and reported when the line sells no faucet", () => {
  it("falls back to the built-in default and says so", () => {
    const room = { ...DEFAULT_ROOM, width: 168, depth: 132, ceilingHeight: 96 };
    const result = build("540005", {}, room, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expectFaucetAtSink(result, room, "no catalog");
    expect(result.usedDefaultFaucet).toBe(true);
    expect(result.sinks[0]!.defaultFaucet).toBe(true);
    expect(result.sinks[0]!.pelicanFaucetProductId).toBeUndefined();
    // A named report, not a silent substitution.
    const note = result.notes.find((entry) => /default/i.test(entry) && /faucet/i.test(entry));
    expect(note).toBeTruthy();
    expect(note).toContain(DEFAULT_PELICAN_KITCHEN_FAUCET.pelicanCode);
  });

  it("uses real published dimensions, not invented geometry", () => {
    const profile = defaultPelicanKitchenFaucetProfile();
    expect(profile.pelicanCode).toBe("PL-8237 BN");
    expect(profile.specificationUrl).toMatch(/pelican|accentuate/i);
    expect(profile.installation).toBe("single-hole");
    expect(profile.overallHeightIn).toBeGreaterThan(0);
    expect(profile.spoutLengthIn).toBeGreaterThan(0);
    expect(profile.spoutHeightIn).toBeGreaterThan(0);
    // It is a profile the normal lookup resolves, so it renders like any catalog faucet.
    expect(verifiedPelicanFaucetProfile(profile.pelicanCode)?.id).toBe(profile.id);
  });

  it("applies the default to a bare sink fixture", () => {
    const applied = withDefaultFaucet(sinkFixture({ faucet: false }));
    expect(applied.faucet).toBe(true);
    expect(applied.defaultFaucet).toBe(true);
    expect(applied.pelicanFaucetProfileId).toBe(DEFAULT_PELICAN_KITCHEN_FAUCET.id);
    expect(applied.faucetForm).toBe(DEFAULT_PELICAN_KITCHEN_FAUCET.profile);
    expect(applied.faucetOverallHeight).toBe(DEFAULT_PELICAN_KITCHEN_FAUCET.overallHeightIn);
  });
});

describe("add-only: an existing faucet is never replaced or removed", () => {
  it("keeps a chosen catalog faucet exactly as it is", () => {
    const chosen = sinkFixture({
      pelicanFaucetProductId: 8207,
      pelicanFaucetProductName: "PL-8207 BN",
      pelicanFaucetProfileId: "pelican-pl-8207-fountain-pull-down-brushed-nickel",
      faucetForm: "pull-down",
      faucetOverallHeight: 26.125,
      faucetSpoutLength: 7.6875,
      faucetSpoutHeight: 6.5,
      faucetFinish: "brushed-nickel",
    });
    const result = ensureMandatorySinkFaucets([chosen], [CATALOG_FAUCET]);
    expect(result.sinks[0]).toBe(chosen);
    expect(result.source).toBe("existing");
    expect(result.attachedUids).toEqual([]);
  });

  it("keeps the default fixture it already applied", () => {
    const withDefault = withDefaultFaucet(sinkFixture({ faucet: false }));
    const result = ensureMandatorySinkFaucets([withDefault], [CATALOG_FAUCET]);
    expect(result.sinks[0]).toBe(withDefault);
    expect(result.source).toBe("existing");
    expect(result.attachedUids).toEqual([]);
  });

  it("keeps a legacy faucet that has no catalog id", () => {
    const legacy = sinkFixture({
      autoDesignFaucet: true,
      pelicanFaucetProfileId: "pelican-pl-8237-fountain-standard-arc-brushed-nickel",
      faucetForm: "standard-arc",
      faucetOverallHeight: 12.8125,
      faucetSpoutLength: 7.0625,
      faucetSpoutHeight: 8.375,
      faucetFinish: "brushed-nickel",
    });
    const result = ensureMandatorySinkFaucets([legacy], [CATALOG_FAUCET]);
    expect(result.sinks[0]).toBe(legacy);
    expect(result.attachedUids).toEqual([]);
  });

  it("dresses a bare faucet flag that has no dimensions, because it draws nothing", () => {
    // `makeSink` sets faucet: true before any faucet is chosen. Treating that flag
    // alone as "already has a faucet" is the bug: the 3D assembly needs a form and
    // its three published dimensions, so this sink still gets a real faucet.
    const bare = sinkFixture({ uid: "bare", faucet: true });
    expect(sinkFaucetIsSatisfied(bare)).toBe(false);
    const result = ensureMandatorySinkFaucets([bare], [CATALOG_FAUCET]);
    expect(result.attachedUids).toEqual(["bare"]);
    expect(sinkFaucetIsSatisfied(result.sinks[0]!)).toBe(true);
    expect(result.sinks[0]!.pelicanFaucetProductId).toBe(CATALOG_FAUCET.id);
  });

  it("never deletes or reorders the sink list", () => {
    const one = sinkFixture({ uid: "a" });
    const two = sinkFixture({ uid: "b", faucet: false, pelicanFaucetProductId: undefined });
    // `one` is a bare flag with no dimensions, so both sinks get a faucet while the
    // order and the count are preserved.
    const result = ensureMandatorySinkFaucets([one, two], [CATALOG_FAUCET]);
    expect(result.sinks.map((sink) => sink.uid)).toEqual(["a", "b"]);
    expect(result.attachedUids).toEqual(["a", "b"]);
  });

  it("gives each of several sinks its own faucet", () => {
    const a = sinkFixture({ uid: "a", faucet: false });
    const b = sinkFixture({ uid: "b", faucet: false });
    const result = ensureMandatorySinkFaucets([a, b], [CATALOG_FAUCET]);
    expect(result.sinks.every((sink) => sink.faucet)).toBe(true);
    expect(everySinkHasFaucet(result.sinks)).toBe(true);
    expect(result.attachedUids).toEqual(["a", "b"]);
  });

  it("is idempotent", () => {
    const once = ensureMandatorySinkFaucets([sinkFixture({ faucet: false })], [CATALOG_FAUCET]);
    const twice = ensureMandatorySinkFaucets(once.sinks, [CATALOG_FAUCET]);
    expect(twice.attachedUids).toEqual([]);
    expect(twice.sinks[0]).toBe(once.sinks[0]);
  });

  it("does nothing when there is no sink", () => {
    const result = ensureMandatorySinkFaucets([], [CATALOG_FAUCET]);
    expect(result.sinks).toEqual([]);
    expect(result.attachedUids).toEqual([]);
    expect(result.notes).toEqual([]);
  });
});

describe("the faucet sits centered on the sink base, on the countertop", () => {
  it("is centered on the sink base's own run axis", () => {
    const room = { ...DEFAULT_ROOM, width: 168, depth: 132, ceilingHeight: 96 };
    const result = build("540005", {}, room, [CATALOG_FAUCET]);
    if (!result.ok) return;
    const sink = result.sinks[0]!;
    // The sink fixture is centered in its owning base, so its center IS the base center.
    const base = result.placed.find((item) => item.uid === sink.cabinetUid)!;
    expect(base).toBeDefined();
    const sinkCenterAlong = sink.x + sink.width / 2;
    const baseCenterAlong = base.wallId === "left" || base.wallId === "right"
      ? base.y + base.depth / 2
      : base.x + base.width / 2;
    expect(sinkCenterAlong).toBeCloseTo(baseCenterAlong, 1);
    // The resolved mount point shares that run axis.
    const placement = resolveDeckFaucetPlacement(sink, room, [], []);
    const mountAlong = sink.wallSide === "left" || sink.wallSide === "right" ? placement.mountY : placement.mountX;
    expect(mountAlong).toBeCloseTo(sinkCenterAlong, 1);
  });

  it("mounts on the countertop at counter height, behind the basin", () => {
    const room = { ...DEFAULT_ROOM, width: 168, depth: 132, ceilingHeight: 96 };
    const result = build("540005", {}, room, [CATALOG_FAUCET]);
    if (!result.ok) return;
    const sink = result.sinks[0]!;
    const placement = resolveDeckFaucetPlacement(sink, room, [], []);
    expect(placement.onCountertop).toBe(true);
    // At the top wall, the faucet sits toward the wall from the basin (smaller y).
    if (sink.wallSide === "top") {
      expect(placement.mountY).toBeLessThan(sink.y + sink.depth);
      expect(placement.mountY).toBeGreaterThanOrEqual(0);
    }
  });

  it("stays on the deck for a farmhouse sink, which has no rear deck offset", () => {
    // A farmhouse sink is countertop-mounted with its apron at the cabinet front.
    const room = { ...DEFAULT_ROOM, width: 168, depth: 132, ceilingHeight: 96 };
    const spot = wallPlacementAt(30, 36, 24, "top", room)!;
    const base: PlacedCabinet = {
      uid: "fsb-36", cabinetId: 36, masterCode: "FSB36", description: "36 inch farmhouse sink base",
      placement: "base", ...spot, width: 36, depth: 24, height: 34.5, styleId: 540005,
    } as PlacedCabinet;
    const farmhouse = makeDefaultSinkForCabinet(base, room, "farmhouse");
    const result = ensureMandatorySinkFaucets([{ ...farmhouse, faucet: false }], [CATALOG_FAUCET]);
    expect(result.sinks[0]!.faucet).toBe(true);
    expect(result.sinks[0]!.faucetOverallHeight).toBeGreaterThan(0);
  });
});

describe("the faucet is part of the sink record, so it saves and loads with the plan", () => {
  it("travels on the sink, not as a separate entity", () => {
    const sink = makeSink("single", 60, 0, "top");
    const result = ensureMandatorySinkFaucets([{ ...sink, faucet: false }], [CATALOG_FAUCET]);
    const withFaucet = result.sinks[0]!;
    // Everything a reload needs is on the sink record itself.
    expect(withFaucet.faucet).toBe(true);
    expect(withFaucet.faucetForm).toBeTruthy();
    expect(withFaucet.faucetFinish).toBeTruthy();
    expect(withFaucet.faucetOverallHeight).toBeGreaterThan(0);
    expect(withFaucet.pelicanFaucetProductId).toBe(CATALOG_FAUCET.id);
  });

  it("reports a bare saved sink as needing a faucet, and a dressed one as done", () => {
    const bare = { ...sinkFixture(), faucet: false } as SinkFixture;
    expect(sinkHasFaucet(bare)).toBe(false);
    expect(everySinkHasFaucet([bare])).toBe(false);
    const dressed = ensureMandatorySinkFaucets([bare], [CATALOG_FAUCET]).sinks;
    expect(sinkHasFaucet(dressed[0]!)).toBe(true);
    expect(everySinkHasFaucet(dressed)).toBe(true);
    expect(sinkHasDefaultFaucet(dressed[0]!)).toBe(false);
  });

  it("recognises a saved default fixture as already dressed", () => {
    const savedDefault = withDefaultFaucet({ ...sinkFixture(), faucet: false } as SinkFixture);
    expect(sinkHasDefaultFaucet(savedDefault)).toBe(true);
    expect(everySinkHasFaucet([savedDefault])).toBe(true);
    // A later load does not stack a catalog faucet on top of it.
    expect(ensureMandatorySinkFaucets([savedDefault], [CATALOG_FAUCET]).attachedUids).toEqual([]);
  });

  it("prefers a verified single-hole kitchen faucet from the catalog", () => {
    expect(defaultAutoDesignFaucet([CATALOG_FAUCET])?.id).toBe(8203);
    expect(defaultAutoDesignFaucet([])).toBeNull();
  });
});

describe("the build path reports the faucet honestly", () => {
  it("sets everySinkHasFaucet on the build result", () => {
    const room = { ...DEFAULT_ROOM, width: 168, depth: 132, ceilingHeight: 96 };
    const result = build("540005", {}, room, [CATALOG_FAUCET]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.everySinkHasFaucet).toBe(true);
    expect(result.usedDefaultFaucet).toBe(false);
  });

  it("keeps the faucet in front of the sink window, and never moves the window", () => {
    // Owner clarification (Nov 5 2026): the faucet is at the sink, IN FRONT OF THE
    // WINDOW. The window position never moves. A sink under glazing is the normal
    // kitchen, so the faucet is required there — not omitted.
    const room = { ...DEFAULT_ROOM, width: 168, depth: 132, ceilingHeight: 96 };
    const result = build("540005", { sinkWindowCenter: { wallLabel: "Wall 1", centerOffsetIn: 30 } }, room, [CATALOG_FAUCET]);
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    const window = result.sinkWindow;
    if (window) {
      // The window the build made is exactly the geometry it asked for: untouched by
      // the faucet. No sill raise, no height shrink, no note.
      const created = result.openings.find((opening) => opening.uid === window.uid)!;
      expect(created.sill).toBe(window.sill);
      expect(created.height).toBe(window.height);
      expect(created.offset).toBe(window.offset);
      expect(created.width).toBe(window.width);
      expect(created.faucetClearanceNote).toBeFalsy();
      expect(result.faucetWindowNotes).toEqual([]);
      // The faucet stands in front of it, and is drawn.
      const sink = result.sinks[0]!;
      const placement = resolveDeckFaucetPlacement(sink, room, result.openings, []);
      expect(placement.inFrontOfWindow).toBe(true);
      expect(placement.renderFaucet).toBe(true);
    }
    expectFaucetAtSink(result, room, "with window");
  });

  it("keeps the window coordinates identical through a re-applied faucet pass", () => {
    // A second pass (the load path) must not touch the window either.
    const room = { ...DEFAULT_ROOM, width: 168, depth: 132, ceilingHeight: 96 };
    const result = build("540005", { sinkWindowCenter: { wallLabel: "Wall 1", centerOffsetIn: 30 } }, room, [CATALOG_FAUCET]);
    if (!result.ok) return;
    const again = raiseWindowsForDeckFaucet({ sinks: result.sinks, room, openings: result.openings });
    expect(again.openings).toEqual(result.openings);
    expect(again.notes).toEqual([]);
  });
});

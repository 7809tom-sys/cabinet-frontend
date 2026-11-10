import { describe, expect, it } from "vitest";
import {
  showerCatalogParts,
  showerCatalogRows,
  showerPartKind,
  type ShowerCatalogRow,
} from "@/components/shower/ShowerBuilderWizard";
import {
  SHOWER_STEPS,
  choosePart,
  offeredParts,
  showerCartLines,
  showerSizeFit,
  showerSubtotal,
  showerSurroundDecor,
  showerSurroundGroups,
  showerSurroundSize,
  skipStep,
  type ShowerSelection,
} from "./showerBuilder";
import { bayForWall, openingForSurround, placeShowerSurround } from "./showerPlacementAssembly";

/**
 * Regression for the production bug Tom hit on 2026-11-09.
 *
 * `pelican.byCategory({ category: "Shower & Bath" })` returns TWO lists. `suggested`
 * is a short "popular" teaser and on production it held six glass doors; `items`
 * held all 132 rows — every surround, pan, valve set, niche and soap tray. The
 * wizard read `suggested` first, so on the live site the glass door step was the
 * only one with a single card in it and the four steps before it said "Pelican has
 * no priced … right now". Tom could not choose a surround colour or any part.
 *
 * These tests use the live response shape, so a future refactor that starts reading
 * the teaser again fails here rather than in front of a customer.
 */

/** The six rows the live API puts in `suggested`, from the 2026-11-09 capture. */
const LIVE_SUGGESTED: ShowerCatalogRow[] = [
  { id: 9001, pelicanCode: "PL-03A42S60 MB", name: "PL-03A42S60 MB", description: "58-60 in. Double Sliding Frameless Shower Door in Matte Black", sellPrice: 1311, imageUrl: "x.jpg" },
  { id: 9002, pelicanCode: "PL-03A42S60 BN", name: "PL-03A42S60 BN", description: "58-60 in. Double Sliding Frameless Shower Door in Brushed Nickel", sellPrice: 1265 },
  { id: 9003, pelicanCode: "PL-03A42S60 CHR", name: "PL-03A42S60 CHR", description: "58-60 in. Double Sliding Frameless Shower Door in Chrome", sellPrice: 1237.4 },
  { id: 9004, pelicanCode: "PL-03A42T60 MB", name: "PL-03A42T60 MB", description: "58-60 in. Double Sliding Frameless Bath Tub Shower Door in Matte Black", sellPrice: 1191.4 },
  { id: 9005, pelicanCode: "PL-03A11S60 MB", name: "PL-03A11S60 MB", description: "58-60 in. Single Sliding Frameless Shower Door in Matte Black", sellPrice: 1191.4 },
  { id: 9006, pelicanCode: "PL-03A11S60 BN", name: "PL-03A11S60 BN", description: "58-60 in. Single Sliding Frameless Shower Door in Brushed Nickel", sellPrice: 1150 },
];

/** A representative slice of the live `items` list: all five part families. */
const LIVE_ITEMS: ShowerCatalogRow[] = [
  // 7 sizes x 4 décors — the real surround catalogue.
  { id: 100, pelicanCode: "PL-603096 Marble", name: "PL-603096 Marble", description: '60" x 30" x 96" Carrara Marble 3-Piece Glue Up Alcove Shower Surround', size: '60" x 30" x 96"', sellPrice: 1337.29, imageUrl: "surround-marble.jpg" },
  { id: 101, pelicanCode: "PL-603096 Grey Wood", name: "PL-603096 Grey Wood", description: '60" x 30" x 96" Grey Wood Grain 3-Piece Glue Up Alcove Shower Surround', size: '60" x 30" x 96"', sellPrice: 1273.53 },
  { id: 102, pelicanCode: "PL-603096 White Wood", name: "PL-603096 White Wood", description: '60" x 30" x 96" White Wood Grain 3-Piece Glue Up Alcove Shower Surround', size: '60" x 30" x 96"', sellPrice: 1120.42 },
  { id: 103, pelicanCode: "PL-603096 Brick", name: "PL-603096 Brick", description: '60" x 30" x 96" White Brick 3-Piece Glue Up Alcove Shower Surround', size: '60" x 30" x 96"', sellPrice: 1120.42 },
  { id: 104, pelicanCode: "PL-603074 Marble", name: "PL-603074 Marble", description: '60" x 30" x 74" Carrara Marble 3-Piece Glue Up Alcove Tub Surround', size: '60" x 30" x 74"', sellPrice: 1296.28 },
  { id: 105, pelicanCode: "PL-483696 Marble", name: "PL-483696 Marble", description: '48" x 36" x 96" Carrara Marble 3-Piece Glue Up Alcove Shower Surround', size: '48" x 36" x 96"', sellPrice: 1265 },
  // Pans.
  { id: 200, pelicanCode: "PL-SMC6036C", name: "PL-SMC6036C", description: '60" x 36" Acrylic White, Center Drain, Shower Base with Tile Flange', size: '60" x 36"', sellPrice: 420 },
  { id: 201, pelicanCode: "PL-013636CSO", name: "PL-013636CSO", description: '36" x 36" Acrylic White, Center Drain, Shower Base with Tile Flange', size: '36" x 36"', sellPrice: 333.5 },
  // Hydra valve/head systems.
  { id: 300, pelicanCode: "PL-86S22S CHR", name: "PL-86S22S CHR", description: "Hydra Pressure Balance Valve Shower Set in Chrome", sellPrice: 268.4 },
  { id: 301, pelicanCode: "PL-86S22S MB", name: "PL-86S22S MB", description: "Hydra Pressure Balance Valve Shower Set in Matte Black", sellPrice: 283.1 },
  // Niches and soap trays.
  { id: 400, pelicanCode: "PL-SN1614", name: "PL-SN1614", description: "SMC Shower Niche with 1 Shelf in Glossy White", sellPrice: 63.09 },
  { id: 401, pelicanCode: "PL-SD125 Side", name: "PL-SD125 Side", description: "SMC Soap Dish in Glossy White", sellPrice: 29.58 },
];

/** The live batch response shape: a batch array of superjson envelopes. */
const LIVE_RESPONSE = {
  items: LIVE_ITEMS,
  suggested: LIVE_SUGGESTED,
};

const EMPTY_ROOM = { width: 60, depth: 96, ceilingHeight: 96 } as const;

describe("production bug: the wizard read the teaser instead of the catalogue", () => {
  it("offers every catalogue row, not just the six suggested doors", () => {
    const rows = showerCatalogRows(LIVE_RESPONSE as never);
    expect(rows.length).toBe(LIVE_ITEMS.length + LIVE_SUGGESTED.length);
    // The teaser alone would only ever classify as doors.
    const teaserKinds = new Set(LIVE_SUGGESTED.map((row) => showerPartKind(row)));
    expect(Array.from(teaserKinds)).toEqual(["door"]);
  });

  it("gives all five steps something to choose, which the teaser could not", () => {
    const parts = showerCatalogParts(showerCatalogRows(LIVE_RESPONSE as never));
    const byStep = Object.fromEntries(
      SHOWER_STEPS.map((step) => [step.id, offeredParts(step.id, parts).parts.length]),
    );
    expect(byStep.surround).toBeGreaterThan(0);
    expect(byStep.pan).toBeGreaterThan(0);
    expect(byStep.heads).toBeGreaterThan(0);
    expect(byStep.niche).toBeGreaterThan(0); // niches + soap trays
    expect(byStep.door).toBeGreaterThan(0);
  });

  it("reproduces the empty steps when only `suggested` is returned", () => {
    // Guards the exact regression: reading the teaser leaves four steps empty.
    const teaserOnly = showerCatalogParts(LIVE_SUGGESTED);
    expect(offeredParts("surround", teaserOnly).parts).toHaveLength(0);
    expect(offeredParts("pan", teaserOnly).parts).toHaveLength(0);
    expect(offeredParts("heads", teaserOnly).parts).toHaveLength(0);
    expect(offeredParts("niche", teaserOnly).parts).toHaveLength(0);
    expect(offeredParts("door", teaserOnly).parts).toHaveLength(6);
  });

  it("de-duplicates a row that appears in both lists", () => {
    const dupe = { ...LIVE_SUGGESTED, items: [...LIVE_ITEMS, LIVE_SUGGESTED[0]!] };
    const rows = showerCatalogRows(dupe as never);
    const ids = rows.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("still works when an older backend returns only `items` or only `suggested`", () => {
    expect(showerCatalogRows({ items: LIVE_ITEMS } as never)).toHaveLength(LIVE_ITEMS.length);
    expect(showerCatalogRows({ suggested: LIVE_SUGGESTED } as never)).toHaveLength(LIVE_SUGGESTED.length);
    expect(showerCatalogRows(null)).toHaveLength(0);
  });
});

describe("surround is a finish choice, then a size", () => {
  const parts = showerCatalogParts(showerCatalogRows(LIVE_RESPONSE as never));

  it("groups the surrounds into the four décors Tom named", () => {
    const { groups } = showerSurroundGroups(parts);
    expect(groups.map((group) => group.decor.label)).toEqual([
      "Carrara Marble",
      "Grey Wood",
      "White Wood",
      "White Brick",
    ]);
  });

  it("offers the sizes for the chosen finish, with real SKUs and prices", () => {
    const { groups } = showerSurroundGroups(parts);
    const marble = groups.find((group) => group.decor.id === "marble")!;
    expect(marble.options.length).toBeGreaterThanOrEqual(3);
    for (const option of marble.options) {
      expect(option.part.code).toMatch(/^PL-/);
      expect(option.part.price).toBeGreaterThan(0);
      expect(option.size.widthIn).toBeGreaterThan(0);
    }
  });

  it("reads the décor and the three size numbers off the live row", () => {
    const marble = parts.find((part) => part.code === "PL-603096 Marble")!;
    expect(showerSurroundDecor(marble)).toBe("marble");
    expect(showerSurroundSize(marble)).toMatchObject({ widthIn: 60, depthIn: 30, heightIn: 96, tubHeight: false });
    const tubSet = parts.find((part) => part.code === "PL-603074 Marble")!;
    expect(showerSurroundSize(tubSet)).toMatchObject({ heightIn: 74, tubHeight: true });
  });

  it("marks a 60 inch set as fitting a 60 inch alcove and a 48 inch one as short", () => {
    expect(showerSizeFit({ label: "60", widthIn: 60, depthIn: 30, heightIn: 96, tubHeight: false }, 60)).toEqual({ ok: true, message: null });
    const short = showerSizeFit({ label: "48", widthIn: 48, depthIn: 36, heightIn: 96, tubHeight: false }, 60);
    expect(short.ok).toBe(false);
    expect(short.message).toContain("12");
  });
});

describe("choosing walls, parts and the cart from Tom's empty room", () => {
  const parts = showerCatalogParts(showerCatalogRows(LIVE_RESPONSE as never));
  const pick = (stepId: (typeof SHOWER_STEPS)[number]["id"], code: string) =>
    offeredParts(stepId, parts).parts.find((part) => part.code === code)!;

  it("puts the surround on the wall the shopper chose", () => {
    // The back, left and right walls must map to three different real walls. This
    // caught a bug where "left" landed on the right wall.
    const surround = pick("surround", "PL-603096 Marble");
    const back = bayForWall(EMPTY_ROOM, "top")!;
    const left = bayForWall(EMPTY_ROOM, "left")!;
    const right = bayForWall(EMPTY_ROOM, "right")!;
    expect(new Set([back.id, left.id, right.id]).size).toBe(3);
    for (const bay of [back, left, right]) {
      expect(placeShowerSurround(surround.code, bay)).not.toBeNull();
    }
  });

  it("builds the whole shower Tom asked for and bills exactly those parts", () => {
    let selection: ShowerSelection = {};
    const surround = pick("surround", "PL-603096 Marble");
    const pan = pick("pan", "PL-SMC6036C");
    const heads = pick("heads", "PL-86S22S CHR");
    const niche = pick("niche", "PL-SN1614");
    const door = pick("door", "PL-03A42S60 MB");

    selection = choosePart(selection, "surround", surround, "top");
    selection = choosePart(selection, "pan", pan, null);
    selection = choosePart(selection, "heads", heads, "left");
    selection = choosePart(selection, "niche", niche, "left");
    selection = choosePart(selection, "door", door, null);

    // The pan fits inside the opening the surround defines.
    const placedSurround = placeShowerSurround(surround.code, bayForWall(EMPTY_ROOM, "top")!)!;
    const opening = openingForSurround(placedSurround, EMPTY_ROOM)!;
    expect(opening.insideWidthIn).toBeCloseTo(60, 1);

    const lines = showerCartLines(selection);
    expect(lines.map((line) => line.masterCode)).toEqual([
      `PEL-${surround.id}`,
      `PEL-${pan.id}`,
      `PEL-${heads.id}`,
      `PEL-${niche.id}`,
      `PEL-${door.id}`,
    ]);
    // One line per placed part, quantity one: the drawing and the bill agree.
    expect(lines.every((line) => line.qty === 1)).toBe(true);
    const expected = surround.price + pan.price + heads.price + niche.price + door.price;
    expect(showerSubtotal(selection)).toBeCloseTo(expected, 2);
  });

  it("lets a shopper skip any step, including the pan", () => {
    let selection: ShowerSelection = choosePart({}, "surround", pick("surround", "PL-603096 Marble"), "top");
    selection = skipStep(selection, "pan");
    selection = skipStep(selection, "heads");
    selection = choosePart(selection, "door", pick("door", "PL-03A42S60 MB"), null);
    expect(selection.pan?.part).toBeNull();
    // Only the chosen surround and door bill; the skipped steps add nothing.
    expect(showerCartLines(selection)).toHaveLength(2);
  });

  it("offers the niche and soap tray in the same step, so both are choosable", () => {
    const nicheStep = offeredParts("niche", parts).parts;
    expect(nicheStep.some((part) => part.kind === "niche")).toBe(true);
    expect(nicheStep.some((part) => part.kind === "soap")).toBe(true);
  });
});

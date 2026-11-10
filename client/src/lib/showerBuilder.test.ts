import { describe, expect, it } from "vitest";
import {
  SHOWER_STEPS,
  SHOWER_WALLS,
  choosePart,
  defaultWallForStep,
  offeredParts,
  showerCartLines,
  showerPlacementIssues,
  showerSubtotal,
  skipStep,
  unansweredSteps,
  type ShowerCatalogPart,
} from "./showerBuilder";

/**
 * A slice of the live Pelican shower catalog, copied from
 * `pelican.byCategory("Shower & Bath")`. These are real SKUs with their real
 * catalogue prices, so the tests assert against inventory rather than fixtures we
 * invented for the test.
 */
const CATALOG: ShowerCatalogPart[] = [
  { code: "PL-603074 Brick", id: 687, name: '60" x 30" x 74" White Brick 3-Piece Alcove Tub Surround', price: 882.28, kind: "surround" },
  { code: "PL-603696 Marble", id: 693, name: '60" x 36" x 96" Carrara Marble 3-Piece Alcove Shower Wall Kit', price: 1337.29, kind: "surround" },
  { code: "PL-013636CSO", id: 438, name: '36" x 36" Shower Base with Tile Flange', price: 333.5, kind: "pan" },
  { code: "PL-016036C", id: 460, name: '60" x 36" Rectangular Acrylic Shower Base', price: 510.6, kind: "pan" },
  { code: "PL-86S22S BN", id: 560, name: "Solace Pressure Balance Valve Shower Set", price: 179.52, kind: "system" },
  { code: "PL-86A33S BN", id: 566, name: "Aura 2-Handle Pressure Balance Valve Shower Set", price: 475.87, kind: "system" },
  { code: "PL-SN1614", id: 610, name: "SMC Shower Niche with 1 Shelf", price: 63.09, kind: "niche" },
  { code: "PL-SN1639", id: 612, name: "SMC Shower Niche with 3 Shelves", price: 138, kind: "niche" },
  { code: "PL-SD88 Corner", id: 620, name: "SMC Corner Soap Dish", price: 29.58, kind: "soap" },
  { code: "PL-03B71SSO BN", id: 535, name: '60" x 76" Framed Single Sliding Shower Door', price: 598, kind: "door" },
  { code: "PL-03A42S60 MB", id: 540, name: '58-60 in. Double Sliding Frameless Shower Door', price: 1311, kind: "door" },
];

const part = (code: string) => CATALOG.find((candidate) => candidate.code === code)!;

describe("every step is optional and offers a real, priced product", () => {
  it("has five steps, every one skippable", () => {
    expect(SHOWER_STEPS.map((step) => step.id)).toEqual(["surround", "pan", "heads", "niche", "door"]);
    for (const step of SHOWER_STEPS) expect(step.optional).toBe(true);
  });

  it("offers only priced catalog rows in each step", () => {
    for (const step of SHOWER_STEPS) {
      const { parts, droppedUnpriced } = offeredParts(step.id, CATALOG);
      expect(parts.length, `${step.id} offers nothing`).toBeGreaterThan(0);
      expect(droppedUnpriced).toBe(0);
      for (const p of parts) expect(Number.isFinite(p.price) && p.price > 0).toBe(true);
    }
  });

  it("never invents a product: an unpriced row is dropped and reported", () => {
    const withUnpriced = [...CATALOG, { code: "PL-0000", id: 1, name: "Placeholder pan", price: Number.NaN, kind: "pan" as const }];
    const { parts, droppedUnpriced } = offeredParts("pan", withUnpriced);
    expect(droppedUnpriced).toBe(1);
    expect(parts.some((p) => p.code === "PL-0000")).toBe(false);
  });

  it("drops a row that has a price field but no SKU", () => {
    const noCode = [...CATALOG, { code: "  ", id: 2, name: "Nameless", price: 10, kind: "pan" as const }];
    expect(offeredParts("pan", noCode).parts.some((p) => p.name === "Nameless")).toBe(false);
  });

  it("can skip every step and still be a valid, empty selection", () => {
    let selection = {};
    for (const step of SHOWER_STEPS) selection = skipStep(selection, step.id);
    expect(unansweredSteps(selection)).toEqual([]);
    expect(showerCartLines(selection)).toEqual([]);
    expect(showerSubtotal(selection)).toBe(0);
  });
});

describe("each step carries its own wall", () => {
  it("offers back and both side walls", () => {
    expect(SHOWER_WALLS).toEqual(["top", "left", "right"]);
  });

  it("defaults to the surround's back wall but accepts any wall per step", () => {
    let selection = choosePart({}, "surround", part("PL-603074 Brick"), "top");
    // Heads default to the surround's wall...
    expect(defaultWallForStep("heads", selection)).toBe("top");
    // ...but the shopper can put them on the left wall instead.
    selection = choosePart(selection, "heads", part("PL-86S22S BN"), "left");
    expect(selection.heads?.wall).toBe("left");
    // ...and the niche on the right, independently.
    selection = choosePart(selection, "niche", part("PL-SN1614"), "right");
    expect(selection.niche?.wall).toBe("right");
    // The surround itself is unchanged: each step owns its own wall.
    expect(selection.surround?.wall).toBe("top");
  });

  it("does not push the niche onto the surround's wall", () => {
    const selection = choosePart(
      choosePart({}, "surround", part("PL-603074 Brick"), "right"),
      "niche",
      part("PL-SN1639"),
      "left",
    );
    expect(selection.surround?.wall).toBe("right");
    expect(selection.niche?.wall).toBe("left");
  });

  it("gives a pan and a door no wall, because they are not wall-mounted", () => {
    let selection = choosePart({}, "pan", part("PL-016036C"), "left");
    expect(selection.pan?.wall).toBeNull();
    selection = choosePart(selection, "door", part("PL-03B71SSO BN"), "right");
    expect(selection.door?.wall).toBeNull();
  });

  it("falls back to the back wall when the surround was skipped", () => {
    expect(defaultWallForStep("heads", skipStep({}, "surround"))).toBe("top");
    expect(defaultWallForStep("niche", {})).toBe("top");
  });
});

describe("a partial shower still makes sense", () => {
  it("warns that a door with no panels is mounted on the curb line only", () => {
    const selection = choosePart(
      choosePart({}, "pan", part("PL-016036C")),
      "door",
      part("PL-03A42S60 MB"),
    );
    const issues = showerPlacementIssues(selection);
    expect(issues.some((issue) => issue.stepId === "door")).toBe(true);
  });

  it("warns louder when a door has neither pan nor panels", () => {
    const issues = showerPlacementIssues(choosePart({}, "door", part("PL-03A42S60 MB")));
    expect(issues.some((issue) => /no pan or surround/.test(issue.message))).toBe(true);
  });

  it("warns when wall panels have no pan under them", () => {
    const issues = showerPlacementIssues(choosePart({}, "surround", part("PL-603074 Brick")));
    expect(issues.some((issue) => issue.stepId === "pan")).toBe(true);
  });

  it("warns when a tap or niche has no wall panel to mount on", () => {
    // The wall is now REQUIRED for these two steps: they mount on a chosen panel of
    // the shower, and there is no default (a default is what put the valve on the
    // room wall outside the enclosure). Placing without a wall is refused outright.
    expect(() => choosePart({}, "heads", part("PL-86S22S BN"))).toThrow(/needs a chosen shower wall/i);
    expect(() => choosePart({}, "niche", part("PL-SN1614"))).toThrow(/needs a chosen shower wall/i);

    // With a panel chosen, the placement warning is about the missing SURROUND,
    // which is still a real thing to tell the shopper.
    const heads = showerPlacementIssues(choosePart({}, "heads", part("PL-86S22S BN"), "back"));
    expect(heads.some((issue) => issue.stepId === "heads")).toBe(true);
    const niche = showerPlacementIssues(choosePart({}, "niche", part("PL-SN1614"), "left"));
    expect(niche.some((issue) => issue.stepId === "niche")).toBe(true);
  });

  it("is clean once pan, panels and fittings are all in", () => {
    let selection = choosePart({}, "surround", part("PL-603074 Brick"), "top");
    selection = choosePart(selection, "pan", part("PL-016036C"));
    selection = choosePart(selection, "heads", part("PL-86S22S BN"), "left");
    selection = choosePart(selection, "niche", part("PL-SN1614"), "left");
    selection = choosePart(selection, "door", part("PL-03B71SSO BN"));
    expect(showerPlacementIssues(selection)).toEqual([]);
  });
});

describe("the cart carries each chosen part at its own real price", () => {
  it("makes one line per part, price from the catalog row", () => {
    let selection = choosePart({}, "surround", part("PL-603074 Brick"), "top");
    selection = choosePart(selection, "pan", part("PL-016036C"));
    selection = choosePart(selection, "heads", part("PL-86A33S BN"), "left");
    selection = choosePart(selection, "niche", part("PL-SN1639"), "right");
    selection = choosePart(selection, "door", part("PL-03A42S60 MB"));

    const lines = showerCartLines(selection);
    expect(lines).toHaveLength(5);
    expect(lines.map((line) => line.masterCode)).toEqual([
      "PEL-687", "PEL-460", "PEL-566", "PEL-612", "PEL-540",
    ]);
    expect(lines.map((line) => line.unitPrice)).toEqual([882.28, 510.6, 475.87, 138, 1311]);
    for (const line of lines) expect(line.qty).toBe(1);
    expect(showerSubtotal(selection)).toBeCloseTo(882.28 + 510.6 + 475.87 + 138 + 1311, 2);
  });

  it("prices a finish variant by its own row, not a shared model price", () => {
    const brushed = showerCartLines(choosePart({}, "heads", part("PL-86S22S BN"), "back"));
    expect(brushed[0]!.unitPrice).toBe(179.52);
    const fancier = showerCartLines(choosePart({}, "heads", part("PL-86A33S BN"), "back"));
    expect(fancier[0]!.unitPrice).toBe(475.87);
  });

  it("omits a skipped step entirely", () => {
    let selection = choosePart({}, "pan", part("PL-013636CSO"));
    selection = skipStep(selection, "surround");
    const lines = showerCartLines(selection);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.masterCode).toBe("PEL-438");
  });

  it("refuses to price a part that has no catalogue price", () => {
    expect(() =>
      choosePart({}, "pan", { code: "PL-X", id: 9, name: "x", price: Number.NaN, kind: "pan" }),
    ).toThrow(/no catalog price/);
  });

  it("refuses a part that belongs to a different step", () => {
    expect(() => choosePart({}, "pan", part("PL-603074 Brick"))).toThrow(/does not offer/);
  });
});

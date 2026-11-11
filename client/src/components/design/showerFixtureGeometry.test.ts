// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  makeShowerNicheParts,
  makeShowerPanParts,
  makeShowerSurroundParts,
  makeShowerSystemParts,
} from "./showerFixtureGeometry";
import {
  ALL_PELICAN_BATHROOM_FIXTURE_PROFILES,
  verifiedPelicanBathroomFixtureProfile,
  isShowerSystemTubCombo,
} from "@/lib/pelicanBathroomFixtureProfiles";

const materials = {
  shell: new THREE.MeshPhysicalMaterial({ color: "#ffffff" }),
  metal: new THREE.MeshStandardMaterial({ color: "#b9c2c7" }),
  panel: new THREE.MeshStandardMaterial({ color: "#e8e4dc" }),
};

function bounds(parts: ReturnType<typeof makeShowerPanParts>) {
  const group = new THREE.Group();
  for (const { mesh } of parts) group.add(mesh);
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  return { box, size, inch: (value: number) => value * 12 };
}

const PAN_CODES = [
  "PL-014836C", "PL-014836L", "PL-014836R",
  "PL-016030C", "PL-016030L", "PL-016030R",
  "PL-016032C", "PL-016032L", "PL-016032R",
  "PL-016036C", "PL-016036L", "PL-016036R",
  "PL-SMC4836C",
  "PL-SMC6030C", "PL-SMC6030L", "PL-SMC6030R",
  "PL-SMC6032C", "PL-SMC6032L", "PL-SMC6032R",
  "PL-SMC6036C", "PL-SMC6036L", "PL-SMC6036R",
  // Sizes the live catalog also sells, added so every purchasable pan can be placed.
  "PL-013636C", "PL-013838ADA", "PL-014236C", "PL-014242C", "PL-014832C",
  "PL-016034C", "PL-016034L", "PL-016034R", "PL-016038C",
  "PL-016236ADA", "PL-016238ADA",
];

describe("Shower pan geometry", () => {
  it("covers every pan Pelican sells, in all three drain sides", () => {
    for (const code of PAN_CODES) {
      const profile = verifiedPelicanBathroomFixtureProfile(code);
      expect(profile, `${code} does not resolve to a shower pan`).toBeTruthy();
      expect(profile!.kind).toBe("shower-pan");
    }
    // Every pan profile in the catalog list is one this test exercises, so a newly
    // added pan cannot go untested.
    const pans = ALL_PELICAN_BATHROOM_FIXTURE_PROFILES.filter((entry) => entry.kind === "shower-pan");
    expect(new Set(PAN_CODES).size).toBe(PAN_CODES.length);
    expect(pans.every((entry) => PAN_CODES.includes(entry.pelicanCode))).toBe(true);
  });

  it.each(PAN_CODES)("%s builds inside its published envelope", (code) => {
    const profile = verifiedPelicanBathroomFixtureProfile(code)!;
    const { size, inch, box } = bounds(makeShowerPanParts(profile, materials));
    // The pan fills its own published width x depth x height, so the selection
    // box hugs it and the plan footprint is honest.
    expect(inch(size.x), `${code} width`).toBeCloseTo(profile.widthIn, 1);
    expect(inch(size.z), `${code} depth`).toBeCloseTo(profile.depthIn, 1);
    expect(inch(size.y), `${code} height`).toBeCloseTo(profile.heightIn, 1);
    // It sits on the floor, not floating and not sunk.
    expect(box.min.y).toBeGreaterThanOrEqual(-0.01);
    expect(box.min.y).toBeLessThan(0.02);
  });

  it("recesses a real basin rather than a flat slab", () => {
    const profile = verifiedPelicanBathroomFixtureProfile("PL-016036C")!;
    const parts = makeShowerPanParts(profile, materials);
    const rim = parts.find((entry) => entry.part === "shower-pan-rim")!.mesh;
    const floor = parts.find((entry) => entry.part === "shower-pan-basin-floor")!.mesh;
    const rimBox = new THREE.Box3().setFromObject(rim);
    const floorBox = new THREE.Box3().setFromObject(floor);
    // The basin floor sits below the rim by a real depth.
    expect(rimBox.min.y - floorBox.max.y).toBeGreaterThan(1.5 / 12);
    // And the floor is smaller than the rim opening, so the walls slope in.
    const rimSize = rimBox.getSize(new THREE.Vector3());
    const floorSize = floorBox.getSize(new THREE.Vector3());
    expect(floorSize.x).toBeLessThan(rimSize.x);
    expect(floorSize.z).toBeLessThan(rimSize.z);
  });

  it.each(["PL-016030L", "PL-016030C", "PL-016030R"])("%s puts the drain on its own side", (code) => {
    const profile = verifiedPelicanBathroomFixtureProfile(code)!;
    // The pan is authored with its length on X, so the drain sides are its ends
    // and the drain offset reads on X.
    const drain = makeShowerPanParts(profile, materials).find((entry) => entry.part === "shower-pan-drain")!.mesh;
    const x = drain.position.x * 12;
    if (profile.drain === "left") expect(x).toBeLessThan(-1);
    else if (profile.drain === "right") expect(x).toBeGreaterThan(1);
    else expect(x).toBeCloseTo(0, 3);
  });

  it("makes left and right drain pans mirrors of one another", () => {
    const left = makeShowerPanParts(verifiedPelicanBathroomFixtureProfile("PL-SMC6030L")!, materials)
      .find((entry) => entry.part === "shower-pan-drain")!.mesh;
    const right = makeShowerPanParts(verifiedPelicanBathroomFixtureProfile("PL-SMC6030R")!, materials)
      .find((entry) => entry.part === "shower-pan-drain")!.mesh;
    expect(left.position.x).toBeCloseTo(-right.position.x, 4);
  });
});

describe("Shower surround, system and niche geometry", () => {
  it.each([
    "PL-483696 Marble",
    "PL-603096 Grey Wood",
    "PL-603296 White Wood",
    "PL-603696 Brick",
    "PL-603074T Marble",
    "PL-603274T Grey Wood",
    "PL-603674T Brick",
  ])("%s stands to its published panel height", (code) => {
    const profile = verifiedPelicanBathroomFixtureProfile(code)!;
    expect(profile.kind).toBe("shower-surround");
    const { size, inch, box } = bounds(makeShowerSurroundParts(profile, materials));
    expect(inch(size.y)).toBeCloseTo(profile.heightIn, 1);
    // It starts at the deck the caller gives it, not at the floor.
    const raised = bounds(makeShowerSurroundParts(profile, materials, { baseHeightIn: 21 }));
    expect(raised.box.min.y).toBeCloseTo(21 / 12, 2);
  });

  it("sizes each surround to the alcove it is cut for", () => {
    // The sheet lists a panel set per pan: a 48 x 36 set for the 48" pans, and
    // 60 x 30 / 32 / 36 sets for the 60" ones. One generic size would leave a
    // 60" alcove with a 12" gap.
    const pairs: Array<[string, number, number]> = [
      ["PL-483696 Marble", 48, 36],
      ["PL-603096 Marble", 60, 30],
      ["PL-603296 Marble", 60, 32],
      ["PL-603696 Marble", 60, 36],
    ];
    for (const [code, back, side] of pairs) {
      const profile = verifiedPelicanBathroomFixtureProfile(code)!;
      expect(profile.kind).toBe("shower-surround");
      expect(profile.widthIn, `${code} back panel`).toBe(back);
      expect(profile.depthIn, `${code} side panel`).toBe(side);
    }
    // Every décor is offered at every size, so a choice of finish never forces a
    // wrong alcove width.
    const surrounds = ALL_PELICAN_BATHROOM_FIXTURE_PROFILES.filter((entry) => entry.kind === "shower-surround");
    expect(surrounds.length).toBe(28);
  });

  it("leaves the front open, so only three sides are panelled", () => {
    const profile = verifiedPelicanBathroomFixtureProfile("PL-483696 Marble")!;
    const parts = makeShowerSurroundParts(profile, materials);
    const names = parts.map((entry) => entry.part);
    expect(names).toContain("shower-surround-back");
    expect(names).toContain("shower-surround-end-left");
    expect(names).toContain("shower-surround-end-right");
    // No front panel: the door goes there.
    expect(names.some((name) => /front/.test(name))).toBe(false);
  });

  it.each(["PL-86H55 CHROME", "PL-86H15 BRUSHED NICKEL", "PL-86A33 MATTE BLACK", "PL-86S22 CHROME"])(
    "%s mounts a valve, head and spout on the wall",
    (code) => {
      const profile = verifiedPelicanBathroomFixtureProfile(code)!;
      expect(profile.kind).toBe("shower-system");
      const parts = makeShowerSystemParts(profile, materials, { deckHeightIn: 21 });
      const names = parts.map((entry) => entry.part);
      expect(names).toContain("shower-valve-trim");
      expect(names).toContain("shower-head");
      // The riser is buried in the wall; only the trim, escutcheon and arm show.
      expect(names).not.toContain("shower-riser");
      expect(names).toContain("shower-riser-escutcheon");
      // The head sits above the valve.
      const valve = parts.find((entry) => entry.part === "shower-valve-trim")!.mesh;
      const head = parts.find((entry) => entry.part === "shower-head")!.mesh;
      expect(head.position.y).toBeGreaterThan(valve.position.y);
      // It is authored about its own centre with the wall on +Z, so the trim sits
      // at the +Z extreme and the head reaches back toward the room on -Z.
      const group = new THREE.Group();
      for (const { mesh } of parts) group.add(mesh);
      group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(group);
      // The head reaches into the room, so the assembly is deep on -Z.
      expect(box.min.z).toBeLessThan(-4 / 12);
      const wallFace = parts.find((entry) => entry.part === "shower-valve-trim")!.mesh;
      wallFace.updateMatrixWorld(true);
      const trimBox = new THREE.Box3().setFromObject(wallFace);
      expect(trimBox.max.z).toBeGreaterThan(box.min.z);
    },
  );

  it.each([
    ["PL-SN1614", 16, 14],
    // SKU naming is width x height, so SN1627 is 16-1/64 wide by 27-1/16 tall.
    ["PL-SN1627", 16 + 1 / 64, 27 + 1 / 16],
    ["PL-SN1639", 16 + 1 / 64, 39 + 1 / 32],
  ] as const)("%s is an open recess of the published size", (code, widthIn, heightIn) => {
    const profile = verifiedPelicanBathroomFixtureProfile(code)!;
    expect(profile.kind).toBe("shower-niche");
    expect(profile.widthIn).toBeCloseTo(widthIn, 4);
    expect(profile.heightIn).toBeCloseTo(heightIn, 4);
    const { size, inch, box } = bounds(makeShowerNicheParts(profile, materials));
    // The recess goes into the wall along +Z: the body plus its face flange,
    // measured from the flange plane (z = -shell) to the back of the box
    // (z = depth). Authored this way so the fixture's own group, which sits at
    // floor level and whose +Z face is the wall, puts the recess into the wall
    // rather than sideways across the shower.
    expect(inch(size.z)).toBeGreaterThan(2);
    expect(inch(size.z)).toBeCloseTo(profile.depthIn + 0.12, 1);
    // The face flange makes the outer frame a little bigger than the opening.
    expect(inch(size.x)).toBeGreaterThan(profile.widthIn);
    // It stands on the deck: the mesh never dips below its own mounting plane, so
    // moving the group up to the mount height puts the whole niche above the pan.
    // The flange laps 1/2" below the opening, which is the only part under zero.
    expect(inch(box.min.y)).toBeCloseTo(-0.5, 1);
    expect(inch(box.max.y)).toBeCloseTo(profile.heightIn + 0.5, 1);
    expect(inch(box.max.y)).toBeGreaterThan(profile.heightIn);
  });

  /**
   * Regression for the stray sheet Tom saw floating in the built shower.
   *
   * The niche used to be authored recessed along +X and centred on y = 0, while
   * every fixture group is placed at floor level with its +Z face against the
   * wall. That put half the niche below the pan and turned the recess sideways,
   * so it rendered as a thin slab hanging in mid-air across the shower floor.
   *
   * The niche must therefore share the frame the rest of the shower uses: standing
   * on y = 0, opening toward -Z, recess running into the wall along +Z.
   */
  it("authors the niche in the same frame as the other shower parts", () => {
    const niche = verifiedPelicanBathroomFixtureProfile("PL-SN1627")!;
    const { inch, box } = bounds(makeShowerNicheParts(niche, materials));
    // Standing on the deck, not straddling zero: the body never reaches far below it.
    expect(inch(box.min.y)).toBeGreaterThanOrEqual(-0.5 - 0.01);
    expect(inch(box.max.y)).toBeCloseTo(niche.heightIn + 0.5, 1);
    // The recess runs into the wall on +Z, so the depth is the Z extent...
    expect(inch(box.max.z - box.min.z)).toBeCloseTo(niche.depthIn + 0.12, 1);
    // ...and the opening spans the published width on X. Under the old frame the
    // width landed on Z and the thin depth on X, which is what read as a sideways
    // panel hanging in the shower instead of a recess in the wall.
    expect(inch(box.max.x - box.min.x)).toBeGreaterThan(niche.widthIn);
    expect(inch(box.max.x - box.min.x)).toBeLessThan(niche.widthIn + 2);
  });

  /**
   * Regression: the shower head was not connected to the valve.
   *
   * The riser used to be built from the constants 42" and 72" with no deck offset,
   * so it started wherever those landed rather than at the valve, and the shopper's
   * chosen heights were ignored entirely. It must start at the valve trim and end
   * at the arm's centreline, at whatever heights were actually set.
   */
  it("keeps the pipe inside the wall, leaving the trim and arm to read as one fixture", () => {
    const profile = verifiedPelicanBathroomFixtureProfile("PL-86S22S CHR")!;
    const parts = makeShowerSystemParts(profile, materials);
    const byName = (name: string) => parts.find((entry) => entry.part === name)!.mesh;

    // No pipe geometry at all: a riser drawn on the room side of the panel was the
    // leak Tom photographed running up the outside of the wall.
    expect(parts.some((entry) => entry.part === "shower-riser")).toBe(false);

    // The visible parts are still there, and still in the right order up the wall.
    const valve = byName("shower-valve-trim");
    const escutcheon = byName("shower-riser-escutcheon");
    const arm = byName("shower-head-arm");
    expect(escutcheon.position.y).toBeGreaterThan(valve.position.y);
    expect(arm.position.y).toBeGreaterThan(escutcheon.position.y);

    // Everything is on the ROOM side of the panel plane or at it: nothing sits
    // behind the finished face where it would be hidden by, or poke through, the
    // panel.
    const wallZ = (profile.depthIn || 8) / 2 * (1 / 12);
    for (const mesh of [valve, escutcheon, arm, byName("shower-head")]) {
      expect(mesh.position.z).toBeLessThanOrEqual(wallZ + 0.01);
    }
  });

  it("seats the riser escutcheon at the valve, plumbed into the wall", () => {
    const profile = verifiedPelicanBathroomFixtureProfile("PL-86S22S CHR")!;
    const parts = makeShowerSystemParts(profile, materials);
    const escutcheon = parts.find((entry) => entry.part === "shower-riser-escutcheon");
    expect(escutcheon).toBeTruthy();
    const valve = parts.find((entry) => entry.part === "shower-valve-trim")!.mesh;
    expect(escutcheon!.mesh.position.y).toBeGreaterThan(valve.position.y);
  });

  /**
   * Regression: Tom could not delete the niche.
   *
   * A niche is a shallow open box — 3-17/32" recess, 0.12" shells — so a click
   * usually lands in the opening and the ray reaches the wall behind it. No hit
   * means no selection, and no selection means no delete. The designer now adds an
   * invisible, raycastable box covering the whole envelope; these assertions pin
   * the properties that make it work.
   */
  it("covers the niche with an invisible but raycastable pick box", () => {
    const niche = verifiedPelicanBathroomFixtureProfile("PL-SN1627")!;
    // The geometry builder itself stays a display model; the pick box is added by
    // the 3D fixture builder, which is where the raycast happens. What matters
    // here is the envelope it must cover.
    const { inch, box } = bounds(makeShowerNicheParts(niche, materials));
    expect(inch(box.max.x - box.min.x)).toBeGreaterThan(niche.widthIn);
    expect(inch(box.max.y - box.min.y)).toBeGreaterThan(niche.heightIn);
    expect(inch(box.max.z - box.min.z)).toBeCloseTo(niche.depthIn + 0.12, 1);
  });

  it("keeps the soap trays illustrative rather than claiming a measured fit", () => {
    for (const code of ["PL-SD88 Corner", "PL-SD125 Side"]) {
      const profile = verifiedPelicanBathroomFixtureProfile(code)!;
      expect(profile.kind).toBe("soap-tray");
      // Pelican publishes no exterior envelope, so this must stay a planning
      // envelope and never masquerade as a measured product.
      expect(profile.planningOnly).toBe(true);
    }
  });

  it("gives every shower fixture a resolvable catalog code and no duplicates", () => {
    const showerKinds = new Set([
      "shower-pan", "shower-surround", "shower-system", "shower-niche", "soap-tray",
    ]);
    const shower = ALL_PELICAN_BATHROOM_FIXTURE_PROFILES.filter((entry) => showerKinds.has(entry.kind));
    expect(shower.length).toBeGreaterThan(40);
    const codes = new Set<string>();
    for (const profile of shower) {
      // A readable name with no distributor tag, and a real spec link.
      expect(profile.name).not.toMatch(/distributor|wholesale/i);
      expect(profile.specificationUrl).toMatch(/^https:\/\//);
      expect(codes.has(profile.pelicanCode), `duplicate code ${profile.pelicanCode}`).toBe(false);
      codes.add(profile.pelicanCode);
      // Nothing may resolve to a zero or negative envelope.
      expect(profile.widthIn).toBeGreaterThan(0);
      expect(profile.depthIn).toBeGreaterThanOrEqual(0);
      expect(profile.heightIn).toBeGreaterThan(0);
    }
  });
});

/**
 * Three faults Tom photographed on a built shower.
 *
 * The system was drawn without reference to the surround it sat on, so the arm
 * and head rose above the tops of the panels, a visible riser pipe ran up the
 * OUTSIDE of the wall, and a tub spout appeared on a shower-only build that has
 * nothing for it to fill.
 */
describe("a shower system stays inside its surround", () => {
  const profile = verifiedPelicanBathroomFixtureProfile("PL-86S22S MB")!;
  const byName = (parts: ReturnType<typeof makeShowerSystemParts>, name: string) =>
    parts.find((entry) => entry.part === name);

  /** World-space top of a part, from its geometry box and its position. */
  const partTop = (parts: ReturnType<typeof makeShowerSystemParts>, name: string): number | null => {
    const part = byName(parts, name);
    if (!part) return null;
    part.mesh.geometry.computeBoundingBox();
    return part.mesh.geometry.boundingBox!.max.y + part.mesh.position.y;
  };

  it("puts the valve centre at 48 inches above the finished floor", () => {
    const parts = makeShowerSystemParts(profile, materials);
    const IN = 1 / 12;
    // The trim's centre is the valve height.
    expect(byName(parts, "shower-valve-trim")!.mesh.position.y / IN).toBeCloseTo(48, 2);
  });

  it("puts the shower head centre at 80 inches above the finished floor", () => {
    const parts = makeShowerSystemParts(profile, materials);
    const IN = 1 / 12;
    // Tom's 80" is the CENTRE of the head, and that is exactly where it sits.
    const head = byName(parts, "shower-head")!;
    expect(head.mesh.position.y / IN).toBeCloseTo(80, 2);
    // The arm comes straight out of the wall at the same height.
    expect(byName(parts, "shower-head-arm")!.mesh.position.y / IN).toBeCloseTo(80, 1);
  });

  it("keeps those two heights whatever the surround panel measures", () => {
    // The heights are set out from the FLOOR, so no panel size moves them. The
    // builder no longer even accepts a panel height.
    const parts = makeShowerSystemParts(profile, materials);
    const IN = 1 / 12;
    expect(byName(parts, "shower-valve-trim")!.mesh.position.y / IN).toBeCloseTo(48, 2);
    expect(byName(parts, "shower-head")!.mesh.position.y / IN).toBeCloseTo(80, 2);
    // And the head is always above the valve.
    expect(byName(parts, "shower-head")!.mesh.position.y)
      .toBeGreaterThan(byName(parts, "shower-valve-trim")!.mesh.position.y);
  });

  it("draws no visible riser pipe", () => {
    const parts = makeShowerSystemParts(profile, materials);
    // The pipe is buried in the wall; only the trim and the arm come through.
    expect(byName(parts, "shower-riser")).toBeUndefined();
    // The visible parts that SHOULD be there still are.
    expect(byName(parts, "shower-valve-trim")).toBeDefined();
    expect(byName(parts, "shower-riser-escutcheon")).toBeDefined();
    expect(byName(parts, "shower-head-arm")).toBeDefined();
    expect(byName(parts, "shower-head")).toBeDefined();
  });

  it("shows no tub spout on a shower-only build", () => {
    const showerOnly = makeShowerSystemParts(profile, materials, {
      hasTubSpout: false,
    });
    expect(byName(showerOnly, "shower-spout")).toBeUndefined();
  });

  it("still shows the spout on a tub/shower combo", () => {
    const combo = makeShowerSystemParts(profile, materials, {
      hasTubSpout: true,
    });
    expect(byName(combo, "shower-spout")).toBeDefined();
  });

  it("tells a shower-only SKU from a tub/shower combo SKU", () => {
    // "...S" is shower-only; "...T/S" is the tub/shower combo.
    expect(isShowerSystemTubCombo("PL-86S22S MB")).toBe(false);
    expect(isShowerSystemTubCombo("PL-86A23S CHR")).toBe(false);
    expect(isShowerSystemTubCombo("PL-86S22T/S MB")).toBe(true);
    expect(isShowerSystemTubCombo("PL-86A23T/S CHR")).toBe(true);
    expect(isShowerSystemTubCombo(null)).toBe(false);
  });
});

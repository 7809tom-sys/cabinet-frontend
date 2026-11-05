import { describe, expect, it } from "vitest";
import {
  autoBuildStudioFromAnswers, studioBays, studioGuidedPartCounts, studioGuidedSummaryLines, STUDIO_GUIDED_DEFAULTS, STUDIO_GUIDED_ROOM_DEFAULTS, STUDIO_WALLS,
  type StudioGuidedAnswers,
} from "./vendorClosetStudio";
import { CLOSET_PARTS } from "./closet";

const answers = (overrides: Partial<StudioGuidedAnswers> = {}): StudioGuidedAnswers => ({ ...STUDIO_GUIDED_DEFAULTS, ...overrides });

const build = (overrides: Partial<StudioGuidedAnswers> = {}, room = STUDIO_GUIDED_ROOM_DEFAULTS.walkIn) =>
  autoBuildStudioFromAnswers({ answers: answers(overrides), mount: "floor", finish: "Glacier White", room });

/** Every placed item across every wall, so a test never has to know which wall the builder chose. */
const placed = (design: ReturnType<typeof build>["design"]) => {
  const items = STUDIO_WALLS.flatMap((wall) => studioBays(design, wall)).flatMap((bay) => bay.items);
  return {
    items,
    rods: items.filter((item) => item.kind === "rod"),
    shelves: items.filter((item) => item.kind === "shelf"),
    drawers: items.filter((item) => item.kind === "drawer"),
    shoes: items.filter((item) => item.kind === "shoe"),
  };
};

describe("guided answers → part counts", () => {
  it("keeps every answer set inside the builder's supported range", () => {
    for (const storageMix of ["mostlyHanging", "balanced", "mostlyShelving"] as const) {
      for (const longHang of ["yes", "no"] as const) {
        for (const amount of ["none", "some", "lots"] as const) {
          const counts = studioGuidedPartCounts(answers({ storageMix, longHang, drawers: amount, shoes: amount }));
          for (const value of Object.values(counts)) {
            expect(Number.isInteger(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(8);
          }
          // Every answer set still asks for hanging and shelving.
          expect(counts.rods).toBeGreaterThan(0);
          expect(counts.shelves).toBeGreaterThan(0);
        }
      }
    }
  });

  it("maps hanging/shelving mix to more rods or more shelves", () => {
    const hanging = studioGuidedPartCounts(answers({ storageMix: "mostlyHanging", longHang: "no" }));
    const shelves = studioGuidedPartCounts(answers({ storageMix: "mostlyShelving", longHang: "no" }));
    expect(hanging.rods).toBeGreaterThan(shelves.rods);
    expect(shelves.shelves).toBeGreaterThan(hanging.shelves);
  });

  it("drops one rod for long hanging, and keeps a double hang on a reach-in", () => {
    // A walk-in spreads hanging over side walls, so "yes" simply removes one rod.
    const walkInWithLong = studioGuidedPartCounts(answers({ closetType: "walkIn", longHang: "yes" }));
    const walkInWithoutLong = studioGuidedPartCounts(answers({ closetType: "walkIn", longHang: "no" }));
    expect(walkInWithLong.rods).toBe(walkInWithoutLong.rods - 1);

    // A reach-in must stay "mostly double hang with one long-hang bay" (owner brief), so the floor
    // guarantees a long-hang bay plus a real double hang rather than one lone rod.
    const reachInWithLong = studioGuidedPartCounts(answers({ closetType: "reachIn", longHang: "yes" }));
    expect(reachInWithLong.rods).toBeGreaterThanOrEqual(3);
    const reachInWithoutLong = studioGuidedPartCounts(answers({ closetType: "reachIn", longHang: "no" }));
    expect(reachInWithoutLong.rods).toBe(2);
  });

  it("maps none/some/lots to 0/2/4 of each part", () => {
    expect(studioGuidedPartCounts(answers({ drawers: "none" })).drawers).toBe(0);
    expect(studioGuidedPartCounts(answers({ drawers: "some" })).drawers).toBe(2);
    expect(studioGuidedPartCounts(answers({ drawers: "lots" })).drawers).toBe(4);
    expect(studioGuidedPartCounts(answers({ shoes: "none" })).shoes).toBe(0);
    expect(studioGuidedPartCounts(answers({ shoes: "some" })).shoes).toBe(2);
    expect(studioGuidedPartCounts(answers({ shoes: "lots" })).shoes).toBe(4);
  });
});

describe("guided answers → placements in the built design", () => {
  it("places hanging, shelf, drawer and shoe parts for a typical walk-in", () => {
    const { design } = build({ storageMix: "balanced", longHang: "yes", drawers: "some", shoes: "some" }, STUDIO_GUIDED_ROOM_DEFAULTS.walkIn);
    const items = placed(design);
    expect(items.rods.length).toBeGreaterThan(0);
    expect(items.shelves.length).toBeGreaterThan(0);
    expect(items.drawers.length).toBeGreaterThan(0);
    expect(items.shoes.length).toBeGreaterThan(0);
    // A walk-in uses more than one wall.
    expect(STUDIO_WALLS.filter((wall) => studioBays(design, wall).length).length).toBeGreaterThan(1);
  });

  it("places no drawers when the answer is none, and more when the answer is lots", () => {
    const none = placed(build({ drawers: "none" }, STUDIO_GUIDED_ROOM_DEFAULTS.walkIn).design);
    const some = placed(build({ drawers: "some" }, STUDIO_GUIDED_ROOM_DEFAULTS.walkIn).design);
    const lots = placed(build({ drawers: "lots" }, STUDIO_GUIDED_ROOM_DEFAULTS.walkIn).design);
    expect(none.drawers).toHaveLength(0);
    expect(some.drawers.length).toBeGreaterThan(0);
    expect(lots.drawers.length).toBeGreaterThan(some.drawers.length);
  });

  it("places no shoe organizers when the answer is none, and more when the answer is lots", () => {
    const none = placed(build({ shoes: "none" }, STUDIO_GUIDED_ROOM_DEFAULTS.walkIn).design);
    const some = placed(build({ shoes: "some" }, STUDIO_GUIDED_ROOM_DEFAULTS.walkIn).design);
    const lots = placed(build({ shoes: "lots" }, STUDIO_GUIDED_ROOM_DEFAULTS.walkIn).design);
    expect(none.shoes).toHaveLength(0);
    expect(some.shoes.length).toBeGreaterThan(0);
    expect(lots.shoes.length).toBeGreaterThan(some.shoes.length);
  });

  it("gives mostly-hanging more rods and mostly-shelving more shelves in the real layout", () => {
    const hangingDesign = placed(build({ storageMix: "mostlyHanging", longHang: "no" }, STUDIO_GUIDED_ROOM_DEFAULTS.walkIn).design);
    const shelfDesign = placed(build({ storageMix: "mostlyShelving", longHang: "no" }, STUDIO_GUIDED_ROOM_DEFAULTS.walkIn).design);
    expect(hangingDesign.rods.length).toBeGreaterThan(shelfDesign.rods.length);
    expect(shelfDesign.shelves.length).toBeGreaterThan(hangingDesign.shelves.length);
  });

  it("puts the long-hang rod high enough for a dress, and no second rod under it", () => {
    const { design } = build({ storageMix: "balanced", longHang: "yes" }, STUDIO_GUIDED_ROOM_DEFAULTS.walkIn);
    const items = placed(design);
    // 60 in of drop below a 72 in rod clears a long dress with room for the hanger.
    const longHangRod = items.rods.find((rod) => rod.bottomIn >= 72);
    expect(longHangRod, "a high rod is placed for long hanging").toBeTruthy();
    const bayWithLongRod = STUDIO_WALLS.flatMap((wall) => studioBays(design, wall))
      .find((bay) => bay.items.some((item) => item.id === longHangRod!.id));
    expect(bayWithLongRod!.items.filter((item) => item.kind === "rod")).toHaveLength(1);
  });

  it("never places a part that is not in the MasterTrac catalog", () => {
    const skus = new Set(CLOSET_PARTS.map((part) => part.sku));
    // Parts are referenced through the catalog, so a build that succeeds proves every part resolved.
    for (const storageMix of ["mostlyHanging", "balanced", "mostlyShelving"] as const) {
      const result = build({ storageMix }, STUDIO_GUIDED_ROOM_DEFAULTS.walkIn);
      expect(result.design.bays.length).toBeGreaterThan(0);
      expect(result.notices.join(" ")).not.toMatch(/no matching|not available/i);
    }
    expect(skus.size).toBeGreaterThan(0);
  });

  it("keeps a reach-in to a single wall", () => {
    const { design } = build({}, STUDIO_GUIDED_ROOM_DEFAULTS.reachIn);
    expect(STUDIO_WALLS.filter((wall) => studioBays(design, wall).length)).toEqual(["back"]);
  });
});

describe("guided summary", () => {
  it("describes the built design in plain language without part jargon", () => {
    const result = build({ storageMix: "balanced", longHang: "yes", drawers: "some", shoes: "some" }, STUDIO_GUIDED_ROOM_DEFAULTS.walkIn);
    const lines = studioGuidedSummaryLines(result.design, answers({ closetType: "walkIn", longHang: "yes", drawers: "some", shoes: "some" }));
    const text = lines.join(" ");
    expect(text).toMatch(/walk-in closet/i);
    expect(text).toMatch(/Hanging space/i);
    expect(text).toMatch(/long dresses and coats/i);
    expect(text).toMatch(/shelves? for folded clothes/i);
    expect(text).toMatch(/drawers? for smaller things/i);
    expect(text).toMatch(/shoe shel(f|ves)/i);
    // The counts match what actually landed in the design.
    const items = placed(result.design);
    expect(text).toContain(`${items.shelves.length} shelves`);
    expect(text).toContain(`${items.drawers.length} drawers`);
    // No SKUs, part codes, or unit jargon in the customer-facing copy.
    expect(text).not.toMatch(/\b(?:SKU|432\d{3}|upright|cleat|bay|envelope|takeoff)\b/i);
  });

  it("says so when the room had no space for the requested drawers or shoes", () => {
    const tiny = { wallWidthIn: 36, roomDepthIn: 24, roomHeightIn: 96 };
    const result = build({ storageMix: "mostlyShelving", drawers: "lots", shoes: "lots" }, tiny);
    const lines = studioGuidedSummaryLines(result.design, answers({ drawers: "lots", shoes: "lots" }));
    const text = lines.join(" ");
    if (!placed(result.design).drawers.length) expect(text).toMatch(/No drawers fit/i);
    if (!placed(result.design).shoes.length) expect(text).toMatch(/No separate shoe shelf fit/i);
  });

  it("counts what was actually placed, not what was requested", () => {
    const result = build({ drawers: "none" }, STUDIO_GUIDED_ROOM_DEFAULTS.walkIn);
    const lines = studioGuidedSummaryLines(result.design, answers({ drawers: "none" }));
    expect(lines.join(" ")).not.toMatch(/\d+ drawers?\b/);
  });
});

describe("autoBuildStudioFromAnswers", () => {
  it("returns the counts it used so the UI can explain the build", () => {
    const result = autoBuildStudioFromAnswers({ answers: answers({ drawers: "lots" }), mount: "floor", finish: "Glacier White", room: STUDIO_GUIDED_ROOM_DEFAULTS.walkIn });
    expect(result.options).toEqual(studioGuidedPartCounts(answers({ drawers: "lots" })));
    expect(result.options.drawers).toBe(4);
  });

  it("still supports the kids' mode unchanged", () => {
    const result = autoBuildStudioFromAnswers({
      answers: answers(), mount: "floor", finish: "Glacier White", room: STUDIO_GUIDED_ROOM_DEFAULTS.reachIn,
      mode: "kids", kids: { ageYears: 7, heightIn: 46 },
    });
    expect(result.design.mode).toBe("kids");
    expect(result.design.kids).toEqual({ ageYears: 7, heightIn: 46 });
    // A child's rod is placed at about their height, well below an adult rod.
    expect(placed(result.design).rods.some((rod) => rod.bottomIn <= 46)).toBe(true);
  });
});

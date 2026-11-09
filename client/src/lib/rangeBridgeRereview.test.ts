import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  normalizeStandardWallMounts,
  overSinkOrRangeNeighborAlignedMountBottom,
  wallCabinetVerticalMoveLimit,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { applyDesignerLayoutRules } from "./designerLayoutRules";
import { overApplianceWallMount } from "./overApplianceMount";
import { overRangeBridgeFor, planOverRangeCompanions } from "./overRangeCompanion";
import {
  RANGE_BRIDGE_HEIGHTS_IN,
  rangeBridgeHeightChoices,
  rangeCompanionDetail,
  rangeCompanionProposal,
  rangeCompanionSummary,
} from "./rangeCompanion";

const room = (ceilingHeight = 96): RoomData => ({ width: 168, depth: 120, ceilingHeight });

const wallRow = (width: number, height: number): DesignCabinet => ({
  id: width * 100 + height,
  masterCode: `W${width}${height}`,
  description: `${width}" x ${height}" x 12" Wall Cabinet - 2 Doors`,
  category: "Wall Cabinets",
  subCategory: "Wall",
  width: String(width),
  height: String(height),
  depth: "12",
  placement: "wall",
  numberOfDoors: 2,
  numberOfDrawers: 0,
} as DesignCabinet);
const catalog = (width = 30, heights: readonly number[] = RANGE_BRIDGE_HEIGHTS_IN) => heights.map((height) => wallRow(width, height));
const microwaveRow = (width = 30) => ({
  id: 9000 + width, masterCode: `MW-${width}`, description: `Over-Range Microwave ${width}"`, category: "Appliance", subCategory: "Microwave",
  width: String(width), height: "16", depth: "16", placement: "appliance", numberOfDoors: 0, numberOfDrawers: 0,
} as DesignCabinet);

function item(partial: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "masterCode">): PlacedCabinet {
  return { cabinetId: 1, description: "", placement: "wall", x: 0, y: 0, width: 30, depth: 12, height: 30, rotation: 0, ...partial };
}
const rangeOf = (width = 30) => item({ uid: "range", masterCode: `RANGE-${width}`, description: `${width} inch Range`, placement: "appliance", x: 48, width, depth: 26, height: 36 });
const wall = (uid: string, x: number, height: number) =>
  item({ uid, masterCode: `W15${height}`, description: `15x${height} Wall Cabinet`, x, width: 15, height, mountBottom: 54 });
const neighbors = (height: number, rangeWidth = 30) => [wall("left", 33, height), wall("right", 48 + rangeWidth, height)];
const proposalFor = (input: { neighborHeight?: number; rangeWidth?: number; wallCatalog: DesignCabinet[]; ceiling?: number; bridgeHeightIn?: number }) => {
  const rangeWidth = input.rangeWidth ?? 30;
  const range = rangeOf(rangeWidth);
  return rangeCompanionProposal(range, room(input.ceiling), input.wallCatalog, [microwaveRow(rangeWidth)], input.neighborHeight ?? 30, {
    placed: [range, ...(input.neighborHeight ? neighbors(input.neighborHeight, rangeWidth) : [])],
    lineName: "Natura Maple",
    bridgeHeightIn: input.bridgeHeightIn,
  });
};

describe("designer re-review: microwave bridge and over-range uppers", () => {
  it("1. never applies a disabled height, and says why when no height is available", () => {
    // Under an 89.75" ceiling W3018 ends at 90" and is disabled. A line that
    // sells only W3018 has nothing to offer; it must not apply it anyway.
    const onlyW3018 = proposalFor({ neighborHeight: 36, wallCatalog: catalog(30, [18]), ceiling: 89.75 })!;
    expect(onlyW3018.bridge).toBeNull();
    expect(onlyW3018.bridgeHeightIn).toBeNull();
    // 6 offered heights now: the frameless 22-5/8" (nominal 23) box was added
    // so a frameless bridge can reach the 94-1/4" line (issue #354 item 5).
    expect(onlyW3018.bridgeChoices).toHaveLength(6);
    expect(onlyW3018.bridgeChoices.find((choice) => choice.heightIn === 18)?.disabledReason).toBe("W3018 would end at 90″, past the 89.75″ ceiling.");
    expect(onlyW3018.bridgeUnavailableReason).toMatch(/no cabinet can be added over the microwave/);
    expect(rangeCompanionSummary(onlyW3018)).toBe(onlyW3018.bridgeUnavailableReason);
    expect(rangeCompanionDetail(onlyW3018)).toMatch(/nothing is added/);
    // Requesting the disabled height falls to an enabled one, never to W3018.
    const full = proposalFor({ neighborHeight: 36, wallCatalog: catalog(), ceiling: 89.75, bridgeHeightIn: 18 })!;
    expect(full.bridge?.masterCode).toBe("W3012");
    // The build uses the same strict ceiling, so it never applies W3018 there either.
    expect(overRangeBridgeFor({ rangeWidthIn: 30, wallCabinetHeightIn: 36, wallCatalog: catalog(), ceilingIn: 89.75 })?.masterCode).toBe("W3012");
    expect(overRangeBridgeFor({ rangeWidthIn: 30, wallCabinetHeightIn: 36, wallCatalog: catalog(30, [18]), ceilingIn: 89.75 })).toBeNull();

    // A 36" range in a line that sells only 30"-wide bridges gets a visible
    // reason, not a silent W3012.
    const wide = proposalFor({ rangeWidth: 36, neighborHeight: 30, wallCatalog: catalog(30) })!;
    expect(wide.bridge).toBeNull();
    expect(wide.bridgeChoices.map((choice) => choice.disabledReason)).toEqual(
      RANGE_BRIDGE_HEIGHTS_IN.map((height) => `W36${height} is not in the Natura Maple catalog.`),
    );
    expect(wide.bridgeUnavailableReason).toBe("The Natura Maple line sells no 36″-wide bridge (W3612–W3624) and no single-door W1236–W2136 to turn horizontal for this 36″ range, so no cabinet can be added over the microwave.");

    // The pop-up keeps the picker and its reasons, and cannot confirm without a bridge.
    const source = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("rangeCompanionPrompt.proposal.bridgeHeightIn != null && (");
    expect(source).toContain("disabled={!rangeCompanionPrompt?.proposal.bridge}");
    expect(source).toContain("data-testid=\"range-bridge-unavailable\"");
  });

  it("2. an ordinary upper over a bare range top-aligns to its neighbours, never below 72", () => {
    const upper18 = item({ uid: "w2418", masterCode: "W2418", description: "24x18 Wall Cabinet", x: 51, width: 24, height: 18 });
    const plan = [rangeOf(), wall("left", 36, 42), upper18, wall("right", 75, 42)];
    expect(overSinkOrRangeNeighborAlignedMountBottom(upper18, plan, [], room())).toBe(78);
    expect(overApplianceWallMount(upper18, plan, room())).toMatchObject({ kind: "range", mountBottom: 78 });
    expect(normalizeStandardWallMounts(plan, [], room()).find((cabinet) => cabinet.uid === "w2418")?.mountBottom).toBe(78);
    const laidOut = applyDesignerLayoutRules({
      placed: plan, room: room(), openings: [], fillers: [], makeUid: () => "uid", styleId: null, allowAutoFillers: false,
    }).placed.find((cabinet) => cabinet.uid === "w2418")!;
    expect(laidOut.mountBottom).toBe(78);
    expect(laidOut.mountBottom! + laidOut.height).toBe(96);
    // Beside 30" uppers (top 84) aligning would put it at 66; the floor holds it at 72.
    const low = [rangeOf(), wall("left", 36, 30), upper18, wall("right", 75, 30)];
    expect(overSinkOrRangeNeighborAlignedMountBottom(upper18, low, [], room())).toBe(72);
    // Over an OTR microwave the fixed datum still applies: it sits on the microwave line.
    const mw = item({ uid: "mw", masterCode: "MW-30", description: "Over-Range Microwave", placement: "appliance", x: 48, width: 30, depth: 16, height: 16, mountBottom: 56 });
    expect(overSinkOrRangeNeighborAlignedMountBottom(upper18, [...plan, mw], [], room())).toBe(72);
    expect(normalizeStandardWallMounts([...plan, mw], [], room()).find((cabinet) => cabinet.uid === "w2418")?.mountBottom).toBe(72);
  });

  it("2b. the bare-range top-align never pushes an upper past the ceiling over its span", () => {
    // Range at 57-87 with the upper ending at 84", the middle of the 168" wall.
    const upper18 = item({ uid: "w2418", masterCode: "W2418", description: "24x18 Wall Cabinet", x: 60, width: 24, height: 18 });
    const plan = [{ ...rangeOf(), x: 57 }, wall("left", 45, 42), upper18, wall("right", 84, 42)];
    // Sloped wall, 96" at its start and 84" at its end: 90" over this span's low end.
    const sloped: RoomData = { ...room(), wallCeilings: { top: { high: 96, low: 84, slopeFrom: "start" } } };
    expect(wallCabinetVerticalMoveLimit(upper18, sloped).ceiling).toBe(90);
    // Without the guard this was raised to 78-96.
    expect(overApplianceWallMount(upper18, plan, room(96))).toMatchObject({ kind: "range", mountBottom: 78 });
    expect(overApplianceWallMount(upper18, plan, sloped)).toMatchObject({ kind: "range", mountBottom: 72 });
    expect(overSinkOrRangeNeighborAlignedMountBottom(upper18, plan, [], sloped)).toBe(72);
    expect(normalizeStandardWallMounts(plan, [], sloped).find((cabinet) => cabinet.uid === "w2418")?.mountBottom).toBe(72);
    const laidOut = applyDesignerLayoutRules({
      placed: plan, room: sloped, openings: [], fillers: [], makeUid: () => "uid", styleId: null, allowAutoFillers: false,
    }).placed.find((cabinet) => cabinet.uid === "w2418")!;
    expect(laidOut.mountBottom).toBe(72);
    // Under a flat 93" ceiling it rises only to the highest position that fits: 75-93.
    expect(overApplianceWallMount(upper18, plan, room(93))).toMatchObject({ kind: "range", mountBottom: 75 });
    expect(normalizeStandardWallMounts(plan, [], room(93)).find((cabinet) => cabinet.uid === "w2418")?.mountBottom).toBe(75);
  });

  it("3. the pop-up and Auto Design pick the same height from one shared fallback", () => {
    const cases: { neighborHeight: number; heights: readonly number[]; ceiling?: number; expected: string }[] = [
      { neighborHeight: 42, heights: [12, 15, 18, 21], expected: "W3018" },
      { neighborHeight: 36, heights: [12, 15, 21, 24], expected: "W3012" },
      { neighborHeight: 30, heights: [15, 18, 21, 24], expected: "W3018" },
      { neighborHeight: 42, heights: RANGE_BRIDGE_HEIGHTS_IN, ceiling: 93, expected: "W3018" },
      { neighborHeight: 33, heights: RANGE_BRIDGE_HEIGHTS_IN, expected: "W3015" },
      { neighborHeight: 39, heights: RANGE_BRIDGE_HEIGHTS_IN, expected: "W3021" },
    ];
    for (const { neighborHeight, heights, ceiling, expected } of cases) {
      const wallCatalog = catalog(30, heights);
      const popup = proposalFor({ neighborHeight, wallCatalog, ceiling })!;
      const build = planOverRangeCompanions({
        answer: "microwave-bridge",
        placed: [rangeOf()],
        room: room(ceiling),
        appliancePalette: [microwaveRow()],
        wallCatalog,
        wallCabinetHeightIn: neighborHeight,
      });
      expect(build.ok, `${neighborHeight}" neighbours`).toBe(true);
      if (!build.ok) continue;
      expect([neighborHeight, popup.bridge?.masterCode]).toEqual([neighborHeight, expected]);
      expect([neighborHeight, build.plan.bridge.masterCode]).toEqual([neighborHeight, expected]);
      // Without an upper placed yet, the pop-up reads the wall-height setting the same way.
      const noNeighbors = rangeCompanionProposal(rangeOf(), room(ceiling), wallCatalog, [microwaveRow()], neighborHeight, { placed: [rangeOf()] })!;
      expect([neighborHeight, noNeighbors.bridge?.masterCode]).toEqual([neighborHeight, expected]);
    }
    const choices = rangeBridgeHeightChoices({ rangeWidthIn: 30, wallCatalog: catalog(30, [12, 15, 18, 21]), ceilingIn: 96 });
    expect(choices.find((choice) => choice.heightIn === 24)?.bridge).toBeNull();
  });
});

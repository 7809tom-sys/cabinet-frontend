/**
 * The over-range answer is remembered and the fallback chain runs on every build
 * and on every layout load.
 *
 * PR 174 removed the in-build hood so the design question could decide what goes
 * above the range. It left the answer in a transient dialog: nothing persisted it,
 * `planOverRangeCompanions` only ran inside `autoDesignLayout.ts`, and a loaded
 * plan sat with a bare range. This file holds the wiring that closes that loop.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const designTool = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  expect(from, `missing ${start}`).toBeGreaterThan(-1);
  const to = source.indexOf(end, from);
  expect(to, `missing ${end}`).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe("the add-only over-range pass", () => {
  it("runs after every build and on a layout load", () => {
    // The pass is a single effect keyed off the placed plan, the room (which
    // carries the saved answer), and the line's catalogs, so it fires for a fresh
    // build and for a restored design alike. It is not wired into
    // autoDesignLayout.ts: the build still leaves the range open on purpose.
    expect(designTool).toContain("fillOverRangeAnswer({");
    const pass = between(designTool, "const overRangeFillRanRef = useRef", "const faucetFillRanRef = useRef");
    expect(pass).toContain("rangesInPlan(placed)");
    expect(pass).toContain("overRangeFullyDressed(placed, range, room)");
    // The pass itself fills whatever the build left (bridge + microwave/hood), so a
    // restored design that predates the rule is dressed on load.
    expect(pass).toContain("fillOverRangeAnswer({");
    expect(pass).toContain("answer: room.overRangeAnswer");
    expect(pass).toContain("answer: room.overRangeAnswer");
    expect(pass).toContain("wallCatalog: wallCabPoolRef.current");
    expect(pass).toContain("setPlaced(() => result.placed)");
    // The effect's dependency list must include the saved answer's carrier.
    // The pass's own dependency list sits on its closing "}, [...]" line.
    const deps = pass.slice(pass.indexOf("}, [appliancePalette, overRangeEpoch"));
    expect(deps).toContain("placed");
    expect(deps).toContain("room");
  });

  it("seats the mandatory bridge BEFORE the upper run tiles, in both build paths", () => {
    // The bridge must go in first so the wall run treats it as an occupied upper and
    // never lays a cabinet over the range or leaves a sliver beside the bridge.
    expect(designTool).toContain("placeMandatoryOverRangeBridges({");
    const complete = between(designTool, "const seamResult = fillAutoDesignLowerSeams({", "const upperResult = buildAutoDesignWallCabinets({");
    expect(complete).toContain("placeMandatoryOverRangeBridges({");
    expect(complete).toContain("if (mandatoryBridge.added) working = mandatoryBridge.placed;");

    const layoutSource = readFileSync(new URL("../lib/autoDesignLayout.ts", import.meta.url), "utf8");
    const buildPath = between(layoutSource, "const bridgeResult = placeMandatoryOverRangeBridges({", "const upperResult = buildAutoDesignWallCabinets({");
    expect(buildPath).toContain("placeMandatoryOverRangeBridges({");
    expect(buildPath).toContain("reviewFindings.push(...bridgeResult.findings)");
  });

  it("surfaces a blocked bridge on the review list instead of skipping it", () => {
    expect(designTool).toContain("setAutoDesignReviewFindings((current) => [...current, ...mandatoryBridge.findings])");
    expect(designTool).toContain("const overRangeFillRanRef = useRef");
  });

  it("never deletes, replaces, or moves an existing bridge or microwave", () => {
    // Everything the pass adds goes through the shared collision gate, and the
    // module is add-only by construction.
    const fillModule = readFileSync(new URL("../lib/overRangeFill.ts", import.meta.url), "utf8");
    expect(fillModule).toContain("appendCollisionFreePlacements(");
    expect(fillModule).not.toMatch(/\.filter\(\(item\) => item\.uid !==/);
    expect(fillModule).not.toContain("splice(");
    expect(fillModule).toContain("existingOverRangeBridge(placed, range, room)");
    expect(fillModule).toContain("everyRangeBridged");
  });

  it("persists the popup answer with the layout, including 'leave it open'", () => {
    // Every answer in the dialog writes through one setter, which only ever
    // replaces a real previous answer with a real new one.
    expect(designTool).toContain("const setOverRangeAnswer = useCallback");
    expect(designTool).toContain("overRangeAnswerToPersist(current.overRangeAnswer, answer)");
    const hood = between(designTool, "const addAutoDesignRangeHood = useCallback", "const offerAutoDesignBridgeAndMicrowave = useCallback");
    expect(hood).toContain('setOverRangeAnswer("hood")');
    const bridge = between(designTool, "const offerAutoDesignBridgeAndMicrowave = useCallback", "const addWscSpiceStackUpper = useCallback");
    expect(bridge).toContain('setOverRangeAnswer("microwave-bridge")');
    expect(designTool).toContain('onClick={() => { setAutoDesignRangeVentPrompt(null); setOverRangeAnswer("open"); }}');
    // The confirmed bridge + microwave prompt also records the answer.
    expect(designTool).toContain('setOverRangeAnswer("microwave-bridge");');
  });

  it("seeds the answer from the design questions and restores it on load", () => {
    expect(designTool).toContain("overRangeAnswer: overRangeAnswerToPersist(current.overRangeAnswer, input.overRangeAnswer)");
    expect(designTool).toContain("overRangeAnswer: readOverRangeAnswer(d.room?.overRangeAnswer)");
  });

  it("keeps the microwave recognisable by isMicrowaveOverRangePair", () => {
    // `isMicrowaveOverRangePair` (design.ts) only sees an over-range appliance by
    // its `MW-` prefix, so the fallback must place a real `MW-` row.
    const companions = readFileSync(new URL("../lib/overRangeCompanion.ts", import.meta.url), "utf8");
    expect(companions).toContain("/^MW[-_]?\\d/i");
    const fillModule = readFileSync(new URL("../lib/overRangeFill.ts", import.meta.url), "utf8");
    expect(fillModule).toContain("overRangeMicrowaveFor(");
    expect(fillModule).toContain("overRangeBridgeFor(");
    expect(fillModule).toContain("autoDesignRangeHood(");
  });

  /**
   * Owner bug (Nov 6 2026): "the wall (bridge) cabinet over the range should be 12
   * inches but the designer did not apply that size."
   *
   * The build placed the right 12" W3012, then the Auto-Design pop-up re-sized it.
   * `offerAutoDesignBridgeAndMicrowave` called `rangeBridgeSpec`, which answered
   * "24 inch bridge, bottom 72, top 96" regardless of the 30" uppers, looked up
   * W3024, and overwrote the proposal. Both paths now use the one selector.
   */
  it("offers exactly the bridge the build placed, never a second hard-coded size", () => {
    const bridge = between(designTool, "const offerAutoDesignBridgeAndMicrowave = useCallback", "const addWscSpiceStackUpper = useCallback");
    // One selector, and the prompt takes its bridge straight from it.
    expect(bridge).toContain("rangeCompanionProposal(");
    expect(bridge).toContain("setRangeCompanionPrompt({ rangeUid: range.uid, proposal, microwaveAlreadyPlaced: false })");
    // The old override must not come back: it is what turned the 12" box into a 24".
    expect(bridge).not.toContain("rangeBridgeSpec");
    expect(bridge).not.toContain("bridgeSource");
    expect(bridge).not.toContain("bridgeSpec.bottomIn");
    expect(bridge).not.toMatch(/W3024/);
    // Nothing in the Designer's over-range path may hard-code the bridge height.
    const companions = readFileSync(new URL("../lib/overRangeCompanion.ts", import.meta.url), "utf8");
    expect(companions).toContain("overRangeBridgeHeightFor(");
    expect(companions).not.toContain("bridge_hung_height_in");
  });
});

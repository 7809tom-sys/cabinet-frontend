import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const designTool = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const dialog = readFileSync(new URL("../components/design/FourAnchorAutoBuildDialog.tsx", import.meta.url), "utf8");

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  expect(from, `missing ${start}`).toBeGreaterThan(-1);
  const to = source.indexOf(end, from);
  expect(to, `missing ${end}`).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe("Four-anchor kitchen rules wiring", () => {
  const build = between(designTool, "const buildFourAnchorAutoLayout = useCallback", "const completeFourAnchorAutoLayout = useCallback");
  const complete = between(designTool, "const completeFourAnchorAutoLayout = useCallback", "const cancelFourAnchorCornerStage = useCallback");
  const cancel = between(designTool, "const cancelFourAnchorCornerStage = useCallback", "useEffect(");

  it("passes the selected upper height so the refrigerator cabinet above reaches the upper line", () => {
    expect(build).toContain("wallCabinetHeightIn: input.wallCabinetHeightIn ?? 30");
  });

  it("creates the sink window only from the entered window center and refuses an overlap with the refrigerator cabinet", () => {
    expect(build).toContain("input.sinkWindowCenter && sinkBase");
    expect(build).toContain("fourAnchorSinkWindow({ sink: sinkBase, room, uid: makeUid() })");
    expect(build).toContain("windowOverlapsReservation(proposedWindow, refrigeratorReservation)");
    expect(build).toContain("sinkWindow,\n    });");
  });

  it("feeds the window to every remaining stage and commits it only when the build completes", () => {
    expect(complete).toContain("const stageOpenings");
    expect(complete.match(/openings: stageOpenings/g)?.length).toBeGreaterThanOrEqual(2);
    expect(complete).toContain("freeSegmentsOnWall(wallId, room, working, stageOpenings");
    expect(complete).toContain("setOpenings((previous)");
    expect(cancel).not.toContain("setOpenings");
  });

  it("asks what goes above a bare range after the build, offering a hood or a bridge cabinet with microwave", () => {
    expect(complete).toContain("fourAnchorRangeNeedsVentilation(working, item)");
    expect(complete).toContain("setFourAnchorRangeVentPrompt({ rangeUid: bareRange.uid })");
    expect(designTool).toContain("What goes above the range?");
    expect(designTool).toContain("Add a range hood");
    expect(designTool).toContain("Add a bridge cabinet and microwave");
    expect(designTool).toContain("Leave it open");
    const hood = between(designTool, "const addFourAnchorRangeHood = useCallback", "const offerFourAnchorBridgeAndMicrowave = useCallback");
    expect(hood).toContain("fourAnchorRangeHood(");
    expect(hood).toContain("appendCollisionFreePlacements(placedRef.current, [built.hood], room)");
    const bridge = between(designTool, "const offerFourAnchorBridgeAndMicrowave = useCallback", "const addWscSpiceStackUpper = useCallback");
    expect(bridge).toContain("rangeCompanionProposal(");
    expect(bridge).toContain("setRangeCompanionPrompt({ rangeUid: range.uid, proposal, microwaveAlreadyPlaced: false })");
  });

  it("shows the window field for every layout, including galley, and explains what it does", () => {
    expect(dialog).not.toContain('layoutType !== "galley" && (\n            <div className="space-y-1.5">\n              <Label htmlFor="four-anchor-window-center"');
    expect(dialog).toContain("Window above the sink");
    expect(dialog).toContain("No wall cabinet goes above the sink");
  });
});

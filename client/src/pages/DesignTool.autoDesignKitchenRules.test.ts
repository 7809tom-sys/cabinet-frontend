import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const designTool = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const dialog = readFileSync(new URL("../components/design/AutoDesignDialog.tsx", import.meta.url), "utf8");

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  expect(from, `missing ${start}`).toBeGreaterThan(-1);
  const to = source.indexOf(end, from);
  expect(to, `missing ${end}`).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe("Auto-Design kitchen rules wiring", () => {
  const build = between(designTool, "const buildAutoDesignLayout = useCallback", "const completeAutoDesignLayout = useCallback");
  const complete = between(designTool, "const completeAutoDesignLayout = useCallback", "finishAutoDesignLayoutRef.current = completeAutoDesignLayout");

  it("passes the selected upper height so the refrigerator cabinet above reaches the upper line", () => {
    expect(build).toContain("const nominal = input.wallCabinetHeightIn ?? 30");
    expect(build).toContain("wallCabinetHeightIn:");
  });

  it("creates the sink window only from the entered window center and refuses an overlap with the refrigerator cabinet", () => {
    expect(build).toContain("input.sinkWindowCenter && sinkBase");
    expect(build).toContain("autoDesignSinkWindow({ sink: sinkBase, room, uid: makeUid() })");
    expect(build).toContain("windowOverlapsReservation(proposedWindow, refrigeratorReservation)");
    expect(build).toContain("sinkWindow,");
    expect(build).toContain("finishAutoDesignLayoutRef.current");
  });

  it("feeds the window to every remaining stage and commits it only when the build completes", () => {
    expect(complete).toContain("const stageOpenings");
    expect(complete.match(/openings: stageOpenings/g)?.length).toBeGreaterThanOrEqual(2);
    expect(complete).toContain("freeSegmentsOnWall(wallId, room, working, stageOpenings");
    expect(complete).toContain("setOpenings((previous)");
    const abandon = complete.slice(complete.indexOf("const abandon"), complete.indexOf("if (!stage)"));
    expect(abandon).not.toContain("setOpenings");
    expect(complete.indexOf("setOpenings((previous)")).toBeGreaterThan(complete.indexOf("seatAutoDesignCornerFromCatalog"));
  });

  it("asks what goes above a bare range after the build, offering a hood or a bridge cabinet with microwave", () => {
    expect(complete).toContain("autoDesignRangeNeedsVentilation(working, item)");
    expect(complete).toContain("setAutoDesignRangeVentPrompt({ rangeUid: bareRange.uid })");
    expect(designTool).toContain("What goes above the range?");
    expect(designTool).toContain("Add a range hood");
    expect(designTool).toContain("Add a bridge cabinet and microwave");
    expect(designTool).toContain("Leave it open");
    const hood = between(designTool, "const addAutoDesignRangeHood = useCallback", "const offerAutoDesignBridgeAndMicrowave = useCallback");
    expect(hood).toContain("autoDesignRangeHood(");
    expect(hood).toContain("appendCollisionFreePlacements(placedRef.current, [built.hood], room)");
    const bridge = between(designTool, "const offerAutoDesignBridgeAndMicrowave = useCallback", "const addWscSpiceStackUpper = useCallback");
    expect(bridge).toContain("rangeCompanionProposal(");
    expect(bridge).toContain("setRangeCompanionPrompt({ rangeUid: range.uid, proposal: aligned, microwaveAlreadyPlaced: false })");
  });

  it("shows the window field for every layout, including galley, and explains what it does", () => {
    expect(dialog).not.toContain('layoutType !== "galley" && (\n            <div className="space-y-1.5">\n              <Label htmlFor="auto-design-window-center"');
    expect(dialog).toContain("Window above the sink");
    expect(dialog).toContain("No wall cabinet goes above the sink");
  });
});

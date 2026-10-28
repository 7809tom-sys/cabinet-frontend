import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

describe("regular Designer attached filler workflow", () => {
  it("opens an optional chooser before an eligible base, wall, or tall cabinet is committed", () => {
    expect(source).toContain("const [attachedFillerPrompt, setAttachedFillerPrompt]");
    expect(source).toContain("attachedFillerChoice === undefined");
    expect(source).toContain("setAttachedFillerPrompt({");
    expect(source).toContain("Choose attached fillers");
    expect(source).toContain("attached-filler-no-filler");
    expect(source).toContain('step="0.125"');
	    expect(source).toContain('(!isAccessory || (isFlatPanel && accPlacement === "tall"))');
    expect(source).toContain("!isFillerAccessory");
  });

  it("commits selected strips through the shared stock-backed atomic builder and lets Attributes update them", () => {
    expect(source).toContain("buildAttachedFillerPlacement({");
    expect(source).toContain("appendCollisionFreePlacements(normalizedPrevious, [attachment.cabinet, ...attachment.fillers], room)");
    expect(source).toContain("const applyAttachedCabinetFillers = useCallback");
    expect(source).toContain("attachedFillerOptions={attrAttachedFillerOptions}");
    expect(source).toContain("onApplyAttachedFillers={applyAttachedCabinetFillers}");
  });

  it("retains a later-exposed attached filler and identifies it for review instead of silently deleting it", () => {
    expect(source).toContain("attachedFillerNeedsReview(cabinet, next, room)");
    expect(source).toContain("REVIEW: attached filler is now on an exposed end");
  });
});

describe("attached filler measured space", () => {
  it("states each offered side's measured gap, including flush sides", () => {
    expect(source).toContain('data-testid="attached-filler-measured-space"');
    expect(source).toContain("flush against the wall or cabinet, no gap");
    expect(source).toContain("leftGapIn: attachment.leftGapIn,");
  });
});

describe("attached filler size warning popup", () => {
  it("checks the chosen size before placing and offers Place anyway only for a too-small filler", () => {
    const placeButton = source.slice(source.indexOf('data-testid="attached-filler-place"'), source.indexOf('Place cabinet{leftIn > 0'));
    expect(placeButton).toContain("attachedFillerSizeIssues(attachedFillerPrompt.fitCandidate, attachedFillerPrompt.fitPeers, room, { leftIn, rightIn })");
    expect(placeButton.indexOf("return;")).toBeLessThan(placeButton.indexOf("place({ leftIn, rightIn })"));
    expect(source).toContain('data-testid="attached-filler-size-warning"');
    expect(source).toContain('{!tooLarge && <AlertDialogAction data-testid="attached-filler-size-place-anyway"');
  });
});

describe("attached filler fit error", () => {
  it("names what the cabinet or its filler would overlap, and by how much", () => {
    const start = source.indexOf("Name what was blocked and by what");
    const block = source.slice(start, source.indexOf("setPlacementWarning(message);", start));
    expect(block).toContain("cabinetPlacementCollisionDetail(blocked,");
    expect(block).toContain("would overlap ${blocker.cabinet.masterCode} by ${formatEighthInches(blocker.penetration)}");
  });
});

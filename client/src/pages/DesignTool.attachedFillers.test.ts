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

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Design Tool range companion workflow", () => {
  it("asks before adding the real short wall cabinet and centered over-range microwave when a new range has no assigned hood", () => {
    const addStart = source.indexOf("const addCabinet = useCallback");
    const commitStart = source.indexOf("placedRef.current = committedRun;", addStart);
    const promptStart = source.indexOf("const proposal = hasAssignedVentilation", commitStart);

    expect(promptStart).toBeGreaterThan(commitStart);
    const promptSource = source.slice(promptStart, promptStart + 1100);
    expect(promptSource).toContain("rangeCompanionProposal(");
    expect(promptSource).toContain("wallCabHeightRef.current");
    expect(promptSource).not.toContain("CLEARANCE");
    expect(source).toContain("Add microwave and bridge over range");
    expect(source).toContain("Yes — add bridge and microwave");
    expect(source).toContain("No — keep the range as placed");
  });

  it("uses the owner-fixed 72-inch bridge datum without clearance controls", () => {
    const actionStart = source.indexOf("const addApprovedRangeCompanions = useCallback");
    const actionEnd = source.indexOf("// Manual filler", actionStart);
    const actionSource = source.slice(actionStart, actionEnd);
    const previewStart = source.indexOf("data-testid=\"range-companion-source-preview\"");
    const previewSource = source.slice(previewStart, previewStart + 2300);

    expect(actionSource).toContain("proposal.microwaveMountBottom");
	    expect(actionSource).toContain("overRangeMicrowaveBridge: true");
    expect(previewSource).toContain("The 16″ MW-30 runs from 56″ to 72″");
    expect(previewSource).toContain("bridge begins at 72″");
    expect(source).not.toContain("rangeCompanionClearanceIn");
    expect(source).not.toContain("Microwave clearance");
  });

  it("offers the same real bridge when MW-30 is placed directly over an existing range", () => {
    const addStart = source.indexOf("const addCabinet = useCallback");
    const rangePromptStart = source.indexOf("if (!requestedIslandFace && isRangeOrOven", addStart);
    const microwavePromptStart = source.indexOf("if (!requestedIslandFace && otrRangeUid && isOverRangeMicrowave", rangePromptStart);
    const microwavePrompt = source.slice(microwavePromptStart, microwavePromptStart + 1500);

    expect(microwavePromptStart).toBeGreaterThan(rangePromptStart);
    expect(microwavePrompt).toContain("rangeCompanionProposal(");
    expect(microwavePrompt).toContain("microwaveAlreadyPlaced: true");
    expect(microwavePrompt).toContain("Add the matching wall cabinet directly above it?");
  });

  it("revalidates active source availability and collision-clears both additions before changing the plan", () => {
    const actionStart = source.indexOf("const addApprovedRangeCompanions = useCallback");
    const actionEnd = source.indexOf("// Manual filler", actionStart);
    const actionSource = source.slice(actionStart, actionEnd);

    expect(actionSource).toContain("bridgeStillAvailable");
    expect(actionSource).toContain("microwaveStillAvailable");
    expect(actionSource).toContain("existingHood");
    expect(actionSource).toContain("existingMicrowave");
    expect(actionSource).toContain("const additions = existingMicrowave ? [bridge] : [microwave, bridge]");
    expect(actionSource).toContain("${bridge.masterCode} was added above the existing ${microwave.masterCode}");
    expect(actionSource).toContain("appendCollisionFreePlacements(placedRef.current, additions, room)");
    expect(actionSource).toContain("Existing cabinets were left unchanged.");
    expect(actionSource).toContain("setRangeCompanionPrompt(null)");
  });

  it("does not describe the layout-only microwave as a priced cabinet source", () => {
    const previewStart = source.indexOf("data-testid=\"range-companion-source-preview\"");
    const previewSource = source.slice(previewStart, previewStart + 2300);

    expect(previewSource).toContain("layout appliance; quote separately");
    expect(previewSource).not.toContain("price will be added");
  });
});

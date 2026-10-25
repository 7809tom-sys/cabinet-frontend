import fs from "node:fs";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Designer delete-and-replace release rule", () => {
	it("synchronously removes the cabinet from the committed placement reference before another cabinet can be added", () => {
	  expect(source).toContain("const removeCabinetsAndReleaseVoid = useCallback((uids: string[], removeSharedFillerGroups = false) => {");
	  expect(source).toContain("const removeCabinetAndReleaseVoid = useCallback((uid: string) => {");
	  expect(source).toContain("const committed = placedRef.current;");
	  expect(source).toContain("let next = uids.reduce(");
	  expect(source).toContain("placedRef.current = next;");
	  expect(source).toContain("setPlaced(next);");
	});

  it("clears sink, selection, fit, and alternate-placement reservations that can create a phantom occupied void", () => {
	  expect(source).toContain("removed.forEach((cabinet) => deleteAttachedSinkFixtures(cabinet));");
	  expect(source).toContain("setSelectedUid((current) => current && uidSet.has(current) ? null : current);");
    expect(source).toContain("setSelectedSinkUid(null);");
    expect(source).toContain("setFailedWallFit(null);");
    expect(source).toContain("setAlternateWallRecommendation(null);");
    expect(source).toContain("setAlternateIslandFaceRecommendation(null);");
  });

	it("uses the same release helper for toolbar, keyboard, on-canvas, and grouped sidebar cabinet removal", () => {
	  expect(source).toContain("removeCabinetAndReleaseVoid(selectedUid);");
	  expect(source).toContain("removeCabinetAndReleaseVoid(uid);");
	  expect(source).toContain("removeCabinetsAndReleaseVoid(uids, true);");
	  expect(source).toContain("const deleteWholeGroup = useCallback((uids: string[]) => {");
	});
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const translations = readFileSync(new URL("../lib/i18n/site.ts", import.meta.url), "utf8");

describe("Design Tool Drop to countertop", () => {
  it("uses the authoritative countertop height, ceiling, collision, warning, and exact-UID commit paths", () => {
    const start = source.indexOf("const dropToCountertop = useCallback");
    const end = source.indexOf("// Remove ONE instance", start);
    expect(start).toBeGreaterThan(-1);
    const callback = source.slice(start, end);
    expect(callback).toContain("placedRef.current");
	    expect(callback).toContain("countertopMountedCabinet(current)");
	    expect(callback).toContain("wallCabinetVerticalMoveLimit(candidate, room)");
	    expect(callback).toContain("STD.COUNTERTOP_HEIGHT + elevationBox(candidate, room).height");
	    expect(callback).toContain("shouldBlockPlacementCollision(candidate, peers, customPlacementMode, room)");
    expect(callback).toContain("wallCabinetPlacementReason(candidate, room, peers, openings)");
    expect(callback).toContain("commitThreeDCabinetCandidate(currentPlaced, uid, candidate)");
    expect(callback).toContain("placedRef.current = nextPlaced");
    expect(callback).toContain("setPlaced(nextPlaced)");
  });

  it("places Drop to countertop immediately beside Drop to floor in desktop and responsive touch controls", () => {
    const desktopStart = source.indexOf('{selectedCab.placement === "wall" && !isClosetPart(selectedCab.masterCode) && (');
    expect(desktopStart).toBeGreaterThan(-1);
    const desktopEnd = source.indexOf("{isBlindCorner", desktopStart);
	    const desktop = source.slice(desktopStart, desktopEnd);
	    expect(desktop).toContain("<SelectedCabinetDropActions");
	    expect(desktop.indexOf("onDropToCountertop={() => dropToCountertop(selectedCab.uid)}")).toBeGreaterThan(-1);
	    expect(desktop.indexOf("onDropToFloor={() => dropToFloor(selectedCab.uid)}")).toBeGreaterThan(desktop.indexOf("onDropToCountertop={() => dropToCountertop(selectedCab.uid)}"));

    const mobileStart = source.indexOf('{selectedCab.placement === "wall" && (', desktopEnd);
    expect(mobileStart).toBeGreaterThan(-1);
    const mobileEnd = source.indexOf("{isBlindCorner", mobileStart);
    const mobile = source.slice(mobileStart, mobileEnd);
	    expect(mobile).toContain("<SelectedCabinetDropActions");
	    expect(mobile).toContain('!isClosetPart(selectedCab.masterCode) && <SelectedCabinetDropActions');
	    expect(mobile).toContain("touch");
	    expect(mobile.indexOf("onDropToCountertop={() => dropToCountertop(selectedCab.uid)}")).toBeGreaterThan(-1);
	    expect(mobile.indexOf("onDropToFloor={() => dropToFloor(selectedCab.uid)}")).toBeGreaterThan(mobile.indexOf("onDropToCountertop={() => dropToCountertop(selectedCab.uid)}"));
  });

  it("provides the countertop action label, title, lock message, and success message in every supported locale", () => {
    for (const key of ["dt_t_unlock_drop_countertop", "dt_cx_drop_countertop", "dt_cx_drop_to_countertop", "dt_toast_dropped_countertop"]) {
      expect(translations.split(`${key}:`).length - 1).toBe(3);
    }
  });
});

/**
 * U.S. Cabinet Depot "Casselberry" (Warm Ivory), added by
 * docs/sql/0246_add_casselberry_uscd.tidb.sql. The fixture is the row that
 * script inserts; its id and styleCode are not known until Tom runs it.
 *
 * Until Tom accepts a door render, the door is its own saved color #EEEADF.
 * The measured swatch table, WalzCraft sheets, paint chips, and the name
 * estimator never replace it, and it is not snapped to a brand palette.
 */
import { describe, expect, it } from "vitest";
import row from "./fixtures/casselberryUscd.json";
import { resolveDoorColor, SWATCH_HEX_TABLE, type DoorColorInput } from "./doorColorResolve";
import { brandDoorSurfaceHex, standardShakerDlFacePlan } from "./shakerDoorBlueprint";
import paintChips from "../data/door-colors/sherwin-williams-paint.json";

const CASSELBERRY = row as DoorColorInput;
const WARM_IVORY = "#eeeadf";
const USCD = 210002;

/** The existing USCD Casselberry Antique White row, and its measured swatch. */
const ANTIQUE_WHITE_ID = 330026;
const ANTIQUE_WHITE_HEX = "#ede0c8";

const GUESSED_SOURCES = ["swatch-table", "walzcraft", "estimator", "pre-209"] as const;

describe("USCD Casselberry Warm Ivory with no accepted render", () => {
  it("is the fixture the SQL inserts", () => {
    expect(CASSELBERRY.distributorId).toBe(USCD);
    expect(CASSELBERRY.approvedVersionId).toBeNull();
    expect(CASSELBERRY.renderHex).toBeNull();
    expect(CASSELBERRY.color).toBe("#EEEADF");
  });

  it("resolves to #EEEADF, its own saved catalog color", () => {
    const decision = resolveDoorColor(CASSELBERRY);
    expect(decision.appliedHex).toBe(WARM_IVORY);
    expect(decision.appliedSource).toBe("catalog-color");
    expect(decision.candidateSource).toBe("catalog-color");
    expect(decision.appliedCategory).toBe("paint");
    expect(decision.usesGrain).toBe(false);
    expect(decision.layers.acceptedRender).toBeNull();
    expect(decision.layers.renderHex).toBeNull();
  });

  it("is never replaced by a swatch, WalzCraft, estimator, or pre-209 color", () => {
    const decision = resolveDoorColor(CASSELBERRY);
    expect(GUESSED_SOURCES).not.toContain(decision.appliedSource);
    expect(decision.review.keptBecause).not.toBe("estimator-disagreed");
  });

  it("keeps #EEEADF even where the Casselberry Antique White swatch would match", () => {
    const swatch = SWATCH_HEX_TABLE.find((entry) => entry.id === ANTIQUE_WHITE_ID)!;
    expect(swatch.hex).toBe(ANTIQUE_WHITE_HEX);
    // Matched by the 330026 id, and by the swatch's own style name.
    for (const lookalike of [
      { ...CASSELBERRY, id: ANTIQUE_WHITE_ID },
      { ...CASSELBERRY, aliasName: swatch.style },
    ]) {
      const decision = resolveDoorColor(lookalike);
      expect(decision.layers.swatch?.hex).toBe(ANTIQUE_WHITE_HEX);
      expect(decision.appliedHex).toBe(WARM_IVORY);
      expect(decision.appliedSource).toBe("catalog-color");
    }
  });

  it("is not snapped to a nearest paint chip or the brand palette", () => {
    const chips = (paintChips as { colors: { hex: string }[] }).colors.map((chip) => chip.hex.toLowerCase());
    expect(chips).not.toContain(WARM_IVORY);
    const decision = resolveDoorColor(CASSELBERRY);
    expect(chips).not.toContain(decision.appliedHex);
    expect(decision.appliedHex).toBe(WARM_IVORY);
    expect(brandDoorSurfaceHex(WARM_IVORY)).not.toBe(WARM_IVORY);
  });

  it("is the same color for wall, base, and tall cabinets", () => {
    // A raised panel is not on the DL shaker retint path, so no placement gets its own tint.
    for (const placement of ["wall", "base", "tall"]) {
      expect(standardShakerDlFacePlan(CASSELBERRY, placement)).toBeNull();
    }
    const hexes = new Set(Array.from({ length: 3 }, () => resolveDoorColor({ ...CASSELBERRY }).appliedHex));
    expect([...hexes]).toEqual([WARM_IVORY]);
  });

  it("gives way to an accepted render once Tom approves one", () => {
    const decision = resolveDoorColor({ ...CASSELBERRY, approvedVersionId: 9001, renderHex: "#e9e4d6" });
    expect(decision.appliedHex).toBe("#e9e4d6");
    expect(decision.appliedSource).toBe("accepted-render");
    const revoked = resolveDoorColor({ ...CASSELBERRY, approvedVersionId: null, renderHex: null });
    expect(revoked.appliedHex).toBe(WARM_IVORY);
  });
});

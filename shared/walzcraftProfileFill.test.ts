import { describe, expect, it } from "vitest";
import { WALZCRAFT_DISTRIBUTOR_DOORS } from "./walzcraftDistributorMatches";
import { applyFill, parseInches, planProfileFill, readGlazing, saveGlazing, type ProfileFormValues } from "./walzcraftProfileFill";

const blank: ProfileFormValues = { railWidth: "", stileWidth: "", panelConstruction: "flat", bevelWidth: "", bevelDepth: "", insideEdgeProfile: "", drawerFrontType: "slab", finishSheen: "satin", profileNotes: "", sourceSpecification: "", glazed: "", glazeColor: "", glazeColorOther: "" };
const door = (id: string) => WALZCRAFT_DISTRIBUTOR_DOORS.find((d) => d.id === id)!;

describe("WalzCraft approve → form fill", () => {
  it("parses only stated inch values", () => {
    expect(parseInches('1 1/2" (product page)')).toBe(1.5);
    expect(parseInches('3" Stiles')).toBe(3);
    expect(parseInches("unknown")).toBeNull();
  });
  it("fills verbatim catalog profile names, distributor citation, and lists gaps without guessing", () => {
    const plan = planProfileFill(door("kitchen-crest-sw"), blank);
    const byField = Object.fromEntries(plan.changes.map((c) => [c.field, c.to]));
    expect(byField.insideEdgeProfile).toBe('SR100 2 3/4"');
    expect(byField.profileNotes).toBe('WalzCraft S899 Tradewind — Stile/rail profile: SR100 2 3/4"; Panel profile: MDF Flat; Thickness: 3/4"');
    expect(byField.sourceSpecification).toBe("Kitchen Crest · WalzCraft S899 (published profile drawing)");
    expect(byField.railWidth).toBeUndefined();
    expect(plan.missing).toEqual(expect.arrayContaining(["Rail width: not in WalzCraft data", "Stile width: not in WalzCraft data", "Bevel width: not in WalzCraft data", "Finish sheen: not in WalzCraft data", "Glazed: not in WalzCraft data"]));
  });
  it("Barrington: raised panel, glaze no, glaze color missing", () => {
    const plan = planProfileFill(door("faircrest-asp"), blank);
    const byField = Object.fromEntries(plan.changes.map((c) => [c.field, c.to]));
    expect(byField.panelConstruction).toBe("raised");
    expect(byField.glazed).toBe("no");
    expect(plan.missing).toContain("Glazing color: not in WalzCraft data");
  });
  it("slab doors set panel + front to slab", () => {
    const plan = planProfileFill(door("altaeuro-zsw"), { ...blank, drawerFrontType: "five-piece-flat" });
    expect(plan.changes.find((c) => c.field === "drawerFrontType")?.to).toBe("slab");
    expect(plan.changes.find((c) => c.field === "panelConstruction")?.to).toBe("slab");
  });
  it("applyFill only touches planned fields and is undoable by keeping the old values", () => {
    const before = { ...blank, bevelDepth: "0.2" };
    const after = applyFill(before, planProfileFill(door("kitchen-crest-sw"), before));
    expect(after.bevelDepth).toBe("0.2");
    expect(before.insideEdgeProfile).toBe("");
  });
  it("glazing is stored in localStorage only", () => {
    const m = new Map<string, string>(); const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    saveGlazing(7, { glazed: "yes", glazeColor: "other", glazeColorOther: "Brown" }, st);
    expect(readGlazing(7, st).glazeColorOther).toBe("Brown");
  });
});

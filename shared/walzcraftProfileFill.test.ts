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
    expect(parseInches('2-1/4"')).toBe(2.25);
  });
  it("fills verbatim catalog profile names, distributor citation, and lists gaps without guessing", () => {
    const plan = planProfileFill(door("kitchen-crest-sw"), blank);
    const byField = Object.fromEntries(plan.changes.map((c) => [c.field, c.to]));
    expect(byField.insideEdgeProfile).toBe('SR100 2 3/4"');
    expect(byField.profileNotes).toBe('WalzCraft S899 Tradewind — Stile/rail profile: SR100 2 3/4"; Panel profile: MDF Flat; Thickness: 3/4"');
    expect(byField.sourceSpecification).toBe("Kitchen Crest · WalzCraft S899 (published profile drawing)");
    expect(byField.railWidth).toBe("2.75");
    expect(byField.stileWidth).toBe("2.75");
    expect(plan.changes.find((c) => c.field === "railWidth")?.source).toMatch(/SR100 2 3\/4".*width stated in the WalzCraft profile code/);
    const labels = plan.missing.map((m) => m.split(" — ")[0]);
    expect(labels).toEqual(expect.arrayContaining(["Bevel width", "Finish sheen", "Glazed"]));
    expect(labels).not.toContain("Rail width");
    expect(plan.missing.every((m) => / — left blank: .+/.test(m))).toBe(true);
  });
  it("Barrington: raised panel, glaze no, glaze color missing", () => {
    const plan = planProfileFill(door("faircrest-asp"), blank);
    const byField = Object.fromEntries(plan.changes.map((c) => [c.field, c.to]));
    expect(byField.panelConstruction).toBe("raised");
    expect(byField.glazed).toBe("no");
    expect(plan.missing.some((m) => m.startsWith("Glazing color — left blank"))).toBe(true);
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
  it("S109 widths come from the cited reference sheet; SR100-only styles stay unknown", async () => {
    const { WALZCRAFT_CATALOG_PROFILES: P } = await import("./walzcraftCatalogProfiles");
    expect(P.S109.frame_width).toBe('2-1/4"');
    expect(P.S109.bevel_reveal).toBe('1"');
    expect(P.S109.sources.frame_width).toMatch(/S109_reference_sheet\.md.*MP722-57/);
    expect(P.S949.frame_width).toBe('1 1/2"');
    expect(P.S150.frame_width).toBe("unknown");
    const plan = planProfileFill(door("kitchen-crest-sw"), blank);
    expect(plan.missing.some((m) => /Rail width/.test(m))).toBe(false);
  });
  it("tells why rail width is blank for a style without published width", () => {
    const d = WALZCRAFT_DISTRIBUTOR_DOORS.find((x) => x.matches?.[0]?.walzcraft.startsWith("S150"));
    if (!d) return;
    const plan = planProfileFill(d, blank);
    expect(plan.missing.find((m) => m.startsWith("Rail width"))).toMatch(/publishes no frame width for S150/);
  });
  it("SR100 2 3/4\" door overwrites an existing 3\" rail and stile width, with old → new and undo", () => {
    const before = { ...blank, railWidth: "3", stileWidth: "3" };
    const plan = planProfileFill(door("kitchen-crest-sw"), before);
    const rail = plan.changes.find((c) => c.field === "railWidth")!;
    const stile = plan.changes.find((c) => c.field === "stileWidth")!;
    expect([rail.from, rail.to, stile.from, stile.to]).toEqual(["3", "2.75", "3", "2.75"]);
    expect(rail.source).toContain('stile_rail_profile "SR100 2 3/4"');
    expect(stile.source).toBe(rail.source);
    const after = applyFill(before, plan);
    expect(after.railWidth).toBe("2.75");
    expect(after.stileWidth).toBe("2.75");
  });
});

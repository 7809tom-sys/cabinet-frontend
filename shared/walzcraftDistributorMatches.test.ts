import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  WALZCRAFT_DISTRIBUTOR_DOORS,
  candidateDoors,
  colorLabel,
  doorForStyle,
  featureConfidence,
  readApprovals,
  rowText,
  writeApproval,
} from "./walzcraftDistributorMatches";
import { WALZCRAFT_COLOR_PATTERNS, colorPatternsCsv, nearestShade, saveColorSelection, readColorSelections } from "./walzcraftColorPatterns";

const memStore = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe("WalzCraft distributor matches (from *_vs_WalzCraft.csv)", () => {
  it("covers all four distributors", () => {
    expect(new Set(WALZCRAFT_DISTRIBUTOR_DOORS.map((d) => d.distributor))).toEqual(new Set(["Faircrest", "Kitchen Crest", "DL Cabinetry", "AltaEuro"]));
    expect(WALZCRAFT_DISTRIBUTOR_DOORS).toHaveLength(45);
  });
  it("keeps CSV profile % and never invents a color %", () => {
    const sw = WALZCRAFT_DISTRIBUTOR_DOORS.find((d) => d.id === "kitchen-crest-sw")!;
    expect(sw.matches.map((m) => m.confidencePct)).toEqual([45, 25, 15, 15]);
    expect(WALZCRAFT_DISTRIBUTOR_DOORS.every((d) => d.colorMatchPct === null && d.colorEstimated)).toBe(true);
    expect(rowText(sw)).toBe("Kitchen Crest · Shaker White → WalzCraft S899 Tradewind · 45% profile match · Color: Classic White (WalzCraft) · color match % not in source (estimated)");
    expect(featureConfidence(sw).every((f) => f.pct === null)).toBe(true);
  });
  it("labels unnamed codes and unmapped colors honestly", () => {
    const vs = WALZCRAFT_DISTRIBUTOR_DOORS.find((d) => d.id === "dl-cabinetry-vs")!;
    expect(rowText(vs)).toContain("VS (name not in source)");
    const lsa = WALZCRAFT_DISTRIBUTOR_DOORS.find((d) => d.id === "altaeuro-lsa")!;
    expect(colorLabel(lsa)).toBe("Color: no WalzCraft color mapped in source");
  });
  it("brochure photos referenced by the data exist under client/public", () => {
    for (const d of WALZCRAFT_DISTRIBUTOR_DOORS) {
      if (d.photo) expect(existsSync(path.resolve(__dirname, "../client/public", "." + d.photo))).toBe(true);
    }
  });
  it("finds distributor doors for the Barrington template and for slabs", () => {
    const ids = candidateDoors({ doorType: "five-piece", templateId: "S592", templateName: "Barrington", shadeName: "Classic White" }).map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(["faircrest-asp", "dl-cabinetry-pw", "dl-cabinetry-gw"]));
    expect(candidateDoors({ doorType: "five-piece", templateId: null })).toEqual([]);
    expect(candidateDoors({ doorType: "slab", templateId: null, shadeName: "Classic White" }).map((d) => d.id)).toEqual(["altaeuro-zsw", "altaeuro-pgw"]);
  });
  it("matches existing featured styles by distributor door name", () => {
    expect(doorForStyle({ ourName: "Something", distributorName: "Aspen White" })?.id).toBe("faircrest-asp");
    expect(doorForStyle({ ourName: "Nope" })).toBeNull();
  });
  it("stores approvals in local storage only", () => {
    const st = memStore();
    writeApproval("faircrest-ws", "approved", st);
    expect(readApprovals(st)).toEqual({ "faircrest-ws": "approved" });
    writeApproval("faircrest-ws", null, st);
    expect(readApprovals(st)).toEqual({});
  });
});

describe("WalzCraft color patterns", () => {
  it("seeds up to 4 candidates from closest_finish + family, all estimated", () => {
    const lg = WALZCRAFT_COLOR_PATTERNS.find((r) => r.doorId === "kitchen-crest-lg")!;
    expect(lg.candidates.map((c) => c.name)).toEqual(["Stone Gray", "City Gray", "Castle Gray", "Rain Cloud"]);
    expect(WALZCRAFT_COLOR_PATTERNS.flatMap((r) => r.candidates).every((c) => c.matchPct === "estimated")).toBe(true);
    expect(WALZCRAFT_COLOR_PATTERNS.find((r) => r.doorId === "altaeuro-zsw")!.slab).toBe("Slab · 100%");
    expect(WALZCRAFT_COLOR_PATTERNS.find((r) => r.doorId === "altaeuro-lsa")!.candidates).toEqual([]);
  });
  it("nearest shade + selection storage", () => {
    expect(nearestShade("#a8a59c")).toMatchObject({ matchPct: 100 });
    expect(nearestShade("#a8a59c").shade.name).toBe("Stone Gray");
    const st = memStore();
    saveColorSelection("x", { shadeName: "Black", hex: "#1b1b1b", matchPct: 97 }, st);
    expect(readColorSelections(st).x.shadeName).toBe("Black");
    expect(colorPatternsCsv(WALZCRAFT_COLOR_PATTERNS).split("\n")[0]).toContain("color4_match");
  });
});

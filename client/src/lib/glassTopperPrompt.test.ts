import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/autoDesignRealCatalog.json";
import {
  canTakeTopperAtHeight,
  fillEveryMatchingWallCabinetWithTopper,
  glassTopperPromptOptions,
  glassTopperPromptParentCodes,
} from "./glassTopperPrompt";
import { DEFAULT_ROOM, wallPlacementAt, type DesignCabinet, type PlacedCabinet } from "./design";

type Fixture = Record<string, { base: unknown[]; wall: unknown[]; accessory: unknown[] }>;
const REAL = catalogFixture as unknown as Fixture;
const wallRows = REAL["330011"]!.wall as DesignCabinet[];

function upper(uid: string, masterCode: string, width: number, start: number, height = 30): PlacedCabinet {
  const spot = wallPlacementAt(start, width, 12, "top", DEFAULT_ROOM);
  return {
    uid,
    cabinetId: 1,
    masterCode,
    description: `${width} inch wall cabinet`,
    category: "Wall",
    subCategory: "Wall",
    placement: "wall",
    ...spot,
    width,
    depth: 12,
    height,
    mountBottom: 54,
    numberOfDoors: 1,
    numberOfDrawers: 0,
  } as PlacedCabinet;
}

function stacker(masterCode: string, width: number, start: number, parentUid: string): PlacedCabinet {
  const spot = wallPlacementAt(start, width, 12, "top", DEFAULT_ROOM);
  return {
    uid: `stacker-${masterCode}`,
    cabinetId: 2,
    masterCode,
    description: `${width} inch glass stacker`,
    category: "Wall",
    subCategory: "Wall",
    placement: "wall",
    ...spot,
    width,
    depth: 12,
    height: 12,
    mountBottom: 84,
    stackedOnCabinetUid: parentUid,
    glassDoor: true,
    numberOfDoors: 1,
    numberOfDrawers: 0,
  } as PlacedCabinet;
}

describe("rule 12: one glass-topper prompt fills every matching wall cabinet", () => {
  const first = upper("w18-a", "W1830", 18, 0);
  const second = upper("w18-b", "W1830", 18, 18);
  const third = upper("w18-c", "W1830", 18, 36);
  const wider = upper("w30", "W3030", 30, 54);

  it("fills every wall cabinet of the matching width from one prompt", () => {
    const source = stacker("GS-1812", 18, 0, first.uid);
    const placed = [first, second, third, wider, source];
    const result = fillEveryMatchingWallCabinetWithTopper({
      placed,
      stackerSourceUid: source.uid,
      room: DEFAULT_ROOM,
      stackerCatalog: wallRows,
    });
    const filled = result.candidates.map((candidate) => candidate.parentUid).sort();
    // The two bare 18" cabinets beside the source are all filled by the same answer.
    expect(filled).toEqual(["w18-b", "w18-c"]);
    expect(result.matchingWidthCount).toBeGreaterThanOrEqual(3);
  });

  it("never fills a cabinet of a different width", () => {
    const source = stacker("GS-1812", 18, 0, first.uid);
    const result = fillEveryMatchingWallCabinetWithTopper({
      placed: [first, wider, source],
      stackerSourceUid: source.uid,
      room: DEFAULT_ROOM,
      stackerCatalog: wallRows,
    });
    expect(result.candidates.some((candidate) => candidate.parentUid === "w30")).toBe(false);
  });

  it("names a matching cabinet it could not fill instead of skipping it silently", () => {
    const source = stacker("GS-1812", 18, 0, first.uid);
    // A diagonal (WDC) wall corner is not the same structural family as a straight W, so the
    // straight 18" glass topper cannot go on it — and the miss must be named, not dropped.
    const diagonal = upper("wdc18", "WDC2418GD", 18, 54);
    const result = fillEveryMatchingWallCabinetWithTopper({
      placed: [first, diagonal, source],
      stackerSourceUid: source.uid,
      room: DEFAULT_ROOM,
      stackerCatalog: wallRows,
    });
    expect(result.candidates.some((candidate) => candidate.parentUid === "wdc18")).toBe(false);
    expect(result.findings.length).toBeGreaterThan(0);
    for (const finding of result.findings) {
      expect(finding.ruleId).toBe("glass-topper-all-matching");
      expect(finding.severity).toBe("warning");
      expect(finding.title.length).toBeGreaterThan(0);
    }
  });

  it("lists the parent codes the one prompt will fill", () => {
    const source = stacker("GS-1812", 18, 0, first.uid);
    const result = fillEveryMatchingWallCabinetWithTopper({
      placed: [first, second, third, source],
      stackerSourceUid: source.uid,
      room: DEFAULT_ROOM,
      stackerCatalog: wallRows,
    });
    expect(glassTopperPromptParentCodes(result.candidates).length).toBe(result.candidates.length);
  });

  it("reports the heights one prompt may offer and whether a parent can take one", () => {
    const source = stacker("GS-1812", 18, 0, first.uid);
    const options = glassTopperPromptOptions({ placed: [first, source], room: DEFAULT_ROOM, stackerCatalog: wallRows });
    expect(Array.isArray(options)).toBe(true);
    expect(canTakeTopperAtHeight({
      parent: second,
      placed: [first, second, source],
      room: DEFAULT_ROOM,
      stacker: { ...source, uid: "probe" },
    })).toBe(true);
  });

  it("ignores a source that is not a stacker", () => {
    const result = fillEveryMatchingWallCabinetWithTopper({
      placed: [first, second],
      stackerSourceUid: first.uid,
      room: DEFAULT_ROOM,
      stackerCatalog: wallRows,
    });
    expect(result.candidates).toEqual([]);
    expect(result.findings).toEqual([]);
  });
});

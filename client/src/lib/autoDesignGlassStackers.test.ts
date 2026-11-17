import { describe, expect, it } from "vitest";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { applyGlassUpperPreference, glassStackerRowFor, autoDesignGlassStackerCatalog } from "./autoDesignFormOptions";
import { emptyAutoDesignIntake, type AutoDesignIntake } from "./autoDesignFifteenRules";
import { elevationBox, type DesignCabinet, type PlacedCabinet, type RoomData } from "./design";

// Tom, Nov 17 2026: "glass" means 12, 15 or 18 in glass stackers ON TOP of the
// regular uppers, not a GD version of the 30 in upper. Recorded catalog line
// 330014 sells W…12GD / W…15GD / W…18GD stackers and no 39 in stacker.
const WALL = (matrixCatalog as unknown as Record<string, { wall: DesignCabinet[] }>)["330014"]!.wall;
const row = (code: string) => {
  const found = WALL.find((item) => item.masterCode === code);
  if (!found) throw new Error(`fixture has no ${code}`);
  return found;
};
const GLASS: AutoDesignIntake = { ...emptyAutoDesignIntake(), construction: "new", preferences: ["glass-uppers"] };

function upper(code: string, x: number, uid: string): PlacedCabinet {
  const r = row(code);
  return {
    uid, cabinetId: r.id, masterCode: r.masterCode, description: r.description ?? "",
    category: r.category ?? null, subCategory: r.subCategory ?? null,
    placement: "wall", x, y: 0, rotation: 0, wallId: "top",
    width: Number(r.width), depth: Number(r.depth), height: Number(r.height), mountBottom: 54,
  } as PlacedCabinet;
}

const room = (ceilingHeight: number) => ({ width: 144, depth: 120, ceilingHeight }) as RoomData;
const plan = () => [upper("W2430", 0, "u1"), upper("W1230", 24, "u2"), upper("W-39-30", 36, "u3")];

describe("Auto Design glass stackers above the uppers", () => {
  it("108 in ceiling: 18 in stackers on each upper of matching width, top at 102 in, uppers stay solid", () => {
    const r = room(108);
    const result = applyGlassUpperPreference({ placed: plan(), wallCatalog: WALL, intake: GLASS, room: r, wallHeightIn: 30 });
    expect(result.stackers.map((item) => item.masterCode).sort()).toEqual(["W1218GD", "W2418GD"]);
    for (const stacker of result.stackers) {
      const box = elevationBox(stacker, r);
      expect(box.bottom).toBeCloseTo(84, 2);
      expect(box.bottom + box.height).toBeCloseTo(102, 2);
      expect(stacker.cabinetId).toBe(row(stacker.masterCode).id);
      expect(stacker.glassDoor).toBe(true);
    }
    expect(result.stackers.find((item) => item.masterCode === "W2418GD")?.stackedOnCabinetUid).toBe("u1");
    expect(result.stackers.find((item) => item.masterCode === "W1218GD")?.stackedOnCabinetUid).toBe("u2");
    // The regular uppers keep their solid doors.
    expect(result.placed.filter((item) => item.uid.startsWith("u")).every((item) => item.glassDoor !== true)).toBe(true);
    // The 39 in upper has no same-width stacker in this line: named, not invented.
    const warning = result.findings.find((finding) => finding.code === "preference-glass-stackers-skipped");
    expect(warning?.detail).toMatch(/W-39-30 \(39″ wide\)/);
    expect(result.findings.some((finding) => /at this height/.test(finding.detail))).toBe(false);
  });

  it("96 in ceiling: 12 in stackers (top at 96 in)", () => {
    const r = room(96);
    const result = applyGlassUpperPreference({ placed: plan(), wallCatalog: WALL, intake: GLASS, room: r, wallHeightIn: 30 });
    expect(result.stackers.map((item) => item.masterCode).sort()).toEqual(["W1212GD", "W2412GD"]);
    for (const stacker of result.stackers) {
      const box = elevationBox(stacker, r);
      expect(box.bottom + box.height).toBeCloseTo(96, 2);
    }
  });

  it("102 in ceiling: 18 in still fits exactly; 100 in falls back to 15 in", () => {
    expect(applyGlassUpperPreference({ placed: plan(), wallCatalog: WALL, intake: GLASS, room: room(102), wallHeightIn: 30 }).stackers.every((item) => Number(item.height) === 18)).toBe(true);
    expect(applyGlassUpperPreference({ placed: plan(), wallCatalog: WALL, intake: GLASS, room: room(100), wallHeightIn: 30 }).stackers.every((item) => Number(item.height) === 15)).toBe(true);
  });

  it("84 in ceiling: no stacker fits and the warning says so", () => {
    const result = applyGlassUpperPreference({ placed: plan(), wallCatalog: WALL, intake: GLASS, room: room(84), wallHeightIn: 30 });
    expect(result.stackers).toHaveLength(0);
    expect(result.findings[0]?.detail).toMatch(/No glass stacker fits under the ceiling above W1230/);
  });

  it("blind corner uppers are skipped and named; no glass pick means no stackers", () => {
    const placed = [upper("WBC2730", 0, "b1")];
    const result = applyGlassUpperPreference({ placed, wallCatalog: WALL, intake: GLASS, room: room(108), wallHeightIn: 30 });
    expect(result.stackers).toHaveLength(0);
    expect(result.findings[0]?.detail).toMatch(/WBC2730 is a blind corner/);
    expect(applyGlassUpperPreference({ placed: plan(), wallCatalog: WALL, intake: { ...GLASS, preferences: [] }, room: room(108), wallHeightIn: 30 }).stackers).toHaveLength(0);
  });

  it("never pairs a DCW diagonal stacker with a straight W upper", () => {
    const catalog = autoDesignGlassStackerCatalog(WALL);
    expect(glassStackerRowFor({ masterCode: "W2430", width: 24 }, 18, catalog)?.masterCode).toBe("W2418GD");
    expect(glassStackerRowFor({ masterCode: "W3930", width: 39 }, 18, catalog)).toBeNull();
  });
});

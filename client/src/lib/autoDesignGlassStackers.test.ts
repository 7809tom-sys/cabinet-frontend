import { describe, expect, it } from "vitest";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { applyGlassUpperPreference, glassStackerRowFor, autoDesignGlassStackerCatalog, autoDesignUpperRuns } from "./autoDesignFormOptions";
import { emptyAutoDesignIntake, type AutoDesignIntake } from "./autoDesignFifteenRules";
import { elevationBox, isStacker, type DesignCabinet, type PlacedCabinet, type RoomData } from "./design";

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
// One run that can be 100% glass (W2418GD / W1218GD … are sold).
const plan = () => [upper("W2430", 0, "u1"), upper("W1230", 24, "u2")];

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
    expect(result.findings.filter((finding) => finding.severity === "warning")).toEqual([]);
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
    expect(result.findings[0]?.code).toBe("preference-glass-run-plain");
    expect(result.findings[0]?.detail).toMatch(/W1230 \(even the shortest stacker would reach/);
  });

  it("blind corner uppers are skipped and named; no glass pick means no stackers", () => {
    const placed = [upper("WBC2730", 0, "b1")];
    const result = applyGlassUpperPreference({ placed, wallCatalog: WALL, intake: GLASS, room: room(108), wallHeightIn: 30 });
    expect(result.stackers).toHaveLength(0);
    expect(result.findings[0]?.detail).toMatch(/WBC2730 \(a blind corner takes no straight glass stacker\)/);
    expect(applyGlassUpperPreference({ placed: plan(), wallCatalog: WALL, intake: { ...GLASS, preferences: [] }, room: room(108), wallHeightIn: 30 }).stackers).toHaveLength(0);
  });

  it("never pairs a DCW diagonal stacker with a straight W upper", () => {
    const catalog = autoDesignGlassStackerCatalog(WALL);
    expect(glassStackerRowFor({ masterCode: "W2430", width: 24 }, 18, catalog)?.masterCode).toBe("W2418GD");
    expect(glassStackerRowFor({ masterCode: "W3930", width: 39 }, 18, catalog)).toBeNull();
  });
});

// Rule 1b (Tom, Nov 18 2026, 11:22 AM CT): "If a run of uppers cannot be filled 100%
// with glass cabinets, do not put any glass cabinets in that run at all. No partial glass."
describe("Rule 1b: no partial glass in a run of uppers", () => {
  it("a run that can be 100% glass gets a glass stacker on every upper", () => {
    const result = applyGlassUpperPreference({ placed: plan(), wallCatalog: WALL, intake: GLASS, room: room(108), wallHeightIn: 30 });
    expect(result.stackers.map((item) => item.stackedOnCabinetUid).sort()).toEqual(["u1", "u2"]);
  });

  it("a run with one upper that has no glass stacker (W-39-30) gets no glass at all, and the finding names the run and the blocker", () => {
    const placed = [...plan(), upper("W-39-30", 36, "u3")];
    const result = applyGlassUpperPreference({ placed, wallCatalog: WALL, intake: GLASS, room: room(108), wallHeightIn: 30 });
    expect(result.stackers).toEqual([]);
    expect(result.placed.some((item) => isStacker(item))).toBe(false);
    const finding = result.findings.find((entry) => entry.code === "preference-glass-run-plain");
    expect(finding?.detail).toMatch(/W2430 \+ W1230 \+ W-39-30\) stays plain because of W-39-30 \(this line sells no 12″, 15″ or 18″ glass stacker 39″ wide\)/);
  });

  it("another run on the same wall, past an open break, stays 100% glass", () => {
    // W-39-30 at 0–39 is its own run; a 21 in window gap; W2430 + W1230 at 60–96 is another.
    const placed = [upper("W-39-30", 0, "m1"), upper("W2430", 60, "g1"), upper("W1230", 84, "g2")];
    const result = applyGlassUpperPreference({ placed, wallCatalog: WALL, intake: GLASS, room: room(108), wallHeightIn: 30 });
    expect(result.stackers.map((item) => item.stackedOnCabinetUid).sort()).toEqual(["g1", "g2"]);
    expect(result.findings.find((entry) => entry.code === "preference-glass-run-plain")?.detail).toMatch(/\(W-39-30\) stays plain/);
  });

  it("a filler between uppers does not break the run, but a bridge or panel does", () => {
    const filler = { ...upper("W1230", 24, "f1"), masterCode: "F330", description: "Filler 3x30", subCategory: "Filler", width: 3 } as PlacedCabinet;
    const runs = autoDesignUpperRuns([upper("W2430", 0, "a"), filler, upper("W-39-30", 27, "b")], [upper("W2430", 0, "a"), upper("W-39-30", 27, "b")], room(108));
    expect(runs.map((run) => run.uppers.map((item) => item.uid))).toEqual([["a", "b"]]);
    const bridge = { ...upper("W1230", 24, "br"), masterCode: "W3015", height: 15, width: 3 } as PlacedCabinet;
    const split = autoDesignUpperRuns([upper("W2430", 0, "a"), bridge, upper("W-39-30", 27, "b")], [upper("W2430", 0, "a"), upper("W-39-30", 27, "b")], room(108));
    expect(split.map((run) => run.uppers.map((item) => item.uid))).toEqual([["a"], ["b"]]);
  });
});

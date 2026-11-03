/**
 * Owner rule: the per-cabinet door/drawer settings in the cabinet edit config are
 * the single source of truth.
 *
 * The renderer (3D and elevation) must read the door count and the drawer count
 * straight from that config for EVERY cabinet and never infer them from a SKU, a
 * description, or a hardcoded type. The example the owner gave: SB30 is configured
 * 2 doors + 1 drawer, and it must render 2 doors and 1 drawer — the elevation used
 * to hardcode a single false front and drop the configured drawer.
 *
 * The type rules that stay in `resolveDoorDrawerCounts` are the fallback for rows
 * that carry no authored face, and they are pinned here too so they cannot be
 * quietly displaced: a plain B-18 keeps one drawer over one door even when a stale
 * supplier count says two, and BEC24 keeps its coded two-door end face.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import { resolveDoorDrawerCounts } from "./cabinetGraphics";
import type { DesignCabinet } from "./design";

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[] };
const REAL = realCatalog as unknown as Record<string, Pack>;

const sinkBase = (code: string, doors: number, drawers: number, layout: string | null = null) => ({
  masterCode: code,
  description: `Sink Base ${code}`,
  category: "Base",
  subCategory: "Sink Base",
  placementType: "base",
  width: Number(code.replace(/\D/g, "")) || 30,
  height: 34.5,
  depth: 24,
  numberOfDoors: doors,
  numberOfDrawers: drawers,
  drawerLayout: layout,
  graphicType: "base_sink",
});

describe("the cabinet edit config decides the faces", () => {
  it("renders SB30 as its configured 2 doors + 1 drawer", () => {
    const counts = resolveDoorDrawerCounts(sinkBase("SB30", 2, 1) as never);
    expect(counts).toEqual({ doors: 2, drawers: 1 });
  });

  it("renders every sink base size from its config, not one hardcoded front", () => {
    for (const [code, doors, drawers] of [
      ["SB24", 2, 1],
      ["SB30", 2, 1],
      ["SB33", 2, 1],
      ["SB36", 2, 1],
      ["SB42", 2, 2],
      ["FSB36", 2, 0],
    ] as const) {
      expect(resolveDoorDrawerCounts(sinkBase(code, doors, drawers) as never)).toEqual({ doors, drawers });
    }
  });

  it("keeps a configured zero: a 0-drawer sink base gets no drawer front", () => {
    expect(resolveDoorDrawerCounts(sinkBase("FSB36", 2, 0) as never)).toEqual({ doors: 2, drawers: 0 });
  });

  it("keeps the configured door count on a farmhouse base that authors 0 doors", () => {
    expect(resolveDoorDrawerCounts(sinkBase("FSB36", 0, 0) as never)).toEqual({ doors: 0, drawers: 0 });
  });

  it("lets a saved drawerLayout refine how many drawer fronts stack", () => {
    // Two authored drawer rows means two fronts, even if the flat count disagrees.
    expect(resolveDoorDrawerCounts(sinkBase("SB36", 2, 1, JSON.stringify([{ count: 2 }])) as never))
      .toEqual({ doors: 2, drawers: 2 });
  });

  it("reads the real catalog rows as the catalog authored them", () => {
    const frameless = REAL["540005"]!.base;
    const sb30 = frameless.find((row) => row.masterCode === "SB30");
    expect(sb30).toBeTruthy();
    expect(resolveDoorDrawerCounts(sb30 as never)).toEqual({ doors: 2, drawers: 1 });
  });

  it("applies the config to base, wall, and tall alike", () => {
    const wall = { masterCode: "W3630", description: '36" Wall', placementType: "wall", width: 36, height: 30, numberOfDoors: 2, numberOfDrawers: 0, graphicType: "wall_2door" };
    expect(resolveDoorDrawerCounts(wall as never)).toEqual({ doors: 2, drawers: 0 });
    const tall = { masterCode: "TP2496", description: '24" Pantry', placementType: "tall", width: 24, height: 96, numberOfDoors: 2, numberOfDrawers: 0, graphicType: "tall_2door" };
    expect(resolveDoorDrawerCounts(tall as never)).toEqual({ doors: 2, drawers: 0 });
  });
});

describe("the coded contracts are not displaced by a stale count", () => {
  it("keeps a plain B-18 as one drawer over one door even when a stale count says two", () => {
    expect(resolveDoorDrawerCounts({
      masterCode: "B-18",
      description: "Base Cabinet",
      placementType: "base",
      width: 18,
      numberOfDoors: 0,
      numberOfDrawers: 2,
      graphicType: "standard_base",
    } as never)).toEqual({ doors: 1, drawers: 1 });
  });

  it("keeps BEC24 on its quarter-octagon two-door end face", () => {
    for (const masterCode of ["BA-24", "BEC-24", "BEC24", "BAC24"]) {
      expect(resolveDoorDrawerCounts({
        masterCode,
        description: '24" Base End Cabinet — 45° Angled End, 1 Door',
        category: "Base",
        subCategory: "Base End Cabinet",
        placementType: "base",
        width: 24,
        numberOfDoors: 1,
        numberOfDrawers: 0,
      } as never)).toEqual({ doors: 2, drawers: 0 });
    }
  });

  it("never invents a face for an explicitly doorless cabinet", () => {
    expect(resolveDoorDrawerCounts({ masterCode: "SB30", noDoor: true, numberOfDoors: 2, numberOfDrawers: 1 } as never))
      .toEqual({ doors: 0, drawers: 0 });
  });
});

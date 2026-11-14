/**
 * Tom (Nov 14 2026, 3:38 PM CT): cabinets showed in the 2D plan but none drew in
 * 3D. The saved-plan scene built every cabinet in one unguarded loop and only
 * attached the cabinet group to the scene after every later pass (countertops,
 * toe kicks, crown, openings, sinks...), so one cabinet or pass that threw
 * dropped the whole kitchen from 3D. These tests pin the isolation: a bad
 * cabinet is skipped and named, the rest still render.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import catalogFixture from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps } from "@/lib/autoDesignLayout";
import { emptyAutoDesignIntake } from "@/lib/autoDesignFifteenRules";
import { APPLIANCES, applianceAsDesignCabinet, type DesignCabinet, type PlacedCabinet, type RoomData, type WallOpening } from "@/lib/design";
import {
  addCabinet,
  addThreeDSceneCabinetSafely,
  existingCabinetSku,
  existingCabinetTransform,
  runThreeDScenePass,
  shouldRenderSavedSceneCabinet,
  threeDCabinetBuildFailureNotice,
  threeDCabinetGeometryProblem,
  threeDRenderPlacements,
  type ThreeDCabinetBuildFailure,
} from "./InteractiveRoom3D";

const ROOM: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

function base(uid: string, x: number, overrides: Partial<PlacedCabinet> = {}): PlacedCabinet {
  return {
    uid, cabinetId: 1, masterCode: "B24", description: '24" Base Cabinet', category: "Base", subCategory: "Base Cabinet",
    placement: "base", x, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0, numberOfDoors: 2, numberOfDrawers: 1,
    ...overrides,
  } as PlacedCabinet;
}

function buildInto(root: THREE.Group, cabinet: PlacedCabinet, room: RoomData = ROOM, peers: PlacedCabinet[] = [cabinet]) {
  addCabinet(root, existingCabinetSku(cabinet, room, peers), null, { back: 3, left: 3, right: 3, front: 3 }, room.width, room.depth, "#f2f0ea", "#e9e7e2", undefined, existingCabinetTransform(cabinet, room, peers));
}

describe("3D cabinet geometry check", () => {
  it("accepts a normal cabinet and one whose optional height is simply absent", () => {
    expect(threeDCabinetGeometryProblem(base("a", 0))).toBeNull();
    expect(threeDCabinetGeometryProblem(base("a", 0, { height: undefined as unknown as number, mountBottom: undefined }))).toBeNull();
    expect(threeDCabinetGeometryProblem(base("a", 0, { width: "30" as unknown as number }))).toBeNull();
  });

  it("names a missing or non-numeric position, width, or present-but-broken size", () => {
    expect(threeDCabinetGeometryProblem(base("a", Number.NaN))).toMatch(/x/);
    expect(threeDCabinetGeometryProblem(base("a", 0, { width: undefined as unknown as number }))).toMatch(/width/);
    expect(threeDCabinetGeometryProblem(base("a", 0, { depth: "abc" as unknown as number }))).toMatch(/depth/);
    expect(threeDCabinetGeometryProblem(base("a", 0, { rotation: Number.NaN }))).toMatch(/rotation/);
    expect(threeDCabinetGeometryProblem(null)).toMatch(/empty/);
  });
});

describe("one bad cabinet never blanks the 3D kitchen", () => {
  it("skips a cabinet with broken geometry without calling its builder", () => {
    const root = new THREE.Group();
    let called = false;
    const failure = addThreeDSceneCabinetSafely(root, base("bad", Number.NaN, { masterCode: "B30" }), () => { called = true; });
    expect(called).toBe(false);
    expect(failure).toMatchObject({ uid: "bad", masterCode: "B30", stage: "cabinet" });
    expect(root.children).toHaveLength(0);
  });

  it("removes whatever a throwing builder half-added and keeps cabinets already drawn", () => {
    const root = new THREE.Group();
    const good = base("good", 0);
    expect(addThreeDSceneCabinetSafely(root, good, () => buildInto(root, good))).toBeNull();
    const kept = [...root.children];
    expect(kept.length).toBeGreaterThan(0);
    const failure = addThreeDSceneCabinetSafely(root, base("throws", 30, { masterCode: "BBC42" }), () => {
      root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
      throw new TypeError("Cannot read properties of undefined (reading 'width')");
    });
    expect(failure).toMatchObject({ uid: "throws", masterCode: "BBC42", message: expect.stringContaining("width") });
    expect(root.children).toEqual(kept);
  });

  it("renders every other cabinet of a real Auto Design kitchen when one cabinet throws", () => {
    const pack = (catalogFixture as unknown as Record<string, { base: DesignCabinet[]; wall: DesignCabinet[]; accessory?: DesignCabinet[]; surround?: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } }>)["330014"]!;
    const result = buildAutoDesign(pack, "l-shape", true);
    expect(result.ok).toBe(true);
    const rendered = threeDRenderPlacements(result.placed!, ROOM, result.openings ?? []);
    const drawable = rendered.filter((cabinet) => shouldRenderSavedSceneCabinet(cabinet, rendered));
    expect(drawable.length).toBeGreaterThan(10);
    const victim = drawable[Math.floor(drawable.length / 2)]!;
    const root = new THREE.Group();
    const failures: ThreeDCabinetBuildFailure[] = [];
    let drawn = 0;
    for (const cabinet of drawable) {
      const failure = addThreeDSceneCabinetSafely(root, cabinet, () => {
        if (cabinet.uid === victim.uid) throw new Error("simulated builder failure");
        buildInto(root, cabinet, ROOM, rendered);
      });
      if (failure) failures.push(failure); else drawn += 1;
    }
    expect(failures.map((failure) => failure.uid)).toEqual([victim.uid]);
    expect(drawn).toBe(drawable.length - 1);
    expect(threeDCabinetBuildFailureNotice(failures)).toContain(victim.masterCode);
  });

  it("keeps the cabinets when a later whole-scene pass throws", () => {
    const root = new THREE.Group();
    const good = base("good", 0);
    buildInto(root, good);
    const kept = [...root.children];
    const failures: ThreeDCabinetBuildFailure[] = [];
    runThreeDScenePass(root, "countertops", failures, () => {
      root.add(new THREE.Group());
      throw new Error("bad slab");
    });
    expect(root.children).toEqual(kept);
    expect(failures).toEqual([{ uid: null, masterCode: null, stage: "countertops", message: "bad slab" }]);
  });

  it("says plainly which cabinets were skipped", () => {
    expect(threeDCabinetBuildFailureNotice([])).toBeNull();
    const notice = threeDCabinetBuildFailureNotice([
      { uid: "a", masterCode: "B30", stage: "cabinet", message: "x" },
      { uid: null, masterCode: null, stage: "crown molding", message: "y" },
    ]);
    expect(notice).toContain("1 cabinet could not be drawn in 3D: B30");
    expect(notice).toContain("still in the 2D plan");
    expect(notice).toContain("crown molding");
  });
});

describe("saved-plan scene wiring", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/components/design/InteractiveRoom3D.tsx"), "utf8");
  const effect = source.slice(source.indexOf("const sceneBuildFailures: ThreeDCabinetBuildFailure[] = [];"), source.indexOf("threeScene.add(catalogRoot);"));

  it("builds each saved cabinet through the isolated builder", () => {
    expect(effect).toMatch(/for \(const cabinet of renderedPlaced\) \{[\s\S]*?addThreeDSceneCabinetSafely\(catalogRoot, cabinet, \(\) => \{[\s\S]*?addCabinet\(catalogRoot, sku/);
  });

  it("guards every pass that runs before the cabinet group joins the scene", () => {
    for (const call of [
      "addThreeDContinuousToeKicks(", "addThreeDStandardCountertops(", "addThreeDMeasuredWallMiterCountertops(", "addThreeDPeninsulaCountertops(",
      "addThreeDGlassStackerRearSupports(", "addThreeDCrownMolding(", "addThreeDCountertopUpstands(", "addThreeDBacksplash(", "addThreeDBaseboards(",
      "addWallOpening(", "addSinkFixture(", "addPotFillerFixture(", "addIslandZone(", "addPonyWall(", "addFurniture(",
    ]) {
      const at = effect.indexOf(call);
      expect(at, call).toBeGreaterThan(-1);
      const line = effect.slice(effect.lastIndexOf("\n", at - 1), at);
      const guarded = /runThreeDScenePass\(/.test(line) || /runThreeDScenePass\(catalogRoot, "pot filler"/.test(effect.slice(Math.max(0, at - 260), at));
      expect(guarded, `${call} must run inside runThreeDScenePass`).toBe(true);
    }
  });

  it("shows the skipped cabinets on the canvas", () => {
    expect(source).toContain('data-testid="three-d-cabinet-build-failures"');
  });
});

const STOCK: DesignCabinet[] = [
  { id: 9001, masterCode: "BF3", description: '3" Base Filler', category: "Filler", subCategory: "Filler", width: "3", height: "34.5", depth: "24", placement: "accessory" } as unknown as DesignCabinet,
  { id: 9002, masterCode: "WF3", description: '3" Wall Filler', category: "Filler", subCategory: "Filler", width: "3", height: "30", depth: "12", placement: "accessory" } as unknown as DesignCabinet,
];
// The real designer appliance list, so every appliance carries its catalog height.
const PALETTE = ["RANGE-30", "DW-24", "FRIDGE-36", "HOOD-30"].map((code) => APPLIANCES.find((item) => item.masterCode === code)!).filter(Boolean);

function buildAutoDesign(
  pack: { base: DesignCabinet[]; wall: DesignCabinet[]; accessory?: DesignCabinet[]; surround?: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } },
  layoutType: "l-shape" | "u-shape",
  window: boolean,
  styleId = 330014,
  sinkBaseKind: "regular" | "farmhouse" = "regular",
) {
  const openings: WallOpening[] = window ? [{ uid: "window", kind: "window", label: "Window", side: "right", offset: 42, width: 36, height: 36, sill: 42 } as WallOpening] : [];
  let uid = 0;
  return runAutoDesignLayout({
    input: {
      layoutType, originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 22 }, stove: { wallLabel: "Wall 1", centerOffsetIn: 87 },
      sink: { wallLabel: "Wall 2", centerOffsetIn: 60 }, sinkBaseWidthIn: 36, sinkBaseKind, dishwasherSide: "right",
      sinkWindowCenter: window ? { wallLabel: "Wall 2", centerOffsetIn: 60 } : null,
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: { ...emptyAutoDesignIntake(), construction: "new", canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true } },
    } as never,
    room: ROOM, openings, baseCatalog: pack.base, wallCatalog: pack.wall, fillers: [...(pack.accessory ?? []), ...STOCK],
    appliancePalette: PALETTE.map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [], tallCatalog: [], styleId, makeUid: () => `iso-${++uid}`,
  } as never) as { ok: boolean; placed?: PlacedCabinet[]; openings?: WallOpening[] };
}

describe("PR 421 Auto Design pieces all build in 3D", () => {
  const matrix = catalogFixture as unknown as Record<string, Parameters<typeof buildAutoDesign>[0]>;
  it.each(Object.keys(matrix))("style %s: L and U kitchens, with and without the sink window, regular and farmhouse", (styleId) => {
    for (const layoutType of ["l-shape", "u-shape"] as const) {
      for (const window of [false, true]) {
        for (const sinkBaseKind of ["regular", "farmhouse"] as const) {
          const result = buildAutoDesign(matrix[styleId]!, layoutType, window, Number(styleId), sinkBaseKind);
          if (!result.ok) continue;
          const rendered = threeDRenderPlacements(result.placed!, ROOM, result.openings ?? []);
          const root = new THREE.Group();
          const failures: ThreeDCabinetBuildFailure[] = [];
          for (const cabinet of rendered) {
            if (!shouldRenderSavedSceneCabinet(cabinet, rendered)) continue;
            const failure = addThreeDSceneCabinetSafely(root, cabinet, () => buildInto(root, cabinet, ROOM, rendered));
            if (failure) failures.push(failure);
          }
          expect(failures, `${styleId} ${layoutType} window=${window} ${sinkBaseKind}`).toEqual([]);
          expect(root.children.length).toBeGreaterThan(0);
        }
      }
    }
  }, 120000);
});

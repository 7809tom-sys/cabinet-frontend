import { describe, expect, it } from "vitest";
import { buildDesignCabinetCartLines } from "./designCartLines";
import { removeOverlappingPlacements, type RoomData } from "./design";
import { masterTracProduct } from "./closet";
import {
  CORNER_FOOTPRINT_IN, CORNER_SHELF_THICKNESS_IN, cornerShelfClearances, defaultTowerConfig, isMasterTracCornerBoard,
  masterTracCornerParts, nextAvailableCornerShelfElevation, planMasterTracTower, towerConceptReferenceSubtotal, towerCornerReferenceItems,
  towerConfigFromPlacements, towerTotalWidth, type MasterTracTowerConfig,
} from "./masterTracTower";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

const variants = [
  { finish: "Glacier White", fixed: "432556", adjustable: "432557", joint: "433172", fixedList: 46, adjustableList: 38 },
  { finish: "Spiced Mahogany", fixed: "432786", adjustable: "432787", joint: "433176", fixedList: 57.5, adjustableList: 47.5 },
  { finish: "Slate Rift", fixed: "430833", adjustable: "430834", joint: "433174", fixedList: 57.5, adjustableList: 47.5 },
] as const;

describe("MasterTrac illustrative curved corner with real 2022 catalog SKUs", () => {
  it.each(["start", "end"] as const)("seats the %s corner between a same-run upright and a sourced perpendicular upright", (side) => {
    const config = { ...defaultTowerConfig(), corner: side, cornerAdjustableHeightsIn: [30, 54] };
    const start = side === "start" ? 0 : room.width - towerTotalWidth(config);
    const result = planMasterTracTower(config, room, "top", start, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const returnPanel = result.plan.boards.filter((board) => board.masterTracTowerRole === "corner-return");
    expect(returnPanel).toHaveLength(1);
    expect(returnPanel[0]).toMatchObject({ category: "MasterTrac Closet", width: 0.75, depth: 14.5,
      height: 87, wallId: side === "start" ? "left" : "right", wallOffset: 29.5, rotation: 90 });
    expect(masterTracProduct(returnPanel[0].masterCode)?.description).toContain("Upright");
    expect(masterTracProduct(returnPanel[0].masterCode)?.listEachUsd).toBe(41);
    const corners = result.plan.boards.filter(isMasterTracCornerBoard);
    expect(corners.map((board) => board.mountBottom).sort((a, b) => a! - b!)).toEqual([6, 30, 54, 86.25]);
    const restored = removeOverlappingPlacements(JSON.parse(JSON.stringify(result.plan.boards)), room);
    expect(restored.rejected).toHaveLength(0);
    expect(towerConfigFromPlacements(restored.placed, "tower-preview")?.config.corner).toBe(side);
    expect(buildDesignCabinetCartLines({ placed: restored.placed, styleId: 330011, distributorId: 210001,
      tier: "homeowner", styleNameById: new Map([[330011, "Test style"]]), unitPriceFor: () => 999 })).toHaveLength(0);
  });
  it("uses fixed corner SKUs at the structural top and bottom and adjustable SKUs at matching bay levels", () => {
    const config = { ...defaultTowerConfig(), corner: "start" as const, cornerAdjustableHeightsIn: [30, 54, 70] };
    config.bays[0].adjustableHeightsIn = [30, 54, 70];
    const result = planMasterTracTower(config, room, "top", 0, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const corners = result.plan.boards.filter(isMasterTracCornerBoard);
    expect(corners.filter((board) => board.masterCode === "432556").map((board) => board.mountBottom)).toEqual([86.25, 6]);
    expect(corners.filter((board) => board.masterCode === "432557").map((board) => board.mountBottom)).toEqual([30, 54, 70]);
    expect(towerCornerReferenceItems(result.plan.boards)).toMatchObject([
      { sku: "432556", quantity: 2, kind: "shelf" }, { sku: "433172", quantity: 2, kind: "joint" },
      { sku: "432557", quantity: 3, kind: "shelf" },
    ]);
  });

  it.each(variants)("matches sourced fixed and adjustable $finish shelves and prices", ({ finish, fixed, adjustable, joint, fixedList, adjustableList }) => {
    expect(masterTracCornerParts(finish, "fixed")?.shelf.sku).toBe(fixed);
    expect(masterTracCornerParts(finish, "adjustable")?.shelf.sku).toBe(adjustable);
    expect(masterTracCornerParts(finish, "fixed")?.joint?.sku).toBe(joint);
    expect(masterTracCornerParts(finish, "adjustable")?.joint).toBeNull();
    expect(masterTracProduct(fixed)?.listEachUsd).toBe(fixedList);
    expect(masterTracProduct(adjustable)?.listEachUsd).toBe(adjustableList);
  });

  it.each(["start", "end"] as const)("places a fixed corner at the %s room corner adjacent to two shared-upright bays", (side) => {
    const config = { ...defaultTowerConfig(), corner: side };
    const start = side === "start" ? 0 : room.width - towerTotalWidth(config);
    const result = planMasterTracTower(config, room, "top", start, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const corners = result.plan.boards.filter(isMasterTracCornerBoard);
    expect(corners).toHaveLength(2);
    const shelf = corners[0];
    expect(shelf.masterCode).toBe("432556");
    expect(shelf.masterTracCorner).toMatchObject({ side, type: "fixed", illustrative: true, hJointSku: "433172" });
    expect([shelf.width, shelf.height, shelf.depth]).toEqual([29.5, 0.75, 29.5]);
    expect(shelf.wallOffset).toBe(side === "start" ? 0 : 114.5);
    const panels = result.plan.boards.filter((board) => ["left", "center", "right"].includes(board.masterTracTowerRole ?? ""));
    expect(panels).toHaveLength(3);
    expect(panels.filter((board) => board.masterTracTowerRole === "center")).toHaveLength(1);
    expect(side === "start" ? panels[0].wallOffset : shelf.wallOffset).toBe(side === "start" ? 29.5 : panels[2].wallOffset! + 0.75);
    expect(shelf.mountBottom).toBe(config.bays[side === "start" ? 0 : 1].fixedTopIn);
    expect(result.plan.conceptualItems.filter((item) => item.sku === "432608")).toHaveLength(2);
    expect(result.plan.conceptualItems.filter((item) => item.sku === "433172")).toHaveLength(2);
    expect(result.plan.conceptualItems.find((item) => item.sku === "433172")).toMatchObject({ quantity: 1, listEachUsd: 8.5, description: expect.stringContaining("H-Joint") });
    expect(result.plan.listSubtotal).toBe(231 + 2 * (46 + 8.5) + 2 * 9 + 41);
    expect(towerConceptReferenceSubtotal(result.plan.boards)).toBe(2 * 8.5 + 2 * 9);
    const restored = removeOverlappingPlacements(JSON.parse(JSON.stringify(result.plan.boards)), room);
    expect(restored.rejected).toHaveLength(0);
    expect(restored.placed).toHaveLength(result.plan.boards.length);
    expect(towerConfigFromPlacements(restored.placed, "tower-preview")).toMatchObject({ wall: "top", startIn: start, config: { corner: side, cornerShelfType: "fixed" } });
    expect(buildDesignCabinetCartLines({
      placed: restored.placed, styleId: 330011, distributorId: 210001, tier: "homeowner",
      styleNameById: new Map([[330011, "Test style"]]), unitPriceFor: () => 999,
    })).toHaveLength(0);
  });

  it("uses adjustable variant at an independent height, without claiming a fixed-only H-joint", () => {
    const config = { ...defaultTowerConfig("Slate Rift"), corner: "start" as const, cornerShelfType: "adjustable" as const, cornerElevationIn: 44 };
    const result = planMasterTracTower(config, room, "top", 0, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.boards.find(isMasterTracCornerBoard)).toMatchObject({ masterCode: "430834", mountBottom: 44, masterTracCorner: { hJointSku: null } });
    expect(result.plan.conceptualItems.map((item) => item.sku)).toEqual(["431613", "431613"]);
    expect(towerConfigFromPlacements(result.plan.boards, "tower-preview")?.config).toMatchObject({ cornerShelfType: "adjustable", cornerElevationIn: 44 });
  });

  it.each(["start", "end"] as const)("stacks as many nonoverlapping adjustable corner shelves as fit at the %s corner and restores each one", (side) => {
    const elevations = [8, 16, 24, 32, 40, 48, 56, 64, 72, 80];
    const config = { ...defaultTowerConfig(), corner: side, cornerAdjustableHeightsIn: elevations };
    const start = side === "start" ? 0 : room.width - towerTotalWidth(config);
    const result = planMasterTracTower(config, room, "top", start, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const corners = result.plan.boards.filter(isMasterTracCornerBoard);
    expect(corners).toHaveLength(elevations.length + 2);
    expect(corners.filter((board) => board.masterCode === "432557").map((board) => board.mountBottom)).toEqual(elevations);
    expect(corners.filter((board) => board.masterCode === "432556")).toMatchObject([{ mountBottom: 86.25, masterTracCorner: { hJointSku: "433172" } }, { mountBottom: 6, masterTracCorner: { hJointSku: "433172" } }]);
    expect(result.plan.conceptualItems.filter((item) => item.sku === "433172")).toHaveLength(2);
    expect(towerCornerReferenceItems(result.plan.boards)).toMatchObject([
      { sku: "432556", kind: "shelf", quantity: 2, listEachUsd: 46 },
      { sku: "433172", kind: "joint", quantity: 2, listEachUsd: 8.5 },
      { sku: "432557", kind: "shelf", quantity: 10, listEachUsd: 38 },
    ]);
    expect(result.plan.listSubtotal).toBe(231 + 2 * (46 + 8.5) + 2 * 9 + elevations.length * (38 + (masterTracProduct("432535")?.listEachUsd ?? 0)) + 41);
    const restored = removeOverlappingPlacements(JSON.parse(JSON.stringify(result.plan.boards)), room);
    expect(restored.rejected).toHaveLength(0);
    expect(restored.placed).toHaveLength(result.plan.boards.length);
    expect(towerConfigFromPlacements(restored.placed, "tower-preview")?.config).toMatchObject({ corner: side, cornerShelfType: "fixed", cornerAdjustableHeightsIn: elevations });
    expect(buildDesignCabinetCartLines({
      placed: restored.placed, styleId: 330011, distributorId: 210001, tier: "homeowner",
      styleNameById: new Map([[330011, "Test style"]]), unitPriceFor: () => 999,
    })).toHaveLength(0);
  });

  it("allows extra adjustable shelves above and below an adjustable primary corner shelf", () => {
    const config = { ...defaultTowerConfig("Slate Rift"), corner: "start" as const, cornerShelfType: "adjustable" as const,
      cornerElevationIn: 44, cornerAdjustableHeightsIn: [12, 60] };
    const result = planMasterTracTower(config, room, "top", 0, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.boards.filter(isMasterTracCornerBoard).map((board) => board.mountBottom)).toEqual([44, 12, 60]);
    expect(result.plan.boards.filter(isMasterTracCornerBoard).every((board) => board.masterCode === "430834" && board.masterTracCorner.hJointSku === null)).toBe(true);
    expect(towerCornerReferenceItems(result.plan.boards)).toMatchObject([{ sku: "430834", kind: "shelf", quantity: 3 }]);
    expect(towerConfigFromPlacements(result.plan.boards, "tower-preview")?.config).toMatchObject({ cornerShelfType: "adjustable", cornerElevationIn: 44, cornerAdjustableHeightsIn: [12, 60] });
  });

  it("proposes the next adjustable corner level in the largest physically free slot", () => {
    const config: MasterTracTowerConfig = { ...defaultTowerConfig(), corner: "start" };
    expect(nextAvailableCornerShelfElevation(config)).toBe(30);
    const levels = [...Array(10)].map(() => {
      const height = nextAvailableCornerShelfElevation(config);
      expect(height).not.toBeNull();
      config.cornerAdjustableHeightsIn = [...(config.cornerAdjustableHeightsIn ?? []), height!];
      return height;
    });
    expect(new Set(levels).size).toBe(10);
    expect(planMasterTracTower(config, room, "top", 0, []).ok).toBe(true);
  });

  it("rejects overlapping, out-of-panel or nonsensical corner levels atomically rather than imposing an arbitrary shelf count", () => {
    const config = { ...defaultTowerConfig(), corner: "start" as const };
    for (const heights of [[30, 30], [30, 30.5], [85.75], [-1], [87], [Number.NaN]]) {
      const result = planMasterTracTower({ ...config, cornerAdjustableHeightsIn: heights }, room, "top", 0, []);
      expect(result.ok, `corner levels ${heights.join(",")}`).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/corner shel(?:f|ves)/i);
    }
  });

  it("reports real board overlap or contact without inventing an installation clearance", () => {
    expect(CORNER_SHELF_THICKNESS_IN).toBe(0.75);
    const config: MasterTracTowerConfig = { ...defaultTowerConfig(), corner: "start", cornerShelfType: "adjustable", cornerElevationIn: 44, cornerAdjustableHeightsIn: [44.5, 60] };
    expect(cornerShelfClearances(config)).toMatchObject([
      { kind: "primary", issue: "overlap", nearest: { kind: "adjustable", index: 0, clearIn: -0.25 } },
      { kind: "adjustable", index: 0, issue: "overlap", nearest: { kind: "primary", clearIn: -0.25 } },
      { kind: "adjustable", index: 1, issue: "clear" },
    ]);
    expect(planMasterTracTower(config, room, "top", 0, []).ok).toBe(false);
    config.cornerAdjustableHeightsIn = [44.75, 60];
    expect(cornerShelfClearances(config).slice(0, 2).map((shelf) => shelf.issue)).toEqual(["touching", "touching"]);
    expect(planMasterTracTower(config, room, "top", 0, []).ok).toBe(true);
    config.cornerAdjustableHeightsIn = [44.749];
    expect(cornerShelfClearances(config)[1].issue).toBe("overlap");
    expect(planMasterTracTower(config, room, "top", 0, []).ok).toBe(false);
    config.cornerAdjustableHeightsIn = [86.5];
    expect(cornerShelfClearances(config)[1].issue).toBe("out-of-panel");
    config.cornerAdjustableHeightsIn = [Number.NaN];
    expect(cornerShelfClearances(config)[1].issue).toBe("invalid-height");
  });

  it("rejects noncorner positions, deep bays, conflicting pieces and mismatched fixed shelf heights without partial placement", () => {
    const config = { ...defaultTowerConfig(), corner: "start" as const };
    expect(planMasterTracTower(config, room, "top", 5, []).ok).toBe(false);
    expect(planMasterTracTower({ ...config, depthIn: 23.5 as const }, room, "top", 0, []).ok).toBe(false);
    expect(planMasterTracTower({ ...config, cornerElevationIn: 70 }, room, "top", 0, []).ok).toBe(false);
    const initial = planMasterTracTower(config, room, "top", 0, []);
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    expect(planMasterTracTower(config, room, "top", 0, initial.plan.boards, [], "second").ok).toBe(false);
    expect(initial.plan.boards.find(isMasterTracCornerBoard)?.width).toBe(CORNER_FOOTPRINT_IN);
  });
});

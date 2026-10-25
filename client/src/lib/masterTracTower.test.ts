import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addCabinet, existingCabinetSku, existingCabinetTransform } from "@/components/design/InteractiveRoom3D";
import { masterTracProduct } from "./closet";
import { removeOverlappingPlacements, type RoomData, type WallOpening } from "./design";
import { defaultTowerConfig, planMasterTracTower, towerCleatReferenceItems, towerConceptReferenceSubtotal, towerConfigFromPlacements, towerRodHardwareTakeoff, towerStorageSkuReferences, towerTotalWidth, towerWidths } from "./masterTracTower";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
const config = defaultTowerConfig();

describe("MasterTrac connected tower planning", () => {
  it("uses a single shared center-upright SKU, exact bay openings and 2022 List-only boards", () => {
    const result = planMasterTracTower(config, room, "top", 12, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { boards, totalWidthIn, listSubtotal } = result.plan;
    expect(totalWidthIn).toBe(50.25);
    expect(boards).toHaveLength(11);
    expect(boards.filter((b) => b.masterTracTowerRole === "center")).toHaveLength(1);
    expect(boards.filter((b) => b.masterTracTowerRole === "adjustable")).toHaveLength(4);
    expect(boards.filter((b) => b.masterTracTowerRole === "fixed-top")).toHaveLength(2);
    expect(boards.filter((b) => b.masterTracTowerRole === "fixed-bottom")).toHaveLength(2);
    expect(boards.filter((b) => b.masterTracTowerRole === "left")[0].masterCode).toBe("432136");
    expect(boards.filter((b) => b.masterTracTowerRole === "center")[0].masterCode).toBe("432519");
    expect(boards.filter((b) => b.masterTracTowerRole === "right")[0].masterCode).toBe("432525");
    expect(boards.filter((b) => b.masterTracTowerRole === "adjustable")[0].masterCode).toBe("432535");
    expect(boards.filter((b) => b.masterTracTowerRole === "fixed-bottom")[0].masterCode).toBe("432529");
    expect(boards.every((b) => b.category === "MasterTrac Closet" && b.width === b.nominalWidth && b.height === b.nominalHeight && b.depth === b.nominalDepth)).toBe(true);
    const panels = boards.filter((b) => ["left", "center", "right"].includes(b.masterTracTowerRole ?? ""));
    expect(panels.map((b) => b.wallOffset)).toEqual([12, 36.75, 61.5]);
    const shelves = boards.filter((b) => b.masterTracTowerRole === "fixed-bottom");
    expect(shelves.map((b) => b.wallOffset)).toEqual([12.75, 37.5]);
    expect(shelves.every((b) => b.width === 24 && b.depth === 14.5 && b.height === 0.75)).toBe(true);
    expect(towerCleatReferenceItems(boards).map((item) => item.sku)).toEqual(["432608", "432608"]);
    expect(listSubtotal).toBe(231 + 2 * 9);
    expect(listSubtotal).toBe(boards.reduce((sum, b) => sum + masterTracProduct(b.masterCode)!.listEachUsd, 0) + towerConceptReferenceSubtotal(boards));
  });

  it("accepts three distinct bays using four panels and survives saved-design collision restoration", () => {
    const triple = { ...config, bays: [24, 30, 18].map((widthIn) => ({ widthIn, fixedBottomIn: 6, fixedTopIn: 86.25, adjustableHeightsIn: [30, 54] })) };
    const result = planMasterTracTower(triple, room, "bottom", 3, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.totalWidthIn).toBe(75);
    expect(result.plan.boards.filter((b) => b.masterTracTowerRole === "center")).toHaveLength(2);
    expect(result.plan.boards.every((b) => b.wallId === "bottom" && b.y === room.depth - 14.5)).toBe(true);
    const restored = removeOverlappingPlacements(JSON.parse(JSON.stringify(result.plan.boards)), room);
    expect(restored.rejected).toHaveLength(0);
    expect(restored.placed).toHaveLength(result.plan.boards.length);
    const parsed = towerConfigFromPlacements(restored.placed, "tower-preview");
    expect(parsed?.config.bays.map((bay) => bay.widthIn)).toEqual([24, 30, 18]);
    expect(parsed?.startIn).toBe(3);
    expect(parsed?.wall).toBe("bottom");
  });

  it("uses the selected finish and deep-board SKUs; nominal 96 is 94 actual", () => {
    const deep = { ...defaultTowerConfig("Spiced Mahogany"), depthIn: 23.5 as const, bays: [24, 30].map((widthIn) => ({ widthIn, fixedBottomIn: 6, fixedTopIn: 86.25, adjustableHeightsIn: [42] })) };
    const result = planMasterTracTower(deep, room, "right", 10, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.boards.filter((b) => b.masterTracTowerRole === "left")[0].masterCode).toBe("432770");
    expect(result.plan.boards.filter((b) => b.masterTracTowerRole === "center")[0].masterCode).toBe("432772");
    expect(result.plan.boards.filter((b) => b.masterTracTowerRole === "right")[0].masterCode).toBe("432774");
    expect(result.plan.boards.every((b) => b.x === room.width - 23.5 && b.rotation === 90)).toBe(true);
    expect(towerWidths(23.5)).toEqual([24, 30]);
    const nominal96 = { ...defaultTowerConfig("Glacier White"), heightIn: 94 as const, bays: [24, 24].map((widthIn) => ({ widthIn, fixedBottomIn: 6, fixedTopIn: 93.25, adjustableHeightsIn: [] })) };
    const tall = planMasterTracTower(nominal96, room, "top", 0, []);
    expect(tall.ok).toBe(true);
    if (tall.ok) expect(tall.plan.boards.find((b) => b.masterTracTowerRole === "left")?.masterCode).toBe("432514");
  });

  it("rejects entire assemblies for unsupported SKU combination, invalid shelf spacing, low ceiling, and short wall", () => {
    const unsupported = { ...config, depthIn: 23.5 as const, bays: [{ ...config.bays[0], widthIn: 12 }, config.bays[1]] };
    expect(planMasterTracTower(unsupported, room, "top", 0, []).ok).toBe(false);
    const missingRole = { ...config, heightIn: 94 as const, depthIn: 23.5 as const };
    expect(planMasterTracTower(missingRole, room, "top", 0, []).ok).toBe(false);
    const overlap = { ...config, bays: [{ ...config.bays[0], adjustableHeightsIn: [6.25, 54] }, ...config.bays.slice(1)] };
    expect(planMasterTracTower(overlap, room, "top", 0, []).ok).toBe(false);
    expect(planMasterTracTower(config, { ...room, ceilingHeight: 84 }, "top", 0, []).ok).toBe(false);
    expect(planMasterTracTower(config, { ...room, width: 48 }, "top", 0, []).ok).toBe(false);
    expect(planMasterTracTower(config, room, "top", -1, []).ok).toBe(false);
    expect(towerTotalWidth(config)).toBe(50.25);
  });

  it("rejects a door/window or existing board without partially adding the tower", () => {
    const opening: WallOpening = { uid: "window", kind: "window", label: "West window", side: "top", offset: 22, width: 24, height: 36, sill: 36 };
    const windowResult = planMasterTracTower(config, room, "top", 12, [], [opening]);
    expect(windowResult).toEqual({ ok: false, reason: expect.stringContaining("West window") });
    const first = planMasterTracTower(config, room, "top", 12, [], [], "original");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const conflict = planMasterTracTower(config, room, "top", 24, first.plan.boards, [], "other");
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.reason).toContain("Nothing was placed");
    expect(first.plan.boards).toHaveLength(11);
  });

  it("reopens a saved group's changed shelf heights rather than reverting them to wizard defaults", () => {
    const initial = planMasterTracTower(config, room, "top", 0, []);
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    const moved = initial.plan.boards.map((board) => board.masterTracTowerRole === "adjustable" && board.masterTracTowerBayIndex === 0 && board.mountBottom === 54
      ? { ...board, mountBottom: 55 } : board);
    const parsed = towerConfigFromPlacements(moved, "tower-preview");
    expect(parsed?.config.bays[0].adjustableHeightsIn).toEqual([30, 55]);
    expect(parsed?.config.bays[1].adjustableHeightsIn).toEqual([30, 54]);
  });

  it("chooses actual 2022 drawer assembly/front and shoe shelf/fence references for compatible shallow bays", () => {
    const mixed = { ...config, bays: [
      { widthIn: 18, fixedBottomIn: 6, fixedTopIn: 86.25, adjustableHeightsIn: [], storage: { kind: "drawers" as const, count: 2, drawerSize: "small" as const, frontStyle: "slab" as const } },
      { widthIn: 24, fixedBottomIn: 6, fixedTopIn: 86.25, adjustableHeightsIn: [], storage: { kind: "shoe" as const, count: 1 as const, fenceFinish: "Chrome" as const } },
    ] };
    const result = planMasterTracTower(mixed, room, "top", 12, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.conceptualItems.filter((item) => !/Cleat/i.test(item.description)).map((item) => [item.sku, item.quantity])).toEqual([
      ["432383", 2], ["432567", 2], ["432559", 1], ["432928", 1],
    ]);
    expect(result.plan.boards).toHaveLength(7);
    expect(result.plan.boards.filter((board) => board.masterTracConceptStorage)).toHaveLength(2);
    expect(towerConceptReferenceSubtotal(result.plan.boards)).toBe(2 * (94 + 12) + 12 + 10.5 + 8 + 9);
    expect(result.plan.listSubtotal).toBe(result.plan.boards.reduce((sum, board) => sum + masterTracProduct(board.masterCode)!.listEachUsd, 0) + towerConceptReferenceSubtotal(result.plan.boards));
    const restored = removeOverlappingPlacements(JSON.parse(JSON.stringify(result.plan.boards)), room);
    expect(restored.rejected).toHaveLength(0);
    expect(towerConfigFromPlacements(restored.placed, "tower-preview")?.config.bays.map((bay) => bay.storage)).toEqual(mixed.bays.map((bay) => bay.storage));
  });

  it("keeps unsupported depth, mismatched shoe width, missing small Shaker and overlapping shelves out of the whole tower", () => {
    const storage = { kind: "drawers" as const, count: 2, drawerSize: "small" as const, frontStyle: "slab" as const };
    expect(towerStorageSkuReferences(storage, 18, 23.5, "Glacier White").ok).toBe(false);
    expect(towerStorageSkuReferences({ kind: "shoe", count: 1, fenceFinish: "Chrome" }, 36, 14.5, "Glacier White").ok).toBe(false);
    expect(towerStorageSkuReferences({ ...storage, frontStyle: "shaker" }, 24, 14.5, "Glacier White").ok).toBe(false);
    const invalid = { ...config, bays: [{ ...config.bays[0], storage }, config.bays[1]] };
    const failed = planMasterTracTower(invalid, room, "top", 0, []);
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.reason).toContain("choose storage or adjustable shelves");
    expect(config.bays[0].storage).toBeUndefined();
  });

  it("repeats a sourced shoe shelf AND fence per level, without assigning a manufactured hole pitch", () => {
    const grouped = { ...config, bays: [
      { ...config.bays[0], adjustableHeightsIn: [], storage: { kind: "shoe" as const, count: 3, fenceFinish: "Matt Nickel" as const } },
      config.bays[1],
    ] };
    const result = planMasterTracTower(grouped, room, "top", 2, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.conceptualItems.filter((item) => !/Cleat/i.test(item.description)).map(({ sku, quantity }) => [sku, quantity])).toEqual([["432559", 3], ["432927", 3]]);
    expect(towerConceptReferenceSubtotal(result.plan.boards)).toBe(3 * (12 + 9.5) + 2 * 9);
    expect(planMasterTracTower({ ...grouped, bays: [{ ...grouped.bays[0], fixedTopIn: 39 }, grouped.bays[1]] }, room, "top", 2, []).ok).toBe(false);
  });

  it("never infers missing drawer fronts or shoe shelves across the 2022 finish/width variants", () => {
    for (const finish of ["Glacier White", "Slate Rift", "Spiced Mahogany"]) {
      for (const width of [18, 24, 30]) {
        expect(towerStorageSkuReferences({ kind: "drawers", count: 1, drawerSize: "small", frontStyle: "slab" }, width, 14.5, finish).ok).toBe(true);
        expect(towerStorageSkuReferences({ kind: "drawers", count: 1, drawerSize: "large", frontStyle: "shaker" }, width, 14.5, finish).ok).toBe(true);
        expect(towerStorageSkuReferences({ kind: "shoe", count: 1, fenceFinish: "Chrome" }, width, 14.5, finish).ok).toBe(true);
      }
    }
  });

  it("counts one 8-foot stock rod per level and two cups per rod, buying cups in ten-packs across the tower", () => {
    const rods = { ...config, bays: [
      { ...config.bays[0], adjustableHeightsIn: [], storage: { kind: "rod" as const, count: 2, rodFinish: "Chrome" as const, heightsIn: [40, 70] } },
      { ...config.bays[1], adjustableHeightsIn: [], storage: { kind: "rod" as const, count: 1, rodFinish: "Chrome" as const, heightsIn: [64] } },
    ] };
    const result = planMasterTracTower(rods, room, "top", 0, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(towerRodHardwareTakeoff(result.plan.boards)).toEqual([{ finish: "Chrome", rodSku: "433223", rodCount: 3,
      rodListEachUsd: 29, cupSku: "433225", cupCount: 6, cupPackSize: 10, cupPacks: 1, cupListPackUsd: 30.5 }]);
    expect(result.plan.conceptualItems.filter((item) => item.sku === "433223").map((item) => item.quantity)).toEqual([2, 1]);
    expect(result.plan.conceptualItems.find((item) => item.sku === "433225")?.quantity).toBe(1);
    expect(towerConceptReferenceSubtotal(result.plan.boards)).toBe(18 + 3 * 29 + 30.5);
    expect(towerConfigFromPlacements(JSON.parse(JSON.stringify(result.plan.boards)), "tower-preview")?.config.bays.map((bay) => bay.storage)).toEqual(rods.bays.map((bay) => bay.storage));
    // The source does not specify a twenty-inch between-rod installation clearance.
    // User-entered elevations remain a visual reference, not a certified hanging fit.
    expect(planMasterTracTower({ ...rods, bays: [{ ...rods.bays[0], storage: { kind: "rod" as const, count: 2, rodFinish: "Chrome" as const, heightsIn: [40, 44] } }, rods.bays[1]] }, room, "top", 0, []).ok).toBe(true);
    const six = planMasterTracTower({ ...rods, bays: Array.from({ length: 3 }, () => ({ ...rods.bays[0] })) }, room, "top", 0, []);
    expect(six.ok).toBe(true);
    if (six.ok) expect(towerRodHardwareTakeoff(six.plan.boards)[0]).toMatchObject({ rodCount: 6, cupCount: 12, cupPacks: 2 });
  });

  it("uses real 24-inch stock SKUs and List while installing 22.5-inch fixed and adjustable boards", () => {
    const cutConfig = { ...config, bays: [{ ...config.bays[0], stockWidthIn: 24, widthIn: 22.5 }, config.bays[1]] };
    const result = planMasterTracTower(cutConfig, room, "top", 5, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.totalWidthIn).toBe(48.75);
    const cutBoards = result.plan.boards.filter((board) => board.masterTracTowerBayIndex === 0 && board.masterTracShelfCut);
    expect(cutBoards).toHaveLength(4);
    expect(cutBoards.every((board) => board.width === 22.5 && board.nominalWidth === 24
      && board.masterTracShelfCut?.offcutIn === 1.5)).toBe(true);
    expect(cutBoards.filter((board) => board.masterTracTowerRole === "adjustable").map((board) => board.masterCode)).toEqual(["432535", "432535"]);
    expect(cutBoards.filter((board) => board.masterTracTowerRole === "fixed-bottom").map((board) => board.masterCode)).toEqual(["432529"]);
    expect(towerCleatReferenceItems(result.plan.boards)[0]).toMatchObject({ sku: "432608", stockIn: 24, installedIn: 22.5 });
    expect(result.plan.listSubtotal).toBe(231 + 2 * 9); // stock boards and one sourced cleat per bay; no fabricated cut discount
    expect(result.plan.boards.filter((board) => board.masterTracTowerRole === "center")[0].wallOffset).toBe(28.25);
    const firstShelf = cutBoards.find((board) => board.masterTracTowerRole === "fixed-bottom")!;
    const root = new THREE.Group();
    addCabinet(root, existingCabinetSku(firstShelf, room), null, {}, room.width, room.depth, "#eee", "#fff", undefined, existingCabinetTransform(firstShelf, room));
    const mesh = root.children[0].children.find((node) => node.userData.masterTracBoardSurface)!;
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(mesh).getSize(size);
    expect(root.children[0].userData.masterTracBoard.sku).toBe("432529");
    expect(root.children[0].userData.masterTracBoard.cut).toMatchObject({ stockWidthIn: 24, installedWidthIn: 22.5, offcutIn: 1.5 });
    expect(size.x * 12).toBeCloseTo(22.5);
    const restored = removeOverlappingPlacements(JSON.parse(JSON.stringify(result.plan.boards)), room);
    expect(restored.rejected).toHaveLength(0);
    expect(towerConfigFromPlacements(restored.placed, "tower-preview")?.config.bays[0]).toMatchObject({ stockWidthIn: 24, widthIn: 22.5 });
  });

  it("rejects unsupported stock, cuts shorter than 12 inches or wider than stock, and cuts in drawer bays", () => {
    const withCut = (widthIn: number, stockWidthIn: number) => ({ ...config, bays: [{ ...config.bays[0], widthIn, stockWidthIn }, config.bays[1]] });
    for (const invalid of [withCut(25, 24), withCut(11, 24), withCut(22, 23), withCut(NaN, 24)]) {
      expect(planMasterTracTower(invalid, room, "top", 5, []).ok).toBe(false);
    }
    const drawers = { ...withCut(22, 24), bays: [{ ...withCut(22, 24).bays[0], adjustableHeightsIn: [], storage: { kind: "drawers" as const, count: 1, drawerSize: "small" as const, frontStyle: "slab" as const } }, config.bays[1]] };
    expect(planMasterTracTower(drawers, room, "top", 5, [])).toMatchObject({ ok: false, reason: expect.stringContaining("drawer/shoe") });
  });
});

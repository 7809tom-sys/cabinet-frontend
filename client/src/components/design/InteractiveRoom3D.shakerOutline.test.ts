// @vitest-environment jsdom
/**
 * Every painted or solid-color shaker front in the 3D Designer gets one merged edge outline
 * (Tom, Nov 18 2026). Raised panels, glass frames and photo faces keep what they had.
 */
import { afterEach, describe, expect, it } from "vitest";
import * as THREE from "three";
import { addCabinet } from "./InteractiveRoom3D";
import { designerCatalogDoorProfile, doorStyleFinishColors } from "@/lib/doorStyleAppearance";
import { designerFacePlan } from "@/lib/designerFacePlan";
import { setShakerOutlinePolicy } from "@/lib/shakerFrameOutline";

const SKU = (code: string, doors: number, drawers: number) => ({
  placementUid: code, masterCode: code, description: `${code} base`, placementType: "base",
  width: 24, depth: 24, height: 34.5, numberOfDoors: doors, numberOfDrawers: drawers, category: "Base", subCategory: "Standard Base",
}) as never;

const CREAM = { id: 330002, distributorId: 210001, distributorName: "Ashford", styleCode: "CC", ourName: "Classic Cream", color: "f9f7eb", finish: "Painted", doorStyle: "Shaker", renderHex: "#eae5d6" };
const NOW = "2026-11-18T20:00:00.000Z";

function build(style: Record<string, unknown>, sku = SKU("B24", 2, 0), profileOverride: Record<string, unknown> = {}) {
  const finish = doorStyleFinishColors(style as never);
  const profile = { ...designerCatalogDoorProfile(style as never), ...profileOverride };
  const plan: any = designerFacePlan(style as never, "base");
  const root = new THREE.Group();
  addCabinet(root, sku, "back", { back: 0 }, 144, 120, finish.face, "#eeeeee", profile as never, { x: 0, z: 0, rotation: 0 },
    plan?.doorUrl ?? null, undefined, { selectedToeKick: true, drawerSampleUrl: plan?.drawerUrl ?? null, faceSourceKind: plan?.sourceKind, faceCrop: plan?.dlcCrop });
  const counts = { frames: 0, outlines: 0, rails: 0 };
  root.traverse((node) => {
    if (node.userData?.physicalRails) counts.frames += 1;
    if (node.userData?.shakerFrameOutline) counts.outlines += 1;
    if (node.userData?.physicalRail) counts.rails += 1;
  });
  return { root, counts };
}

afterEach(() => setShakerOutlinePolicy({ enabled: true, tier: "high" }));

describe("shaker generic image outline in the Designer", () => {
  it("a DL-blueprint solid-color shaker door and drawer front each get exactly one outline", () => {
    const { counts } = build(CREAM, SKU("DB24", 2, 1));
    expect(counts.frames).toBeGreaterThanOrEqual(2);
    expect(counts.outlines).toBe(counts.frames);
  });

  it("a Sherwin-Williams or hex pick (wizard paint) gets them too", () => {
    const hex = { ...CREAM, doorColorSource: "hex", doorColorSourceValue: { hex: "#3a6ea5" }, doorColorSourceUpdatedAt: NOW };
    const { counts } = build(hex);
    expect(counts.frames).toBeGreaterThanOrEqual(2);
    expect(counts.outlines).toBe(counts.frames);
  });

  it("a style marked painted gets them even without a solid-color crop", () => {
    const { counts } = build({ ...CREAM, finish: "Painted White", doorStyle: "Shaker" }, SKU("B24", 2, 0), { paintedFinish: true });
    expect(counts.frames).toBeGreaterThan(0);
    expect(counts.outlines).toBe(counts.frames);
  });

  it("each outline is one line object, so a front adds one draw call", () => {
    const { root, counts } = build(CREAM);
    const lines: THREE.Object3D[] = [];
    root.traverse((node) => { if (node.userData?.shakerFrameOutline) lines.push(node); });
    expect(lines).toHaveLength(counts.outlines);
    for (const line of lines) expect(line).toBeInstanceOf(THREE.LineSegments);
  });

  it("the toggle hides them without a rebuild", () => {
    const { root } = build(CREAM);
    const lines: THREE.Object3D[] = [];
    root.traverse((node) => { if (node.userData?.shakerFrameOutline) lines.push(node); });
    setShakerOutlinePolicy({ enabled: false });
    expect(lines.every((line) => !line.visible)).toBe(true);
    setShakerOutlinePolicy({ enabled: true });
    expect(lines.every((line) => line.visible)).toBe(true);
  });

  it("a raised panel front is left alone", () => {
    const { counts } = build({ ...CREAM, doorStyle: "Raised Panel", doorPanelType: "Raised Panel", panelConstruction: "raised" });
    expect(counts.outlines).toBe(0);
  });

  it("keeps the carcass edge lines it already had, and adds only the frame outlines", () => {
    const { root, counts } = build(CREAM);
    let carcassLines = 0;
    let frameLines = 0;
    root.traverse((node) => {
      if (!(node as THREE.LineSegments).isLineSegments) return;
      if (node.userData?.shakerFrameOutline) frameLines += 1;
      else carcassLines += 1;
    });
    expect(carcassLines).toBeGreaterThan(0);
    expect(frameLines).toBe(counts.outlines);
  });
});

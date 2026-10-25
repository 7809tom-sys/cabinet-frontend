import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { addFurniture } from "./InteractiveRoom3D";
import { makeBathroomStarterTemplate, resizeBathroomZone } from "@/lib/bathroomPlanning";
import { furniturePlanFrame, makeFurniture } from "@/lib/design";

describe("Bathroom zones are Floor Plan-only guides", () => {
  it.each([false, true])("does not create a zone mesh, border, selection helper or raycast target (selected=%s)", (selected) => {
    const { furniture } = makeBathroomStarterTemplate();
    const snapshot = JSON.stringify(furniture);
    const root = new THREE.Group();
    for (const zone of furniture) addFurniture(root, zone, selected);
    expect(root.children).toHaveLength(0);
    expect(JSON.stringify(furniture)).toBe(snapshot);
    expect(furniture).toHaveLength(3);
  });

  it("retains resized zone footprints for Floor Plan while rendering the real tub and faucet", () => {
    const starter = makeBathroomStarterTemplate();
    const original = starter.furniture.find((item) => item.defId === "bathroom-zone-tub-60")!;
    const resized = resizeBathroomZone(original, { widthIn: 72, depthIn: 36, x: 0, y: 60, rotation: 0 }, starter.room);
    expect(resized.ok).toBe(true);
    if (!resized.ok) throw new Error("fixture zone must fit");
    const zone = resized.item;
    const frame = furniturePlanFrame(zone)!;
    expect(frame.width).toBe(72);
    expect(frame.depth).toBe(36);
    const root = new THREE.Group();
    addFurniture(root, zone, true);
    addFurniture(root, makeFurniture("pelican-tub-pl-02146-59", 0, 20));
    addFurniture(root, makeFurniture("pelican-tub-filler-pl-8515-mb", 36, 20));
    expect(root.children).toHaveLength(2);
    expect(root.children.map((item) => item.userData.fixtureKind)).toEqual(["freestanding-tub", "floor-tub-filler"]);
    expect(JSON.parse(JSON.stringify(zone)).planningZoneSize).toEqual({ version: 1, widthIn: 72, depthIn: 36 });
  });

  it("suppresses stale zone selection cards in 3D without removing Floor Plan editing", () => {
    const renderer = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    const plan = readFileSync(new URL("./PlanCanvas.tsx", import.meta.url), "utf8");
    expect(renderer.includes('if (!item || !definition || definition.category === "bathroom-zone" || !profile) return null;')).toBe(true);
    expect(renderer.includes('if (definition?.category === "bathroom-zone") return null;')).toBe(true);
    expect(renderer.includes('data-testid="three-d-zone-attributes"')).toBe(false);
    expect(plan).toContain('data-testid={`bathroom-zone-attributes-${f.uid}`}');
    expect(plan).toContain("furniturePlanFrame(f)");
  });
});

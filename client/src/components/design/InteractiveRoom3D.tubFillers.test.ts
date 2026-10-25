import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { addFurniture, bathroomFurnitureTransform } from "./InteractiveRoom3D";
import { makePelicanBathroomFixture } from "@/lib/design";

describe("actual Bathroom 3D tub-filler renderer", () => {
  it.each([['PL-8515 MB','tub-filler-gooseneck-spout'], ['PL-8522 BG','tub-filler-connected-valve-bridge'], ['PL-8538 BN','tub-filler-flat-spout']] as const)("renders %s as a separate metal faucet, not a generic tub", (pelicanCode, part) => {
    const item = { ...makePelicanBathroomFixture({ id: 804, pelicanCode, name: pelicanCode, category: "Sinks & Faucets", sellPrice: 442.53 }, 32, 38)!, rotation: 90 };
    const root = new THREE.Group();
    addFurniture(root, item, false);
    const fixture = root.children.find((child) => child.userData.pelicanBathroomFixture)!;
    expect(fixture.userData).toMatchObject({ pelicanCode, fixtureKind: "floor-tub-filler", mounting: "floor", sourceEnvelopeIn: null, footprintBasis: "illustrative-occupancy", visualOccupancyIn: { width: 14, depth: 14 } });
    expect(fixture.children.some((child) => child.userData.pelicanBathroomFixturePart === part)).toBe(true);
    const actualHeight = new THREE.Box3().setFromObject(fixture).getSize(new THREE.Vector3()).y;
    const expectedHeightIn = pelicanCode.includes("8515") ? 43.875 : pelicanCode.includes("8522") ? 44.5 : 41.875;
    expect(actualHeight * 12).toBeCloseTo(expectedHeightIn, 0);
    expect(fixture.children.some((child) => String(child.userData.pelicanBathroomFixturePart).includes('tub-apron'))).toBe(false);
    const transform = bathroomFurnitureTransform(item);
    expect(fixture.position.x).toBeCloseTo(transform.x);
    expect(fixture.position.z).toBeCloseTo(transform.z);
    expect(fixture.rotation.y).toBeCloseTo(-Math.PI / 2);
  });
});

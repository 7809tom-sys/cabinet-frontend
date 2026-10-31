import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { applyThreeDDoorFaceStructuralFinish, applyThreeDStructuralFinishMaterials } from "@/components/design/InteractiveRoom3D";
import { framelessDoorFinishSheen, framelessExposedSidesMatchDoorFace, withFramelessExposedFinish } from "./framelessExposedFinish";

const lsa = {
  styleCode: "LSA",
  ourName: "Luxe Classic LSA",
  color: "LSA",
  renderHex: null,
  finishSheen: "gloss",
  doorStyle: "Slab",
};

describe("frameless exposed side finish", () => {
  it("uses the door face and Luxe gloss for LSA, and a solid color for framed Madison", () => {
    expect(framelessExposedSidesMatchDoorFace(lsa)).toBe(true);
    expect(framelessDoorFinishSheen(lsa)).toBe("gloss");
    expect(framelessDoorFinishSheen({ styleCode: "LSA", color: "LSA", finishSheen: null })).toBe("gloss");
    expect(framelessDoorFinishSheen({ styleCode: "ZSA", color: "ZSA" })).toBe("matte");
    expect(framelessDoorFinishSheen({ styleCode: "SSH", color: "SSH" })).toBe("satin");

    const lsaProfile = withFramelessExposedFinish(lsa, { doorStyle: "Slab", finishSheen: null });
    expect(lsaProfile).toMatchObject({ exposedSidesMatchDoorFace: true, finishSheen: "gloss" });

    const madison = {
      styleCode: "SC",
      ourName: "Shaker Cinder",
      color: "#5A5A5A",
      boxConstruction: "1/2-inch plywood box with UV-coated matching exterior",
      distributorName: "Madison",
    };
    expect(framelessExposedSidesMatchDoorFace(madison)).toBe(false);
    const madisonProfile = withFramelessExposedFinish(madison, { doorStyle: "Shaker", finishSheen: "satin" });
    expect(madisonProfile).toMatchObject({ exposedSidesMatchDoorFace: false, finishSheen: "satin" });
    expect(framelessExposedSidesMatchDoorFace({ styleCode: "ZSA", color: "#445566" })).toBe(false);
    expect(framelessExposedSidesMatchDoorFace({ styleCode: "SW", color: "#F5F5F5", ourName: "Shaker White" })).toBe(false);
  });

  it("paints a side material with the door sample and gloss clearcoat", () => {
    const texture = new THREE.Texture();
    const side = new THREE.MeshPhysicalMaterial({ color: "#c6b9a7", roughness: 0.5 });
    const applied = applyThreeDDoorFaceStructuralFinish([side], texture, "gloss");
    expect(applied.finishSheen).toBe("gloss");
    expect(side.map).toBe(texture);
    expect(side.color.getHexString()).toBe("ffffff");
    expect(side.roughness).toBeCloseTo(0.25);
    expect(side.clearcoat).toBeCloseTo(0.28);
    expect(side.clearcoatRoughness).toBeCloseTo(0.22);
    expect(side.userData).toMatchObject({
      framelessDoorFaceSide: true,
      usesDoorSample: true,
      usesDoorImage: true,
      finishSheen: "gloss",
    });

    const framed = new THREE.MeshPhysicalMaterial({ color: "#c6b9a7" });
    applyThreeDStructuralFinishMaterials([framed], "#f5f5f5");
    expect(framed.map).toBeNull();
    expect(framed.color.getHexString()).toBe("f5f5f5");
    expect(framed.userData.framelessDoorFaceSide).toBe(false);
    expect(framed.userData.usesDoorImage).toBe(false);
  });
});

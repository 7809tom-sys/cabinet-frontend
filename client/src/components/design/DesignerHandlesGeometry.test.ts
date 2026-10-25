import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addCabinet } from "./InteractiveRoom3D";
import { DEFAULT_DESIGNER_HARDWARE_STYLE_ID } from "./CabinetHandlesControl";
import { hardwareSchedule, hardwareScheduleNote } from "@/lib/hardware";
import type { PlacedCabinet } from "@/lib/design";

const vanity = {
  masterCode: "VDDB48", description: "48 inch Vanity Combo Base Double Drawer Stack — 6 drawers and 2 center doors",
  placementType: "base", width: 48, height: 34.5, depth: 21,
  numberOfDoors: 2, numberOfDrawers: 6,
};
function render(sku: typeof vanity, style: "none" | "bar-pull" | "knob" | "cup-pull" = DEFAULT_DESIGNER_HARDWARE_STYLE_ID, hardwareAccent?: string) {
  const group = new THREE.Group();
  addCabinet(group, sku as never, null, {}, 120, 96, "#f2e8d0", "#ffffff", { doorStyle: "Shaker" }, undefined, undefined, undefined, { hardwareStyleId: style, hardwareAccent });
  const hardware: THREE.Object3D[] = [];
  group.traverse(node => { if (node.userData.cabinetHardware) hardware.push(node); });
  return hardware;
}

describe("regular Designer actual 3D handles", () => {
  it("renders visible hardware on the sourced 48-inch vanity when the Designer passes Bar Pulls", () => {
    const hardware = render(vanity);
    expect(hardware.length).toBeGreaterThanOrEqual(8);
    expect(hardware.some(node => node.userData.cabinetPull === "door")).toBe(true);
    expect(hardware.some(node => node.userData.cabinetPull === "drawer")).toBe(true);
  });
  it("preserves explicit None while still supporting visible knobs", () => {
    expect(render(vanity, "none")).toHaveLength(0);
    expect(render(vanity, "knob").length).toBeGreaterThan(0);
  });
  it("renders visible cup pulls on drawer fronts and door knobs on door fronts", () => {
    const hardware = render(vanity, "cup-pull");
    expect(hardware.some(node => node.userData.cabinetPull === "cup-pull")).toBe(true);
    expect(hardware.some(node => node.userData.cabinetPull === "knob")).toBe(true);
  });
  it("applies a selected real hardware finish to existing proxy meshes without changing None behavior", () => {
    const hardware = render(vanity, "bar-pull", "#1d2024");
    const pull = hardware.find((node) => node.userData.cabinetPull === "door") as THREE.Mesh;
    expect((pull.material as THREE.MeshPhysicalMaterial).color.getHexString()).toBe("1d2024");
    expect(render(vanity, "none", "#1d2024")).toHaveLength(0);
  });
  it("does not add handles to finished panel stock", () => {
    expect(render({ ...vanity, masterCode: "WEP1542", description: "Wall End Panel", placementType: "wall", width: 15, height: 42, depth: 0.75, numberOfDoors: 0, numberOfDrawers: 0 })).toHaveLength(0);
  });
  it("retains hardware as a finishing note rather than a priced product or invoice amount", () => {
    const placed = { ...vanity, uid: "qa-vanity", cabinetId: 10110067, placement: "base", x: 24, y: 0, rotation: 0 } as PlacedCabinet;
    const schedule = hardwareSchedule([placed], DEFAULT_DESIGNER_HARDWARE_STYLE_ID);
    expect(schedule.total).toBe(8);
    expect(hardwareScheduleNote(schedule)).toContain("Bar Pulls");
    expect(schedule).not.toHaveProperty("price");
    expect(schedule).not.toHaveProperty("unitPrice");
  });
});

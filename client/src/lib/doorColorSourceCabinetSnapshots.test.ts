import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { buildAuditDoor } from "./doorAuditDoorRender";
import {
  CABINET_SNAPSHOT,
  cabinetFrontLayout,
  cabinetSnapshotHeightIn,
  snapshotCabinets,
  type CabinetSnapshotSession,
} from "./doorColorSourceCabinetSnapshots";
import { sampleDoorComparisonRenderInput } from "./sampleDoorCompare";
import type { DoorAuditDoorProfile, DoorAuditRenderInput } from "./doorRenderingAudit";

const shaker: DoorAuditDoorProfile = {
  doorStyle: "Shaker", doorPanelType: null, railWidth: "2.25", stileWidth: "2.25", panelConstruction: "flat",
  bevelWidth: null, bevelDepth: null, insideEdgeProfile: "square", drawerFrontType: "five-piece-flat",
  grainDirection: "none", finishSheen: "satin",
};
const doorInput = { doorProfile: shaker, color: "#3a6ea5", renderHex: "#3a6ea5", samplePhotoUrl: null, name: "Classic Cream" } as Pick<
  DoorAuditRenderInput, "doorProfile" | "color" | "samplePhotoUrl" | "name" | "renderHex"
>;

describe("cabinet snapshot layout", () => {
  it("a base cabinet is a drawer over a door; a wall cabinet is one door", () => {
    const base = cabinetFrontLayout("base");
    expect(base.map((front) => front.role)).toEqual(["drawer", "door"]);
    expect(base[0].centerYIn).toBeGreaterThan(base[1].centerYIn);
    expect(cabinetFrontLayout("wall").map((front) => front.role)).toEqual(["door"]);
  });

  it("the fronts stay inside the cabinet box with a gap between them", () => {
    const { base, gapIn } = CABINET_SNAPSHOT;
    const [drawer, door] = cabinetFrontLayout("base");
    const boxTop = base.toeKickIn + base.boxHeightIn;
    expect(drawer.centerYIn + drawer.heightIn / 2).toBeLessThanOrEqual(boxTop - gapIn + 1e-9);
    expect(door.centerYIn - door.heightIn / 2).toBeGreaterThanOrEqual(base.toeKickIn + gapIn - 1e-9);
    expect(drawer.centerYIn - drawer.heightIn / 2 - (door.centerYIn + door.heightIn / 2)).toBeCloseTo(gapIn, 6);
    expect(cabinetSnapshotHeightIn("base")).toBe(base.toeKickIn + base.boxHeightIn + base.counterIn);
    expect(cabinetSnapshotHeightIn("wall")).toBe(CABINET_SNAPSHOT.wall.boxHeightIn);
  });
});

describe("shaker outline (the shaker generic image)", () => {
  const linesOf = (door: THREE.Object3D) => {
    const found: THREE.Object3D[] = [];
    door.traverse((child) => {
      if (child.userData.shakerOutline) found.push(child);
    });
    return found;
  };

  it("with the outline on, every rail and stile gets edge lines and the opening gets a soft shadow", () => {
    const door = buildAuditDoor(doorInput, null, { outline: true });
    expect(linesOf(door)).toHaveLength(4);
    const shades: THREE.Object3D[] = [];
    door.traverse((child) => {
      if (child.userData.shakerOpeningShade) shades.push(child);
    });
    expect(shades.length).toBeGreaterThanOrEqual(4);
  });

  it("rails stand slightly proud of the center panel at the generic image's rail depth", () => {
    const outlined = buildAuditDoor(doorInput, null, { outline: true });
    const plain = buildAuditDoor(doorInput, null);
    const depthOf = (door: THREE.Object3D) => {
      let depth = 0;
      door.traverse((child) => {
        if (child.userData.physicalRail) depth = (child as THREE.Mesh).geometry.parameters.depth;
      });
      return depth;
    };
    expect(depthOf(plain)).toBeCloseTo(0.026, 6);
    expect(depthOf(outlined)).toBeGreaterThan(depthOf(plain));
  });

  it("without the option the audit door is unchanged: no outline, no shadow", () => {
    const door = buildAuditDoor(doorInput, null);
    expect(linesOf(door)).toHaveLength(0);
  });

  it("a front can be any size: a 6 inch drawer front keeps its own proportions", () => {
    const door = buildAuditDoor(doorInput, null, { size: { widthIn: 17.5, heightIn: 5.75 }, outline: true });
    const slab = door.children.find((child) => child.userData.auditDoorSlab) as THREE.Mesh;
    expect(slab.geometry.parameters.width).toBeCloseTo(17.5 / 12, 6);
    expect(slab.geometry.parameters.height).toBeCloseTo(5.75 / 12, 6);
  });
});

describe("snapshotCabinets", () => {
  const job = (key: string) => ({ key, input: { styleId: 1 } as unknown as DoorAuditRenderInput });
  const fakeSession = (failOn: string[] = []): CabinetSnapshotSession & { dispose: ReturnType<typeof vi.fn> } => ({
    snapshot: vi.fn(async (input: DoorAuditRenderInput) => {
      const key = String((input as unknown as { key?: string }).key ?? "");
      void key;
      return "data:image/png;base64,AAAA";
    }),
    dispose: vi.fn(),
  });

  it("draws every job on one session and disposes it once", async () => {
    const session = fakeSession();
    const results: Record<string, unknown> = {};
    await snapshotCabinets([job("a"), job("b"), job("c"), job("d")], "base", (key, result) => { results[key] = result; }, () => false, () => session);
    expect(Object.keys(results)).toEqual(["a", "b", "c", "d"]);
    expect(session.snapshot).toHaveBeenCalledTimes(4);
    expect(session.dispose).toHaveBeenCalledTimes(1);
  });

  it("one job failing does not stop the others, and it reports its own error", async () => {
    let call = 0;
    const session: CabinetSnapshotSession = {
      snapshot: async () => {
        call += 1;
        if (call === 2) throw new Error("Could not load the sample photo for this door.");
        return "data:image/png;base64,AAAA";
      },
      dispose: vi.fn(),
    };
    const results: Record<string, { url?: string; error?: string }> = {};
    await snapshotCabinets([job("a"), job("b"), job("c")], "wall", (key, result) => { results[key] = result as never; }, () => false, () => session);
    expect(results.a.url).toBeTruthy();
    expect(results.b.error).toMatch(/Could not load the sample photo/);
    expect(results.c.url).toBeTruthy();
    expect(session.dispose).toHaveBeenCalledTimes(1);
  });

  it("when the renderer cannot be created every job gets the reason", async () => {
    const results: Record<string, { error?: string }> = {};
    await snapshotCabinets([job("a"), job("b")], "base", (key, result) => { results[key] = result as never; }, () => false, () => {
      throw new Error("WebGL is not available.");
    });
    expect(results.a.error).toMatch(/WebGL is not available/);
    expect(results.b.error).toMatch(/WebGL is not available/);
  });

  it("stops between tiles when cancelled, and still disposes", async () => {
    const session = fakeSession();
    let cancelled = false;
    await snapshotCabinets([job("a"), job("b"), job("c")], "base", (key) => { if (key === "a") cancelled = true; }, () => cancelled, () => session);
    expect(session.snapshot).toHaveBeenCalledTimes(1);
    expect(session.dispose).toHaveBeenCalledTimes(1);
  });
});

describe("sampleDoorComparisonRenderInput identity order", () => {
  it("a style row's own copy of the photo, profile or gate never overrides the caller's", () => {
    const input = sampleDoorComparisonRenderInput({
      style: {
        styleId: 3,
        name: "Classic Cream",
        identity: { ourName: "Classic Cream", samplePhotoUrl: "https://elsewhere/other.jpg", colorDeltaEMax: 3, doorProfile: { doorStyle: "Slab" }, color: "#efe6cf" },
      },
      doorProfile: shaker,
      samplePhotoUrl: "https://cdn/own.jpg",
    });
    expect(input).toMatchObject({ samplePhotoUrl: "https://cdn/own.jpg", colorDeltaEMax: null, doorProfile: shaker, color: "#efe6cf" });
  });
});

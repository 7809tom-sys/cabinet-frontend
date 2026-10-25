import { describe, expect, it } from "vitest";
import { hasDesignedRoomGeometry, initialDesignWorkspaceView, threeDLeftCatalogDragPayload } from "./designTool3DWorkspace";

describe("3D-first design workspace", () => {
  it("opens the 3D workspace by default", () => {
    expect(initialDesignWorkspaceView("")).toBe("threeD");
    expect(initialDesignWorkspaceView("?view=3d")).toBe("threeD");
  });

  it("retains explicit bird's-eye and precision view links", () => {
    expect(initialDesignWorkspaceView("?view=plan")).toBe("plan");
    expect(initialDesignWorkspaceView("?view=front")).toBe("elevation");
    expect(initialDesignWorkspaceView("?view=split")).toBe("split");
    expect(initialDesignWorkspaceView("?view=hybrid")).toBe("hybrid");
    expect(initialDesignWorkspaceView("?view=3d-plan")).toBe("hybrid");
  });

  it("uses catalog payloads accepted by the 3D drop target for left-rail dragging", () => {
    expect(threeDLeftCatalogDragPayload("Cabinet", 42)).toBe("Cabinet:42");
    expect(threeDLeftCatalogDragPayload("Accessory", 7)).toBe("Accessory:7");
  });

  it("treats a Continuous Wall Builder room as renderable before any cabinet is placed", () => {
    expect(hasDesignedRoomGeometry({ width: 144, depth: 120, ceilingHeight: 96 })).toBe(false);
    expect(hasDesignedRoomGeometry({
      width: 220,
      depth: 180,
      ceilingHeight: 96,
      openWallPath: true,
      vertices: [
        { id: "v1", x: 0, y: 0 },
        { id: "v2", x: 66, y: 0 },
        { id: "v3", x: 155.1, y: 89.1 },
      ],
      customWalls: [
        { id: "wall-1", startVertexId: "v1", endVertexId: "v2", label: "Wall 1", height: 96 },
        { id: "wall-2", startVertexId: "v2", endVertexId: "v3", label: "Wall 2", height: 96, lockedAngle: 45 },
      ],
    })).toBe(true);
  });

  it("treats an explicitly measured rectangular room as renderable", () => {
    expect(hasDesignedRoomGeometry({ width: 120, depth: 96, ceilingHeight: 96 })).toBe(true);
  });
});

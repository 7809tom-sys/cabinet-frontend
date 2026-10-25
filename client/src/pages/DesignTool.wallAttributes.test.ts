import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

describe("Continuous Wall Builder wall attributes", () => {
  it("lets the Edit wall popup switch among every drawn wall", () => {
    expect(source).toContain('data-testid="wall-settings-wall-select"');
    expect(source).toContain("room.customWalls?.map((wall)");
    expect(source).toContain("openWallSettings(event.target.value as WallSide)");
    expect(source).toContain("Length (in)");
    expect(source).toContain("Height (in)");
    expect(source).toContain("Locked direction");
    expect(source).toContain('event.target.value === "" ? "" : Number(event.target.value)');
  });

  it("adds doors and windows directly to the selected drawn wall", () => {
    expect(source).toContain('data-testid="add-door-to-selected-wall"');
    expect(source).toContain('data-testid="add-window-to-selected-wall"');
    expect(source).toContain('addOpeningFromWallSettings("door")');
    expect(source).toContain('addOpeningFromWallSettings("window")');
    expect(source).toContain("makeOpening(def, wallId, room)");
  });

  it("deletes only the selected empty wall and its own openings", () => {
    expect(source).toContain('data-testid="delete-selected-custom-wall"');
    expect(source).toContain('data-testid="custom-wall-delete-dialog"');
    expect(source).toContain("prompt.cabinetCount > 0");
    expect(source).toContain("deleteCustomWallSegment(prompt.wallId, room.vertices, room.customWalls)");
    expect(source).toContain("previous.filter((opening) => opening.side !== prompt.wallId)");
    expect(source).toContain("Every other wall keeps its existing length, height, angle, and position.");
  });
});

describe("Designer primary view and window editing controls", () => {
  it("keeps a prominent two-way Floor Plan and 3D View switch in the primary toolbar", () => {
    expect(source).toContain('data-testid="primary-floor-plan-3d-switch"');
    expect(source).toContain('data-testid="switch-to-floor-plan"');
    expect(source).toContain('data-testid="switch-to-3d-view"');
    expect(source).toContain('onClick={() => setViewMode("plan")}');
    expect(source).toContain('onClick={() => setViewMode("threeD")}');
  });

  it("forwards Plan Canvas window gestures to the exact Window Attributes dialog", () => {
    expect(source).toContain("onOpenWindowAttributes={openWindowAttributes}");
    expect(source).toContain("const openWindowAttributes = useCallback((uid: string) => {");
    expect(source).toContain("setWindowAttrOpen(true);");
  });
});

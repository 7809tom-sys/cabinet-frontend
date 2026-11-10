import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const designTool = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");
const planCanvas = readFileSync(resolve(process.cwd(), "client/src/components/design/PlanCanvas.tsx"), "utf8");
const menu = readFileSync(resolve(process.cwd(), "client/src/components/design/WallActionsMenu.tsx"), "utf8");

describe("Add wall from a wall's face", () => {
  it("puts Add wall on the wall context menu and opens a confirm dialog", () => {
    expect(menu).toContain("Add wall");
    expect(menu).toContain('data-testid="wall-actions-add"');
    expect(planCanvas).toContain("onAddWall?.(wallMenu.side, wallMenu.point)");
    expect(designTool).toContain('data-testid="add-wall-dialog"');
    expect(designTool).toContain('data-testid="add-wall-length"');
    expect(designTool).toContain('data-testid="add-wall-height"');
    expect(designTool).toContain('data-testid="add-wall-angle"');
    expect(designTool).toContain("90° — straight out from the wall");
    expect(designTool).toContain('data-testid="add-wall-turn"');
    expect(designTool).toContain('data-testid="add-wall-turn-left"');
    expect(designTool).toContain('data-testid="add-wall-turn-right"');
    expect(designTool).toContain("addWallDraft.angle === 45");
    expect(designTool).toContain('data-testid="add-wall-cancel"');
    expect(designTool).toContain("setAddWallOpen(false)");
    expect(designTool).toContain("placeAttachedWall({");
  });

  it("slides the new wall along its host and keeps cardinal rooms intact", () => {
    expect(planCanvas).toContain("onSlideHostedWall?.(drag.wallId, wallPointFromEvent(event), drag.grabAlong)");
    expect(designTool).toContain("slideAttachedWall({");
    expect(designTool).toContain("preserveCardinalWalls");
    expect(designTool).toContain('room.preserveCardinalWalls ? 4 : (room.customWalls?.length ?? 4)');
  });
});

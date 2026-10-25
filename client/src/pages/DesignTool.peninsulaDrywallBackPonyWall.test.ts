import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const designTool = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const planCanvas = readFileSync(new URL("../components/design/PlanCanvas.tsx", import.meta.url), "utf8");
const threeD = readFileSync(new URL("../components/design/InteractiveRoom3D.tsx", import.meta.url), "utf8");

describe("drywall pony wall behind a peninsula cabinet run", () => {
  it("provides an editable peninsula setting that creates or removes the attached drywall wall", () => {
    expect(designTool).toContain('data-testid="peninsula-drywall-back-pony-wall"');
    expect(designTool).toContain("Drywall pony wall behind cabinet run");
    expect(designTool).toContain("makePeninsulaDrywallBackPonyWall(run, prospectiveRoom, { height: drywallBackPonyWallHeight, color: draft.drywallColor, texture: draft.drywallTexture })");
    expect(designTool).toContain('peninsulaPlacement === "behind-cabinets"');
    expect(designTool).toContain('finish === "drywall"');
    expect(designTool).toContain("would extend outside the measured room");
  });

  it("labels the drywall wall in plan and preserves its finish in 3D", () => {
    expect(planCanvas).toContain('data-testid={isDrywallBackedPeninsula ? "peninsula-drywall-back-pony-wall"');
    expect(planCanvas).toContain("DRYWALL PONY WALL");
    expect(threeD).toContain("const drywallFinished = ponyWall.peninsulaPlacement === \"behind-cabinets\" && ponyWall.finish === \"drywall\"");
    expect(threeD).toContain("drywallFinished");
  });

  it("offers paint and texture pickers and passes the saved finish to plan and 3D", () => {
    expect(designTool).toContain('data-testid="peninsula-drywall-finish-picker"');
    expect(designTool).toContain('aria-label="Drywall pony wall paint color"');
    expect(designTool).toContain('aria-label="Drywall pony wall texture"');
    expect(designTool).toContain("DRYWALL_PONY_WALL_TEXTURE_OPTIONS.map");
    expect(planCanvas).toContain("const drywallPlanBackground = drywallPonyWallPreviewBackground(pw)");
    expect(threeD).toContain("const drywallAppearance = drywallPonyWallAppearance(ponyWall)");
    expect(threeD).toContain("drywallColor: drywallFinished ? drywallAppearance.color : null");
  });

	it("can apply the selected pony-wall finish immediately to every physical room wall", () => {
    expect(designTool).toContain('data-testid="apply-pony-wall-appearance-to-all-walls"');
    expect(designTool).toContain("Apply to all walls");
    expect(designTool).toContain("const applyDrywallAppearanceToAllRoomWalls");
    expect(designTool).toContain("wallAppearance: { color: draft.drywallColor, texture: draft.drywallTexture }");
    expect(designTool).toContain("Applied this drywall color and texture to all room walls.");
    expect(threeD).toContain("const resolvedRoomWallAppearance = roomWallAppearance(roomOverride)");
	  expect(threeD).toContain("roomWallTexture: hasRoomWallAppearance ? resolvedRoomWallAppearance.texture : null");
	});

	it("offers a one-click undo that restores the exact pre-apply wall appearance", () => {
	  expect(designTool).toContain("const [allWallsAppearanceUndo, setAllWallsAppearanceUndo]");
	  expect(designTool).toContain("previous: room.wallAppearance ? { ...room.wallAppearance } : undefined");
	  expect(designTool).toContain('data-testid="undo-apply-pony-wall-appearance-to-all-walls"');
	  expect(designTool).toContain("const undoAllRoomWallAppearance");
	  expect(designTool).toContain("Restored the previous room wall appearance.");
	  expect(designTool).toContain("const { wallAppearance: _discardedWallAppearance, ...roomWithoutAppliedAppearance } = previous;");
	});

	it("shows a live paint-and-texture thumbnail before the room-wide action is used", () => {
    expect(designTool).toContain('data-testid="peninsula-drywall-material-preview"');
    expect(designTool).toContain("Material preview:");
    expect(designTool).toContain("drywallPonyWallPreviewBackground({ drywallColor: wallSettingsDraft.drywallColor, drywallTexture: wallSettingsDraft.drywallTexture })");
    expect(designTool).toContain("Preview updates here first; use Apply to all walls to update the room shell.");
    expect(planCanvas).toContain("const drywallPlanBackground = drywallPonyWallPreviewBackground(pw)");
  });
});

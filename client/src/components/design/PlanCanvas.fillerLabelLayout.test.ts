import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./PlanCanvas.tsx", import.meta.url), "utf8");

/**
 * The 2D plan used to draw every filler banner at the same height, so a run with
 * several small boards stacked its labels on top of each other and on the cabinet
 * codes underneath. Each banner now takes a placement from `layoutFillerLabels`:
 * a lane offset when neighbours overlap, and the short form when the run is too
 * crowded for full-width banners.
 */
describe("PlanCanvas filler label de-collision", () => {
  it("lays the banners out per run instead of drawing them all at one height", () => {
    expect(source).toContain("layoutFillerLabels(inputs)");
    expect(source).toContain("fillerLabelPlacements.get(p.uid)");
  });

  it("applies the lane offset and the collapsed text to both banner styles", () => {
    expect(source.match(/data-filler-label-lane=\{placement\?\.lane \?\? 0\}/g)).toHaveLength(2);
    expect(source.match(/data-filler-label-collapsed=\{placement\?\.collapsed \? "true" : undefined\}/g)).toHaveLength(2);
    expect(source.match(/const text = placement\?\.text \?\? fullText;/g)).toHaveLength(2);
  });

  it("keeps the full text in the tooltip even when the banner collapses", () => {
    // Both banners pass the unshortened string as `title`.
    expect(source).toContain("title={fullText}");
    expect(source).toContain("title={`Measured filler gap ");
  });

  it("groups banners by wall and layer, so two runs across the room never stack", () => {
    expect(source).toContain("function planFillerLabelGroup(p: PlacedCabinet, room: RoomData): string");
    expect(source).toContain("return `${wall}/${p.placement}`;");
    expect(source).toContain("groupId: planFillerLabelGroup(item, room)");
  });
});

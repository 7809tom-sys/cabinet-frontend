import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { type PlacedCabinet, type RoomData, wallPlacementAt } from "@/lib/design";
import { ElevationView } from "./ElevationView";

const customWallId = "measured-east-run";

const room: RoomData = {
  width: 120,
  depth: 96,
  ceilingHeight: 96,
  openWallPath: true,
  vertices: [
    { id: "start", x: 0, y: 0 },
    { id: "end", x: 120, y: 0 },
  ],
  customWalls: [{
    id: customWallId,
    startVertexId: "start",
    endVertexId: "end",
    label: "Measured back run",
    // Taller than the room's one 96-inch ceiling: the wall must render at 96.
    height: 108,
  }],
};

function onCustomWall(
  uid: string,
  placement: PlacedCabinet["placement"],
  along: number,
  width: number,
  depth: number,
  height: number,
): PlacedCabinet {
  const spot = wallPlacementAt(along, width, depth, customWallId as "top", room);
  return {
    uid,
    cabinetId: 1,
    masterCode: placement === "wall" ? `W-${width}` : `B-${width}`,
    description: placement === "wall" ? `${width}" Wall Cabinet` : `${width}" Base Cabinet`,
    placement,
    x: spot.x,
    y: spot.y,
    width,
    depth,
    height,
    rotation: spot.rotation,
    wallId: customWallId,
    wallOffset: spot.wallOffset,
    numberOfDoors: 2,
    numberOfDrawers: 0,
  };
}

function renderCustomElevation() {
  return renderToStaticMarkup(
    createElement(LanguageProvider, null, createElement(ElevationView, {
      room,
      cabinets: [
        onCustomWall("base", "base", 18, 24, 24, 34.5),
        onCustomWall("upper", "wall", 54, 30, 12, 30),
      ],
      selectedUid: null,
      onSelect: () => undefined,
      onSelectWall: () => undefined,
      wall: customWallId,
      crown: true,
      toeKick: true,
      lightRail: true,
    })),
  );
}

describe("ElevationView drawn wall runs", () => {
  it("renders a drawn wall at its own span and ceiling, with cabinet offsets measured on the shared run", () => {
    const markup = renderCustomElevation();

    // The server render defaults to four pixels per inch: the 120" measured
    // wall is 480px wide. Its saved 108" height cannot exceed the room's one
    // 96" ceiling, so the wall box is 384px tall, exactly like a standard wall.
    expect(markup).toContain("width:480px;height:424px");
    expect(markup).toContain("height:384px");
    expect(markup).not.toContain("height:432px");
    // Base starts at 18" and is 24" wide; upper starts at 54" and is 30".
    expect(markup).toContain("left:72px;width:96px");
    expect(markup).toContain("left:216px;width:120px");
    expect(markup).toContain("Measured back run");
  });

  it("uses the same drawn-wall run coordinates for crown, toe kick, and light rail", () => {
    const markup = renderCustomElevation();

    expect(markup).toContain('data-testid="continuous-crown-run"');
    expect(markup).toContain('data-testid="continuous-toe-kick-run"');
    expect(markup).toContain('data-testid="light-rail-strip"');
    // Crown/light rail remain aligned to the upper's 54" measured start.
    expect(markup).toContain("left:214px;width:124px");
    expect(markup).toContain("left:217px;width:118px");
  });
});

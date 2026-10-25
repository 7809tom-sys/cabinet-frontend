import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("DesignTool structural undo redo", () => {
  it("keeps remote sharing out of the primary toolbar and supplies rotation through PlanCanvas", () => {
    expect(source).not.toContain("Remote Share");
    expect(source).toContain("onRotateDrawing={isPolygonRoom ? rotateDrawingClockwise : undefined}");
    expect(source).toContain("drawingRotationDisabled={layoutLocked}");
  });

  it("captures the complete physical plan rather than only cabinet placements", () => {
    expect(source).toContain("type DesignerHistorySnapshot = {");
    for (const field of ["room: RoomData", "placed: PlacedCabinet[]", "activeWall: WallSide", "openings: WallOpening[]", "sinks: SinkFixture[]", "island: IslandZone | null", "furniture: PlacedFurniture[]", "annotations: PlanAnnotation[]", "ponyWalls: PonyWall[]"]) {
      expect(source).toContain(field);
    }
    expect(source).toContain("const undoRedo = useUndoRedo<DesignerHistorySnapshot>()");
    expect(source).toContain("const historySnapshot = useMemo<DesignerHistorySnapshot>");
  });

  it("restores cabinet, wall, opening, fixture, and island state together", () => {
    const start = source.indexOf("const applyHistorySnapshot = useCallback");
    const end = source.indexOf("const handleUndo = useCallback", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = source.slice(start, end);
    for (const required of [
      "setRoom(snapshot.room)",
      "setPlaced(snapshot.placed)",
      "setActiveWall(snapshot.activeWall)",
      "setOpenings(snapshot.openings)",
      "setSinks(snapshot.sinks)",
      "setIsland(snapshot.island)",
      "setFurniture(snapshot.furniture)",
      "setAnnotations(snapshot.annotations)",
      "setPonyWalls(snapshot.ponyWalls)",
      "historyRestoringRef.current = true",
    ]) expect(block).toContain(required);
  });

  it("exposes disabled-aware desktop and mobile undo redo controls plus keyboard shortcuts", () => {
    expect(source).toContain('data-testid="designer-undo"');
    expect(source).toContain('data-testid="designer-redo"');
    expect(source).toContain("disabled={!canUndo}");
    expect(source).toContain("disabled={!canRedo}");
    expect(source).toContain('event.key === "z" && !event.shiftKey');
    expect(source).toContain('event.key === "y" || (event.key === "z" && event.shiftKey)');
  });

  it("rebases history after saved-plan load and clear so undo never returns to a different design", () => {
    expect(source).toContain("historyRebaseRequestedRef.current = true");
    expect(source).toContain("lastPushedRef.current = null");
    expect(source).toContain("undoRedoRef.current.clear()");
  });
});

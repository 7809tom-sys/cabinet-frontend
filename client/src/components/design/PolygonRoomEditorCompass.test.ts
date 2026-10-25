import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const editorSource = readFileSync(resolve(root, "client/src/components/design/PolygonRoomEditor.tsx"), "utf8");
const designToolSource = readFileSync(resolve(root, "client/src/pages/DesignTool.tsx"), "utf8");
const planCanvasSource = readFileSync(resolve(root, "client/src/components/design/PlanCanvas.tsx"), "utf8");
const threeDSource = readFileSync(resolve(root, "client/src/components/design/InteractiveRoom3D.tsx"), "utf8");
const roomSizeSource = readFileSync(resolve(root, "client/src/components/design/RoomSizeControl.tsx"), "utf8");

describe("selected-wall Compass editor", () => {
  it("uses tap-to-select as the default and presents a Compass on the selected wall", () => {
    expect(editorSource).toContain('useState<Mode>("select")');
    expect(editorSource).toContain("Edit selected wall with Compass");
    expect(editorSource).toContain("Edit ${wall.label ?? \"selected wall\"} with Compass");
  });

  it("uses one draggable Compass on the selected normal-plan wall and direct mobile entry", () => {
    expect(planCanvasSource).toContain("Drag Compass along ${wallLabel[side]} wall to set the peninsula split point");
    expect(planCanvasSource).toContain('onWallCompassDrop?: (side: WallSide, startIn: number) => void;');
    expect(planCanvasSource).toContain("onCompassPointerUp");
    expect(planCanvasSource).toContain('data-testid="on-wall-compass-drag-target"');
    expect(planCanvasSource).toContain("onCompassPointerCancel");
    expect(planCanvasSource).toContain("onLostPointerCapture={onCompassPointerCancel}");
    expect(roomSizeSource).toContain('data-testid="mobile-wall-compass-entry"');
    expect(roomSizeSource).toContain("Drag 45° on selected wall");
    expect(designToolSource).toContain('data-testid="compact-workspace-wall-compass"');
    expect(designToolSource).toContain('title="Activate 45° Compass"');
    expect(designToolSource).toContain('aria-label="Activate 45° Compass"');
    expect(designToolSource).toContain("const activateSelectedWallCompassDrag = useCallback");
    expect(designToolSource).toContain("onOpenWallCompass={() => {");
    expect(designToolSource).toContain("activateSelectedWallCompassDrag();");
    expect(designToolSource).not.toContain("openSelectedWallCompass");
    expect(editorSource).toContain("showCanvasEditor = true");
    expect(designToolSource).toContain("onDone={() => setPolygonEditMode(false)}");
  });

  it("wires the draggable Compass drop into both full and compact split-plan canvases", () => {
    expect((designToolSource.match(/wallCompassStartIn=\{compassWallStartIn\}/g) ?? []).length).toBe(2);
    expect((designToolSource.match(/onWallCompassDrop=\{beginPeninsulaFromCompass\}/g) ?? []).length).toBe(2);
    expect(designToolSource).toContain("const beginPeninsulaFromCompass = useCallback");
    expect(designToolSource).toContain("setPeninsulaDraft({");
    expect(designToolSource).toContain("const commitPeninsulaDraft = useCallback");
    expect(planCanvasSource).toContain('onWallCompassDrop?: (side: WallSide, startIn: number) => void;');
    expect(planCanvasSource).toContain("handle establishes a real peninsula split point");
  });

  it("keeps a normal-plan wall touch select-only and reserves room changes for explicit controls", () => {
    expect(planCanvasSource).toContain("const onWallPointerDown = (e: React.PointerEvent, side: WallSide) => {");
    expect(planCanvasSource).toContain("onSelectWall?.(side);");
    expect(planCanvasSource).toContain("Moving a pointer while selecting");
    expect(planCanvasSource).not.toContain("onResizeWall");
    expect(planCanvasSource).not.toContain("wallDrag");
    expect(planCanvasSource).not.toContain("wallPreview");
    expect(designToolSource).not.toContain("resizeRoomByWall");
    expect(designToolSource).not.toContain("onResizeWall={resizeWall}");
  });

	  it("keeps the direct Compass activation popup-free", () => {
	    expect(designToolSource).toContain("const activateSelectedWallCompassDrag = useCallback");
	    expect(designToolSource).toContain("const [compassVisible, setCompassVisible] = useState(false)");
	    expect(designToolSource).toContain("setCompassVisible(true);");
	    expect(designToolSource).toContain("if (uid) setCompassVisible(false);");
	    expect(designToolSource).toContain("Drag the gold 45° Compass");
    expect(designToolSource).toContain('onClick={activateSelectedWallCompassDrag}');
    expect(designToolSource).not.toContain("openSelectedWallCompass");
    expect(designToolSource).not.toContain("setCompassWallRequestId((current) => current + 1);");
  });

	  it("keeps the plan uncluttered and makes the Compass opt-in instead of a cabinet-drag affordance", () => {
	    expect(planCanvasSource).toContain("wallCompassVisible?: boolean");
	    expect(planCanvasSource).toContain("wallCompassVisible && !layoutLocked && onWallCompassDrop");
	    expect(planCanvasSource).toContain("Drag Compass along ${wallLabel[side]} wall to set the peninsula split point");
    expect(planCanvasSource).not.toContain('aria-label={`Select ${formatInches(g.length)} ${g.layer}-cabinet opening for best-fit options`}');
    expect(planCanvasSource).not.toContain('{g.layer === "wall" ? "W " : "B "}{formatInches(g.length)}');
  });

	it("keeps wall-measurement logic separate from the direct Compass gesture", () => {
	  expect(editorSource).toContain("Wall height (inches)");
	  expect(editorSource).toContain("Wall length (inches)");
	  expect(designToolSource).toContain("setCompassWallStartIn(exactStart);");
	  expect(designToolSource).toContain("Set its height and length; add a 45° continuation from its free end after creation.");
	  expect(planCanvasSource).toContain("Math.abs(movement) < 0.5");
	});

  it("keeps the new straight peninsula inline, popup-free, and pull-to-length before an optional free-end turn", () => {
	  expect(designToolSource).toContain('data-testid="peninsula-inline-builder"');
    expect(designToolSource).toContain("Create straight peninsula");
    expect(designToolSource).toContain("New straight peninsula");
    expect(designToolSource).toContain("turn: 90,");
    expect(designToolSource).toContain("add a 45° continuation from its free end");
    expect(planCanvasSource).toContain('data-testid="peninsula-run-draft"');
    expect(planCanvasSource).toContain('data-testid="peninsula-run-segment"');
    expect(planCanvasSource).toContain("onPeninsulaDraftLengthChange");
    expect(designToolSource).toContain("const activePeninsulaRun = peninsulaRunById(room, targetWall ?? activeWall);");
    expect(planCanvasSource).toContain("peninsulaRunHitAtPoint(room, point");
    expect(designToolSource).toContain("peninsulaSide: spot.peninsulaSide");
    expect(designToolSource).toContain('data-testid="edit-selected-wall-trigger"');
    expect(designToolSource).toContain("Edit selected wall");
    expect(designToolSource).toContain("Move or remove cabinets on this peninsula before changing its split point, angle, direction, or length.");
  });

  it("lets the selected-cabinet Snap to wall action target the selected peninsula run", () => {
    expect(designToolSource).toContain("const snapSelectedToWall = useCallback");
    expect(designToolSource).toContain("const peninsula = peninsulaRunById(room, side);");
    expect(designToolSource).toContain("const segments = freeSegmentsOnWall(");
    expect(designToolSource).toContain("const along = nearestAvailableWallStart(segments, requestedAlong, selected.width);");
    expect(designToolSource).toContain("wallId: side as WallSide");
    expect(designToolSource).toContain("onPickPeninsula={snapSelectedToWall}");
  });

  it("provides joined-end attachment movement and right-click settings while reserving committed-run length changes for Attributes", () => {
    expect(planCanvasSource).toContain('onPeninsulaAttachmentChange?: (runId: string, startOffset: number) => void;');
    expect(planCanvasSource).toContain("const onPeninsulaAttachmentPointerDown");
    expect(planCanvasSource).toContain('aria-label="Drag joined peninsula end along adjoining wall"');
    expect(planCanvasSource).toContain('aria-label="Add a connected 45° or 90° wall from the far peninsula end"');
    expect(planCanvasSource).toContain('title="Compass: add a new connected 45° or 90° wall from this end"');
    expect(planCanvasSource).toContain("onOpenWallSettings?.(run.id as WallSide);");
    expect(designToolSource).toContain("const movePeninsulaAttachment = useCallback");
    expect(planCanvasSource).toContain('Right-click for Attributes');
    expect(planCanvasSource).not.toContain('aria-label="Drag far peninsula end to change length"');
    expect(planCanvasSource).not.toContain("const onPeninsulaLengthPointerDown");
    expect(designToolSource).not.toContain("const resizePeninsulaRun = useCallback");
    expect(designToolSource).toContain('cabinetSide: peninsula?.cabinetSide ?? "left"');
  });

  it("keeps peninsula overlays compact by removing rotated run text while keeping upright endpoint controls", () => {
    expect(planCanvasSource).toContain("const counterRotate: React.CSSProperties = { transform: `rotate(${-runDegrees}deg)` };");
    expect(planCanvasSource).not.toContain('Peninsula · {run.turn}° {run.direction} · {run.height}"');
    expect(planCanvasSource).not.toContain('Connected return · gold end resizes');
    expect(planCanvasSource).not.toContain('Hold line to move · gold end resizes');
    expect(planCanvasSource).toContain('className="absolute -right-2 top-[18px] z-20 flex h-5 w-5');
  });

  it("applies the cabinet magnet to peninsula and connected-return runs while retaining collision protection", () => {
    expect(designToolSource).toContain("const explicitCornerOffset = target?.wallId === requestedWallId");
    expect(designToolSource).toContain("const desiredStart = explicitCornerOffset ?? (requestedAlong - cabinet.width / 2);");
	    expect(designToolSource).toContain("const shouldMagnetSnapToRun = automaticSnapping && !customPlacementMode && !exactWallDrag;");
	    expect(designToolSource).toContain("? nearestAvailableWallStart(segments, desiredStart, cabinet.width)");
	    expect(designToolSource).toContain("wallLength(requestedWallId as WallSide, room) - cabinet.width");
	    expect(designToolSource).toContain("shouldBlockPlacementCollision(movedCabinet, peers, customPlacementMode, room)");
  });

  it("blocks a geometry edit before a cabinet can become orphaned", () => {
    expect(editorSource).toContain("Move or remove the");
    expect(editorSource).toContain("The wall was not changed.");
    expect(designToolSource).toContain("cabinetUidsByWall={cabinetUidsByCustomWall}");
  });

  it("uses the selected custom wall height in 3D while retaining cardinal wall-height fallback", () => {
    expect(threeDSource).toContain("const customWallHeight = customWall?.height");
    expect(threeDSource).toContain("typeof customWallHeight === \"number\" ? customWallHeight : wallHeights[side]");
  });
});

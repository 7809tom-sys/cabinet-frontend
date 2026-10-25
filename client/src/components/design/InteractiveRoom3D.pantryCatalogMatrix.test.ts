import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { AEF_PRINTED_GEOMETRY_MARKER } from "@shared/aefFramelessGeometry";
import type { PlacedCabinet, RoomData } from "@/lib/design";
import { addCabinet, existingCabinetSku, existingCabinetTransform } from "./InteractiveRoom3D";

/**
 * Sanitized static transcription of the supplied actual Cabinet Config API
 * response for placement=tall and styleId=540005: 51 source records, narrowed
 * only to the 30 rows matching /^(?:VT|T)[23]DB/ with doors > 0 and drawers > 0.
 * There is deliberately no test-time API, database, filesystem, or browser I/O.
 */
const ACTUAL_API_CONTEXT = {
  placement: "tall",
  styleId: 540005,
  sourceRecordCount: 51,
  selectedPantryDrawerRecordCount: 30,
} as const;

const SOURCE_CONSTRUCTION_METHOD =
  "Frameless; distributor geometry is printed in AltaEuro Collection Full Spec Book V8.2";

type ActualPantryDrawerModel = Readonly<{
  id: number;
  masterCode: string;
  description: string;
  category: "Tall";
  placement: "tall";
  width: number;
  height: number;
  depth: number;
  numberOfDoors: number;
  numberOfDrawers: number;
  drawerLayout: null;
  /** Actual API graphicType; placed records persist it as customProfile. */
  graphicType: string;
  constructionMethod: typeof SOURCE_CONSTRUCTION_METHOD;
}>;

function actualModel(
  id: number,
  masterCode: string,
  description: string,
  width: number,
  height: number,
  depth: number,
  numberOfDoors: number,
  numberOfDrawers: number,
  graphicType: string,
): ActualPantryDrawerModel {
  return {
    id,
    masterCode,
    description,
    category: "Tall",
    placement: "tall",
    width,
    height,
    depth,
    numberOfDoors,
    numberOfDrawers,
    drawerLayout: null,
    graphicType,
    constructionMethod: SOURCE_CONSTRUCTION_METHOD,
  };
}

const ACTUAL_PANTRY_DRAWER_MODELS = [
  actualModel(15510068, "T2DB1884", '18" W × 84" H × 24" D Tall Two Door Cabinet with Two Drawers', 18, 84, 24, 1, 2, "tall_2door_2drawer"),
  actualModel(15510069, "T2DB1889", '18" W × 89" H × 24" D Tall Two Door Cabinet with Two Drawers', 18, 89, 24, 1, 2, "tall_2door_2drawer"),
  actualModel(15510070, "T2DB1894", '18" W × 94" H × 24" D Tall Two Door Cabinet with Two Drawers', 18, 94, 24, 1, 2, "tall_2door_2drawer"),
  actualModel(15510077, "T2DBID1884", '18" W × 84" H × 24" D Tall Two Door Cabinet with Two Drawers and One Inner Drawer', 18, 84, 24, 2, 2, "tall_2door_2drawer"),
  actualModel(15510078, "T2DBID1889", '18" W × 89" H × 24" D Tall Two Door Cabinet with Two Drawers and One Inner Drawer', 18, 89, 24, 2, 2, "tall_2door_2drawer"),
  actualModel(15510079, "T2DBID1894", '18" W × 94" H × 24" D Tall Two Door Cabinet with Two Drawers and One Inner Drawer', 18, 94, 24, 2, 2, "tall_2door_2drawer"),
  actualModel(15510086, "T3DB1884", '18" W × 84" H × 24" D Tall Two Door Cabinet with Three Drawers', 18, 84, 24, 1, 3, "tall_2door_3drawer"),
  actualModel(15510087, "T3DB1889", '18" W × 89" H × 24" D Tall Two Door Cabinet with Three Drawers', 18, 89, 24, 1, 3, "tall_2door_3drawer"),
  actualModel(15510088, "T3DB1894", '18" W × 94" H × 24" D Tall Two Door Cabinet with Three Drawers', 18, 94, 24, 1, 3, "tall_2door_3drawer"),
  actualModel(15510121, "VT2DB1884", '18" W × 84" H × 21" D Tall One Door Vanity Utility Cabinet with Two Drawers', 18, 84, 21, 1, 2, "tall_1door_2drawer"),
  actualModel(15510122, "VT2DBID1884", '18" W × 84" H × 21" D Tall One Door Vanity Utility Cabinet with Two Drawers and One Inner Drawer', 18, 84, 21, 1, 2, "tall_1door_2drawer"),
  actualModel(15510123, "VT3DB1884", '18" W × 84" H × 21" D Tall One Door Vanity Utility Cabinet with Three Drawers', 18, 84, 21, 1, 3, "tall_1door_3drawer"),
  actualModel(15510071, "T2DB2484", '24" W × 84" H × 24" D Tall Two Door Cabinet with Two Drawers', 24, 84, 24, 1, 2, "tall_2door_2drawer"),
  actualModel(15510072, "T2DB2489", '24" W × 89" H × 24" D Tall Two Door Cabinet with Two Drawers', 24, 89, 24, 1, 2, "tall_2door_2drawer"),
  actualModel(15510073, "T2DB2494", '24" W × 94" H × 24" D Tall Two Door Cabinet with Two Drawers', 24, 94, 24, 1, 2, "tall_2door_2drawer"),
  actualModel(15510080, "T2DBID2484", '24" W × 84" H × 24" D Tall Two Door Cabinet with Two Drawers and One Inner Drawer', 24, 84, 24, 2, 2, "tall_2door_2drawer"),
  actualModel(15510081, "T2DBID2489", '24" W × 89" H × 24" D Tall Two Door Cabinet with Two Drawers and One Inner Drawer', 24, 89, 24, 2, 2, "tall_2door_2drawer"),
  actualModel(15510082, "T2DBID2494", '24" W × 94" H × 24" D Tall Two Door Cabinet with Two Drawers and One Inner Drawer', 24, 94, 24, 2, 2, "tall_2door_2drawer"),
  actualModel(15510089, "T3DB2484", '24" W × 84" H × 24" D Tall Two Door Cabinet with Three Drawers', 24, 84, 24, 1, 3, "tall_2door_3drawer"),
  actualModel(15510090, "T3DB2489", '24" W × 89" H × 24" D Tall Two Door Cabinet with Three Drawers', 24, 89, 24, 1, 3, "tall_2door_3drawer"),
  actualModel(15510091, "T3DB2494", '24" W × 94" H × 24" D Tall Two Door Cabinet with Three Drawers', 24, 94, 24, 1, 3, "tall_2door_3drawer"),
  actualModel(15510074, "T2DB3084", '30" W × 84" H × 24" D Tall Two Door Cabinet with Two Drawers', 30, 84, 24, 2, 2, "tall_2door_2drawer"),
  actualModel(15510075, "T2DB3089", '30" W × 89" H × 24" D Tall Two Door Cabinet with Two Drawers', 30, 89, 24, 2, 2, "tall_2door_2drawer"),
  actualModel(15510076, "T2DB3094", '30" W × 94" H × 24" D Tall Two Door Cabinet with Two Drawers', 30, 94, 24, 2, 2, "tall_2door_2drawer"),
  actualModel(15510083, "T2DBID3084", '30" W × 84" H × 24" D Tall Two Door Cabinet with Two Drawers and One Inner Drawer', 30, 84, 24, 2, 2, "tall_2door_2drawer"),
  actualModel(15510084, "T2DBID3089", '30" W × 89" H × 24" D Tall Two Door Cabinet with Two Drawers and One Inner Drawer', 30, 89, 24, 2, 2, "tall_2door_2drawer"),
  actualModel(15510085, "T2DBID3094", '30" W × 94" H × 24" D Tall Two Door Cabinet with Two Drawers and One Inner Drawer', 30, 94, 24, 2, 2, "tall_2door_2drawer"),
  actualModel(15510092, "T3DB3084", '30" W × 84" H × 24" D Tall Two Door Cabinet with Three Drawers', 30, 84, 24, 2, 3, "tall_2door_3drawer"),
  actualModel(15510093, "T3DB3089", '30" W × 89" H × 24" D Tall Two Door Cabinet with Three Drawers', 30, 89, 24, 2, 3, "tall_2door_3drawer"),
  actualModel(15510094, "T3DB3094", '30" W × 94" H × 24" D Tall Two Door Cabinet with Three Drawers', 30, 94, 24, 2, 3, "tall_2door_3drawer"),
] as const satisfies readonly ActualPantryDrawerModel[];

const ROOM: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

function placedCabinet(model: ActualPantryDrawerModel): PlacedCabinet {
  return {
    uid: `actual-tall-${model.id}`,
    cabinetId: model.id,
    masterCode: model.masterCode,
    description: model.description,
    category: model.category,
    placement: model.placement,
    constructionMethod: model.constructionMethod,
    styleId: ACTUAL_API_CONTEXT.styleId,
    x: 24,
    y: 0,
    width: model.width,
    height: model.height,
    depth: model.depth,
    rotation: 0,
    numberOfDoors: model.numberOfDoors,
    numberOfDrawers: model.numberOfDrawers,
    drawerLayout: model.drawerLayout,
    // The actual API calls this graphicType; placed Designer records persist it here.
    customProfile: model.graphicType,
  };
}

function renderedFronts(root: THREE.Group) {
  const doors: THREE.Mesh[] = [];
  const drawers: THREE.Mesh[] = [];
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !node.userData.cabinetFront) return;
    if (node.userData.cabinetDrawerFront) drawers.push(node);
    else doors.push(node);
  });
  return { doors, drawers };
}

function bounds(mesh: THREE.Object3D) {
  return new THREE.Box3().setFromObject(mesh);
}

function heightIn(mesh: THREE.Object3D) {
  const box = bounds(mesh);
  return (box.max.y - box.min.y) * 12;
}

describe("InteractiveRoom3D actual tall pantry drawer catalog matrix", () => {
  it.each(ACTUAL_PANTRY_DRAWER_MODELS)("renders $masterCode from its actual placed source record", (model) => {
    // Keep the API provenance and bounded 30-record selection visible even if a row is edited.
    expect(ACTUAL_API_CONTEXT).toEqual({
      placement: "tall",
      styleId: 540005,
      sourceRecordCount: 51,
      selectedPantryDrawerRecordCount: 30,
    });
    expect(ACTUAL_PANTRY_DRAWER_MODELS).toHaveLength(ACTUAL_API_CONTEXT.selectedPantryDrawerRecordCount);
    expect(model.masterCode).toMatch(/^(?:VT|T)[23]DB/);
    expect(model.numberOfDoors).toBeGreaterThan(0);
    expect(model.numberOfDrawers).toBeGreaterThan(0);
    expect(model.category).toBe("Tall");
    expect(model.placement).toBe("tall");
    expect(model.drawerLayout).toBeNull();
    expect(model.constructionMethod).toBe(SOURCE_CONSTRUCTION_METHOD);
    expect(model.constructionMethod).toBe(AEF_PRINTED_GEOMETRY_MARKER);

    // The API's T2DB2494 description says "Two Door", but its actual source
    // count is one. Rendering must use the source count, never parse the label.
    if (model.masterCode === "T2DB2494") {
      expect(model).toMatchObject({
        id: 15510073,
        description: '24" W × 94" H × 24" D Tall Two Door Cabinet with Two Drawers',
        width: 24,
        height: 94,
        depth: 24,
        numberOfDoors: 1,
        numberOfDrawers: 2,
        drawerLayout: null,
      });
      expect(model.description).toContain("Two Door");
    }

    const placed = placedCabinet(model);
    const sku = existingCabinetSku(placed, ROOM);
    expect(sku.placementType).toBe("tall");
    expect(sku.category).toBe("Tall");
    expect(sku.width).toBe(model.width);
    expect(sku.height).toBe(model.height);
    expect(sku.depth).toBe(model.depth);
    expect(sku.numberOfDoors).toBe(model.numberOfDoors);
    expect(sku.numberOfDrawers).toBe(model.numberOfDrawers);
    expect(sku.drawerLayout).toBeNull();
    expect(sku.graphicType).toBe(model.graphicType);
    expect(sku.constructionMethod).toBe(SOURCE_CONSTRUCTION_METHOD);

    const root = new THREE.Group();
    addCabinet(
      root,
      sku,
      null,
      {},
      ROOM.width,
      ROOM.depth,
      "#8a9ba8",
      "#f8f8f6",
      undefined,
      existingCabinetTransform(placed, ROOM),
    );
    root.updateMatrixWorld(true);
    const { doors, drawers } = renderedFronts(root);

    expect(doors).toHaveLength(model.numberOfDoors);
    expect(drawers).toHaveLength(model.numberOfDrawers);
    expect(doors.length + drawers.length).toBe(model.numberOfDoors + model.numberOfDrawers);

    // Every actual drawer front is a complete lower bank; no drawer may overlap
    // or rise into the upper door envelope.
    for (const drawer of drawers) {
      const drawerBounds = bounds(drawer);
      for (const door of doors) {
        expect(drawerBounds.max.y).toBeLessThan(bounds(door).min.y);
      }
    }

    if (model.numberOfDrawers === 3) {
      const rowsTopToBottom = [...drawers].sort((a, b) => b.position.y - a.position.y);
      const rowHeightsIn = rowsTopToBottom.map(heightIn);
      expect(rowsTopToBottom).toHaveLength(3);
      expect(rowsTopToBottom[0]!.position.y).toBeGreaterThan(rowsTopToBottom[1]!.position.y);
      expect(rowsTopToBottom[1]!.position.y).toBeGreaterThan(rowsTopToBottom[2]!.position.y);
      // Actual 3DB source family: top-to-bottom shallow, shallow, deep.
      expect(rowHeightsIn[0]).toBeCloseTo(rowHeightsIn[1]!, 8);
      expect(rowHeightsIn[0]).toBeLessThan(rowHeightsIn[2]!);
      expect(rowHeightsIn[1]).toBeLessThan(rowHeightsIn[2]!);
    }
  });
});

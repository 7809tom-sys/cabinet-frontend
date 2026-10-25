import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { canSyncThreeDOrderToCart, constrainedThreeDWallHeight, exactFittedFillerInches, filteredThreeDCatalogItems, hybridPlanUnderlayModel, resolvedPlacedCabinetDoorProfile, resolvedPlacedCabinetDoorSampleUrl, resolvedPlacedCabinetFinish, resolvedThreeDWallHeights, shouldShowThreeDCatalog, THREE_D_EMBEDDED_TOOLBAR_CLASS, THREE_D_WORKSPACE_ACTIONS, threeDCabinetHitFromObject, threeDDecorativeEndSides, threeDDrawerZoneHeight, threeDFillerMeasurementNoticeEntries, threeDFittedFillerWidthText, threeDFrontDatumSnapIndicators, threeDHasVerifiedDoorLayout, threeDOrderLineForSelectedCabinet, threeDPointerSelectsCabinet, threeDPreviewFadeAllowed, threeDSelectedCabinetDescription, threeDSelectedCabinetDockClass, threeDSelectionFromPlaced, threeDStructuralFinish, threeDTallPantryDoorsPerRow, threeDTemporaryPreviewCounterText, threeDTouchTapOpensWindow, threeDUpperCabinetWallMinimums, threeDUsesAuthoritativePlanScene, threeDUsesCatalogFrontVisual, threeDWallClearanceText, threeDWallFitGuideText, threeDWallSideForEdge, threeDWallSideForPolygonEdge, updatedThreeDWallHeights } from "./InteractiveRoom3D";
import { addCabinet, addPotFillerFixture, addSinkFixture, addThreeDPeninsulaCountertops, addWallOpening, cornerDrawerFrontLayout, describedOvenSpecification, diagonalCornerFootprintVertices, diagonalCornerFrontWidth, dimensions, doorProfileKind, existingCabinetTransform, existingCabinetSku, freestandingRangeHeightProfile, hasPersistedTwoDScene, isEnclosedWallMicrowaveCabinet, isEqualHeightTwoDrawerBase, lCornerCarcassParts, openingTransform, potFillerWallMountTransform, quoteMaterialDetails, rangeCooktopLayout, rangeHoodFrontGeometry, rangeHoodGeometry, rangeHoodSceneStatus, rangeOvenFrontLayout, resolvedCatalogFinish, resolvedPlacedCabinetFrontVisual, resolvedThreeDCountertopFinish, resolvedThreeDDoorProfile, resolvedThreeDDoorSampleUrl, resolvedThreeDDrawerRows, resolvedThreeDFaceLayout, resolvedThreeDOvenLayout, resolvedThreeDSpecialtyProfile, savedRangeHoodTransform, sceneCabinetColor, shouldRenderCountertopOverSceneItem, shouldRenderPlacedDesign, shouldRenderSavedSceneCabinet, sinkFaucetTransform, sinkFixtureTransform, singleOvenTowerAssembly, threeDApplianceFrontVisualUrl, threeDBlindCornerFrontLayout, threeDCabinetFrontVisualUrl, threeDCameraDistanceLimits, threeDCountertopDepthIn, threeDDoorMaterialFallback, threeDFaceMaterialColor, threeDMaterialStatusText, threeDPhotoRenderDoorReferenceStatus, threeDPeninsulaCountertopGeometry, threeDPlacedWall, threeDPlanSyncText, threeDRoomFacingRotation, threeDSceneInputDiagnostics, threeDSceneRevisionKey, threeDSceneVisibilityContract, threeDShakerFramePose, threeDShakerRailThickness, threeDUsesDoorSampleTexture, threeDUsesExactDoorSampleMaterial, threeDUsesPhysicalShakerRails, threeDVisibleMaterialMode, triangleCornerFootprintVertices, triangleCornerFrontPose, triangleCornerFrontWidth, THREE_D_DRAWER_REVEAL_DEPTH, THREE_D_EXPORT_SIZE, THREE_D_ROOM_CONTEXT_DEFAULT, THREE_D_WALL_DEPTH_WRITE, THREE_D_WALL_OPACITY, type InteractiveRoomScene } from "./InteractiveRoom3D";
import { addFurniture, addIslandZone, furnitureTransform, islandZoneTransform, ponyWallTransform } from "./InteractiveRoom3D";
import { threeDFurnitureHitFromIntersections, threeDFurnitureHitFromObject } from "./InteractiveRoom3D";
import { threeDDesignParitySnapshot, threeDExactPlanGeometryLock } from "./InteractiveRoom3D";
import { resolvedThreeDCountertopFinish, shouldEmitThreeDPresentation, threeDPresentationEmissionKey, threeDPlacedWall } from "./InteractiveRoom3D";
import { threeDCornerBodyDimensions } from "./InteractiveRoom3D";
import { pathTraceCompatibleMaterial } from "./InteractiveRoom3D";
import { threeDFittedFillerToeKickSuppressionUids } from "./InteractiveRoom3D";
import { constrainedThreeDCameraShareView, parseThreeDCameraShareView, serializeThreeDCameraShareView, THREE_D_CAMERA_VIEW_QUERY_PARAM, threeDCameraPresetPosition, threeDCameraRoomFrameKey, threeDScreenHorizontalPlanDelta, threeDShouldRestoreCameraView } from "./InteractiveRoom3D";
import { applyThreeDPlacementIdentity, threeDCabinetHitFromIntersections, threeDCabinetSelectionPriority, threeDCabinetWallDragText, threeDCatalogDragFitText, threeDCatalogDropPlane, threeDCatalogDropTargetFromIntersections, threeDOpeningHitFromIntersections, threeDOpeningHitFromObject, threeDRightPointerGesture, threeDRoomWallSideFromObject, threeDWallDragGhostBox } from "./InteractiveRoom3D";
import { THREE_D_VIEWER_ZOOM_FACTOR, threeDViewerPanStep, threeDViewerZoomDistance } from "./InteractiveRoom3D";
import { threeDSceneCountertopDepthIn } from "./InteractiveRoom3D";
import { threeDPeninsulaCountertopPhysicalDepth } from "./InteractiveRoom3D";
import { diagonalCornerCountertopFootprintVertices } from "./InteractiveRoom3D";
import { lCornerCountertopFootprintVertices } from "./InteractiveRoom3D";
import { addThreeDMeasuredWallMiterCountertops, addThreeDStandardCountertops } from "./InteractiveRoom3D";
import { threeDMiteredRoomWallGeometry, threeDMiteredRoomWallOutlines } from "./InteractiveRoom3D";
import { normalizedThreeDCabinetMoveIncrement, parsedThreeDCabinetMoveIncrement, THREE_D_MAX_MOVE_INCREMENT_IN, THREE_D_MIN_MOVE_INCREMENT_IN } from "./InteractiveRoom3D";
import { addThreeDContinuousToeKicks, threeDContinuousToeKickSegments } from "./InteractiveRoom3D";
import { COUNTERTOP_DEPTH_IN, DEFAULT_ROOM, STD, cornerLegRatioForPlaced, countertopRunFaceNormal, countertopSurfacePlanPolygon, countertopSurfaces, nextAvailableRoomCornerPlacement, peninsulaRunEndpoints, placedCornerGeometryKind, placedFootprint, wallPlacementAt } from "@/lib/design";
import { AEF_PRINTED_GEOMETRY_MARKER } from "@shared/aefFramelessGeometry";
import { ovenOpeningGeometry } from "@/lib/ovenOpening";
import { addThreeDCrownMolding, applyThreeDStructuralFinishMaterials, threeDStructuralSampleTexture } from "./InteractiveRoom3D";
import { addThreeDProductionLightRig, normalizeThreeDPlanarUv, THREE_D_BACKSPLASH_TILE_SIZE_IN, threeDBacksplashSegments, threeDBacksplashSupportSpans, threeDBacksplashTileTextureTransform, threeDBacksplashTransform, threeDCabinetGrainTransform, threeDCountertopUpstandSegments, threeDCountertopSlabTextureTransform, threeDDoorFinishSurfaceProfile, threeDFlooringPatternProfile, threeDPhysicalSurfaceProfile, threeDPlankAtlasProfile, threeDProductMaterialSource, threeDProductSurfaceTextureTransform, threeDRenderQualityProfile, threeDSupportsBacksplash, threeDSurfaceImageCrop, threeDSurfaceTextureTransform } from "./InteractiveRoom3D";
import type { PlacedCabinet, RoomData, WallOpening } from "@/lib/design";

// The production default is intentionally push-to-open/no decorative hardware.
// Tests that measure physical pulls must explicitly select a visible style.
function addCabinetWithBarPulls(...args: Parameters<typeof addCabinet>) {
  const withHardware = [...args] as Parameters<typeof addCabinet>;
  withHardware[12] = { ...withHardware[12], hardwareStyleId: "bar-pull" };
  return addCabinet(...withHardware);
}

describe("standard sink faucet deck placement", () => {
  it("places a deck-mounted faucet behind the rear sink rim rather than inside the bowl", () => {
    const sink = {
      uid: "rear-deck-sink",
      type: "double" as const,
      x: 24,
      y: 2.5,
      width: 33,
      depth: 20,
      sourceWidth: 33,
      sourceDepth: 20,
      wallSide: "top" as const,
      faucet: true,
      faucetRearDeckOffsetIn: 1.25,
    };

    const faucet = sinkFaucetTransform(sink);
    const sinkCenter = sinkFixtureTransform(sink);

    // At the top wall, negative Z is toward the rear deck/wall. The faucet
    // must clear the 10-inch rear half of this 20-inch sink plus its 1¼-inch
    // declared rear-deck offset.
    expect(faucet.z).toBeCloseTo(sinkCenter.z - 11.25 / 12, 6);
    expect(faucet.back.z).toBeCloseTo(-11.25 / 12, 6);
  });
});

describe("customer manual AI render handoff", () => {
  it("sends only verified customer requests into manual review while retaining the administrator path", () => {
    const source = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(source).toContain("prepareManualAiHandoff.useMutation");
    expect(source).toContain("manualAiHandoffMutation.mutateAsync");
    expect(source).toContain("selected CabinetDealz and Pelican product references");
    expect(source).toContain("Send plan to render team");
    expect(source).toContain("if (!isPhotoQualityTest)");
    expect(source).toContain("photoRenderMutation.mutateAsync");
    expect(source).toContain("Google/Gemini image test — locked plan");
  });
});

describe("VDDB48 vanity combo 3D face contract", () => {
  it("keeps the sourced 2-door/6-drawer construction explicit in the renderer", () => {
    const source = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(source).toContain("resolvedVanityComboFaceLayout(sku)");
    expect(source).toContain("vanityComboLongDrawerFront");
    expect(source).toContain("vanityComboSide");
    expect(source).toContain("vanityComboCenterDoor");
    expect(source).toContain("sideDrawerCount");
    expect(source).toContain("centerDoorCount");
  });
});

describe("source-measured Pelican bathroom fixtures", () => {
  it("renders an independent PL-12044 toilet mesh at its official exterior envelope", () => {
    const root = new THREE.Group();
    addFurniture(root, {
      uid: "pelican-toilet",
      defId: "pelican-toilet-pl-12044",
      pelicanCode: "PL-12044",
      pelicanProductId: 12044,
      x: 12,
      y: 24,
      rotation: 0,
    });
    const fixture = root.children.find((child) => child.userData.pelicanBathroomFixture);
    expect(fixture?.userData).toMatchObject({
      pelicanCode: "PL-12044",
      fixtureKind: "toilet",
      sourceEnvelopeIn: { width: 14 + 9 / 16, depth: 26 + 37 / 64, height: 29 + 17 / 32 },
    });
    expect(fixture?.children.some((child) => child.userData.pelicanBathroomFixturePart === "toilet-bowl-exterior")).toBe(true);
    expect(fixture?.children.some((child) => child.userData.pelicanBathroomFixturePart === "toilet-ceramic-base")).toBe(true);
    expect(fixture?.children.some((child) => child.userData.pelicanBathroomFixturePart === "toilet-bowl-water")).toBe(true);
    expect(fixture?.children.some((child) => child.userData.pelicanBathroomFixturePart === "toilet-seat")).toBe(true);
    expect(fixture?.children.some((child) => child.userData.pelicanBathroomFixturePart === "toilet-lid")).toBe(true);
    expect(fixture?.children.some((child) => child.userData.pelicanBathroomFixturePart === "toilet-integrated-rear-housing")).toBe(true);
    expect(fixture?.userData).toMatchObject({
      toiletStyle: "one-piece",
      toiletFlushControl: "dual-button",
      toiletFlushTechnology: "multi-jet-siphonic",
    });
    expect(fixture?.children.some((child) => child.userData.pelicanBathroomFixturePart === "toilet-dual-flush-left-button")).toBe(true);
    expect(fixture?.children.some((child) => child.userData.pelicanBathroomFixturePart === "toilet-dual-flush-right-button")).toBe(true);
    const base = fixture?.children.find((child) => child.userData.pelicanBathroomFixturePart === "toilet-ceramic-base") as THREE.Mesh;
    const bowl = fixture?.children.find((child) => child.userData.pelicanBathroomFixturePart === "toilet-bowl-exterior") as THREE.Mesh;
    const lid = fixture?.children.find((child) => child.userData.pelicanBathroomFixturePart === "toilet-lid") as THREE.Mesh;
    expect(base.userData).toMatchObject({ silhouette: "continuous-skirted-body" });
    expect(bowl.userData).toMatchObject({ continuousWithCeramicBase: true });
    expect(lid.userData).toMatchObject({ lidProfile: "soft-elongated-rectangle" });
    const baseTop = new THREE.Box3().setFromObject(base).max.y;
    const bowlBottom = new THREE.Box3().setFromObject(bowl).min.y;
    expect(bowlBottom).toBeLessThan(baseTop); // one continuous joined silhouette
  });

  it("keeps official smart and two-piece toilet distinctions inside their measured envelopes", () => {
    const root = new THREE.Group();
    addFurniture(root, {
      uid: "pelican-smart-toilet",
      defId: "pelican-toilet-pl-12230",
      pelicanCode: "PL-12230",
      pelicanProductId: 12230,
      x: 12,
      y: 24,
      rotation: 0,
    });
    addFurniture(root, {
      uid: "pelican-two-piece-toilet",
      defId: "pelican-toilet-pl-a249-ada",
      pelicanCode: "PL-A249 ADA",
      pelicanProductId: 1249,
      x: 42,
      y: 24,
      rotation: 0,
    });
    const smart = root.children.find((child) => child.userData.furnitureUid === "pelican-smart-toilet");
    const twoPiece = root.children.find((child) => child.userData.furnitureUid === "pelican-two-piece-toilet");
    expect(smart?.userData).toMatchObject({ toiletStyle: "smart", toiletFlushControl: "touchless" });
    expect(smart?.children.some((child) => child.userData.pelicanBathroomFixturePart === "toilet-smart-rear-housing")).toBe(true);
    expect(smart?.children.some((child) => child.userData.pelicanBathroomFixturePart === "toilet-touchless-top")).toBe(true);
    expect(smart?.children.some((child) => String(child.userData.pelicanBathroomFixturePart).includes("flush-button"))).toBe(false);
    expect(twoPiece?.userData).toMatchObject({ toiletStyle: "two-piece", toiletFlushControl: "single-button" });
    expect(twoPiece?.children.some((child) => child.userData.pelicanBathroomFixturePart === "toilet-tank")).toBe(true);
    expect(twoPiece?.children.some((child) => child.userData.pelicanBathroomFixturePart === "toilet-tank-lid")).toBe(true);
    expect(twoPiece?.children.some((child) => child.userData.pelicanBathroomFixturePart === "toilet-single-flush-button")).toBe(true);
  });

  it("selects a visible bathroom fixture in 3D and exposes the same authoritative rotate/remove actions without changing Floor Plan controls", () => {
    const root = new THREE.Group();
    addFurniture(root, {
      uid: "pelican-toilet-delete-in-3d",
      defId: "pelican-toilet-pl-12044",
      pelicanCode: "PL-12044",
      pelicanProductId: 12044,
      x: 12,
      y: 24,
      rotation: 0,
    }, true);
    const fixture = root.children.find((child) => child.userData.pelicanBathroomFixture) as THREE.Group;
    const visibleBowl = fixture.children.find((child) => child.userData.pelicanBathroomFixturePart === "toilet-bowl-exterior")!;

    expect(threeDFurnitureHitFromObject(visibleBowl)).toEqual({
      uid: "pelican-toilet-delete-in-3d",
      defId: "pelican-toilet-pl-12044",
      pelicanCode: "PL-12044",
      fixtureKind: "toilet",
    });
    expect(threeDFurnitureHitFromIntersections([{ object: visibleBowl }])).toMatchObject({ uid: "pelican-toilet-delete-in-3d" });
    expect(fixture.children.some((child) => child.userData.bathroomFixtureSelectionOutline)).toBe(true);

    const rendererSource = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    const designerSource = readFileSync(new URL("../../pages/DesignTool.tsx", import.meta.url), "utf8");
    expect(rendererSource).toContain("inspectFurnitureAtPoint");
    expect(rendererSource).toContain('data-testid="three-d-furniture-attributes"');
    expect(rendererSource).toContain('data-testid="three-d-rotate-furniture"');
    expect(rendererSource).toContain('data-testid="three-d-remove-furniture"');
    expect(rendererSource).toContain('data-testid="three-d-bathroom-rotate"');
    expect(rendererSource).toContain('data-testid="three-d-bathroom-remove"');
    expect(designerSource).toContain('toast.success("Removed fixture from the 3D plan.")');
  });

  it("keeps a selected Pelican tub independently selectable with the shared rotate/remove controls", () => {
    const root = new THREE.Group();
    addFurniture(root, {
      uid: "pelican-tub-controls-in-3d",
      defId: "pelican-tub-pl-02849-left",
      pelicanCode: "PL-02849L",
      pelicanProductId: 2849,
      x: 0,
      y: 60,
      rotation: 90,
    }, true);
    const fixture = root.children.find((child) => child.userData.pelicanBathroomFixture) as THREE.Group;
    const tubWell = fixture.children.find((child) => child.userData.pelicanBathroomFixturePart === "alcove-tub-well")!;

    expect(threeDFurnitureHitFromObject(tubWell)).toMatchObject({
      uid: "pelican-tub-controls-in-3d",
      pelicanCode: "PL-02849L",
      fixtureKind: "alcove-tub",
    });
    expect(fixture.children.some((child) => child.userData.bathroomFixtureSelectionOutline)).toBe(true);
  });

  it("preserves the selected drain side on a source-measured alcove tub", () => {
    const root = new THREE.Group();
    addFurniture(root, {
      uid: "pelican-tub",
      defId: "pelican-tub-pl-02850-left",
      pelicanCode: "PL-02850L",
      pelicanProductId: 2850,
      x: 0,
      y: 0,
      rotation: 90,
    });
    const fixture = root.children.find((child) => child.userData.pelicanBathroomFixture);
    expect(fixture?.userData).toMatchObject({
      pelicanCode: "PL-02850L",
      fixtureKind: "alcove-tub",
      drain: "left",
      sourceEnvelopeIn: { width: 32 + 1 / 64, depth: 60, height: 21 + 21 / 32 },
    });
    expect(fixture?.children.some((child) => child.userData.pelicanBathroomFixturePart === "alcove-tub-well")).toBe(true);
    expect(fixture?.children.some((child) => child.userData.pelicanBathroomFixturePart === "alcove-tub-apron")).toBe(true);
    expect(fixture?.children.some((child) => child.userData.pelicanBathroomFixturePart === "alcove-tub-drain")).toBe(true);
  });
  it("renders a freestanding tub with an acrylic shell, rim, well, plinth, and source drain identity", () => {
    const root = new THREE.Group();
    addFurniture(root, {
      uid: "pelican-freestanding-tub",
      defId: "pelican-tub-pl-02141-59",
      pelicanCode: 'PL-02141 59"',
      pelicanProductId: 2141,
      x: 0,
      y: 0,
      rotation: 90,
    });
    const fixture = root.children.find((child) => child.userData.pelicanBathroomFixture);
    expect(fixture?.userData).toMatchObject({ fixtureKind: "freestanding-tub", drain: "left" });
    expect(fixture?.children.map((child) => child.userData.pelicanBathroomFixturePart)).toEqual(expect.arrayContaining([
      "freestanding-tub-exterior",
      "freestanding-tub-plinth",
      "freestanding-tub-rim",
      "freestanding-tub-well",
      "freestanding-tub-drain",
    ]));
    const outer = fixture?.children.find((child) => child.userData.pelicanBathroomFixturePart === "freestanding-tub-exterior") as THREE.Mesh;
    expect(outer.geometry).toBeInstanceOf(THREE.LatheGeometry);
    const well = fixture?.children.find((child) => child.userData.pelicanBathroomFixturePart === "freestanding-tub-well") as THREE.Mesh;
    expect(well.position.y).toBeLessThan((fixture?.children.find((child) => child.userData.pelicanBathroomFixturePart === "freestanding-tub-rim") as THREE.Mesh).position.y);
  });

  it("renders a distinct 67-inch Pelican tub with its own measured SKU and 90-degree rotation", () => {
    const root = new THREE.Group();
    addFurniture(root, { uid: "pelican-67", defId: "pelican-tub-pl-02141-67", pelicanCode: 'PL-02141 67"', x: 18, y: 20, rotation: 90 });
    const fixture = root.children.find((child) => child.userData.pelicanBathroomFixture);
    expect(fixture?.userData).toMatchObject({ pelicanCode: 'PL-02141 67"', sourceEnvelopeIn: { width: 29 + 9 / 64, depth: 66 + 21 / 32, height: 27 + 3 / 4 }, drain: "left" });
    expect(fixture?.rotation.y).not.toBe(0);
  });

  it("renders Pelican's sliding shower door as a labelled visual envelope without inventing an enclosure", () => {
    const root = new THREE.Group();
    addFurniture(root, {
      uid: "pelican-shower-door",
      defId: "pelican-shower-door-pl-03a42s",
      pelicanCode: "PL-03A42S",
      x: 18,
      y: 42,
      rotation: 0,
    });
    const fixture = root.children.find((child) => child.userData.pelicanBathroomFixture);
    expect(fixture?.userData).toMatchObject({
      pelicanCode: "PL-03A42S",
      fixtureKind: "shower-door",
      sourceEnvelopeIn: { width: 60, depth: 0.5, height: 76 },
    });
    expect(fixture?.children.filter((child) => child.userData.pelicanBathroomFixturePart === "shower-door-glass-panel")).toHaveLength(2);
    expect(fixture?.children.some((child) => child.userData.pelicanBathroomFixturePart === "shower-door-rail")).toBe(true);
  });

  it("keeps Bathroom starter planning zones out of the 3D presentation", () => {
    const root = new THREE.Group();
    addFurniture(root, { uid: "bath-zone", defId: "bathroom-zone-vanity-60", x: 0, y: 0, rotation: 0 });
    expect(root.children).toHaveLength(0);
  });
});

describe("embedded 3D workspace viewport", () => {
  it("keeps kitchen details open but starts selected MasterTrac boards compact on tablets with a Details action", () => {
    const source = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(source).toContain("selectedCabinetInspectorExpanded");
    expect(source).toContain('data-testid="three-d-cabinet-attributes-compact"');
    expect(source).toContain('data-testid="three-d-expand-cabinet-attributes"');
    expect(source).toContain('data-testid="three-d-collapse-cabinet-attributes"');
    expect(source).toContain("const [selectedCabinetInspectorExpanded, setSelectedCabinetInspectorExpanded] = useState(true);");
    expect(source).toContain('setSelectedCabinetInspectorExpanded(!(tabletOverlay && Boolean(masterTracProduct(selectedCabinet?.masterCode ?? ""))));');
    expect(source).toContain('onClick={() => setSelectedCabinetInspectorExpanded(true)}');
  });
});

const baseScene: InteractiveRoomScene = {
  roomShape: { id: "l_shape", name: "L-Shape", defaultDimensions: { width: 156, depth: 144, ceilingHeight: 96 }, geometryTemplate: { vertices: [] } },
  layout: { id: "kitchen_l_standard", name: "Standard L Kitchen" },
  suggestions: [],
  materials: { cabinet: { publicName: null, name: "Sample", color: null, finish: null, doorStyle: null, doorPanelType: null }, defaults: { floor: "#b89778", countertop: "#e9e7e2", backsplash: "#d9d5cc", wall: "#efece6" } },
};

describe("shared mitered room walls", () => {
  it("builds sharp 45° and 135° corner solids from the same wall outline", () => {
    const outlines = threeDMiteredRoomWallOutlines([
      { id: "straight", start: new THREE.Vector2(0, 0), end: new THREE.Vector2(8, 0) },
      { id: "wall-45", start: new THREE.Vector2(8, 0), end: new THREE.Vector2(12, -4) },
      { id: "wall-135", start: new THREE.Vector2(12, -4), end: new THREE.Vector2(8, -8) },
    ], false);

    expect(outlines).toHaveLength(3);
    expect(outlines[0]!.miteredEnd).toBe(true);
    expect(outlines[1]!.miteredStart).toBe(true);
    expect(outlines[1]!.miteredEnd).toBe(true);
    expect(outlines[2]!.miteredStart).toBe(true);
    for (const [first, second] of [
      [outlines[0]!.corners[1], outlines[1]!.corners[0]],
      [outlines[0]!.corners[2], outlines[1]!.corners[3]],
      [outlines[1]!.corners[1], outlines[2]!.corners[0]],
      [outlines[1]!.corners[2], outlines[2]!.corners[3]],
    ]) {
      expect(first!.x).toBeCloseTo(second!.x, 8);
      expect(first!.y).toBeCloseTo(second!.y, 8);
    }
    // The authored segment is the usable room face. A cabinet whose back is
    // seated at this line can never be hidden inside a symmetric wall body.
    expect(outlines[0]!.corners[0]!.x).toBeCloseTo(0, 8);
    expect(outlines[0]!.corners[0]!.y).toBeCloseTo(0, 8);
    expect(outlines[0]!.corners[1]!.x).toBeCloseTo(8, 8);
    expect(outlines[0]!.corners[1]!.y).toBeCloseTo(0, 8);
    expect(outlines[1]!.corners[1]!.x).toBeCloseTo(12, 8);
    expect(outlines[1]!.corners[1]!.y).toBeCloseTo(4, 8);

    const geometry = threeDMiteredRoomWallGeometry(outlines[1]!.corners, 8);
    geometry.computeBoundingBox();
    expect(geometry.getAttribute("position").count).toBe(8);
    expect(geometry.boundingBox?.max.y).toBeCloseTo(8);
    expect(geometry.boundingBox?.min.y).toBeCloseTo(0);
  });

  it("keeps the unconnected ends of an open wall run square", () => {
    const outlines = threeDMiteredRoomWallOutlines([
      { id: "first", start: new THREE.Vector2(0, 0), end: new THREE.Vector2(6, 0) },
      { id: "second", start: new THREE.Vector2(6, 0), end: new THREE.Vector2(9, -3) },
    ], false);

    expect(outlines[0]!.miteredStart).toBe(false);
    expect(outlines[1]!.miteredEnd).toBe(false);
    expect(outlines[0]!.corners[0].x).toBeCloseTo(outlines[0]!.corners[3].x);
    expect(outlines[1]!.corners[1]).toEqual({ x: 9, y: 3 });
  });
});

describe("continuous base toe-kick boards", () => {
  const base = (uid: string, offset: number, width: number, masterCode = "B36"): PlacedCabinet => ({
    uid,
    cabinetId: 1,
    masterCode,
    description: masterCode.startsWith("F") ? "Base Filler" : "Base Cabinet",
    placement: "base",
    x: offset,
    y: 0,
    width,
    depth: 24,
    height: 34.5,
    mountBottom: 0,
    rotation: 0,
    wallId: "top",
    wallOffset: offset,
  });

  it("merges a connected base-and-filler run into one recessed board without crossing a true gap", () => {
    const cabinets = [base("b36", 0, 36), base("f342", 36, 3, "F342"), base("b24", 45, 24, "B24")];
    const segments = threeDContinuousToeKickSegments(cabinets, DEFAULT_ROOM);

    expect(segments).toEqual([
      expect.objectContaining({
        wallId: "top",
        start: 0,
        end: 39,
        depth: 24,
        memberUids: ["b36", "f342"],
        includesInstalledFiller: true,
      }),
      expect.objectContaining({ start: 45, end: 69, memberUids: ["b24"], includesInstalledFiller: false }),
    ]);

    const root = new THREE.Group();
    addThreeDContinuousToeKicks(root, segments, DEFAULT_ROOM, undefined, "#7e8d72");
    const rails = root.children.filter((node) => node.userData.continuousToeKick === true);
    expect(rails).toHaveLength(2);
    expect(rails[0]?.userData).toMatchObject({ runLengthIn: 39, toeKickHeightIn: 4.5, toeKickRecessIn: 3, includesInstalledFiller: true });
  });

  it("starts an installed base filler at the standard visible face bottom above the shared toe kick", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      placementUid: "raised-f342",
      distributorSkuId: 1,
      cabinetId: 1,
      masterCode: "F342",
      description: "3 inch Base Filler",
      placementType: "base",
      width: 3,
      height: 34.5,
      depth: 24,
      mountBottom: 0,
      fillerPieceGroupId: "gap",
      fillerTotalWidth: 3,
      fillerPlacementMode: "left",
      numberOfDoors: 0,
      numberOfDrawers: 0,
    }, null, {}, 144, 120, "#7e8d72", "#f8f8f6");
    const filler = root.children.find((node) => node.userData.placedUid === "raised-f342");
    expect(filler?.userData).toMatchObject({ baseFillerFace: true, fillerFaceBottomIn: 4.5, fillerFaceHeightIn: 30 });
  });
});

describe("3D fallback appliance run seams", () => {
  it("shows a 24-inch base/tall or 12-inch wall datum only for a complete supported 45-degree front-miter pair", () => {
    const supported = (placement: "base" | "wall" | "tall", prefix: string): PlacedCabinet[] => {
      const owner = {
        uid: `${prefix}-owner`, cabinetId: 1, masterCode: `${prefix}-owner`, description: "Supporting cabinet", placement,
        x: 0, y: 0, width: 24, depth: placement === "wall" ? 12 : 24, height: placement === "wall" ? 30 : 34.5, rotation: 0,
      } as PlacedCabinet;
      const neighbor = { ...owner, uid: `${prefix}-neighbor`, masterCode: `${prefix}-neighbor`, x: 30 };
      const filler = (piece: "owner" | "neighbor", ownerUid: string, neighborUid: string): PlacedCabinet => ({
        ...owner,
        uid: `${prefix}-filler-${piece}`,
        masterCode: "BF3",
        fillerPieceGroupId: `${prefix}-miter`,
        fillerTransitionKind: "front-miter-pair",
        fillerTransitionPiece: piece,
        fillerForCabinetUid: ownerUid,
        fillerTransitionNeighborUid: neighborUid,
        fillerIndependentCabinetSupport: true,
        fillerTransitionPlanFootprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.25, y: 0.75 }],
      });
      return [owner, neighbor, filler("owner", owner.uid, neighbor.uid), filler("neighbor", neighbor.uid, owner.uid)];
    };

    expect(threeDFrontDatumSnapIndicators(supported("base", "base"))).toMatchObject([{ datumIn: 24, placement: "base" }]);
    expect(threeDFrontDatumSnapIndicators(supported("tall", "tall"))).toMatchObject([{ datumIn: 24, placement: "tall" }]);
    expect(threeDFrontDatumSnapIndicators(supported("wall", "wall"))).toMatchObject([{ datumIn: 12, placement: "wall" }]);
    expect(threeDFrontDatumSnapIndicators(supported("base", "partial").slice(0, 3))).toEqual([]);

    const source = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(source).toContain('data-testid="three-d-45-degree-front-datum-snap"');
    expect(source).toContain("45° front datum snapped");
  });

  it("keeps a DB18 flush to a 30-inch range instead of using the countertop overhang as run spacing", () => {
    const root = new THREE.Group();
    const cursor: Record<string, number> = {};
    addCabinet(root, {
      distributorSkuId: 0,
      masterCode: "RANGE-30",
      description: '30" Freestanding Range',
      placementType: "appliance",
      width: 30,
      height: 36,
      depth: 25,
    }, "back", cursor, 144, 120, "#b99a6b", "#f8f8f6");
    addCabinet(root, {
      distributorSkuId: 18,
      masterCode: "DB18",
      description: '18" Three Drawer Base',
      placementType: "base",
      width: 18,
      height: 34.5,
      depth: 24,
    }, "back", cursor, 144, 120, "#b99a6b", "#f8f8f6");

    const [range, db18] = root.children;
    expect(range?.userData.catalogApplianceEnvelope).toMatchObject({ widthIn: 30 });
    // Center-to-center = 30/2 + 18/2: a true zero-gap cabinet seam.
    expect((db18!.position.x - range!.position.x) * 12).toBeCloseTo(24, 6);
    expect(cursor.back).toBe(51);

    let rangeChassis: THREE.Mesh | null = null;
    range?.traverse((item) => {
      if (item.userData.freestandingRangeChassis && item instanceof THREE.Mesh) rangeChassis = item;
    });
    expect(rangeChassis).not.toBeNull();
    expect(((rangeChassis!.geometry as THREE.BoxGeometry).parameters.width as number) * 12).toBeCloseTo(30, 6);
  });

  it("renders WEOS0930 as the verified 9-by-30-by-12 open wall-end shelf with two bowed fixed shelves", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: 930,
      cabinetId: 930,
      masterCode: "WEOS0930",
      description: "Versa Shaker Wall End Shelf",
      placementType: "wall",
      width: 9,
      height: 30,
      depth: 12,
      numberOfDoors: 0,
      numberOfDrawers: 0,
      fixedShelfCount: 2,
    }, "back", {}, 144, 120, "#b99a6b", "#f8f8f6", undefined, { x: 18, z: 6, rotation: 0, bottom: 54 });

    const shelfRoot = root.children[0]!;
    const shellParts: THREE.Mesh[] = [];
    const fixedShelves: THREE.Mesh[] = [];
    const cabinetFronts: THREE.Object3D[] = [];
    shelfRoot.traverse((node) => {
      if (node instanceof THREE.Mesh && node.userData.wallOpenShelfPart) shellParts.push(node);
      if (node instanceof THREE.Mesh && node.userData.wallOpenShelfFixedShelf) fixedShelves.push(node);
      if (node.userData.cabinetFront) cabinetFronts.push(node);
    });
    expect(shelfRoot.userData.floorStandingCabinet).toBeUndefined();
    expect(shellParts.map((part) => part.userData.wallOpenShelfPart).sort()).toEqual([
      "back", "bottom", "fixed-shelf", "fixed-shelf", "left-side", "right-side", "top",
    ]);
    expect(fixedShelves).toHaveLength(2);
    expect(fixedShelves.every((shelf) => shelf.geometry.type === "ExtrudeGeometry" && shelf.userData.bowedFrontEdge === true)).toBe(true);
    expect(fixedShelves.map((shelf) => shelf.userData.wallOpenShelfFixedShelf)).toEqual([1, 2]);
    expect(cabinetFronts).toHaveLength(0);
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(shelfRoot);
    expect((bounds.max.x - bounds.min.x) * 12).toBeCloseTo(9, 6);
    expect((bounds.max.y - bounds.min.y) * 12).toBeCloseTo(30, 6);
    expect((bounds.max.z - bounds.min.z) * 12).toBeCloseTo(12, 6);
  });

  it("renders the KitchenCrest OE630 generic form as a square 6-by-30-by-12 open-end shelf with two shelves", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: 630,
      cabinetId: 630,
      masterCode: "OE630",
      description: '6" x 30" Open End Shelf Wall Cabinet',
      placementType: "wall",
      width: 6,
      height: 30,
      depth: 12,
      numberOfDoors: 0,
      numberOfDrawers: 0,
      // The live master had a stale count; the supplied generic line art is the
      // deliberate visual authority for this exact, description-confirmed form.
      fixedShelfCount: 3,
    }, "back", {}, 144, 120, "#b99a6b", "#f8f8f6", undefined, { x: 18, z: 6, rotation: 0, bottom: 54 });

    const shelfRoot = root.children[0]!;
    const fixedShelves: THREE.Mesh[] = [];
    shelfRoot.traverse((node) => {
      if (node instanceof THREE.Mesh && node.userData.wallOpenShelfFixedShelf) fixedShelves.push(node);
    });
    expect(fixedShelves).toHaveLength(2);
    expect(fixedShelves.every((shelf) => shelf.geometry.type === "BoxGeometry" && shelf.userData.bowedFrontEdge === false)).toBe(true);
    expect(fixedShelves.every((shelf) => shelf.userData.kitchenCrestGenericOpenEndShelf === true)).toBe(true);
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(shelfRoot);
    expect((bounds.max.x - bounds.min.x) * 12).toBeCloseTo(6, 6);
    expect((bounds.max.y - bounds.min.y) * 12).toBeCloseTo(30, 6);
    expect((bounds.max.z - bounds.min.z) * 12).toBeCloseTo(12, 6);
  });

  it("renders a 45-degree base filler as a narrow cabinet-face board above the toe kick", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: 3,
      cabinetId: 3,
      masterCode: "BF3",
      description: '3" Base Filler — A front filler cut to 1" with 22.5° miter (forms 45° turn)',
      placementType: "base",
      width: 1,
      height: 34.5,
      depth: 24,
      fillerPieceGroupId: "front-miter-pair-test",
      fillerPlacementMode: "left",
      fillerTotalWidth: 22,
      fillerTransitionKind: "front-miter-pair",
      fillerTransitionPiece: "owner",
      fillerTransitionFootprint: [
        { x: 0, y: 24 }, { x: 1, y: 24 }, { x: 0.25, y: 23.25 }, { x: 0, y: 23.25 },
      ],
    }, null, {}, 120, 96, "#b99a6b", "#f8f8f6", undefined, { x: 0, z: 0, rotation: 0 });

    root.updateMatrixWorld(true);
    const filler = root.children[0]!;
    let fillerBody: THREE.Mesh | null = null;
    let toeKickCount = 0;
    filler.traverse((node) => {
      if (node instanceof THREE.Mesh && node.userData.frontOnlyMiterPair) fillerBody = node;
      if (node.userData.baseToeKick) toeKickCount += 1;
    });
    expect(filler.userData.floorStandingCabinet).toBeUndefined();
    expect(filler.userData).toMatchObject({ baseFillerFace: true, fillerFaceBottomIn: 4.5, fillerFaceHeightIn: 30 });
    expect(toeKickCount).toBe(0);
    expect(fillerBody).not.toBeNull();
    const bounds = new THREE.Box3().setFromObject(fillerBody!);
    expect(bounds.min.y * 12).toBeCloseTo(4.5, 6);
    expect(bounds.max.y * 12).toBeCloseTo(34.5, 6);
    expect(fillerBody!.userData.visibleDepthIn).toBe(0.75);
    // The persisted quadrilateral already sits at the cabinet front (23¼–24").
    // A second generic front offset would place it 11⅝" into the room as the
    // detached vertical leg reported in the 3D view.
    expect(bounds.min.z * 12).toBeCloseTo(23.25, 6);
    expect(bounds.max.z * 12).toBeCloseTo(24, 6);
  });

  it("renders a straight installed base filler at the adjoining cabinet face height without a toe-kick block", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: 342,
      cabinetId: 342,
      masterCode: "F342",
      description: '3" Base Filler — cut to ⅝"',
      placementType: "base",
      width: 0.625,
      height: 34.5,
      depth: 24,
      fillerPieceGroupId: "straight-base-filler-test",
      fillerPlacementMode: "left",
      fillerTotalWidth: 0.625,
    }, null, {}, 120, 96, "#b99a6b", "#f8f8f6", undefined, { x: 0, z: 0, rotation: 0 });

    root.updateMatrixWorld(true);
    const filler = root.children[0]!;
    const toeKicks: THREE.Object3D[] = [];
    let fillerBody: THREE.Mesh | null = null;
    filler.traverse((node) => {
      if (node.userData.baseToeKick) toeKicks.push(node);
      if (node instanceof THREE.Mesh && node.userData.baseFillerFace) fillerBody = node;
    });
    expect(filler.userData.floorStandingCabinet).toBeUndefined();
    expect(filler.userData).toMatchObject({ baseFillerFace: true, fillerFaceBottomIn: 4.5, fillerFaceHeightIn: 30 });
    expect(toeKicks).toHaveLength(0);
    expect(fillerBody).not.toBeNull();
    const bounds = new THREE.Box3().setFromObject(fillerBody!);
    expect(bounds.min.y * 12).toBeCloseTo(4.5, 6);
    expect(bounds.max.y * 12).toBeCloseTo(34.5, 6);
  });

  it("renders a refrigerator-owned filler from the floor to the refrigerator top without a toe kick", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      placementUid: "fridge-side-f342",
      distributorSkuId: 342,
      cabinetId: 342,
      masterCode: "F342",
      description: '3" Refrigerator-side filler',
      placementType: "base",
      width: 3,
      height: 70,
      depth: 30,
      mountBottom: 0,
      fillerMatchesFullOwnerEnvelope: true,
      fillerPieceGroupId: "fridge-side-filler",
      fillerPlacementMode: "right",
      fillerTotalWidth: 3,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    }, null, {}, 120, 96, "#b99a6b", "#f8f8f6", undefined, { x: 0, z: 0, rotation: 0 });

    root.updateMatrixWorld(true);
    const filler = root.children[0]!;
    const toeKicks: THREE.Object3D[] = [];
    let fillerBody: THREE.Mesh | null = null;
    filler.traverse((node) => {
      if (node.userData.baseToeKick) toeKicks.push(node);
      if (node instanceof THREE.Mesh && node.userData.installedFillerFrontAligned) fillerBody = node;
    });

    expect(filler.userData).toMatchObject({ fullOwnerEnvelopeFiller: true });
    expect(filler.userData.floorStandingCabinet).toBeUndefined();
    expect(toeKicks).toHaveLength(0);
    expect(fillerBody).not.toBeNull();
    const bounds = new THREE.Box3().setFromObject(fillerBody!);
    expect(bounds.min.y * 12).toBeCloseTo(0, 5);
    expect(bounds.max.y * 12).toBeCloseTo(70, 5);
  });

  it("keeps each front-miter filler at its assigned cabinet face on every wall rotation", () => {
    const localFootprint = [
      { x: -1, z: 0 }, { x: 0, z: 0 }, { x: -0.75, z: -0.75 }, { x: -1, z: -0.75 },
    ];

    for (const rotation of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      const transform = { x: 50, z: 50, rotation };
      const cosine = Math.cos(rotation);
      const sine = Math.sin(rotation);
      const footprint = localFootprint.map(({ x, z }) => ({
        x: transform.x + cosine * x - sine * z,
        y: transform.z + sine * x + cosine * z,
      }));
      const root = new THREE.Group();
      addCabinet(root, {
        distributorSkuId: 3,
        cabinetId: 3,
        masterCode: "BF3",
        description: '3" Base Filler — front 22.5° miter (forms 45° turn)',
        placementType: "base",
        width: 1,
        height: 34.5,
        depth: 24,
        fillerPieceGroupId: `all-rotation-miter-${rotation}`,
        fillerPlacementMode: "left",
        fillerTransitionKind: "front-miter-pair",
        fillerTransitionPiece: "owner",
        fillerTransitionFootprint: footprint,
      }, null, {}, 120, 96, "#b99a6b", "#f8f8f6", undefined, transform);

      root.updateMatrixWorld(true);
      let fillerBody: THREE.Mesh | null = null;
      root.traverse((node) => {
        if (node instanceof THREE.Mesh && node.userData.frontOnlyMiterPair) fillerBody = node;
      });
      expect(fillerBody).not.toBeNull();
      const bounds = new THREE.Box3().setFromObject(fillerBody!);
      expect(bounds.min.x * 12).toBeCloseTo(Math.min(...footprint.map((point) => point.x)), 6);
      expect(bounds.max.x * 12).toBeCloseTo(Math.max(...footprint.map((point) => point.x)), 6);
      expect(bounds.min.z * 12).toBeCloseTo(Math.min(...footprint.map((point) => point.y)), 6);
      expect(bounds.max.z * 12).toBeCloseTo(Math.max(...footprint.map((point) => point.y)), 6);
    }
  });

  it("keeps a rotated island waterfall on the physical side end rather than across the cabinet front", () => {
    const root = new THREE.Group();
    const island = {
      x: 48,
      y: 48,
      width: 60,
      depth: 30,
      rotation: 90,
      waterfallEnd: "right" as const,
    };
    const member = {
      uid: "rotated-island-base",
      cabinetId: 24,
      masterCode: "B24",
      description: "24 inch Base Cabinet",
      placement: "base" as const,
      x: 48,
      y: 54,
      width: 60,
      depth: 24,
      height: 34.5,
      rotation: 90,
      islandFace: "front" as const,
      islandOffset: 0,
    } as PlacedCabinet;
    addIslandZone(root, island as never, [member], "#ffffff");
    root.updateMatrixWorld(true);

    let countertop: THREE.Object3D | null = null;
    let waterfall: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.islandCountertop) countertop = node;
      if (node.userData.islandWaterfall) waterfall = node;
    });
    expect(countertop).not.toBeNull();
    expect(waterfall).not.toBeNull();
    const slabCenter = countertop!.getWorldPosition(new THREE.Vector3());
    const sidePanel = waterfall!.getWorldPosition(new THREE.Vector3());
    // A 90° clockwise plan rotation maps the local island right end to +Z in
    // Three.js. A front-mounted panel would instead displace along X.
    expect(sidePanel.z - slabCenter.z).toBeGreaterThan(2);
    expect(Math.abs(sidePanel.x - slabCenter.x)).toBeLessThan(0.01);
    expect(waterfall!.userData.waterfallEnd).toBe("right");
  });

  it("keeps an explicit 45-degree continuous-wall range opening and rendered chassis flush to a 3DB18", () => {
    const room = {
      width: 180,
      depth: 180,
      ceilingHeight: 96,
      vertices: [
        { id: "a", x: 12, y: 12 },
        { id: "b", x: 132, y: 132 },
      ],
      customWalls: [{ id: "wall-45", startVertexId: "a", endVertexId: "b" }],
    } as RoomData;
    const makePlaced = (uid: string, masterCode: string, placement: PlacedCabinet["placement"], width: number, depth: number, wallOffset: number): PlacedCabinet => ({
      uid,
      cabinetId: 0,
      masterCode,
      description: masterCode === "RANGE-30" ? '30" Freestanding Range' : '18" Three Drawer Base Cabinet',
      placement,
      width,
      depth,
      height: placement === "appliance" ? 36 : 34.5,
      ...wallPlacementAt(wallOffset, width, depth, "wall-45", room),
      wallId: "wall-45",
      wallOffset,
    });
    // The opening is exactly the catalog range width: 30" to 60" is the
    // range, with an ordinary base ending at its left edge and the 3DB18
    // beginning at its exposed right edge.
    const b18 = makePlaced("b18", "B18", "base", 18, 24, 12);
    const range = makePlaced("range", "RANGE-30", "appliance", 30, 25, 30);
    const db18 = makePlaced("db18", "3-DB18", "base", 18, 24, 60);
    const rangeTransform = existingCabinetTransform(range, room);
    const b18Transform = existingCabinetTransform(b18, room);
    const db18Transform = existingCabinetTransform(db18, room);
    const tangent = new THREE.Vector3(Math.SQRT1_2, 0, Math.SQRT1_2);
    const along = (transform: { x: number; z: number }) => transform.x * tangent.x + transform.z * tangent.z;
    // existingCabinetTransform is returned in Plan inches; the centers differ
    // by 30/2 + 18/2 along the measured wall tangent.
    expect(along(rangeTransform) - along(b18Transform)).toBeCloseTo(24, 6);
    expect(along(db18Transform) - along(rangeTransform)).toBeCloseTo(24, 6);

    const root = new THREE.Group();
    const cursor: Record<string, number> = {};
    for (const cabinet of [b18, range, db18]) {
      addCabinet(
        root,
        existingCabinetSku(cabinet, room),
        null,
        cursor,
        room.width,
        room.depth,
        "#b99a6b",
        "#f8f8f6",
        undefined,
        existingCabinetTransform(cabinet, room),
      );
    }
    root.updateMatrixWorld(true);
    const b18Root = root.children.find((node) => node.userData.placedUid === "b18")!;
    const rangeRoot = root.children.find((node) => node.userData.placedUid === "range")!;
    const db18Root = root.children.find((node) => node.userData.placedUid === "db18")!;
    let chassis: THREE.Mesh | null = null;
    let leftBody: THREE.Mesh | null = null;
    let drawerBody: THREE.Mesh | null = null;
    rangeRoot.traverse((node) => {
      if (node instanceof THREE.Mesh && node.userData.freestandingRangeChassis) chassis = node;
    });
    b18Root.traverse((node) => {
      const parameters = node instanceof THREE.Mesh ? (node.geometry as THREE.BoxGeometry).parameters : null;
      if (node instanceof THREE.Mesh && node.userData.selectedStyleSideSkin && Math.abs(Number(parameters?.width) * 12 - 18) < 0.001 && Math.abs(Number(parameters?.depth) * 12 - 24) < 0.001) leftBody = node;
    });
    db18Root.traverse((node) => {
      const parameters = node instanceof THREE.Mesh ? (node.geometry as THREE.BoxGeometry).parameters : null;
      if (node instanceof THREE.Mesh && node.userData.selectedStyleSideSkin && Math.abs(Number(parameters?.width) * 12 - 18) < 0.001 && Math.abs(Number(parameters?.depth) * 12 - 24) < 0.001) drawerBody = node;
    });
    expect(chassis).not.toBeNull();
    expect(leftBody).not.toBeNull();
    expect(drawerBody).not.toBeNull();
    const localAxis = new THREE.Vector3(1, 0, 0).transformDirection(rangeRoot.matrixWorld);
    const chassisWidth = Number((chassis!.geometry as THREE.BoxGeometry).parameters.width);
    const leftWidth = Number((leftBody!.geometry as THREE.BoxGeometry).parameters.width);
    const drawerWidth = Number((drawerBody!.geometry as THREE.BoxGeometry).parameters.width);
    const rangeLeft = chassis!.localToWorld(new THREE.Vector3(-chassisWidth / 2, 0, 0)).dot(localAxis);
    const rangeRight = chassis!.localToWorld(new THREE.Vector3(chassisWidth / 2, 0, 0)).dot(localAxis);
    const leftCabinetRight = leftBody!.localToWorld(new THREE.Vector3(leftWidth / 2, 0, 0)).dot(localAxis);
    const drawerLeft = drawerBody!.localToWorld(new THREE.Vector3(-drawerWidth / 2, 0, 0)).dot(localAxis);
    // This is the acceptance measurement from the actual Three.js mesh plane,
    // not the 2D collision or opening model: no rendered floor channel is
    // allowed between a range chassis and an adjoining cabinet.
    const rangeWidthIn = (rangeRight - rangeLeft) * 12;
    const leftGapIn = (rangeLeft - leftCabinetRight) * 12;
    const rightGapIn = (drawerLeft - rangeRight) * 12;
    expect(rangeWidthIn).toBeCloseTo(30, 6);
    expect(leftGapIn).toBeGreaterThanOrEqual(-1 / 16);
    expect(leftGapIn).toBeLessThanOrEqual(1 / 16);
    expect(rightGapIn).toBeGreaterThanOrEqual(-1 / 16);
    expect(rightGapIn).toBeLessThanOrEqual(1 / 16);

    const counterFor = (uid: string) => root.children.find((node) => node instanceof THREE.Mesh && node.userData.placedUid === uid && Number(node.userData.countertopDepthIn) > 0) as THREE.Mesh;
    const leftCounter = counterFor("b18");
    const rightCounter = counterFor("db18");
    expect(leftCounter).toBeTruthy();
    expect(rightCounter).toBeTruthy();
    const leftCounterWidth = Number((leftCounter.geometry as THREE.BoxGeometry).parameters.width);
    const rightCounterWidth = Number((rightCounter.geometry as THREE.BoxGeometry).parameters.width);
    const leftCounterRight = leftCounter.localToWorld(new THREE.Vector3(leftCounterWidth / 2, 0, 0)).dot(localAxis);
    const rightCounterLeft = rightCounter.localToWorld(new THREE.Vector3(-rightCounterWidth / 2, 0, 0)).dot(localAxis);
    expect((rangeLeft - leftCounterRight) * 12).toBeLessThanOrEqual(1 / 16);
    expect((rightCounterLeft - rangeRight) * 12).toBeLessThanOrEqual(1 / 16);
  });

	  it("keeps a non-square right-wall base and its countertop in the same local width/depth frame", () => {
	    const root = new THREE.Group();
	    addCabinet(root, {
	      distributorSkuId: 36,
	      cabinetId: 36,
	      placementUid: "right-wall-b36",
	      masterCode: "B36",
	      description: "36 inch Base Cabinet",
	      placementType: "base",
	      width: 36,
	      height: 34.5,
	      depth: 24,
	    }, "right", {}, 144, 120, "#b99a6b", "#f8f8f6");

	    const cabinet = root.children.find((node) => node.userData.placedUid === "right-wall-b36" && node instanceof THREE.Group)!;
	    const counter = root.children.find((node) => node.userData.placedUid === "right-wall-b36" && Number(node.userData.countertopDepthIn) > 0) as THREE.Mesh;
	    expect(cabinet).toBeTruthy();
	    expect(counter).toBeTruthy();
	    let body: THREE.Mesh | null = null;
	    cabinet.traverse((node) => {
	      const parameters = node instanceof THREE.Mesh ? (node.geometry as THREE.BoxGeometry).parameters : null;
	      if (node instanceof THREE.Mesh && node.userData.selectedStyleSideSkin
	        && Math.abs(Number(parameters?.width) * 12 - 36) < 0.001
	        && Math.abs(Number(parameters?.depth) * 12 - 24) < 0.001) body = node;
	    });
	    expect(body).not.toBeNull();
	    cabinet.updateMatrixWorld(true);
	    counter.updateMatrixWorld(true);
	    const cabinetBounds = new THREE.Box3().setFromObject(body!);
	    const counterBounds = new THREE.Box3().setFromObject(counter);
	    // On a right wall, the 36-inch face runs along world Z while the 24-inch
	    // cabinet depth and its 25½-inch top run along world X.
	    expect((cabinetBounds.max.z - cabinetBounds.min.z) * 12).toBeCloseTo(36, 5);
	    expect((counterBounds.max.z - counterBounds.min.z) * 12).toBeCloseTo(36, 5);
	    expect((counterBounds.max.x - counterBounds.min.x) * 12).toBeCloseTo(25.5, 5);
	    expect(counterBounds.min.y * 12).toBeCloseTo(cabinetBounds.max.y * 12, 5);
	  });
});

describe("side-aware peninsula countertop meshes", () => {
	  it("renders one shared standard slab per touching cabinet run and preserves appliance breaks", () => {
	    const root = new THREE.Group();
	    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
	    const placed = [
	      { uid: "shared-before-a", cabinetId: 1, masterCode: "B24", placement: "base", width: 24, depth: 24, height: 34.5, x: 0, y: 0, rotation: 0 } as PlacedCabinet,
	      { uid: "shared-before-b", cabinetId: 2, masterCode: "B30", placement: "base", width: 30, depth: 24, height: 34.5, x: 24, y: 0, rotation: 0 } as PlacedCabinet,
	      { uid: "shared-range", cabinetId: 3, masterCode: "RANGE-30", placement: "appliance", width: 30, depth: 25, height: 36, x: 54, y: 0, rotation: 0 } as PlacedCabinet,
	      { uid: "shared-after", cabinetId: 4, masterCode: "B24", placement: "base", width: 24, depth: 24, height: 34.5, x: 84, y: 0, rotation: 0 } as PlacedCabinet,
	    ];
	    addThreeDStandardCountertops(root, room, placed, "#e9e7e2");
	    const slabs = root.children.filter((item) => item.userData.standardRunCountertop);
	    expect(slabs).toHaveLength(2);
	    expect(slabs.map((item) => item.userData.cabinetRunId)).toEqual([
	      "wall:top:0-54",
	      "wall:top:84-108",
	    ]);
	    expect(slabs.every((item) => item.userData.bridgesCabinetVoids === false)).toBe(true);
	  });

	  it("keeps both side-wall slabs 25½ inches deep as adjoining bases lengthen each run", () => {
	    const room: RoomData = { width: 192, depth: 144, ceilingHeight: 96 };
	    const base = (uid: string, x: number, y: number, width: number, wallId: "left" | "right" | "top") => ({
	      uid, cabinetId: 1, masterCode: `B${width}`, description: "Base", placement: "base",
	      x, y, width, depth: 24, height: 34.5, rotation: wallId === "top" ? 0 : 90, wallId,
	    } as PlacedCabinet);
	    const placed = [base("front", 36, 0, 24, "top")];
	    for (let count = 1; count <= 3; count += 1) {
	      placed.push(base(`left-${count}`, 0, 36 + (count - 1) * 30, 30, "left"));
	      placed.push(base(`right-${count}`, 168, 36 + (count - 1) * 30, 30, "right"));
	      const root = new THREE.Group();
	      addThreeDStandardCountertops(root, room, placed, "#ffffff");
	      root.updateMatrixWorld(true);
	      const slabs = root.children.filter((child) => child.userData.standardRunCountertop) as THREE.Mesh[];
	      for (const [side, minX, maxX] of [["left", 0, 25.5], ["right", 166.5, 192]] as const) {
	        const slab = slabs.find((child) => String(child.userData.cabinetRunId).startsWith(`wall:${side}:`));
	        expect(slab).toBeDefined();
	        const bounds = new THREE.Box3().setFromObject(slab!);
	        expect(bounds.min.x * 12).toBeCloseTo(minX, 5);
	        expect(bounds.max.x * 12).toBeCloseTo(maxX, 5);
	        expect(bounds.min.z * 12).toBeCloseTo(36, 5);
	        expect(bounds.max.z * 12).toBeCloseTo(36 + count * 30, 5);
	      }
	      const front = slabs.find((child) => String(child.userData.cabinetRunId).startsWith("wall:top:"));
	      const frontBounds = new THREE.Box3().setFromObject(front!);
	      expect(frontBounds.min.x * 12).toBeCloseTo(36, 5);
	      expect(frontBounds.max.x * 12).toBeCloseTo(60, 5);
	    }
	  });

	  it("keeps the true-L cardinal LSB36 top in the same shared 3D surface path", () => {
	    const root = new THREE.Group();
	    const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
	    const lsb36 = {
	      uid: "shared-lsb36", cabinetId: 1, masterCode: "LSB36", description: "36 inch Lazy Susan Corner Base",
	      placement: "base", width: 36, depth: 36, height: 34.5, x: 0, y: 0, rotation: 0, cornerType: "lazy-susan",
	    } as PlacedCabinet;
	    addThreeDStandardCountertops(root, room, [lsb36], "#e9e7e2");
	    const [slab] = root.children.filter((item) => item.userData.standardRunCountertop) as THREE.Mesh[];
	    // Six vertices: the true L with both fronts carried out by the overhang.
	    expect(slab?.userData.sourcePolygonVertices).toBe(6);
	    slab?.geometry.computeBoundingBox();
	    expect((slab?.geometry.boundingBox?.max.x ?? 0) - (slab?.geometry.boundingBox?.min.x ?? 0)).toBeCloseTo(36 / 12, 6);
	  });

	  it("seats the shared peninsula slab directly on the 34½-inch cabinet top", () => {
	    const root = new THREE.Group();
	    const room: RoomData = {
	      width: 144,
	      depth: 120,
	      ceilingHeight: 96,
	      peninsulaRuns: [{ id: "counter-contact", parentWall: "top", startOffset: 48, turn: 90, direction: "right", length: 48, height: 34.5, cabinetSide: "left" }],
	    };
	    const spot = wallPlacementAt(0, 24, 24, "counter-contact" as any, room, "left");
	    const base = { uid: "counter-contact-base", cabinetId: 24, masterCode: "B24", description: "24 inch Base", placement: "base", ...spot, width: 24, depth: 24, height: 34.5, wallId: "counter-contact", wallOffset: 0, peninsulaSide: "left" } as PlacedCabinet;

	    addThreeDPeninsulaCountertops(root, room, [base], "#e9e7e2");
	    const slab = root.children.find((item) => item.userData.peninsulaCountertop) as THREE.Mesh;
	    const slabHeight = STD.COUNTERTOP_THICKNESS / 12;
	    expect(slab.position.y - slabHeight / 2).toBeCloseTo(34.5 / 12, 10);
	  });

  it("ends cabinet-supported slabs at an unsupported void and keeps the exposed-end waterfall", () => {
    const root = new THREE.Group();
    const room: RoomData = {
      width: 144,
      depth: 120,
      ceilingHeight: 96,
      peninsulaRuns: [{ id: "peninsula-test", parentWall: "top", startOffset: 24, turn: 90, direction: "right", length: 84, height: 34.5, cabinetSide: "right", countertopSeatingOverhang: 12, countertopWaterfallEnd: true }],
    };
    const placed = [{ uid: "base-start", cabinetId: 1, masterCode: "B-30", placement: "base", x: 0, y: 0, width: 30, depth: 24, height: 34.5, rotation: 90, wallId: "peninsula-test", wallOffset: 0 } as PlacedCabinet,
      { uid: "base-end", cabinetId: 2, masterCode: "B-18", placement: "base", x: 0, y: 0, width: 18, depth: 24, height: 34.5, rotation: 90, wallId: "peninsula-test", wallOffset: 66 } as PlacedCabinet];
    addThreeDPeninsulaCountertops(root, room, placed, "#e9e7e2");
    const slabs = root.children.filter((item) => item.userData.peninsulaCountertop);
    const waterfalls = root.children.filter((item) => item.userData.peninsulaWaterfall);
    expect(slabs).toHaveLength(2);
    expect(slabs).toEqual(expect.arrayContaining([
      expect.objectContaining({ userData: expect.objectContaining({ peninsulaRunId: "peninsula-test", runStartIn: 0, bridgesCabinetVoids: false }) }),
      expect.objectContaining({ userData: expect.objectContaining({ peninsulaRunId: "peninsula-test", runStartIn: 66, bridgesCabinetVoids: false }) }),
    ]));
    expect(waterfalls).toHaveLength(1);
    expect(waterfalls[0]?.userData).toMatchObject({ peninsulaRunId: "peninsula-test", exposedFarEnd: true });

    const run = room.peninsulaRuns![0]!;
    const surface = countertopSurfaces(placed, room).find((item) => item.peninsulaRunId === run.id && item.runStartIn === 0)!;
    // Historical seating values cannot widen the finished top: the 3D slab is
    // centered on the same 24-inch cabinet + 1½-inch edge as the plan surface.
    expect(slabs[0]!.position.x * 12).toBeCloseTo(surface.x + surface.width / 2, 6);
    expect(slabs[0]!.position.z * 12).toBeCloseTo(surface.y + surface.depth / 2, 6);
    const endpoints = peninsulaRunEndpoints(run, room);
    const face = countertopRunFaceNormal(endpoints.radians, "right");
    const slabCrossCenter = (slabs[0]!.position.x * 12 - endpoints.start.x) * face.x
      + (slabs[0]!.position.z * 12 - endpoints.start.y) * face.y;
    const waterfallCrossCenter = (waterfalls[0]!.position.x * 12 - endpoints.start.x) * face.x
      + (waterfalls[0]!.position.z * 12 - endpoints.start.y) * face.y;
    expect(slabCrossCenter).toBeCloseTo(COUNTERTOP_DEPTH_IN / 2, 6);
    expect(waterfallCrossCenter).toBeCloseTo(slabCrossCenter, 6);
  });

  it("keeps a legacy root overhang on its own support and moves the waterfall to the supported child end", () => {
    const root = new THREE.Group();
    const room: RoomData = {
      width: 192,
      depth: 144,
      ceilingHeight: 96,
      peninsulaRuns: [
        { id: "saved-parent", parentWall: "top", startOffset: 144.875, turn: 90, direction: "left", length: 90, height: 34.5, cabinetSide: "left", countertopSeatingOverhang: 12, countertopWaterfallEnd: true },
        { id: "saved-child", parentRunId: "saved-parent", startOffset: 0, turn: 45, direction: "right", length: 36, height: 34.5, cabinetSide: "left", countertopSeatingOverhang: 0, countertopWaterfallEnd: false },
      ],
    };
    const placed = [
      { uid: "saved-parent-base", cabinetId: 1, masterCode: "B-27", placement: "base", x: 0, y: 0, width: 27, depth: 24, height: 34.5, rotation: 90, wallId: "saved-parent", wallOffset: 51, peninsulaSide: "left" } as PlacedCabinet,
      { uid: "saved-child-base", cabinetId: 2, masterCode: "B-24", placement: "base", x: 0, y: 0, width: 24, depth: 24, height: 34.5, rotation: 135, wallId: "saved-child", wallOffset: 12, peninsulaSide: "left" } as PlacedCabinet,
    ];
    addThreeDPeninsulaCountertops(root, room, placed, "#e9e7e2");
    const slabs = root.children.filter((item) => item.userData.peninsulaCountertop);
    const waterfalls = root.children.filter((item) => item.userData.peninsulaWaterfall);
    expect(slabs).toHaveLength(3);
    expect(slabs).toEqual(expect.arrayContaining([
      expect.objectContaining({ userData: expect.objectContaining({ peninsulaRunId: "saved-parent", runStartIn: 51, seatingOverhangIn: 12 }) }),
      expect.objectContaining({ userData: expect.objectContaining({ peninsulaRunId: "saved-child", runStartIn: 12, seatingOverhangIn: 12 }) }),
    ]));
    expect(waterfalls).toHaveLength(1);
    expect(waterfalls[0]?.userData).toMatchObject({ peninsulaRunId: "saved-child", exposedFarEnd: true });
  });

  it("leaves a physical stove opening and keeps the waterfall on only the exposed final slab", () => {
    const root = new THREE.Group();
    const room: RoomData = {
      width: 144,
      depth: 120,
      ceilingHeight: 96,
      peninsulaRuns: [{ id: "peninsula-stove", parentWall: "top", startOffset: 24, turn: 90, direction: "right", length: 96, height: 34.5, cabinetSide: "left", countertopWaterfallEnd: true }],
    };
    const placed = [
      { uid: "base-before", cabinetId: 1, masterCode: "B-24", placement: "base", x: 0, y: 0, width: 24, depth: 24, height: 34.5, rotation: 90, wallId: "peninsula-stove", wallOffset: 0 } as PlacedCabinet,
      { uid: "stove-opening", cabinetId: 2, masterCode: "STOVE-30", description: "30 inch gas stove", placement: "appliance", x: 0, y: 0, width: 30, depth: 25, height: 36, rotation: 90, wallId: "peninsula-stove", wallOffset: 24 } as PlacedCabinet,
      { uid: "base-after", cabinetId: 3, masterCode: "B-42", placement: "base", x: 0, y: 0, width: 42, depth: 24, height: 34.5, rotation: 90, wallId: "peninsula-stove", wallOffset: 54 } as PlacedCabinet,
    ];
    addThreeDPeninsulaCountertops(root, room, placed, "#e9e7e2");
    const slabs = root.children.filter((item) => item.userData.peninsulaCountertop);
    const waterfalls = root.children.filter((item) => item.userData.peninsulaWaterfall);
    expect(slabs).toHaveLength(2);
    expect(slabs.map((item) => item.userData.runStartIn)).toEqual([0, 54]);
    expect(slabs.every((item) => item.userData.preservesRangeOpening)).toBe(true);
    expect(waterfalls).toHaveLength(1);
    expect(waterfalls[0]?.userData).toMatchObject({ peninsulaRunId: "peninsula-stove", exposedFarEnd: true });
  });

  it("renders the complete angled LSB36 countertop polygon through the shared measured-wall path", () => {
    const root = new THREE.Group();
    const room: RoomData = {
      width: 144,
      depth: 144,
      ceilingHeight: 96,
      vertices: [
        { id: "a", x: 0, y: 0 }, { id: "b", x: 144, y: 144 },
        { id: "c", x: 0, y: 144 },
      ],
      customWalls: [
        { id: "drawn-45", startVertexId: "a", endVertexId: "b", lockedAngle: 45 },
        { id: "drawn-return", startVertexId: "b", endVertexId: "c" },
      ],
    };
    const lsb36 = {
      uid: "drawn-45-lsb36", cabinetId: 1, masterCode: "LSB36", description: "36 inch Lazy Susan Corner Base",
      placement: "base", width: 36, depth: 36, height: 34.5, x: 34.5441559, y: 34.5441559,
      rotation: 45, cornerType: "lazy-susan", wallId: "drawn-45", wallOffset: 0,
    } as PlacedCabinet;
    addThreeDMeasuredWallMiterCountertops(root, room, [lsb36], "#e9e7e2");
    const [slab] = root.children.filter((item) => item.userData.measuredWallContinuousCountertop);
    expect(slab?.geometry.type).toBe("ExtrudeGeometry");
    expect(slab?.userData.customWallId).toBe("drawn-45");
  });

  it("extrudes a mitered slab polygon instead of the overlapping rectangular footprint", () => {
    const geometry = threeDPeninsulaCountertopGeometry({
      x: 0,
      y: 0,
      width: 36,
      depth: 25.5,
      kind: "base",
      rotation: 45,
      polygon: [{ x: 0, y: 0 }, { x: 36, y: 0 }, { x: 30, y: 25.5 }, { x: 0, y: 25.5 }],
    }, 36, 25.5);
    expect(geometry.type).toBe("ExtrudeGeometry");
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.max.x).toBeCloseTo(18 / 12, 6);
    expect(geometry.boundingBox?.min.x).toBeCloseTo(-18 / 12, 6);
  });

  it("renders the reported right-side straight-to-45 joint as one unified miter mesh", () => {
    const root = new THREE.Group();
    const room: RoomData = {
      width: 144,
      depth: 144,
      ceilingHeight: 96,
      peninsulaRuns: [
        { id: "miter-parent-3d", parentWall: "top", startOffset: 72, turn: 90, direction: "right", length: 48, height: 34.5, cabinetSide: "right" },
        { id: "miter-child-3d", parentRunId: "miter-parent-3d", startOffset: 0, turn: 45, direction: "left", length: 36, height: 34.5, cabinetSide: "right" },
      ],
    };
    const placed = [
      { uid: "miter-parent-base", cabinetId: 1, masterCode: "B-48", placement: "base", x: 0, y: 0, width: 48, depth: 24, height: 34.5, rotation: 270, wallId: "miter-parent-3d", wallOffset: 0, peninsulaSide: "right" } as PlacedCabinet,
      { uid: "miter-child-base", cabinetId: 2, masterCode: "B-36", placement: "base", x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 225, wallId: "miter-child-3d", wallOffset: 0, peninsulaSide: "right" } as PlacedCabinet,
    ];
    addThreeDPeninsulaCountertops(root, room, placed, "#e9e7e2");
    const slabs = root.children.filter((item) => item.userData.peninsulaCountertop);
    expect(slabs).toHaveLength(1);
    expect(slabs[0]?.geometry.type).toBe("ExtrudeGeometry");
    expect(slabs[0]?.userData).toMatchObject({
      unifiedPeninsulaAssembly: true,
      peninsulaRunIds: ["miter-parent-3d", "miter-child-3d"],
      miteredEnd: true,
      miteredStart: true,
    });
    expect(slabs[0]?.rotation.y).toBeCloseTo(0, 6);
  });

  it("keeps every 3D 45-degree countertop point on the authored unified 2D miter outline", () => {
    const root = new THREE.Group();
    const room: RoomData = {
      width: 144,
      depth: 144,
      ceilingHeight: 96,
      peninsulaRuns: [
        { id: "left-miter-parent-3d", parentWall: "top", startOffset: 72, turn: 90, direction: "right", length: 48, height: 34.5, cabinetSide: "left", countertopSeatingOverhang: 12 },
        { id: "left-miter-child-3d", parentRunId: "left-miter-parent-3d", startOffset: 0, turn: 45, direction: "right", length: 36, height: 34.5, cabinetSide: "left" },
      ],
    };
    const [parentRun, childRun] = room.peninsulaRuns!;
    const parentSpot = wallPlacementAt(0, parentRun.length, 24, parentRun.id as any, room, "left");
    const childSpot = wallPlacementAt(0, childRun.length, 24, childRun.id as any, room, "left");
    const placed = [
      { uid: "left-miter-parent-base", cabinetId: 1, masterCode: "B-48", placement: "base", ...parentSpot, width: parentRun.length, depth: 24, height: 34.5, wallId: parentRun.id, wallOffset: 0, peninsulaSide: "left" } as PlacedCabinet,
      { uid: "left-miter-child-base", cabinetId: 2, masterCode: "B-36", placement: "base", ...childSpot, width: childRun.length, depth: 24, height: 34.5, wallId: childRun.id, wallOffset: 0, peninsulaSide: "left" } as PlacedCabinet,
    ];
    const surface = countertopSurfaces(placed, room).find((candidate) => candidate.peninsulaRunId === parentRun.id)!;
    const expectedPlanPoints = countertopSurfacePlanPolygon(surface);
    const length = surface.width;
    expect(surface).toMatchObject({ peninsulaRunIds: [parentRun.id, childRun.id], rotation: 0 });
    expect(threeDPeninsulaCountertopPhysicalDepth(surface, length)).toBeCloseTo(surface.depth, 6);

    addThreeDPeninsulaCountertops(root, room, placed, "#e9e7e2");
    const slab = root.children.find((item) => item.userData.unifiedPeninsulaAssembly) as THREE.Mesh;
    expect(slab.userData.physicalDepthIn).toBeCloseTo(surface.depth, 6);
    slab.updateMatrixWorld(true);
    const positions = slab.geometry.getAttribute("position");
    const worldVertices = Array.from({ length: positions.count }, (_, index) => new THREE.Vector3()
      .fromBufferAttribute(positions, index)
      .applyMatrix4(slab.matrixWorld));

    for (const expected of expectedPlanPoints) {
      expect(worldVertices.some((vertex) =>
        Math.hypot(vertex.x - expected.x / 12, vertex.z - expected.y / 12) < 1e-5,
      )).toBe(true);
    }
  });

  it("extrudes the real ERB36 exterior L leg into the shared 45-degree peninsula slab", () => {
    const root = new THREE.Group();
    const room: RoomData = {
      width: 144,
      depth: 120,
      ceilingHeight: 96,
      peninsulaRuns: [
        { id: "erb-parent-3d", parentWall: "top", startOffset: 72, turn: 90, direction: "right", length: 48, height: 34.5, cabinetSide: "right" },
        { id: "erb-child-3d", parentRunId: "erb-parent-3d", startOffset: 0, turn: 45, direction: "left", length: 36, height: 34.5, cabinetSide: "right" },
      ],
    };
    const [parentRun, childRun] = room.peninsulaRuns!;
    const spot = wallPlacementAt(12, 36, 36, parentRun.id as any, room, "right");
    const erb = {
      uid: "erb36-45-peninsula",
      cabinetId: 1,
      masterCode: "ERB36",
      description: "36 inch Easy Reach Corner Base",
      placement: "base",
      ...spot,
      width: 36,
      depth: 36,
      height: 34.5,
      wallId: parentRun.id,
      wallOffset: 12,
      peninsulaSide: "right",
    } as PlacedCabinet;
    const returnBaseSpot = wallPlacementAt(0, 24, 24, childRun.id as any, room, "right");
    const returnBase = {
      uid: "erb36-45-return-base",
      cabinetId: 2,
      masterCode: "B24",
      description: "24 inch Base Cabinet",
      placement: "base",
      ...returnBaseSpot,
      width: 24,
      depth: 24,
      height: 34.5,
      wallId: childRun.id,
      wallOffset: 0,
      peninsulaSide: "right",
    } as PlacedCabinet;
    const surface = countertopSurfaces([erb, returnBase], room).find((candidate) => candidate.peninsulaRunId === parentRun.id)!;
    const expectedPlanPoints = countertopSurfacePlanPolygon(surface);
    expect(surface).toMatchObject({ peninsulaRunIds: [parentRun.id, childRun.id] });
    expect(expectedPlanPoints.some((point) => Math.abs(point.x - 109.5) < 1e-6 && point.y >= 24 && point.y <= 48)).toBe(true);

    addThreeDPeninsulaCountertops(root, room, [erb, returnBase], "#e9e7e2");
    const slabs = root.children.filter((item) => item.userData.peninsulaCountertop) as THREE.Mesh[];
    expect(slabs).toHaveLength(1);
    const slab = slabs[0]!;
    expect(slab.userData).toMatchObject({
      unifiedPeninsulaAssembly: true,
      peninsulaRunIds: [parentRun.id, childRun.id],
    });
    slab.updateMatrixWorld(true);
    const positions = slab.geometry.getAttribute("position");
    const worldVertices = Array.from({ length: positions.count }, (_, index) => new THREE.Vector3()
      .fromBufferAttribute(positions, index)
      .applyMatrix4(slab.matrixWorld));
    for (const expected of expectedPlanPoints) {
      expect(worldVertices.some((vertex) =>
        Math.hypot(vertex.x - expected.x / 12, vertex.z - expected.y / 12) < 1e-5,
      )).toBe(true);
    }
  });
});

describe("angled sink fixture parity", () => {
  it("rotates the complete sink assembly around its stored SB36 center", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "angled-sb36-sink",
      type: "single",
      x: 48,
      y: 36,
      width: 31,
      depth: 20,
      sourceWidth: 31,
      sourceDepth: 20,
      faucet: false,
      wallSide: "peninsula-45",
      cabinetUid: "angled-sb36",
      planRotation: 45,
    } as never;
    const transform = sinkFixtureTransform(sink);
    expect(transform.rotation).toBeCloseTo(Math.PI * 7 / 4, 8);
    addSinkFixture(root, sink);
    const fixtureGroup = root.children.find((item) => item.userData.sinkFixtureGroup);
    expect(fixtureGroup).toBeDefined();
    expect(fixtureGroup?.rotation.y).toBeCloseTo(transform.rotation, 8);
    let bowl: THREE.Object3D | undefined;
    fixtureGroup?.traverse((node) => {
      if (node.userData.sinkBowl) bowl = node;
    });
    root.updateMatrixWorld(true);
    const bowlCenter = bowl?.getWorldPosition(new THREE.Vector3());
    expect(bowlCenter?.x).toBeCloseTo(transform.x, 8);
    expect(bowlCenter?.z).toBeCloseTo(transform.z, 8);
  });
});

describe("interactive 3D room scene helpers", () => {
	  it("uses performance-aware mobile and desktop quality tiers without carrying any geometry or camera fields", () => {
	    expect(threeDRenderQualityProfile({ canvasWidth: 390, canvasHeight: 844, devicePixelRatio: 3, coarsePointer: true, hardwareConcurrency: 8, deviceMemoryGb: 8 })).toEqual({
	      tier: "mobile", pixelRatioCap: 1.25, shadowMapSize: 1024, maxAnisotropy: 4, environmentEnabled: true,
	    });
	    expect(threeDRenderQualityProfile({ canvasWidth: 900, canvasHeight: 700, devicePixelRatio: 2, coarsePointer: false, hardwareConcurrency: 8, deviceMemoryGb: 8 }).tier).toBe("balanced");
	    expect(threeDRenderQualityProfile({ canvasWidth: 1440, canvasHeight: 900, devicePixelRatio: 2, coarsePointer: false, hardwareConcurrency: 8, deviceMemoryGb: 8 })).toEqual({
	      tier: "high", pixelRatioCap: 1.75, shadowMapSize: 2048, maxAnisotropy: 8, environmentEnabled: true,
	    });
	  });

		  it("defines physically based cabinet and selected-surface profiles independently from plan geometry", () => {
		    expect(threeDPhysicalSurfaceProfile("cabinet", true)).toMatchObject({ roughness: 0.44, metalness: 0, clearcoat: 0.06 });
	    expect(threeDPhysicalSurfaceProfile("countertop", true)).toMatchObject({ roughness: 0.32, clearcoat: 0.24 });
	    expect(threeDPhysicalSurfaceProfile("metal")).toMatchObject({ metalness: 0.82, envMapIntensity: 1.12 });
	    expect(threeDSurfaceTextureTransform("flooring", 144, 120)).toEqual({ wrap: "repeat", repeatX: 6, repeatY: 5, offsetX: 0, offsetY: 0 });
	    expect(threeDSurfaceTextureTransform("countertop", 144, 25.5)).toEqual({ wrap: "clamp", repeatX: 0.62, repeatY: 0.52, offsetX: 0.19, offsetY: 0.24 });
		    expect(threeDSurfaceImageCrop("countertop")).toEqual({ x: 0.28, y: 0.3, width: 0.44, height: 0.4 });
		    expect(threeDSurfaceImageCrop("flooring")).toEqual({ x: 0.035, y: 0.035, width: 0.93, height: 0.93 });
		    expect(threeDSurfaceImageCrop("backsplash")).toEqual({ x: 0.08, y: 0.08, width: 0.84, height: 0.84 });
		  });

		  it("adds clone-only deterministic production lighting without importing a catalog room scene or changing the room geometry", () => {
		    const productionScene = new THREE.Scene();
		    const lights = addThreeDProductionLightRig(productionScene, 12, 10, 8);
		    expect(lights).toHaveLength(3);
		    expect(productionScene.children).toHaveLength(3);
		    expect(lights.map((light) => light.userData.rig)).toEqual(["daylight", "ceiling", "soft-fill"]);
		    expect(lights.every((light) => light.userData.productionRenderLight && light.userData.cloneOnly)).toBe(true);
		  });

		  it("uses the licensed neutral HDRI only for the cloned production scene's deterministic light and reflection environment", () => {
		    const source = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
		    expect(source).toContain('import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";');
		    expect(source).toContain('export const THREE_D_PRODUCTION_HDRI_URL = "/manus-storage/photo_studio_01_1k_5f7e3d4e.hdr";');
		    expect(source).toContain('await new RGBELoader().loadAsync(THREE_D_PRODUCTION_HDRI_URL)');
		    expect(source).toContain("productionEnvironment.mapping = THREE.EquirectangularReflectionMapping");
		    expect(source).toContain("pathTraceScene.environment = productionEnvironment");
		    expect(source).not.toContain("pathTraceScene.background = productionEnvironment");
		  });

		  it("preserves existing physical glass, specular, and sheen response when cloning the exact scene for path tracing", () => {
		    const source = new THREE.MeshPhysicalMaterial({
		      color: "#bccfd8",
		      roughness: 0.12,
		      metalness: 0.18,
		      clearcoat: 0.28,
		      ior: 1.45,
		      transmission: 0.48,
		      thickness: 0.18,
		      attenuationDistance: 0.9,
		      attenuationColor: "#d4e5ee",
		      specularIntensity: 0.74,
		      specularColor: "#e2eef2",
		      sheen: 0.06,
		      sheenRoughness: 0.42,
		      sheenColor: "#f2eee8",
		    });
		    const converted = pathTraceCompatibleMaterial(source);
		    expect(converted).toBeInstanceOf(THREE.MeshPhysicalMaterial);
		    expect(converted).toMatchObject({
		      roughness: 0.12,
		      metalness: 0.18,
		      clearcoat: 0.28,
		      ior: 1.45,
		      transmission: 0.48,
		      thickness: 0.18,
		      attenuationDistance: 0.9,
		      specularIntensity: 0.74,
		      sheen: 0.06,
		      sheenRoughness: 0.42,
		    });
		    expect(converted.attenuationColor.getHexString()).toBe(source.attenuationColor.getHexString());
		    expect(converted.specularColor.getHexString()).toBe(source.specularColor.getHexString());
		    expect(converted.sheenColor.getHexString()).toBe(source.sheenColor.getHexString());
		  });

		  it("resolves the exact selected Aveline and Calacatta products to curated manufacturer-derived material fields", () => {
		    const floor = threeDProductMaterialSource("flooring", "Aveline 20mil Vinyl Flooring", "/manus-storage/pelican/73_ca633206.png");
		    expect(floor).toMatchObject({
		      url: "/manus-storage/aveline_20mil_7x48_staggered_floor_2675d409.webp",
		      key: "aveline-20mil-7x48",
		      curated: true,
		      physicalWidthIn: 192,
		      physicalDepthIn: 84,
		      sourceProductName: "Aveline 20mil Vinyl Flooring",
		      flooringPatternKind: "plank",
		      plankWidthIn: 7,
		      plankLengthIn: 48,
		    });
		    expect(floor?.staggerOffsetsIn).toEqual([0, 16, 32, 8, 24, 40, 12, 28, 44, 4, 20, 36]);
		    expect(threeDProductSurfaceTextureTransform("flooring", floor!, 144, 120)).toEqual({
		      wrap: "repeat",
		      repeatX: 0.75,
		      repeatY: 120 / 84,
		      offsetX: 0,
		      offsetY: 0,
		      rotation: 0,
		    });
			const slab = threeDProductMaterialSource("countertop", "Calacatta Oro 3cm Super Jumbo", "/manus-storage/pelican/8_acb59792.png");
			expect(slab).toMatchObject({
				url: "/manus-storage/pelican/quartz/full-moon-3cm-jumbo-1_source_slab_4dd73868.webp",
				key: "pelican-quartz:full-moon-3cm-jumbo-1",
				curated: true,
				physicalWidthIn: 138,
				physicalDepthIn: 79,
			});
		  });

		  it("resolves the owner’s saved Sample-design products to verified material-only sources", () => {
			const bahia = threeDProductMaterialSource("flooring", "Bahia 12mil Vinyl Flooring", null, { category: "Flooring", subCategory: "Planks & Flooring", size: null });
				expect(bahia).toMatchObject({
					url: "/manus-storage/bahia_12mil_7x48_staggered_floor_551c6d5b.webp", key: "bahia-12mil-7x48",
					curated: true, proceduralFallback: false, physicalWidthIn: 192, physicalDepthIn: 84,
					flooringPatternKind: "plank", plankWidthIn: 7, plankLengthIn: 48,
				});
				expect(threeDProductMaterialSource("flooring", null, null, { productId: 82 })).toMatchObject({
					key: "bahia-12mil-7x48", curated: true, proceduralFallback: false,
				});
				const acorn = threeDProductMaterialSource("flooring", "Acorn 20mil Dryback Planks", null, { category: "Flooring", subCategory: "Planks & Flooring", size: null });
			expect(acorn).toMatchObject({
				url: "/manus-storage/acorn_20mil_7_5x48_staggered_floor_3dbd212f.webp", key: "acorn-20mil-7.5x48",
					curated: true, proceduralFallback: false, physicalWidthIn: 192, physicalDepthIn: 90,
					flooringPatternKind: "plank", plankWidthIn: 7.5, plankLengthIn: 48,
				});
				expect(threeDProductMaterialSource("flooring", "Legacy floor label", null, { productId: 40 })).toMatchObject({
					key: "acorn-20mil-7.5x48", curated: true, proceduralFallback: false,
				});
				const astoria = threeDProductMaterialSource("flooring", "Astoria 22mil Vinyl Flooring", "/manus-storage/pelican/54_65e4c5a2.png", { productId: 54, category: "Flooring", subCategory: "Planks & Flooring", size: null });
				expect(astoria).toMatchObject({
					url: "/manus-storage/astoria_22mil_9x60_staggered_floor_cd0a1cf7.webp", key: "astoria-22mil-9x60",
					curated: true, proceduralFallback: false, physicalWidthIn: 240, physicalDepthIn: 108,
					flooringPatternKind: "plank", plankWidthIn: 9, plankLengthIn: 60,
				});
					expect(astoria?.url).not.toContain("pelican/54_65e4c5a2.png");
					expect(threeDProductMaterialSource("flooring", "Legacy renamed flooring", null, { productId: 73 })).toMatchObject({
						url: "/manus-storage/aveline_20mil_7x48_staggered_floor_2675d409.webp",
						key: "aveline-20mil-7x48",
						curated: true,
						proceduralFallback: false,
						flooringPatternKind: "plank",
						plankWidthIn: 7,
						plankLengthIn: 48,
					});
				expect(threeDProductMaterialSource("countertop", "Bedrock 3cm", null)).toMatchObject({
			url: "/manus-storage/pelican/quartz/bedrock-3cm_source_slab_e61a47e8.webp", key: "pelican-quartz:bedrock-3cm",
				curated: true, proceduralFallback: false, physicalWidthIn: 126, physicalDepthIn: 63,
			});
				expect(threeDProductMaterialSource("backsplash", "Desert Clay", null)).toMatchObject({
					url: "/manus-storage/desert_clay_11_81_interlocking_mosaic_0aa381c4.webp", key: "desert-clay-11.81in-interlocking-mosaic",
					curated: true, proceduralFallback: false, physicalWidthIn: 11.81, physicalDepthIn: 11.81,
					backsplashPatternKind: "interlocking-mosaic", backsplashModuleIn: 11.81, backsplashGroutJointIn: 1 / 16,
				});
				expect(threeDProductMaterialSource("backsplash", "Arctic Vail", null)).toMatchObject({
					url: "/manus-storage/arctic_vail_candidate_2_a8bed842.png", key: "arctic-vail-10.71in-interlocking-hex-mosaic",
					curated: true, proceduralFallback: false, physicalWidthIn: 10.71, physicalDepthIn: 10.55,
					backsplashPatternKind: "interlocking-mosaic", backsplashModuleIn: 10.71, backsplashGroutJointIn: 1 / 16,
				});
				expect(threeDProductMaterialSource("backsplash", "Carbon Hex", null)).toMatchObject({
						url: "/manus-storage/carbon_hex_candidate_1_2af63616.png", key: "carbon-hex-12.80in-marble-hex-mosaic",
						curated: true, proceduralFallback: false, physicalWidthIn: 12.8, physicalDepthIn: 11.1,
						backsplashPatternKind: "interlocking-mosaic", backsplashModuleIn: 12.8, backsplashGroutJointIn: 1 / 16,
					});
				expect(threeDProductMaterialSource("backsplash", "Carrara Subway", null)).toMatchObject({
							url: "/manus-storage/carrara_subway_11_97x12_13_running_bond_f57029f6.webp", key: "carrara-subway-11.97in-running-bond-mosaic",
							curated: true, proceduralFallback: false, physicalWidthIn: 11.97, physicalDepthIn: 12.13,
							backsplashPatternKind: "subway-mosaic", backsplashModuleIn: 11.97, backsplashGroutJointIn: 1 / 16,
						});
				expect(threeDProductMaterialSource("backsplash", "Cloudline Marble", "/manus-storage/pelican/149_7a8d9432.png")).toMatchObject({
							url: "/manus-storage/cloudline_marble_11_81x11_81_staggered_mosaic_32c5408e.webp", key: "cloudline-marble-11.81in-staggered-glass-marble-mosaic",
							curated: true, proceduralFallback: false, physicalWidthIn: 11.81, physicalDepthIn: 11.81,
							backsplashPatternKind: "subway-mosaic", backsplashModuleIn: 11.81, backsplashGroutJointIn: 1 / 16,
						});
				expect(threeDProductMaterialSource("backsplash", "Concord Square", "/manus-storage/pelican/164_7f2e1c1b.png")).toMatchObject({
						url: "/manus-storage/concord_square_11_81x11_81_glass_marble_mosaic_8ffff52d.webp", key: "concord-square-11.81in-glass-marble-mosaic",
						curated: true, proceduralFallback: false, physicalWidthIn: 11.81, physicalDepthIn: 11.81,
						backsplashPatternKind: "interlocking-mosaic", backsplashModuleIn: 11.81, backsplashGroutJointIn: 1 / 16,
					});
				expect(threeDProductMaterialSource("backsplash", "Glacier Shift", "/manus-storage/pelican/242_approved.png")).toMatchObject({
						url: "/manus-storage/glacier_shift_12_05x12_05_recycled_glass_herringbone_3f2c6eb9.webp", key: "glacier-shift-12.05in-recycled-glass-herringbone",
						curated: true, proceduralFallback: false, physicalWidthIn: 12.05, physicalDepthIn: 12.05,
						backsplashPatternKind: "interlocking-mosaic", backsplashModuleIn: 12.05, backsplashGroutJointIn: 1 / 16,
					});
					expect(threeDProductMaterialSource("backsplash", "Golden Trace", "/manus-storage/pelican/244_approved.png")).toMatchObject({
						url: "/manus-storage/golden_trace_11_81x11_81_marble_aluminum_mosaic_8ce14587.webp", key: "golden-trace-11.81in-marble-aluminum-mosaic",
						curated: true, proceduralFallback: false, physicalWidthIn: 11.81, physicalDepthIn: 11.81,
						backsplashPatternKind: "interlocking-mosaic", backsplashModuleIn: 11.81, backsplashGroutJointIn: 1 / 16,
					});
					const sourceIdentityCases = [
						{ productId: 47, key: "arctic-vail-10.71in-interlocking-hex-mosaic", pattern: "interlocking-mosaic", moduleIn: 10.71 },
						{ productId: 142, key: "carbon-hex-12.80in-marble-hex-mosaic", pattern: "interlocking-mosaic", moduleIn: 12.8 },
						{ productId: 144, key: "carrara-subway-11.97in-running-bond-mosaic", pattern: "subway-mosaic", moduleIn: 11.97 },
						{ productId: 149, key: "cloudline-marble-11.81in-staggered-glass-marble-mosaic", pattern: "subway-mosaic", moduleIn: 11.81 },
						{ productId: 164, key: "concord-square-11.81in-glass-marble-mosaic", pattern: "interlocking-mosaic", moduleIn: 11.81 },
						{ productId: 183, key: "desert-clay-11.81in-interlocking-mosaic", pattern: "interlocking-mosaic", moduleIn: 11.81 },
						{ productId: 242, key: "glacier-shift-12.05in-recycled-glass-herringbone", pattern: "interlocking-mosaic", moduleIn: 12.05 },
						{ productId: 244, key: "golden-trace-11.81in-marble-aluminum-mosaic", pattern: "interlocking-mosaic", moduleIn: 11.81 },
					] as const;
					for (const patternCase of sourceIdentityCases) {
						expect(threeDProductMaterialSource("backsplash", "Legacy renamed tile", null, { productId: patternCase.productId })).toMatchObject({
							key: patternCase.key,
							curated: true,
							proceduralFallback: false,
							backsplashPatternKind: patternCase.pattern,
							backsplashModuleIn: patternCase.moduleIn,
							backsplashGroutJointIn: 1 / 16,
						});
					}
			  });

		  it("keeps adjacent Calacatta countertop pieces continuous in one physical slab coordinate system", () => {
		    const first = threeDCountertopSlabTextureTransform({ centerXIn: 12, centerZIn: 12.75, localWidthIn: 24, localDepthIn: 25.5, rotation: 0 });
		    const second = threeDCountertopSlabTextureTransform({ centerXIn: 36, centerZIn: 12.75, localWidthIn: 24, localDepthIn: 25.5, rotation: 0 });
		    expect(first.repeatX).toBeCloseTo(24 / 138);
		    expect(first.offsetX).toBeCloseTo(0);
		    expect(second.offsetX).toBeCloseTo(first.offsetX + first.repeatX);
		    expect(first.repeatY).toBeCloseTo(25.5 / 79);
		    expect(first.rotation).toBe(0);
		  });

		  it("assigns every source-qualified Pelican quartz slab to a physical world-slab coordinate system rather than a generic countertop crop", () => {
		    const aurora = threeDProductMaterialSource("countertop", "Aurora 3cm", "/manus-storage/pelican-quartz/aurora.webp");
		    expect(aurora).toMatchObject({
		      curated: true,
		      proceduralFallback: false,
		      physicalWidthIn: 126,
		      physicalDepthIn: 63,
		      key: "pelican-quartz:aurora-3cm",
		    });
		    const transform = threeDProductSurfaceTextureTransform("countertop", aurora!, 63, 31.5);
		    expect(transform).toEqual({ wrap: "repeat", repeatX: 0.5, repeatY: 0.5, offsetX: 0, offsetY: 0, rotation: 0 });
		  });

		  it("classifies flooring by authoritative product identity and applies stagger rules only to plank products", () => {
		    expect(threeDFlooringPatternProfile({ name: "Aveline Luxury Vinyl Plank", category: "Flooring", subCategory: "Vinyl Plank", size: '7" x 48"' })).toMatchObject({
		      kind: "plank",
		      plankWidthIn: 7,
		      plankLengthIn: 48,
		    });
		    expect(threeDFlooringPatternProfile({ name: "Calacatta Porcelain Tile", category: "Flooring", subCategory: "Tile", size: '12" x 24"' })).toEqual({
		      kind: "tile",
		      plankWidthIn: null,
		      plankLengthIn: null,
		      staggerOffsetsIn: null,
		    });
		    expect(threeDFlooringPatternProfile({ name: "Sheet Vinyl", category: "Flooring", subCategory: "Sheet", size: null }).kind).toBe("sheet");
		    expect(threeDFlooringPatternProfile({ name: "Natural Oak", category: "Flooring", subCategory: "Planks & Flooring", size: '8" x 48"' }).kind).toBe("plank");
		  });

		  it("uses twelve visibly staggered plank rows with no aligned neighboring end joints", () => {
		    const atlas = threeDPlankAtlasProfile(7, 48);
		    expect(atlas).toMatchObject({ rows: 12, columns: 4, physicalWidthIn: 192, physicalDepthIn: 84 });
		    expect(new Set(atlas.staggerOffsetsIn).size).toBe(12);
		    for (let index = 0; index < atlas.staggerOffsetsIn.length; index++) {
		      const current = atlas.staggerOffsetsIn[index];
		      const next = atlas.staggerOffsetsIn[(index + 1) % atlas.staggerOffsetsIn.length];
		      const direct = Math.abs(next - current);
		      const nearestJointDistance = Math.min(direct, atlas.plankLengthIn - direct);
		      expect(nearestJointDistance).toBeGreaterThanOrEqual(8);
		    }
		  });

		  it("generates a physical stagger atlas for any plank product while retaining non-plank mapping", () => {
		    const plank = threeDProductMaterialSource("flooring", "Coastal Oak LVP", "/oak.jpg", { category: "Flooring", subCategory: "Luxury Vinyl Plank", size: '9" x 60"' });
		    expect(plank).toMatchObject({ flooringPatternKind: "plank", plankWidthIn: 9, plankLengthIn: 60 });
		    expect(threeDProductSurfaceTextureTransform("flooring", plank!, 120, 96)).toMatchObject({
		      wrap: "repeat",
		      repeatX: 0.5,
		      repeatY: 96 / 108,
		      rotation: 0,
		    });
		    const tile = threeDProductMaterialSource("flooring", "Carrara Porcelain Tile", "/tile.jpg", { category: "Flooring", subCategory: "Tile", size: '12" x 24"' });
		    expect(tile?.flooringPatternKind).toBe("tile");
		    expect(threeDProductSurfaceTextureTransform("flooring", tile!, 120, 96)).toEqual({ wrap: "repeat", repeatX: 5, repeatY: 4, offsetX: 0, offsetY: 0, rotation: 0 });
		    const sheet = threeDProductMaterialSource("flooring", "Commercial Sheet Vinyl", "/sheet.jpg", { category: "Flooring", subCategory: "Sheet", size: null });
		    expect(sheet).toMatchObject({ flooringPatternKind: "sheet", plankWidthIn: null, plankLengthIn: null, staggerOffsetsIn: null });
		    expect(threeDProductSurfaceTextureTransform("flooring", sheet!, 120, 96)).toEqual({ wrap: "repeat", repeatX: 5, repeatY: 4, offsetX: 0, offsetY: 0, rotation: 0 });
			const unknown = threeDProductMaterialSource("flooring", "Custom Floor Finish", "/custom.jpg", { category: "Flooring", subCategory: null, size: null });
			expect(unknown).toMatchObject({ flooringPatternKind: "unknown", plankWidthIn: null, plankLengthIn: null, staggerOffsetsIn: null });
			expect(threeDProductSurfaceTextureTransform("flooring", unknown!, 120, 96)).toEqual({ wrap: "repeat", repeatX: 5, repeatY: 4, offsetX: 0, offsetY: 0, rotation: 0 });
		  });

		  it("keeps a swatch-pending selected surface visibly represented without loading its catalog photo", () => {
			const floor = threeDProductMaterialSource("flooring", "Harbor Oak Luxury Vinyl Plank", null, {
				category: "Flooring", subCategory: "Planks & Flooring", size: '7" x 48"',
			});
			expect(floor).toMatchObject({
				url: "", key: "representative-flooring", curated: false, proceduralFallback: true,
				flooringPatternKind: "plank", plankWidthIn: 7, plankLengthIn: 48,
			});
			const tileFloor = threeDProductMaterialSource("flooring", "Selected Porcelain Tile", null, {
				category: "Flooring", subCategory: "Tile", size: '12" x 24"',
			});
			expect(tileFloor).toMatchObject({ key: "representative-flooring", proceduralFallback: true, flooringPatternKind: "tile" });
			const counter = threeDProductMaterialSource("countertop", "Selected Quartz", null);
			expect(counter).toMatchObject({ key: "representative-countertop", proceduralFallback: true, physicalWidthIn: 138, physicalDepthIn: 79 });
			const backsplash = threeDProductMaterialSource("backsplash", "Selected Tile", null);
			expect(backsplash).toMatchObject({ key: "representative-backsplash", proceduralFallback: true });
			expect(threeDProductMaterialSource("flooring", null, null)).toBeNull();
		  });

		  it("normalizes flooring UVs without moving a single room-plan vertex", () => {
	    const shape = new THREE.Shape([
	      new THREE.Vector2(0, 0), new THREE.Vector2(12, 0), new THREE.Vector2(12, 10), new THREE.Vector2(0, 10),
	    ]);
	    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
	    const positions = Array.from(geometry.getAttribute("position").array);
	    normalizeThreeDPlanarUv(geometry);
	    expect(Array.from(geometry.getAttribute("position").array)).toEqual(positions);
	    const uv = geometry.getAttribute("uv");
	    for (let index = 0; index < uv.count; index++) {
	      expect(uv.getX(index)).toBeGreaterThanOrEqual(0);
	      expect(uv.getX(index)).toBeLessThanOrEqual(1);
	      expect(uv.getY(index)).toBeGreaterThanOrEqual(0);
	      expect(uv.getY(index)).toBeLessThanOrEqual(1);
	    }
	  });

		  it("keeps support-only backsplash geometry for takeoff and countertop-upstand calculations", () => {
		    const room = { width: 120, depth: 96, ceilingHeight: 96 } as RoomData;
		    expect(threeDBacksplashSegments([], [], room)).toEqual([]);
	    const bases = [
	      { uid: "top-base", masterCode: "B-30", placement: "base", x: 12, y: 0, width: 30, depth: 24, height: 34.5, rotation: 0, islandFace: null },
	      { uid: "left-base", masterCode: "B-24", placement: "base", x: 0, y: 24, width: 24, depth: 24, height: 34.5, rotation: 90, islandFace: null },
	    ] as PlacedCabinet[];
		    const segments = threeDBacksplashSegments(bases, [], room);
		    expect(segments).toEqual(expect.arrayContaining([
		      { side: "top", start: 12, end: 42, bottom: 36, top: 54 },
		      { side: "left", start: 24, end: 48, bottom: 36, top: 54 },
		    ]));
		    expect(threeDBacksplashTransform(segments.find((segment) => segment.side === "left")!, room)).toMatchObject({ x: 0.07, z: 36, rotation: Math.PI / 2 });
		  });

		  it("keeps a legacy-width BBC36 backsplash on its real supported wall leg rather than painting open walls", () => {
		    const room = { width: 120, depth: 96, ceilingHeight: 96 } as RoomData;
		    const legacyBlind = {
		      uid: "legacy-bbc-36", masterCode: "BBC36", description: "Blind Corner Base",
		      placement: "base", x: 0, y: 0, width: 33, nominalWidth: 33, depth: 24,
		      height: 34.5, rotation: 0, wallId: "top", wallOffset: 0, islandFace: null,
		    } as PlacedCabinet;

		    // The normalized 36-inch BBC body owns its actual top-wall support.
		    expect(threeDBacksplashSupportSpans(legacyBlind, "top", room)).toEqual([{ start: 0, end: 36 }]);
		    const segments = threeDBacksplashSegments([legacyBlind], [], room);
		    expect(segments).toContainEqual({ side: "top", start: 0, end: 36, bottom: 36, top: 54 });
		    expect(segments.some((segment) => segment.side === "top" && segment.end > 36)).toBe(false);
		    expect(segments.some((segment) => segment.side === "left")).toBe(false);
		    expect(threeDCountertopUpstandSegments([legacyBlind], [], room, 3)).toContainEqual({ side: "top", start: 0, end: 36, bottom: 36, top: 39 });
		  });

		  it("does not tile beyond separated countertop supports on the same wall", () => {
		    const room = { width: 120, depth: 96, ceilingHeight: 96 } as RoomData;
		    const bases = [
		      { uid: "base-left", masterCode: "B-24", placement: "base", x: 0, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0, islandFace: null },
		      { uid: "base-right", masterCode: "B-24", placement: "base", x: 48, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0, islandFace: null },
		    ] as PlacedCabinet[];
		    expect(threeDBacksplashSegments(bases, [], room).filter((segment) => segment.side === "top")).toEqual([
		      { side: "top", start: 0, end: 24, bottom: 36, top: 54 },
		      { side: "top", start: 48, end: 72, bottom: 36, top: 54 },
		    ]);
		  });

	  it("continues backsplash above every countertop-height base component and under-counter appliance", () => {
		    const room = { width: 120, depth: 96, ceilingHeight: 96 } as RoomData;
		    const base = { uid: "base-1", masterCode: "B-24", placement: "base", x: 0, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0, islandFace: null } as PlacedCabinet;
		    const filler = { uid: "filler-1", masterCode: "FILL-3", description: '3" Filler', placement: "base", x: 24, y: 0, width: 3, depth: 24, height: 34.5, rotation: 0, islandFace: null } as PlacedCabinet;
		    const dishwasher = { uid: "dishwasher-1", masterCode: "DW-24", description: "24 inch Dishwasher", placement: "appliance", x: 27, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0, islandFace: null } as PlacedCabinet;
		    const refrigerator = { uid: "fridge-1", masterCode: "REF-36", description: "36 inch Refrigerator", placement: "appliance", x: 51, y: 0, width: 36, depth: 30, height: 70, rotation: 0, islandFace: null } as PlacedCabinet;
		    expect(threeDSupportsBacksplash(base, room)).toBe(true);
		    expect(threeDSupportsBacksplash(filler, room)).toBe(true);
		    expect(threeDSupportsBacksplash(dishwasher, room)).toBe(true);
		    expect(threeDSupportsBacksplash(refrigerator, room)).toBe(false);
	    expect(threeDBacksplashSegments([base, filler, dishwasher, refrigerator], [], room)).toContainEqual({ side: "top", start: 0, end: 51, bottom: 36, top: 54 });
	  });

	  it("wraps backsplash around both countertop-supported wall legs of a Lazy Susan base corner", () => {
	    const room = { width: 120, depth: 96, ceilingHeight: 96 } as RoomData;
	    const lazySusan = { uid: "ls-top-left", masterCode: "LS3612", description: "36 inch Lazy Susan Base Cabinet", placement: "base", x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0, cornerType: "lazy-susan", islandFace: null } as PlacedCabinet;
	    expect(threeDBacksplashSupportSpans(lazySusan, "top", room)).toEqual([{ start: 0, end: 36 }]);
	    expect(threeDBacksplashSupportSpans(lazySusan, "left", room)).toEqual([{ start: 0, end: 36 }]);
		    expect(threeDBacksplashSegments([lazySusan], [], room)).toEqual(expect.arrayContaining([
		      { side: "top", start: 0, end: 36, bottom: 36, top: 54 },
		      { side: "left", start: 0, end: 36, bottom: 36, top: 54 },
		    ]));
	  });

	  it("wraps backsplash around both legs of a corner-drawer base instead of leaving the adjoining wall blank", () => {
	    const room = { width: 120, depth: 96, ceilingHeight: 96 } as RoomData;
	    const cornerDrawer = { uid: "cdb-top-left", masterCode: "CDB36", description: "Corner Drawer Base", placement: "base", x: 0, y: 0, width: 36, depth: 36, height: 34.5, rotation: 0, islandFace: null } as PlacedCabinet;
	    expect(threeDBacksplashSupportSpans(cornerDrawer, "top", room)).toEqual([{ start: 0, end: 36 }]);
	    expect(threeDBacksplashSupportSpans(cornerDrawer, "left", room)).toEqual([{ start: 0, end: 36 }]);
	    expect(threeDBacksplashSegments([cornerDrawer], [], room)).toEqual(expect.arrayContaining([
	      { side: "top", start: 0, end: 36, bottom: 36, top: 54 },
	      { side: "left", start: 0, end: 36, bottom: 36, top: 54 },
	    ]));
	  });

	  it("clips the selected supported-run backsplash around a saved window without changing the opening or wall", () => {
	    const room = { width: 120, depth: 96, ceilingHeight: 96 } as RoomData;
		    const windowOpening = { uid: "window-1", kind: "window", label: "Window", side: "top", offset: 30, width: 30, height: 30, sill: 44 } as WallOpening;
	    const openingBefore = JSON.stringify(windowOpening);
	    const base = { uid: "base-1", masterCode: "B-120", placement: "base", x: 0, y: 0, width: 120, depth: 24, height: 34.5, rotation: 0, islandFace: null } as PlacedCabinet;
	    const segments = threeDBacksplashSegments([base], [windowOpening], room).filter((segment) => segment.side === "top");
	    expect(JSON.stringify(windowOpening)).toBe(openingBefore);
	    expect(segments).toEqual(expect.arrayContaining([
	      { side: "top", start: 0, end: 30, bottom: 36, top: 54 },
		      { side: "top", start: 30, end: 60, bottom: 36, top: 44 },
	      { side: "top", start: 60, end: 120, bottom: 36, top: 54 },
	    ]));
		    expect(segments.some((segment) => segment.start < 60 && segment.end > 30 && segment.top > 44)).toBe(false);
	  });

	  it("extends a supported range backsplash continuously to the matching range-hood underside", () => {
	    const room = { width: 120, depth: 96, ceilingHeight: 96 } as RoomData;
	    const range = { uid: "range-1", masterCode: "RANGE-30", description: "Freestanding range", placement: "appliance", x: 45, y: 0, width: 30, depth: 24, height: 36, rotation: 0, islandFace: null } as PlacedCabinet;
	    const hood = { uid: "hood-1", masterCode: "HOOD-30", description: "30 inch Range Hood", placement: "appliance", x: 45, y: 0, width: 30, depth: 18, height: 18, rotation: 0, mountBottom: 66, islandFace: null } as PlacedCabinet;
		    const openSegments = threeDBacksplashSegments([range, hood], [], room);
		    expect(openSegments).toEqual(expect.arrayContaining([
		      { side: "top", start: 45, end: 75, bottom: 36, top: 54 },
		      { side: "top", start: 45, end: 75, bottom: 54, top: 66 },
	    ]));
	    const wallCabinet = { uid: "wall-1", masterCode: "W-3030", description: "Wall cabinet", placement: "wall", x: 45, y: 0, width: 30, depth: 12, height: 30, rotation: 0, mountBottom: 54, islandFace: null } as PlacedCabinet;
	    const blockedSegments = threeDBacksplashSegments([range, hood, wallCabinet], [], room);
	    expect(blockedSegments).not.toContainEqual({ side: "top", start: 45, end: 75, bottom: 54, top: 66 });
	  });

		  it("maps selected backsplash material as one continuous 12-inch tile field with only cut edge courses", () => {
	    const standard = { side: "top", start: 0, end: 30, bottom: 36, top: 54 } as const;
	    expect(THREE_D_BACKSPLASH_TILE_SIZE_IN).toBe(12);
	    expect(threeDBacksplashTileTextureTransform(standard)).toEqual({ repeatX: 2.5, repeatY: 1.5, offsetX: 0, offsetY: 0 });
	    const joined = threeDBacksplashTileTextureTransform({ side: "top", start: 30, end: 54, bottom: 36, top: 54 });
	    expect(joined.offsetX).toBe(0.5);
		    expect(joined.repeatY).toBe(1.5);
		    const mosaic = threeDBacksplashTileTextureTransform(standard, 11.81);
		    expect(mosaic).toMatchObject({ repeatX: 30 / 11.81, repeatY: 18 / 11.81, offsetX: 0, offsetY: (36 / 11.81) % 1 });
		  });

	  it("uses one continuous 12-inch field above a corner-to-corner countertop upstand", () => {
	    const room = { width: 120, depth: 96, ceilingHeight: 96 } as RoomData;
	    const base = { uid: "upstand-base", masterCode: "B-30", placement: "base", x: 12, y: 0, width: 30, depth: 24, height: 34.5, rotation: 0, islandFace: null } as PlacedCabinet;
		    expect(threeDBacksplashSegments([base], [], room, "standard", 2.5)).toEqual([
		      { side: "top", start: 12, end: 42, bottom: 38.5, top: 54 },
	    ]);
	    expect(threeDBacksplashTileTextureTransform({ side: "top", start: 0, end: 120, bottom: 38.5, top: 54 })).toMatchObject({ repeatX: 10, repeatY: 15.5 / 12 });
		    expect(threeDCountertopUpstandSegments([base], [], room, 2.5)).toEqual([
		      { side: "top", start: 12, end: 42, bottom: 36, top: 38.5 },
	    ]);
		    expect(threeDBacksplashSegments([base], [], room, "standard", 3)).toEqual([
		      { side: "top", start: 12, end: 42, bottom: 39, top: 54 },
	    ]);
		    expect(threeDCountertopUpstandSegments([base], [], room, 3)).toEqual([
		      { side: "top", start: 12, end: 42, bottom: 36, top: 39 },
	    ]);
	  });

  it("keeps an explicitly empty designer room authoritative after Clear Design instead of rendering catalog suggestions", () => {
    const empty = { placed: [], openings: [], sinks: [], island: null, furniture: [], ponyWalls: [] };
    expect(threeDUsesAuthoritativePlanScene({ width: 144, depth: 120 }, empty)).toBe(true);
    expect(threeDUsesAuthoritativePlanScene(undefined, empty)).toBe(false);
  });

	  it("routes a normal 3D catalog choice without coordinates so DesignTool can place it next in line, while retaining explicit drag/drop coordinates", () => {
	    const rendererSource = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
	    expect(rendererSource).toContain("onAddCatalogItem?.(item); setWorkspacePanel(null);");
	    expect(rendererSource).toContain("onAddCatalogItem?.(item, catalogDropTargetAtPoint(event.clientX, event.clientY), event.shiftKey)");
	  });

  it("does not emit the full active-scene mesh payload as a console error", () => {
    const rendererSource = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(rendererSource).not.toContain("ACTIVE-3D-SCENE-MESHES");
  });

	  it("keeps the selected 3D cabinet stable while the pointer moves and only selects on a click or context action", () => {
    expect(threeDPointerSelectsCabinet("move")).toBe(false);
    expect(threeDPointerSelectsCabinet("up", 5)).toBe(true);
    expect(threeDPointerSelectsCabinet("up", 6)).toBe(false);
    expect(threeDPointerSelectsCabinet("context")).toBe(true);
    expect(threeDRightPointerGesture(2, 5, true)).toBe("context");
    expect(threeDRightPointerGesture(2, 6, true)).toBe("drag");
    expect(threeDRightPointerGesture(0, 20, true)).toBe("none");
	    expect(threeDRightPointerGesture(2, 20, false)).toBe("none");
	  });

	  it("opens window attributes on a stationary mobile tap without treating a swipe as a tap", () => {
	    expect(threeDTouchTapOpensWindow("touch", 5, "window")).toBe(true);
	    expect(threeDTouchTapOpensWindow("pen", 0, "window")).toBe(true);
	    expect(threeDTouchTapOpensWindow("touch", 6, "window")).toBe(false);
	    expect(threeDTouchTapOpensWindow("touch", 0, "door")).toBe(false);
	    expect(threeDTouchTapOpensWindow("mouse", 0, "window")).toBe(false);
	    const rendererSource = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
	    expect(rendererSource).toContain("threeDTouchTapOpensWindow(event.pointerType, travelPx, openingSelection?.kind)");
	    expect(rendererSource).toContain("onOpenWindowEditor(openingSelection.uid)");
	  });

  it("opens Cabinet Attributes with the exact raycast placement UID on 3D right-click and double-click", () => {
    const rendererSource = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(rendererSource).toContain("if (selection?.uid && onOpenCabinetEditor)");
    expect(rendererSource).toContain("onOpenCabinetEditor(selection.uid)");
    expect(rendererSource).toContain("onDoubleClick={(event) => {");
    expect(rendererSource).toContain("const selection = inspectCabinetAtPoint(event.clientX, event.clientY);");
  });

  it("opens Window Attributes with the exact saved opening UID before cabinet context handling", () => {
    const rendererSource = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    const designerSource = readFileSync(new URL("../../pages/DesignTool.tsx", import.meta.url), "utf8");
    expect(rendererSource).toContain('openingSelection?.kind === "window" && onOpenWindowEditor');
    expect(rendererSource).toContain("onSelectOpening?.(openingSelection.uid)");
    expect(rendererSource).toContain("onOpenWindowEditor(openingSelection.uid)");
    expect(designerSource).toContain("onOpenWindowEditor={openWindowAttributes}");
    expect(designerSource).toContain("<WindowAttributesDialog");
  });

  it("right-drags cabinets, panels, fillers, floor appliances, and range hoods through one shared measured wall path in every 3D renderer", () => {
    const rendererSource = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    const designerSource = readFileSync(new URL("../../pages/DesignTool.tsx", import.meta.url), "utf8");
    expect(rendererSource).toContain("onPointerMove={handleRoomPointerMove}");
	    expect(rendererSource).toContain("cabinetWallDragPreview(session.source, room, placed, openings, targetAlong, { disableSnapping: event.shiftKey })");
	    expect(rendererSource).toContain("!isWallRunDraggable(source, movementRoom)");
    expect(rendererSource).toContain("onMoveCabinetTo?.(session.uid, session.preview.candidate.x, session.preview.candidate.y, session.preview)");
    expect(rendererSource).toContain("updateRightDragGhost(session.source, preview, room)");
    expect(rendererSource).toContain("rightDragSnapGhost: true");
	    expect(rendererSource).not.toContain("applyRightDragVisual(session");
	    expect(rendererSource).toContain('data-testid="three-d-cabinet-drag-measurement"');
	    expect(rendererSource).toContain('data-testid="three-d-drag-remaining-line"');
	    expect(rendererSource).toContain('data-testid="three-d-drag-remaining-before"');
	    expect(rendererSource).toContain('data-testid="three-d-drag-remaining-after"');
	    expect(rendererSource).toContain("<ThreeDRemainingSpaceLine before={cabinetDragMeasurement.preview.fit.before} after={cabinetDragMeasurement.preview.fit.after} />");
	    expect(rendererSource).toContain("<ThreeDRemainingSpaceLine before={catalogDragMeasurement.fit.before} after={catalogDragMeasurement.fit.after} />");
	    expect(rendererSource).toContain('cabinetDragMeasurement.preview.freehand ? "Shift freehand position"');
	    expect(rendererSource).toContain("wallGapFreehandPreview(gaps, targetAlong, item.width)");
	    expect(rendererSource).toContain("Boolean(session.preview?.freehand) !== event.shiftKey");
	    expect(designerSource).toContain("strictPointerPlacement ? wallGapFreehandPreview(gaps, targetAlong, width) : null");
	    expect(designerSource).toContain("freehand ? undefined : dropTarget.placementUid");
    expect(designerSource.match(/onMoveCabinetTo=\{cabinetsLocked \? undefined : moveCabinetToFrom3D\}/g)).toHaveLength(2);
    expect(designerSource).toContain("rangeHoodPositionAdjusted: true");
    expect(designerSource).toContain("moveCabinet(uid, x, y, undefined, !automaticSnapping)");
    expect(designerSource).toContain("smallGapFillerOpportunityFromDragPreview(uid, preview)");
  });

  it("describes a valid right-drag release as exact edge contact with no gap or overlap", () => {
    const fit = { gap: { side: "top" as const, layer: "base" as const, start: 0, length: 109, center: 54.5, isStandardSize: false, isFillerSize: false }, containsTarget: true, requiredSpan: 15, availableSpan: 109, shortage: 0, snapStart: 94, snapEnd: 109, before: 94, after: 0, status: "valid" as const };
    expect(threeDCabinetWallDragText({ masterCode: "B-15" }, { wall: "top", fit, candidate: { masterCode: "B-15" } as never, snapped: true }))
      .toBe('B-15 · snap 94"–109" · touching next edge · 0" gap · 0" overlap');
  });

  it("describes a freely chosen valid right-drag position without claiming it snapped to an edge", () => {
    const fit = { gap: { side: "top" as const, layer: "base" as const, start: 0, length: 144, center: 72, isStandardSize: true, isFillerSize: false }, containsTarget: true, requiredSpan: 12, availableSpan: 144, shortage: 0, snapStart: 60, snapEnd: 72, before: 60, after: 72, status: "valid" as const };
    expect(threeDCabinetWallDragText({ masterCode: "B-12" }, { wall: "top", fit, candidate: { masterCode: "B-12" } as never, snapped: false }))
      .toBe('B-12 · position 60"–72" · left clearance 60" · right clearance 72" · 0" overlap');
  });

  it("positions the appliance snap ghost at the exact proposed 3D footprint and saved elevation", () => {
    const room = { width: 144, depth: 120, ceilingHeight: 96 };
    const ghost = threeDWallDragGhostBox({
      uid: "hood-ghost",
      cabinetId: 9301,
      masterCode: "HOOD-30",
      description: "30 inch Range Hood",
      placement: "appliance",
      x: 30,
      y: 0,
      width: 30,
      depth: 18,
      height: 18,
      mountBottom: 66,
      rotation: 0,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    }, room);

    expect(ghost.position).toEqual({ x: 3.75, y: 6.25, z: 0.75 });
    expect(ghost.size).toEqual({ width: 2.5, height: 1.5, depth: 1.5 });
  });

  it("wraps the embedded 3D action controls instead of allowing them to overlap", () => {
    expect(THREE_D_EMBEDDED_TOOLBAR_CLASS).toContain("flex-wrap");
    expect(THREE_D_EMBEDDED_TOOLBAR_CLASS).toContain("max-w-[calc(100%-1.5rem)]");
  });

  it("keeps the finished wall shell available from the embedded 3D toolbar", () => {
    const source = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(source).toContain('data-testid="three-d-room-context-toggle"');
    expect(source).toContain("Show the finished-thickness room walls and mitered corners");
    expect(source).toContain('aria-pressed={showRoomContext}');
  });

  it("builds the hybrid 2D reference from every saved item using the authoritative rotated footprint and opening geometry", () => {
    const model = hybridPlanUnderlayModel(
      { width: 120, depth: 96, ceilingHeight: 96 },
      [
        { uid: "base", cabinetId: 1, masterCode: "B-24", description: "Base", placement: "base", x: 0, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0, numberOfDoors: 1, numberOfDrawers: 0 },
        { uid: "wall", cabinetId: 2, masterCode: "WR3624", description: "Refrigerator wall", placement: "wall", x: 24, y: 0, width: 36, depth: 24, height: 24, rotation: 90, numberOfDoors: 2, numberOfDrawers: 0 },
        { uid: "appliance", cabinetId: 3, masterCode: "FRIDGE-36", description: "Refrigerator", placement: "appliance", x: 60, y: 0, width: 36, depth: 24, height: 70, rotation: 0, numberOfDoors: 2, numberOfDrawers: 0 },
      ],
      [{ uid: "window", kind: "window", label: "Window", side: "top", offset: 72, width: 30, height: 30, sill: 44 }],
    );

    expect(model.room).toEqual({ width: 120, depth: 96 });
    expect(model.cabinets.map((cabinet) => cabinet.uid)).toEqual(["base", "wall", "appliance"]);
    expect(model.cabinets[1]).toMatchObject({ masterCode: "WR3624", width: 24, depth: 36 });
    expect(model.openings).toEqual([{ uid: "window", kind: "window", side: "top", offset: 72, width: 30 }]);
  });

  it("uses a visual preview fade unless the user requests reduced motion", () => {
    expect(threeDPreviewFadeAllowed(false)).toBe(true);
    expect(threeDPreviewFadeAllowed(true)).toBe(false);
  });

  it("labels the current preview suggestion only when there is more than one choice", () => {
    expect(threeDTemporaryPreviewCounterText({ current: 2, total: 5 })).toBe("Suggestion 2 of 5");
    expect(threeDTemporaryPreviewCounterText({ current: 1, total: 1 })).toBeNull();
  });

  it("offers manual cart synchronization only when the current 3D order has cabinet lines", () => {
    expect(canSyncThreeDOrderToCart([])).toBe(false);
    expect(canSyncThreeDOrderToCart([{ id: "SB-33", label: "SB-33", quantity: 1, unitPrice: 572.25, lineTotal: 572.25 }])).toBe(true);
  });

  it("matches a selected 3D cabinet to its exact order line before falling back to master-code text search", () => {
    const pendingDuplicate = { id: "SB-33:pending", label: "SB-33", detail: '33" Sink Base Cabinet', quantity: 1, unitPrice: null, lineTotal: null, placementUids: ["old-sink"] };
    const pricedSelected = { id: "SB-33:priced", label: "SB-33", detail: '33" Sink Base Cabinet · Greek Villa', quantity: 1, unitPrice: 375.89, lineTotal: 375.89, placementUids: ["selected-sink"] };

    expect(threeDOrderLineForSelectedCabinet([pendingDuplicate, pricedSelected], { uid: "selected-sink", masterCode: "SB-33" }))
      .toBe(pricedSelected);
  });

  it("describes remaining active-wall space from the selected cabinet to its actual neighbors or wall edges", () => {
    expect(threeDWallClearanceText({ before: 9, after: 12, beforeIsCabinet: true, afterIsCabinet: false }))
      .toBe('Open space: 9" to previous cabinet · 1\' to wall edge');
    expect(threeDWallClearanceText(null)).toBeNull();
  });

  it("reports exact fit and true overlap in one-eighth-inch increments", () => {
    const base = { side: "top" as const, layer: "wall" as const, seated: true, requiredSpan: 36, start: 12, end: 48, wallLen: 96, availableStart: 12, availableEnd: 48, availableSpan: 36, before: 0, after: 0, shortage: 0, snapStart: 12, snapEnd: 48, snapBefore: 0, snapAfter: 0, beforeBoundary: "W1230", afterBoundary: "wall end" };
    expect(threeDWallFitGuideText({ ...base, leftOverlap: 0, rightOverlap: 0, status: "fits" }))
      .toBe('Used 36" · available opening 36" (W1230 to wall end) · snap target 12"–48" · left remaining 0" · right remaining 0" · 0" overlap');
    expect(threeDWallFitGuideText({ ...base, availableEnd: 47.875, availableSpan: 35.875, snapEnd: 47.875, leftOverlap: 0, rightOverlap: 0.125, status: "overlap" }))
      .toBe('Used 36" · available opening 35⅞" (W1230 to wall end) · right overlap ⅛" · valid snap target 12"–47⅞"');
    expect(threeDWallFitGuideText({ ...base, seated: false, leftOverlap: 0, rightOverlap: 0, status: "fits" }))
      .toBe('Placement guide: cabinet uses 36" · not seated on the top wall · snap to a wall to measure available space');
  });

  it("shows used, available, snap, and remaining space while dragging in 3D", () => {
    const gap = { side: "right" as const, layer: "wall" as const, start: 54, length: 36, center: 72, isStandardSize: true, isFillerSize: false };
    const fit = { gap, containsTarget: true, requiredSpan: 36, availableSpan: 36, shortage: 0, snapStart: 54, snapEnd: 90, before: 0, after: 0, status: "valid" as const };
    expect(threeDCatalogDragFitText({ masterCode: "W-36-24" }, fit)).toBe('W-36-24 uses 36" of 36" · snap 54"–90" · left 0" · right 0"');
  });

  it("shows the exact installed cut width for catalog fillers created from a measured gap", () => {
    expect(exactFittedFillerInches(2.25)).toBe('2¼"');
    expect(exactFittedFillerInches(2.5)).toBe('2½"');
    expect(threeDFittedFillerWidthText({
      masterCode: "BF-3",
      description: '3" x 34.5" Base Filler — cut to 2.5"',
      category: "Filler",
      subCategory: "Filler",
      width: 2.5,
    } as any)).toBe('Filler cut: 2½"');
    expect(threeDFittedFillerWidthText({
      masterCode: "B24",
      description: "24 inch Base Cabinet",
      category: "Base",
      subCategory: "Base",
      width: 24,
    } as any)).toBeNull();
  });

  it("consolidates fitted filler cuts and maximums into one grouped notice without hiding an over-maximum warning", () => {
    const entries = threeDFillerMeasurementNoticeEntries([
      { uid: "of330-left", masterCode: "OF330", description: '3" Filler Overlay — cut to 1"', category: "Accessory", subCategory: "Filler", nominalWidth: 2.875, width: 1, depth: 24 },
      { uid: "of330-right", masterCode: "OF330", description: '3" Filler Overlay — cut to 1"', category: "Accessory", subCategory: "Filler", nominalWidth: 2.875, width: 1, depth: 24 },
      { uid: "of335-over", masterCode: "OF335", description: '3" Filler Overlay — cut to 3½"', category: "Accessory", subCategory: "Filler", nominalWidth: 2.875, width: 3.5, depth: 24 },
    ] as any);

    expect(entries).toEqual([
      { masterCode: "OF330", installedWidth: 1, maximum: 2.875, over: false, quantity: 2 },
      { masterCode: "OF335", installedWidth: 3.5, maximum: 2.875, over: true, quantity: 1 },
    ]);

    const source = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(source).toContain('data-testid="three-d-filler-notice"');
    expect(source).not.toContain('data-testid="three-d-filler-measurement-labels"');
    expect(source).not.toContain("Filler measurements</p>");
  });

  it("uses every selected cabinet finish on structural surfaces, including texture-backed styles", () => {
    expect(threeDStructuralFinish("#4f5549", false)).toEqual({ color: "#4f5549", usesDoorSample: false });
    expect(threeDStructuralFinish("#C8A040", true)).toEqual({ color: "#ffffff", usesDoorSample: true });
  });

  it("crops the uninterrupted center finish from a door sample for sides and toe kicks without altering the framed door texture", () => {
    const selectedSample = new THREE.Texture();
    const side = new THREE.MeshStandardMaterial({ color: "#C8A040" });
    const toeKick = new THREE.MeshStandardMaterial({ color: "#C8A040" });
    side.userData = { selectedFinishSideSkin: true };
    toeKick.userData = { baseToeKick: true };

    const structuralSample = threeDStructuralSampleTexture(selectedSample);
    expect(structuralSample).not.toBe(selectedSample);
    expect(structuralSample.repeat.toArray()).toEqual([0.42, 0.42]);
    expect(structuralSample.offset.toArray()).toEqual([0.29, 0.29]);
    expect(selectedSample.repeat.toArray()).toEqual([1, 1]);
    expect(selectedSample.offset.toArray()).toEqual([0, 0]);

    const result = applyThreeDStructuralFinishMaterials([side, toeKick], "#C8A040", selectedSample);
    expect(result.color).toBe("#ffffff");
    expect(side.map).toBe(result.texture);
    expect(toeKick.map).toBe(result.texture);
    expect(side.color.getHexString()).toBe("ffffff");
    expect(toeKick.color.getHexString()).toBe("ffffff");
    expect(side.userData).toMatchObject({ selectedFinishSideSkin: true, selectedFinishStructuralSurface: true, usesDoorSample: true, usesDoorImage: true });
	    expect(toeKick.userData).toMatchObject({ baseToeKick: true, selectedFinishStructuralSurface: true, usesDoorSample: true, usesDoorImage: true });
	  });

	  it("keeps a curated Rustic Hickory center-grain asset intact instead of cropping or stretching it like a complete door photograph", () => {
	    const selectedGrain = new THREE.Texture();
	    selectedGrain.userData = { curatedCabinetFinish: true };
	    const structuralGrain = threeDStructuralSampleTexture(selectedGrain);
	    expect(structuralGrain).not.toBe(selectedGrain);
	    expect(structuralGrain.wrapS).toBe(THREE.RepeatWrapping);
	    expect(structuralGrain.wrapT).toBe(THREE.RepeatWrapping);
	    expect(structuralGrain.repeat.toArray()).toEqual([1, 1]);
	    expect(structuralGrain.offset.toArray()).toEqual([0, 0]);
	  });

	  it("gives each curated Hickory cabinet a stable, distinct source-grain crop without changing its vertical repeat", () => {
	    const hickory = "/manus-storage/rustic_hickory_vertical_grain_32d9e28a.webp";
	    const first = threeDCabinetGrainTransform("cab-hickory-a", hickory);
	    const firstAgain = threeDCabinetGrainTransform("cab-hickory-a", hickory);
	    const second = threeDCabinetGrainTransform("cab-hickory-b", hickory);
	    expect(first).toEqual(firstAgain);
	    expect(second).not.toEqual(first);
	    expect(first.offsetX).toBeGreaterThan(0);
	    expect(first.offsetX).toBeLessThan(1);
	    expect(first.offsetY).toBeGreaterThan(0);
	    expect(first.offsetY).toBeLessThan(1);
	  });

	  it("shares the owning cabinet's selected structural finish material with its crown molding", () => {
    const root = new THREE.Group();
    const cabinet = new THREE.Group();
    cabinet.userData = { placedUid: "wall-24" };
    const material = new THREE.MeshStandardMaterial({ color: "#ffffff", map: new THREE.Texture() });
    material.userData = { selectedFinishSideSkin: true, selectedFinishStructuralSurface: true, usesDoorSample: true };
    cabinet.add(new THREE.Mesh(new THREE.BoxGeometry(2, 3.5, 1), material));
    root.add(cabinet);

    addThreeDCrownMolding(root, [{
      uid: "wall-24", cabinetId: 24, masterCode: "W-24-42", description: "24 inch Wall Cabinet",
      placement: "wall", x: 0, y: 0, width: 24, depth: 12, height: 42, rotation: 0,
      mountBottom: 54, numberOfDoors: 2, numberOfDrawers: 0,
    }], { width: 144, depth: 120, ceilingHeight: 96 }, { "wall-24": "#C8A040" }, "#C8A040");

    const crown = root.children.find((node) => node.userData.crownMolding) as THREE.Mesh;
    expect(crown).toBeTruthy();
    expect(crown.material).toBe(material);
    expect(crown.userData).toMatchObject({ selectedFinishStructuralSurface: true, sharesOwnerCabinetFinishMaterial: true });
  });

  it("renders WBC-27-42's real three-inch face filler immediately left of its visible door and never renders its billing attachment twice", () => {
    const room = { width: 144, depth: 120, ceilingHeight: 96 } as never;
    const cabinet = {
      uid: "wbc-27-42-right", cabinetId: 2742, masterCode: "WBC-27-42", description: '27" Blind Corner Wall Cabinet',
      placement: "wall", x: 132, y: 18, width: 27, depth: 12, height: 42, mountBottom: 54, rotation: 90,
      numberOfDoors: 1, numberOfDrawers: 0, swing: "right", openingWidth: 12,
    } as never;
    const billingFiller = {
      uid: "wbc-f342", cabinetId: 342, masterCode: "F342", description: '3" × 42" Wall Filler — integrated left of WBC door',
      placement: "wall", x: 132, y: 18, width: 3, depth: 0, height: 42, mountBottom: 54, rotation: 90,
      numberOfDoors: 0, numberOfDrawers: 0, fillerPieceGroupId: "wbc-required-filler-wbc-27-42-right",
      fillerBillingRole: "primary", fillerTotalWidth: 3, fillerPlacementMode: "left", fillerForCabinetUid: "wbc-27-42-right",
      integratedWallBlindFiller: true,
    } as never;
    const root = new THREE.Group();
    addCabinet(root, existingCabinetSku(cabinet), null, {}, 144, 120, "#3f4d3f", "#f8f8f6", undefined, existingCabinetTransform(cabinet, room));
    let filler: THREE.Object3D | undefined;
    let door: THREE.Object3D | undefined;
    root.traverse((node) => {
      if (node.userData.wallBlindCornerIntegratedFiller) filler = node;
      if (node.userData.blindCornerExposedDoor) door = node;
    });
    expect(filler).toBeDefined();
    expect(door).toBeDefined();
    expect(filler!.position.x).toBeLessThan(door!.position.x);
    expect((filler as THREE.Mesh).geometry).toBeInstanceOf(THREE.BoxGeometry);
    expect(((filler as THREE.Mesh).geometry as THREE.BoxGeometry).parameters.width).toBeCloseTo(3 / 12 - 0.015, 6);
    expect(filler!.userData).toMatchObject({ immediatelyLeftOfDoor: true, integratedCatalogFillerWidthIn: 3, selectedFinishStructuralSurface: true });
    expect(shouldRenderSavedSceneCabinet(billingFiller, [cabinet, billingFiller])).toBe(false);
  });

  it("covers both exposed WDC returns with the selected finish so the right side cannot remain gray", () => {
    const wdc = {
      uid: "wdc-24-42", cabinetId: 2442, masterCode: "WDC2442", description: '24" Wall Diagonal Corner Cabinet',
      placement: "wall", x: 0, y: 0, width: 24, depth: 24, height: 42, mountBottom: 54, rotation: 0,
      numberOfDoors: 2, numberOfDrawers: 0, cornerType: "diagonal",
    } as never;
    const root = new THREE.Group();
    addCabinet(root, existingCabinetSku(wdc), null, {}, 144, 120, "#3f4d3f", "#f8f8f6", undefined, existingCabinetTransform(wdc, { width: 144, depth: 120, ceilingHeight: 96 } as never));
    const returns: THREE.Mesh[] = [];
    root.traverse((node) => { if (node.userData.diagonalCornerFinishedReturn) returns.push(node as THREE.Mesh); });
    expect(returns).toHaveLength(2);
    expect(returns.map((node) => node.userData.diagonalCornerFinishedReturn).sort()).toEqual(["left", "right"]);
    for (const side of returns) {
      expect(side.material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
      expect((side.material as THREE.MeshPhysicalMaterial).color.getHexString()).toBe("3f4d3f");
      expect((side.material as THREE.MeshPhysicalMaterial).roughness).toBeLessThanOrEqual(0.5);
      expect(side.userData).toMatchObject({ selectedFinishSideSkin: true, selectedFinishStructuralSurface: true });
    }
  });

  it("uses a shallow six-inch drawer by default for every standard base cabinet with drawers and doors", () => {
    expect(threeDDrawerZoneHeight({ availableHeight: 2.8, drawerCount: 1, doorCount: 2, hasConfiguredOpening: false, placement: "base" })).toBeCloseTo(0.5);
    expect(threeDDrawerZoneHeight({ availableHeight: 2.8, drawerCount: 1, doorCount: 2, configuredDrawerHeight: 0.75, hasConfiguredOpening: false, placement: "base" })).toBeCloseTo(0.75);
    expect(threeDDrawerZoneHeight({ availableHeight: 2.8, drawerCount: 1, doorCount: 2, hasConfiguredOpening: false, placement: "wall" })).toBeCloseTo(0.98);
  });

  it("uses one upper and one lower door for a two-door 18-inch pantry while preserving four-door pantries", () => {
    expect(threeDTallPantryDoorsPerRow({ numberOfDoors: 2, width: 18, doorOrientation: "stacked" })).toBe(1);
    expect(threeDTallPantryDoorsPerRow({ numberOfDoors: 4, width: 24 })).toBe(2);
    expect(threeDTallPantryDoorsPerRow({ numberOfDoors: null, width: 18 })).toBe(1);
  });

  it("does not overlay a stale catalog front visual over a verified tall-pantry door layout", () => {
    expect(threeDHasVerifiedDoorLayout({ numberOfDoors: 2, numberOfDrawers: 0, doorOrientation: "stacked", drawerLayout: null, layoutSpec: null })).toBe(true);
    expect(threeDHasVerifiedDoorLayout({ numberOfDoors: 0, numberOfDrawers: 0, doorOrientation: null, drawerLayout: null, layoutSpec: null })).toBe(false);
    expect(threeDHasVerifiedDoorLayout({ numberOfDoors: 0, numberOfDrawers: 0, doorOrientation: null, drawerLayout: null, layoutSpec: null, openingType: "middle" })).toBe(true);
    expect(threeDUsesCatalogFrontVisual({ hasCatalogFrontVisual: true, hasDoorSample: false, hasDoorTexture: false, specialtyKind: "standard", isRefrigeratorEndPanel: false, hasVerifiedDoorLayout: true })).toBe(false);
    expect(threeDUsesCatalogFrontVisual({ hasCatalogFrontVisual: true, hasDoorSample: false, hasDoorTexture: false, specialtyKind: "standard", isRefrigeratorEndPanel: false, hasVerifiedDoorLayout: false })).toBe(true);
  });

  it("keeps cabinet ends plain unless a decorative end treatment is explicitly selected", () => {
    expect(threeDDecorativeEndSides("none")).toEqual([]);
    expect(threeDDecorativeEndSides("left")).toEqual([-1]);
    expect(threeDDecorativeEndSides("right")).toEqual([1]);
    expect(threeDDecorativeEndSides("both")).toEqual([-1, 1]);
  });

  it("shows a host-selected W3024 in the 3D action card without requiring a second click", () => {
    const selected = threeDSelectionFromPlaced("w3024", [{ uid: "w3024", cabinetId: 1, masterCode: "W3024", description: "Bridge cabinet", placement: "wall", x: 0, y: 0, width: 30, height: 24, depth: 12, rotation: 0 }]);
    expect(selected).toMatchObject({ uid: "w3024", masterCode: "W3024" });
  });

  it("uses each placed cabinet's saved 2D finish before the design default", () => {
    const defaultFinish = "#f1eee7";
    const overrides = { upper: "#18334e", island: "#a87f33" };
    expect(resolvedPlacedCabinetFinish({ uid: "upper" }, overrides, defaultFinish)).toBe("#18334e");
    expect(resolvedPlacedCabinetFinish({ uid: "lower" }, overrides, defaultFinish)).toBe(defaultFinish);
    expect(resolvedPlacedCabinetFinish({ uid: "island" }, overrides, defaultFinish)).toBe("#a87f33");
  });

  it("uses each placed cabinet's saved plan door profile before the design default", () => {
    const planDefault = { doorStyle: "Shaker", doorPanelType: "Matching" };
    const profiles = { upper: { doorStyle: "Raised", doorPanelType: "Center panel" } };
    expect(resolvedPlacedCabinetDoorProfile({ uid: "upper" }, profiles, planDefault)).toEqual(profiles.upper);
    expect(resolvedPlacedCabinetDoorProfile({ uid: "lower" }, profiles, planDefault)).toEqual(planDefault);
  });

  it("uses an explicit cabinet style's admin door sample before the design default sample", () => {
    const samples = { upper: "https://cdn.example.com/explicit-style.jpg" };
    expect(resolvedPlacedCabinetDoorSampleUrl({ uid: "upper" }, samples, "https://cdn.example.com/default-style.jpg", true))
      .toBe("https://cdn.example.com/explicit-style.jpg");
    expect(resolvedPlacedCabinetDoorSampleUrl({ uid: "lower" }, samples, "https://cdn.example.com/default-style.jpg", true))
      .toBe("https://cdn.example.com/default-style.jpg");
  });

  it("keeps physical Shaker rails when a selected door sample supplies the finish", () => {
    // A sample is a material/profile reference, not a full cabinet-front mesh.
    // The rail-and-stile geometry must remain visible for painted Shaker doors
    // and drawers with or without a selected sample image.
    expect(threeDUsesPhysicalShakerRails("shaker", true)).toBe(true);
    expect(threeDUsesPhysicalShakerRails("shaker", false)).toBe(true);
    expect(threeDUsesPhysicalShakerRails("flat", true)).toBe(false);
  });

  it("uses a verified selected Door Style frame width for the 3D physical-frame fallback", () => {
    expect(threeDShakerRailThickness(24 / 12, 30 / 12, 1)).toBeCloseTo(1 / 12, 12);
    expect(threeDShakerRailThickness(24 / 12, 30 / 12, null)).toBeCloseTo(3 / 12, 12);
  });

  it("keeps a white Shaker cabinet's physical rails and drawer reveals without exposing a perimeter shadow beyond each face", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: 1,
      cabinetId: 1,
      placementUid: "white-shaker-face-seams",
      masterCode: "B30",
      description: "30 inch Base Cabinet",
      placementType: "base",
      width: 30,
      height: 34.5,
      depth: 24,
      mountBottom: 0,
      numberOfDoors: 2,
      numberOfDrawers: 1,
    }, null, {}, 144, 120, "#f8f8f6", "#f8f8f6", {
      doorStyle: "Shaker",
      doorPanelType: "shaker",
      railWidth: 3,
      stileWidth: 3,
    });

    const fronts: THREE.Mesh[] = [];
    const rails: THREE.Mesh[] = [];
    const faceShadows: THREE.Mesh[] = [];
    const drawerReveals: THREE.Mesh[] = [];
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.userData.cabinetFront) fronts.push(node);
      if (node.userData.physicalRail) rails.push(node);
      if (node.userData.cabinetFaceShadowGap) faceShadows.push(node);
      if (node.userData.cabinetDrawerReveal) drawerReveals.push(node);
    });

    expect(fronts.length).toBeGreaterThan(0);
    expect(rails.length).toBeGreaterThan(0);
    expect(rails.every((rail) => (rail.material as THREE.MeshStandardMaterial).color.getHexString() === "f8f8f6")).toBe(true);
    expect(faceShadows.length).toBeGreaterThan(0);
    expect(drawerReveals.length).toBeGreaterThan(0);
    for (const shadow of faceShadows) {
      const face = fronts.find((candidate) =>
        Math.abs(candidate.position.x - shadow.position.x) < 1e-9
        && Math.abs(candidate.position.y - shadow.position.y) < 1e-9,
      );
      expect(face).toBeDefined();
      const faceGeometry = face!.geometry as THREE.BoxGeometry;
      const shadowGeometry = shadow.geometry as THREE.BoxGeometry;
      // The backed recess may retain the selected profile's depth/shading, but
      // it must never extend past an opaque face as a black perimeter band.
      expect(shadowGeometry.parameters.width).toBeLessThanOrEqual(faceGeometry.parameters.width);
      expect(shadowGeometry.parameters.height).toBeLessThanOrEqual(faceGeometry.parameters.height);
    }
  });

  it("restores both white Shaker faces and physical rails when an affiliate's selected door sample fails to load", () => {
    let failTexture: (() => void) | null = null;
    const load = vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation(((_url, _onLoad, _onProgress, onError) => {
      const texture = new THREE.Texture();
      failTexture = () => onError?.(new Error("sample unavailable"));
      return texture;
    }) as THREE.TextureLoader["load"]);

    try {
      const root = new THREE.Group();
      addCabinet(root, {
        distributorSkuId: 1,
        cabinetId: 1,
        placementUid: "affiliate-white-shaker-fallback",
        masterCode: "B30",
        description: "30 inch Base Cabinet",
        placementType: "base",
        width: 30,
        height: 34.5,
        depth: 24,
        mountBottom: 0,
        numberOfDoors: 2,
        numberOfDrawers: 1,
      }, null, {}, 144, 120, "#f8f8f6", "#f8f8f6", {
        doorStyle: "Shaker",
        doorPanelType: "shaker",
        railWidth: 3,
        stileWidth: 3,
      }, undefined, "https://example.invalid/affiliate-door-sample.webp");

      expect(failTexture).not.toBeNull();
      failTexture?.();

      const selectedFinishMaterials: THREE.MeshStandardMaterial[] = [];
      root.traverse((node) => {
        if (!(node instanceof THREE.Mesh) || !(node.userData.cabinetFront || node.userData.physicalRail)) return;
        selectedFinishMaterials.push(node.material as THREE.MeshStandardMaterial);
      });
      expect(selectedFinishMaterials.length).toBeGreaterThan(0);
      expect(selectedFinishMaterials.every((material) => material.map === null && material.color.getHexString() === "f8f8f6")).toBe(true);
    } finally {
      load.mockRestore();
    }
  });

  it("uses an exact unlit material for supplied CabinetDealz door samples", () => {
    expect(threeDUsesExactDoorSampleMaterial(true)).toBe(true);
    expect(threeDUsesExactDoorSampleMaterial(false)).toBe(false);
  });

  it("keeps every 2D catalog group searchable without an arbitrary eight-item limit", () => {
    const catalog = [
      { id: 1, masterCode: "B-24", description: "Base cabinet", category: "Cabinet" as const, catalogGroup: "Base" as const },
      { id: 2, masterCode: "LS36", description: "Corner cabinet", category: "Cabinet" as const, catalogGroup: "Corner" as const },
      { id: 3, masterCode: "W-30", description: "Wall cabinet", category: "Cabinet" as const, catalogGroup: "Wall" as const },
      { id: 4, masterCode: "P-24", description: "Tall pantry", category: "Cabinet" as const, catalogGroup: "Tall" as const },
      { id: 5, masterCode: "RANGE-30", description: "Range", category: "Appliance" as const, catalogGroup: "Appliances" as const },
      { id: 6, masterCode: "TK-4", description: "Toe kick", category: "Accessory" as const, catalogGroup: "Accessories" as const },
      ...Array.from({ length: 12 }, (_, index) => ({ id: 20 + index, masterCode: `B-${index + 30}`, description: "Additional base cabinet", category: "Cabinet" as const, catalogGroup: "Base" as const })),
    ];
    expect(filteredThreeDCatalogItems(catalog, "All", "")).toHaveLength(18);
    expect(filteredThreeDCatalogItems(catalog, "Base", "")).toHaveLength(13);
    expect(filteredThreeDCatalogItems(catalog, "Tall", "pantry").map((item) => item.masterCode)).toEqual(["P-24"]);
    expect(filteredThreeDCatalogItems(catalog, "Base", "b2").map((item) => item.masterCode)).toContain("B-24");
  });

  it("keeps the Add from catalog category choices at a fixed visible touch height", () => {
    const source = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(source).toContain('data-testid="three-d-catalog-category-row"');
    expect(source).toContain('h-10 min-h-10 shrink-0 items-center');
    expect(source).toContain('overflow-x-auto overflow-y-hidden');
    expect(source).toContain('className={`h-8 shrink-0 rounded-md');
    expect(source).toContain('key={`${item.category}-${item.id}-${item.masterCode}-${index}`}');
  });

  it("resolves independently persisted back, left, right, and front wall heights", () => {
    const heights = resolvedThreeDWallHeights({
      width: 144,
      depth: 120,
      ceilingHeight: 96,
      wallCeilings: {
        top: { high: 108, low: 108 },
        right: { high: 84, low: 84 },
      },
    }, 96);
    expect(heights).toEqual({ top: 108, left: 96, right: 84, bottom: 96 });
  });

  it("preserves three wall heights when one independent wall changes", () => {
    const initial = { top: 108, left: 84, right: 120, bottom: 96 };
    expect(updatedThreeDWallHeights(initial, "bottom", 1)).toEqual({ top: 108, left: 84, right: 120, bottom: 1 });
    expect(updatedThreeDWallHeights(initial, "right", 72)).toEqual({ top: 108, left: 84, right: 72, bottom: 96 });
  });

  it("maps rectangular wall edges to the four independent height controls", () => {
    const room = { width: 144, depth: 120 };
    // The renderer stores plan-front as negative Three.js Z/Y coordinates.
    expect(threeDWallSideForEdge({ x: 0, y: 0 }, { x: 12, y: 0 }, room)).toBe("top");
    expect(threeDWallSideForEdge({ x: 12, y: 0 }, { x: 12, y: -10 }, room)).toBe("right");
    expect(threeDWallSideForEdge({ x: 12, y: -10 }, { x: 0, y: -10 }, room)).toBe("bottom");
    expect(threeDWallSideForEdge({ x: 0, y: -10 }, { x: 0, y: 0 }, room)).toBe("left");
  });

  it("binds each rectangular mesh edge directly to Back, Right, Front, and Left", () => {
    const room = { width: 144, depth: 120 };
    const edges = [
      [{ x: 0, y: 0 }, { x: 12, y: 0 }],
      [{ x: 12, y: 0 }, { x: 12, y: -10 }],
      [{ x: 12, y: -10 }, { x: 0, y: -10 }],
      [{ x: 0, y: -10 }, { x: 0, y: 0 }],
    ] as const;
    expect(edges.map(([start, end], index) => threeDWallSideForPolygonEdge(index, edges.length, start, end, room))).toEqual(["top", "right", "bottom", "left"]);
  });

  it("maps the stove and refrigerator run to Back and the sink run to Right", () => {
    const room = { width: 144, depth: 120 };
    const range = { uid: "range", masterCode: "RANGE-30", placement: "appliance", width: 30, depth: 24, height: 36, x: 42, y: 0, rotation: 0 } as any;
    const sinkBase = { uid: "sink", masterCode: "SB-36", placement: "base", width: 36, depth: 24, height: 34.5, x: 120, y: 42, rotation: 90 } as any;
    expect(threeDPlacedWall(range, room)).toBe("back");
    expect(threeDPlacedWall(sinkBase, room)).toBe("right");
  });

  it("preserves the exact 2D placement identity for a picked 3D cabinet group", () => {
    const placed = { uid: "placed-w3024", cabinetId: 3024, masterCode: "W3024", description: "Wall cabinet", placement: "wall", width: 30, depth: 12, height: 24, x: 42, y: 0, rotation: 0 } as any;
    const root = new THREE.Group();
    const sku = existingCabinetSku(placed);
    addCabinet(root, sku, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, existingCabinetTransform(placed, { width: 144, depth: 120, ceilingHeight: 96 }));
    expect(sku.placementUid).toBe("placed-w3024");
    expect(root.children[0]?.userData.placedUid).toBe("placed-w3024");
  });

  it("always exposes a selected cabinet description for the 3D attributes card", () => {
    expect(threeDSelectedCabinetDescription({ masterCode: "B-30", description: "30 inch double-door base cabinet" } as any)).toBe("30 inch double-door base cabinet");
    expect(threeDSelectedCabinetDescription({ masterCode: "B-30", description: null } as any)).toBe("B-30 cabinet");
  });

  it("describes installed scribe stock as a cabinet filler in the selected 3D card", () => {
    expect(threeDSelectedCabinetDescription({
      masterCode: "SCR",
      description: 'Scribe Molding - 96" — A front filler cut to 2¾" with 22.5° miter (forms 45° turn)',
      fillerPieceGroupId: "turn-1",
      fillerPlacementMode: "left",
    } as any)).toBe('Filler — A front filler cut to 2¾" with 22.5° miter (forms 45° turn)');
  });

  it("labels refrigerator measurements as optional selected parts rather than a grouped bay", () => {
    const rendererSource = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(rendererSource).toContain("Refrigerator dimensions · selected parts");
    expect(rendererSource).not.toContain("Refrigerator bay · source geometry");
  });

  it("docks selected-cabinet details below the 3D drawing instead of overlaying its controls", () => {
    const className = threeDSelectedCabinetDockClass();
    expect(className).toContain("mt-1");
    expect(className).toContain("w-full");
	  expect(className).toContain("max-h-[min(18dvh,132px)]");
	  expect(className).toContain("overflow-y-auto");
	  expect(className).toContain("overscroll-contain");
	    expect(className).toContain("px-2");
     expect(className).toContain("py-1");
	    expect(className).toContain("text-[11px]");
    expect(className).not.toContain("p-3");
    expect(className).not.toContain("absolute");
  });

	  it("keeps cabinet summary, measurements, actions, and touch movement readable without duplicate 3D controls", () => {
	    const rendererSource = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
	    const designerSource = readFileSync(new URL("../../pages/DesignTool.tsx", import.meta.url), "utf8");
	    expect(rendererSource).toContain('data-testid="three-d-cabinet-summary"');
	    expect(rendererSource).toContain('data-testid="three-d-cabinet-measurement-grid"');
	    expect(rendererSource).toContain("sm:grid-cols-4");
	    expect(rendererSource).toContain('data-testid="three-d-cabinet-actions"');
	    expect(rendererSource).toContain("overflow-x-auto");
	    expect(rendererSource).toContain('data-testid="three-d-selected-cabinet-dpad"');
	    expect(rendererSource).not.toContain('data-testid="three-d-selected-cabinet-dpad" aria-label="Move selected cabinet" onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()} className="flex shrink-0 items-end justify-start gap-1 rounded border bg-muted/30 p-0.5 md:justify-center lg:hidden"');
	    expect(designerSource).toContain('selectedUid && !cabinetsLocked && !measureMode && viewMode === "plan"');
	    expect(designerSource).toContain('data-testid="plan-selected-cabinet-dpad"');
		    const up = rendererSource.indexOf('testId="three-d-move-up"');
		    const left = rendererSource.indexOf('testId="three-d-move-left"');
		    const right = rendererSource.indexOf('testId="three-d-move-right"');
		    const down = rendererSource.indexOf('testId="three-d-move-down"');
	    expect(up).toBeGreaterThan(-1);
	    expect(up).toBeLessThan(left);
	    expect(left).toBeLessThan(right);
	    expect(right).toBeLessThan(down);
		    expect(rendererSource).toContain('direction="up" onMove={requestCabinetMove}');
		    expect(rendererSource).toContain('direction="down" onMove={requestCabinetMove}');
	    expect(rendererSource).toContain('direction="left" onMove={requestCabinetMove}');
	    expect(rendererSource).toContain('direction="right" onMove={requestCabinetMove}');
	    expect(rendererSource).toContain('className="grid grid-cols-3 gap-0.5"');
	    expect(rendererSource).not.toContain('max-md:[&>span]:hidden md:grid-cols-3');
	  });

  it("walks from a decorative 3D face to the placed cabinet root for description and Edit Config identity", () => {
    const root = new THREE.Group();
    root.userData = { placedUid: "placed-b30", label: "30 inch double-door base cabinet", distributorSkuId: 930030 };
    const cabinetGroup = new THREE.Group();
    cabinetGroup.userData = { masterCode: "B-30" };
    const face = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    face.userData = { masterCode: "B-30" };
    root.add(cabinetGroup);
    cabinetGroup.add(face);

    expect(threeDCabinetHitFromObject(face)).toEqual({
      uid: "placed-b30",
      masterCode: "B-30",
      description: "30 inch double-door base cabinet",
      distributorSkuId: 930030,
    });
  });

  it("resolves a BER36 corner child mesh to the exact saved placement UID used by right-click attributes", () => {
    const berRoot = new THREE.Group();
    berRoot.userData = { placedUid: "placed-ber36", masterCode: "BER36", label: "36-inch Base Easy Reach corner cabinet", distributorSkuId: 936036 };
    const clippedCornerBody = new THREE.Group();
    clippedCornerBody.userData = { cornerGeometryKind: "l-corner" };
    const visibleDoor = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    berRoot.add(clippedCornerBody);
    clippedCornerBody.add(visibleDoor);

    expect(threeDCabinetHitFromObject(visibleDoor)).toEqual({
      uid: "placed-ber36",
      masterCode: "BER36",
      description: "36-inch Base Easy Reach corner cabinet",
      distributorSkuId: 936036,
    });
  });

  it("resolves a visible 3D window child mesh to its exact saved opening UID", () => {
    const windowRoot = new THREE.Group();
    windowRoot.userData = { openingUid: "window-42", kind: "window", label: "Kitchen window" };
    const frame = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.1));
    windowRoot.add(frame);
    frame.add(glass);

    expect(threeDOpeningHitFromObject(glass)).toEqual({
      uid: "window-42",
      kind: "window",
      label: "Kitchen window",
    });
    expect(threeDOpeningHitFromIntersections([
      { object: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)) },
      { object: glass },
    ])).toEqual({ uid: "window-42", kind: "window", label: "Kitchen window" });

    const visibleCabinet = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    applyThreeDPlacementIdentity(visibleCabinet, { uid: "cabinet-in-front", masterCode: "W-30-42" });
    expect(threeDOpeningHitFromIntersections([
      { object: visibleCabinet },
      { object: glass },
    ])).toBeNull();
  });

  it("skips untagged room geometry and resolves the visible BER36 countertop to its exact placement UID", () => {
    const roomSurface = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const berCountertop = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 3));
    applyThreeDPlacementIdentity(berCountertop, {
      uid: "placed-ber36",
      masterCode: "BER36",
      description: "36-inch Base Easy Reach corner cabinet",
      distributorSkuId: 936036,
    });

    expect(threeDCabinetHitFromIntersections([
      { object: roomSurface },
      { object: berCountertop },
    ])).toEqual({
      uid: "placed-ber36",
      masterCode: "BER36",
      description: "36-inch Base Easy Reach corner cabinet",
      distributorSkuId: 936036,
    });
  });

  it("prioritizes a visible ERB36 operating door over an adjacent cabinet skin when resolving right-click selection", () => {
    const adjacent = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    applyThreeDPlacementIdentity(adjacent, {
      uid: "placed-b24-left",
      masterCode: "B-24",
      description: "24 inch base cabinet",
      distributorSkuId: 924,
    });
    const erbRoot = new THREE.Group();
    erbRoot.userData = {
      placedUid: "placed-erb36",
      masterCode: "ERB-36",
      label: "Easy Reach Corner Base",
      distributorSkuId: 936,
    };
    const erbDoor = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.05));
    erbDoor.userData = { lCornerDoor: "side-leg", cabinetFront: true };
    erbRoot.add(erbDoor);

    expect(threeDCabinetSelectionPriority(adjacent)).toBe(0);
    expect(threeDCabinetSelectionPriority(erbDoor)).toBe(30);
    expect(threeDCabinetHitFromIntersections([
      { object: adjacent },
      { object: erbDoor },
    ])).toMatchObject({ uid: "placed-erb36", masterCode: "ERB-36" });
  });

  it("projects an explicit catalog drop onto the active Right wall instead of the floor", () => {
    const plane = threeDCatalogDropPlane("right", { width: 120, depth: 96 });
    const ray = new THREE.Ray(new THREE.Vector3(0, 4, 4), new THREE.Vector3(1, 0, 0));
    const hit = ray.intersectPlane(plane, new THREE.Vector3());
    expect(hit?.x).toBeCloseTo(10);
    expect(hit?.z).toBeCloseTo(4);
  });

  it("uses the visible Aspin sink-run placement hit instead of a perspective-shifted back-wall projection", () => {
    const untaggedSink = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const taggedCountertop = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 2));
    applyThreeDPlacementIdentity(taggedCountertop, {
      uid: "aspin-sb36",
      masterCode: "SB-36",
      description: "36-inch Sink Base Cabinet",
      distributorSkuId: 9390064,
    });

    const target = threeDCatalogDropTargetFromIntersections(
      [
        { object: untaggedSink, point: new THREE.Vector3(6, 1, 1.5) },
        { object: taggedCountertop, point: new THREE.Vector3(72 * 0.0833333333, 1, 1.5) },
      ],
      new THREE.Vector3(42 * 0.0833333333, 1, 0),
      { width: 144, depth: 145 },
    );

    expect(target.x).toBeCloseTo(72);
    expect(target.y).toBeCloseTo(18);
    expect(target.placementUid).toBe("aspin-sb36");
  });

  it("retains the active-wall plane target when the drop ray crosses no saved placement geometry", () => {
    const wallSurface = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    expect(threeDCatalogDropTargetFromIntersections(
      [{ object: wallSurface, point: new THREE.Vector3(9, 2, 0) }],
      new THREE.Vector3(54 * 0.0833333333, 2, 0),
      { width: 144, depth: 145 },
    )).toMatchObject({ x: expect.closeTo(54), y: 0 });
  });

  it("uses the physical wall behind the visible drop instead of a stale toolbar wall", () => {
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    rightWall.userData = { roomWall: true, physicalWallSide: "right" };
    const child = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    rightWall.add(child);
    expect(threeDRoomWallSideFromObject(child)).toBe("right");
    expect(threeDCatalogDropTargetFromIntersections([{ object: child, point: new THREE.Vector3(10, 2, 6) }], new THREE.Vector3(10, 2, 6), { width: 144, depth: 145 }, "top")).toMatchObject({ wall: "right", y: expect.closeTo(72) });
  });

  it("passes the active wall into every DesignTool 3D renderer for direct-drop projection", () => {
    const designToolSource = readFileSync(new URL("../../pages/DesignTool.tsx", import.meta.url), "utf8");
    expect(designToolSource.match(/catalogDropWall=\{activeWall\}/g)).toHaveLength(2);
    expect(designToolSource.match(/catalogDragItem=\{interactive3dCatalogDragItem\}/g)).toHaveLength(2);
	    expect(designToolSource).toContain("const dropWall = strictPointerPlacement ? (dropTarget.wall ?? activeWall) : activeWall");
    expect(designToolSource).toContain("targetedSinkBaseForThreeDDrop(placed, dropTarget, room)");
  });

  it("keeps catalog additions available while rendering an existing saved 2D plan", () => {
    expect(shouldShowThreeDCatalog([{ id: 30, masterCode: "B-30", description: "Base cabinet", category: "Cabinet" }])).toBe(true);
    expect(shouldShowThreeDCatalog([])).toBe(false);
  });

  it("keeps every capability behind the compact canvas-first 3D action bar", () => {
    expect(THREE_D_WORKSPACE_ACTIONS).toEqual(["catalog", "view", "finish", "room", "output"]);
  });

  it("keeps the complete active 2D catalog accessible through the matching 3D category groups and search", () => {
    const items = [
      { id: 1, masterCode: "B-30", description: "Base cabinet", category: "Cabinet" as const, catalogGroup: "Base" as const },
      { id: 2, masterCode: "W-30", description: "Wall cabinet", category: "Cabinet" as const, catalogGroup: "Wall" as const },
      { id: 3, masterCode: "T-84", description: "Tall pantry", category: "Cabinet" as const, catalogGroup: "Tall" as const },
      { id: 4, masterCode: "RANGE-30", description: "Gas range", category: "Appliance" as const, catalogGroup: "Appliances" as const },
    ];
    expect(filteredThreeDCatalogItems(items, "All", "")).toHaveLength(4);
    expect(filteredThreeDCatalogItems(items, "Wall", "")).toEqual([items[1]]);
    expect(filteredThreeDCatalogItems(items, "All", "pantry")).toEqual([items[2]]);
  });


  it("requires a 96-inch wall behind upper runs on the Back and Right walls", () => {
    const room = { width: 144, depth: 120 } as any;
    const backUpper = { uid: "back-upper", masterCode: "W-30", placement: "wall", width: 30, depth: 12, height: 30, x: 42, y: 0, rotation: 0 } as any;
    const rightUpper = { uid: "right-upper", masterCode: "W-30", placement: "wall", width: 30, depth: 12, height: 30, x: 132, y: 42, rotation: 90 } as any;
    expect(threeDUpperCabinetWallMinimums([backUpper, rightUpper], room)).toEqual({ top: 96, right: 96 });
  });

  it("keeps the mobile orbit camera outside a room-scaled furnished envelope", () => {
    expect(threeDCameraDistanceLimits(12).minDistance).toBeCloseTo(6.6, 12);
    expect(threeDCameraDistanceLimits(12).maxDistance).toBeCloseTo(40.8, 12);
    expect(threeDCameraDistanceLimits(8).minDistance).toBe(5.5);
  });

  it("provides bounded button zoom and distance-scaled pan steps for close hardware inspection", () => {
    const limits = threeDCameraDistanceLimits(12);
    expect(THREE_D_VIEWER_ZOOM_FACTOR).toBeCloseTo(0.76, 12);
    expect(threeDViewerZoomDistance(12, limits, "in")).toBeCloseTo(9.12, 12);
    expect(threeDViewerZoomDistance(limits.minDistance, limits, "in")).toBe(limits.minDistance);
    expect(threeDViewerZoomDistance(limits.maxDistance, limits, "out")).toBe(limits.maxDistance);
    expect(threeDViewerPanStep(1)).toBeCloseTo(0.35, 12);
    expect(threeDViewerPanStep(6.6)).toBeCloseTo(0.792, 12);
    expect(threeDViewerPanStep(40.8)).toBeCloseTo(1.2, 12);
  });

  it("renders accessible zoom, pan, and reset controls without replacing existing orbit, pinch, selection, or cabinet-move gestures", () => {
    const rendererSource = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(rendererSource).toContain('testId = "three-d-viewer-navigation"');
    expect(rendererSource).toContain('data-testid="three-d-mobile-navigation-launcher"');
    expect(rendererSource).toContain('data-testid="three-d-mobile-navigation-popup"');
    expect(rendererSource).toContain('h-[0.5in] w-[0.5in]');
    expect(rendererSource).toContain('className="absolute bottom-3 right-3 z-20 hidden sm:flex"');
    expect(rendererSource).toContain('data-testid="three-d-zoom-in"');
    expect(rendererSource).toContain('data-testid="three-d-zoom-out"');
    expect(rendererSource).toContain('data-testid="three-d-reset-view"');
    expect(rendererSource).toContain('data-testid="three-d-pan-up"');
    expect(rendererSource).toContain('data-testid="three-d-pan-down"');
    expect(rendererSource).toContain('data-testid="three-d-pan-left"');
    expect(rendererSource).toContain('data-testid="three-d-pan-right"');
    expect(rendererSource).toContain('onClick={() => onZoom("in")}');
    expect(rendererSource).toContain('onClick={() => onPan("left")}');
    expect(rendererSource).toContain('onClick={onReset}');
    expect(rendererSource).toContain('Pinch or scroll to zoom');
    expect(rendererSource).toContain('onPointerMove={handleRoomPointerMove}');
    expect(rendererSource).toContain('data-testid="three-d-selected-cabinet-dpad"');
    expect(rendererSource.match(/data-testid="three-d-selected-cabinet-dpad"/g)).toHaveLength(1);
    const detailsIndex = rendererSource.indexOf('data-testid="three-d-cabinet-attributes"');
    const dpadIndex = rendererSource.indexOf('data-testid="three-d-selected-cabinet-dpad"');
    const dpadOpeningTag = rendererSource.slice(dpadIndex, dpadIndex + 500);
    expect(dpadIndex).toBeGreaterThan(detailsIndex);
    expect(dpadOpeningTag).not.toContain("lg:hidden");
    expect(dpadOpeningTag).toContain('aria-label="Move selected cabinet"');
    expect(rendererSource).not.toContain('⅛&quot; precision');
	    expect(rendererSource.match(/0&quot; overlap required/g)?.length).toBeGreaterThanOrEqual(2);
	    expect(rendererSource).toContain('Placement · 0&quot; overlap');
  });

  it("provides distinct stable camera presets for clear 3D review", () => {
    const presentation = threeDCameraPresetPosition("presentation", 12);
    const front = threeDCameraPresetPosition("front", 12);
    const wide = threeDCameraPresetPosition("wide", 12);
    const detail = threeDCameraPresetPosition("detail", 12);
    expect(presentation.x).toBeCloseTo(13.8, 10);
    expect(presentation.y).toBeCloseTo(11.04, 10);
    expect(presentation.z).toBeCloseTo(15, 10);
    expect(front.z).toBeGreaterThan(presentation.z);
    expect(wide.y).toBeGreaterThan(presentation.y);
    expect(detail.length()).toBeLessThan(presentation.length());
  });

  it("preserves the exact camera view across cabinet moves but not explicit reset or preset changes", () => {
    const snapshot = { preset: "presentation" as const, resetKey: 4 };
    expect(threeDShouldRestoreCameraView(snapshot, "presentation", 4)).toBe(true);
    expect(threeDShouldRestoreCameraView(snapshot, "presentation", 5)).toBe(false);
    expect(threeDShouldRestoreCameraView(snapshot, "front", 4)).toBe(false);
  });

  it("reframes a newly applied measured room instead of restoring the previous room's distant orbit", () => {
    const previousRoom = { width: 120, depth: 120, openWallPath: false, vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 120, y: 0 }, { id: "c", x: 120, y: 120 }] } as RoomData;
    const appliedRoom = { width: 160, depth: 96, openWallPath: true, vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 160, y: 0 }, { id: "c", x: 160, y: 96 }] } as RoomData;
    const previousFrameKey = threeDCameraRoomFrameKey(previousRoom);
    const appliedFrameKey = threeDCameraRoomFrameKey(appliedRoom);
    const snapshot = { preset: "presentation" as const, resetKey: 4, roomFrameKey: previousFrameKey };

    expect(previousFrameKey).not.toBe(appliedFrameKey);
    expect(threeDShouldRestoreCameraView(snapshot, "presentation", 4, previousFrameKey)).toBe(true);
    expect(threeDShouldRestoreCameraView(snapshot, "presentation", 4, appliedFrameKey)).toBe(false);
  });

  it("captures the live viewpoint before every D-pad move and isolates the in-panel controls from orbit events", () => {
    const rendererSource = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    const moveStart = rendererSource.indexOf("const requestCabinetMove = (");
    const moveEnd = rendererSource.indexOf("const clearRightDragGhost", moveStart);
    const moveSource = rendererSource.slice(moveStart, moveEnd);
    const dpadStart = rendererSource.indexOf('data-testid="three-d-selected-cabinet-dpad"');
    const dpadEnd = rendererSource.indexOf('data-testid="three-d-cabinet-actions"', dpadStart);
    const dpadSource = rendererSource.slice(dpadStart, dpadEnd);

    expect(moveStart).toBeGreaterThan(-1);
    expect(moveSource).toContain("preserveCurrentCameraView();");
	    expect(moveSource.indexOf("preserveCurrentCameraView();")).toBeLessThan(moveSource.indexOf("onMoveCabinet("));
	    expect(moveSource).toContain("setAutoRotate(false);");
	    expect(moveSource).toContain("setCabinetMoveResult(onMoveCabinet(");
	    expect(rendererSource).toContain("controls.autoRotate = autoRotate;");
	    const rendererEffectEnd = rendererSource.indexOf("const downloadImage = () =>");
	    const rendererEffectTail = rendererSource.slice(Math.max(0, rendererEffectEnd - 1000), rendererEffectEnd);
	    expect(rendererEffectTail).not.toContain("renderExistingDesign, autoRotate, resetKey");
	    expect(dpadSource).toContain('data-ui-overlay="cabinet-move"');
	    expect(dpadSource).toContain("pointer-events-auto relative z-30");
		    expect(dpadSource).toContain("onWheelCapture={claimCabinetMoveControlEvent}");
		    expect(dpadSource).toContain("onContextMenu={claimCabinetMoveControlEvent}");
		    const arrowStart = rendererSource.indexOf("export function ThreeDCabinetMoveButton");
		    const arrowSource = rendererSource.slice(arrowStart, arrowStart + 1600);
		    expect(arrowSource).toContain("onPointerDownCapture={claimPointer}");
		    expect(arrowSource).toContain("event.preventDefault();");
		    expect(arrowSource).toContain("event.stopPropagation();");
		    expect(arrowSource).toContain("stopImmediatePropagation?.()");
		    expect(arrowSource).toContain("if (event.detail === 0) onMove(direction)");
		    expect(dpadSource).toContain("onPointerDown={stopCabinetMoveControlEvent}");
		    expect(dpadSource).toContain("onPointerUp={stopCabinetMoveControlEvent}");
	    expect(dpadSource).toContain("onClick={stopCabinetMoveControlEvent}");
	    expect(dpadSource).toContain('direction="up" onMove={requestCabinetMove}');
	    expect(dpadSource).toContain('direction="down" onMove={requestCabinetMove}');
		    expect(dpadSource).toContain('direction="left" onMove={requestCabinetMove}');
		    expect(dpadSource).toContain('direction="right" onMove={requestCabinetMove}');
	    expect(dpadSource).toContain('data-testid="three-d-cabinet-move-result"');
	  });

  it("captures the live orbit, target, and zoom before cabinet removal rebuilds the 3D scene", () => {
    const rendererSource = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    const preserveStart = rendererSource.indexOf("const preserveCurrentCameraView = () =>");
    const removeStart = rendererSource.indexOf('data-testid="three-d-remove-cabinet"');
    const removeEnd = rendererSource.indexOf("</button>", removeStart);
    const removeAction = rendererSource.slice(removeStart, removeEnd);

    expect(preserveStart).toBeGreaterThan(-1);
    expect(rendererSource.slice(preserveStart, removeStart)).toContain("cameraViewRef.current = {");
    expect(removeAction).toContain("preserveCurrentCameraView(); onRemoveCabinet(");
  });

  it("serializes, validates, and safely constrains a shared camera perspective without carrying plan data", () => {
    const view = { position: new THREE.Vector3(12.3456, 8.2, -4.05), target: new THREE.Vector3(6.5, 3.1, 2.25), zoom: 1.25 };
    const serialized = serializeThreeDCameraShareView(view);
    expect(THREE_D_CAMERA_VIEW_QUERY_PARAM).toBe("view");
    expect(serialized).toBe("1,12.346,8.200,-4.050,6.500,3.100,2.250,1.250");
    const parsed = parseThreeDCameraShareView(serialized);
    expect(parsed?.position.toArray()).toEqual([12.346, 8.2, -4.05]);
    expect(parsed?.target.toArray()).toEqual([6.5, 3.1, 2.25]);
    expect(parsed?.zoom).toBeCloseTo(1.25, 12);
    expect(parseThreeDCameraShareView("2,1,2,3,4,5,6,1")).toBeNull();
    expect(parseThreeDCameraShareView("1,1,2,3,4,5,6,0")).toBeNull();
    expect(parseThreeDCameraShareView("1,1001,2,3,4,5,6,1")).toBeNull();
    expect(serializeThreeDCameraShareView({ position: new THREE.Vector3(Number.NaN, 1, 1), target: new THREE.Vector3(0, 0, 0), zoom: 1 })).toBe("");

    const constrained = constrainedThreeDCameraShareView({ position: new THREE.Vector3(40, 0, 0), target: new THREE.Vector3(0, 0, 0), zoom: 3 }, { minDistance: 5.5, maxDistance: 14 });
    expect(constrained.position.distanceTo(constrained.target)).toBeCloseTo(14, 12);
    expect(constrained.zoom).toBe(2);
  });

  it("provides Share View beside the on-canvas navigation controls and appends only perspective state to the existing protected 3D link", () => {
    const rendererSource = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(rendererSource).toContain('data-testid="three-d-share-view"');
    expect(rendererSource).toContain('Share View');
    expect(rendererSource).toContain('await shareConfiguration(cameraView)');
    expect(rendererSource).toContain('window.location.pathname.startsWith("/3d/")');
    expect(rendererSource).toContain('url.searchParams.set(THREE_D_CAMERA_VIEW_QUERY_PARAM, serializedView)');
    expect(rendererSource).toContain('const url = new URL(`/api/shared-3d-view/${token}`, window.location.origin)');
    expect(rendererSource).toContain('sharedCameraViewRef.current = null');
  });

  it("confirms a copied Share View link while retaining native sharing and graceful clipboard-permission fallback", () => {
    const rendererSource = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    const shareUrlStart = rendererSource.indexOf("const shareUrl = async");
    const shareUrlEnd = rendererSource.indexOf("const shareConfiguration", shareUrlStart);
    const shareUrlSource = rendererSource.slice(shareUrlStart, shareUrlEnd);
    expect(shareUrlSource).toContain("await navigator.clipboard.writeText(url)");
    expect(shareUrlSource).toContain('toast.success("Link copied to clipboard.")');
    expect(shareUrlSource.indexOf("await navigator.clipboard.writeText(url)")).toBeLessThan(shareUrlSource.indexOf("if (navigator.share)"));
    expect(shareUrlSource).toContain("if (navigator.share)");
    expect(shareUrlSource).toContain("Native sharing remains available on devices where clipboard permission is denied.");
    expect(shareUrlSource).toContain('throw new Error("Clipboard access is unavailable.")');
  });

  it("captures only the current rendered camera perspective at compact social-card dimensions and sends it through the secure Share View mutation", () => {
    const rendererSource = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(rendererSource).toContain("const captureShareThumbnail = (): string | null");
    expect(rendererSource).toContain("const exportWidth = 640");
    expect(rendererSource).toContain("const exportHeight = 360");
    expect(rendererSource).toContain('renderer.domElement.toDataURL("image/jpeg", 0.82)');
    expect(rendererSource).toContain("renderer.setPixelRatio(currentPixelRatio)");
    expect(rendererSource).toContain("const thumbnailDataUrl = cameraView ? captureShareThumbnail() ?? undefined : undefined");
    expect(rendererSource).toContain("thumbnailDataUrl,");
    expect(rendererSource).toContain("trpc.roomLayouts.updateShareThumbnail.useMutation()");
    expect(rendererSource).toContain("await shareThumbnailMutation.mutateAsync({ token, thumbnailDataUrl })");
  });

	  it("maps selected-cabinet left and right arrows to the visible screen direction on every wall axis", () => {
    expect(threeDScreenHorizontalPlanDelta("top", "right", 1, { x: 0.8, z: -0.4 })).toEqual({ x: 1, y: 0 });
    expect(threeDScreenHorizontalPlanDelta("bottom", "left", 1, { x: 0.8, z: -0.4 })).toEqual({ x: -1, y: 0 });
    expect(threeDScreenHorizontalPlanDelta("left", "right", 0.25, { x: 0.8, z: -0.4 })).toEqual({ x: 0, y: -0.25 });
	    expect(threeDScreenHorizontalPlanDelta("right", "left", 0.25, { x: 0.8, z: -0.4 })).toEqual({ x: 0, y: 0.25 });
	  });

	  it("moves the rendered W-36-24 transform bottom by exactly one inch when the authoritative mount changes from 70 to 71", () => {
	    const room = { width: 144, depth: 120, ceilingHeight: 108 };
	    const cabinet = { uid: "live-w3624", masterCode: "W-36-24", description: "36-inch wall cabinet", placement: "wall", x: 60, y: 0, width: 36, depth: 12, height: 24, rotation: 0, mountBottom: 70, mountBottomAdjusted: true } as any;
	    const before = existingCabinetTransform(cabinet, room);
	    const after = existingCabinetTransform({ ...cabinet, mountBottom: 71 }, room);
	    const shiftedRight = existingCabinetTransform({ ...cabinet, x: 61 }, room);
	    expect(before.bottom).toBe(70);
	    expect(after.bottom).toBe(71);
	    expect(after.bottom - before.bottom).toBe(1);
	    expect(after.x).toBe(before.x);
	    expect(after.z).toBe(before.z);
	    expect(after.rotation).toBe(before.rotation);
	    expect(shiftedRight.x - before.x).toBe(1);

	    const beforeRoot = new THREE.Group();
	    const afterRoot = new THREE.Group();
	    const rightRoot = new THREE.Group();
	    addCabinet(beforeRoot, existingCabinetSku(cabinet), null, {}, room.width, room.depth, "#7e8d72", "#f8f8f6", undefined, before);
	    addCabinet(afterRoot, existingCabinetSku({ ...cabinet, mountBottom: 71 }), null, {}, room.width, room.depth, "#7e8d72", "#f8f8f6", undefined, after);
	    addCabinet(rightRoot, existingCabinetSku({ ...cabinet, x: 61 }), null, {}, room.width, room.depth, "#7e8d72", "#f8f8f6", undefined, shiftedRight);
	    expect(afterRoot.children[0]!.position.y - beforeRoot.children[0]!.position.y).toBeCloseTo(1 / 12, 12);
	    expect(rightRoot.children[0]!.position.x - beforeRoot.children[0]!.position.x).toBeCloseTo(1 / 12, 12);
	    expect(afterRoot.children[0]!.position.x).toBe(beforeRoot.children[0]!.position.x);
	    expect(afterRoot.children[0]!.position.z).toBe(beforeRoot.children[0]!.position.z);
	  });

	  it("renders the W3024 microwave bridge from 72 to 96 inches above the fixed 56-to-72 MW-30", () => {
	    const room = { width: 144, depth: 120, ceilingHeight: 96 };
	    const microwave = { uid: "mw-30", masterCode: "MW-30", description: "Over-Range Microwave 30", placement: "appliance", x: 42, y: 0, width: 30, depth: 15, height: 16, rotation: 0, mountBottom: 56 } as any;
	    const bridge = { uid: "bridge-w3024", masterCode: "W3024", description: "30 x 24 Wall Cabinet", placement: "wall", x: 42, y: 0, width: 30, depth: 12, height: 24, rotation: 0, mountBottom: 72, mountBottomAdjusted: true } as any;

	    const microwaveTransform = existingCabinetTransform(microwave, room);
	    const bridgeTransform = existingCabinetTransform(bridge, room);
	    expect(microwaveTransform.bottom).toBe(56);
	    expect(microwaveTransform.bottom + microwave.height).toBe(72);
	    expect(bridgeTransform.bottom).toBe(72);
	    expect(bridgeTransform.bottom + bridge.height).toBe(96);

	    const root = new THREE.Group();
	    addCabinet(root, existingCabinetSku(bridge), null, {}, room.width, room.depth, "#7e8d72", "#f8f8f6", undefined, bridgeTransform);
	    expect(root.children[0]!.position.y).toBeCloseTo(84 / 12, 12);
	  });

  it("accepts an editable movement amount at one-eighth-inch precision and bounds unsafe values", () => {
    expect(THREE_D_MIN_MOVE_INCREMENT_IN).toBe(0.125);
    expect(THREE_D_MAX_MOVE_INCREMENT_IN).toBe(24);
    expect(parsedThreeDCabinetMoveIncrement("1/2")).toBe(0.5);
    expect(parsedThreeDCabinetMoveIncrement("1 3/8")).toBe(1.375);
    expect(parsedThreeDCabinetMoveIncrement("2¾")).toBe(2.75);
    expect(parsedThreeDCabinetMoveIncrement('2.5"')).toBe(2.5);
    expect(normalizedThreeDCabinetMoveIncrement(2.625)).toBe(2.625);
    expect(normalizedThreeDCabinetMoveIncrement(2.68)).toBe(2.625);
    expect(normalizedThreeDCabinetMoveIncrement("1 5/16")).toBe(1.375);
    expect(normalizedThreeDCabinetMoveIncrement(0)).toBe(0.125);
    expect(normalizedThreeDCabinetMoveIncrement(200)).toBe(24);
    expect(normalizedThreeDCabinetMoveIncrement("bad")).toBe(1);
    const rendererSource = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(rendererSource).toContain('data-testid="three-d-move-increment"');
    expect(rendererSource).toContain('Move distance</span>');
    expect(rendererSource).toContain('type="text" inputMode="decimal"');
	    expect(rendererSource).toContain("setCabinetMoveResult(onMoveCabinet(selectedCabinet.uid, direction, moveIncrementIn, planDelta))");
	  });

  it("builds architectural trim, sill, muntins, door panels, and hardware for room openings", () => {
    const root = new THREE.Group();
    addWallOpening(root, { uid: "window-1", kind: "window", label: "Window", side: "back", offset: 24, width: 36, sill: 36, height: 42 } as never, 144, 120);
    addWallOpening(root, { uid: "door-1", kind: "door", label: "Door", side: "left", offset: 18, width: 30, sill: 0, height: 80 } as never, 144, 120);
    const details: string[] = [];
    root.traverse((node) => {
      if (node.userData.architecturalOpeningTrim) details.push("trim");
      if (node.userData.architecturalWindowSill) details.push("sill");
      if (node.userData.windowMuntin) details.push("muntin");
      if (node.userData.architecturalDoorPanel) details.push("door-panel");
      if (node.userData.architecturalDoorHandle) details.push("door-handle");
    });
    expect(details.filter((detail) => detail === "trim")).toHaveLength(8);
    expect(details).toEqual(expect.arrayContaining(["sill", "muntin", "door-panel", "door-handle"]));
  });

  it("reads seeded room dimensions while preserving safe defaults", () => {
    expect(dimensions({ width: 156, depth: 144, ceilingHeight: 96 })).toEqual({ width: 156, depth: 144, ceilingHeight: 96 });
    expect(dimensions({ width: 0 })).toEqual({ width: 144, depth: 120, ceilingHeight: 96 });
  });

  it("uses a verified hex style color before applying finish-name fallbacks", () => {
    expect(sceneCabinetColor({ ...baseScene, materials: { ...baseScene.materials!, cabinet: { ...baseScene.materials!.cabinet, color: "#1a2744" } } })).toBe("#1a2744");
    expect(sceneCabinetColor({ ...baseScene, materials: { ...baseScene.materials!, cabinet: { ...baseScene.materials!.cabinet, color: "Sage", finish: "Painted" } } })).toBe("#78826b");
    expect(sceneCabinetColor({ ...baseScene, materials: { ...baseScene.materials!, cabinet: { ...baseScene.materials!.cabinet, color: "Aero Sage (Preston)", finish: "Matching" } } })).toBe("#4f5549");
    expect(sceneCabinetColor({ ...baseScene, materials: { ...baseScene.materials!, cabinet: { ...baseScene.materials!.cabinet, color: "Designer Natural", finish: "Natural Maple" } } })).toBe("#d1ba8f");
  });

  it("constrains adjustable 3D wall height from one inch through ten feet", () => {
    expect(constrainedThreeDWallHeight(0)).toBe(1);
    expect(constrainedThreeDWallHeight(1)).toBe(1);
    expect(constrainedThreeDWallHeight(120)).toBe(120);
    expect(constrainedThreeDWallHeight(144)).toBe(120);
    expect(constrainedThreeDWallHeight("10.2")).toBe(10);
  });

  it("uses the active catalog door-style finish when scene metadata is sparse", () => {
    expect(resolvedCatalogFinish(baseScene, "#49604a")).toBe("#49604a");
    expect(resolvedCatalogFinish(baseScene, "Aero Sage")).toBe(sceneCabinetColor(baseScene));
  });

  it("uses the saved 2D countertop color unless a presentation-only 3D override is explicitly stored", () => {
    expect(resolvedThreeDCountertopFinish(undefined, "#2c2f33", baseScene)).toBe("#2c2f33");
    expect(resolvedThreeDCountertopFinish({ cabinetFinish: "catalog", countertopFinish: "#b9824a" }, "#2c2f33", baseScene)).toBe("#b9824a");
    expect(resolvedThreeDCountertopFinish(undefined, null, baseScene)).toBe("#e9e7e2");
  });

  it("does not re-emit an unchanged presentation back to the parent preview state", () => {
    const emitted = threeDPresentationEmissionKey("catalog", "#2c2f33");
    expect(shouldEmitThreeDPresentation(null, "catalog", "#2c2f33")).toBe(true);
    expect(shouldEmitThreeDPresentation(emitted, "catalog", "#2c2f33")).toBe(false);
    expect(shouldEmitThreeDPresentation(emitted, "#49604a", "#2c2f33")).toBe(true);
    expect(shouldEmitThreeDPresentation(emitted, "catalog", "#111111")).toBe(true);
  });

  it("carries the exact selected 2D door sample into catalog-finish 3D cabinet faces", () => {
    expect(resolvedThreeDDoorSampleUrl("catalog", "/manus-storage/silva-shaker.png")).toBe("/manus-storage/silva-shaker.png");
    expect(resolvedThreeDDoorSampleUrl("#75523e", "/manus-storage/silva-shaker.png")).toBeNull();
    expect(resolvedThreeDDoorSampleUrl("#75523e", "/manus-storage/silva-shaker.png", true)).toBe("/manus-storage/silva-shaker.png");
  });

  it("uses the supplied selected door sample without generic tinting", () => {
    expect(threeDUsesDoorSampleTexture("/manus-storage/silva.png")).toBe(true);
    expect(threeDUsesDoorSampleTexture(null)).toBe(false);
    expect(threeDFaceMaterialColor("#75523e", true)).toBe("#ffffff");
    expect(threeDFaceMaterialColor("#75523e", false)).toBe("#75523e");
  });

  it("uses supplied Cabinet Config visuals for cabinet fronts, never appliance or guessed visuals", () => {
    expect(threeDCabinetFrontVisualUrl({ placementType: "base", catalogImageUrl: "/manus-storage/b18.png" })).toBe("/manus-storage/b18.png");
    expect(threeDCabinetFrontVisualUrl({ placementType: "appliance", catalogImageUrl: "/manus-storage/range.png" })).toBeNull();
    expect(threeDCabinetFrontVisualUrl({ placementType: "base", catalogImageUrl: null })).toBeNull();
  });

  it("prefers the live Cabinet Config visual map when older saved placements omitted their product image", () => {
    expect(resolvedPlacedCabinetFrontVisual({ uid: "placed-b18" } as any, { "placed-b18": "/manus-storage/b18.png" }, null)).toBe("/manus-storage/b18.png");
    expect(resolvedPlacedCabinetFrontVisual({ uid: "placed-b18" } as any, undefined, "/manus-storage/fallback.png")).toBe("/manus-storage/fallback.png");
  });

  it("uses the active saved Shaker profile when a persisted room intentionally carries neutral material metadata", () => {
    expect(baseScene.materials?.cabinet.doorStyle).toBeNull();
    expect(resolvedThreeDDoorProfile(baseScene, { doorStyle: "Shaker", doorPanelType: null })).toEqual({
      doorStyle: "Shaker",
      doorPanelType: null,
    });
    expect(resolvedThreeDDoorProfile(baseScene, null)).toEqual(baseScene.materials?.cabinet);
  });

  it("keeps cabinet faces visibly calibrated when a selected 2D door image fails to load", () => {
    expect(threeDDoorMaterialFallback("#b8874e")).toEqual({ color: "#b8874e", map: null });
  });

  it("maps supplied original visuals to their supported 3D appliance fronts without assigning them to unrelated appliances", () => {
    expect(threeDApplianceFrontVisualUrl({ masterCode: "RANGE-30", catalogImageUrl: "/manus-storage/original-range.webp" }))
      .toBe("/manus-storage/original-range.webp");
    expect(threeDApplianceFrontVisualUrl({ masterCode: "HOOD-30", catalogImageUrl: "/manus-storage/original-hood.webp" }))
      .toBe("/manus-storage/original-hood.webp");
    expect(threeDApplianceFrontVisualUrl({ masterCode: "FRIDGE-36", catalogImageUrl: "/manus-storage/fridge.webp" }))
      .toBe("/manus-storage/fridge.webp");
    expect(threeDApplianceFrontVisualUrl({ masterCode: "DW-24", catalogImageUrl: "/manus-storage/dishwasher.webp" }))
      .toBe("/manus-storage/dishwasher.webp");
    expect(threeDApplianceFrontVisualUrl({ masterCode: "MW-30", catalogImageUrl: "/manus-storage/microwave.webp" }))
      .toBe("/manus-storage/microwave.webp");
    expect(threeDApplianceFrontVisualUrl({ masterCode: "WINE-24", catalogImageUrl: "/manus-storage/wine.webp" })).toBeNull();
  });

  it("adds original 3D visual fronts for non-range appliances without changing catalog envelopes or appliance mounting", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: 1, cabinetId: 1, masterCode: "RANGE-30", description: "30 inch range", placementType: "appliance",
      width: 30, height: 36, depth: 25, mountBottom: 0, numberOfDoors: 0, numberOfDrawers: 0,
      catalogImageUrl: "/manus-storage/original-range.webp",
    }, null, {}, 144, 120, "#6b7567", "#eeeeee");
    addCabinet(root, {
      distributorSkuId: 2, cabinetId: 2, masterCode: "HOOD-30", description: "30 inch hood", placementType: "appliance",
      width: 30, height: 18, depth: 18, mountBottom: 66, numberOfDoors: 0, numberOfDrawers: 0,
      catalogImageUrl: "/manus-storage/original-hood.webp",
    }, null, {}, 144, 120, "#6b7567", "#eeeeee");
    addCabinet(root, {
      distributorSkuId: 3, cabinetId: 3, masterCode: "FRIDGE-36", description: "36 inch refrigerator", placementType: "appliance",
      width: 36, height: 70, depth: 30, mountBottom: 0, numberOfDoors: 0, numberOfDrawers: 0,
      catalogImageUrl: "/manus-storage/original-fridge.webp",
    }, null, {}, 144, 120, "#6b7567", "#eeeeee");
    addCabinet(root, {
      distributorSkuId: 4, cabinetId: 4, masterCode: "DW-24", description: "24 inch dishwasher", placementType: "appliance",
      width: 24, height: 34.5, depth: 24, mountBottom: 0, numberOfDoors: 0, numberOfDrawers: 0,
      catalogImageUrl: "/manus-storage/original-dishwasher.webp",
    }, null, {}, 144, 120, "#6b7567", "#eeeeee");
    addCabinet(root, {
      distributorSkuId: 5, cabinetId: 5, masterCode: "MW-30", description: "30 inch over-range microwave", placementType: "appliance",
      width: 30, height: 17, depth: 15, mountBottom: 54, numberOfDoors: 0, numberOfDrawers: 0,
      catalogImageUrl: "/manus-storage/original-microwave.webp",
    }, null, {}, 144, 120, "#6b7567", "#eeeeee");
    const visualPlanes: THREE.Object3D[] = [];
    root.traverse((node) => { if (node.userData.originalProductVisual) visualPlanes.push(node); });

    expect(visualPlanes).toHaveLength(4);
    expect(visualPlanes.map((node) => node.userData.originalProductVisualUrl)).toEqual([
      "/manus-storage/original-hood.webp", "/manus-storage/original-fridge.webp",
      "/manus-storage/original-dishwasher.webp", "/manus-storage/original-microwave.webp",
    ]);
    expect(visualPlanes.map((node) => node.userData.catalogEnvelope)).toEqual([
      expect.objectContaining({ widthIn: 30, heightIn: 18, depthIn: 18, mountBottomIn: 66 }),
      expect.objectContaining({ widthIn: 36, heightIn: 70, depthIn: 30, mountBottomIn: 0 }),
      expect.objectContaining({ widthIn: 24, heightIn: 34.5, depthIn: 24, mountBottomIn: 0 }),
      expect.objectContaining({ widthIn: 30, heightIn: 17, depthIn: 15, mountBottomIn: 54 }),
    ]);
  });

  it("builds dimensional microwave and oven appliance bezels, displays, and door handles", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: 51, cabinetId: 51, masterCode: "MW-30", description: "30 inch over-range microwave", placementType: "appliance",
      width: 30, height: 17, depth: 15, mountBottom: 54, numberOfDoors: 0, numberOfDrawers: 0,
    }, null, {}, 144, 120, "#6b7567", "#eeeeee");
    addCabinet(root, {
      distributorSkuId: 52, cabinetId: 52, masterCode: "OVEN-30", description: "30 inch single oven", placementType: "appliance",
      width: 30, height: 28, depth: 24, mountBottom: 30, numberOfDoors: 0, numberOfDrawers: 0,
    }, null, {}, 144, 120, "#6b7567", "#eeeeee");
    const bezels: THREE.Object3D[] = [];
    const displays: string[] = [];
    const handles: string[] = [];
    root.traverse((node) => {
      if (node.userData.applianceBezel) bezels.push(node);
      if (node.userData.applianceDisplay) displays.push(node.userData.applianceDisplay);
      if (node.userData.applianceDoorHandle) handles.push(node.userData.applianceDoorHandle);
    });
    expect(bezels).toHaveLength(8);
    expect(displays).toEqual(expect.arrayContaining(["microwave", "oven"]));
    expect(handles).toEqual(expect.arrayContaining(["microwave", "oven"]));
  });

  it("renders a selected door sample as texture or calibrated fallback, never an unreported flat-face mode", () => {
    expect(threeDVisibleMaterialMode("/manus-storage/silva.png", "loading")).toBe("selected-texture-loading");
    expect(threeDVisibleMaterialMode("/manus-storage/silva.png", "loaded")).toBe("selected-texture");
    expect(threeDVisibleMaterialMode("/manus-storage/silva.png", "failed")).toBe("calibrated-fallback");
    expect(threeDVisibleMaterialMode(null, "not-requested")).toBe("calibrated-fallback");
  });

  it("renders an explicit visible material status rather than silently describing a selected sample as flat", () => {
    expect(threeDMaterialStatusText("selected-texture", "loaded")).toBe("Cabinet material: selected texture · Door sample texture: loaded");
    expect(threeDMaterialStatusText("calibrated-fallback", "failed")).toBe("Cabinet material: calibrated fallback · Door sample texture: failed");
    expect(threeDMaterialStatusText("calibrated-fallback", "failed")).not.toMatch(/flat/i);
  });

  it("renders placed 2D cabinets instead of starter suggestions whenever a design exists", () => {
    expect(shouldRenderPlacedDesign([])).toBe(false);
    expect(shouldRenderPlacedDesign([{ uid: "base-1" } as never])).toBe(true);
  });

  it("keeps a loaded 2D plan eligible for deterministic 3D rendering before a door style is selected", () => {
    expect(hasPersistedTwoDScene({
      placed: [{ uid: "base-1" } as never],
      openings: [],
      sinks: [],
      island: null,
      furniture: [],
      ponyWalls: [],
    })).toBe(true);
  });

	  it("orients every cabinet and appliance front toward the usable room side of its wall", () => {
    const room = { width: 144, depth: 120, ceilingHeight: 96 };
    const placedAt = (wall: "back" | "front" | "left" | "right", appliance = false) => ({
      uid: `${wall}-${appliance ? "appliance" : "cabinet"}`,
      cabinetId: 1,
      masterCode: appliance ? "FRIDGE-36" : "B-24",
      description: appliance ? "Refrigerator" : "Base cabinet",
      placement: appliance ? "appliance" : "base",
      x: wall === "left" ? 0 : wall === "right" ? 120 : 48,
      y: wall === "back" ? 0 : wall === "front" ? 96 : 36,
      width: wall === "left" || wall === "right" ? 24 : appliance ? 36 : 24,
      depth: wall === "left" || wall === "right" ? 24 : 24,
      height: appliance ? 70 : 34.5,
      rotation: 0,
    }) as never;
    const expected = { back: 0, front: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 };

    for (const wall of ["back", "front", "left", "right"] as const) {
      const cabinet = placedAt(wall);
      const appliance = placedAt(wall, true);
      expect(threeDPlacedWall(cabinet, room)).toBe(wall);
      expect(threeDRoomFacingRotation(cabinet, room)).toBeCloseTo(expected[wall], 12);
      expect(existingCabinetTransform(cabinet, room).rotation).toBeCloseTo(expected[wall], 12);
      expect(existingCabinetTransform(appliance, room).rotation).toBeCloseTo(expected[wall], 12);
	    }
	  });

		  it("honors explicit island-face ownership for outward-facing cabinets on all four island runs", () => {
	    const room = { width: 144, depth: 120, ceilingHeight: 96 };
	    const expected = { front: 0, back: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 };
	    for (const face of ["front", "back", "left", "right"] as const) {
	      const cabinet = {
	        uid: `island-${face}`,
	        cabinetId: 1,
	        masterCode: "B-24",
	        description: "Island base cabinet",
	        placement: "base",
	        x: 48,
	        y: 48,
	        width: 24,
	        depth: 24,
	        height: 34.5,
	        rotation: 0,
	        islandFace: face,
	        islandOffset: 0,
	      } as never;
	      expect(threeDRoomFacingRotation(cabinet, room)).toBeCloseTo(expected[face], 12);
		      expect(existingCabinetTransform(cabinet, room).rotation).toBeCloseTo(expected[face], 12);
		    }
		  });

		  it("renders a WFR2442 selected for an island at finished-floor elevation instead of the wall-cabinet mount line", () => {
		    const room = { width: 144, depth: 120, ceilingHeight: 96 };
		    const islandWallCabinet = {
		      uid: "mobile-island-wfr2442",
		      cabinetId: 2442,
		      masterCode: "WFR2442",
		      description: "24 inch double door wall cabinet with shelves",
		      placement: "wall",
		      x: 48,
		      y: 72,
		      width: 24,
		      depth: 12,
		      height: 42,
		      rotation: 0,
		      mountBottom: 54,
		      islandFace: "front",
		      islandOffset: 0,
		    } as never;
		    expect(existingCabinetTransform(islandWallCabinet, room)).toMatchObject({ bottom: 0, rotation: 0 });
		  });

	  it("uses the persisted 2D plan instead of starter suggestions for any saved entity, not only cabinets", () => {
    expect(hasPersistedTwoDScene({ placed: [], openings: [], sinks: [], island: null, furniture: [], ponyWalls: [] })).toBe(false);
    expect(hasPersistedTwoDScene({ placed: [], openings: [{ uid: "window" } as never], sinks: [], island: null, furniture: [], ponyWalls: [] })).toBe(true);
    expect(hasPersistedTwoDScene({ placed: [], openings: [], sinks: [], island: { x: 0, y: 0, width: 48, depth: 24 }, furniture: [], ponyWalls: [] })).toBe(true);
  });

  it("maps persisted island, pony-wall, and furniture coordinates into the same inch-based 3D positions", () => {
	    expect(islandZoneTransform({ x: 36, y: 48, width: 72, depth: 36 })).toMatchObject({
	      x: 6,
	      z: 5.5,
	      guideWidth: 6,
	      guideDepth: 3,
	    });
    expect(ponyWallTransform({ x: 12, y: 24, width: 48, depth: 6, height: 42 })).toEqual({
      x: 3,
      y: 1.75,
      z: 2.25,
      width: 4,
      depth: 0.5,
      height: 3.5,
      rotation: 0,
    });
    expect(furnitureTransform({ x: 24, y: 36, rotation: 90 } as never, 48, 30)).toEqual({
      x: 4,
      z: 4.25,
      rotation: Math.PI / 2,
    });
  });

  it("keeps a pony wall attached to the exact final 45-degree peninsula endpoint in 3D", () => {
    const primary = { id: "peninsula", parentWall: "top", startOffset: 72, turn: 90, direction: "right", length: 72, height: 34.5 } as const;
    const return45 = { id: "peninsula-45", parentRunId: primary.id, startOffset: 0, turn: 45, direction: "right", length: 36, height: 34.5 } as const;
    const room = { width: 180, depth: 180, peninsulaRuns: [primary, return45] } as never;
    const transform = ponyWallTransform({
      uid: "attached-pony",
      x: 0,
      y: 0,
      width: 24,
      depth: 6,
      height: 34.5,
      peninsulaRunId: return45.id,
      peninsulaEnd: "end",
    }, room);
    const endpoint = peninsulaRunEndpoints(return45 as never, room).end;

    expect(transform.x).toBeCloseTo((endpoint.x + Math.cos((3 * Math.PI) / 4) * 12) / 12, 8);
    expect(transform.z).toBeCloseTo((endpoint.y + Math.sin((3 * Math.PI) / 4) * 12) / 12, 8);
    expect(transform.rotation).toBeCloseTo((-3 * Math.PI) / 4, 8);
  });

  it("retains every persisted 2D entity alongside its deterministic 3D conversion contract", () => {
    const cabinet = {
      uid: "contract-base", cabinetId: 5, masterCode: "B-24", description: "Base Cabinet", placement: "base",
      x: 12, y: 24, width: 24, depth: 24, height: 34.5, rotation: 0, numberOfDoors: 2, numberOfDrawers: 1,
      customProfile: "standard_base", drawerLayout: JSON.stringify([{ count: 1, height: 6 }]), styleId: 330001,
    } as never;
    const snapshot = threeDDesignParitySnapshot({
      roomOverride: { width: 144, depth: 120, ceilingHeight: 96 },
      placed: [cabinet],
      openings: [{ uid: "window", kind: "window", label: "Window", side: "top", offset: 36, width: 30, height: 36, sill: 42 } as never],
      sinks: [{ uid: "sink", type: "single", x: 24, y: 48, width: 30, depth: 22, faucet: true } as never],
      island: { x: 36, y: 48, width: 72, depth: 36 },
      furniture: [{ uid: "unknown-furniture", defId: "unknown", x: 60, y: 60, rotation: 90 } as never],
      ponyWalls: [{ uid: "pony", x: 24, y: 36, width: 48, depth: 6, height: 42 } as never],
      catalogDoorSampleUrl: "/manus-storage/door-sample.png",
      catalogFinishOverride: "#f6f4ef",
      catalogFinishName: "Aspen White",
      catalogCountertopName: "Black Granite",
      catalogCountertopColor: "#2c2f33",
      initialPresentation: { cabinetFinish: "#f6f4ef", countertopFinish: "#2c2f33" },
    });

    expect(snapshot).toMatchObject({
      room: { width: 144, depth: 120, ceilingHeight: 96 },
      materials: {
        doorSampleUrl: "/manus-storage/door-sample.png",
        cabinetColor: "#f6f4ef",
        cabinetName: "Aspen White",
        countertopName: "Black Granite",
        countertopColor: "#2c2f33",
        presentation: { cabinetFinish: "#f6f4ef", countertopFinish: "#2c2f33" },
      },
      cabinets: [{ source: cabinet, footprint: { w: 24, d: 24 }, transform: { x: 24, z: 36, rotation: 0, bottom: 0 }, countertopSupported: true }],
      openings: [{ source: { uid: "window" }, transform: { x: 51, z: 0.06, rotation: 0 } }],
      sinks: [{ source: { uid: "sink" }, transform: { x: 3.25 } }],
      island: { source: { x: 36, y: 48, width: 72, depth: 36 }, transform: { x: 6, z: 5.5 } },
      furniture: [{ source: { uid: "unknown-furniture", rotation: 90 }, definition: null, transform: null }],
      ponyWalls: [{ source: { uid: "pony" }, transform: { x: 4, y: 1.75, z: 3.25 } }],
    });
    expect(snapshot.sinks[0]!.transform.z).toBeCloseTo(59 / 12, 12);
    expect(snapshot.cabinets[0]!.sku).toMatchObject({ masterCode: "B-24", numberOfDoors: 2, numberOfDrawers: 1, graphicType: "standard_base" });
  });

  it("locks the exact saved plan while allowing material-only photorealism inputs to change", () => {
    const cabinet = {
      uid: "locked-base", cabinetId: 24, masterCode: "B-24", description: "Base Cabinet", placement: "base",
      x: 12, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0, numberOfDoors: 2, numberOfDrawers: 1,
    } as never;
    const base = {
      roomOverride: { width: 144, depth: 120, ceilingHeight: 96 },
      placed: [cabinet],
      openings: [{ uid: "locked-window", kind: "window", label: "Window", side: "top", offset: 48, width: 30, height: 36, sill: 42 } as never],
      sinks: [{ uid: "locked-sink", type: "single", x: 48, y: 0, width: 30, depth: 22, faucet: true } as never],
      island: { x: 36, y: 54, width: 72, depth: 36 },
      furniture: [{ uid: "locked-table", defId: "table-48", x: 60, y: 72, rotation: 0 } as never],
      ponyWalls: [{ uid: "locked-pony", x: 24, y: 48, width: 48, depth: 6, height: 42 } as never],
    };
    const geometryLock = threeDExactPlanGeometryLock({
      ...base,
      catalogDoorSampleUrl: "/admin/door-sample-a.webp",
      catalogFinishOverride: "#8c6a42",
      catalogCountertopName: "Calacatta Oro",
      catalogCountertopColor: "#f2f0ea",
      initialPresentation: { cabinetFinish: "#8c6a42", countertopFinish: "#f2f0ea" },
    });
    expect(threeDExactPlanGeometryLock({
      ...base,
      catalogDoorSampleUrl: "/admin/door-sample-b.webp",
      catalogFinishOverride: "#42513e",
      catalogCountertopName: "Different visual sample",
      catalogCountertopColor: "#232323",
      initialPresentation: { cabinetFinish: "#42513e", countertopFinish: "#232323" },
    })).toBe(geometryLock);
    expect(threeDExactPlanGeometryLock({
      ...base,
      placed: [{ ...cabinet, x: 12.125 }],
    })).not.toBe(geometryLock);
  });

  it("forces the active WebGL preview to rebuild whenever any saved 2D scene input changes", () => {
    const room = { width: 144, depth: 120 };
    const base = threeDSceneRevisionKey(room, [], [], [], null, [], [], "sample-a");
    const cabinet = { uid: "cab", cabinetId: 1, masterCode: "B-24", description: "Base", placement: "base", x: 0, y: 0, width: 24, depth: 24, rotation: 0 } as never;
    const opening = { uid: "window", kind: "window", side: "top", offset: 0, width: 30, height: 30, sillHeight: 36 } as never;
    const sink = { uid: "sink", type: "single_bowl", x: 24, y: 0, width: 30, depth: 20, faucet: true } as never;
    const furniture = { uid: "table", defId: "table-48", x: 48, y: 60, rotation: 90 } as never;
    const ponyWall = { uid: "pony", x: 24, y: 24, width: 48, depth: 6, height: 42 } as never;
    expect(threeDSceneRevisionKey(room, [cabinet], [], [], null, [], [], "sample-a")).not.toBe(base);
    expect(threeDSceneRevisionKey(room, [], [opening], [], null, [], [], "sample-a")).not.toBe(base);
    expect(threeDSceneRevisionKey(room, [], [], [sink], null, [], [], "sample-a")).not.toBe(base);
    expect(threeDSceneRevisionKey(room, [], [], [], null, [], [], "sample-b")).not.toBe(base);
    expect(threeDSceneRevisionKey(room, [], [], [], null, [], [], "sample-a", "black-granite")).not.toBe(base);
    expect(threeDSceneRevisionKey(room, [], [], [], null, [], [], "sample-a", null, "#49604a")).not.toBe(base);
    expect(threeDSceneRevisionKey(room, [], [], [], { x: 48, y: 48, width: 60, depth: 30 }, [], [], "sample-a")).not.toBe(base);
    expect(threeDSceneRevisionKey(room, [], [], [], null, [furniture], [], "sample-a")).not.toBe(base);
    expect(threeDSceneRevisionKey(room, [], [], [], null, [], [ponyWall], "sample-a")).not.toBe(base);
  });

  it("shows the exact active 2D entity inventory in the visible 3D plan-sync status", () => {
    expect(threeDPlanSyncText({
      placed: [{ uid: "cab" } as never],
      openings: [{ uid: "window" } as never],
      sinks: [{ uid: "sink" } as never],
      island: { x: 24, y: 24, width: 48, depth: 24 },
      furniture: [{ uid: "table" } as never],
      ponyWalls: [{ uid: "pony" } as never],
    })).toBe("Plan sync: 1 cabinet items · 1 openings · 1 sinks · 1 island · 1 furniture · 1 pony walls");
  });

  it("preserves a placed cabinet’s current 2D location and wall mounting height", () => {
    expect(existingCabinetTransform({
      uid: "wall-1", cabinetId: 10, masterCode: "W3030", description: "Wall Cabinet", placement: "wall",
      x: 24, y: 0, width: 30, depth: 12, height: 30, rotation: 0, mountBottom: 60,
    })).toEqual({ x: 39, z: 6, rotation: 0, bottom: 60 });
  });

  it("keeps a short ordinary wall cabinet at the 54-inch datum in 3D", () => {
    const shortWall = {
      uid: "short-wall", cabinetId: 11, masterCode: "W-30-24", description: "24 inch Wall Cabinet", placement: "wall",
      x: 0, y: 0, width: 30, depth: 12, height: 24, rotation: 0,
    } as never;
    expect(existingCabinetTransform(shortWall, { ceilingHeight: 108 })).toMatchObject({ bottom: 54 });
  });

  it("keeps an unnormalized refrigerator upper at the 72-inch default datum in 3D", () => {
    const refrigeratorUpper = {
      uid: "fridge-wall", cabinetId: 12, masterCode: "WR3624", description: "36 inch Refrigerator Wall Cabinet", placement: "wall",
      x: 0, y: 0, width: 36, depth: 24, height: 24, rotation: 0,
    } as never;
    expect(existingCabinetTransform(refrigeratorUpper, { ceilingHeight: 108 })).toMatchObject({ bottom: 72 });
  });

  it("uses the rotation-aware 2D footprint center so vertical cabinet runs stay flush in 3D", () => {
    expect(existingCabinetTransform({
      uid: "wall-vertical", cabinetId: 11, masterCode: "W3030", description: "Wall Cabinet", placement: "wall",
      x: 0, y: 24, width: 30, depth: 12, height: 30, rotation: 90, mountBottom: 54,
    })).toEqual({ x: 6, z: 39, rotation: Math.PI / 2, bottom: 54 });
  });

  it("seats a legacy near-wall end-run wall cabinet flush even if an old record carries an in/out adjustment", () => {
    const legacy = {
      uid: "left-end", cabinetId: 11, masterCode: "W3030", description: "Wall Cabinet", placement: "wall",
      x: 4, y: 24, width: 30, depth: 12, height: 30, rotation: 90, mountBottom: 54,
    } as never;
    const room = { width: 144, depth: 120, ceilingHeight: 96 };
    expect(existingCabinetTransform(legacy, room)).toMatchObject({ x: 6, z: 39, rotation: Math.PI / 2 });
    expect(existingCabinetTransform({ ...legacy, depthPositionAdjusted: true }, room)).toMatchObject({ x: 6, z: 39, rotation: Math.PI / 2 });
  });

  it("uses the saved left-wall quarter turn to seat an offset legacy end run on the physical wall", () => {
    const room = { width: 144, depth: 120, ceilingHeight: 96 };
    expect(existingCabinetTransform({
      uid: "left-offset", cabinetId: 12, masterCode: "W3030", description: "Wall Cabinet", placement: "wall",
      x: 12, y: 24, width: 30, depth: 12, height: 30, rotation: 90, mountBottom: 54,
    } as never, room)).toMatchObject({ x: 6, z: 39, rotation: Math.PI / 2 });
  });

  it("keeps adjacent rotated 2D cabinet edges contiguous with no artificial 3D run gap", () => {
    const first = existingCabinetTransform({
      uid: "run-a", cabinetId: 11, masterCode: "W3030", description: "Wall Cabinet", placement: "wall",
      x: 0, y: 0, width: 30, depth: 12, height: 30, rotation: 90, mountBottom: 54,
    });
    const second = existingCabinetTransform({
      uid: "run-b", cabinetId: 12, masterCode: "W3030", description: "Wall Cabinet", placement: "wall",
      x: 0, y: 30, width: 30, depth: 12, height: 30, rotation: 90, mountBottom: 54,
    });
    expect(first.z + 15).toBe(second.z - 15);
  });

  it("preserves a BMC microwave base's configured top opening, zero doors, and one drawer in 3D", () => {
    expect(resolvedThreeDFaceLayout({
      placementType: "base",
      openingType: "top",
      numberOfDoors: 0,
      numberOfDrawers: 1,
    })).toEqual({ hasConfiguredOpening: true, doorCount: 0, drawerCount: 1 });
  });

  it("preserves source-correct BEC24 and open-front Cabinet Config profiles in 3D", () => {
    expect(resolvedThreeDSpecialtyProfile({
      masterCode: "CDB36", description: "36 inch Corner Drawer Base Cabinet", graphicType: "corner-drawer-base", customProfile: "corner-drawer-base", facePattern: null, cornerType: "l-shape",
    })).toEqual({ kind: "corner-drawer", pattern: null });
    expect(resolvedThreeDSpecialtyProfile({
      masterCode: "BEC-24", description: "Base End Cabinet", graphicType: "base_end_return", customProfile: "end-angle", facePattern: null, cornerType: null,
    })).toEqual({ kind: "standard", pattern: null });
    expect(resolvedThreeDSpecialtyProfile({
      masterCode: "WRC-30", description: "Wine Rack", graphicType: null, customProfile: null, facePattern: "lattice", cornerType: null,
    })).toEqual({ kind: "face-pattern", pattern: "lattice" });
    expect(resolvedThreeDSpecialtyProfile({
      masterCode: "FSB-36", description: '36" Farmhouse Sink Base', graphicType: null, customProfile: null, facePattern: null, cornerType: null,
    })).toEqual({ kind: "farmhouse-sink", pattern: null });
  });

  it("keeps ERB36's two exposed L-corner fronts on the room side at the top-right room corner", () => {
    const room = { width: 120, depth: 120, ceilingHeight: 96 } as never;
    const erb = {
      uid: "erb36-top-right", cabinetId: 36, masterCode: "ERB-36", description: "Easy Reach Corner Base",
      placement: "base", x: 84, y: 0, width: 36, depth: 36, height: 34.5, rotation: 90, numberOfDoors: 2, numberOfDrawers: 0,
    } as never;
    expect(existingCabinetTransform(erb, room).rotation).toBeCloseTo(Math.PI * 1.5, 12);
  });

  it("mirrors a WER wall easy-reach corner like the matching plan footprint instead of reversing it in 3D", () => {
    const room = { width: 120, depth: 120, ceilingHeight: 96 } as never;
    const wer = {
      uid: "wer2442-top-right", cabinetId: 2442, masterCode: "WER2442", description: "Wall Easy Reach Corner",
      placement: "wall", x: 96, y: 0, width: 24, depth: 12, height: 42, rotation: 90, numberOfDoors: 2, numberOfDrawers: 0,
    } as never;
    // The 2D corner is correct at top-right. Three.js must mirror the clockwise
    // plan turn so the easy-reach's two open faces point back into the room.
    expect(existingCabinetTransform(wer, room).rotation).toBeCloseTo(Math.PI * 1.5, 12);
  });

  it("keeps a snapped ERB36 seated at its actual diagonal custom-wall vertex in 3D", () => {
    const room: RoomData = {
      width: 180,
      depth: 180,
      ceilingHeight: 96,
      openWallPath: true,
      vertices: [
        { id: "a", x: 0, y: 0 },
        { id: "corner", x: 100, y: 100 },
        { id: "b", x: 50, y: 150 },
      ],
      customWalls: [
        { id: "first", startVertexId: "a", endVertexId: "corner", label: "Wall 1", lockedAngle: 45 },
        { id: "second", startVertexId: "corner", endVertexId: "b", label: "Wall 2", lockedAngle: 45 },
      ],
    };
    const seed = {
      uid: "erb36-diagonal-3d", cabinetId: 36, masterCode: "ERB36", description: "Easy Reach Corner Base 36",
      placement: "base" as const, x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0,
    };
    const spot = nextAvailableRoomCornerPlacement(seed, "second" as any, room, []);
    expect(spot).toMatchObject({ wallId: "second", wallOffset: 0, rotation: 135 });

    const transform = existingCabinetTransform({ ...seed, ...spot!, wallId: spot!.wallId, wallOffset: spot!.wallOffset }, room);
    // This is the center generated from the same 36 x 36 physical corner envelope
    // that wallPlacementAt seated on the shared 100,100 vertex.
    expect(transform.x).toBeCloseTo(100 - 18 * Math.SQRT2, 8);
    expect(transform.z).toBeCloseTo(100, 8);
    expect(transform.rotation).toBeCloseTo(Math.PI * 1.25, 12);
  });

  it("keeps both ERB36 back legs on a downward V-shaped measured corner in 3D", () => {
    const room: RoomData = {
      width: 180,
      depth: 220,
      ceilingHeight: 96,
      openWallPath: true,
      vertices: [
        { id: "left", x: 50, y: 150 },
        { id: "vertex", x: 100, y: 200 },
        { id: "right", x: 150, y: 150 },
      ],
      customWalls: [
        { id: "left-leg", startVertexId: "left", endVertexId: "vertex", label: "Wall 1", lockedAngle: 45 },
        { id: "right-leg", startVertexId: "vertex", endVertexId: "right", label: "Wall 2", lockedAngle: 45 },
      ],
    };
    const seed = {
      uid: "erb36-v-corner-3d", cabinetId: 36, masterCode: "ERB36", description: "Easy Reach Corner Base 36",
      placement: "base" as const, x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0,
    };
    const spot = nextAvailableRoomCornerPlacement(seed, "right-leg" as any, room, [], { x: 100, y: 200 });
    expect(spot).toMatchObject({ wallId: "left-leg", rotation: 225 });
    const transform = existingCabinetTransform({ ...seed, ...spot!, wallId: spot!.wallId, wallOffset: spot!.wallOffset }, room);

    expect(transform.x).toBeCloseTo(100, 8);
    expect(transform.z).toBeCloseTo(200 - 18 * Math.SQRT2, 8);
    // Three.js mirrors the screen-space clockwise plan angle.
    expect(transform.rotation).toBeCloseTo(Math.PI * 0.75, 12);

    const root = new THREE.Group();
    const placed = { ...seed, ...spot!, wallId: spot!.wallId, wallOffset: spot!.wallOffset } as never;
    addCabinet(root, existingCabinetSku(placed, room), null, {}, room.width, room.depth, "#7e8d72", "#f8f8f6", undefined, transform);
    root.updateMatrixWorld(true);
    const erbGroup = root.children.find((node) => node.userData.placedUid === seed.uid);
    // The local -X/-Z outer point is where the two L legs meet the room walls.
    // It must be exactly the measured shared vertex, not merely near its AABB.
    const sceneInch = 1 / 12;
    const sharedVertex = new THREE.Vector3(-18 * sceneInch, 0, -18 * sceneInch).applyMatrix4(erbGroup!.matrixWorld);
    expect(sharedVertex.x / sceneInch).toBeCloseTo(100, 8);
    expect(sharedVertex.z / sceneInch).toBeCloseTo(200, 8);
  });

  it("builds ER36-family toe kicks as two recessed exposed-face strips that terminate at one clean inside-corner seam on every orientation", () => {
    for (const masterCode of ["ER36", "BER36", "ERB-36"]) {
      for (const rotation of [0, 90, 180, 270]) {
        const root = new THREE.Group();
        const easyReach = {
          uid: `${masterCode}-${rotation}`, cabinetId: 36, masterCode, description: "Easy Reach Corner Base",
          placement: "base", x: 42, y: 42, width: 36, depth: 36, height: 34.5, rotation, numberOfDoors: 2, numberOfDrawers: 0,
        } as never;
        addCabinet(root, existingCabinetSku(easyReach), null, {}, 120, 120, "#7e8d72", "#f8f8f6", undefined, existingCabinetTransform(easyReach, { width: 120, depth: 120, ceilingHeight: 96 } as never));
        const kicks: THREE.Object3D[] = [];
        root.traverse((node) => { if (node.userData.lCornerToeKick) kicks.push(node); });

        expect(kicks, `${masterCode} at ${rotation}°`).toHaveLength(2);
        expect(kicks.map((node) => node.userData.lCornerToeKickSide).sort()).toEqual(["back-leg", "side-leg"]);
        expect(kicks.some((node) => node.userData.lCornerToeKickSide === "corner-return")).toBe(false);
        for (const kick of kicks) {
          expect(kick.userData.lCornerExposedFaceToeKick).toBe(true);
          expect(kick.userData.toeKickRecessIn).toBe(3);
          expect(kick.userData.toeKickHeightIn).toBe(4.5);
        }
        const backKick = kicks.find((node) => node.userData.lCornerToeKickSide === "back-leg") as THREE.Mesh<THREE.BoxGeometry>;
        const sideKick = kicks.find((node) => node.userData.lCornerToeKickSide === "side-leg") as THREE.Mesh<THREE.BoxGeometry>;
        const backWidth = backKick.geometry.parameters.width;
        const sideLength = sideKick.geometry.parameters.depth;
        expect(backKick.position.x - backWidth / 2).toBeCloseTo(sideKick.position.x, 10);
        expect(sideKick.position.z - sideLength / 2).toBeCloseTo(backKick.position.z, 10);
      }
    }
  });

  it("applies the selected toe-kick finish to the existing ER36 two-leg seam without adding a center return", () => {
    const root = new THREE.Group();
    const easyReach = {
      uid: "er36-selected-toe", cabinetId: 36, masterCode: "ER36", description: "Easy Reach Corner Base",
      placement: "base", x: 42, y: 42, width: 36, depth: 36, height: 34.5, rotation: 0, numberOfDoors: 2, numberOfDrawers: 0,
    } as never;
    addCabinet(
      root,
      existingCabinetSku(easyReach),
      null,
      {},
      120,
      120,
      "#7e8d72",
      "#f8f8f6",
      undefined,
      existingCabinetTransform(easyReach, { width: 120, depth: 120, ceilingHeight: 96 } as never),
      undefined,
      undefined,
      { selectedToeKick: true },
    );
    const kicks: THREE.Mesh[] = [];
    root.traverse((node) => { if (node instanceof THREE.Mesh && node.userData.lCornerToeKick) kicks.push(node); });
    expect(kicks).toHaveLength(2);
    expect(kicks.every((node) => node.userData.selectedToeKickFinishSkin === true)).toBe(true);
    expect(kicks.every((node) => node.userData.visibleToeKickFrontPlane === true)).toBe(true);
    expect(kicks.every((node) => node.userData.doesNotReplacePhysicalSupport === true)).toBe(true);
    expect(kicks.every((node) => (node.material as THREE.MeshStandardMaterial).color.getHexString() === "7e8d72")).toBe(true);
    expect(kicks.some((node) => node.userData.lCornerToeKickSide === "corner-return")).toBe(false);
  });

  it("suppresses a fitted filler toe kick that touches a dishwasher opening while retaining the dishwasher's own floor support", () => {
    const root = new THREE.Group();
    const filler = {
      uid: "filler-beside-dw", cabinetId: 342, masterCode: "F342", description: "Filler cut to 3 inches",
      placement: "base", x: 24, y: 0, width: 3, depth: 24, height: 34.5, rotation: 0,
      fillerPieceGroupId: "dw-gap", fillerTotalWidth: 3, fillerPlacementMode: "right", numberOfDoors: 0, numberOfDrawers: 0,
    } as never;
    const dishwasher = {
      uid: "dw-24", cabinetId: 24, masterCode: "DW-24", description: "24 inch dishwasher",
      placement: "appliance", x: 27, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0, numberOfDoors: 0, numberOfDrawers: 0,
    } as never;
    const room = { width: 120, depth: 96, ceilingHeight: 96 } as never;
    const suppressions = threeDFittedFillerToeKickSuppressionUids([filler, dishwasher]);
    expect(suppressions.has(filler.uid)).toBe(true);
    const manualFiller = {
      ...filler,
      uid: "manual-filler-beside-dw",
      masterCode: "F3",
      fillerPieceGroupId: null,
      fillerTotalWidth: null,
      fillerPlacementMode: null,
    } as never;
    expect(threeDFittedFillerToeKickSuppressionUids([manualFiller, dishwasher]).has(manualFiller.uid)).toBe(true);
    addCabinet(root, existingCabinetSku(filler), null, {}, 120, 96, "#7e8d72", "#f8f8f6", undefined, existingCabinetTransform(filler, room), undefined, undefined, { suppressFittedFillerToeKick: suppressions.has(filler.uid) });
    addCabinet(root, existingCabinetSku(dishwasher), null, {}, 120, 96, "#7e8d72", "#f8f8f6", undefined, existingCabinetTransform(dishwasher, room));
    const fillerKick: THREE.Object3D[] = [];
    const dishwasherKicks: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.installedFillerToeKickRecessed) fillerKick.push(node);
      if (node.userData.dishwasherToeKick) dishwasherKicks.push(node);
    });

    expect(fillerKick).toHaveLength(0);
    expect(dishwasherKicks).toHaveLength(1);
    expect(dishwasherKicks[0]?.userData.floorApplianceSupport).toBe(true);
  });

	  it("keeps left and right LSB36 lazy Susan fronts on their room-facing corner legs", () => {
    const room = { width: 120, depth: 120, ceilingHeight: 96 } as never;
    const left = {
      uid: "lsb36-top-left", cabinetId: 36, masterCode: "LSB36", description: "Lazy Susan Base Cabinet",
      placement: "base", x: 0, y: 0, width: 36, depth: 36, height: 34.5, rotation: 0, cornerType: "lazy-susan", numberOfDoors: 2, numberOfDrawers: 0,
    } as never;
    const right = {
      uid: "lsb36-top-right", cabinetId: 36, masterCode: "LSB36", description: "Lazy Susan Base Cabinet",
      placement: "base", x: 84, y: 0, width: 36, depth: 36, height: 34.5, rotation: 90, cornerType: "lazy-susan", numberOfDoors: 2, numberOfDrawers: 0,
    } as never;
    expect(existingCabinetTransform(left, room).rotation).toBeCloseTo(0, 12);
	    expect(existingCabinetTransform(right, room).rotation).toBeCloseTo(Math.PI * 1.5, 12);
	  });

	  it("normalizes stale 33-inch BBC36 records and faces the measured 36-by-24 front into the room on every wall", () => {
	    const room = { width: 120, depth: 120, ceilingHeight: 96 } as never;
	    const cases = [
	      { cabinet: { uid: "bbc-back-left", masterCode: "BBC-36", description: "Blind Corner Base", placement: "base", x: 0, y: 0, width: 33, depth: 24, height: 34.5, rotation: 0, swing: "right", openingWidth: 11, numberOfDoors: 1, numberOfDrawers: 1 }, rotation: 0 },
	      { cabinet: { uid: "bbc-back-right", masterCode: "BBC-36", description: "Blind Corner Base", placement: "base", x: 84, y: 0, width: 33, depth: 24, height: 34.5, rotation: 0, swing: "left", openingWidth: 11, numberOfDoors: 1, numberOfDrawers: 1 }, rotation: 0 },
	      { cabinet: { uid: "bbc-front-left", masterCode: "BBC-36", description: "Blind Corner Base", placement: "base", x: 0, y: 96, width: 33, depth: 24, height: 34.5, rotation: 180, swing: "right", openingWidth: 11, numberOfDoors: 1, numberOfDrawers: 1 }, rotation: Math.PI },
	      { cabinet: { uid: "bbc-front-right", masterCode: "BBC-36", description: "Blind Corner Base", placement: "base", x: 84, y: 96, width: 33, depth: 24, height: 34.5, rotation: 180, swing: "left", openingWidth: 11, numberOfDoors: 1, numberOfDrawers: 1 }, rotation: Math.PI },
	      { cabinet: { uid: "bbc-left", masterCode: "BBC-36", description: "Blind Corner Base", placement: "base", x: 0, y: 24, width: 33, depth: 24, height: 34.5, rotation: 90, swing: "right", openingWidth: 11, numberOfDoors: 1, numberOfDrawers: 1 }, rotation: Math.PI / 2 },
	      { cabinet: { uid: "bbc-right", masterCode: "BBC-36", description: "Blind Corner Base", placement: "base", x: 96, y: 24, width: 33, depth: 24, height: 34.5, rotation: 270, swing: "left", openingWidth: 11, numberOfDoors: 1, numberOfDrawers: 1 }, rotation: -Math.PI / 2 },
	    ] as const;
	    for (const { cabinet, rotation } of cases) {
	      expect(threeDCornerBodyDimensions(cabinet as never)).toEqual({ width: 36, depth: 24 });
	      expect(existingCabinetTransform(cabinet as never, room).rotation).toBeCloseTo(rotation, 12);
	      const layout = threeDBlindCornerFrontLayout(36 / 12, cabinet.swing, cabinet.openingWidth);
	      expect(layout.doorSide).toBe(cabinet.swing);
	      expect(layout.blindSide).toBe(cabinet.swing === "right" ? "left" : "right");
	      expect(layout.doorWidth).toBeCloseTo(11 / 12, 12);
	      expect(layout.doorWidth + layout.blindWidth).toBeCloseTo(36 / 12, 12);
	    }
	  });

  it("mounts FSB36's apron on the room-facing side of a right-wall placement", () => {
    const room = { width: 120, depth: 120, ceilingHeight: 96 } as never;
    const fsb = {
      uid: "fsb36-right", cabinetId: 36, masterCode: "FSB-36", description: '36" Farmhouse Sink Base',
      placement: "base", x: 96, y: 36, width: 36, depth: 24, height: 34.5, rotation: 90, numberOfDoors: 2, numberOfDrawers: 0,
    } as never;
    expect(existingCabinetTransform(fsb, room).rotation).toBeCloseTo(-Math.PI / 2, 12);
    const root = new THREE.Group();
    addCabinet(root, existingCabinetSku(fsb), null, {}, room.width, room.depth, "#7e8d72", "#f8f8f6", undefined, existingCabinetTransform(fsb, room));
    root.updateMatrixWorld(true);
    const cabinet = root.children.find((node) => node.userData.masterCode === "FSB-36")!;
    let apron: THREE.Object3D | undefined;
    root.traverse((node) => { if (node.userData.farmhouseApronFront) apron = node; });
    const cabinetPosition = new THREE.Vector3();
    const apronPosition = new THREE.Vector3();
    cabinet.getWorldPosition(cabinetPosition);
    expect(apron).toBeDefined();
    apron.getWorldPosition(apronPosition);
    expect(apronPosition.x).toBeLessThan(cabinetPosition.x);
  });

  it("keeps a right-wall cabinet and fitted filler facing the room when either one touches the front-right corner", () => {
    const room = { width: 120, depth: 120, ceilingHeight: 96 } as never;
    const cabinetWithLeftFiller = {
      uid: "b21-right-left-fill", cabinetId: 21, masterCode: "B-21-L", description: '21" Base Cabinet',
      placement: "base", x: 96, y: 99, width: 21, depth: 24, height: 34.5, rotation: 90, numberOfDoors: 1, numberOfDrawers: 1,
    } as never;
    const leftFiller = {
      uid: "f342-left", cabinetId: 342, masterCode: "F342-L", description: 'Filler cut to 3" — install on left',
      placement: "base", x: 96, y: 96, width: 3, depth: 24, height: 34.5, rotation: 90, numberOfDoors: 0, numberOfDrawers: 0,
      fillerPieceGroupId: "filler-group-left", fillerTotalWidth: 3, fillerPlacementMode: "left",
    } as never;
    const cabinetWithRightFiller = {
      ...cabinetWithLeftFiller,
      uid: "b21-right-right-fill", masterCode: "B-21-R", y: 72,
    } as never;
    const rightFiller = {
      ...leftFiller,
      uid: "f342-right", masterCode: "F342-R", description: 'Filler cut to 3" — install on right', y: 93, fillerPieceGroupId: "filler-group-right", fillerPlacementMode: "right",
    } as never;
    const root = new THREE.Group();
    for (const placed of [cabinetWithLeftFiller, leftFiller, cabinetWithRightFiller, rightFiller]) {
      addCabinet(root, existingCabinetSku(placed), null, {}, room.width, room.depth, "#7e8d72", "#f8f8f6", undefined, existingCabinetTransform(placed, room));
    }
    root.updateMatrixWorld(true);
    const measured = [cabinetWithLeftFiller, leftFiller, cabinetWithRightFiller, rightFiller].map((placed) => {
      const group = root.children.find((node) => node.userData.placedUid === placed.uid)!;
      const body = group.children.find((node) => node.userData.selectedStyleSideSkin)!;
      return new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3());
    });

    expect(measured[0]!.x).toBeCloseTo(24 / 12, 5);
    expect(measured[0]!.z).toBeCloseTo(21 / 12, 5);
	    expect(measured[1]!.x).toBeCloseTo(0.75 / 12, 5);
	    expect(measured[1]!.z).toBeCloseTo(3 / 12, 5);
    expect(measured[2]!.x).toBeCloseTo(24 / 12, 5);
    expect(measured[2]!.z).toBeCloseTo(21 / 12, 5);
	    expect(measured[3]!.x).toBeCloseTo(0.75 / 12, 5);
	    expect(measured[3]!.z).toBeCloseTo(3 / 12, 5);
	    for (const filler of [leftFiller, rightFiller]) {
	      const group = root.children.find((node) => node.userData.placedUid === filler.uid)!;
	      const body = group.children.find((node) => node.userData.fullDepthReservedForCountertop) as THREE.Mesh;
	      const bounds = new THREE.Box3().setFromObject(body);
	      expect(bounds.min.x).toBeCloseTo(96 / 12, 5);
	      expect(body.userData.installedFillerVisibleDepthIn).toBeCloseTo(0.75, 8);
	      expect(body.userData.fullDepthReservedForCountertop).toBe(true);
	    }
    for (const placed of [cabinetWithLeftFiller, leftFiller, cabinetWithRightFiller, rightFiller]) {
      expect(existingCabinetTransform(placed, room).rotation).toBeCloseTo(-Math.PI / 2, 12);
    }
  });

  it("keeps FSB36's apron on its rotated right-wall run when it also touches the front wall", () => {
    const room = { width: 120, depth: 120, ceilingHeight: 96 } as never;
    const fsbAtFrontRight = {
      uid: "fsb36-front-right", cabinetId: 36, masterCode: "FSB-36", description: '36" Farm Sink Base Cabinet',
      placement: "base", x: 96, y: 84, width: 36, depth: 24, height: 34.5, rotation: 90, numberOfDoors: 2, numberOfDrawers: 0,
    } as never;
    expect(existingCabinetTransform(fsbAtFrontRight, room).rotation).toBeCloseTo(-Math.PI / 2, 12);
  });

  it("renders a generic-metadata FSB36 as a farmhouse front and normalizes a short RANGE-30 record to the finished 36-inch countertop line", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: 1, cabinetId: 36, masterCode: "FSB-36", description: '36" Farm Sink Base Cabinet',
      placementType: "base", width: 36, height: 34.5, depth: 24, mountBottom: 0, numberOfDoors: 2, numberOfDrawers: 0,
    }, null, {}, 144, 120, "#7e8d72", "#f8f8f6");
    addCabinet(root, {
      distributorSkuId: 2, cabinetId: 30, masterCode: "RANGE-30", description: "30 inch range",
      placementType: "appliance", width: 30, height: 30, depth: 25, mountBottom: 0, numberOfDoors: 0, numberOfDrawers: 0,
    }, null, {}, 144, 120, "#7e8d72", "#f8f8f6");
    const nodes: THREE.Object3D[] = [];
    root.traverse((node) => nodes.push(node));
    expect(nodes.filter((node) => node.userData.farmhouseApronFront)).toHaveLength(1);
    const range = root.children.find((node) => node.userData.masterCode === "RANGE-30")!;
    expect(range.userData.catalogApplianceEnvelope.heightIn).toBe(36);
  });

  it("builds dimensional cabinet, refrigerator, range, dishwasher, farmhouse sink, and hood detail meshes", () => {
    const root = new THREE.Group();
    const common = { width: 30, height: 36, depth: 24, mountBottom: 0, numberOfDoors: 2, numberOfDrawers: 1 };
    addCabinetWithBarPulls(root, { distributorSkuId: 1, cabinetId: 1, masterCode: "B-30", description: "Base Cabinet", placementType: "base", ...common }, null, {}, 180, 144, "#7e8d72", "#f8f8f6", { doorStyle: "Shaker", doorPanelType: "shaker" });
    addCabinet(root, { distributorSkuId: 2, cabinetId: 2, masterCode: "FRIDGE-36", description: "36 inch Panel-Ready Refrigerator", placementType: "appliance", width: 36, height: 70, depth: 30, mountBottom: 0, numberOfDoors: 0, numberOfDrawers: 0 }, null, {}, 180, 144, "#7e8d72", "#f8f8f6");
    addCabinet(root, { distributorSkuId: 3, cabinetId: 3, masterCode: "RANGE-30", description: "30 inch Freestanding Range", placementType: "appliance", width: 30, height: 36, depth: 25, mountBottom: 0, numberOfDoors: 0, numberOfDrawers: 0 }, null, {}, 180, 144, "#7e8d72", "#f8f8f6");
    addCabinet(root, { distributorSkuId: 4, cabinetId: 4, masterCode: "DW-24", description: "24 inch Panel Ready Dishwasher", placementType: "appliance", width: 24, height: 34.5, depth: 24, mountBottom: 0, numberOfDoors: 0, numberOfDrawers: 0 }, null, {}, 180, 144, "#7e8d72", "#f8f8f6");
    addCabinet(root, { distributorSkuId: 5, cabinetId: 5, masterCode: "FSB-36", description: "36 inch Farmhouse Sink Base", placementType: "base", width: 36, height: 34.5, depth: 24, mountBottom: 0, numberOfDoors: 2, numberOfDrawers: 0 }, null, {}, 180, 144, "#7e8d72", "#f8f8f6");
    addCabinet(root, { distributorSkuId: 6, cabinetId: 6, masterCode: "HOOD-30", description: "30 inch Range Hood", placementType: "appliance", width: 30, height: 18, depth: 18, mountBottom: 66, numberOfDoors: 0, numberOfDrawers: 0 }, null, {}, 180, 144, "#7e8d72", "#f8f8f6");
    const nodes: THREE.Object3D[] = [];
    root.traverse((node) => nodes.push(node));
    expect(nodes.some((node) => node.userData.cabinetHardware)).toBe(true);
    expect(nodes.some((node) => node.userData.cabinetFaceShadowGap)).toBe(true);
    expect(nodes.filter((node) => node.userData.refrigeratorHandle)).toHaveLength(2);
    expect(nodes.filter((node) => node.userData.refrigeratorFoot)).toHaveLength(2);
    expect(nodes.some((node) => node.userData.refrigeratorDispenser)).toBe(true);
    expect(nodes.some((node) => node.userData.refrigeratorTopVent)).toBe(true);
    expect(nodes.filter((node) => node.userData.refrigeratorHingeCap)).toHaveLength(2);
    expect(nodes.filter((node) => node.userData.rangeControlKnob)).toHaveLength(4);
    expect(nodes.some((node) => node.userData.rangeOvenHandle)).toBe(true);
    expect(nodes.some((node) => node.userData.dishwasherControlStrip)).toBe(true);
    expect(nodes.some((node) => node.userData.dishwasherHandle)).toBe(true);
    expect(nodes.filter((node) => node.userData.dishwasherControlButton)).toHaveLength(4);
    expect(nodes.some((node) => node.userData.dishwasherDoorReveal)).toBe(true);
    expect(nodes.filter((node) => node.userData.panelReadyFinish)).toHaveLength(2);
    expect(nodes.some((node) => node.userData.farmhouseSinkBasin)).toBe(true);
    expect(nodes.some((node) => node.userData.farmhouseSinkFaucetSpout)).toBe(true);
    expect(nodes.some((node) => node.userData.pyramidalCanopy)).toBe(true);
    expect(nodes.filter((node) => node.userData.rangeHoodFilter)).toHaveLength(2);
    expect(nodes.filter((node) => node.userData.rangeHoodFilterSlat)).toHaveLength(8);
    expect(nodes.filter((node) => node.userData.rangeHoodTaskLight)).toHaveLength(2);
    expect(nodes.filter((node) => node.userData.rangeHoodControlRail)).toHaveLength(1);
    expect(nodes.filter((node) => node.userData.rangeHoodControl)).toHaveLength(5);
  });

  it("uses vertical hinge-opposite pulls at the correct upper and lower pantry door zones", () => {
    const root = new THREE.Group();
    addCabinetWithBarPulls(root, {
      distributorSkuId: 1, cabinetId: 1, masterCode: "P-24-90", description: "24 inch Pantry Cabinet",
      placementType: "tall", width: 24, height: 90, depth: 24, mountBottom: 0, numberOfDoors: 4, numberOfDrawers: 0, hardwarePosition: "top-center",
    }, null, {}, 144, 120, "#7e8d72", "#f8f8f6", { doorStyle: "Shaker", doorPanelType: "shaker" });
    const pulls: THREE.Object3D[] = [];
    root.traverse((node) => { if (node.userData.cabinetPull === "door") pulls.push(node); });
    expect(pulls).toHaveLength(4);
    expect(pulls.filter((node) => node.userData.pullDoorZone === "upper")).toHaveLength(2);
    expect(pulls.filter((node) => node.userData.pullDoorZone === "lower")).toHaveLength(2);
    expect(pulls.every((node) => node.userData.verticalPull && node.userData.pullEdge === "opposite-hinge")).toBe(true);

    const pantryDoors: THREE.Mesh[] = [];
    root.traverse((node) => {
      if (node instanceof THREE.Mesh && (node.userData.pantryDoorSet === "upper" || node.userData.pantryDoorSet === "lower")) pantryDoors.push(node);
    });
    for (const zone of ["upper", "lower"] as const) {
      const zoneDoors = pantryDoors.filter((door) => door.userData.pantryDoorSet === zone).sort((left, right) => left.position.x - right.position.x);
      const zonePulls = pulls.filter((pull) => pull.userData.pullDoorZone === zone).sort((left, right) => left.position.x - right.position.x);
      expect(zonePulls).toHaveLength(zoneDoors.length);
      zonePulls.forEach((pull, index) => {
        // Pantry handles meet at the opening: upper-door pulls are on their
        // lower rail and lower-door pulls are on their upper rail.
        expect(zone === "upper" ? pull.position.y : -pull.position.y)
          .toBeLessThan(zone === "upper" ? zoneDoors[index]!.position.y : -zoneDoors[index]!.position.y);
      });
    }
  });

  it("puts every tall cabinet's separate upper-door pulls on the bottom meeting rail regardless of distributor construction", () => {
    const renderTallUpperDoorPulls = (constructionMethod?: string) => {
      const root = new THREE.Group();
      const tallDrawerPantry = existingCabinetSku({
        uid: `t3db-upper-${constructionMethod ?? "standard"}`,
        cabinetId: 1,
        masterCode: "T3DB3084",
        description: "30 inch Tall Pantry Cabinet with upper doors and lower drawers",
        placement: "tall",
        x: 0,
        y: 0,
        rotation: 0,
        width: 30,
        height: 84,
        depth: 24,
        numberOfDoors: 2,
        numberOfDrawers: 3,
        drawerLayout: JSON.stringify([{ count: 1, height: 7.375 }, { count: 1, height: 7.375 }, { count: 1, height: 15 }]),
        ...(constructionMethod ? { constructionMethod } : {}),
      } as never);
      addCabinetWithBarPulls(root, tallDrawerPantry, null, {}, 144, 120, "#d1ba8f", "#ffffff", { doorStyle: "Shaker", doorPanelType: null });
      const upperDoors: THREE.Mesh[] = [];
      const upperPulls: THREE.Object3D[] = [];
      root.traverse((node) => {
        if (node instanceof THREE.Mesh && node.userData.cabinetFront && !node.userData.cabinetDrawerFront) upperDoors.push(node);
        if (node.userData.cabinetPull === "door") upperPulls.push(node);
      });
      return {
        upperDoors: upperDoors.sort((left, right) => left.position.x - right.position.x),
        upperPulls: upperPulls.sort((left, right) => left.position.x - right.position.x),
      };
    };

    for (const constructionMethod of [undefined, AEF_PRINTED_GEOMETRY_MARKER]) {
      const { upperDoors, upperPulls } = renderTallUpperDoorPulls(constructionMethod);
      expect(upperDoors).toHaveLength(2);
      expect(upperPulls).toHaveLength(2);
      expect(upperPulls.every((pull, index) => pull.userData.pullDoorZone === "upper" && pull.position.y < upperDoors[index]!.position.y)).toBe(true);
    }
  });

  it("keeps the cabinet shell and selected Toe Kick in the finish while using recessed drawer gaps instead of ghost-prone outlines", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: 1, cabinetId: 1, masterCode: "B-30", description: "Base Cabinet",
      placementType: "base", width: 30, height: 34.5, depth: 24, mountBottom: 0, numberOfDoors: 2, numberOfDrawers: 1,
    }, null, {}, 144, 120, "#7e8d72", "#f8f8f6", { doorStyle: "Shaker", doorPanelType: "shaker" }, undefined, undefined, undefined, { selectedToeKick: true });
    const nodes: THREE.Object3D[] = [];
    root.traverse((node) => nodes.push(node));
    const toeKick = nodes.find((node) => node.userData.baseToeKick) as THREE.Mesh;
    expect((toeKick.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("7e8d72");
    const reveals = nodes.filter((node) => node.userData.cabinetDrawerReveal);
    expect(reveals.length).toBeGreaterThan(0);
    expect(reveals.every((node) => !(node instanceof THREE.LineSegments))).toBe(true);
    expect(THREE_D_DRAWER_REVEAL_DEPTH).toBe(0.002);
  });

  it("renders a stale-count B-18 lower front as a hinged door with a vertical opposite-hinge handle", () => {
    const root = new THREE.Group();
    addCabinetWithBarPulls(root, {
      distributorSkuId: 2640004,
      cabinetId: 9390004,
      masterCode: "B-18",
      description: "Base Cabinet",
      placementType: "base",
      graphicType: "standard_base",
      width: 18,
      height: 34.5,
      depth: 24,
      mountBottom: 0,
      numberOfDoors: 0,
      numberOfDrawers: 2,
      swing: "left",
    }, null, {}, 144, 120, "#7e8d72", "#f8f8f6", { doorStyle: "Shaker", doorPanelType: "shaker" });
    const pulls: THREE.Object3D[] = [];
    root.traverse((node) => { if (node.userData.cabinetHardware) pulls.push(node); });
    const doorPulls = pulls.filter((node) => node.userData.cabinetPull === "door");
    const drawerPulls = pulls.filter((node) => node.userData.cabinetPull === "drawer");
    expect(doorPulls).toHaveLength(1);
    expect(drawerPulls).toHaveLength(1);
    expect(doorPulls[0]?.userData).toMatchObject({ verticalPull: true, pullEdge: "opposite-hinge", hingeSide: "left", handleSide: "right" });
    expect(drawerPulls[0]?.userData).toMatchObject({ verticalPull: false, pullEdge: "center", handleSide: "center" });
    const doorGeometry = (doorPulls[0] as THREE.Mesh).geometry as THREE.BoxGeometry;
    const drawerGeometry = (drawerPulls[0] as THREE.Mesh).geometry as THREE.BoxGeometry;
    expect(doorGeometry.parameters.height).toBeGreaterThan(doorGeometry.parameters.width);
    expect(drawerGeometry.parameters.width).toBeGreaterThan(drawerGeometry.parameters.height);
  });

  it("preserves CDB36’s true 36-inch corner footprint and three-drawer profile from the saved 2D plan", () => {
    const cdb = {
      uid: "saved-cdb36", cabinetId: 9390027, masterCode: "CDB36", description: '36" Corner Drawer Base Cabinet',
      placement: "base", x: 0, y: 0, width: 36, depth: 36, height: 34.5, rotation: 0,
      numberOfDoors: 0, numberOfDrawers: 3, cornerType: "l-shape", customProfile: "corner-drawer-base",
    } as never;
    expect(existingCabinetTransform(cdb)).toEqual({ x: 18, z: 18, rotation: 0, bottom: 0 });
    expect(existingCabinetSku(cdb)).toMatchObject({ width: 36, depth: 36, numberOfDoors: 0, numberOfDrawers: 3, graphicType: "corner-drawer-base" });
    expect(cornerDrawerFrontLayout(3)).toEqual({ cornerMarkerWidth: 0.24, drawerStackWidth: 2.76 });
    expect(lCornerCarcassParts(3, 3)).toMatchObject({
      legWidth: 2,
      legDepth: 2,
      backLeg: { width: 3, depth: 2, x: 0, z: -0.5 },
      sideLeg: { width: 2, depth: 1, x: -0.5, z: 1 },
    });
    expect(Object.values(lCornerCarcassParts(3, 3)).filter((part) => typeof part === "object" && part !== null && "width" in part)).toHaveLength(2);
  });

  it("uses the true-L countertop over an L-corner cabinet with both fronts overhanging", () => {
    const countertop = lCornerCountertopFootprintVertices(3, 3);
    // The 24-inch base legs keep their wall-side edges seated. The back-leg
    // front and side-leg front both project 1½ inches (0.125 ft), which is the
    // same finished line carried by adjacent standard base cabinets.
    expect(countertop).toEqual([
      { x: -1.5, z: -1.5 },
      { x: 1.5, z: -1.5 },
      { x: 1.5, z: 0.625 },
      { x: 0.625, z: 0.625 },
      { x: 0.625, z: 1.5 },
      { x: -1.5, z: 1.5 },
    ]);

    const root = new THREE.Group();
    addCabinet(root, {
      masterCode: "LS3612",
      description: "36 inch Lazy Susan Base Cabinet",
      placementType: "base",
      width: 36,
      depth: 36,
      height: 34.5,
      numberOfDoors: 2,
      numberOfDrawers: 0,
      cornerGeometryKind: "l-shape",
    } as never, null, {}, 144, 120, "#7e8d72", "#f8f8f6", undefined, { x: 18, z: 18, rotation: 0 });
    const tops: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.lCornerCountertop) tops.push(node);
    });
    expect(tops).toHaveLength(1);
    expect(tops[0]!.userData).toMatchObject({
      completeLCornerCabinetTop: false,
      exactLCornerCountertopGeometry: true,
      interiorNotchPreserved: true,
      wallSideReturnsFlush: true,
    });
    expect((tops[0] as THREE.Mesh).geometry.type).toBe("ExtrudeGeometry");
    const bounds = new THREE.Box3().setFromObject(tops[0]!);
    expect((bounds.max.x - bounds.min.x) * 12).toBeCloseTo(36, 6);
    expect((bounds.max.z - bounds.min.z) * 12).toBeCloseTo(36, 6);
    // The open floor corner of the 36x36 box has no stone: the slab's far
    // corner is cut back to the two 25.5-inch overhanging fronts.
    const geometry = (tops[0] as THREE.Mesh).geometry;
    const positions = geometry.getAttribute("position");
    let coversOpenCorner = false;
    for (let i = 0; i < positions.count; i += 1) {
      if (positions.getX(i) * 12 > 25.5 + 1e-6 && positions.getZ(i) * 12 > 25.5 + 1e-6) coversOpenCorner = true;
    }
    expect(coversOpenCorner).toBe(false);
  });

  it("normalizes an older CDB36 accessible-leg save to the shared 36-inch square 2D corner footprint", () => {
    const legacyCdb = {
      uid: "legacy-cdb36", cabinetId: 9390027, masterCode: "CDB36", description: "Corner Drawer Base Cabinet",
      placement: "base", x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0,
      numberOfDoors: 0, numberOfDrawers: 3,
    } as never;
    expect(existingCabinetTransform(legacyCdb)).toEqual({ x: 18, z: 18, rotation: 0, bottom: 0 });
    expect(existingCabinetSku(legacyCdb)).toMatchObject({ width: 36, depth: 36, numberOfDoors: 0, numberOfDrawers: 3 });
  });

  it("uses the shared 2D footprint for every corner family while preserving mesh-local quarter turns", () => {
    const blind = {
      uid: "blind", cabinetId: 1, masterCode: "BBC-36", description: "Blind Corner Base",
      placement: "base", x: 0, y: 0, width: 36, depth: 6, height: 34.5, rotation: 90,
    } as never;
    const lCorner = {
      uid: "easy-reach", cabinetId: 2, masterCode: "ERB-33", description: "Easy Reach Corner",
      placement: "base", x: 36, y: 0, width: 33, depth: 24, height: 34.5, rotation: 0,
    } as never;
    const endReturn = {
      uid: "end-return", cabinetId: 3, masterCode: "BEC-24", description: "Base End Cabinet",
      placement: "base", x: 72, y: 0, width: 24, depth: 24, height: 34.5, rotation: 90,
    } as never;

    expect(threeDCornerBodyDimensions(blind)).toEqual({ width: 36, depth: 24 });
    expect(existingCabinetTransform(blind)).toMatchObject({ x: 12, z: 18, rotation: Math.PI / 2 });
    expect(existingCabinetSku(blind)).toMatchObject({ width: 36, depth: 24 });
    expect(threeDCornerBodyDimensions(lCorner)).toEqual({ width: 36, depth: 36 });
    expect(existingCabinetSku(lCorner)).toMatchObject({ width: 36, depth: 36 });
    expect(threeDCornerBodyDimensions(endReturn)).toEqual({ width: 24, depth: 24 });
    expect(existingCabinetSku(endReturn)).toMatchObject({ width: 24, depth: 24 });
  });

  it("audits every supported corner family through its shared 2D shape, 3D front, and countertop contract", () => {
    const room = { width: 144, depth: 144, ceilingHeight: 96 } as never;
    const families = [
      { uid: "triangle", cabinetId: 1, masterCode: "BTC-24", description: "Triangle Corner Base", placement: "base", x: 0, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0, cornerType: "triangle", numberOfDoors: 2, numberOfDrawers: 0 },
	      { uid: "blind", cabinetId: 2, masterCode: "BBC-36", description: "Blind Corner Base", placement: "base", x: 120, y: 0, width: 36, depth: 24, height: 34.5, rotation: 90, swing: "left", cornerType: "blind-corner", openingWidth: 11, numberOfDoors: 1, numberOfDrawers: 1 },
      { uid: "diagonal", cabinetId: 3, masterCode: "WDC2430", description: "Diagonal Wall Corner", placement: "wall", x: 0, y: 0, width: 24, depth: 12, height: 30, rotation: 0, cornerType: "diagonal", numberOfDoors: 2, numberOfDrawers: 0 },
      { uid: "l-corner", cabinetId: 4, masterCode: "LS3612", description: "Lazy Susan Base", placement: "base", x: 108, y: 108, width: 36, depth: 24, height: 34.5, rotation: 180, cornerType: "lazy-susan", numberOfDoors: 2, numberOfDrawers: 0 },
      { uid: "wall-l-corner", cabinetId: 5, masterCode: "WLS2424", description: "Wall Lazy Susan", placement: "wall", x: 108, y: 108, width: 24, depth: 12, height: 30, rotation: 180, cornerType: "lazy-susan", numberOfDoors: 2, numberOfDrawers: 0 },
      { uid: "corner-drawer", cabinetId: 6, masterCode: "CDB36", description: "Corner Drawer Base", placement: "base", x: 0, y: 108, width: 36, depth: 24, height: 34.5, rotation: 270, cornerType: "l-shape", numberOfDoors: 0, numberOfDrawers: 3 },
      { uid: "end-return", cabinetId: 7, masterCode: "BEC-24", description: "Base End Cabinet", placement: "base", x: 54, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0, numberOfDoors: 2, numberOfDrawers: 0 },
    ] as never[];
    const expectedKinds = ["triangle", "blind-corner", "diagonal", "l-shape", "l-shape", "corner-drawer", "base-end"];
    expect(families.map(placedCornerGeometryKind)).toEqual(expectedKinds);
    expect(families.map((record) => existingCabinetTransform(record, room).rotation)).toEqual([
      0,
	      -Math.PI / 2,
      0,
      Math.PI,
      Math.PI,
      // CDB36 shares the L-corner carcass with LSB, so its bottom-left plan
      // turn (270) mirrors into 3D exactly like every other corner body.
      Math.PI / 2,
      0,
    ]);
    const root = new THREE.Group();
    for (const record of families) {
      const sku = existingCabinetSku(record);
      expect(sku.cornerGeometryKind).toBe(placedCornerGeometryKind(record));
      addCabinet(root, sku, null, {}, room.width, room.depth, "#7e8d72", "#f8f8f6", undefined, existingCabinetTransform(record, room));
    }
    const nodes: THREE.Object3D[] = [];
    root.traverse((node) => nodes.push(node));
    expect(nodes.filter((node) => node.userData.triangleCornerWedge)).toHaveLength(1);
    expect(nodes.filter((node) => node.userData.triangleDoor)).toHaveLength(2);
    expect(nodes.filter((node) => node.userData.triangleCornerCountertop)).toHaveLength(1);
	    const blindBody = nodes.find((node) => node.userData.blindCornerBody) as THREE.Mesh;
	    const blindDoor = nodes.find((node) => node.userData.blindCornerExposedDoor && node.userData.blindCornerDoorSide === "left") as THREE.Mesh;
	    const blindDrawer = nodes.find((node) => node.userData.blindCornerExposedDrawer && node.userData.blindCornerDoorSide === "left") as THREE.Mesh;
	    expect(blindBody).toBeDefined();
	    expect((blindBody.geometry as THREE.BoxGeometry).parameters).toMatchObject({ width: 3, height: 30 / 12, depth: 2 });
	    expect(blindDoor).toBeDefined();
	    expect(blindDrawer).toBeDefined();
	    expect((blindDoor.geometry as THREE.BoxGeometry).parameters.width).toBeCloseTo(11 / 12 - 0.06, 6);
	    expect((blindDrawer.geometry as THREE.BoxGeometry).parameters.width).toBeCloseTo(11 / 12 - 0.06, 6);
	    expect(nodes.filter((node) => node.userData.blindCornerFixedPanel && node.userData.blindCornerBlindSide === "right")).toHaveLength(1);
	    expect(nodes.filter((node) => node.userData.blindCornerCountertop)).toHaveLength(1);
	    const blindGroup = root.children.find((node) => node.userData.masterCode === "BBC-36")!;
	    const blindToeKick = blindGroup.children.find((node) => node.userData.baseToeKick) as THREE.Mesh;
	    expect((blindToeKick.geometry as THREE.BoxGeometry).parameters.height).toBeCloseTo(4.5 / 12, 12);
	    expect((blindBody.geometry as THREE.BoxGeometry).parameters.height + (blindToeKick.geometry as THREE.BoxGeometry).parameters.height).toBeCloseTo(34.5 / 12, 12);
	    expect(blindGroup.rotation.y).toBeCloseTo(-Math.PI / 2, 12);
    expect(nodes.filter((node) => node.userData.diagonalCornerWedge)).toHaveLength(1);
    const lCornerDoors = nodes.filter((node) => node.userData.lCornerDoor) as THREE.Mesh[];
    expect(lCornerDoors).toHaveLength(4);
    const wallLCorner = root.children.find((node) => node.userData.masterCode === "WLS2424")!;
    const wallLegs = wallLCorner.children.filter((node) => node.userData.lCornerCarcass) as THREE.Mesh[];
    expect(wallLegs.map((leg) => (leg.geometry as THREE.BoxGeometry).parameters).map((parameters) => Math.min(parameters.width, parameters.depth)).sort()).toEqual([1, 1]);
    expect(nodes.filter((node) => node.userData.cornerDrawerFace)).toHaveLength(3);
    expect(nodes.filter((node) => node.userData.nonCornerEndReturnDoor)).toHaveLength(0);
    expect(nodes.filter((node) => node.userData.nonCornerEndReturnBody)).toHaveLength(0);
    expect(nodes.filter((node) => node.userData.endReturnCountertop)).toHaveLength(0);
    const lCornerCountertops = nodes.filter((node) => node.userData.lCornerCountertop);
    expect(lCornerCountertops).toHaveLength(2);
    expect(lCornerCountertops.every((node) => node.userData.exactLCornerCountertopGeometry && node.userData.wallSideReturnsFlush && !node.userData.coversCompleteCabinetTop)).toBe(true);
    expect(triangleCornerFootprintVertices(2, 2)).toEqual([{ x: -1, z: -1 }, { x: 1, z: -1 }, { x: 1, z: 1 }]);
    expect(triangleCornerFrontWidth(24, 24)).toBeCloseTo(Math.hypot(24, 24), 12);
  });

  it("preserves a legacy triangle-corner's exact non-square shared 2D envelope in its 3D wedge", () => {
    const legacyTriangle = {
      uid: "legacy-btc30", cabinetId: 8, masterCode: "BTC-30", description: "Triangle Corner Base",
      placement: "base", x: 0, y: 0, width: 30, depth: 24, height: 34.5, rotation: 0,
      cornerType: "triangle", numberOfDoors: 2, numberOfDrawers: 0,
    } as never;
    expect(placedCornerGeometryKind(legacyTriangle)).toBe("triangle");
    expect(existingCabinetTransform(legacyTriangle)).toEqual({ x: 15, z: 12, rotation: 0, bottom: 0 });
    expect(existingCabinetSku(legacyTriangle)).toMatchObject({ width: 30, depth: 24, cornerGeometryKind: "triangle" });
  });

  it("preserves live saved oven, measured drawer, specialty, and selected door-sample fields in the 3D scene contract", () => {
    const placed = [{
      uid: "live-oven", cabinetId: 9390085, masterCode: "UOC3396", description: '33" x 96" Universal Oven Cabinet - 30" x 39.75" Oven Opening - 2 Doors 3 Drawers',
      placement: "tall", x: 24, y: 0, width: 33, depth: 24, height: 96, rotation: 0,
      numberOfDoors: 0, numberOfDrawers: 0, ovenType: "double", drawerLayout: JSON.stringify([{ count: 1, height: 6 }]), customProfile: "end-angle", facePattern: "lattice",
    }] as never[];
    const contract = threeDSceneInputDiagnostics(placed, "/manus-storage/selected-door.png");
    expect(contract).toMatchObject({ cabinetCount: 1, ovenTowerCount: 1, measuredDrawerCabinetCount: 1, specialtyCabinetCount: 1, doorSampleUrl: "/manus-storage/selected-door.png" });
    expect(contract.mapped[0]).toMatchObject({ masterCode: "UOC3396", ovenType: "double", drawerLayout: JSON.stringify([{ count: 1, height: 6 }]), graphicType: "end-angle", facePattern: "lattice" });
    expect(existingCabinetSku(placed[0])).toMatchObject({ placementType: "tall", height: 96, width: 33, depth: 24 });
  });

  it("renders a saved UOC oven tower as its tall enclosure with cabinet doors, drawers, and oven cutout", () => {
    const placed = {
      uid: "uoc-tall", cabinetId: 9390085, masterCode: "UOC3396", description: '33" x 96" Universal Oven Cabinet - 30" x 39.75" Oven Opening - 2 Doors 3 Drawers',
      placement: "tall", x: 0, y: 0, width: 33, depth: 24, height: 96, rotation: 0,
      numberOfDoors: 2, numberOfDrawers: 3, ovenType: "double",
    } as never;
    const root = new THREE.Group();
    addCabinet(root, existingCabinetSku(placed), null, {}, 144, 120, "#d7c49a", "#f8f8f6");
    const meshMarkers: Record<string, number> = { ovenCabinetDoor: 0, ovenCabinetDrawer: 0, ovenOpening: 0, ovenApplianceDoor: 0, ovenGlassDoor: 0, ovenDoorHandle: 0 };
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.userData.ovenCabinetDoor) meshMarkers.ovenCabinetDoor += 1;
      if (node.userData.ovenCabinetDrawer) meshMarkers.ovenCabinetDrawer += 1;
      if (node.userData.ovenOpeningWidthIn != null) meshMarkers.ovenOpening += 1;
      if (node.userData.ovenCabinetApplianceDoor) meshMarkers.ovenApplianceDoor += 1;
      if (node.userData.ovenGlassDoor) meshMarkers.ovenGlassDoor += 1;
      if (node.userData.ovenDoorHandle) meshMarkers.ovenDoorHandle += 1;
    });
    expect(existingCabinetSku(placed).placementType).toBe("tall");
    expect(meshMarkers).toEqual({ ovenCabinetDoor: 2, ovenCabinetDrawer: 1, ovenOpening: 1, ovenApplianceDoor: 2, ovenGlassDoor: 2, ovenDoorHandle: 2 });
  });

  it("keeps Preston Air Dawn O339624 upper oven-door pulls inside their doors with their lower ends 2½–3 inches above the bottom rail", () => {
    const root = new THREE.Group();
    addCabinetWithBarPulls(root, {
      distributorSkuId: 339624, cabinetId: 339624, masterCode: "O339624", description: '33" x 96" Oven Cabinet — 2 Doors, 3 Drawers',
      placementType: "tall", width: 33, height: 96, depth: 24, numberOfDoors: 2, numberOfDrawers: 3,
      openingType: "middle", ovenType: "double",
    } as never, null, {}, 144, 120, "#d5d0bf", "#f8f8f6", { doorStyle: "Air Dawn", doorPanelType: null });

    const doors: THREE.Mesh[] = [];
    const pulls: THREE.Mesh[] = [];
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.userData.ovenCabinetDoor) doors.push(node);
      if (node.userData.cabinetHardware && node.userData.cabinetPull === "door" && node.userData.pullDoorZone === "upper") pulls.push(node);
    });
    doors.sort((left, right) => left.position.x - right.position.x);
    pulls.sort((left, right) => left.position.x - right.position.x);
    expect(doors).toHaveLength(2);
    expect(pulls).toHaveLength(2);
    for (let index = 0; index < 2; index++) {
      const door = doors[index]!;
      const pull = pulls[index]!;
      const doorHeight = (door.geometry as THREE.BoxGeometry).parameters.height;
      const bottomRailY = door.position.y - doorHeight / 2;
      const pullHeight = (pull.geometry as THREE.BoxGeometry).parameters.height;
      const pullBottomDistanceAboveBottomRailIn = (pull.position.y - pullHeight / 2 - bottomRailY) * 12;
      const topRailY = door.position.y + doorHeight / 2;
      expect(pull.userData).toMatchObject({ pullDoorZone: "upper", pullVerticalRail: "bottom", pullEdge: "opposite-hinge" });
      expect(pullBottomDistanceAboveBottomRailIn).toBeGreaterThanOrEqual(2.5);
      expect(pullBottomDistanceAboveBottomRailIn).toBeLessThanOrEqual(3);
      expect(pull.position.y + pullHeight / 2).toBeLessThanOrEqual(topRailY);
    }
  });

  it("renders AEF refrigerator-wall and source oven faces with one selected pull per cabinet front", () => {
    const count = (root: THREE.Group, predicate: (node: THREE.Object3D) => boolean) => {
      const nodes: THREE.Object3D[] = [];
      root.traverse((node) => { if (predicate(node)) nodes.push(node); });
      return nodes.length;
    };
    const barPull = (node: THREE.Object3D, kind: "door" | "drawer") =>
      node.userData.cabinetHardware && node.userData.cabinetPull === kind && node.userData.hardwareStyleId === "bar-pull";

    const refrigeratorWall = new THREE.Group();
    addCabinetWithBarPulls(refrigeratorWall, {
      distributorSkuId: 361224, cabinetId: 361224, masterCode: "W361224", description: "36-inch refrigerator wall cabinet",
      placementType: "wall", width: 36, height: 12.625, depth: 24, mountBottom: 72,
      numberOfDoors: 2, numberOfDrawers: 0,
    } as never, null, {}, 144, 120, "#d1ba8f", "#ffffff", { doorStyle: "Shaker", doorPanelType: null });
    expect(count(refrigeratorWall, (node) => node instanceof THREE.Mesh && node.userData.cabinetFront && !node.userData.cabinetDrawerFront)).toBe(2);
    expect(count(refrigeratorWall, (node) => node.userData.wallCabinetDoorSeam)).toBe(1);
    expect(count(refrigeratorWall, (node) => barPull(node, "door"))).toBe(2);

    const singleOven = new THREE.Group();
    const singleOvenSku = existingCabinetSku({
      uid: "aef-tos2db3084", cabinetId: 1, masterCode: "TOS2DB3084", description: "30-inch tall single oven cabinet",
      placement: "tall", x: 0, y: 0, rotation: 0, width: 30, height: 84, depth: 24, numberOfDoors: 2, numberOfDrawers: 2,
      openingType: "middle", ovenType: "single", sourceOvenDrawerLayout: true, drawerLayout: JSON.stringify([{ count: 1 }, { count: 1 }]),
      constructionMethod: AEF_PRINTED_GEOMETRY_MARKER,
    } as never);
    expect(singleOvenSku.constructionMethod).toBe(AEF_PRINTED_GEOMETRY_MARKER);
    addCabinetWithBarPulls(singleOven, singleOvenSku, null, {}, 144, 120, "#d1ba8f", "#ffffff", { doorStyle: "Shaker", doorPanelType: null });
    expect(count(singleOven, (node) => node.userData.ovenCabinetDoor)).toBe(2);
    expect(count(singleOven, (node) => node.userData.ovenCabinetDrawer)).toBe(2);
    expect(count(singleOven, (node) => node.userData.ovenCabinetApplianceDoor)).toBe(1);
    expect(count(singleOven, (node) => barPull(node, "door"))).toBe(2);
    expect(count(singleOven, (node) => barPull(node, "drawer"))).toBe(2);
    const upperDoors: THREE.Mesh[] = [];
    const upperDoorPulls: THREE.Mesh[] = [];
    singleOven.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.userData.ovenCabinetDoor) upperDoors.push(node);
      if (barPull(node, "door")) upperDoorPulls.push(node);
    });
    upperDoors.sort((left, right) => left.position.x - right.position.x);
    upperDoorPulls.sort((left, right) => left.position.x - right.position.x);
    expect(upperDoorPulls.map((pull) => pull.userData)).toMatchObject([
      { pullDoorZone: "upper", pullEdge: "opposite-hinge", hingeSide: "left", handleSide: "right" },
      { pullDoorZone: "upper", pullEdge: "opposite-hinge", hingeSide: "right", handleSide: "left" },
    ]);
    // AEF oven tower doors follow the framed upper-door convention: pulls are
    // on the meeting stile and lower than each upper-door center, not raised
    // to the tall/pantry rail.
    expect(upperDoorPulls[0]!.position.x).toBeGreaterThan(upperDoors[0]!.position.x);
    expect(upperDoorPulls[1]!.position.x).toBeLessThan(upperDoors[1]!.position.x);
    expect(upperDoorPulls[0]!.position.y).toBeLessThan(upperDoors[0]!.position.y);
    expect(upperDoorPulls[1]!.position.y).toBeLessThan(upperDoors[1]!.position.y);

    const doubleOven = new THREE.Group();
    addCabinetWithBarPulls(doubleOven, {
      distributorSkuId: 2, cabinetId: 2, masterCode: "TOD3084", description: "30-inch tall double oven cabinet",
      placementType: "tall", width: 30, height: 84, depth: 24, numberOfDoors: 2, numberOfDrawers: 1,
      openingType: "middle", ovenType: "double", sourceOvenDrawerLayout: true, drawerLayout: JSON.stringify([{ count: 1 }]),
    } as never, null, {}, 144, 120, "#d1ba8f", "#ffffff", { doorStyle: "Shaker", doorPanelType: null });
    expect(count(doubleOven, (node) => node.userData.ovenCabinetDoor)).toBe(2);
    expect(count(doubleOven, (node) => node.userData.ovenCabinetDrawer)).toBe(1);
    expect(count(doubleOven, (node) => node.userData.ovenCabinetApplianceDoor)).toBe(2);
    expect(count(doubleOven, (node) => barPull(node, "door"))).toBe(2);
    expect(count(doubleOven, (node) => barPull(node, "drawer"))).toBe(1);
  });

  it("normalizes the retired top-center override for saved Island mode and 4½-inch floor wall cabinets", () => {
    const floorWall = existingCabinetSku({
      uid: "floor-wall", cabinetId: 1, masterCode: "W1830", description: "Floor wall",
      placement: "wall", x: 0, y: 0, width: 18, height: 30, depth: 12, rotation: 0,
      mountBottom: 4.5, hardwarePosition: "top-center",
    } as never);
    const islandWall = existingCabinetSku({
      uid: "island-wall", cabinetId: 2, masterCode: "W2430", description: "Island wall",
      placement: "wall", x: 24, y: 48, width: 24, height: 30, depth: 12, rotation: 180,
      mountBottom: 54, islandFace: "back", islandCounterHeightWallCabinet: true, hardwarePosition: "top-center",
    } as never);

    expect(floorWall).toMatchObject({ mountBottom: 4.5, hardwarePosition: "auto" });
    expect(islandWall).toMatchObject({ mountBottom: 54, islandFace: "back", islandCounterHeightWallCabinet: true, hardwarePosition: "auto" });
  });

  it("maps mixed saved designs through one 2D-to-3D contract without design-specific scene branches", () => {
    const placed = [
      { uid: "cdb", cabinetId: 1, masterCode: "CDB36", description: "Corner Drawer Base", placement: "base", x: 0, y: 0, width: 36, depth: 36, height: 34.5, rotation: 0, numberOfDoors: 0, numberOfDrawers: 3, cornerType: "l-shape", customProfile: "corner-drawer-base" },
      { uid: "bmc", cabinetId: 2, masterCode: "BMC30", description: "Microwave Base", placement: "base", x: 36, y: 0, width: 30, depth: 24, height: 34.5, rotation: 0, numberOfDoors: 0, numberOfDrawers: 1, openingType: "top" },
      { uid: "dishwasher", cabinetId: 0, masterCode: "DW-24", description: "Dishwasher 24", placement: "appliance", x: 66, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0 },
      { uid: "wall", cabinetId: 3, masterCode: "W-30-42", description: "Wall Cabinet", placement: "wall", x: 0, y: 36, width: 30, depth: 12, height: 42, rotation: 0, mountBottom: 54, numberOfDoors: 2, numberOfDrawers: 0 },
      { uid: "end-return", cabinetId: 4, masterCode: "BEC-24", description: "Base End Cabinet", placement: "base", x: 90, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0, numberOfDoors: 2, numberOfDrawers: 0, customProfile: "base_end_return" },
    ] as never[];
    const diagnostics = threeDSceneInputDiagnostics(placed, "/manus-storage/live-door.png");

    expect(diagnostics).toMatchObject({ cabinetCount: 5, doorSampleUrl: "/manus-storage/live-door.png", specialtyCabinetCount: 2 });
    expect(diagnostics.mapped.map((cabinet) => cabinet.masterCode)).toEqual(["CDB36", "BMC30", "DW-24", "W-30-42", "BEC-24"]);
    expect(resolvedThreeDFaceLayout(diagnostics.mapped[1]!)).toEqual({ hasConfiguredOpening: true, doorCount: 0, drawerCount: 1 });
    expect(resolvedThreeDSpecialtyProfile(diagnostics.mapped[0]!)).toEqual({ kind: "corner-drawer", pattern: null });
    expect(resolvedThreeDSpecialtyProfile(diagnostics.mapped[4]!)).toEqual({ kind: "standard", pattern: null });
    expect(shouldRenderCountertopOverSceneItem("appliance", diagnostics.mapped[2]!.masterCode)).toBe(true);
    expect(existingCabinetTransform(placed[3])).toMatchObject({ x: 15, z: 42, bottom: 54 });
  });

  it("maps the active WDC2442 wall corner through its shared 24-inch diagonal footprint", () => {
    const wdc = {
      uid: "active-wdc", cabinetId: 2, masterCode: "WDC2442", description: "24 inch Diagonal Wall Corner Cabinet",
      placement: "wall", x: 0, y: 0, width: 24, depth: 12, height: 42, rotation: 0,
      numberOfDoors: 2, numberOfDrawers: 0,
    } as never;
    const mapped = existingCabinetSku(wdc);
    expect(placedCornerGeometryKind(wdc)).toBe("diagonal");
    expect(mapped).toMatchObject({ masterCode: "WDC2442", width: 24, depth: 24, cornerType: "diagonal" });
    expect(resolvedThreeDSpecialtyProfile(mapped)).toEqual({ kind: "diagonal-corner", pattern: null });
    expect(diagonalCornerFootprintVertices(2, 2)).toEqual([
      { x: -1, z: -1 },
      { x: 1, z: -1 },
      { x: 1, z: 0 },
      { x: 0, z: 1 },
      { x: -1, z: 1 },
    ]);
  });

  it("extends only the diagonal 45-degree corner face by the finished countertop overhang", () => {
    const body = diagonalCornerFootprintVertices(24, 24);
    const countertop = diagonalCornerCountertopFootprintVertices(24, 24, 1.5);
    // Wall-side returns retain their exact cabinet contact; stone moves only
    // forward along the diagonal front, which is the physical finished edge.
    expect(countertop.slice(0, 2)).toEqual(body.slice(0, 2));
    expect(countertop[2]!.x).toBeGreaterThan(body[2]!.x);
    expect(countertop[2]!.z).toBeGreaterThan(body[2]!.z);
    expect(countertop[3]!.x).toBeGreaterThan(body[3]!.x);
    expect(countertop[3]!.z).toBeGreaterThan(body[3]!.z);
    expect(Math.hypot(countertop[2]!.x - body[2]!.x, countertop[2]!.z - body[2]!.z)).toBeCloseTo(1.5, 8);
    expect(Math.hypot(countertop[3]!.x - body[3]!.x, countertop[3]!.z - body[3]!.z)).toBeCloseTo(1.5, 8);
  });

  it("generates a base diagonal-corner countertop with explicit 45-degree epoxy-miter seam metadata", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -320,
      cabinetId: 320,
      masterCode: "DC36",
      description: '36" Diagonal Corner Base Cabinet',
      placementType: "base",
      width: 36,
      height: 34.5,
      depth: 36,
      numberOfDoors: 2,
      numberOfDrawers: 0,
      cornerGeometryKind: "diagonal",
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 0, z: 0, rotation: 0 });
    const tops: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.diagonalCornerCountertop) tops.push(node);
    });
    expect(tops).toHaveLength(1);
    expect(tops[0]!.userData).toMatchObject({
      exactDiagonalCornerGeometry: true,
      cornerFaceAngleDegrees: 45,
      frontOverhangIn: 1.5,
      wallSideReturnsFlush: true,
      epoxyMiterSeamAngleDegrees: 45,
      epoxyMiterSeamCompatible: true,
    });
  });

  it("renders a glass-selected WDC2442 as one framed transparent diagonal door with its three configured shelves", () => {
    const wdc = {
      uid: "glass-wdc2442",
      cabinetId: 9390174,
      masterCode: "WDC2442",
      description: '24" Diagonal Corner Wall Cabinet with 3 Adjustable Shelves',
      placement: "wall",
      x: 0,
      y: 0,
      width: 24,
      depth: 12,
      height: 42,
      rotation: 0,
      numberOfDoors: 1,
      numberOfDrawers: 0,
      adjustableShelfCount: 3,
      glassDoor: true,
      glassDoorAddonCode: "PGWDC42",
    } as never;
    const sku = existingCabinetSku(wdc);
    expect(sku).toMatchObject({ glassDoor: true, adjustableShelfCount: 3, numberOfDoors: 1 });

    const root = new THREE.Group();
    addCabinet(
      root,
      sku,
      null,
      {},
      144,
      120,
      "#b78a54",
      "#f8f8f6",
      { doorStyle: "Shaker", doorPanelType: "recessed" },
      existingCabinetTransform(wdc, { width: 144, depth: 120, ceilingHeight: 96 } as never),
    );
    const nodes: THREE.Object3D[] = [];
    root.traverse((node) => nodes.push(node));
    const glassDoors = nodes.filter((node) => node.userData.glassCabinetDoor) as THREE.Mesh[];
    expect(glassDoors).toHaveLength(1);
    expect(glassDoors[0]?.material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect((glassDoors[0]?.material as THREE.MeshPhysicalMaterial).transparent).toBe(true);
    expect(nodes.filter((node) => node.userData.diagonalGlassShelf)).toHaveLength(3);
	    expect(nodes.filter((node) => node.userData.selectedStyleFace === "glass-door-frame")).toHaveLength(5);
	    expect(nodes.filter((node) => node.userData.glassDoorFrameRail)).toHaveLength(4);
  });

  it("uses the 17-inch diagonal front created by two 12-inch WDC returns", () => {
    expect(diagonalCornerFrontWidth(24, 24)).toBeCloseTo(Math.hypot(12, 12), 8);
    expect(diagonalCornerFrontWidth(24, 24)).toBeCloseTo(16.97056275, 6);
  });

  it("maps LS3612 through the restored saved 36-inch L-corner conversion as its 2D footprint", () => {
    const ls36 = {
      uid: "ls36", cabinetId: 3612, masterCode: "LS3612", description: "36 inch Lazy Susan Base Cabinet",
      placement: "base", x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0,
      numberOfDoors: 2, numberOfDrawers: 0, cornerType: "lazy-susan",
    } as never;
    const mapped = existingCabinetSku(ls36);
    expect(placedCornerGeometryKind(ls36)).toBe("l-shape");
    expect(mapped).toMatchObject({ masterCode: "LS3612", width: 36, depth: 36, cornerType: "l-shape" });
    expect(resolvedThreeDSpecialtyProfile(mapped)).toEqual({ kind: "l-corner", pattern: null });
    const lShape = lCornerCarcassParts(3, 3);
    expect(lShape).toMatchObject({
      backLeg: { width: 3, depth: 2 },
      sideLeg: { width: 2, depth: 1 },
    });
    expect(lShape.backLeg.width).toBe(36 / 12);
    expect(lShape.backLeg.depth).toBe(24 / 12);
    expect(lShape.backLeg.width - lShape.sideLeg.width).toBe(12 / 12);
  });

  it("renders each 33-inch base L-corner with its source-backed 24-inch legs while preserving the 36-inch datum", () => {
    const fixtures = [
      { masterCode: "ERB33", description: "33 inch Easy Reach Base Cabinet", side: 33 },
      { masterCode: "BER33", description: "33 inch Base Easy Reach Corner Cabinet", side: 33 },
      { masterCode: "LSB33", description: "33 inch Lazy Susan Base Cabinet", side: 33 },
      { masterCode: "ERB36", description: "36 inch Easy Reach Base Cabinet", side: 36 },
    ] as const;

    for (const fixture of fixtures) {
      const placed = {
        uid: `${fixture.masterCode}-base-leg-depth`,
        cabinetId: fixture.side,
        masterCode: fixture.masterCode,
        description: fixture.description,
        placement: "base",
        x: 0,
        y: 0,
        width: fixture.side,
        depth: 24,
        height: 34.5,
        rotation: 0,
        numberOfDoors: 2,
        numberOfDrawers: 0,
        cornerType: "l-shape",
      } as never;
      const expectedRatio = 24 / fixture.side;
      expect(cornerLegRatioForPlaced(placed)).toBeCloseTo(expectedRatio, 12);

      const root = new THREE.Group();
      addCabinet(
        root,
        existingCabinetSku(placed),
        null,
        {},
        144,
        120,
        "#d1ba8f",
        "#ffffff",
        { doorStyle: "Shaker", doorPanelType: null },
        existingCabinetTransform(placed),
      );

      const carcassSpansIn: number[] = [];
      const doors: THREE.Mesh[] = [];
      const toeKicks: THREE.Mesh[] = [];
      root.traverse((node) => {
        if (node.userData.lCornerCarcass && node instanceof THREE.Mesh) {
          const geometry = node.geometry as THREE.BoxGeometry;
          carcassSpansIn.push(geometry.parameters.width * 12, geometry.parameters.depth * 12);
        }
        if (node.userData.lCornerDoor && node instanceof THREE.Mesh) doors.push(node);
        if (node.userData.lCornerToeKick && node instanceof THREE.Mesh) toeKicks.push(node);
      });

      expect(carcassSpansIn.sort((left, right) => left - right)).toEqual([
        fixture.side - 24,
        24,
        24,
        fixture.side,
      ]);
      const backDoor = doors.find((door) => door.userData.lCornerDoor === "back-leg");
      expect(backDoor).toBeDefined();
      expect(backDoor!.position.z * 12).toBeCloseTo(24 - fixture.side / 2 + 0.36, 12);
      const backToeKick = toeKicks.find((kick) => kick.userData.lCornerToeKickSide === "back-leg");
      expect(backToeKick).toBeDefined();
      expect(backToeKick!.position.z * 12).toBeCloseTo(24 - fixture.side / 2 - 3.12, 12);

      const countertop = lCornerCountertopFootprintVertices(
        fixture.side / 12,
        fixture.side / 12,
        expectedRatio,
        1.5 / 12,
      );
      const finishedFrontIn = 24 - fixture.side / 2 + 1.5;
      expect(countertop[2]!.z * 12).toBeCloseTo(finishedFrontIn, 12);
      expect(countertop[3]!.x * 12).toBeCloseTo(finishedFrontIn, 12);
      expect(countertop[3]!.z * 12).toBeCloseTo(finishedFrontIn, 12);
    }
  });

  it("uses the LS36 36-by-36 L envelope for CDB36 while retaining CDB’s corner-drawer front", () => {
    const cdb36 = {
      uid: "cdb36", cabinetId: 9390027, masterCode: "CDB36", description: '36" Corner Drawer Base Cabinet',
      placement: "base", x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0,
      numberOfDoors: 0, numberOfDrawers: 3, cornerType: "l-shape",
    } as never;
    const ls36 = {
      uid: "ls36", cabinetId: 3612, masterCode: "LS3612", description: "36 inch Lazy Susan Base Cabinet",
      placement: "base", x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0,
      numberOfDoors: 2, numberOfDrawers: 0, cornerType: "lazy-susan",
    } as never;
    const cdbSku = existingCabinetSku(cdb36);
    const lsSku = existingCabinetSku(ls36);
    expect(cdbSku).toMatchObject({ width: 36, depth: 36, height: 34.5 });
    expect(lsSku).toMatchObject({ width: 36, depth: 36, height: 34.5 });
    expect(resolvedThreeDSpecialtyProfile(cdbSku)).toEqual({ kind: "corner-drawer", pattern: null });
    expect(resolvedThreeDSpecialtyProfile(lsSku)).toEqual({ kind: "l-corner", pattern: null });
  });

  it("mounts persisted LS3612 doors and Shaker rails on the restored two-leg L-corner face", () => {
    const ls36 = {
      uid: "live-ls36", cabinetId: 9390049, masterCode: "LS3612", description: "36 inch Lazy Susan Base Cabinet",
      placement: "base", x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0,
      numberOfDoors: 2, numberOfDrawers: 0, cornerType: "lazy-susan",
    } as never;
    const root = new THREE.Group();
    addCabinet(root, existingCabinetSku(ls36), null, {}, 144, 120, "#f2f0ea", "#ffffff", { doorStyle: "Shaker", doorPanelType: null }, existingCabinetTransform(ls36));
    const lCornerDoors: THREE.Object3D[] = [];
    root.traverse((node) => { if (node.userData.lCornerDoor) lCornerDoors.push(node); });
    const texturedSideSkins: THREE.Object3D[] = [];
    root.traverse((node) => { if (node.userData.selectedStyleSideSkin) texturedSideSkins.push(node); });

    expect(lCornerDoors).toHaveLength(2);
    expect(texturedSideSkins).toHaveLength(2);
    expect(lCornerDoors.every((door) => door.userData.cabinetFront === true)).toBe(true);
    expect(texturedSideSkins.every((skin) => skin.userData.cabinetFront !== true)).toBe(true);
    expect(texturedSideSkins.every((skin) => {
      const material = (skin as THREE.Mesh).material as THREE.MeshStandardMaterial;
      return material.userData.selectedFinishSideSkin === true
        && material.userData.usesDoorImage === false
        && material.map === null;
    })).toBe(true);
    expect(lCornerDoors.map((door) => door.userData.lCornerDoor).sort()).toEqual(["back-leg", "side-leg"]);
    expect(lCornerDoors.map((door) => door.rotation.y).sort((a, b) => a - b)).toEqual([0, Math.PI / 2]);
    root.updateMatrixWorld(true);
    const cabinet = root.children.find((node) => node.userData.masterCode === "LS3612")!;
    const cabinetPosition = new THREE.Vector3();
    cabinet.getWorldPosition(cabinetPosition);
    for (const door of lCornerDoors) {
      const doorPosition = new THREE.Vector3();
      door.getWorldPosition(doorPosition);
      expect(Math.abs(doorPosition.z - cabinetPosition.z)).toBeLessThanOrEqual(1.55);
    }
    for (const door of lCornerDoors) {
      const mesh = door as THREE.Mesh;
      expect((mesh.geometry as THREE.BoxGeometry).parameters.width).toBeCloseTo(12 / 12 - 0.09, 12);
    }
    const shakerFrames: THREE.Object3D[] = [];
    root.traverse((node) => { if (node.userData.selectedStyleFace === "shaker") shakerFrames.push(node); });
    expect(shakerFrames.length).toBeGreaterThan(0);
    const interiorEdgeLines: THREE.Object3D[] = [];
    root.traverse((node) => { if (node instanceof THREE.LineSegments) interiorEdgeLines.push(node); });
    expect(interiorEdgeLines).toHaveLength(0);
  });

  it("puts lazy-Susan and easy-reach base pulls on the opening edge opposite the selected hinge", () => {
    for (const [masterCode, description, swing, expectedHandle] of [
      ["LSB36", "Lazy Susan Base", "left", "right"],
      ["ERB36", "Easy Reach Base", "right", "left"],
    ] as const) {
	      const cabinet = { uid: `${masterCode}-${swing}`, cabinetId: 1, masterCode, description, placement: "base", x: 0, y: 0, width: 36, depth: 36, height: 34.5, rotation: 0, numberOfDoors: 2, numberOfDrawers: 0, cornerType: "l-shape", swing } as never;
	      const root = new THREE.Group();
	      addCabinet(root, existingCabinetSku(cabinet), null, {}, 144, 120, "#d1ba8f", "#ffffff", { doorStyle: "Shaker", doorPanelType: null }, existingCabinetTransform(cabinet), undefined, undefined, { hardwareStyleId: "bar-pull" });
      const pulls: THREE.Object3D[] = [];
      root.traverse((node) => { if (node.userData.lCornerHingeOppositePull) pulls.push(node); });
      expect(pulls).toHaveLength(1);
      expect(pulls[0]?.userData).toMatchObject({ hingeSide: swing, handleSide: expectedHandle, pullEdge: "opposite-hinge" });
      expect(pulls[0]?.userData).toMatchObject({ frameWidthIn: 3, frameCenterInsetIn: 1.5 });
      expect(pulls[0]?.userData.pullHeight).toBe("upper-opening-edge");
      expect(pulls[0]?.position.y).toBeGreaterThan(0);
      const operativeDoor: THREE.Mesh[] = [];
      root.traverse((node) => {
        if (node.userData.lCornerDoor === (swing === "left" ? "back-leg" : "side-leg") && node instanceof THREE.Mesh) operativeDoor.push(node);
      });
      expect(operativeDoor).toHaveLength(1);
      const doorWidth = (operativeDoor[0]!.geometry as THREE.BoxGeometry).parameters.width;
      const lateralOffset = swing === "left"
        ? Math.abs(pulls[0]!.position.x - operativeDoor[0]!.position.x)
        : Math.abs(pulls[0]!.position.z - operativeDoor[0]!.position.z);
      expect((doorWidth / 2 - lateralOffset) * 12).toBeCloseTo(1.5, 8);
    }
  });

  it("renders WER2442's selected handle package on its operable wall easy-reach door", () => {
    const wer2442 = {
      uid: "wer2442-hardware",
      cabinetId: 9360134,
      masterCode: "WER2442",
      description: '24" X 42" Wall Easy Reach Corner Cabinet',
      placement: "wall",
      placementType: "wall",
      graphicType: "wall_easy_reach",
      x: 0,
      y: 0,
      width: 24,
      depth: 12,
      height: 42,
      rotation: 0,
      numberOfDoors: 2,
      numberOfDrawers: 0,
      swing: "right",
    } as never;

    const withoutHardware = new THREE.Group();
    addCabinet(withoutHardware, existingCabinetSku(wer2442), null, {}, 144, 120, "#d1ba8f", "#ffffff", { doorStyle: "Shaker", doorPanelType: null }, existingCabinetTransform(wer2442), undefined, undefined, { hardwareStyleId: "none" });
    const noHandles: THREE.Object3D[] = [];
    withoutHardware.traverse((node) => { if (node.userData.cabinetHardware) noHandles.push(node); });
    expect(noHandles).toHaveLength(0);

    const withBarPull = new THREE.Group();
    addCabinet(withBarPull, existingCabinetSku(wer2442), null, {}, 144, 120, "#d1ba8f", "#ffffff", { doorStyle: "Shaker", doorPanelType: null }, existingCabinetTransform(wer2442), undefined, undefined, { hardwareStyleId: "bar-pull" });
    const pulls: THREE.Object3D[] = [];
    withBarPull.traverse((node) => { if (node.userData.lCornerHingeOppositePull) pulls.push(node); });
    expect(pulls).toHaveLength(1);
    expect(pulls[0]?.userData).toMatchObject({
      cabinetHardware: true,
      cabinetPull: "door",
      hingeSide: "right",
      handleSide: "left",
      pullEdge: "opposite-hinge",
    });
  });

  it("keeps normally mounted wall-cabinet pulls inside their bottom door frames while retaining the floor-seated exception", () => {
    const render = (cabinet: Record<string, unknown>) => {
      const root = new THREE.Group();
      addCabinetWithBarPulls(root, cabinet as never, null, {}, 144, 120, "#d1ba8f", "#ffffff", { doorStyle: "Shaker", doorPanelType: null });
      return root;
    };
    const pairedWall = render({
      distributorSkuId: 2442, cabinetId: 2442, masterCode: "W2442", description: '24" x 42" Wall Cabinet',
      placementType: "wall", width: 24, height: 42, depth: 12, mountBottom: 54, numberOfDoors: 2, numberOfDrawers: 0,
    });
    const wallDoors: THREE.Mesh[] = [];
    const wallPulls: THREE.Mesh[] = [];
    pairedWall.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.userData.cabinetFront && !node.userData.cabinetDrawerFront) wallDoors.push(node);
      if (node.userData.cabinetHardware && node.userData.cabinetPull === "door") wallPulls.push(node);
    });
    wallDoors.sort((left, right) => left.position.x - right.position.x);
    wallPulls.sort((left, right) => left.position.x - right.position.x);
    expect(wallDoors).toHaveLength(2);
    expect(wallPulls).toHaveLength(2);
    for (let index = 0; index < wallDoors.length; index += 1) {
      const door = wallDoors[index]!;
      const pull = wallPulls[index]!;
      const bottomRailY = door.position.y - (door.geometry as THREE.BoxGeometry).parameters.height / 2;
      const pullHeight = (pull.geometry as THREE.BoxGeometry).parameters.height;
      expect((pull.position.y - pullHeight / 2 - bottomRailY) * 12).toBeCloseTo(2.75, 8);
      expect(pull.position.y + pullHeight / 2).toBeLessThanOrEqual(door.position.y + (door.geometry as THREE.BoxGeometry).parameters.height / 2);
      expect(pull.userData).toMatchObject({ pullVerticalRail: "bottom", pullEdge: "opposite-hinge" });
    }

    const werRoot = new THREE.Group();
    const wer2442 = {
      uid: "wer2442-bottom-rail", cabinetId: 9360134, masterCode: "WER2442", description: '24" X 42" Wall Easy Reach Corner Cabinet',
      placement: "wall", x: 0, y: 0, width: 24, height: 42, depth: 12, mountBottom: 54, rotation: 0,
      numberOfDoors: 2, numberOfDrawers: 0, swing: "right", graphicType: "wall_easy_reach",
    } as never;
    addCabinetWithBarPulls(werRoot, existingCabinetSku(wer2442), null, {}, 144, 120, "#d1ba8f", "#ffffff", { doorStyle: "Shaker", doorPanelType: null }, existingCabinetTransform(wer2442));
    const werDoor = (() => {
      let result: THREE.Mesh | null = null;
      werRoot.traverse((node) => { if (node instanceof THREE.Mesh && node.userData.lCornerDoor === "side-leg") result = node; });
      return result;
    })();
    const werPull = (() => {
      let result: THREE.Mesh | null = null;
      werRoot.traverse((node) => { if (node instanceof THREE.Mesh && node.userData.lCornerHingeOppositePull) result = node; });
      return result;
    })();
    expect(werDoor).not.toBeNull();
    expect(werPull).not.toBeNull();
    const werBottomRailY = werDoor!.position.y - (werDoor!.geometry as THREE.BoxGeometry).parameters.height / 2;
    const werPullHeight = (werPull!.geometry as THREE.BoxGeometry).parameters.height;
    expect((werPull!.position.y - werPullHeight / 2 - werBottomRailY) * 12).toBeCloseTo(2.75, 8);
    expect(werPull!.position.y + werPullHeight / 2).toBeLessThanOrEqual(werDoor!.position.y + (werDoor!.geometry as THREE.BoxGeometry).parameters.height / 2);
    expect(werPull!.userData).toMatchObject({ pullHeight: "bottom-door-rail", pullVerticalRail: "bottom" });

    const floorWall = render({
      distributorSkuId: 1800, cabinetId: 1800, masterCode: "W1830", description: '18" x 30" Floor-seated Wall Cabinet',
      placementType: "wall", width: 18, height: 30, depth: 12, mountBottom: 4.5, numberOfDoors: 1, numberOfDrawers: 0,
    });
    const floorDoor = (() => {
      let result: THREE.Mesh | null = null;
      floorWall.traverse((node) => { if (node instanceof THREE.Mesh && node.userData.cabinetFront && !node.userData.cabinetDrawerFront) result = node; });
      return result;
    })();
    const floorPull = (() => {
      let result: THREE.Mesh | null = null;
      floorWall.traverse((node) => { if (node instanceof THREE.Mesh && node.userData.cabinetHardware && node.userData.cabinetPull === "door") result = node; });
      return result;
    })();
    expect(floorDoor).not.toBeNull();
    expect(floorPull).not.toBeNull();
    expect(floorPull!.position.y).toBeGreaterThan(floorDoor!.position.y);
    expect(floorPull!.userData.pullEdge).toBe("raised-door-rail");
  });

  it("renders each saved cabinet hardware position independently, including paired-door pulls", () => {
    const renderPulls = (hardwarePosition: "left" | "center" | "right" | "paired", doors = 1) => {
      const isPairedDoorBase = doors > 1;
      const cabinet = {
        uid: `hardware-${hardwarePosition}`,
        cabinetId: 1,
        masterCode: isPairedDoorBase ? "B-30" : "B-18",
        description: isPairedDoorBase
          ? "30 inch Double Door Single Drawer Base Cabinet"
          : "18 inch Single Door Single Drawer Base Cabinet",
        placement: "base",
        x: 0,
        y: 0,
        width: isPairedDoorBase ? 30 : 18,
        depth: 24,
        height: 34.5,
        rotation: 0,
        numberOfDoors: doors,
        numberOfDrawers: 1,
        hardwarePosition,
      } as never;
      const root = new THREE.Group();
      addCabinetWithBarPulls(root, existingCabinetSku(cabinet), null, {}, 144, 120, "#d1ba8f", "#ffffff", { doorStyle: "Shaker", doorPanelType: null }, existingCabinetTransform(cabinet));
      const pulls: THREE.Object3D[] = [];
      root.traverse((node) => { if (node.userData.cabinetHardware && node.userData.cabinetPull === "door") pulls.push(node); });
      return pulls;
    };

    const left = renderPulls("left");
    const center = renderPulls("center");
    const right = renderPulls("right");
    const paired = renderPulls("paired", 2);

    expect(left).toHaveLength(1);
    expect(center).toHaveLength(1);
    expect(right).toHaveLength(1);
    expect(left[0]?.userData).toMatchObject({ hardwarePosition: "left", pullEdge: "left" });
    expect(center[0]?.userData).toMatchObject({ hardwarePosition: "auto", pullEdge: "opposite-hinge", frameCenterInsetIn: 1.5 });
    expect(right[0]?.userData).toMatchObject({ hardwarePosition: "right", pullEdge: "right" });
    expect(left[0]!.position.x).toBeLessThan(center[0]!.position.x);
    expect(center[0]!.position.x).toBeCloseTo(right[0]!.position.x, 8);
    expect(paired).toHaveLength(2);
    expect(paired.every((pull) => pull.userData.hardwarePosition === "paired" && pull.userData.pullEdge === "opposite-hinge")).toBe(true);
  });

  it("places a B18 trashcan top-center pull on the door's physical upper rail, not its center panel", () => {
    const cabinet = {
      uid: "b18-trashcan-top-rail", cabinetId: 1, masterCode: "B18",
      description: "18 inch Base Cabinet used as trashcan rollout", placement: "base",
      x: 0, y: 0, width: 18, depth: 24, height: 34.5, rotation: 0,
      numberOfDoors: 1, numberOfDrawers: 1, hardwarePosition: "top-center",
    } as never;
    const root = new THREE.Group();
    addCabinetWithBarPulls(root, existingCabinetSku(cabinet), null, {}, 144, 120, "#d1ba8f", "#ffffff", { doorStyle: "Shaker", doorPanelType: null }, existingCabinetTransform(cabinet));
    const doors: THREE.Mesh[] = [];
    const pulls: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node instanceof THREE.Mesh && node.userData.cabinetFront && !node.userData.cabinetDrawerFront) doors.push(node);
      if (node.userData.cabinetHardware && node.userData.cabinetPull === "door") pulls.push(node);
    });
    expect(doors).toHaveLength(1);
    expect(pulls).toHaveLength(1);
    expect(pulls[0]!.userData).toMatchObject({ hardwarePosition: "top-center", pullEdge: "top-center", verticalPull: false });
    const doorHeight = (doors[0]!.geometry as THREE.BoxGeometry).parameters.height;
    expect(pulls[0]!.position.y).toBeCloseTo(doors[0]!.position.y + doorHeight / 2 - 3 / 24, 6);
  });

  it("places standard and paired 3D door pulls exactly 1.5 inches from their physical door edges", () => {
    const renderDoorHardware = (width: number, doors: number, hardwarePosition: "right" | "center" | "paired", placement: "base" | "wall" = "base") => {
      const cabinet = {
        uid: `measured-${width}-${doors}`,
        cabinetId: 1,
        masterCode: placement === "wall" ? (doors === 1 ? "W-1830" : "W-3030") : doors === 1 ? "B-18" : "B-30",
        description: `${width} inch ${doors === 1 ? "Single" : "Double"} Door ${placement === "wall" ? "Wall" : "Base"}`,
        placement,
        x: 0,
        y: 0,
        width,
        depth: placement === "wall" ? 12 : 24,
        height: placement === "wall" ? 30 : 34.5,
        rotation: 0,
        numberOfDoors: doors,
        numberOfDrawers: 0,
        hardwarePosition,
      } as never;
      const root = new THREE.Group();
      addCabinetWithBarPulls(root, existingCabinetSku(cabinet), null, {}, 144, 120, "#d1ba8f", "#ffffff", { doorStyle: "Shaker", doorPanelType: null }, existingCabinetTransform(cabinet));
      const doorMeshes: THREE.Mesh[] = [];
      const pullMeshes: THREE.Object3D[] = [];
      root.traverse((node) => {
        if (node.userData.cabinetFront && !node.userData.cabinetDrawerFront && node instanceof THREE.Mesh) doorMeshes.push(node);
        if (node.userData.cabinetHardware && node.userData.cabinetPull === "door") pullMeshes.push(node);
      });
      return {
        doors: doorMeshes.sort((a, b) => a.position.x - b.position.x),
        pulls: pullMeshes.sort((a, b) => a.position.x - b.position.x),
      };
    };

    const single = renderDoorHardware(18, 1, "right");
    expect(single.doors).toHaveLength(1);
    expect(single.pulls).toHaveLength(1);
    const singleDoorWidth = (single.doors[0]!.geometry as THREE.BoxGeometry).parameters.width;
    expect((singleDoorWidth / 2 - Math.abs(single.pulls[0]!.position.x - single.doors[0]!.position.x)) * 12).toBeCloseTo(1.5, 8);
    expect(single.pulls[0]!.userData).toMatchObject({ frameWidthIn: 3, frameCenterInsetIn: 1.5 });

    const paired = renderDoorHardware(30, 2, "paired");
    expect(paired.doors).toHaveLength(2);
    expect(paired.pulls).toHaveLength(2);
    paired.doors.forEach((door, index) => {
      const doorWidth = (door.geometry as THREE.BoxGeometry).parameters.width;
      expect((doorWidth / 2 - Math.abs(paired.pulls[index]!.position.x - door.position.x)) * 12).toBeCloseTo(1.5, 8);
      expect(paired.pulls[index]!.userData).toMatchObject({ frameWidthIn: 3, frameCenterInsetIn: 1.5 });
    });

    const legacyCenteredSingleUpper = renderDoorHardware(18, 1, "center", "wall");
    expect(legacyCenteredSingleUpper.doors).toHaveLength(1);
    expect(legacyCenteredSingleUpper.pulls).toHaveLength(1);
    const upperSingleDoorWidth = (legacyCenteredSingleUpper.doors[0]!.geometry as THREE.BoxGeometry).parameters.width;
    expect((upperSingleDoorWidth / 2 - Math.abs(legacyCenteredSingleUpper.pulls[0]!.position.x - legacyCenteredSingleUpper.doors[0]!.position.x)) * 12).toBeCloseTo(1.5, 8);
    expect(legacyCenteredSingleUpper.pulls[0]!.userData).toMatchObject({ hardwarePosition: "auto", pullEdge: "opposite-hinge", pullDoorZone: "upper", frameWidthIn: 3, frameCenterInsetIn: 1.5 });

    const legacyCenteredPairedUpper = renderDoorHardware(30, 2, "center", "wall");
    expect(legacyCenteredPairedUpper.doors).toHaveLength(2);
    expect(legacyCenteredPairedUpper.pulls).toHaveLength(2);
    legacyCenteredPairedUpper.doors.forEach((door, index) => {
      const doorWidth = (door.geometry as THREE.BoxGeometry).parameters.width;
      expect((doorWidth / 2 - Math.abs(legacyCenteredPairedUpper.pulls[index]!.position.x - door.position.x)) * 12).toBeCloseTo(1.5, 8);
      expect(legacyCenteredPairedUpper.pulls[index]!.userData).toMatchObject({ hardwarePosition: "auto", pullEdge: "opposite-hinge", pullDoorZone: "upper", frameWidthIn: 3, frameCenterInsetIn: 1.5 });
    });
  });

  it("builds Slim Shaker rails, stiles, and door pull at one inch from the exact selected profile", () => {
    const cabinet = {
      uid: "slim-shaker-one-inch",
      cabinetId: 1,
      masterCode: "B-18",
      description: "18 inch Single Door Base",
      placement: "base",
      x: 0,
      y: 0,
      width: 18,
      depth: 24,
      height: 34.5,
      rotation: 0,
      numberOfDoors: 1,
      numberOfDrawers: 0,
      hardwarePosition: "right",
    } as never;
    const root = new THREE.Group();
    addCabinetWithBarPulls(
      root,
      existingCabinetSku(cabinet),
      null,
      {},
      144,
      120,
      "#d1ba8f",
      "#ffffff",
      { doorStyle: "Slim Shaker", doorPanelType: null, railWidth: 1, stileWidth: 1 },
      existingCabinetTransform(cabinet),
    );
    const rails: THREE.Mesh[] = [];
    const stiles: THREE.Mesh[] = [];
    const pulls: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.physicalRail && node instanceof THREE.Mesh) {
        if (node.userData.grainPiece === "rail") rails.push(node);
        if (node.userData.grainPiece === "stile") stiles.push(node);
      }
      if (node.userData.cabinetHardware && node.userData.cabinetPull === "door") pulls.push(node);
    });
    expect(rails.length).toBeGreaterThanOrEqual(2);
    expect(stiles.length).toBeGreaterThanOrEqual(2);
    expect(rails.every((rail) => (rail.geometry as THREE.BoxGeometry).parameters.height === 1 / 12)).toBe(true);
    expect(stiles.every((stile) => (stile.geometry as THREE.BoxGeometry).parameters.width === 1 / 12)).toBe(true);
    expect(pulls).toHaveLength(1);
    expect(pulls[0]!.userData).toMatchObject({ frameWidthIn: 1, frameCenterInsetIn: 0.5 });
  });

  it("centers every drawer pull even when the cabinet’s door hardware preference is left or right", () => {
    const cabinet = {
      uid: "drawer-centering-rule",
      cabinetId: 1,
      masterCode: "DB-30-3",
      description: "30 inch Three Drawer Base",
      placement: "base",
      x: 0,
      y: 0,
      width: 30,
      depth: 24,
      height: 34.5,
      rotation: 0,
      numberOfDoors: 0,
      numberOfDrawers: 3,
      hardwarePosition: "left",
    } as never;
    const root = new THREE.Group();
    addCabinetWithBarPulls(root, existingCabinetSku(cabinet), null, {}, 144, 120, "#d1ba8f", "#ffffff", { doorStyle: "Shaker", doorPanelType: null }, existingCabinetTransform(cabinet));
    const drawerPulls: THREE.Object3D[] = [];
    root.traverse((node) => { if (node.userData.cabinetHardware && node.userData.cabinetPull === "drawer") drawerPulls.push(node); });

    expect(drawerPulls).toHaveLength(3);
    expect(drawerPulls.every((pull) => pull.userData.hardwarePosition === "center" && pull.userData.pullEdge === "center" && pull.userData.handleSide === "center")).toBe(true);
    expect(drawerPulls.map((pull) => pull.position.x)).toEqual([0, 0, 0]);
  });

  it("renders 2-DB24 as two equal drawer fronts with centered horizontal pulls", () => {
    const cabinet = {
      uid: "affiliate-two-db24",
      cabinetId: 9400174,
      masterCode: "2-DB24",
      description: "24 inch Two Drawer Base",
      placement: "base",
      x: 0,
      y: 0,
      width: 24,
      depth: 24,
      height: 34.5,
      rotation: 0,
      numberOfDoors: 0,
      numberOfDrawers: 2,
      drawerLayout: JSON.stringify([{ count: 1, height: 6 }, { count: 1, height: 24 }]),
      hardwarePosition: "right",
    } as never;
    const root = new THREE.Group();
    addCabinetWithBarPulls(root, existingCabinetSku(cabinet), null, {}, 144, 120, "#eee9dd", "#ffffff", { doorStyle: "Shaker", doorPanelType: null }, existingCabinetTransform(cabinet));
    const drawers: THREE.Mesh[] = [];
    const drawerPulls: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.cabinetDrawerFront && node instanceof THREE.Mesh) drawers.push(node);
      if (node.userData.cabinetHardware && node.userData.cabinetPull === "drawer") drawerPulls.push(node);
    });

    expect(drawers).toHaveLength(2);
    const heights = drawers.map((drawer) => (drawer.geometry as THREE.BoxGeometry).parameters.height);
    expect(heights[0]).toBeCloseTo(heights[1], 12);
    expect(drawerPulls).toHaveLength(2);
    expect(drawerPulls.every((pull) => !pull.userData.verticalPull && pull.userData.hardwarePosition === "center" && pull.position.x === 0)).toBe(true);
  });

  it("keeps the reported adjacent 36-inch island cabinets visually edge-to-edge when their saved offsets already touch", () => {
    const inch = 1 / 12;
    const cabinets = [
      {
        uid: "reported-island-front-left",
        cabinetId: 9390010,
        masterCode: "B-36",
        description: "36 inch Double Door Two Drawer Base Cabinet",
        placement: "base",
        x: 1.744956772334291,
        y: 83.34293948126802,
        width: 36,
        depth: 24,
        height: 34.5,
        rotation: 0,
        numberOfDoors: 2,
        numberOfDrawers: 2,
        islandFace: "front",
        islandOffset: 0,
      },
      {
        uid: "reported-island-front-right",
        cabinetId: 9400179,
        masterCode: "2-DB36",
        description: "36 inch Two Drawer Base Cabinet",
        placement: "base",
        x: 37.74495677233429,
        y: 83.34293948126802,
        width: 36,
        depth: 24,
        height: 34.5,
        rotation: 0,
        numberOfDoors: 0,
        numberOfDrawers: 2,
        drawerLayout: JSON.stringify([{ count: 2 }]),
        islandFace: "front",
        islandOffset: 36,
      },
    ] as const;
    const root = new THREE.Group();
    for (const cabinet of cabinets) {
      addCabinet(
        root,
        existingCabinetSku(cabinet as never),
        null,
        {},
        144,
        120,
        "#4f5549",
        "#ffffff",
        { doorStyle: "Shaker", doorPanelType: null },
        existingCabinetTransform(cabinet as never),
      );
    }
    root.updateMatrixWorld(true);
    const cabinetGroups = root.children.filter((child) => child.userData.placedUid);
    expect(cabinetGroups).toHaveLength(2);
    expect((cabinetGroups[1]!.position.x - cabinetGroups[0]!.position.x) / inch).toBeCloseTo(36, 10);

    const visibleBounds = cabinetGroups.map((group) => {
      const fronts: THREE.Mesh[] = [];
      group.traverse((node) => {
        if (node instanceof THREE.Mesh && node.userData.cabinetFront) fronts.push(node);
      });
      const edges = fronts.flatMap((front) => {
        const center = new THREE.Vector3();
        front.getWorldPosition(center);
        const width = (front.geometry as THREE.BoxGeometry).parameters.width;
        return [center.x - width / 2, center.x + width / 2];
      });
      return { min: Math.min(...edges), max: Math.max(...edges) };
    });
    const visibleGapIn = (visibleBounds[1]!.min - visibleBounds[0]!.max) / inch;
    expect(visibleGapIn).toBeLessThanOrEqual(0.125);
  });

  it("uses compact W3024 code dimensions as 30 inches wide by 24 inches high even when an import transposes the row", () => {
    const imported = {
      uid: "w3024", cabinetId: 1, masterCode: "W3024", description: "Wall Cabinet 30 x 24",
      placement: "wall", x: 0, y: 0, width: 24, depth: 12, height: 30, rotation: 0,
    } as never;
    expect(existingCabinetSku(imported)).toMatchObject({ width: 30, height: 24, depth: 12 });
  });

  it("keeps authored drawer-row counts and measured heights instead of replacing them with generic slats", () => {
    const rows = resolvedThreeDDrawerRows({
      drawerLayout: JSON.stringify([{ count: 1, height: 6 }, { count: 2, height: 5 }]),
    }, 2, 3);
    expect(rows.map((row) => row.count)).toEqual([1, 2]);
    expect(rows.map((row) => row.height)).toEqual([0.5, expect.closeTo(0.4166666667, 10)]);
    expect(THREE_D_DRAWER_REVEAL_DEPTH).toBe(0.002);
  });

  it("assigns a drawer-only cabinet’s complete usable face to a stack with a shallow six-inch top drawer", () => {
    const layout = resolvedThreeDFaceLayout({ placementType: "base", numberOfDoors: 0, numberOfDrawers: 3 });
    const usableHeight = 34.5 / 12 - 0.08;
    const drawerZone = layout.doorCount === 0 && !layout.hasConfiguredOpening ? usableHeight : usableHeight * 0.35;
    expect(drawerZone).toBeCloseTo(usableHeight, 12);
    const rows = resolvedThreeDDrawerRows({ masterCode: "3-DB30", numberOfDoors: 0, numberOfDrawers: 3, drawerLayout: null }, drawerZone, layout.drawerCount, true);
    expect(rows[0]).toEqual({ count: 1, height: 0.5 });
    expect(rows.slice(1).map((row) => row.height)).toEqual([
      expect.closeTo((usableHeight - 0.5) / 2, 12),
      expect.closeTo((usableHeight - 0.5) / 2, 12),
    ]);
    expect(resolvedThreeDDrawerRows({ drawerLayout: JSON.stringify([{ count: 1, height: 8 }, { count: 1, height: 12 }]) }, drawerZone, 2, true)).toEqual([
      { count: 1, height: expect.closeTo(8 / 12, 12) },
      { count: 1, height: 1 },
    ]);
  });

  it("keeps 2-DB24 authoritative as two equal drawers despite a generic short-top flag or stale unequal saved layout", () => {
    const availableHeight = 34.5 / 12 - 0.08;
    const sku = {
      masterCode: "2-DB24",
      numberOfDoors: 0,
      numberOfDrawers: 2,
      drawerLayout: JSON.stringify([{ count: 1, height: 6 }, { count: 1, height: 24 }]),
    };
    expect(isEqualHeightTwoDrawerBase(sku, 2)).toBe(true);
    expect(resolvedThreeDDrawerRows(sku, availableHeight, 2, true)).toEqual([
      { count: 1, height: availableHeight / 2 },
      { count: 1, height: availableHeight / 2 },
    ]);
    expect(isEqualHeightTwoDrawerBase({ ...sku, numberOfDoors: 2 }, 2)).toBe(true);
    expect(isEqualHeightTwoDrawerBase({ ...sku, masterCode: "3-DB24", numberOfDrawers: 3 }, 3)).toBe(false);
  });

  it("gives active-catalog 2-DB30 two equal drawers across the full usable face despite drawerHeight 14½ inches", () => {
    const usableHeight = (34.5 - 4.5) / 12 - 0.08;
    const sku = {
      masterCode: "2-DB30",
      numberOfDoors: 0,
      numberOfDrawers: 2,
      drawerHeight: 14.5,
      drawerLayout: null,
    };
    const drawerZone = threeDDrawerZoneHeight({
      availableHeight: usableHeight,
      drawerCount: 2,
      doorCount: 0,
      configuredDrawerHeight: sku.drawerHeight / 12,
      hasConfiguredOpening: false,
      placement: "base",
      masterCode: sku.masterCode,
    });
    expect(drawerZone).toBeCloseTo(29 / 12, 12);
    expect(usableHeight - drawerZone).toBeLessThan(0.01);
    expect(resolvedThreeDDrawerRows(sku, drawerZone, 2, true)).toEqual([
      { count: 1, height: drawerZone / 2 },
      { count: 1, height: drawerZone / 2 },
    ]);

    const root = new THREE.Group();
    addCabinetWithBarPulls(root, {
      distributorSkuId: -930,
      cabinetId: 9360022,
      masterCode: "2-DB30",
      description: '30" 2 Drawer Base Cabinet',
      placementType: "base",
      width: 30,
      height: 34.5,
      depth: 24,
      numberOfDoors: 0,
      numberOfDrawers: 2,
      drawerHeight: 14.5,
      drawerLayout: null,
    }, null, {}, 144, 120, "#d1ba8f", "#ffffff", { doorStyle: "Shaker", doorPanelType: null });
    const drawers: THREE.Mesh[] = [];
    const pulls: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node instanceof THREE.Mesh && node.userData.cabinetDrawerFront) drawers.push(node);
      if (node.userData.cabinetHardware && node.userData.cabinetPull === "drawer") pulls.push(node);
    });
    expect(drawers).toHaveLength(2);
    const meshHeights = drawers.map((drawer) => (drawer.geometry as THREE.BoxGeometry).parameters.height);
    expect(meshHeights[0]).toBeCloseTo(14.5 / 12 - 0.025, 12);
    expect(meshHeights[1]).toBeCloseTo(meshHeights[0]!, 12);
    expect(pulls).toHaveLength(2);
    expect(pulls.every((pull) => pull.position.x === 0 && pull.userData.hardwarePosition === "center")).toBe(true);
  });

  it("uses the existing single-oven 2D drawer contract despite stale saved drawer rows", () => {
    const layout = resolvedThreeDOvenLayout({
      height: 84, numberOfDoors: 2, numberOfDrawers: 3, doorHeight: 18,
      drawerLayout: JSON.stringify([{ count: 1, height: 6 }, { count: 2, height: 5 }]),
      openingType: "middle", ovenType: "single",
    });
    expect(layout.doorZone).toBe(19.5 / 12);
    expect(layout.drawerRows).toEqual([
      { count: 1, height: 11 / 12 },
      { count: 1, height: 11 / 12 },
      { count: 1, height: 11 / 12 },
    ]);
    expect(layout.openingHeight).toBeCloseTo(27 / 12, 12);
    expect(layout.openingPosition).toBe("middle");
  });

  it("restores the two-door single-oven bridge when a legacy saved tower reports zero doors", () => {
    const layout = resolvedThreeDOvenLayout({
      height: 84,
      numberOfDoors: 0,
      numberOfDrawers: 3,
      openingType: "middle",
      ovenType: "single",
    });
    expect(layout.doorCount).toBe(2);
    expect(layout.doorZone).toBe(19.5 / 12);
    expect(layout.openingHeight).toBe(27 / 12);
  });

  it("uses the 21-inch standard-face boundary in 3D while keeping the diagonal wall corner’s two-door specialty face", () => {
    expect(resolvedThreeDFaceLayout({ width: 21, numberOfDoors: null }).doorCount).toBe(1);
    expect(resolvedThreeDFaceLayout({ width: 22, numberOfDoors: null }).doorCount).toBe(2);
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -2430,
      cabinetId: 2430,
      masterCode: "WDC2430",
      description: '24" Wall Diagonal Corner Cabinet',
      placementType: "wall",
      width: 24,
      height: 30,
      depth: 24,
      numberOfDoors: 0,
      numberOfDrawers: 0,
      cornerType: "diagonal",
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6");
    const diagonalDoors: THREE.Object3D[] = [];
    root.traverse((node) => { if (node.userData.diagonalDoor) diagonalDoors.push(node); });
    expect(diagonalDoors).toHaveLength(2);
  });

  it("uses Cabinet Config face facts without interpreting generic labels into a different 3D construction", () => {
    expect(resolvedThreeDFaceLayout({
      width: 30,
      description: '30" Double Door Two Drawer Base Cabinet',
      numberOfDoors: 0,
      numberOfDrawers: 0,
    })).toMatchObject({ doorCount: 2, drawerCount: 2 });
    expect(resolvedThreeDFaceLayout({
      width: 30,
      description: "Base Cabinet",
      numberOfDoors: 2,
      numberOfDrawers: 1,
    })).toMatchObject({ doorCount: 2, drawerCount: 1 });
  });

  it("uses the exact remaining 84-, 90-, and 96-inch height for the single-oven two-door bridge", () => {
    expect(singleOvenTowerAssembly(84)).toMatchObject({ baseHeightIn: 34.5, ovenHeightIn: 27, fillerHeightIn: 3, bridgeHeightIn: 19.5 });
    expect(singleOvenTowerAssembly(90).bridgeHeightIn).toBe(25.5);
    expect(singleOvenTowerAssembly(96).bridgeHeightIn).toBe(31.5);
  });

  it("centers a 27-inch single-oven opening inside a 30-inch cabinet enclosure", () => {
    expect(ovenOpeningGeometry(30, "single")).toEqual({ width: 27, horizontalInset: 1.5 });
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -30,
      cabinetId: 30,
      masterCode: "O309024",
      description: '30" Single Oven Cabinet',
      placementType: "tall",
      width: 30,
      height: 90,
      depth: 24,
      numberOfDoors: 2,
      numberOfDrawers: 3,
      ovenType: "single",
      openingType: "middle",
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6");

    const ovenOpenings: THREE.Mesh[] = [];
    root.traverse((node) => {
      if (node instanceof THREE.Mesh && node.userData.ovenOpeningWidthIn != null) ovenOpenings.push(node);
    });
    expect(ovenOpenings).toHaveLength(1);
    expect(ovenOpenings[0]!.userData).toMatchObject({ ovenOpeningWidthIn: 27, singleOvenInsetIn: 1.5 });
    expect((ovenOpenings[0]!.geometry as THREE.BoxGeometry).parameters.width).toBeCloseTo(27 / 12, 12);
    expect(ovenOpenings[0]!.position.x).toBe(0);
  });

  it("uses one 11-inch bottom drawer for a double-oven tower without applying single-oven defaults", () => {
    const layout = resolvedThreeDOvenLayout({
      height: 90, numberOfDoors: 2, numberOfDrawers: 1, doorHeight: 20, drawerHeight: 6,
      openingType: "bottom", ovenType: "double",
    });
    expect(layout.ovenCount).toBe(2);
    expect(layout.openingPosition).toBe("bottom");
    expect(layout.drawerRows).toEqual([{ count: 1, height: 11 / 12 }]);
    expect(layout.openingHeight).toBeGreaterThan(0);
  });

  it("calibrates a legacy oven tower from its saved 2D opening, door, and drawer description", () => {
    expect(describedOvenSpecification('33" x 96" Universal Oven Cabinet - 30" x 39.75" Oven Opening - 2 Doors 3 Drawers')).toEqual({
      openingWidth: 30,
      openingHeight: 39.75,
      doorCount: 2,
      drawerCount: 3,
    });
    const layout = resolvedThreeDOvenLayout({
      height: 96,
      description: '33" x 96" Universal Oven Cabinet - 30" x 39.75" Oven Opening - 2 Doors 3 Drawers',
      numberOfDoors: 0,
      numberOfDrawers: 0,
      ovenType: "double",
    });
    expect(layout.doorCount).toBe(2);
    expect(layout.drawerRows).toEqual([{ count: 1, height: expect.closeTo(11 / 12, 12) }]);
    expect(layout.openingHeight).toBeCloseTo(39.75 / 12, 12);
  });

  it("keeps a narrow rotated wall cabinet and a mounted range hood at their saved 2D transforms", () => {
    expect(existingCabinetTransform({
      uid: "narrow-wall", cabinetId: 12, masterCode: "W-21-42", description: "21 inch wall cabinet", placement: "wall",
      x: 0, y: 23, width: 21, depth: 12, height: 42, rotation: 90, mountBottom: 54,
    })).toEqual({ x: 6, z: 33.5, rotation: Math.PI / 2, bottom: 54 });
    expect(existingCabinetTransform({
      uid: "hood", cabinetId: 0, masterCode: "HOOD-30", description: "Range Hood", placement: "appliance",
      x: 3.5, y: 45, width: 30, depth: 18, height: 18, rotation: 90, mountBottom: 66,
    })).toEqual({ x: 12.5, z: 60, rotation: Math.PI / 2, bottom: 66 });
    expect(existingCabinetTransform({
      uid: "microwave", cabinetId: 0, masterCode: "MW-30", description: "Over-Range Microwave", placement: "appliance",
      x: 0, y: 45, width: 30, depth: 15, height: 17, rotation: 90, mountBottom: 54,
    })).toEqual({ x: 7.5, z: 60, rotation: Math.PI / 2, bottom: 54 });
    expect(existingCabinetTransform({
      uid: "range", cabinetId: 0, masterCode: "RANGE-30", description: "Range / Stove 30 inch", placement: "appliance",
      x: 0, y: 45, width: 30, depth: 25, height: 36, rotation: 90, mountBottom: 0,
    })).toMatchObject({ x: 12.5, z: 60, rotation: Math.PI / 2, bottom: 0 });
    const hood = rangeHoodGeometry(30, 18, 18);
    expect(hood).toMatchObject({ width: 2.5, depth: 1.5, height: 1.5, chimneyWidth: 1.05 });
    expect(hood.chimneyDepth).toBeCloseTo(0.69, 12);
  });

  it("uses the shared 2D appliance elevation when a legacy saved hood omitted mountBottom", () => {
    expect(existingCabinetTransform({
      uid: "legacy-hood", cabinetId: 0, masterCode: "HOOD-30", description: "Range Hood", placement: "appliance",
      x: 24, y: 0, width: 30, depth: 18, height: 18, rotation: 0,
    })).toEqual({ x: 39, z: 9, rotation: 0, bottom: 66 });
  });

  it("preserves the saved current-design refrigerator width, height, and rotated 2D position in 3D", () => {
    expect(existingCabinetTransform({
      uid: "current-fridge", cabinetId: 0, masterCode: "FRIDGE-36", description: "Refrigerator 36 inch", placement: "appliance",
      x: 0.75, y: 108, width: 36, depth: 30, height: 72, rotation: 90,
    })).toEqual({ x: 15.75, z: 126, rotation: Math.PI / 2, bottom: 0 });
  });

  it("keeps every wall cabinet's saved 2D center while turning its front into the room", () => {
    const room = { width: 144, depth: 120, ceilingHeight: 96 } as never;
    const fixtures = [
      { uid: "top", cabinetId: 1, masterCode: "B-24", description: "Back wall", placement: "base", x: 30, y: 0, width: 24, depth: 12, height: 34.5, rotation: 180, expected: { x: 42, z: 6, rotation: 0 } },
      { uid: "bottom", cabinetId: 2, masterCode: "B-24", description: "Front wall", placement: "base", x: 30, y: 108, width: 24, depth: 12, height: 34.5, rotation: 0, expected: { x: 42, z: 114, rotation: Math.PI } },
      { uid: "left", cabinetId: 3, masterCode: "B-24", description: "Left wall", placement: "base", x: 0, y: 30, width: 24, depth: 12, height: 34.5, rotation: 270, expected: { x: 6, z: 42, rotation: Math.PI / 2 } },
      { uid: "right", cabinetId: 4, masterCode: "B-24", description: "Right wall", placement: "base", x: 132, y: 30, width: 24, depth: 12, height: 34.5, rotation: 90, expected: { x: 138, z: 42, rotation: -Math.PI / 2 } },
    ] as never[];
    fixtures.forEach((fixture) => {
      const transform = existingCabinetTransform(fixture, room);
      expect(transform).toMatchObject({ ...fixture.expected, bottom: 0 });
    });
  });

	  it("keeps straight and 45-degree peninsula cabinet backs facing their exact selected run in 3D", () => {
    const room = {
      width: 144,
      depth: 144,
      ceilingHeight: 96,
      peninsulaRuns: [
        { id: "peninsula-primary", parentWall: "left", startOffset: 36, turn: 90, direction: "right", length: 48, height: 34.5, cabinetSide: "right" },
        { id: "peninsula-angle", parentRunId: "peninsula-primary", startOffset: 0, turn: 45, direction: "right", length: 48, height: 34.5, cabinetSide: "right" },
      ],
    } as never;
    const straight = {
      uid: "straight-b18", cabinetId: 18, masterCode: "B-18", description: "Straight peninsula base", placement: "base",
      x: 24, y: 36, width: 18, depth: 24, height: 34.5, rotation: 180, wallId: "peninsula-primary", wallOffset: 12, peninsulaSide: "right",
    } as never;
    const angled = {
      uid: "angled-b18", cabinetId: 18, masterCode: "B-18", description: "Angled peninsula base", placement: "base",
      x: 42, y: 54, width: 18, depth: 24, height: 34.5, rotation: 225, wallId: "peninsula-angle", wallOffset: 12, peninsulaSide: "right",
    } as never;
	    expect(existingCabinetTransform(straight, room).rotation).toBeCloseTo(Math.PI, 12);
	    expect(existingCabinetTransform(angled, room).rotation).toBeCloseTo(Math.PI * 0.75, 12);
    const nearPerimeter = {
      uid: "near-perimeter-peninsula", cabinetId: 18, masterCode: "B-18", description: "Interior peninsula near perimeter", placement: "base",
      x: 6, y: 24, width: 18, depth: 24, height: 34.5, rotation: 90, wallId: "peninsula-primary", wallOffset: 12, peninsulaSide: "left",
    } as never;
	    expect(existingCabinetTransform(nearPerimeter, room)).toMatchObject({ x: 18, z: 33, rotation: Math.PI * 1.5 });
	  });

	  it("renders the same cabinet centers and wall-contacting backs as Plan across a straight-to-45-to-straight peninsula", () => {
	    const primary = { id: "peninsula-upper", parentWall: "top", startOffset: 30, turn: 90, direction: "right", length: 60, height: 34.5, cabinetSide: "right" } as const;
	    const diagonal = { id: "peninsula-diagonal", parentRunId: primary.id, startOffset: 0, turn: 45, direction: "left", length: 48, height: 34.5, cabinetSide: "right" } as const;
	    const lower = { id: "peninsula-lower", parentRunId: diagonal.id, startOffset: 0, turn: 45, direction: "left", length: 60, height: 34.5, cabinetSide: "right" } as const;
	    const room = { width: 156, depth: 144, ceilingHeight: 96, peninsulaRuns: [primary, diagonal, lower] } as RoomData;
	    const cases = [
	      { run: primary, code: "B-18", placement: "base", width: 18, depth: 24, height: 34.5 },
	      { run: diagonal, code: "W-36-30", placement: "wall", width: 36, depth: 12, height: 30 },
	      { run: lower, code: "B-18", placement: "base", width: 18, depth: 24, height: 34.5 },
	    ] as const;

	    cases.forEach(({ run, code, placement, width, depth, height }, index) => {
	      const wallOffset = 11;
	      const planPlacement = wallPlacementAt(wallOffset, width, depth, run.id, room, "right");
	      const cabinet = {
	        uid: `three-segment-${index}`,
	        cabinetId: index + 1,
	        masterCode: code,
	        description: code,
	        placement,
	        width,
	        depth,
	        height,
	        ...planPlacement,
	      } as PlacedCabinet;
	      const footprint = placedFootprint(cabinet);
	      const transform = existingCabinetTransform(cabinet, room);
	      expect(transform.x).toBeCloseTo(cabinet.x + footprint.w / 2, 12);
	      expect(transform.z).toBeCloseTo(cabinet.y + footprint.d / 2, 12);

	      const runGeometry = peninsulaRunEndpoints(run, room);
	      const wallCenter = {
	        x: runGeometry.start.x + Math.cos(runGeometry.radians) * (wallOffset + width / 2),
	        z: runGeometry.start.y + Math.sin(runGeometry.radians) * (wallOffset + width / 2),
	      };
	      const threeDFront = { x: Math.sin(transform.rotation), z: Math.cos(transform.rotation) };
	      const cabinetBack = {
	        x: transform.x - threeDFront.x * depth / 2,
	        z: transform.z - threeDFront.z * depth / 2,
	      };
	      expect(cabinetBack.x).toBeCloseTo(wallCenter.x, 10);
	      expect(cabinetBack.z).toBeCloseTo(wallCenter.z, 10);
	    });
	  });

  it("resolves legacy B-12 swing and centered hardware identically before 3D face construction", () => {
    const sku = existingCabinetSku({
      uid: "legacy-b12-hardware",
      cabinetId: 12,
      masterCode: "B-12",
      description: "12 inch base cabinet",
      placement: "base",
      x: 0,
      y: 0,
      width: 12,
      depth: 24,
      height: 34.5,
      rotation: 0,
      hardwarePosition: "center",
    } as never);
    expect(sku).toMatchObject({ swing: "left", hardwarePosition: "auto" });
  });

  it("does not invent a range hood in 3D when the saved 2D appliance plan contains only a range", () => {
    expect(rangeHoodSceneStatus([{ masterCode: "RANGE-30" } as never])).toEqual({ hasRange: true, hasRangeHood: false, hasOverRangeMicrowave: false, needs2DPlacement: true });
    expect(rangeHoodSceneStatus([{ masterCode: "RANGE-30" } as never, { masterCode: "HOOD-30" } as never])).toEqual({ hasRange: true, hasRangeHood: true, hasOverRangeMicrowave: false, needs2DPlacement: false });
    expect(rangeHoodSceneStatus([
      { uid: "range", cabinetId: 1, masterCode: "RANGE-30", description: "Range", placement: "appliance", x: 0, y: 45, width: 30, depth: 25, height: 36, rotation: 90, mountBottom: 0 },
      { uid: "microwave", cabinetId: 2, masterCode: "MW-30", description: "Over-range microwave", placement: "appliance", x: 0, y: 45, width: 30, depth: 15, height: 17, rotation: 90, mountBottom: 54 },
    ] as never)).toEqual({ hasRange: true, hasRangeHood: false, hasOverRangeMicrowave: true, needs2DPlacement: false });
    expect(rangeHoodSceneStatus([
      { masterCode: "RANGE-30", description: "Range", placement: "appliance" },
      { masterCode: "MW-30", description: "Over-Range Microwave", placement: "wall" },
    ] as never)).toEqual({ hasRange: true, hasRangeHood: false, hasOverRangeMicrowave: true, needs2DPlacement: false });
    expect(rangeHoodSceneStatus([
      { masterCode: "RANGE-30", description: "Range", placement: "appliance" },
      { masterCode: "MW-24", description: "Countertop microwave", placement: "appliance" },
    ] as never)).toEqual({ hasRange: true, hasRangeHood: false, hasOverRangeMicrowave: false, needs2DPlacement: true });
  });

  it("retains the active hood, refrigerator, and supported countertop run in the deterministic visibility contract", () => {
    const room = { width: 144, depth: 145, ceilingHeight: 96 };
    const contract = threeDSceneVisibilityContract([
      { uid: "hood", cabinetId: 0, masterCode: "HOOD-30", description: "Range Hood", placement: "appliance", x: 3.5, y: 45, width: 30, depth: 18, height: 18, rotation: 90, mountBottom: 66 },
      { uid: "fridge", cabinetId: 0, masterCode: "FRIDGE-36", description: "Refrigerator", placement: "appliance", x: 0.75, y: 108, width: 36, depth: 30, height: 72, rotation: 90 },
      { uid: "dw", cabinetId: 0, masterCode: "DW-24", description: "Dishwasher", placement: "appliance", x: 24, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0 },
      { uid: "range", cabinetId: 0, masterCode: "RANGE-30", description: "Range", placement: "appliance", x: 0, y: 45, width: 30, depth: 25, height: 36, rotation: 90, mountBottom: 0 },
    ] as never, room);

    expect(contract.hood).toMatchObject({ masterCode: "HOOD-30", transform: { x: 12.5, z: 60, bottom: 66 }, geometry: { width: 2.5, depth: 1.5, height: 1.5 } });
    expect(contract.tall).toMatchObject([{ masterCode: "FRIDGE-36", transform: { x: 15.75, z: 126, bottom: 0 } }]);
    expect(contract.countertopSupport).toEqual(["DW-24"]);
  });

  it("preserves the mobile scene’s visible hood, tall enclosure, and continuous dishwasher-supported surface", () => {
    const contract = threeDSceneVisibilityContract([
      { uid: "hood", cabinetId: 0, masterCode: "HOOD-30", description: "Range Hood", placement: "appliance", x: 3.5, y: 45, width: 30, depth: 18, height: 18, rotation: 90, mountBottom: 66 },
      { uid: "tall", cabinetId: 0, masterCode: "FRIDGE-36", description: "Refrigerator", placement: "appliance", x: 0.75, y: 108, width: 36, depth: 30, height: 72, rotation: 90 },
      { uid: "dishwasher", cabinetId: 0, masterCode: "DW-24", description: "Dishwasher", placement: "appliance", x: 24, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0 },
      { uid: "range", cabinetId: 0, masterCode: "RANGE-30", description: "Range", placement: "appliance", x: 0, y: 45, width: 30, depth: 25, height: 36, rotation: 90, mountBottom: 0 },
    ] as never, { width: 144, depth: 145, ceilingHeight: 96 });

    expect(contract.hood?.transform.bottom).toBe(66);
    expect(contract.tall).toHaveLength(1);
    expect(contract.tall[0]!.transform.bottom).toBe(0);
    expect(contract.countertopSupport).toEqual(["DW-24"]);
    expect(shouldRenderCountertopOverSceneItem("appliance", "RANGE-30")).toBe(false);
  });

  it("places a saved 2D window at its exact wall offset in the 3D room", () => {
    expect(openingTransform({
      uid: "window-1", kind: "window", label: "Window", side: "top", offset: 42, width: 36, height: 36, sill: 42,
    }, 144, 120)).toEqual({ x: 60, z: 0.06, rotation: 0 });
  });

  it("places a saved sink basin and faucet at the same 2D countertop coordinates", () => {
    const sink = {
      uid: "sink-1", type: "single_bowl", x: 24, y: 48, width: 30, depth: 22, faucet: true,
    } as never;
    const transform = sinkFixtureTransform(sink);
    const faucet = sinkFaucetTransform(sink);
    expect(transform.x).toBe(3.25);
    expect(transform.z).toBeCloseTo(4.916666666666667, 12);
    expect(transform.countertopTop).toBeCloseTo(3, 12);
    expect(faucet.z).toBeLessThan(transform.z);
    expect(faucet.z).toBeCloseTo(4.348333333333334, 12);
  });

  it("places an island faucet behind the sink toward the island interior instead of the user-facing cabinet front", () => {
    const frontSink = { uid: "island-front", type: "single", x: 36, y: 60, width: 30, depth: 20, sourceDepth: 20, wallSide: "top" } as never;
    const backSink = { uid: "island-back", type: "single", x: 36, y: 36, width: 30, depth: 20, sourceDepth: 20, wallSide: "bottom" } as never;
    const frontTransform = sinkFixtureTransform(frontSink);
    const backTransform = sinkFixtureTransform(backSink);

    expect(sinkFaucetTransform(frontSink).z).toBeLessThan(frontTransform.z);
    expect(sinkFaucetTransform(backSink).z).toBeGreaterThan(backTransform.z);
  });

  it("builds a recessed rounded sink with drain and a realistic pull-down faucet assembly", () => {
    const root = new THREE.Group();
    addSinkFixture(root, {
      uid: "sink-realistic", type: "single", x: 24, y: 48, width: 30, depth: 22, faucet: true, wallSide: "top",
      pelicanFaucetProfileId: "pelican-pl-8203-fountain-pull-down",
      faucetOverallHeight: 27.1875, faucetSpoutLength: 9.875, faucetSpoutHeight: 4.9375, faucetFinish: "brushed-nickel", faucetForm: "pull-down",
    } as never);
    const markers = new Set<string>();
    const rimSegments: THREE.Object3D[] = [];
    let bowl: THREE.Mesh | null = null;
    let bowlFloor: THREE.Mesh | null = null;
    let drain: THREE.Mesh | null = null;
    let cutoutMask: THREE.Mesh | null = null;
    root.traverse((node) => {
      for (const [key, value] of Object.entries(node.userData)) if (value === true) markers.add(key);
      if (node.userData.sinkRimFrameSegment) rimSegments.push(node);
      if (node.userData.openSinkBowl) bowl = node as THREE.Mesh;
      if (node.userData.visibleSinkBowlBottom) bowlFloor = node as THREE.Mesh;
      if (node.userData.sinkDrain) drain = node as THREE.Mesh;
      if (node.userData.sinkCountertopCutoutMask) cutoutMask = node as THREE.Mesh;
    });
    expect(markers.has("sinkRim")).toBe(true);
    expect(markers.has("recessedSinkBowl")).toBe(true);
    expect(markers.has("sinkBowlFloor")).toBe(true);
    expect(markers.has("sinkDrain")).toBe(true);
    expect(markers.has("sinkDrainRing")).toBe(true);
    expect(markers.has("sinkDrainStrainer")).toBe(true);
    expect(markers.has("sinkFaucetBase")).toBe(true);
    expect(markers.has("sinkFaucetArc")).toBe(true);
    expect(markers.has("sinkFaucetSprayHead")).toBe(true);
    expect(markers.has("sinkFaucetHandle")).toBe(true);
    expect(rimSegments).toHaveLength(4);
    expect(cutoutMask?.userData.openSinkCutout).toBe(true);
    expect(bowl?.geometry.userData.openSinkBowlGeometry).toBe(true);
    expect(bowl?.userData.visibleInteriorDepth).toBe(true);
    expect((bowl?.material as THREE.Material).depthTest).toBe(false);
    expect((bowl?.material as THREE.Material).stencilWrite).toBe(true);
    expect((bowl?.material as THREE.Material).stencilFunc).toBe(THREE.EqualStencilFunc);
    expect((cutoutMask?.material as THREE.Material).colorWrite).toBe(false);
    expect((cutoutMask?.material as THREE.Material).stencilRef).toBe((bowl?.material as THREE.Material).stencilRef);
    expect((cutoutMask?.material as THREE.Material).stencilZPass).toBe(THREE.ReplaceStencilOp);
    expect((bowlFloor?.material as THREE.Material).depthTest).toBe(false);
    expect(bowlFloor?.userData.recessedDepthIn).toBe(10);
    expect(drain?.userData.drainAtBowlBottom).toBe(true);
    expect(drain!.position.y).toBeLessThan(sinkFixtureTransform({ x: 24, y: 48, width: 30, depth: 22 } as never).countertopTop - 0.7);
  });

  it("keeps a faucet handle beside its base when the saved sink is rotated", () => {
    const root = new THREE.Group();
    addSinkFixture(root, {
      uid: "rotated-handle", type: "single", x: 96, y: 48, width: 30, depth: 22, planRotation: 90,
      faucet: true, wallSide: "right", pelicanFaucetProfileId: "pelican-pl-8237-fountain-standard-arc-matte-black",
      faucetOverallHeight: 12.8125, faucetSpoutLength: 7.0625, faucetSpoutHeight: 8.375, faucetFinish: "matte-black", faucetForm: "standard-arc",
    } as never);
    root.updateMatrixWorld(true);
    let handleBase: THREE.Object3D | null = null;
    let handle: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.sinkFaucetHandleBase) handleBase = node;
      if (node.userData.sinkFaucetHandle) handle = node;
    });
    expect(handleBase).not.toBeNull();
    expect(handle).not.toBeNull();
    const baseWorld = handleBase!.getWorldPosition(new THREE.Vector3());
    const handleWorld = handle!.getWorldPosition(new THREE.Vector3());
    expect(handleWorld.distanceTo(baseWorld)).toBeLessThan(0.32);
  });

  it("uses a verified Pelican farmhouse profile’s measured bowl and apron geometry", () => {
    const root = new THREE.Group();
    addSinkFixture(root, {
      uid: "pelican-pl-fc2418sb",
      type: "farmhouse",
      x: 24,
      y: 48,
      width: 24,
      depth: 18,
      sourceWidth: 24,
      sourceDepth: 18,
      bowlWidth: 22.5,
      bowlDepth: 16.625,
      bowlHeight: 9,
      apronFront: true,
      pelicanProfileId: "pelican-pl-fc2418sb-fireclay-farmhouse",
      faucet: false,
      wallSide: "top",
    } as never);
    let bowl: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === "pelican-pl-fc2418sb-fireclay-farmhouse" && node.userData.sinkBowl) bowl = node;
      if (node.userData.pelicanProfileId === "pelican-pl-fc2418sb-fireclay-farmhouse" && node.userData.sinkApronFront) apron = node;
    });
    expect(bowl).not.toBeNull();
    expect(apron).not.toBeNull();
    const bowlBounds = new THREE.Box3().setFromObject(bowl!);
    expect(bowlBounds.max.y - bowlBounds.min.y).toBeCloseTo(0.75, 12);
    expect(apron?.position.z).toBeGreaterThan(sinkFixtureTransform({ x: 24, y: 48, width: 24, depth: 18 } as never).z);
  });

  it("renders PL-HA135 R0 as a countertop-seated stainless retrofit farmhouse sink with measured exterior and bowl geometry", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha135-r0", type: "farmhouse", x: 24, y: 48, width: 35.5, depth: 21.25,
      sourceWidth: 35.5, sourceDepth: 21.25, bowlWidth: 32.5, bowlDepth: 17.25, bowlHeight: 9.125,
      exteriorHeight: 9.375, apronFront: true, pelicanProfileId: "pelican-pl-ha135-r0-retrofit-stainless-farmhouse",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
    });
    expect(bowl).not.toBeNull();
    expect(apron?.userData.sinkApronMaterial).toBe("stainless-steel");
    const bowlBounds = new THREE.Box3().setFromObject(bowl!);
    expect((bowlBounds.max.x - bowlBounds.min.x) * 12).toBeCloseTo(32.5, 5);
    expect((bowlBounds.max.z - bowlBounds.min.z) * 12).toBeCloseTo(17.25, 5);
    expect((bowlBounds.max.y - bowlBounds.min.y) * 12).toBeCloseTo(9.125, 5);
    expect(apron?.position.z).toBeGreaterThan(sinkFixtureTransform(sink).z);
  });

  it("renders PL-GMB135 R0 as a countertop-seated gunmetal retrofit farmhouse sink with measured exterior and bowl geometry", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-gmb135-r0", type: "farmhouse", x: 24, y: 48, width: 35.5, depth: 21.25,
      sourceWidth: 35.5, sourceDepth: 21.25, bowlWidth: 32.5, bowlDepth: 17.25, bowlHeight: 9.125,
      exteriorHeight: 9.375, apronFront: true, surfaceFinish: "gunmetal-black", pelicanProfileId: "pelican-pl-gmb135-r0-gunmetal-retrofit-farmhouse",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
    });
    expect(bowl).not.toBeNull();
    expect(apron?.userData.sinkApronMaterial).toBe("gunmetal-black");
    const bowlBounds = new THREE.Box3().setFromObject(bowl!);
    expect((bowlBounds.max.x - bowlBounds.min.x) * 12).toBeCloseTo(32.5, 5);
    expect((bowlBounds.max.z - bowlBounds.min.z) * 12).toBeCloseTo(17.25, 5);
    expect((bowlBounds.max.y - bowlBounds.min.y) * 12).toBeCloseTo(9.125, 5);
    expect(apron?.position.z).toBeGreaterThan(sinkFixtureTransform(sink).z);
  });

  it("renders PL-FC3219SB as a countertop-seated measured single-bowl farmhouse sink with a visible apron", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-fc3219sb", type: "farmhouse", x: 24, y: 48, width: 31.875, depth: 19.125,
      sourceWidth: 31.875, sourceDepth: 19.125, bowlWidth: 29.125, bowlDepth: 16.125, bowlHeight: 9.25,
      exteriorHeight: 10.25, apronFront: true, pelicanProfileId: "pelican-pl-fc3219sb-fireclay-farmhouse",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
    });
    expect(bowl).not.toBeNull();
    expect(apron).not.toBeNull();
    const bowlBounds = new THREE.Box3().setFromObject(bowl!);
    expect((bowlBounds.max.x - bowlBounds.min.x) * 12).toBeCloseTo(29.125, 5);
    expect((bowlBounds.max.z - bowlBounds.min.z) * 12).toBeCloseTo(16.125, 5);
    expect((bowlBounds.max.y - bowlBounds.min.y) * 12).toBeCloseTo(9.25, 5);
    expect(bowlBounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
    expect(apron?.position.z).toBeGreaterThan(sinkFixtureTransform(sink).z);
  });

  it("renders PL-FC3620SB as a countertop-seated measured single-bowl farmhouse sink with a visible apron", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-fc3620sb", type: "farmhouse", x: 24, y: 48, width: 36, depth: 20,
      sourceWidth: 36, sourceDepth: 20, bowlWidth: 34.5625, bowlDepth: 18.5625, bowlHeight: 9,
      exteriorHeight: 10, apronFront: true, pelicanProfileId: "pelican-pl-fc3620sb-fireclay-farmhouse",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    const drains: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
      if (node.userData.sinkDrain) drains.push(node);
    });
    expect(bowl).not.toBeNull();
    expect(apron).not.toBeNull();
    expect(drains).toHaveLength(1);
    const bowlBounds = new THREE.Box3().setFromObject(bowl!);
    expect((bowlBounds.max.x - bowlBounds.min.x) * 12).toBeCloseTo(34.5625, 5);
    expect((bowlBounds.max.z - bowlBounds.min.z) * 12).toBeCloseTo(18.5625, 5);
    expect((bowlBounds.max.y - bowlBounds.min.y) * 12).toBeCloseTo(9, 5);
    expect(bowlBounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
    expect(apron?.position.z).toBeGreaterThan(sinkFixtureTransform(sink).z);
  });

  it("renders PL-HA144 R10 as a countertop-seated measured single-bowl farmhouse sink with a visible apron", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha144-r10", type: "farmhouse", x: 24, y: 48, width: 33, depth: 21,
      sourceWidth: 33, sourceDepth: 21, bowlWidth: 31, bowlDepth: 16, bowlHeight: 9.75,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: true, pelicanProfileId: "pelican-pl-ha144-r10-stainless-farmhouse",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    const drains: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
      if (node.userData.sinkDrain) drains.push(node);
    });
    expect(bowl).not.toBeNull();
    expect(apron).not.toBeNull();
    expect(drains).toHaveLength(1);
    const bowlBounds = new THREE.Box3().setFromObject(bowl!);
    expect((bowlBounds.max.x - bowlBounds.min.x) * 12).toBeCloseTo(31, 5);
    expect((bowlBounds.max.z - bowlBounds.min.z) * 12).toBeCloseTo(16, 5);
    expect((bowlBounds.max.y - bowlBounds.min.y) * 12).toBeCloseTo(9.75, 5);
    expect(bowlBounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
    expect(apron?.position.z).toBeGreaterThan(sinkFixtureTransform(sink).z);
    expect(drains[0].userData.documentedDrainInset).toBe(true);
    expect((drains[0].position.x - bowl!.position.x) * 12).toBeCloseTo(0, 5);
    expect((drains[0].position.z - bowl!.position.z) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
  });

  it("preserves PL-HA144’s documented rear-center drain on a left wall", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha144-r10-left", type: "farmhouse", x: 24, y: 48, width: 21, depth: 33,
      sourceWidth: 33, sourceDepth: 21, bowlWidth: 31, bowlDepth: 16, bowlHeight: 9.75,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: true,
      pelicanProfileId: "pelican-pl-ha144-r10-stainless-farmhouse", faucet: false, wallSide: "left",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let drain: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.sinkDrain) drain = node;
    });
    expect(bowl).not.toBeNull();
    expect(drain).not.toBeNull();
    expect(drain?.userData.documentedDrainInset).toBe(true);
    expect((drain!.position.x - bowl!.position.x) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
    expect((drain!.position.z - bowl!.position.z) * 12).toBeCloseTo(0, 5);
  });

  it("renders PL-HA148 R10 as a countertop-seated measured single-bowl farmhouse sink with a visible apron", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha148-r10", type: "farmhouse", x: 24, y: 48, width: 36, depth: 21,
      sourceWidth: 36, sourceDepth: 21, bowlWidth: 34, bowlDepth: 16, bowlHeight: 9.75,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: true, pelicanProfileId: "pelican-pl-ha148-r10-stainless-farmhouse",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    const drains: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
      if (node.userData.sinkDrain) drains.push(node);
    });
    expect(bowl).not.toBeNull();
    expect(apron).not.toBeNull();
    expect(drains).toHaveLength(1);
    const bowlBounds = new THREE.Box3().setFromObject(bowl!);
    expect((bowlBounds.max.x - bowlBounds.min.x) * 12).toBeCloseTo(34, 5);
    expect((bowlBounds.max.z - bowlBounds.min.z) * 12).toBeCloseTo(16, 5);
    expect((bowlBounds.max.y - bowlBounds.min.y) * 12).toBeCloseTo(9.75, 5);
    expect(bowlBounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
    expect(apron?.position.z).toBeGreaterThan(sinkFixtureTransform(sink).z);
    expect(drains[0].userData.documentedDrainInset).toBe(true);
    expect((drains[0].position.x - bowl!.position.x) * 12).toBeCloseTo(0, 5);
    expect((drains[0].position.z - bowl!.position.z) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
  });

  it("preserves PL-HA148’s documented rear-center drain on a left wall", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha148-r10-left", type: "farmhouse", x: 24, y: 48, width: 21, depth: 36,
      sourceWidth: 36, sourceDepth: 21, bowlWidth: 34, bowlDepth: 16, bowlHeight: 9.75,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: true,
      pelicanProfileId: "pelican-pl-ha148-r10-stainless-farmhouse", faucet: false, wallSide: "left",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let drain: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.sinkDrain) drain = node;
    });
    expect(bowl).not.toBeNull();
    expect(drain).not.toBeNull();
    expect(drain?.userData.documentedDrainInset).toBe(true);
    expect((drain!.position.x - bowl!.position.x) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
    expect((drain!.position.z - bowl!.position.z) * 12).toBeCloseTo(0, 5);
  });

  it("renders PL-FC3318DB as a countertop-seated double-bowl farmhouse sink with two measured bowls, drains, and a visible apron", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-fc3318db", type: "farmhouse", x: 24, y: 48, width: 32.625, depth: 18,
      sourceWidth: 32.625, sourceDepth: 18, bowlWidth: 15.375, bowlDepth: 16.5, bowlHeight: 9.25, bowlCount: 2,
      exteriorHeight: 10, apronFront: true, pelicanProfileId: "pelican-pl-fc3318db-fireclay-double-bowl-farmhouse",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    const bowls: THREE.Object3D[] = [];
    const drains: THREE.Object3D[] = [];
    let apron: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowls.push(node);
      if (node.userData.sinkDrain) drains.push(node);
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
    });
    expect(bowls).toHaveLength(2);
    expect(drains).toHaveLength(2);
    expect(apron).not.toBeNull();
    for (const bowl of bowls) {
      const bounds = new THREE.Box3().setFromObject(bowl);
      expect((bounds.max.x - bounds.min.x) * 12).toBeCloseTo(15.375, 5);
      expect((bounds.max.z - bounds.min.z) * 12).toBeCloseTo(16.5, 5);
      expect((bounds.max.y - bounds.min.y) * 12).toBeCloseTo(9.25, 5);
      expect(bounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
    }
    expect(apron?.position.z).toBeGreaterThan(sinkFixtureTransform(sink).z);
  });

  it("renders PL-HA128 as a countertop-seated double-bowl farmhouse sink with its two measured bowls and visible apron", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha128-r15", type: "farmhouse", x: 24, y: 48, width: 33, depth: 21,
      sourceWidth: 33, sourceDepth: 21, bowlWidth: 14.5, bowlDepth: 16, bowlHeight: 10, bowlCount: 2,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: true, pelicanProfileId: "pelican-pl-ha128-r15-stainless-double-bowl-farmhouse",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    const bowls: THREE.Object3D[] = [];
    const drains: THREE.Object3D[] = [];
    let apron: THREE.Object3D | null = null;
    let divider: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowls.push(node);
      if (node.userData.sinkDrain) drains.push(node);
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
      if (node.userData.sinkBowlDivider) divider = node;
    });
    expect(bowls).toHaveLength(2);
    expect(drains).toHaveLength(2);
    expect(divider).not.toBeNull();
    expect(apron).not.toBeNull();
    for (const [index, bowl] of bowls.entries()) {
      const bounds = new THREE.Box3().setFromObject(bowl);
      expect((bounds.max.x - bounds.min.x) * 12).toBeCloseTo(14.5, 6);
      expect((bounds.max.z - bounds.min.z) * 12).toBeCloseTo(16, 6);
      expect((bounds.max.y - bounds.min.y) * 12).toBeCloseTo(10, 6);
      expect(bounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
      expect(drains[index].userData.documentedDrainInset).toBe(true);
      expect((drains[index].position.x - bowl.position.x) * 12).toBeCloseTo(0, 5);
      expect((drains[index].position.z - bowl.position.z) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
    }
    expect(apron?.position.z).toBeGreaterThan(sinkFixtureTransform(sink).z);
  });

  it("preserves PL-HA128’s source-verified rear-center drains on a left wall", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha128-r15-left", type: "farmhouse", x: 24, y: 48, width: 21, depth: 33,
      sourceWidth: 33, sourceDepth: 21, bowlWidth: 14.5, bowlDepth: 16, bowlHeight: 10, bowlCount: 2,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: true, pelicanProfileId: "pelican-pl-ha128-r15-stainless-double-bowl-farmhouse",
      faucet: false, wallSide: "left",
    } as never;
    addSinkFixture(root, sink);
    const bowls: THREE.Object3D[] = [];
    const drains: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowls.push(node);
      if (node.userData.sinkDrain) drains.push(node);
    });
    expect(bowls).toHaveLength(2);
    expect(drains).toHaveLength(2);
    for (const [index, bowl] of bowls.entries()) {
      expect(drains[index].userData.documentedDrainInset).toBe(true);
      expect((drains[index].position.x - bowl.position.x) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
      expect((drains[index].position.z - bowl.position.z) * 12).toBeCloseTo(0, 5);
    }
  });

  it("renders PL-HA136 with its source-verified asymmetric 17-inch and 12-inch bowls, two drains, countertop seating, and apron", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha136-r15", type: "farmhouse", x: 24, y: 48, width: 33, depth: 21,
      sourceWidth: 33, sourceDepth: 21, bowlWidth: 17, bowlWidths: [17, 12] as const, bowlDepth: 16, bowlHeight: 10, bowlCount: 2,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: true, pelicanProfileId: "pelican-pl-ha136-r15-stainless-asymmetric-double-bowl-farmhouse",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    const bowls: THREE.Object3D[] = [];
    const drains: THREE.Object3D[] = [];
    let apron: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowls.push(node);
      if (node.userData.sinkDrain) drains.push(node);
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
    });
    expect(bowls).toHaveLength(2);
    expect(drains).toHaveLength(2);
    expect(apron).not.toBeNull();
    for (const [index, expectedWidth] of [17, 12].entries()) {
      const bounds = new THREE.Box3().setFromObject(bowls[index]);
      expect((bounds.max.x - bounds.min.x) * 12).toBeCloseTo(expectedWidth, 5);
      expect((bounds.max.z - bounds.min.z) * 12).toBeCloseTo(16, 5);
      expect((bounds.max.y - bounds.min.y) * 12).toBeCloseTo(10, 5);
      expect(bounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
    }
    expect(apron?.position.z).toBeGreaterThan(sinkFixtureTransform(sink).z);
    for (const [index, drain] of drains.entries()) {
      expect(drain.userData.documentedDrainInset).toBe(true);
      expect((drain.position.z - bowls[index].position.z) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
    }
  });

  it("preserves PL-HA136’s documented rear-center drains on a left wall", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha136-r15-left", type: "farmhouse", x: 24, y: 48, width: 21, depth: 33,
      sourceWidth: 33, sourceDepth: 21, bowlWidth: 17, bowlWidths: [17, 12] as const, bowlDepth: 16, bowlHeight: 10, bowlCount: 2,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: true,
      pelicanProfileId: "pelican-pl-ha136-r15-stainless-asymmetric-double-bowl-farmhouse", faucet: false, wallSide: "left",
    } as never;
    addSinkFixture(root, sink);
    const bowls: THREE.Object3D[] = [];
    const drains: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowls.push(node);
      if (node.userData.sinkDrain) drains.push(node);
    });
    expect(bowls).toHaveLength(2);
    expect(drains).toHaveLength(2);
    for (const [index, drain] of drains.entries()) {
      expect(drain.userData.documentedDrainInset).toBe(true);
      expect((drain.position.x - bowls[index].position.x) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
    }
  });

  it("renders PL-HA139 with its source-verified left-to-right 12-inch and 17-inch bowls, two drains, countertop seating, and apron", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha139-r15", type: "farmhouse", x: 24, y: 48, width: 33, depth: 21,
      sourceWidth: 33, sourceDepth: 21, bowlWidth: 12, bowlWidths: [12, 17] as const, bowlDepth: 16, bowlHeight: 10, bowlCount: 2,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: true, pelicanProfileId: "pelican-pl-ha139-r15-stainless-asymmetric-double-bowl-farmhouse",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    const bowls: THREE.Object3D[] = [];
    const drains: THREE.Object3D[] = [];
    let apron: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowls.push(node);
      if (node.userData.sinkDrain) drains.push(node);
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
    });
    expect(bowls).toHaveLength(2);
    expect(drains).toHaveLength(2);
    expect(apron).not.toBeNull();
    for (const [index, expectedWidth] of [12, 17].entries()) {
      const bounds = new THREE.Box3().setFromObject(bowls[index]);
      expect((bounds.max.x - bounds.min.x) * 12).toBeCloseTo(expectedWidth, 5);
      expect((bounds.max.z - bounds.min.z) * 12).toBeCloseTo(16, 5);
      expect((bounds.max.y - bounds.min.y) * 12).toBeCloseTo(10, 5);
      expect(bounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
    }
    expect(apron?.position.z).toBeGreaterThan(sinkFixtureTransform(sink).z);
    for (const [index, drain] of drains.entries()) {
      expect(drain.userData.documentedDrainInset).toBe(true);
      expect((drain.position.z - bowls[index].position.z) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
    }
  });

  it("preserves PL-HA139’s documented rear-center drains on a left wall", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha139-r15-left", type: "farmhouse", x: 24, y: 48, width: 21, depth: 33,
      sourceWidth: 33, sourceDepth: 21, bowlWidth: 12, bowlWidths: [12, 17] as const, bowlDepth: 16, bowlHeight: 10, bowlCount: 2,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: true,
      pelicanProfileId: "pelican-pl-ha139-r15-stainless-asymmetric-double-bowl-farmhouse", faucet: false, wallSide: "left",
    } as never;
    addSinkFixture(root, sink);
    const bowls: THREE.Object3D[] = [];
    const drains: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowls.push(node);
      if (node.userData.sinkDrain) drains.push(node);
    });
    expect(bowls).toHaveLength(2);
    expect(drains).toHaveLength(2);
    for (const [index, drain] of drains.entries()) {
      expect(drain.userData.documentedDrainInset).toBe(true);
      expect((drain.position.x - bowls[index].position.x) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
    }
  });

  it("renders PL-HA125 with its source-verified asymmetric 19-inch and 13-inch bowls, two drains, countertop seating, and apron", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha125-r0", type: "farmhouse", x: 24, y: 48, width: 35.875, depth: 20.75,
      sourceWidth: 35.875, sourceDepth: 20.75, bowlWidth: 19, bowlWidths: [19, 13] as const, bowlDepth: 16, bowlHeight: 10, bowlCount: 2,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: true, pelicanProfileId: "pelican-pl-ha125-r0-stainless-asymmetric-double-bowl-farmhouse",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    const bowls: THREE.Object3D[] = [];
    const drains: THREE.Object3D[] = [];
    let apron: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowls.push(node);
      if (node.userData.sinkDrain) drains.push(node);
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
    });
    expect(bowls).toHaveLength(2);
    expect(drains).toHaveLength(2);
    expect(apron).not.toBeNull();
    for (const [index, expectedWidth] of [19, 13].entries()) {
      const bounds = new THREE.Box3().setFromObject(bowls[index]);
      expect((bounds.max.x - bounds.min.x) * 12).toBeCloseTo(expectedWidth, 5);
      expect((bounds.max.z - bounds.min.z) * 12).toBeCloseTo(16, 5);
      expect((bounds.max.y - bounds.min.y) * 12).toBeCloseTo(10, 5);
      expect(bounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
      expect(drains[index]?.userData.documentedDrainInset).toBe(true);
      expect((drains[index]!.position.z - bowls[index].position.z) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
    }
    expect(apron?.position.z).toBeGreaterThan(sinkFixtureTransform(sink).z);
  });

  it("preserves PL-HA125’s source-verified rear-center drains on a left wall", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha125-r0-left", type: "farmhouse", x: 24, y: 48, width: 20.75, depth: 35.875,
      sourceWidth: 35.875, sourceDepth: 20.75, bowlWidth: 19, bowlWidths: [19, 13] as const, bowlDepth: 16, bowlHeight: 10, bowlCount: 2,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: true,
      pelicanProfileId: "pelican-pl-ha125-r0-stainless-asymmetric-double-bowl-farmhouse", faucet: false, wallSide: "left",
    } as never;
    addSinkFixture(root, sink);
    const bowls: THREE.Object3D[] = [];
    const drains: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowls.push(node);
      if (node.userData.sinkDrain) drains.push(node);
    });
    expect(bowls).toHaveLength(2);
    expect(drains).toHaveLength(2);
    for (const [index, drain] of drains.entries()) {
      expect(drain.userData.documentedDrainInset).toBe(true);
      expect((drain.position.x - bowls[index].position.x) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
    }
  });

  it("renders PL-HA126 with its source-verified asymmetric bowl widths and depths on a horizontal standard sink base", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha126-r0", type: "single", x: 24, y: 48, width: 31.25, depth: 20.5,
      sourceWidth: 31.25, sourceDepth: 20.5, bowlWidth: 14, bowlWidths: [14, 13.5] as const, bowlDepth: 18, bowlDepths: [18, 16] as const, bowlHeight: 10, bowlCount: 2, drainInsetBack: 120 / 25.4,
      exteriorHeight: 10, apronFront: false, pelicanProfileId: "pelican-pl-ha126-r0-stainless-asymmetric-double-bowl-undermount",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    const bowls: THREE.Object3D[] = [];
    const drains: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowls.push(node);
      if (node.userData.sinkDrain) drains.push(node);
    });
    expect(bowls).toHaveLength(2);
    expect(drains).toHaveLength(2);
    for (const [index, [expectedWidth, expectedDepth]] of [[14, 18], [13.5, 16]].entries()) {
      const bounds = new THREE.Box3().setFromObject(bowls[index]);
      expect((bounds.max.x - bounds.min.x) * 12).toBeCloseTo(expectedWidth, 5);
      expect((bounds.max.z - bounds.min.z) * 12).toBeCloseTo(expectedDepth, 5);
      expect(bounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
      expect(drains[index].userData.documentedDrainInset).toBe(true);
      expect((drains[index].position.x - bowls[index].position.x) * 12).toBeCloseTo(0, 5);
      expect((drains[index].position.z - bowls[index].position.z) * 12).toBeCloseTo(-(expectedDepth / 2 - 120 / 25.4), 5);
    }
  });

  it("preserves PL-HA126’s asymmetric bowl depths through a rotated standard sink-base orientation", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha126-r0-left", type: "single", x: 24, y: 48, width: 20.5, depth: 31.25,
      sourceWidth: 31.25, sourceDepth: 20.5, bowlWidth: 14, bowlWidths: [14, 13.5] as const, bowlDepth: 18, bowlDepths: [18, 16] as const, bowlHeight: 10, bowlCount: 2, drainInsetBack: 120 / 25.4,
      exteriorHeight: 10, apronFront: false, pelicanProfileId: "pelican-pl-ha126-r0-stainless-asymmetric-double-bowl-undermount",
      faucet: false, wallSide: "left",
    } as never;
    addSinkFixture(root, sink);
    const bowls: THREE.Object3D[] = [];
    const drains: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowls.push(node);
      if (node.userData.sinkDrain) drains.push(node);
    });
    expect(bowls).toHaveLength(2);
    expect(drains).toHaveLength(2);
    for (const [index, [expectedWidth, expectedDepth]] of [[14, 18], [13.5, 16]].entries()) {
      const bounds = new THREE.Box3().setFromObject(bowls[index]);
      expect((bounds.max.x - bounds.min.x) * 12).toBeCloseTo(expectedDepth, 5);
      expect((bounds.max.z - bounds.min.z) * 12).toBeCloseTo(expectedWidth, 5);
      expect(bounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
      expect(drains[index].userData.documentedDrainInset).toBe(true);
      expect((drains[index].position.x - bowls[index].position.x) * 12).toBeCloseTo(-(expectedDepth / 2 - 120 / 25.4), 5);
      expect((drains[index].position.z - bowls[index].position.z) * 12).toBeCloseTo(0, 5);
    }
  });

  it("renders PL-VS7030 with source-measured stepped bowl widths, depths, and heights without inferring drain data", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-vs7030", type: "single", x: 24, y: 48, width: 31.5, depth: 20.5,
      sourceWidth: 31.5, sourceDepth: 20.5, bowlWidth: 17.75, bowlWidths: [17.75, 10.625] as const,
      bowlDepth: 18.5, bowlDepths: [18.5, 16] as const, bowlHeight: 9, bowlHeights: [9, 7] as const, bowlCount: 2,
      exteriorHeight: 9, apronFront: false, pelicanProfileId: "pelican-pl-vs7030-stainless-stepped-double-bowl-undermount",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    const bowls: THREE.Object3D[] = [];
    const drains: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowls.push(node);
      if (node.userData.sinkDrain) drains.push(node);
    });
    expect(bowls).toHaveLength(2);
    expect(drains).toHaveLength(2);
    const dimensions = bowls.map((bowl) => {
      const bounds = new THREE.Box3().setFromObject(bowl);
      return [bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z, bounds.max.y - bounds.min.y]
        .map((value) => Number((value * 12).toFixed(3)));
    });
    expect(dimensions).toEqual([[17.75, 18.5, 9], [10.625, 16, 7]]);
    expect(drains.every((drain) => drain.userData.documentedDrainInset === false)).toBe(true);
  });

  it("renders PL-VS4060 with source-measured stepped bowl widths, depths, and heights without inferring drain data", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-vs4060", type: "single", x: 24, y: 48, width: 32.125, depth: 20.625,
      sourceWidth: 32.125, sourceDepth: 20.625, bowlWidth: 13, bowlWidths: [13, 15.875] as const,
      bowlDepth: 16.5, bowlDepths: [16.5, 18.625] as const, bowlHeight: 7, bowlHeights: [7, 9] as const, bowlCount: 2,
      exteriorHeight: 9, apronFront: false, pelicanProfileId: "pelican-pl-vs4060-stainless-stepped-double-bowl-undermount",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    const bowls: THREE.Object3D[] = [];
    const drains: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowls.push(node);
      if (node.userData.sinkDrain) drains.push(node);
    });
    expect(bowls).toHaveLength(2);
    expect(drains).toHaveLength(2);
    const dimensions = bowls.map((bowl) => {
      const bounds = new THREE.Box3().setFromObject(bowl);
      return [bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z, bounds.max.y - bounds.min.y]
        .map((value) => Number((value * 12).toFixed(3)));
    });
    expect(dimensions).toEqual([[13, 16.5, 7], [15.875, 18.625, 9]]);
    expect(drains.every((drain) => drain.userData.documentedDrainInset === false)).toBe(true);
  });

  it("renders PL-HA117 R0 as a countertop-seated double-bowl standard undermount sink with two measured bowls and drains", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha117-r0", type: "single", x: 24, y: 48, width: 32, depth: 18,
      sourceWidth: 32, sourceDepth: 18, bowlWidth: 14.5, bowlDepth: 16, bowlHeight: 10, bowlCount: 2,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: false, pelicanProfileId: "pelican-pl-ha117-r0-stainless-double-bowl-undermount",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    const bowls: THREE.Object3D[] = [];
    const drains: THREE.Object3D[] = [];
    let apron: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowls.push(node);
      if (node.userData.sinkDrain) drains.push(node);
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
    });
    expect(bowls).toHaveLength(2);
    expect(drains).toHaveLength(2);
    expect(apron).toBeNull();
    for (const bowl of bowls) {
      const bounds = new THREE.Box3().setFromObject(bowl);
      expect((bounds.max.x - bounds.min.x) * 12).toBeCloseTo(14.5, 5);
      expect((bounds.max.z - bounds.min.z) * 12).toBeCloseTo(16, 5);
      expect((bounds.max.y - bounds.min.y) * 12).toBeCloseTo(10, 5);
      expect(bounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
    }
    for (const drain of drains) {
      expect(drain.userData.documentedDrainInset).toBe(true);
      expect((drain.position.z - bowls[0].position.z) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
    }
  });

  it("preserves PL-HA117’s source-verified rear-center drains on a left wall", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha117-r0-left", type: "single", x: 24, y: 48, width: 18, depth: 32,
      sourceWidth: 32, sourceDepth: 18, bowlWidth: 14.5, bowlDepth: 16, bowlHeight: 10, bowlCount: 2,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: false,
      pelicanProfileId: "pelican-pl-ha117-r0-stainless-double-bowl-undermount", faucet: false, wallSide: "left",
    } as never;
    addSinkFixture(root, sink);
    const bowls: THREE.Object3D[] = [];
    const drains: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowls.push(node);
      if (node.userData.sinkDrain) drains.push(node);
    });
    expect(bowls).toHaveLength(2);
    expect(drains).toHaveLength(2);
    for (const drain of drains) {
      expect(drain.userData.documentedDrainInset).toBe(true);
      expect((drain.position.x - bowls[0].position.x) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
    }
  });

  it("renders PL-VS3218 as a countertop-seated measured normal-depth standard undermount sink", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-vs3218", type: "single", x: 24, y: 48, width: 32.125, depth: 18,
      sourceWidth: 32.125, sourceDepth: 18, bowlWidth: 30.125, bowlDepth: 16, bowlHeight: 9,
      exteriorHeight: 9, apronFront: false, pelicanProfileId: "pelican-pl-vs3218-stainless-undermount",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    const drains: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
      if (node.userData.sinkDrain) drains.push(node);
    });
    expect(bowl).not.toBeNull();
    expect(apron).toBeNull();
    expect(drains).toHaveLength(1);
    const bowlBounds = new THREE.Box3().setFromObject(bowl!);
    expect((bowlBounds.max.x - bowlBounds.min.x) * 12).toBeCloseTo(30.125, 5);
    expect((bowlBounds.max.z - bowlBounds.min.z) * 12).toBeCloseTo(16, 5);
    expect((bowlBounds.max.y - bowlBounds.min.y) * 12).toBeCloseTo(9, 5);
    expect(bowlBounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
  });

  it("renders PL-VS3018 as a countertop-seated measured normal-depth standard undermount sink", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-vs3018", type: "single", x: 24, y: 48, width: 30, depth: 18,
      sourceWidth: 30, sourceDepth: 18, bowlWidth: 28, bowlDepth: 16, bowlHeight: 9,
      exteriorHeight: 9, apronFront: false, pelicanProfileId: "pelican-pl-vs3018-stainless-undermount",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    const drains: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
      if (node.userData.sinkDrain) drains.push(node);
    });
    expect(bowl).not.toBeNull();
    expect(apron).toBeNull();
    expect(drains).toHaveLength(1);
    const bowlBounds = new THREE.Box3().setFromObject(bowl!);
    expect((bowlBounds.max.x - bowlBounds.min.x) * 12).toBeCloseTo(28, 5);
    expect((bowlBounds.max.z - bowlBounds.min.z) * 12).toBeCloseTo(16, 5);
    expect((bowlBounds.max.y - bowlBounds.min.y) * 12).toBeCloseTo(9, 5);
    expect(bowlBounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
  });

  it("renders PL-VS2718 as a countertop-seated measured normal-depth standard undermount sink", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-vs2718", type: "single", x: 24, y: 48, width: 27, depth: 18,
      sourceWidth: 27, sourceDepth: 18, bowlWidth: 25, bowlDepth: 16, bowlHeight: 9,
      exteriorHeight: 9, apronFront: false, pelicanProfileId: "pelican-pl-vs2718-stainless-undermount",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    const drains: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
      if (node.userData.sinkDrain) drains.push(node);
    });
    expect(bowl).not.toBeNull();
    expect(apron).toBeNull();
    expect(drains).toHaveLength(1);
    const bowlBounds = new THREE.Box3().setFromObject(bowl!);
    expect((bowlBounds.max.x - bowlBounds.min.x) * 12).toBeCloseTo(25, 5);
    expect((bowlBounds.max.z - bowlBounds.min.z) * 12).toBeCloseTo(16, 5);
    expect((bowlBounds.max.y - bowlBounds.min.y) * 12).toBeCloseTo(9, 5);
    expect(bowlBounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
  });

  it("renders PL-VS1815 as a countertop-seated measured compact standard undermount sink", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-vs1815", type: "single", x: 24, y: 48, width: 18.5, depth: 15,
      sourceWidth: 18.5, sourceDepth: 15, bowlWidth: 16.5, bowlDepth: 13, bowlHeight: 7,
      exteriorHeight: 7, apronFront: false, pelicanProfileId: "pelican-pl-vs1815-stainless-undermount",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    const drains: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
      if (node.userData.sinkDrain) drains.push(node);
    });
    expect(bowl).not.toBeNull();
    expect(apron).toBeNull();
    expect(drains).toHaveLength(1);
    const bowlBounds = new THREE.Box3().setFromObject(bowl!);
    expect((bowlBounds.max.x - bowlBounds.min.x) * 12).toBeCloseTo(16.5, 5);
    expect((bowlBounds.max.z - bowlBounds.min.z) * 12).toBeCloseTo(13, 5);
    expect((bowlBounds.max.y - bowlBounds.min.y) * 12).toBeCloseTo(7, 5);
    expect(bowlBounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
  });

  it("renders PL-VS2118 as a countertop-seated measured compact standard undermount sink", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-vs2118", type: "single", x: 24, y: 48, width: 20.625, depth: 17.875,
      sourceWidth: 20.625, sourceDepth: 17.875, bowlWidth: 18.625, bowlDepth: 15.875, bowlHeight: 9,
      exteriorHeight: 9, apronFront: false, pelicanProfileId: "pelican-pl-vs2118-stainless-undermount",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    const drains: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
      if (node.userData.sinkDrain) drains.push(node);
    });
    expect(bowl).not.toBeNull();
    expect(apron).toBeNull();
    expect(drains).toHaveLength(1);
    const bowlBounds = new THREE.Box3().setFromObject(bowl!);
    expect((bowlBounds.max.x - bowlBounds.min.x) * 12).toBeCloseTo(18.625, 5);
    expect((bowlBounds.max.z - bowlBounds.min.z) * 12).toBeCloseTo(15.875, 5);
    expect((bowlBounds.max.y - bowlBounds.min.y) * 12).toBeCloseTo(9, 5);
    expect(bowlBounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
  });

  it("renders PL-VS2318 as a countertop-seated measured normal-depth standard undermount sink", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-vs2318", type: "single", x: 24, y: 48, width: 23, depth: 17.75,
      sourceWidth: 23, sourceDepth: 17.75, bowlWidth: 21, bowlDepth: 15.75, bowlHeight: 9,
      exteriorHeight: 9, apronFront: false, pelicanProfileId: "pelican-pl-vs2318-stainless-undermount",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    const drains: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
      if (node.userData.sinkDrain) drains.push(node);
    });
    expect(bowl).not.toBeNull();
    expect(apron).toBeNull();
    expect(drains).toHaveLength(1);
    const bowlBounds = new THREE.Box3().setFromObject(bowl!);
    expect((bowlBounds.max.x - bowlBounds.min.x) * 12).toBeCloseTo(21, 5);
    expect((bowlBounds.max.z - bowlBounds.min.z) * 12).toBeCloseTo(15.75, 5);
    expect((bowlBounds.max.y - bowlBounds.min.y) * 12).toBeCloseTo(9, 5);
    expect(bowlBounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
  });

  it("renders PL-HA119’s source-verified rear-right drain offset through top and left wall orientations", () => {
    const measuredDrain = (wallSide: "top" | "left") => {
      const root = new THREE.Group();
      const sink = {
        uid: `pelican-pl-ha119-r19-${wallSide}`, type: "single", x: 24, y: 48,
        width: wallSide === "top" ? 31.25 : 18, depth: wallSide === "top" ? 18 : 31.25,
        sourceWidth: 31.25, sourceDepth: 18, bowlWidth: 29.25, bowlDepth: 16, bowlHeight: 9.5,
        drainInsetRight: 5, drainInsetBack: 5, exteriorHeight: 10, apronFront: false,
        pelicanProfileId: "pelican-pl-ha119-r19-stainless-offset-drain-undermount", faucet: false, wallSide,
      } as never;
      addSinkFixture(root, sink);
      let bowl: THREE.Object3D | null = null;
      let drain: THREE.Object3D | null = null;
      root.traverse((node) => {
        if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
        if (node.userData.sinkDrain) drain = node;
      });
      expect(bowl).not.toBeNull();
      expect(drain).not.toBeNull();
      expect(drain?.userData.documentedDrainInset).toBe(true);
      return { bowl: bowl!, drain: drain! };
    };
    const top = measuredDrain("top");
    expect((top.drain.position.x - top.bowl.position.x) * 12).toBeCloseTo(9.625, 5);
    expect((top.drain.position.z - top.bowl.position.z) * 12).toBeCloseTo(-3, 5);
    const left = measuredDrain("left");
    expect((left.drain.position.x - left.bowl.position.x) * 12).toBeCloseTo(-3, 5);
    expect((left.drain.position.z - left.bowl.position.z) * 12).toBeCloseTo(-9.625, 5);
  });

  it("renders PL-HA109’s source-verified rear-center drain through top and left wall orientations", () => {
    const measuredDrain = (wallSide: "top" | "left") => {
      const root = new THREE.Group();
      const sink = {
        uid: `pelican-pl-ha109-r0-${wallSide}`, type: "single", x: 24, y: 48,
        width: wallSide === "top" ? 30 : 18, depth: wallSide === "top" ? 18 : 30,
        sourceWidth: 30, sourceDepth: 18, bowlWidth: 28, bowlDepth: 16, bowlHeight: 10,
        drainInsetBack: 1, exteriorHeight: 10, apronFront: false,
        pelicanProfileId: "pelican-pl-ha109-stainless-undermount", faucet: false, wallSide,
      } as never;
      addSinkFixture(root, sink);
      let bowl: THREE.Object3D | null = null;
      let drain: THREE.Object3D | null = null;
      root.traverse((node) => {
        if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
        if (node.userData.sinkDrain) drain = node;
      });
      expect(bowl).not.toBeNull();
      expect(drain).not.toBeNull();
      expect(drain?.userData.documentedDrainInset).toBe(true);
      return { bowl: bowl!, drain: drain! };
    };
    const top = measuredDrain("top");
    expect((top.drain.position.x - top.bowl.position.x) * 12).toBeCloseTo(0, 5);
    expect((top.drain.position.z - top.bowl.position.z) * 12).toBeCloseTo(-7, 5);
    const left = measuredDrain("left");
    expect((left.drain.position.x - left.bowl.position.x) * 12).toBeCloseTo(-7, 5);
    expect((left.drain.position.z - left.bowl.position.z) * 12).toBeCloseTo(0, 5);
  });

  it("renders PL-HA104’s source-verified rear-center drain through top and left wall orientations", () => {
    const measuredDrain = (wallSide: "top" | "left") => {
      const root = new THREE.Group();
      const sink = {
        uid: `pelican-pl-ha104-r0-${wallSide}`, type: "single", x: 24, y: 48,
        width: wallSide === "top" ? 17 : 18, depth: wallSide === "top" ? 18 : 17,
        sourceWidth: 17, sourceDepth: 18, bowlWidth: 15, bowlDepth: 16, bowlHeight: 10,
        drainInsetBack: 1, exteriorHeight: 10, apronFront: false,
        pelicanProfileId: "pelican-pl-ha104-r0-stainless-undermount", faucet: false, wallSide,
      } as never;
      addSinkFixture(root, sink);
      let bowl: THREE.Object3D | null = null;
      let drain: THREE.Object3D | null = null;
      root.traverse((node) => {
        if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
        if (node.userData.sinkDrain) drain = node;
      });
      expect(bowl).not.toBeNull();
      expect(drain).not.toBeNull();
      expect(drain?.userData.documentedDrainInset).toBe(true);
      return { bowl: bowl!, drain: drain! };
    };
    const top = measuredDrain("top");
    expect((top.drain.position.x - top.bowl.position.x) * 12).toBeCloseTo(0, 5);
    expect((top.drain.position.z - top.bowl.position.z) * 12).toBeCloseTo(-7, 5);
    const left = measuredDrain("left");
    expect((left.drain.position.x - left.bowl.position.x) * 12).toBeCloseTo(-7, 5);
    expect((left.drain.position.z - left.bowl.position.z) * 12).toBeCloseTo(0, 5);
  });

  it("renders PL-HA108’s source-verified rear-center drain through top and left wall orientations", () => {
    const measuredDrain = (wallSide: "top" | "left") => {
      const root = new THREE.Group();
      const sink = {
        uid: `pelican-pl-ha108-r0-${wallSide}`, type: "single", x: 24, y: 48,
        width: wallSide === "top" ? 23 : 18, depth: wallSide === "top" ? 18 : 23,
        sourceWidth: 23, sourceDepth: 18, bowlWidth: 21, bowlDepth: 16, bowlHeight: 10,
        drainInsetBack: 1, exteriorHeight: 10, apronFront: false,
        pelicanProfileId: "pelican-pl-ha108-r0-stainless-undermount", faucet: false, wallSide,
      } as never;
      addSinkFixture(root, sink);
      let bowl: THREE.Object3D | null = null;
      let drain: THREE.Object3D | null = null;
      root.traverse((node) => {
        if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
        if (node.userData.sinkDrain) drain = node;
      });
      expect(bowl).not.toBeNull();
      expect(drain).not.toBeNull();
      expect(drain?.userData.documentedDrainInset).toBe(true);
      return { bowl: bowl!, drain: drain! };
    };
    const top = measuredDrain("top");
    expect((top.drain.position.x - top.bowl.position.x) * 12).toBeCloseTo(0, 5);
    expect((top.drain.position.z - top.bowl.position.z) * 12).toBeCloseTo(-7, 5);
    const left = measuredDrain("left");
    expect((left.drain.position.x - left.bowl.position.x) * 12).toBeCloseTo(-7, 5);
    expect((left.drain.position.z - left.bowl.position.z) * 12).toBeCloseTo(0, 5);
  });

  it("renders PL-HA111’s source-verified rear-center drain through top and left wall orientations", () => {
    const measuredDrain = (wallSide: "top" | "left") => {
      const root = new THREE.Group();
      const sink = {
        uid: `pelican-pl-ha111-r0-${wallSide}`, type: "single", x: 24, y: 48,
        width: wallSide === "top" ? 27 : 18, depth: wallSide === "top" ? 18 : 27,
        sourceWidth: 27, sourceDepth: 18, bowlWidth: 25, bowlDepth: 16, bowlHeight: 10,
        drainInsetBack: 1, exteriorHeight: 10, apronFront: false,
        pelicanProfileId: "pelican-pl-ha111-r0-stainless-undermount", faucet: false, wallSide,
      } as never;
      addSinkFixture(root, sink);
      let bowl: THREE.Object3D | null = null;
      let drain: THREE.Object3D | null = null;
      root.traverse((node) => {
        if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
        if (node.userData.sinkDrain) drain = node;
      });
      expect(bowl).not.toBeNull();
      expect(drain).not.toBeNull();
      expect(drain?.userData.documentedDrainInset).toBe(true);
      return { bowl: bowl!, drain: drain! };
    };
    const top = measuredDrain("top");
    expect((top.drain.position.x - top.bowl.position.x) * 12).toBeCloseTo(0, 5);
    expect((top.drain.position.z - top.bowl.position.z) * 12).toBeCloseTo(-7, 5);
    const left = measuredDrain("left");
    expect((left.drain.position.x - left.bowl.position.x) * 12).toBeCloseTo(-7, 5);
    expect((left.drain.position.z - left.bowl.position.z) * 12).toBeCloseTo(0, 5);
  });

  it("renders PL-HA130 as a countertop-seated double-bowl farmhouse sink with two 16-inch bowls, drains, and a visible apron", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha130-r0", type: "farmhouse", x: 24, y: 48, width: 36, depth: 21,
      sourceWidth: 36, sourceDepth: 21, bowlWidth: 16, bowlDepth: 16, bowlHeight: 10, bowlCount: 2,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: true, pelicanProfileId: "pelican-pl-ha130-r0-stainless-double-bowl-farmhouse",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    const bowls: THREE.Object3D[] = [];
    const drains: THREE.Object3D[] = [];
    let apron: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowls.push(node);
      if (node.userData.sinkDrain) drains.push(node);
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
    });
    expect(bowls).toHaveLength(2);
    expect(drains).toHaveLength(2);
    expect(apron).not.toBeNull();
    for (const [index, bowl] of bowls.entries()) {
      const bounds = new THREE.Box3().setFromObject(bowl);
      expect((bounds.max.x - bounds.min.x) * 12).toBeCloseTo(16, 5);
      expect((bounds.max.z - bounds.min.z) * 12).toBeCloseTo(16, 5);
      expect((bounds.max.y - bounds.min.y) * 12).toBeCloseTo(10, 5);
      expect(bounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
      expect(drains[index]?.userData.documentedDrainInset).toBe(true);
      expect((drains[index]!.position.z - bowls[index].position.z) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
    }
    expect(apron?.position.z).toBeGreaterThan(sinkFixtureTransform(sink).z);
  });

  it("preserves PL-HA130’s source-verified rear-center drains on a left wall", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha130-r0-left", type: "farmhouse", x: 24, y: 48, width: 21, depth: 36,
      sourceWidth: 36, sourceDepth: 21, bowlWidth: 16, bowlDepth: 16, bowlHeight: 10, bowlCount: 2,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: true,
      pelicanProfileId: "pelican-pl-ha130-r0-stainless-double-bowl-farmhouse", faucet: false, wallSide: "left",
    } as never;
    addSinkFixture(root, sink);
    const bowls: THREE.Object3D[] = [];
    const drains: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowls.push(node);
      if (node.userData.sinkDrain) drains.push(node);
    });
    expect(bowls).toHaveLength(2);
    expect(drains).toHaveLength(2);
    for (const [index, drain] of drains.entries()) {
      expect(drain.userData.documentedDrainInset).toBe(true);
      expect((drain.position.x - bowls[index].position.x) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
    }
  });

  it("renders PL-HA122 as a countertop-seated measured single-bowl farmhouse sink with a visible apron", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha122-r15", type: "farmhouse", x: 24, y: 48, width: 32.875, depth: 20.75,
      sourceWidth: 32.875, sourceDepth: 20.75, bowlWidth: 30, bowlDepth: 16, bowlHeight: 10,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: true, pelicanProfileId: "pelican-pl-ha122-r15-stainless-farmhouse",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    let drain: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
      if (node.userData.sinkDrain) drain = node;
    });
    expect(bowl).not.toBeNull();
    expect(apron).not.toBeNull();
    expect(drain).not.toBeNull();
    const bowlBounds = new THREE.Box3().setFromObject(bowl!);
    expect((bowlBounds.max.x - bowlBounds.min.x) * 12).toBeCloseTo(30, 5);
    expect((bowlBounds.max.z - bowlBounds.min.z) * 12).toBeCloseTo(16, 5);
    expect((bowlBounds.max.y - bowlBounds.min.y) * 12).toBeCloseTo(10, 5);
    expect(bowlBounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
    expect(apron?.position.z).toBeGreaterThan(sinkFixtureTransform(sink).z);
    expect(drain?.userData.documentedDrainInset).toBe(true);
    expect((drain!.position.z - bowl!.position.z) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
  });

  it("preserves PL-HA122’s source-verified rear-center drain on a left wall", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha122-r15-left", type: "farmhouse", x: 24, y: 48, width: 20.75, depth: 32.875,
      sourceWidth: 32.875, sourceDepth: 20.75, bowlWidth: 30, bowlDepth: 16, bowlHeight: 10,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: true,
      pelicanProfileId: "pelican-pl-ha122-r15-stainless-farmhouse", faucet: false, wallSide: "left",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let drain: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.sinkDrain) drain = node;
    });
    expect(bowl).not.toBeNull();
    expect(drain?.userData.documentedDrainInset).toBe(true);
    expect((drain!.position.x - bowl!.position.x) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
  });

  it("renders PL-HA118 as a countertop-seated compact single-bowl farmhouse sink with a visible apron", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha118-r15", type: "farmhouse", x: 24, y: 48, width: 30, depth: 21,
      sourceWidth: 30, sourceDepth: 21, bowlWidth: 27, bowlDepth: 16, bowlHeight: 10,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: true, pelicanProfileId: "pelican-pl-ha118-r15-stainless-farmhouse",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    let drain: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
      if (node.userData.sinkDrain) drain = node;
    });
    expect(bowl).not.toBeNull();
    expect(apron).not.toBeNull();
    expect(drain).not.toBeNull();
    const bowlBounds = new THREE.Box3().setFromObject(bowl!);
    expect((bowlBounds.max.x - bowlBounds.min.x) * 12).toBeCloseTo(27, 5);
    expect((bowlBounds.max.z - bowlBounds.min.z) * 12).toBeCloseTo(16, 5);
    expect((bowlBounds.max.y - bowlBounds.min.y) * 12).toBeCloseTo(10, 5);
    expect(bowlBounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
    expect(apron?.position.z).toBeGreaterThan(sinkFixtureTransform(sink).z);
    expect(drain?.userData.documentedDrainInset).toBe(true);
    expect((drain!.position.z - bowl!.position.z) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
  });

  it("preserves PL-HA118’s source-verified rear-center drain on a left wall", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha118-r15-left", type: "farmhouse", x: 24, y: 48, width: 21, depth: 30,
      sourceWidth: 30, sourceDepth: 21, bowlWidth: 27, bowlDepth: 16, bowlHeight: 10,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: true,
      pelicanProfileId: "pelican-pl-ha118-r15-stainless-farmhouse", faucet: false, wallSide: "left",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let drain: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.sinkDrain) drain = node;
    });
    expect(bowl).not.toBeNull();
    expect(drain?.userData.documentedDrainInset).toBe(true);
    expect((drain!.position.x - bowl!.position.x) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
  });

  it("renders PL-HA124 as a countertop-seated measured single-bowl farmhouse sink with a visible apron", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha124-r0", type: "farmhouse", x: 24, y: 48, width: 35.875, depth: 20.75,
      sourceWidth: 35.875, sourceDepth: 20.75, bowlWidth: 33, bowlDepth: 16, bowlHeight: 10,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: true, pelicanProfileId: "pelican-pl-ha124-r0-stainless-farmhouse",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    let drain: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
      if (node.userData.sinkDrain) drain = node;
    });
    expect(bowl).not.toBeNull();
    expect(apron).not.toBeNull();
    expect(drain).not.toBeNull();
    const bowlBounds = new THREE.Box3().setFromObject(bowl!);
    expect((bowlBounds.max.x - bowlBounds.min.x) * 12).toBeCloseTo(33, 5);
    expect((bowlBounds.max.z - bowlBounds.min.z) * 12).toBeCloseTo(16, 5);
    expect((bowlBounds.max.y - bowlBounds.min.y) * 12).toBeCloseTo(10, 5);
    expect(bowlBounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
    expect(apron?.position.z).toBeGreaterThan(sinkFixtureTransform(sink).z);
    expect(drain?.userData.documentedDrainInset).toBe(true);
    expect((drain!.position.z - bowl!.position.z) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
  });

  it("preserves PL-HA124’s source-verified rear-center drain on a left wall", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha124-r0-left", type: "farmhouse", x: 24, y: 48, width: 20.75, depth: 35.875,
      sourceWidth: 35.875, sourceDepth: 20.75, bowlWidth: 33, bowlDepth: 16, bowlHeight: 10,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: true,
      pelicanProfileId: "pelican-pl-ha124-r0-stainless-farmhouse", faucet: false, wallSide: "left",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let drain: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.sinkDrain) drain = node;
    });
    expect(bowl).not.toBeNull();
    expect(drain?.userData.documentedDrainInset).toBe(true);
    expect((drain!.position.x - bowl!.position.x) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
  });

  it("renders PL-HA115 as a countertop-seated measured standard undermount sink without an apron", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha115-r0", type: "single", x: 24, y: 48, width: 32, depth: 18,
      sourceWidth: 32, sourceDepth: 18, bowlWidth: 30, bowlDepth: 16, bowlHeight: 10,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: false, pelicanProfileId: "pelican-pl-ha115-r0-stainless-undermount",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    let drain: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
      if (node.userData.sinkDrain) drain = node;
    });
    expect(bowl).not.toBeNull();
    expect(apron).toBeNull();
    expect(drain).not.toBeNull();
    const bowlBounds = new THREE.Box3().setFromObject(bowl!);
    expect((bowlBounds.max.x - bowlBounds.min.x) * 12).toBeCloseTo(30, 5);
    expect((bowlBounds.max.z - bowlBounds.min.z) * 12).toBeCloseTo(16, 5);
    expect((bowlBounds.max.y - bowlBounds.min.y) * 12).toBeCloseTo(10, 5);
    expect(bowlBounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
    expect(drain?.userData.documentedDrainInset).toBe(true);
    expect((drain!.position.z - bowl!.position.z) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
  });

  it("preserves PL-HA115’s source-verified rear-center drain on a left wall", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha115-r0-left", type: "single", x: 24, y: 48, width: 18, depth: 32,
      sourceWidth: 32, sourceDepth: 18, bowlWidth: 30, bowlDepth: 16, bowlHeight: 10,
      drainInsetBack: 120 / 25.4, exteriorHeight: 10, apronFront: false,
      pelicanProfileId: "pelican-pl-ha115-r0-stainless-undermount", faucet: false, wallSide: "left",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let drain: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.sinkDrain) drain = node;
    });
    expect(bowl).not.toBeNull();
    expect(drain?.userData.documentedDrainInset).toBe(true);
    expect((drain!.position.x - bowl!.position.x) * 12).toBeCloseTo(-(8 - 120 / 25.4), 5);
  });

  it("renders PL-HA104 as a countertop-seated compact standard undermount sink without an apron", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha104-r0", type: "single", x: 24, y: 48, width: 17, depth: 18,
      sourceWidth: 17, sourceDepth: 18, bowlWidth: 15, bowlDepth: 16, bowlHeight: 10,
      exteriorHeight: 10, apronFront: false, pelicanProfileId: "pelican-pl-ha104-r0-stainless-undermount",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
    });
    expect(bowl).not.toBeNull();
    expect(apron).toBeNull();
    const bowlBounds = new THREE.Box3().setFromObject(bowl!);
    expect((bowlBounds.max.x - bowlBounds.min.x) * 12).toBeCloseTo(15, 5);
    expect((bowlBounds.max.z - bowlBounds.min.z) * 12).toBeCloseTo(16, 5);
    expect((bowlBounds.max.y - bowlBounds.min.y) * 12).toBeCloseTo(10, 5);
    expect(bowlBounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
  });

  it("renders PL-HA108 R0 as a countertop-seated measured standard undermount sink without an apron", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha108-r0", type: "single", x: 24, y: 48, width: 23, depth: 18,
      sourceWidth: 23, sourceDepth: 18, bowlWidth: 21, bowlDepth: 16, bowlHeight: 10,
      exteriorHeight: 10, apronFront: false, pelicanProfileId: "pelican-pl-ha108-r0-stainless-undermount",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    const drains: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
      if (node.userData.sinkDrain) drains.push(node);
    });
    expect(bowl).not.toBeNull();
    expect(apron).toBeNull();
    expect(drains).toHaveLength(1);
    const bowlBounds = new THREE.Box3().setFromObject(bowl!);
    expect((bowlBounds.max.x - bowlBounds.min.x) * 12).toBeCloseTo(21, 5);
    expect((bowlBounds.max.z - bowlBounds.min.z) * 12).toBeCloseTo(16, 5);
    expect((bowlBounds.max.y - bowlBounds.min.y) * 12).toBeCloseTo(10, 5);
    expect(bowlBounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
  });

  it("renders PL-HA111 R0 as a countertop-seated measured standard undermount sink without an apron", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-ha111-r0", type: "single", x: 24, y: 48, width: 27, depth: 18,
      sourceWidth: 27, sourceDepth: 18, bowlWidth: 25, bowlDepth: 16, bowlHeight: 10,
      exteriorHeight: 10, apronFront: false, pelicanProfileId: "pelican-pl-ha111-r0-stainless-undermount",
      faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkBowl) bowl = node;
      if (node.userData.pelicanProfileId === sink.pelicanProfileId && node.userData.sinkApronFront) apron = node;
    });
    expect(bowl).not.toBeNull();
    expect(apron).toBeNull();
    const bowlBounds = new THREE.Box3().setFromObject(bowl!);
    expect((bowlBounds.max.x - bowlBounds.min.x) * 12).toBeCloseTo(25, 5);
    expect((bowlBounds.max.z - bowlBounds.min.z) * 12).toBeCloseTo(16, 5);
    expect((bowlBounds.max.y - bowlBounds.min.y) * 12).toBeCloseTo(10, 5);
    expect(bowlBounds.max.y).toBeCloseTo(sinkFixtureTransform(sink).countertopTop, 6);
  });

  it("uses the verified PL-8203 faucet height and spout dimensions instead of generic pull-down proportions", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-8203",
      type: "single",
      x: 24,
      y: 48,
      width: 30,
      depth: 18,
      faucet: true,
      wallSide: "top",
      pelicanFaucetProfileId: "pelican-pl-8203-fountain-pull-down",
      faucetOverallHeight: 27.1875,
      faucetSpoutLength: 9.875,
      faucetSpoutHeight: 4.9375,
      faucetForm: "pull-down",
    } as never;
    addSinkFixture(root, sink);
    let spout: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node.userData.pelicanFaucetProfileId === "pelican-pl-8203-fountain-pull-down" && node.userData.sinkFaucetSpout) spout = node;
    });
    expect(spout).not.toBeNull();
    const spoutBounds = new THREE.Box3().setFromObject(spout!);
    const countertopTop = sinkFixtureTransform(sink).countertopTop;
    expect((spoutBounds.max.y - countertopTop) * 12).toBeCloseTo(27.1875, 0);
    expect((spoutBounds.max.z - spoutBounds.min.z) * 12).toBeGreaterThan(9);
  });

  it("keeps a selected matte-black Pelican faucet finish on its measured pull-down geometry", () => {
    const root = new THREE.Group();
    addSinkFixture(root, {
      uid: "pelican-pl-8207-mb", type: "single", x: 24, y: 48, width: 30, depth: 18, faucet: true, wallSide: "top",
      pelicanFaucetProfileId: "pelican-pl-8207-fountain-pull-down-matte-black",
      faucetOverallHeight: 26.125, faucetSpoutLength: 7.6875, faucetSpoutHeight: 6.5, faucetFinish: "matte-black", faucetForm: "pull-down",
    } as never);
    let spout: THREE.Mesh | null = null;
    root.traverse((node) => { if (node.userData.pelicanFaucetProfileId === "pelican-pl-8207-fountain-pull-down-matte-black" && node.userData.sinkFaucetSpout) spout = node as THREE.Mesh; });
    expect(spout?.userData.faucetFinish).toBe("matte-black");
    expect((spout?.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("24272a");
  });

  it("keeps the selected PL-8237 brushed-gold finish on the verified standard-arc faucet geometry", () => {
    const root = new THREE.Group();
    addSinkFixture(root, {
      uid: "pelican-pl-8237-bg", type: "single", x: 24, y: 48, width: 30, depth: 18, faucet: true, wallSide: "top",
      pelicanFaucetProfileId: "pelican-pl-8237-fountain-standard-arc-brushed-gold",
      faucetOverallHeight: 12.8125, faucetSpoutLength: 7.0625, faucetSpoutHeight: 8.375, faucetFinish: "brushed-gold", faucetForm: "standard-arc",
    } as never);
    let spout: THREE.Mesh | null = null;
    root.traverse((node) => { if (node.userData.pelicanFaucetProfileId === "pelican-pl-8237-fountain-standard-arc-brushed-gold" && node.userData.sinkFaucetSpout) spout = node as THREE.Mesh; });
    expect(spout?.userData.faucetFinish).toBe("brushed-gold");
    expect(spout?.userData.faucetForm).toBe("standard-arc");
    expect((spout?.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("b28a42");
  });

  it("renders the verified PL-8248 pull-out form with its separate handheld spray head", () => {
    const root = new THREE.Group();
    addSinkFixture(root, {
      uid: "pelican-pl-8248-bn", type: "single", x: 24, y: 48, width: 30, depth: 18, faucet: true, wallSide: "top",
      pelicanFaucetProfileId: "pelican-pl-8248-fountain-pull-out-brushed-nickel",
      faucetOverallHeight: 12.375, faucetSpoutLength: 10.0625, faucetSpoutHeight: 10.875, faucetFinish: "brushed-nickel", faucetForm: "pull-out",
    } as never);
    const markers = new Set<string>();
    root.traverse((node) => { for (const [key, value] of Object.entries(node.userData)) if (value === true) markers.add(key); });
    expect(markers.has("sinkFaucetSpout")).toBe(true);
    expect(markers.has("sinkFaucetSprayHead")).toBe(true);
    const pullOutSpout = root.children.find((node) => node.userData.pelicanFaucetProfileId === "pelican-pl-8248-fountain-pull-out-brushed-nickel" && node.userData.sinkFaucetSpout);
    expect(pullOutSpout?.userData.faucetForm).toBe("pull-out");
  });

  it("uses the compact PL-8222 pull-out profile dimensions instead of a generic faucet", () => {
    const root = new THREE.Group();
    addSinkFixture(root, {
      uid: "pelican-pl-8222-bn", type: "single", x: 24, y: 48, width: 30, depth: 18, faucet: true, wallSide: "top",
      pelicanFaucetProfileId: "pelican-pl-8222-fountain-pull-out-brushed-nickel",
      faucetOverallHeight: 9.5625, faucetSpoutLength: 8.375, faucetSpoutHeight: 5.8125, faucetFinish: "brushed-nickel", faucetForm: "pull-out",
    } as never);
    let spout: THREE.Object3D | null = null;
    root.traverse((node) => { if (node.userData.pelicanFaucetProfileId === "pelican-pl-8222-fountain-pull-out-brushed-nickel" && node.userData.sinkFaucetSpout) spout = node; });
    expect(spout?.userData.faucetForm).toBe("pull-out");
    const bounds = new THREE.Box3().setFromObject(spout!);
    expect((bounds.max.y - sinkFixtureTransform({ x: 24, y: 48, width: 30, depth: 18 } as never).countertopTop) * 12).toBeCloseTo(9.5625, 0);
  });

  it("uses the PL-8231 measured pull-out geometry and selected matte-black finish", () => {
    const root = new THREE.Group();
    addSinkFixture(root, {
      uid: "pelican-pl-8231-mb", type: "single", x: 24, y: 48, width: 30, depth: 18, faucet: true, wallSide: "top",
      pelicanFaucetProfileId: "pelican-pl-8231-fountain-pull-out-matte-black",
      faucetOverallHeight: 15.75, faucetSpoutLength: 9.375, faucetSpoutHeight: 6.5, faucetFinish: "matte-black", faucetForm: "pull-out",
    } as never);
    let spout: THREE.Object3D | null = null;
    root.traverse((node) => { if (node.userData.pelicanFaucetProfileId === "pelican-pl-8231-fountain-pull-out-matte-black" && node.userData.sinkFaucetSpout) spout = node; });
    expect(spout?.userData.faucetForm).toBe("pull-out");
    expect(spout?.userData.faucetFinish).toBe("matte-black");
    const bounds = new THREE.Box3().setFromObject(spout!);
    expect((bounds.max.y - sinkFixtureTransform({ x: 24, y: 48, width: 30, depth: 18 } as never).countertopTop) * 12).toBeCloseTo(15.75, 0);
  });

  it("renders PL-8206 with its documented pair of articulated swing joints", () => {
    const root = new THREE.Group();
    addSinkFixture(root, {
      uid: "pelican-pl-8206-mb", type: "single", x: 24, y: 48, width: 30, depth: 18, faucet: true, wallSide: "top",
      pelicanFaucetProfileId: "pelican-pl-8206-fountain-articulated-swing-matte-black",
      faucetOverallHeight: 10.5, faucetSpoutLength: 9.75, faucetSpoutHeight: 9.25, faucetFinish: "matte-black", faucetForm: "articulated-swing",
    } as never);
    const joints: THREE.Object3D[] = [];
    root.traverse((node) => { if (node.userData.sinkFaucetSwingJoint) joints.push(node); });
    expect(joints).toHaveLength(2);
    expect(joints.map((joint) => joint.userData.swingJointIndex)).toEqual([1, 2]);
  });

  it("keeps the selected PL-8224 oil-rubbed-bronze finish on its measured pull-out geometry", () => {
    const root = new THREE.Group();
    addSinkFixture(root, {
      uid: "pelican-pl-8224-orb", type: "single", x: 24, y: 48, width: 30, depth: 18, faucet: true, wallSide: "top",
      pelicanFaucetProfileId: "pelican-pl-8224-fountain-pull-out-oil-rubbed-bronze",
      faucetOverallHeight: 19.3125, faucetSpoutLength: 7.9375, faucetSpoutHeight: 10.25, faucetFinish: "oil-rubbed-bronze", faucetForm: "pull-out",
    } as never);
    let spout: THREE.Mesh | null = null;
    root.traverse((node) => { if (node.userData.pelicanFaucetProfileId === "pelican-pl-8224-fountain-pull-out-oil-rubbed-bronze" && node.userData.sinkFaucetSpout) spout = node as THREE.Mesh; });
    expect(spout?.userData.faucetFinish).toBe("oil-rubbed-bronze");
    expect((spout?.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("4a3328");
  });

  it("uses the PL-8210 commercial pull-down height rather than a generic faucet proportion", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-8210-bn", type: "single", x: 24, y: 48, width: 30, depth: 18, faucet: true, wallSide: "top",
      pelicanFaucetProfileId: "pelican-pl-8210-fountain-commercial-pull-down-brushed-nickel",
      faucetOverallHeight: 22.5, faucetSpoutLength: 9.75, faucetSpoutHeight: 7.75, faucetFinish: "brushed-nickel", faucetForm: "pull-down",
    } as never;
    addSinkFixture(root, sink);
    let spout: THREE.Object3D | null = null;
    root.traverse((node) => { if (node.userData.pelicanFaucetProfileId === "pelican-pl-8210-fountain-commercial-pull-down-brushed-nickel" && node.userData.sinkFaucetSpout) spout = node; });
    expect(spout).not.toBeNull();
    const bounds = new THREE.Box3().setFromObject(spout!);
    expect((bounds.max.y - sinkFixtureTransform(sink).countertopTop) * 12).toBeCloseTo(22.5, 0);
  });

  it("retains the selected PL-8211 brushed-gold finish on its measured pull-down profile", () => {
    const root = new THREE.Group();
    addSinkFixture(root, {
      uid: "pelican-pl-8211-bg", type: "single", x: 24, y: 48, width: 30, depth: 18, faucet: true, wallSide: "top",
      pelicanFaucetProfileId: "pelican-pl-8211-fountain-pull-down-brushed-gold",
      faucetOverallHeight: 15.6875, faucetSpoutLength: 9.4375, faucetSpoutHeight: 6.625, faucetFinish: "brushed-gold", faucetForm: "pull-down",
    } as never);
    let spout: THREE.Mesh | null = null;
    root.traverse((node) => { if (node.userData.pelicanFaucetProfileId === "pelican-pl-8211-fountain-pull-down-brushed-gold" && node.userData.sinkFaucetSpout) spout = node as THREE.Mesh; });
    expect(spout?.userData.faucetFinish).toBe("brushed-gold");
    expect((spout?.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("b28a42");
  });

  it("uses the PL-8213 source-verified pull-down dimensions in the 3D kitchen", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-8213-chr", type: "single", x: 24, y: 48, width: 30, depth: 18, faucet: true, wallSide: "top",
      pelicanFaucetProfileId: "pelican-pl-8213-fountain-pull-down-chrome",
      faucetOverallHeight: 15.75, faucetSpoutLength: 9.375, faucetSpoutHeight: 6.5, faucetFinish: "chrome", faucetForm: "pull-down",
    } as never;
    addSinkFixture(root, sink);
    let spout: THREE.Object3D | null = null;
    root.traverse((node) => { if (node.userData.pelicanFaucetProfileId === "pelican-pl-8213-fountain-pull-down-chrome" && node.userData.sinkFaucetSpout) spout = node; });
    expect(spout).not.toBeNull();
    const bounds = new THREE.Box3().setFromObject(spout!);
    expect((bounds.max.y - sinkFixtureTransform(sink).countertopTop) * 12).toBeCloseTo(15.75, 0);
  });

  it("retains the selected PL-8217 oil-rubbed-bronze finish on measured pull-down geometry", () => {
    const root = new THREE.Group();
    addSinkFixture(root, {
      uid: "pelican-pl-8217-orb", type: "single", x: 24, y: 48, width: 30, depth: 18, faucet: true, wallSide: "top",
      pelicanFaucetProfileId: "pelican-pl-8217-fountain-pull-down-oil-rubbed-bronze",
      faucetOverallHeight: 16.8125, faucetSpoutLength: 9.375, faucetSpoutHeight: 7.5625, faucetFinish: "oil-rubbed-bronze", faucetForm: "pull-down",
    } as never);
    let spout: THREE.Mesh | null = null;
    root.traverse((node) => { if (node.userData.pelicanFaucetProfileId === "pelican-pl-8217-fountain-pull-down-oil-rubbed-bronze" && node.userData.sinkFaucetSpout) spout = node as THREE.Mesh; });
    expect(spout?.userData.faucetFinish).toBe("oil-rubbed-bronze");
    expect((spout?.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("4a3328");
  });

  it("uses the PL-8218 source-verified pull-down dimensions in the 3D kitchen", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-8218-mb", type: "single", x: 24, y: 48, width: 30, depth: 18, faucet: true, wallSide: "top",
      pelicanFaucetProfileId: "pelican-pl-8218-fountain-pull-down-matte-black",
      faucetOverallHeight: 17.6875, faucetSpoutLength: 9.375, faucetSpoutHeight: 8.375, faucetFinish: "matte-black", faucetForm: "pull-down",
    } as never;
    addSinkFixture(root, sink);
    let spout: THREE.Object3D | null = null;
    root.traverse((node) => { if (node.userData.pelicanFaucetProfileId === "pelican-pl-8218-fountain-pull-down-matte-black" && node.userData.sinkFaucetSpout) spout = node; });
    expect(spout).not.toBeNull();
    const bounds = new THREE.Box3().setFromObject(spout!);
    expect((bounds.max.y - sinkFixtureTransform(sink).countertopTop) * 12).toBeCloseTo(17.6875, 0);
  });

  it("uses the PL-8257 source-verified pull-down height and selected finish in the 3D kitchen", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-8257-mb", type: "single", x: 24, y: 48, width: 30, depth: 18, faucet: true, wallSide: "top",
      pelicanFaucetProfileId: "pelican-pl-8257-fountain-pull-down-matte-black",
      faucetOverallHeight: 17.75, faucetSpoutLength: 8.25, faucetSpoutHeight: 9.5, faucetFinish: "matte-black", faucetForm: "pull-down",
    } as never;
    addSinkFixture(root, sink);
    let spout: THREE.Mesh | null = null;
    root.traverse((node) => { if (node.userData.pelicanFaucetProfileId === "pelican-pl-8257-fountain-pull-down-matte-black" && node.userData.sinkFaucetSpout) spout = node as THREE.Mesh; });
    expect(spout?.userData).toMatchObject({ faucetFinish: "matte-black", faucetForm: "pull-down" });
    const bounds = new THREE.Box3().setFromObject(spout!);
    expect((bounds.max.y - sinkFixtureTransform(sink).countertopTop) * 12).toBeCloseTo(17.75, 0);
  });

  it("does not invent a generic faucet for a sink without a verified Pelican faucet profile", () => {
    const root = new THREE.Group();
    addSinkFixture(root, { uid: "unverified-faucet", type: "single", x: 24, y: 48, width: 30, depth: 18, faucet: true, wallSide: "top" } as never);
    let foundGenericFaucet = false;
    root.traverse((node) => { if (node.userData.sinkFaucet || node.userData.sinkFaucetSpout || node.userData.sinkFaucetSprayHead) foundGenericFaucet = true; });
    expect(foundGenericFaucet).toBe(false);
  });

  it("renders PL-8410 as a source-measured 8-inch-center wall faucet above the backsplash, not on the countertop", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-8410-wall", type: "single", x: 24, y: 48, width: 30, depth: 18, faucet: true, wallSide: "top",
      pelicanFaucetProfileId: "pelican-pl-8410-fountain-wall-mounted-brushed-nickel",
      faucetOverallHeight: 10.5, faucetSpoutLength: 9.75, faucetSpoutHeight: 7.5, faucetFinish: "brushed-nickel", faucetForm: "wall-mounted-bridge",
      faucetCenterSpread: 8, faucetWallMountHeightAboveCountertopIn: 12, requiresProjectSpecificMountHeight: true,
    } as never;
    addSinkFixture(root, sink);
    root.updateMatrixWorld(true);
    const wallFaucet = root.children.find((node) => node.userData.wallMountedSinkFaucet);
    expect(wallFaucet?.userData).toMatchObject({
      pelicanFaucetProfileId: "pelican-pl-8410-fountain-wall-mounted-brushed-nickel",
      centerSpreadIn: 8,
      mountHeightAboveCountertopIn: 12,
      sourceMeasuredGeometry: true,
    });
    const bounds = new THREE.Box3().setFromObject(wallFaucet!);
    expect((bounds.min.y - sinkFixtureTransform(sink).countertopTop) * 12).toBeGreaterThan(11.5);
  });

  it("preserves the verified farmhouse sink exterior width after a left-wall plan rotation", () => {
    const root = new THREE.Group();
    addSinkFixture(root, {
      uid: "pelican-pl-fc2418sb-left",
      type: "farmhouse",
      x: 24,
      y: 48,
      width: 18,
      depth: 24,
      sourceWidth: 24,
      sourceDepth: 18,
      bowlWidth: 22.5,
      bowlDepth: 16.625,
      bowlHeight: 9,
      apronFront: true,
      pelicanProfileId: "pelican-pl-fc2418sb-fireclay-farmhouse",
      faucet: false,
      wallSide: "left",
    } as never);
    let apron: THREE.Object3D | null = null;
    root.traverse((node) => { if (node.userData.sinkApronFront) apron = node; });
    const apronBounds = new THREE.Box3().setFromObject(apron!);
    expect(apronBounds.max.z - apronBounds.min.z).toBeCloseTo(2, 12);
    expect(apron?.position.x).toBeGreaterThan(sinkFixtureTransform({ x: 24, y: 48, width: 18, depth: 24 } as never).x);
  });

  it("keeps a verified farmhouse basin seated at the countertop while its full published apron remains visible below", () => {
    const root = new THREE.Group();
    const sink = {
      uid: "pelican-pl-fc3318sb-top", type: "farmhouse", x: 18, y: 6, width: 32.625, depth: 18,
      sourceWidth: 32.625, sourceDepth: 18, bowlWidth: 31.375, bowlDepth: 16.625, bowlHeight: 9.25, exteriorHeight: 10,
      apronFront: true, pelicanProfileId: "pelican-pl-fc3318sb-fireclay-farmhouse", faucet: false, wallSide: "top",
    } as never;
    addSinkFixture(root, sink);
    let bowl: THREE.Object3D | null = null;
    let apron: THREE.Object3D | null = null;
    root.traverse((node) => { if (node.userData.sinkBowl) bowl = node; if (node.userData.sinkApronFront) apron = node; });
    const countertopTop = sinkFixtureTransform(sink).countertopTop;
    const bowlBounds = new THREE.Box3().setFromObject(bowl!);
    const apronBounds = new THREE.Box3().setFromObject(apron!);
    expect(bowlBounds.max.y).toBeCloseTo(countertopTop, 6);
    expect(apronBounds.max.y).toBeCloseTo(countertopTop + 0.006, 6);
    expect((apronBounds.max.y - apronBounds.min.y) * 12).toBeCloseTo(10, 6);
  });

  it("suppresses the generic FSB placeholder when an exact cabinet-owned farmhouse fixture renders separately", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -167, cabinetId: 167, masterCode: "FSB-36", description: "36 inch Farm Sink Base",
      placementType: "base", width: 36, height: 34.5, depth: 24, numberOfDoors: 2, numberOfDrawers: 0,
    } as never, null, {}, 144, 120, "#4f5549", "#f8f8f6", undefined, { x: 36, z: 0, rotation: 0, bottom: 0 }, undefined, undefined, {
      suppressFarmhouseSinkPlaceholder: true,
    });
    const genericPlaceholderParts: THREE.Object3D[] = [];
    const cabinetFaceParts: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.farmhouseApronFront || node.userData.farmhouseSinkBasin || node.userData.farmhouseSinkFaucetPost) genericPlaceholderParts.push(node);
      if (node.userData.farmhouseBaseDoor) cabinetFaceParts.push(node);
      // The old August 2026 front (false drawer front + doors beside the apron)
      // must never return: a real FSB has two doors BELOW the apron.
      expect(node.userData.farmhouseFalseFront).toBeUndefined();
      expect(node.userData.farmhouseSideDoor).toBeUndefined();
    });
    expect(genericPlaceholderParts).toHaveLength(0);
    expect(cabinetFaceParts).toHaveLength(2);

    addSinkFixture(root, {
      uid: "exact-fsb36", cabinetUid: "fsb36", type: "farmhouse", x: 37.6875, y: 6, width: 32.625, depth: 18,
      sourceWidth: 32.625, sourceDepth: 18, bowlWidth: 31.375, bowlDepth: 16.625, bowlHeight: 9.25, exteriorHeight: 10,
      apronFront: true, pelicanProfileId: "pelican-pl-fc3318sb-fireclay-farmhouse", faucet: false, wallSide: "top",
    } as never);
    let exactApron: THREE.Object3D | null = null;
    root.traverse((node) => { if (node.userData.sinkApronFront) exactApron = node; });
    expect(exactApron).not.toBeNull();
  });

	  it("keeps a visible divider for existing double-bowl sink choices", () => {
    const root = new THREE.Group();
    addSinkFixture(root, {
      uid: "sink-double", type: "double", x: 24, y: 48, width: 33, depth: 20, faucet: false, wallSide: "top",
    } as never);
    let divider: THREE.Object3D | null = null;
    root.traverse((node) => { if (node.userData.sinkBowlDivider) divider = node; });
	    expect(divider).not.toBeNull();
	  });

	  it("renders the PL-8369 as a 24-inch range-wall reach envelope without inventing a pivot angle", () => {
	    const root = new THREE.Group();
	    const room = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
	    const range = { uid: "range", cabinetId: 1, masterCode: "RANGE-30", description: "30 inch Range", placement: "appliance", x: 36, y: 0, width: 30, depth: 24, height: 36, rotation: 0, wallId: "top" } as PlacedCabinet;
	    const fixture = {
	      uid: "pf", rangeUid: "range", mountingWallId: "top", pelicanProductId: 790, pelicanCode: "PL-8369-BG",
	      pelicanProductName: "Fountain Series Kitchen Pot Filler - Brushed Gold", pelicanProfileId: "pelican-pl-8369-bg-fountain-wall-pot-filler",
	      finish: "brushed-gold", mountHeightAboveCooktopIn: 24, spoutReachIn: 24, overallSpanIn: 26.1875, armDatumIn: 13,
	      fixtureHeightIn: 3.15625, outletDatumIn: 1.875, maximumFlowGpmAt60Psi: 2.2,
	      installation: "wall-mounted-in-wall-cold-water", requiresProjectSpecificMountHeight: true,
	    } as const;
	    const transform = potFillerWallMountTransform(fixture, range, room);
	    expect(transform.reach * 12).toBeCloseTo(24, 6);
	    expect(transform.y * 12).toBeCloseTo(60, 6);
	    addPotFillerFixture(root, fixture, range, room);
	    const potFiller = root.children.find((node) => node.userData.potFillerFixture);
	    expect(potFiller?.userData).toMatchObject({
	      pelicanCode: "PL-8369-BG", spoutReachIn: 24, finish: "brushed-gold",
	      articulationState: "deployed-reach-envelope-not-an-invented-pivot-angle",
	    });
	    const armLengths: number[] = [];
	    root.traverse((node) => { if (node.userData.potFillerArm) armLengths.push(node.userData.lengthIn); });
	    expect(armLengths).toHaveLength(2);
	    expect(armLengths[0]).toBeCloseTo(13, 6);
	    expect(armLengths[1]).toBeCloseTo(11, 6);
	  });

	  it("renders SB36 with two false drawer fronts, two standard doors, and no false-drawer pull", () => {
    const root = new THREE.Group();
    addCabinetWithBarPulls(root, {
      distributorSkuId: -89, cabinetId: 89, masterCode: "SB-36", description: "36 inch Sink Base",
      placementType: "base", width: 36, height: 34.5, depth: 24, numberOfDoors: 2, numberOfDrawers: 0,
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", { doorStyle: "Shaker", doorPanelType: "shaker" });
    const pulls: THREE.Object3D[] = [];
    const falseDrawers: THREE.Object3D[] = [];
    const doors: THREE.Object3D[] = [];
    root.traverse((node) => { if (node.userData.cabinetPull) pulls.push(node); });
    root.traverse((node) => {
      if (node.userData.falseDrawerFront) falseDrawers.push(node);
      if (node.userData.cabinetFront && !node.userData.cabinetDrawerFront) doors.push(node);
    });
    expect(falseDrawers).toHaveLength(2);
    expect(doors).toHaveLength(2);
    expect(pulls.filter((node) => node.userData.cabinetPull === "drawer")).toHaveLength(0);
    expect(pulls.filter((node) => node.userData.cabinetPull === "door")).toHaveLength(2);
    expect(pulls.every((node) => node.userData.cabinetPull !== "door" || node.userData.verticalPull)).toBe(true);
  });

  it("faces a right-wall sink faucet toward the right-wall backsplash", () => {
    const sink = {
      uid: "right-sink", type: "single", x: 120, y: 42, width: 18, depth: 25,
      sourceWidth: 25, sourceDepth: 18, wallSide: "right", faucet: true,
    } as never;
    const transform = sinkFixtureTransform(sink);
    const faucet = sinkFaucetTransform(sink);
    expect(faucet.x).toBeGreaterThan(transform.x);
    expect(faucet.z).toBe(transform.z);
  });

  it("uses a 25½-inch countertop depth on every standard supported base run", () => {
    expect(threeDCountertopDepthIn(24)).toBe(25.5);
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -24, cabinetId: 24, masterCode: "DW-24", description: "Dishwasher", placementType: "appliance",
      width: 24, height: 30, depth: 24, numberOfDoors: 0, numberOfDrawers: 0,
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 48, z: 12, rotation: 0, bottom: 0 });
    let countertop: THREE.Mesh | null = null;
    root.traverse((node) => { if (node instanceof THREE.Mesh && node.userData.dishwasherCountertopSupport) countertop = node; });
    expect(countertop).not.toBeNull();
    expect(((countertop!.geometry as THREE.BoxGeometry).parameters.depth) * 12).toBeCloseTo(25.5, 8);
    root.updateMatrixWorld(true);
    const counterBounds = new THREE.Box3().setFromObject(countertop!);
    // A 24-inch appliance/base box gets exactly the shared 1½-inch front edge,
    // matching the 25½-inch plan countertop rather than a renderer-only depth.
    expect(counterBounds.max.z * 12).toBeCloseTo(25.5, 8);
  });

  it("uses a 22½-inch countertop depth on a 21-inch bathroom vanity base", () => {
    expect(threeDCountertopDepthIn(21)).toBe(22.5);
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -421, cabinetId: 421, masterCode: "VSD42", description: "42 inch Vanity Combo", category: "Vanity", placementType: "base",
      width: 42, height: 34.5, depth: 21, numberOfDoors: 2, numberOfDrawers: 3,
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 48, z: 10.5, rotation: 0, bottom: 0 });
    let countertop: THREE.Mesh | null = null;
    root.traverse((node) => {
      if (node instanceof THREE.Mesh && node.userData.countertopDepthIn === 22.5) countertop = node;
    });
    expect(countertop).not.toBeNull();
    expect(((countertop!.geometry as THREE.BoxGeometry).parameters.depth) * 12).toBeCloseTo(22.5, 8);
  });

  it("extends an installed shallow filler countertop to the full 25½-inch base-run depth", () => {
    const filler = {
      fillerPieceGroupId: "filler-group",
      fillerTotalWidth: 2.5,
      fillerPlacementMode: "right" as const,
    };
    expect(threeDSceneCountertopDepthIn(filler, 0.75)).toBe(25.5);

    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: 88, cabinetId: 88, masterCode: "BF3", description: "Base Filler", placementType: "base",
      width: 2.5, height: 34.5, depth: 0.75, numberOfDoors: 0, numberOfDrawers: 0,
      ...filler,
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6");
    let countertop: THREE.Mesh | null = null;
    root.traverse((node) => { if (node instanceof THREE.Mesh && node.userData.installedFillerCountertop) countertop = node; });
    expect(countertop).not.toBeNull();
    expect(((countertop!.geometry as THREE.BoxGeometry).parameters.depth) * 12).toBeCloseTo(25.5, 8);
  });

  it("extends only a pulled BBC countertop three inches rearward until its back edge reaches the wall", () => {
    const room = { width: 144, depth: 120 };
    const cabinet = {
      uid: "pulled-bbc",
      cabinetId: 36,
      distributorSkuId: 36,
      masterCode: "BBC-36",
      description: '36" Blind Corner Base Cabinet',
      placement: "base",
      x: 0,
      y: 3,
      width: 36,
      height: 34.5,
      depth: 24,
      rotation: 0,
      numberOfDoors: 1,
      numberOfDrawers: 1,
      swing: "right",
      openingWidth: 11,
      pullMin: 3,
      pullMax: 6,
    } as PlacedCabinet;
    const sku = existingCabinetSku(cabinet, room);
    expect(sku.countertopRearExtensionIn).toBe(3);
    const transform = existingCabinetTransform(cabinet, room);
    const root = new THREE.Group();
    addCabinet(root, sku, null, {}, room.width, room.depth, "#8a9ba8", "#f8f8f6", undefined, transform);
    let countertop: THREE.Mesh | null = null;
    root.traverse((node) => {
      if (node instanceof THREE.Mesh && node.userData.bridgesBlindCornerToWall) countertop = node;
    });
    expect(countertop).not.toBeNull();
    const depthIn = ((countertop!.geometry as THREE.BoxGeometry).parameters.depth) * 12;
    const backEdgeIn = countertop!.position.z * 12 - depthIn / 2;
    expect(depthIn).toBeCloseTo(28.5, 8);
    expect(backEdgeIn).toBeCloseTo(0, 8);
    expect(transform.z).toBeCloseTo(15, 8);
  });

  it("mounts a saved range hood directly to the wall without a cabinet-finish backing box", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -30, cabinetId: 30, masterCode: "HOOD-30", description: "30 inch Range Hood", placementType: "appliance",
      width: 30, height: 18, depth: 18, numberOfDoors: 0, numberOfDrawers: 0, mountBottom: 66,
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 36, z: 9, rotation: 0, bottom: 66 });
    const hoodRoot = root.children[0]!;
    const canopies: THREE.Object3D[] = [];
    const cabinetBackings: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.rangeHoodCanopy) canopies.push(node);
      if (node.userData.selectedStyleSideSkin) cabinetBackings.push(node);
    });
    expect(hoodRoot.userData.wallMountedAppliance).toBe(true);
    expect(hoodRoot.userData.noCabinetBacking).toBe(true);
    expect(canopies).toHaveLength(1);
    expect(cabinetBackings).toHaveLength(0);
    root.updateMatrixWorld(true);
    const hoodBounds = new THREE.Box3().setFromObject(hoodRoot);
    expect(hoodBounds.min.z).toBeCloseTo(0, 8);
    expect(hoodBounds.max.z).toBeLessThanOrEqual(18 / 12);
    expect(hoodBounds.max.z).toBeGreaterThan(17 / 12);
    expect(canopies[0]?.parent?.userData).toMatchObject({
      fullDepthWallMountedAppliance: true,
      rearPlaneUsesSavedWallFootprint: true,
      physicalCanopyRearFlush: true,
    });
  });

  it("renders RHF30 as the cataloged shallow sloped wood hood front, not a HOOD-* appliance or rectangular wall box", () => {
    const root = new THREE.Group();
    const rhf = {
      uid: "rhf30",
      cabinetId: 930030,
      masterCode: "RHF30",
      description: "Range Hood Front",
      placement: "wall" as const,
      x: 42,
      y: 0,
      width: 30,
      depth: 9,
      height: 23.5,
      mountBottom: 66,
      rotation: 0,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    };
    expect(resolvedThreeDSpecialtyProfile(rhf)).toMatchObject({ kind: "range-hood-front" });
    const geometry = rangeHoodFrontGeometry(30, 23.5, 9);
    expect(geometry.fasciaHeight * 12).toBeGreaterThan(3);
    expect(geometry.doorTiltRadians).toBeLessThan(0);
    addCabinet(root, existingCabinetSku(rhf), null, {}, 144, 120, "#48515d", "#f8f8f6", undefined, existingCabinetTransform(rhf, { width: 144, depth: 120, ceilingHeight: 96 }));

    const slopedDoors: THREE.Group[] = [];
    const fascia: THREE.Object3D[] = [];
    const canopies: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.rangeHoodFrontSlopedDoor) slopedDoors.push(node as THREE.Group);
      if (node.userData.rangeHoodFrontLowerFascia) fascia.push(node);
      if (node.userData.rangeHoodCanopy) canopies.push(node);
    });
    expect(slopedDoors).toHaveLength(2);
    expect(slopedDoors.map((door) => door.userData.rangeHoodFrontSlopedDoor).sort()).toEqual(["left", "right"]);
    for (const door of slopedDoors) expect(door.rotation.x).toBeCloseTo(geometry.doorTiltRadians, 8);
    expect(fascia).toHaveLength(1);
    expect(canopies).toHaveLength(0);
    expect(root.children[0]?.userData.wallMountedAppliance).not.toBe(true);
  });

  it("keeps the saved range-hood rear plane on top, bottom, left, and right walls", () => {
    const room = { width: 144, depth: 120, ceilingHeight: 96 };
    const common = {
      cabinetId: 30,
      masterCode: "HOOD-30",
      description: "30 inch Range Hood",
      placement: "appliance" as const,
      width: 30,
      depth: 18,
      height: 18,
      mountBottom: 66,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    };
    const cases = [
      { hood: { ...common, uid: "top", x: 36, y: 0, rotation: 0 }, wall: "top" as const },
      { hood: { ...common, uid: "bottom", x: 36, y: 102, rotation: 0 }, wall: "bottom" as const },
      { hood: { ...common, uid: "left", x: 0, y: 36, rotation: 90 }, wall: "left" as const },
      { hood: { ...common, uid: "right", x: 126, y: 36, rotation: 90 }, wall: "right" as const },
    ];

    for (const { hood, wall } of cases) {
      const transform = existingCabinetTransform(hood, room);
      if (wall === "top") expect(transform.z - 9).toBeCloseTo(0, 8);
      if (wall === "bottom") expect(transform.z + 9).toBeCloseTo(room.depth, 8);
      if (wall === "left") expect(transform.x - 9).toBeCloseTo(0, 8);
      if (wall === "right") expect(transform.x + 9).toBeCloseTo(room.width, 8);
      expect(transform.bottom).toBe(66);
    }
  });

  it("keeps an automatic hood centered over its matching range on every wall while preserving wall depth", () => {
    const room = { width: 144, depth: 120, ceilingHeight: 96 };
    const fixtures = [
      { range: { uid: "range-top", x: 42, y: 0, rotation: 0 }, hood: { uid: "hood-top", x: 18, y: 0, rotation: 0 }, axis: "x" as const },
      { range: { uid: "range-bottom", x: 42, y: 95, rotation: 0 }, hood: { uid: "hood-bottom", x: 18, y: 102, rotation: 0 }, axis: "x" as const },
      { range: { uid: "range-left", x: 0, y: 42, rotation: 90 }, hood: { uid: "hood-left", x: 0, y: 18, rotation: 90 }, axis: "z" as const },
      { range: { uid: "range-right", x: 119, y: 42, rotation: 90 }, hood: { uid: "hood-right", x: 126, y: 18, rotation: 90 }, axis: "z" as const },
    ];

    for (const fixture of fixtures) {
      const range = {
        ...fixture.range,
        cabinetId: 40,
        masterCode: "RANGE-30",
        description: "30 inch Range",
        placement: "appliance" as const,
        width: 30,
        depth: 25,
        height: 36,
      };
      const hood = {
        ...fixture.hood,
        cabinetId: 41,
        masterCode: "HOOD-30",
        description: "30 inch Range Hood",
        placement: "appliance" as const,
        width: 30,
        depth: 18,
        height: 18,
        mountBottom: 66,
      };
      const centered = savedRangeHoodTransform(hood, [range, hood], room);
      const rangeTransform = existingCabinetTransform(range, room);
      expect(centered[fixture.axis]).toBeCloseTo(rangeTransform[fixture.axis], 8);
      expect(centered.bottom).toBe(66);
    }
  });

  it("extends the countertop over a saved dishwasher but not over tall or wall scene items", () => {
    expect(shouldRenderCountertopOverSceneItem("appliance", "DW-24")).toBe(true);
    expect(shouldRenderCountertopOverSceneItem("appliance", "WINE-24")).toBe(true);
    expect(shouldRenderCountertopOverSceneItem("base", "B-33")).toBe(true);
    expect(shouldRenderCountertopOverSceneItem("base", "RANGE-30")).toBe(false);
    expect(shouldRenderCountertopOverSceneItem("base", "STOVE-30", "30 inch gas stove")).toBe(false);
    expect(shouldRenderCountertopOverSceneItem("base", "FILL-3", "3 inch Filler")).toBe(false);
    expect(shouldRenderCountertopOverSceneItem({ placement: "base", masterCode: "FILL-3", description: "3 inch Filler", subCategory: "Filler", fillerPieceGroupId: "fill-group", fillerTotalWidth: 2.5, fillerPlacementMode: "split" })).toBe(true);
    expect(shouldRenderCountertopOverSceneItem({ placement: "base", masterCode: "BF3", description: "3 inch Base Filler", subCategory: "Filler", fillerPieceGroupId: "fill-group", fillerTotalWidth: 3, fillerPlacementMode: "right" })).toBe(true);
    expect(shouldRenderCountertopOverSceneItem("base", "REP2496", "Refrigerator End Panel")).toBe(false);
    expect(shouldRenderCountertopOverSceneItem("base", "FRIDGE-36", "36 inch Refrigerator")).toBe(false);
    expect(shouldRenderCountertopOverSceneItem("appliance", "RANGE-30")).toBe(false);
    expect(shouldRenderCountertopOverSceneItem("wall", "W-30-42")).toBe(false);
    expect(shouldRenderCountertopOverSceneItem("tall", "B-33")).toBe(false);
  });

  it("normalizes a legacy base-layer stove into a selectable appliance with no countertop support", () => {
    const legacyStove = existingCabinetSku({
      uid: "legacy-stove",
      cabinetId: 42,
      masterCode: "STOVE-30",
      description: "30 inch gas stove",
      placement: "base",
      x: 24,
      y: 0,
      width: 30,
      depth: 25,
      height: 36,
      rotation: 0,
    } as never);
    expect(legacyStove.placementType).toBe("appliance");
    expect(shouldRenderCountertopOverSceneItem({ placement: "base", masterCode: legacyStove.masterCode, description: legacyStove.description })).toBe(false);

    const root = new THREE.Group();
    addCabinet(root, legacyStove, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 36, z: 12, rotation: 0, bottom: 0 });
    let selectionHitbox: THREE.Mesh | undefined;
    root.traverse((node) => {
      if (node instanceof THREE.Mesh && node.userData.applianceRangeSelectionHitbox) selectionHitbox = node;
    });
    expect(selectionHitbox).toBeDefined();
    expect(selectionHitbox && threeDCabinetHitFromIntersections([{ object: selectionHitbox }])).toMatchObject({ uid: "legacy-stove", masterCode: "STOVE-30" });
  });

  it("centers the range oven face and reserves a measured lower storage drawer", () => {
    const layout = rangeOvenFrontLayout(3);
    expect(layout.openingHeight).toBeCloseTo(1.62, 12);
    expect(layout.openingCenterY).toBeGreaterThan(0);
    expect(layout.drawerHeight).toBeCloseTo(0.42, 12);
    expect(layout.drawerCenterY).toBeCloseTo(-1.25, 12);
  });

  it("renders a physical cooktop and four burners at the 36-inch finished countertop line", () => {
    const cooktop = rangeCooktopLayout(30 / 12, 25 / 12, 36 / 12);
    expect(cooktop.cooktopWidth).toBeCloseTo(2.38, 12);
    expect(cooktop.cooktopDepth).toBeCloseTo((25 / 12) - 0.12, 12);
    // rangeCooktopLayout returns local coordinates centered on the 36-inch
    // model body: its finished cooking surface is 1.5ft above the center.
    expect(cooktop.cookingSurfaceY).toBeCloseTo(1.5, 12);
    expect(cooktop.topY + cooktop.cooktopThickness / 2).toBeCloseTo(1.5, 12);
    expect(cooktop.burnerCenters).toHaveLength(4);
    expect(cooktop.burnerCenters[0]?.x).toBeCloseTo(-0.5712, 12);
    expect(cooktop.burnerCenters[0]?.z).toBeCloseTo(-0.45156666666666667, 12);
  });

  it("uses a 47-inch backguard top above the shared 36-inch freestanding range cooktop", () => {
    const profile = freestandingRangeHeightProfile(0, 36 / 12);
    expect(profile.cookingSurfaceIn).toBe(36);
    expect(profile.backguardTopIn).toBe(47);
    expect(profile.backguardHeight * 12).toBeCloseTo(11, 8);
  });

  it("uses a high-resolution PNG export size suitable for design sharing", () => {
    expect(THREE_D_EXPORT_SIZE).toEqual({ width: 2000, height: 1400 });
  });

  it("keeps room walls non-occluding so a mobile orbit cannot hide the cabinet run", () => {
    expect(THREE_D_WALL_OPACITY).toBe(0.72);
    expect(THREE_D_WALL_DEPTH_WRITE).toBe(false);
  });

  it("opens the 3D Designer with its drawn room walls visible", () => {
    expect(THREE_D_ROOM_CONTEXT_DEFAULT).toBe(true);
  });

  it("writes the active catalog cabinet and countertop names when quote previews stay at their defaults", () => {
    expect(quoteMaterialDetails({
      cabinetPreview: "Catalog finish",
      countertopPreview: "Quartz",
      catalogFinishName: "Aero Sage (Preston)",
      catalogCountertopName: "Pelican Calacatta Laza Quartz",
    })).toEqual({ cabinet: "Aero Sage (Preston)", countertop: "Pelican Calacatta Laza Quartz" });
  });

  it("recognizes Shaker, raised-panel, and flat-panel cabinet door geometry", () => {
    expect(doorProfileKind("Shaker", null)).toBe("shaker");
    expect(doorProfileKind("Raised Panel", null)).toBe("raised");
    expect(doorProfileKind("Slab", "Flat Panel")).toBe("flat");
  });

  it("uses a physical three-inch rail and stile for twelve- and twenty-one-inch 3D Shaker faces", () => {
    expect(threeDShakerRailThickness(12 / 12, 24 / 12)).toBe(3 / 12);
    expect(threeDShakerRailThickness(21 / 12, 30 / 12)).toBe(3 / 12);
  });

  it("keeps diagonal and end-return Shaker frames in the same angled pose as their specialty door faces", () => {
    expect(threeDShakerFramePose(-0.4, 0, 0.066, Math.PI / 4)).toEqual({ x: -0.4, y: 0, z: 0.066, rotationY: Math.PI / 4 });
    expect(threeDShakerFramePose(0.4, 0, 0.066, -Math.PI / 4)).toEqual({ x: 0.4, y: 0, z: 0.066, rotationY: -Math.PI / 4 });
  });

  it("physically builds selected-style Shaker frame groups on standard, tall, diagonal, and BEC24 source faces", () => {
    const profile = { doorStyle: "Shaker", doorPanelType: "Recessed Panel" };
    const fixtures = [
      { masterCode: "B-24", description: "Base Cabinet", placementType: "base", width: 24, height: 34.5, depth: 24, numberOfDoors: 2, numberOfDrawers: 1, expectedRotations: [0, 0, 0] },
      { masterCode: "T-24", description: "Tall Cabinet", placementType: "tall", width: 24, height: 84, depth: 24, numberOfDoors: 2, numberOfDrawers: 0, expectedRotations: [0, 0] },
      { masterCode: "WDC2430", description: "Diagonal Wall Corner", placementType: "wall", width: 24, height: 30, depth: 24, numberOfDoors: 2, numberOfDrawers: 0, cornerType: "diagonal", expectedRotations: [Math.PI / 4, Math.PI / 4] },
      { masterCode: "BEC-24", description: "Base End Cabinet", placementType: "base", width: 30, height: 34.5, depth: 24, numberOfDoors: 1, numberOfDrawers: 0, customProfile: "base_end_return", expectedRotations: [0] },
    ];

    for (const fixture of fixtures) {
      const root = new THREE.Group();
      addCabinet(root, fixture as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", profile);
      const frames: THREE.Object3D[] = [];
      root.traverse((node) => {
        if (node.userData.physicalRails) frames.push(node);
      });
      expect(frames).toHaveLength(fixture.expectedRotations.length);
      expect(frames.map((frame) => frame.rotation.y)).toEqual(fixture.expectedRotations);
      expect(frames.every((frame) => frame.children.filter((child) => child.userData.physicalRail).length === 4)).toBe(true);
    }
  });

  it("builds a catalog-raised five-piece face with a profiled bevel and never adds an unselected default pull", () => {
    const raisedProfile = {
      doorStyle: "Aspen Charcoal Raised Panel",
      doorPanelType: "Raised Panel",
      panelConstruction: "raised" as const,
      bevelWidth: 0.5,
      bevelDepth: 0.18,
      insideEdgeProfile: "beveled ogee",
      drawerFrontType: "five-piece-raised" as const,
      grainDirection: "vertical-stiles-horizontal-rails" as const,
      finishSheen: "satin" as const,
    };
    const b18 = { masterCode: "B18", description: "18 inch base", placementType: "base", width: 18, height: 34.5, depth: 24, numberOfDoors: 1, numberOfDrawers: 1 } as never;
    const withoutHardware = new THREE.Group();
    addCabinet(withoutHardware, b18, null, {}, 144, 120, "#241a18", "#f8f8f6", raisedProfile, undefined, undefined, undefined, { hardwareStyleId: "none" });
    const raisedPanels: THREE.Object3D[] = [];
    const bevels: THREE.Object3D[] = [];
    const hardware: THREE.Object3D[] = [];
    withoutHardware.traverse((node) => {
      if (node.userData.raisedCenterPanel) raisedPanels.push(node);
      if (node.userData.raisedPanelBevel) bevels.push(node);
      if (node.userData.cabinetHardware) hardware.push(node);
    });
    expect(raisedPanels.length).toBeGreaterThanOrEqual(2);
    expect(bevels.length).toBeGreaterThanOrEqual(2);
    expect(bevels.every((node) => node.userData.insideEdgeProfile === "beveled ogee")).toBe(true);
    expect(hardware).toHaveLength(0);

    const withKnob = new THREE.Group();
    addCabinet(withKnob, b18, null, {}, 144, 120, "#241a18", "#f8f8f6", raisedProfile, undefined, undefined, undefined, { hardwareStyleId: "knob" });
    const knobs: THREE.Object3D[] = [];
    withKnob.traverse((node) => { if (node.userData.cabinetPull === "knob") knobs.push(node); });
	    expect(knobs.length).toBeGreaterThanOrEqual(2);
	  });

	  it("does not let an LSB36 specialty door bypass the selected None hardware style", () => {
	    const lsb36 = {
	      masterCode: "LSB36",
	      description: "36 inch Lazy Susan Base Cabinet",
	      placementType: "base",
	      width: 36,
	      height: 34.5,
	      depth: 24,
	      numberOfDoors: 2,
	    } as never;
    const withoutHardware = new THREE.Group();
    addCabinet(withoutHardware, lsb36, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", { doorStyle: "Shaker", doorPanelType: null }, undefined, undefined, undefined, { hardwareStyleId: "none" });
    const strayHandles: THREE.Object3D[] = [];
    withoutHardware.traverse((node) => {
      if (node.userData.cabinetHardware) strayHandles.push(node);
    });
    expect(strayHandles).toHaveLength(0);

    const withHardware = new THREE.Group();
    addCabinet(withHardware, lsb36, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", { doorStyle: "Shaker", doorPanelType: null }, undefined, undefined, undefined, { hardwareStyleId: "bar-pull" });
    const handles: THREE.Object3D[] = [];
    withHardware.traverse((node) => {
      if (node.userData.cabinetHardware) handles.push(node);
    });
    expect(handles).toHaveLength(1);
  });
	  it("uses satin cabinet material without glass reflection behavior", () => {
    const satin = threeDDoorFinishSurfaceProfile("satin", true);
    expect(satin.roughness).toBeCloseTo(0.4, 8);
    expect(satin.metalness).toBe(0);
    expect(satin.clearcoat).toBeCloseTo(0.1, 8);
  });

  it("builds a legacy WDC2430 as one flush diagonal side-skin wedge with two angled front doors, never a generic wall panel", () => {

    const legacyWdc2430 = existingCabinetSku({
      uid: "legacy-wdc2430",
      cabinetId: 9390172,
      masterCode: "WDC2430",
      description: '24" x 30" Wall Diagonal Corner Cabinet',
      category: "Wall",
      placement: "wall",
      x: 0,
      y: 0,
      width: 24,
      height: 30,
      depth: 12,
      rotation: 0,
      cornerType: null,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    } as never);
    const root = new THREE.Group();
    addCabinet(root, legacyWdc2430, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", { doorStyle: "Shaker", doorPanelType: "Recessed Panel" });

    const wedges: THREE.Object3D[] = [];
    const doors: THREE.Object3D[] = [];
    const genericFrontPanels: THREE.Object3D[] = [];
    const unexpectedMeshes: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.diagonalCornerWedge) wedges.push(node);
      if (node.userData.diagonalDoor) doors.push(node);
      if (node.userData.cabinetFront && !node.userData.diagonalDoor) genericFrontPanels.push(node);
      if (
	        node instanceof THREE.Mesh &&
	        !node.userData.diagonalCornerWedge &&
	        !node.userData.diagonalDoor &&
	        !node.userData.diagonalCornerFinishedReturn &&
	        !node.userData.physicalRail
      ) {
        unexpectedMeshes.push(node);
      }
    });

    expect(legacyWdc2430).toMatchObject({ width: 24, depth: 24, cornerType: "diagonal" });
    expect(wedges).toHaveLength(1);
    expect(wedges[0]!.userData.selectedStyleSideSkin).toBe(true);
    root.updateMatrixWorld(true);
    const sideSkinBounds = new THREE.Box3().setFromObject(wedges[0]!);
    expect(sideSkinBounds.max.x - sideSkinBounds.min.x).toBeCloseTo(2, 8);
    expect(sideSkinBounds.max.z - sideSkinBounds.min.z).toBeCloseTo(2, 8);
    expect(sideSkinBounds.max.y - sideSkinBounds.min.y).toBeCloseTo(30 / 12, 8);
    expect(doors).toHaveLength(2);
    expect(doors.map((door) => door.rotation.y)).toEqual([Math.PI / 4, Math.PI / 4]);
    expect(genericFrontPanels).toHaveLength(0);
    expect(unexpectedMeshes).toHaveLength(0);
  });

  it("uses the catalog's single-door count for a one-door diagonal wall cabinet", () => {
    const singleDoorDiagonal = existingCabinetSku({
      uid: "single-door-wdc",
      masterCode: "WDC2430",
      description: '24" x 30" Single Door Wall Diagonal Corner Cabinet',
      category: "Wall",
      placement: "wall",
      x: 0,
      y: 0,
      width: 24,
      height: 30,
      depth: 12,
      rotation: 0,
      cornerType: "diagonal",
      numberOfDoors: 1,
      numberOfDrawers: 0,
      swing: "left",
    } as never);
    const root = new THREE.Group();
    addCabinet(root, singleDoorDiagonal, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", { doorStyle: "Shaker", doorPanelType: "Recessed Panel" });
    const doors: THREE.Object3D[] = [];
    const pulls: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.diagonalDoor) doors.push(node);
      if (node.userData.diagonalDoorPull) pulls.push(node);
    });
    expect(doors).toHaveLength(1);
    expect(doors[0]!.position.x).toBeGreaterThan(0.5);
    expect(doors[0]!.position.z).toBeGreaterThan(0.5);
    expect(doors[0]!.position.x).toBeCloseTo(doors[0]!.position.z, 8);
    expect(pulls).toHaveLength(1);
    expect(pulls[0]!.rotation.y).toBeCloseTo(doors[0]!.rotation.y, 8);
    expect(pulls[0]!.userData.hingeSide).toBe("left");
    expect(pulls[0]!.userData.handleSide).toBe("right");
    expect(pulls[0]!.userData).toMatchObject({ frameWidthIn: 3, frameCenterInsetIn: 1.5 });
    expect(pulls[0]!.position.x).toBeGreaterThan(doors[0]!.position.x);
    expect(pulls[0]!.position.z).toBeLessThan(doors[0]!.position.z);
    const diagonalDoorWidth = ((doors[0] as THREE.Mesh).geometry as THREE.BoxGeometry).parameters.width;
    const tangent = new THREE.Vector2(Math.cos(doors[0]!.rotation.y), -Math.sin(doors[0]!.rotation.y));
    const delta = new THREE.Vector2(
      pulls[0]!.position.x - doors[0]!.position.x,
      pulls[0]!.position.z - doors[0]!.position.z,
    );
    expect((diagonalDoorWidth / 2 - Math.abs(delta.dot(tangent))) * 12).toBeCloseTo(1.5, 8);
  });

  it("builds AW1230 as a 12-by-12 angled wall wedge with one side-hinged diagonal door and two adjustable shelves configured", () => {
    const aw1230 = existingCabinetSku({
      uid: "aw1230",
      cabinetId: 9360146,
      masterCode: "AW1230",
      description: '12" Single Door Wall Cabinet with 2 Adjustable Shelves',
      category: "Wall",
      placement: "wall",
      x: 0,
      y: 0,
      width: 12,
      height: 30,
      depth: 12,
      rotation: 0,
      cornerType: null,
      customProfile: "wall_angle",
      numberOfDoors: 1,
      numberOfDrawers: 0,
      adjustableShelfCount: 2,
    } as never);
    const root = new THREE.Group();
    addCabinet(root, aw1230, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", { doorStyle: "Shaker", doorPanelType: "Recessed Panel" });
    const wedges: THREE.Object3D[] = [];
    const doors: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.angledWallWedge) wedges.push(node);
      if (node.userData.angledWallDoor) doors.push(node);
    });
    expect(aw1230).toMatchObject({ width: 12, depth: 12, cornerType: null });
    expect(wedges).toHaveLength(1);
    expect(doors).toHaveLength(1);
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(wedges[0]!);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(1, 8);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(1, 8);
    expect(bounds.max.y - bounds.min.y).toBeCloseTo(30 / 12, 8);
    const pose = triangleCornerFrontPose(1, 1);
    const angledDoor = doors[0] as THREE.Mesh;
    expect(angledDoor.rotation.y).toBeCloseTo(pose.rotation, 8);
    expect(angledDoor.position.x).toBeCloseTo(pose.x, 8);
    expect(angledDoor.position.z).toBeCloseTo(pose.z, 8);
    expect(angledDoor.userData.flushPhysicalFace).toBe(true);
    // The door's 0.052ft depth has a 0.026ft half-depth. Its inner surface
    // remains just outside the triangular hypotenuse instead of penetrating it.
    expect(pose.x * pose.normalX + pose.z * pose.normalZ).toBeGreaterThan(0.026);
  });

  it("keeps an AW end cabinet parallel to its owning wall even when an older saved row says cornerType diagonal", () => {
    const transform = existingCabinetTransform({
      uid: "legacy-aw1230-position",
      cabinetId: 9360146,
      masterCode: "AW1230",
      description: '12" × 30" × 12" Angled Wall End Cabinet',
      placement: "wall",
      x: 60,
      y: 0,
      width: 12,
      depth: 12,
      height: 30,
      rotation: 0,
      wallId: "top",
      wallOffset: 60,
      cornerType: "diagonal",
    } as never, { width: 144, depth: 120, ceilingHeight: 96 });
    expect(transform).toMatchObject({ x: 66, z: 6, rotation: 0 });
  });

  // Retained only as historical documentation of the pre-source import model.
  // Capital page 54 proves BEC24 is not the two-face 24-inch return in this test.
  it.skip("retired: normalizes saved BA-24 and BEC-24 records into the supplied rear-apex two-24-inch-side diagram form without refreshed profile metadata", () => {
    for (const masterCode of ["BA-24", "BEC-24"]) {
      const sku = {
        distributorSkuId: -24,
        cabinetId: 24,
        masterCode,
        description: '24" Base End Cabinet',
        placementType: "base",
        width: 24,
        height: 34.5,
        depth: 24,
        numberOfDoors: 2,
        numberOfDrawers: 0,
        cornerType: null,
      } as never;
      expect(resolvedThreeDSpecialtyProfile(sku)).toEqual({ kind: "end-return", pattern: null });
      const root = new THREE.Group();
      addCabinet(root, sku, null, {}, 144, 120, "#8a9ba8", "#f8f8f6");
      const returnFaces: THREE.Object3D[] = [];
      root.traverse((node) => { if (node.userData.nonCornerEndReturnDoor) returnFaces.push(node); });
      expect(returnFaces).toHaveLength(2);
      expect(returnFaces.map((face) => face.userData.nonCornerEndReturnDoor).sort()).toEqual(["left", "right"]);
      expect(returnFaces.map((face) => ((face as THREE.Mesh).geometry as THREE.BoxGeometry).parameters.width)).toEqual([
        expect.closeTo(8.45 / 12, 6), expect.closeTo(8.45 / 12, 6),
      ]);
      expect(returnFaces.map((face) => face.userData.doorWidthIn)).toEqual([
        expect.closeTo(8.45, 6), expect.closeTo(8.45, 6),
      ]);
      expect(returnFaces.map((face) => face.rotation.y)).toEqual([-Math.PI / 4, Math.PI / 4]);
      expect(returnFaces.every((face) => face.userData.attachedEndFront)).toBe(true);
      expect(returnFaces.every((face) => face.userData.referenceFaceSideIn === 24)).toBe(true);
      for (const apex of returnFaces.map((face) => face.userData.sharedExteriorApex as { x: number; z: number })) {
        expect(apex.x).toBeCloseTo(0, 8);
        expect(apex.z).toBeCloseTo(Math.SQRT2, 8);
      }
      const measuredFrontDoor = returnFaces.find((face) => face.userData.nonCornerEndReturnDoor === "left")!;
      const measuredRightDoor = returnFaces.find((face) => face.userData.nonCornerEndReturnDoor === "right")!;
      // Each short door is attached beside the shared exterior apex. The
      // 24-inch values label rear construction sides, not 24-inch doors.
      const shortDoorCenterOffset = 8.45 / 12 * Math.SQRT1_2 / 2;
      const flushFaceOffset = 0.029 * Math.SQRT1_2;
      expect(measuredFrontDoor.position.x).toBeCloseTo(-shortDoorCenterOffset - flushFaceOffset, 6);
      expect(measuredFrontDoor.position.z).toBeCloseTo(Math.SQRT2 - shortDoorCenterOffset + flushFaceOffset, 6);
      expect(measuredRightDoor.position.x).toBeCloseTo(shortDoorCenterOffset + flushFaceOffset, 6);
      expect(measuredRightDoor.position.z).toBeCloseTo(Math.SQRT2 - shortDoorCenterOffset + flushFaceOffset, 6);
      expect(measuredFrontDoor.rotation.y).toBeCloseTo(-Math.PI / 4, 6);
      expect(measuredRightDoor.rotation.y).toBeCloseTo(Math.PI / 4, 6);
      expect(measuredFrontDoor.userData.flushPhysicalFace).toBe(true);
      expect(measuredRightDoor.userData.flushPhysicalFace).toBe(true);
      const toeKicks: THREE.Object3D[] = [];
      const counters: THREE.Object3D[] = [];
      root.traverse((node) => {
        if (node.userData.baseToeKick) toeKicks.push(node);
        if (node.userData.endReturnCountertop) counters.push(node);
      });
      expect(toeKicks).toHaveLength(2);
      expect(toeKicks.map((kick) => kick.userData.attachedEndFrontToeKick).sort()).toEqual(["left", "right"]);
      expect(toeKicks.every((kick) => kick.userData.toeKickFaceWidthIn === 24 && kick.userData.toeKickHeightIn === 4.5)).toBe(true);
      expect(toeKicks.every((kick) => kick.userData.toeKickRecessIn === 3)).toBe(true);
      expect(toeKicks.map((kick) => ((kick as THREE.Mesh).geometry as THREE.BoxGeometry).parameters.width)).toEqual([
        expect.closeTo(24 / 12, 6), expect.closeTo(24 / 12, 6),
      ]);
      const frontKick = toeKicks.find((kick) => kick.userData.attachedEndFrontToeKick === "left") as THREE.Mesh;
      const rightKick = toeKicks.find((kick) => kick.userData.attachedEndFrontToeKick === "right") as THREE.Mesh;
      expect(frontKick.rotation.y).toBeCloseTo(-Math.PI / 4, 8);
      expect(rightKick.rotation.y).toBeCloseTo(Math.PI / 4, 8);
      expect(counters).toHaveLength(1);
      expect(counters[0]!.userData.nonCornerEndReturnCountertop).toBe(true);
      expect(counters[0]!.userData.diagramDefinedRearApexCountertop).toBe(true);
      const counterMesh = counters[0] as THREE.Mesh;
      expect(counterMesh.geometry.type).toBe("ExtrudeGeometry");
      const carcasses: THREE.Mesh[] = [];
      root.traverse((node) => {
        if (node.userData.nonCornerEndReturnBody && node instanceof THREE.Mesh) carcasses.push(node);
      });
      expect(carcasses).toHaveLength(1);
      expect(carcasses[0]!.userData.diagramDefinedRearApexBody).toBe(true);
      expect(carcasses[0]!.userData.sideLengthIn).toBe(24);
      expect(carcasses[0]!.visible).toBe(true);
      expect((carcasses[0] as THREE.Mesh).geometry.type).toBe("ExtrudeGeometry");
      expect(returnFaces).toHaveLength(2);
      expect(returnFaces.every((face) => face.userData.doorWidthIn === 8.45)).toBe(true);
      root.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(carcasses[0]!);
      expect(bounds.max.x - bounds.min.x).toBeCloseTo(24 / 12 * Math.SQRT2, 6);
      expect(bounds.max.z - bounds.min.z).toBeCloseTo(24 / 12 * Math.SQRT2, 6);
      const leftDoor = returnFaces.find((face) => face.userData.nonCornerEndReturnDoor === "left")!;
      const rightDoor = returnFaces.find((face) => face.userData.nonCornerEndReturnDoor === "right")!;
      expect(leftDoor.rotation.y).toBeCloseTo(-Math.PI / 4, 6);
      expect(rightDoor.rotation.y).toBeCloseTo(Math.PI / 4, 6);
      expect(leftDoor.userData.attachedEndFront).toBe(true);
      expect(rightDoor.userData.attachedEndFront).toBe(true);
    }
  });

  // Retained only as historical documentation of the pre-source import model.
  it.skip("retired: keeps a saved BEC-24 on its placement record while rendering the diagram-defined rear-apex two-face end form", () => {
    const base = {
      uid: "base-run-24", cabinetId: 11, masterCode: "B-24", description: '24" Base Cabinet', placement: "base",
      x: 0, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0, numberOfDoors: 2, numberOfDrawers: 0,
    } as never;
    const bec = {
      uid: "bec-run-end", cabinetId: 9390014, masterCode: "BEC-24", description: '24" Base End Cabinet — 45° Angled Front', placement: "base",
      x: 24, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0, numberOfDoors: 2, numberOfDrawers: 0,
      customProfile: "base_end_return",
    } as never;
    expect(existingCabinetTransform(base)).toMatchObject({ x: 12, z: 12, rotation: 0, bottom: 0 });
    expect(existingCabinetTransform(bec)).toMatchObject({ x: 36, z: 12, rotation: 0, bottom: 0 });

    const root = new THREE.Group();
    addCabinet(root, existingCabinetSku(base), null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, existingCabinetTransform(base));
    addCabinet(root, existingCabinetSku(bec), null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, existingCabinetTransform(bec));
    const standardBodies: THREE.Mesh[] = [];
    const becBodies: THREE.Mesh[] = [];
    const becDoors: THREE.Object3D[] = [];
    const becFrontGroups: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.nonCornerEndReturnBody && node instanceof THREE.Mesh) becBodies.push(node);
      if (node.userData.nonCornerEndReturnDoor) becDoors.push(node);
      if (node.userData.becAttachedTwoFaceEnd) becFrontGroups.push(node);
      if (node.userData.selectedStyleSideSkin && !node.userData.nonCornerEndReturnBody && node instanceof THREE.Mesh) standardBodies.push(node);
    });
    expect(becBodies).toHaveLength(1);
    expect(becDoors).toHaveLength(2);
    expect(becFrontGroups).toHaveLength(1);
    expect(becFrontGroups[0]!.userData.separateProjectedThirdFace).toBe(false);
    root.updateMatrixWorld(true);
    const becBounds = new THREE.Box3().setFromObject(becBodies[0]!);
    expect(becBounds.max.x - becBounds.min.x).toBeCloseTo(24 / 12 * Math.SQRT2, 6);
    expect(becBounds.max.z - becBounds.min.z).toBeCloseTo(24 / 12 * Math.SQRT2, 6);
    const leftDoor = becDoors.find((door) => door.userData.nonCornerEndReturnDoor === "left")!;
    const rightDoor = becDoors.find((door) => door.userData.nonCornerEndReturnDoor === "right")!;
    const leftApex = leftDoor.localToWorld(new THREE.Vector3(8.45 / 12 / 2, 0, 0));
    const rightApex = rightDoor.localToWorld(new THREE.Vector3(-8.45 / 12 / 2, 0, 0));
    expect(leftApex.distanceTo(rightApex)).toBeLessThan(0.08);
    expect(becDoors.every((door) => door.userData.doorWidthIn === 8.45 && door.userData.referenceFaceSideIn === 24 && door.userData.attachedEndFront)).toBe(true);
  });

  it("renders BEC24 as a 24-inch square end cabinet with two doors on one flat front", () => {
    const sku = {
      distributorSkuId: -24,
      cabinetId: 9390014,
      masterCode: "BEC24",
      description: '24" Base End Cabinet — Quarter-Octagon Shape, 2 Doors',
      placementType: "base",
      width: 24,
      height: 34.5,
      depth: 24,
      numberOfDoors: 2,
      numberOfDrawers: 0,
      customProfile: "base-end-quarter-octagon",
    } as never;
    expect(resolvedThreeDSpecialtyProfile(sku)).toEqual({ kind: "standard", pattern: null });

    const root = new THREE.Group();
    addCabinet(root, sku, null, {}, 144, 120, "#8a9ba8", "#f8f8f6");
    const retiredFaces: THREE.Object3D[] = [];
    const standardDoors: THREE.Mesh[] = [];
    const bodies: THREE.Mesh[] = [];
    root.traverse((node) => {
      if (node.userData.nonCornerEndReturnDoor) retiredFaces.push(node);
      if (node instanceof THREE.Mesh && node.userData.cabinetFront && !node.userData.cabinetDrawerFront) standardDoors.push(node);
      if (node instanceof THREE.Mesh && node.userData.selectedStyleSideSkin && !node.userData.baseToeKick) bodies.push(node);
    });
    expect(retiredFaces).toHaveLength(0);
    expect(standardDoors).toHaveLength(2);
    // "Quarter-Octagon" contains "-Oc". A broad OC oven-code match formerly
    // rendered two oven-zone doors plus black oven glass instead of BEC fronts.
    expect(standardDoors.every((door) => !door.userData.ovenCabinetDoor)).toBe(true);
    const falseOvenParts: THREE.Object3D[] = [];
    root.traverse((node) => { if (node.userData.ovenCabinetOpening || node.userData.ovenCabinetDoor) falseOvenParts.push(node); });
    expect(falseOvenParts).toHaveLength(0);
    expect(bodies).toHaveLength(1);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(bodies[0]!);
    expect(box.max.x - box.min.x).toBeCloseTo(24 / 12, 6);
    expect(box.max.z - box.min.z).toBeCloseTo(24 / 12, 6);
    const doorBoxes = standardDoors.map((door) => new THREE.Box3().setFromObject(door));
    expect(doorBoxes[0]!.max.x).toBeLessThan(doorBoxes[1]!.min.x);
    expect(doorBoxes[0]!.min.z).toBeCloseTo(doorBoxes[1]!.min.z, 6);
    expect(doorBoxes[0]!.max.z).toBeCloseTo(doorBoxes[1]!.max.z, 6);
  });

  it("keeps standard configured doors and drawers fully outside their physical carcass face without overhanging its width", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -185,
      cabinetId: 185,
      masterCode: "B-2434-FRONT-BOUNDARY",
      description: '24" Base Cabinet with configured doors and drawers',
      placementType: "base",
      width: 24,
      height: 34.5,
      depth: 24,
      numberOfDoors: 2,
      numberOfDrawers: 2,
      drawerHeight: 6,
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", { doorStyle: "Shaker", doorPanelType: null });
    const bodies: THREE.Mesh[] = [];
    const fronts: THREE.Mesh[] = [];
    const frontGroups: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node instanceof THREE.Mesh && node.userData.selectedStyleSideSkin && !node.userData.baseToeKick) bodies.push(node);
      if (node instanceof THREE.Mesh && node.userData.cabinetFront) fronts.push(node);
      if (node.userData.physicalFacePlane) frontGroups.push(node);
    });
    expect(bodies).toHaveLength(1);
    expect(fronts).toHaveLength(4);
    expect(frontGroups).toHaveLength(1);
    expect(frontGroups[0]!.userData.decorativeFrontClearanceIn).toBeGreaterThan(0);
    root.updateMatrixWorld(true);
    const bodyBounds = new THREE.Box3().setFromObject(bodies[0]!);
    for (const front of fronts) {
      const frontBounds = new THREE.Box3().setFromObject(front);
      expect(frontBounds.min.z).toBeGreaterThanOrEqual(bodyBounds.max.z - 1e-8);
      expect(frontBounds.min.x).toBeGreaterThanOrEqual(bodyBounds.min.x - 1e-8);
      expect(frontBounds.max.x).toBeLessThanOrEqual(bodyBounds.max.x + 1e-8);
      expect(frontBounds.min.y).toBeGreaterThanOrEqual(bodyBounds.min.y - 1e-8);
      expect(frontBounds.max.y).toBeLessThanOrEqual(bodyBounds.max.y + 1e-8);
    }
  });

  it("applies the physical face-plane contract to standard, tall, diagonal, L-corner, corner-drawer, end-return, and angled-wall fronts", () => {
    const root = new THREE.Group();
    const specimens = [
      { distributorSkuId: -186, cabinetId: 186, masterCode: "B-24-FLUSH", description: '24" Base Cabinet', placementType: "base", width: 24, height: 34.5, depth: 24, numberOfDoors: 2, numberOfDrawers: 0 },
      { distributorSkuId: -187, cabinetId: 187, masterCode: "PANTRY-2490-FLUSH", description: '24" x 90" Pantry Cabinet', placementType: "tall", width: 24, height: 90, depth: 24, numberOfDoors: 4, numberOfDrawers: 0 },
      { distributorSkuId: -188, cabinetId: 188, masterCode: "WDC2430-FLUSH", description: '24" Diagonal Wall Corner', placementType: "wall", width: 24, height: 30, depth: 24, numberOfDoors: 2, numberOfDrawers: 0, cornerGeometryKind: "diagonal" },
      { distributorSkuId: -189, cabinetId: 189, masterCode: "LS36-FLUSH", description: '36" Lazy Susan', placementType: "base", width: 36, height: 34.5, depth: 36, numberOfDoors: 2, numberOfDrawers: 0, cornerGeometryKind: "l-shape" },
      { distributorSkuId: -190, cabinetId: 190, masterCode: "CDB36-FLUSH", description: '36" Corner Drawer Base', placementType: "base", width: 36, height: 34.5, depth: 36, numberOfDoors: 0, numberOfDrawers: 3 },
      { distributorSkuId: -191, cabinetId: 191, masterCode: "BEC-24-FLUSH", description: '24" Base End Cabinet', placementType: "base", width: 24, height: 34.5, depth: 24, numberOfDoors: 2, numberOfDrawers: 0, cornerGeometryKind: "base-end" },
      { distributorSkuId: -192, cabinetId: 192, masterCode: "AW1230-FLUSH", description: '12" Angled Wall Cabinet', placementType: "wall", width: 12, height: 30, depth: 12, numberOfDoors: 1, numberOfDrawers: 0, customProfile: "angled-wall" },
    ];
    specimens.forEach((sku, index) => addCabinet(root, sku as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: index * 4, z: 0, rotation: 0 }));
    const fronts: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.cabinetFront) fronts.push(node);
    });
    expect(fronts.length).toBeGreaterThan(12);
    expect(fronts.every((front) => front.userData.flushPhysicalFace === true)).toBe(true);
  });

  it("routes AW1230, AW1236, and AW1242 to one centered door on the true angled-wall hypotenuse", () => {
    const root = new THREE.Group();
    const awCodes = ["AW1230", "AW1236", "AW1242"];
    awCodes.forEach((masterCode, index) => {
      addCabinet(root, {
        distributorSkuId: -220 - index,
        cabinetId: 220 + index,
        masterCode,
        description: `12\" Angled Wall Cabinet ${masterCode.slice(-2)}\" High`,
        placementType: "wall",
        width: 12,
        height: Number(masterCode.slice(-2)),
        depth: 12,
        numberOfDoors: 1,
        numberOfDrawers: 0,
      } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: index * 3, z: 0, rotation: 0, bottom: 54 });
    });
    root.updateMatrixWorld(true);
    for (const masterCode of awCodes) {
      const cabinet = root.children.find((node) => node.userData.masterCode === masterCode)!;
      const wedge = cabinet.children.find((node) => node instanceof THREE.Mesh && node.userData.angledWallWedge) as THREE.Mesh;
      const doors: THREE.Mesh[] = [];
      cabinet.traverse((node) => { if (node instanceof THREE.Mesh && node.userData.angledWallDoor) doors.push(node); });
      expect(wedge).toBeDefined();
      expect(doors).toHaveLength(1);
      expect(doors[0]!.userData.flushPhysicalFace).toBe(true);
      expect(doors[0]!.rotation.y).toBeCloseTo(-Math.PI / 4, 8);
      const bodyBounds = new THREE.Box3().setFromObject(wedge);
      const doorBounds = new THREE.Box3().setFromObject(doors[0]!);
      expect(doorBounds.max.x).toBeLessThanOrEqual(bodyBounds.max.x + 1e-8);
      expect(doorBounds.min.z).toBeGreaterThanOrEqual(bodyBounds.min.z - 1e-8);
    }
  });

  it("renders a pantry as two two-door sets split by a 54-inch lower door section", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -90,
      cabinetId: 90,
      masterCode: "PANTRY-2490",
      description: '24" x 90" Pantry Cabinet',
      placementType: "tall",
      width: 24,
      height: 90,
      depth: 24,
      numberOfDoors: 4,
      numberOfDrawers: 0,
      cornerType: null,
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6");
    const lower: THREE.Object3D[] = [];
    const upper: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.pantryDoorSet === "lower") lower.push(node);
      if (node.userData.pantryDoorSet === "upper") upper.push(node);
    });
    expect(lower).toHaveLength(2);
    expect(upper).toHaveLength(2);
    expect(((lower[0] as THREE.Mesh).geometry as THREE.BoxGeometry).parameters.height).toBeCloseTo(54 / 12 - 0.025, 12);
  });

  it("keeps a standard wall cabinet’s selected-finish side skin on the saved 24-by-12 carcass envelope", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -24,
      cabinetId: 24,
      masterCode: "W-24-30",
      description: '24" x 30" Wall Cabinet',
      placementType: "wall",
      width: 24,
      height: 30,
      depth: 12,
      numberOfDoors: 2,
      numberOfDrawers: 0,
      cornerType: null,
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 24, z: 12, rotation: Math.PI / 2 });

    const sideSkins: THREE.Mesh[] = [];
    root.traverse((node) => {
      if (node instanceof THREE.Mesh && node.userData.selectedStyleSideSkin) sideSkins.push(node);
    });

    expect(sideSkins).toHaveLength(1);
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(sideSkins[0]!);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(1, 8);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(2, 8);
    expect(bounds.max.y - bounds.min.y).toBeCloseTo(30 / 12, 8);
  });

  it("builds a dimensional face frame behind standard cabinet doors without changing the carcass envelope", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -241,
      cabinetId: 241,
      masterCode: "B-24-FRAME",
      description: '24" Base Cabinet',
      placementType: "base",
      width: 24,
      height: 34.5,
      depth: 24,
      numberOfDoors: 2,
      numberOfDrawers: 1,
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6");
    const frames: THREE.Object3D[] = [];
    root.traverse((node) => { if (node.userData.cabinetFaceFrame) frames.push(node); });
    expect(frames.length).toBeGreaterThanOrEqual(5);
    expect(frames.some((node) => node.userData.constructedCarcassDetail)).toBe(true);
    expect(root.children.find((node) => node.userData.masterCode === "B-24-FRAME")?.userData.floorStandingCabinet).toBe(true);
  });

  it("builds every standard base cabinet above a recessed four-and-a-half-inch toe kick", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -33,
      cabinetId: 33,
      masterCode: "B-33",
      description: '33" Base Cabinet',
      placementType: "base",
      width: 33,
      height: 34.5,
      depth: 24,
      numberOfDoors: 2,
      numberOfDrawers: 0,
      cornerType: null,
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6");

    let toeKick: THREE.Mesh | null = null;
    let carcass: THREE.Mesh | null = null;
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.userData.baseToeKick) toeKick = node;
      if (node.userData.selectedStyleSideSkin && !node.userData.baseToeKick) carcass = node;
    });
    expect(toeKick).not.toBeNull();
    expect(toeKick!.userData.toeKickHeightIn).toBe(4.5);
    expect(toeKick!.userData.toeKickRecessIn).toBe(3);
    root.updateMatrixWorld(true);
    const toeKickBounds = new THREE.Box3().setFromObject(toeKick!);
    const carcassBounds = new THREE.Box3().setFromObject(carcass!);
    expect(toeKickBounds.min.y).toBeCloseTo(0, 8);
    expect(toeKickBounds.max.y).toBeCloseTo(4.5 / 12, 8);
    expect(carcassBounds.max.z - toeKickBounds.max.z).toBeCloseTo(3 / 12, 8);
    expect(((carcass!.geometry as THREE.BoxGeometry).parameters.height)).toBeCloseTo(30 / 12, 8);
  });

  it("adds a visible selected-finish skin at the three-inch toe-kick recess without replacing the physical support", () => {
    const selectedRoot = new THREE.Group();
    const sku = {
      distributorSkuId: -333,
      cabinetId: 333,
      masterCode: "B-33",
      description: '33" Base Cabinet',
      placementType: "base",
      width: 33,
      height: 34.5,
      depth: 24,
      numberOfDoors: 2,
      numberOfDrawers: 0,
      cornerType: null,
    } as never;
    addCabinet(selectedRoot, sku, null, {}, 144, 120, "#7e8d72", "#f8f8f6", undefined, undefined, undefined, undefined, { selectedToeKick: true });

    const physicalSupports: THREE.Object3D[] = [];
    const finishSkins: THREE.Mesh<THREE.BoxGeometry>[] = [];
    selectedRoot.traverse((node) => {
      if (node.userData.baseToeKick && node.userData.doesNotReplacePhysicalSupport !== true) physicalSupports.push(node);
      if (node instanceof THREE.Mesh && node.userData.selectedToeKickFinishSkin && node.userData.visibleToeKickFrontPlane) finishSkins.push(node as THREE.Mesh<THREE.BoxGeometry>);
    });
    expect(physicalSupports).toHaveLength(1);
    expect(finishSkins).toHaveLength(1);
    expect(finishSkins[0].userData).toMatchObject({ toeKickHeightIn: 4.5, toeKickRecessIn: 3, doesNotReplacePhysicalSupport: true });
    expect(finishSkins[0].userData.baseToeKick).toBeUndefined();
    expect(finishSkins[0].geometry.parameters.depth).toBeCloseTo(0.035, 8);
    expect(finishSkins[0].position.z).toBeCloseTo(24 / 12 / 2 - 3 / 12 + 0.035 / 2 + 0.002, 8);
    expect((finishSkins[0].material as THREE.MeshStandardMaterial).color.getHexString()).toBe("7e8d72");

    const unselectedRoot = new THREE.Group();
    addCabinet(unselectedRoot, sku, null, {}, 144, 120, "#7e8d72", "#f8f8f6");
    const unselectedFinishSkins: THREE.Object3D[] = [];
    const unselectedPhysicalSupports: THREE.Mesh[] = [];
    unselectedRoot.traverse((node) => {
      if (node.userData.selectedToeKickFinishSkin) unselectedFinishSkins.push(node);
      if (node instanceof THREE.Mesh && node.userData.baseToeKick) unselectedPhysicalSupports.push(node);
    });
    expect(unselectedFinishSkins).toHaveLength(0);
    expect(unselectedPhysicalSupports).toHaveLength(1);
    expect((unselectedPhysicalSupports[0].material as THREE.MeshStandardMaterial).color.getHexString()).toBe("211f1c");
  });

  it("adds a four-and-a-half-inch toe kick to every cabinet that rests on the floor, including tall and floor-dropped wall profiles", () => {
    const root = new THREE.Group();
    const floorFixtures = [
      { masterCode: "B-24", description: '24" Base', placementType: "base", width: 24, height: 34.5, depth: 24 },
      { masterCode: "PANTRY-24", description: '24" Pantry', placementType: "tall", width: 24, height: 84, depth: 24 },
      { masterCode: "W-2430", description: '24" Wall Cabinet Floor Mounted', placementType: "wall", width: 24, height: 30, depth: 12 },
    ];
    floorFixtures.forEach((fixture, index) => {
      addCabinet(root, { distributorSkuId: -140 - index, cabinetId: 140 + index, numberOfDoors: 2, numberOfDrawers: 0, cornerType: null, ...fixture } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 18 + index * 30, z: 12, rotation: 0, bottom: index === 2 ? 0 : 4.5 });
    });
    const kicks: THREE.Mesh[] = [];
    const floorCabinets: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.floorStandingCabinet) floorCabinets.push(node);
      if (node instanceof THREE.Mesh && node.userData.floorStandingToeKick) kicks.push(node);
    });
    expect(floorCabinets).toHaveLength(3);
    expect(kicks).toHaveLength(3);
    root.updateMatrixWorld(true);
    kicks.forEach((kick) => {
      const bounds = new THREE.Box3().setFromObject(kick);
      expect(kick.userData.toeKickHeightIn).toBe(4.5);
      expect(kick.userData.toeKickRecessIn).toBe(3);
      expect(bounds.min.y).toBeCloseTo(0, 8);
      expect(bounds.max.y).toBeCloseTo(4.5 / 12, 8);
    });

    const raisedWallRoot = new THREE.Group();
    addCabinet(raisedWallRoot, { distributorSkuId: -150, cabinetId: 150, masterCode: "W-2430", description: '24" Wall Cabinet', placementType: "wall", width: 24, height: 30, depth: 12, numberOfDoors: 2, numberOfDrawers: 0 } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 18, z: 12, rotation: 0, bottom: 54 });
    const raisedKicks: THREE.Object3D[] = [];
    raisedWallRoot.traverse((node) => { if (node.userData.floorStandingToeKick) raisedKicks.push(node); });
    expect(raisedKicks).toHaveLength(0);
  });

  it("keeps a base cabinet and a raised wall cabinet as distinct measured assemblies", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -151,
      cabinetId: 151,
      masterCode: "B-24-DISTINCT",
      description: '24" Base Cabinet',
      placementType: "base",
      width: 24,
      height: 34.5,
      depth: 24,
      numberOfDoors: 2,
      numberOfDrawers: 1,
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 24, z: 12, rotation: 0, bottom: 4.5 });
    addCabinet(root, {
      distributorSkuId: -152,
      cabinetId: 152,
      masterCode: "W-24-DISTINCT",
      description: '24" x 30" Wall Cabinet',
      placementType: "wall",
      width: 24,
      height: 30,
      depth: 12,
      numberOfDoors: 2,
      numberOfDrawers: 0,
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 24, z: 6, rotation: 0, bottom: 54 });

    const base = root.children.find((node) => node.userData.masterCode === "B-24-DISTINCT")!;
    const wall = root.children.find((node) => node.userData.masterCode === "W-24-DISTINCT")!;
    const baseBodies: THREE.Mesh[] = [];
    const wallBodies: THREE.Mesh[] = [];
    const baseFronts: THREE.Object3D[] = [];
    const wallFronts: THREE.Object3D[] = [];
    const counters: THREE.Mesh[] = [];
    base.traverse((node) => {
      if (node instanceof THREE.Mesh && node.userData.selectedStyleSideSkin && !node.userData.baseToeKick) baseBodies.push(node);
      if (node.userData.cabinetFront) baseFronts.push(node);
    });
    wall.traverse((node) => {
      if (node instanceof THREE.Mesh && node.userData.selectedStyleSideSkin) wallBodies.push(node);
      if (node.userData.cabinetFront) wallFronts.push(node);
    });
    root.traverse((node) => {
      if (node instanceof THREE.Mesh && node.userData.countertopDepthIn === 25.5) counters.push(node);
    });
    expect(base.userData.floorStandingCabinet).toBe(true);
    expect(wall.userData.floorStandingCabinet).toBeUndefined();
    expect(baseBodies).toHaveLength(1);
    expect(wallBodies).toHaveLength(1);
    expect(baseFronts).toHaveLength(3);
    expect(wallFronts).toHaveLength(2);
    expect(counters).toHaveLength(1);
    root.updateMatrixWorld(true);
    const baseBounds = new THREE.Box3().setFromObject(baseBodies[0]!);
    const wallBounds = new THREE.Box3().setFromObject(wallBodies[0]!);
    const counterBounds = new THREE.Box3().setFromObject(counters[0]!);
    expect(baseBounds.min.y).toBeCloseTo(4.5 / 12, 8);
    expect(baseBounds.max.y).toBeCloseTo(34.5 / 12, 8);
    expect(counterBounds.min.y).toBeCloseTo(34.5 / 12, 8);
    expect(counterBounds.max.y).toBeCloseTo(36 / 12, 8);
    expect(wallBounds.min.y).toBeCloseTo(54 / 12, 8);
    expect(wallBounds.max.y).toBeCloseTo(84 / 12, 8);
  });

  it("preserves distinct configured faces for adjacent persisted base and wall records instead of flattening both into generic panels", () => {
    const root = new THREE.Group();
    const savedBase = {
      uid: "saved-base-fronts", cabinetId: 611, masterCode: "B24-SAVED-FACES", description: '24" Base Cabinet',
      placement: "base", x: 24, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0,
      numberOfDoors: 2, numberOfDrawers: 1,
    } as never;
    const savedWall = {
      uid: "saved-wall-fronts", cabinetId: 612, masterCode: "W24-SAVED-FACES", description: '24" x 30" Wall Cabinet',
      placement: "wall", x: 24, y: 0, width: 24, depth: 12, height: 30, rotation: 0,
      mountBottom: 54, numberOfDoors: 2, numberOfDrawers: 0,
    } as never;
    [savedBase, savedWall].forEach((saved) => {
      addCabinet(root, existingCabinetSku(saved), null, {}, 144, 120, "#8a9ba8", "#f8f8f6", { doorStyle: "Shaker", doorPanelType: null }, existingCabinetTransform(saved));
    });
    const base = root.children.find((node) => node.userData.masterCode === "B24-SAVED-FACES")!;
    const wall = root.children.find((node) => node.userData.masterCode === "W24-SAVED-FACES")!;
    const baseFronts: THREE.Object3D[] = [];
    const wallFronts: THREE.Object3D[] = [];
    base.traverse((node) => { if (node.userData.cabinetFront) baseFronts.push(node); });
    wall.traverse((node) => { if (node.userData.cabinetFront) wallFronts.push(node); });
    expect(base.userData.floorStandingCabinet).toBe(true);
    expect(wall.userData.floorStandingCabinet).toBeUndefined();
    expect(baseFronts).toHaveLength(3);
    expect(wallFronts).toHaveLength(2);
    expect(baseFronts.every((front) => front.userData.flushPhysicalFace === true)).toBe(true);
    expect(wallFronts.every((front) => front.userData.flushPhysicalFace === true)).toBe(true);
  });

  it("keeps a floor dishwasher flush in its 2D base opening with a matching toe kick and supported countertop", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -24,
      cabinetId: 24,
      masterCode: "DW-24",
      description: '24" Built-In Dishwasher',
      placementType: "appliance",
      width: 24,
      height: 34.5,
      depth: 24,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 48, z: 12, rotation: 0, bottom: 0 });

    let dishwasherKick: THREE.Mesh | null = null;
    let dishwasherFace: THREE.Mesh | null = null;
    let dishwasherOpening: THREE.Mesh | null = null;
    let countertop: THREE.Mesh | null = null;
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.userData.dishwasherToeKick) dishwasherKick = node;
      if (node.userData.dishwasherFlushFace) dishwasherFace = node;
      if (node.userData.dishwasherOpening) dishwasherOpening = node;
      if (node.userData.dishwasherCountertopSupport) countertop = node;
    });
    expect(dishwasherKick).not.toBeNull();
    expect(dishwasherFace).not.toBeNull();
    expect(dishwasherOpening).not.toBeNull();
    expect(countertop).not.toBeNull();
    root.updateMatrixWorld(true);
    const kickBounds = new THREE.Box3().setFromObject(dishwasherKick!);
    const faceBounds = new THREE.Box3().setFromObject(dishwasherFace!);
    const counterBounds = new THREE.Box3().setFromObject(countertop!);
    expect(kickBounds.min.y).toBeCloseTo(0, 8);
    expect(kickBounds.max.y).toBeCloseTo(4.5 / 12, 8);
    expect(faceBounds.min.y).toBeCloseTo(4.5 / 12, 8);
    expect(faceBounds.max.y).toBeCloseTo(34.5 / 12, 8);
    // The dishwasher opening spans the full appliance face with a 0.14-foot visual inset.
    expect(((dishwasherOpening!.geometry as THREE.BoxGeometry).parameters.width)).toBeCloseTo((24 / 12) - 0.14, 8);
    expect(counterBounds.min.y).toBeCloseTo(34.5 / 12, 8);
    expect(counterBounds.max.y).toBeCloseTo(36 / 12, 8);
  });

  it("uses a neutral appliance chassis at a dishwasher edge instead of a cabinet-finish side mesh", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -24,
      cabinetId: 24,
      masterCode: "DW-24",
      description: "24 inch Built-In Dishwasher",
      placementType: "appliance",
      width: 24,
      height: 34.5,
      depth: 24,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 48, z: 12, rotation: 0, bottom: 0 });

    let chassis: THREE.Mesh | null = null;
    const cabinetFinishMeshes: THREE.Mesh[] = [];
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.userData.dishwasherChassis) chassis = node;
      if (node.userData.selectedFinishSideSkin || node.userData.selectedStyleSideSkin) cabinetFinishMeshes.push(node);
    });

    expect(chassis).not.toBeNull();
    expect(chassis!.userData).toMatchObject({
      dishwasherChassis: true,
      floorApplianceEnvelope: true,
      neutralApplianceSidesAndTop: true,
      usesDoorImage: false,
    });
    expect(chassis!.userData.selectedFinishSideSkin).toBeUndefined();
    expect(chassis!.userData.selectedStyleSideSkin).toBeUndefined();
    expect((chassis!.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("59616a");
    expect(cabinetFinishMeshes).toHaveLength(0);
  });

  it("retains the selected cabinet finish only for an explicitly panel-ready dishwasher", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -25,
      cabinetId: 25,
      masterCode: "DW-24-PANEL",
      description: "24 inch Panel-Ready Integrated Dishwasher",
      placementType: "appliance",
      width: 24,
      height: 34.5,
      depth: 24,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 48, z: 12, rotation: 0, bottom: 0 });

    let chassis: THREE.Mesh | null = null;
    root.traverse((node) => {
      if (node instanceof THREE.Mesh && node.userData.dishwasherChassis) chassis = node;
    });
    expect(chassis?.userData).toMatchObject({ dishwasherChassis: true, selectedFinishSideSkin: true });
    expect(chassis?.userData.panelReadyFinish).toBeUndefined();
    expect((chassis!.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("8a9ba8");
  });

  it("renders a range as a freestanding floor appliance rather than a cabinet box", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -30,
      cabinetId: 30,
      masterCode: "RANGE-30",
      description: '30" Freestanding Gas Range',
      placementType: "appliance",
      width: 30,
      height: 36,
      depth: 25,
      numberOfDoors: 0,
      numberOfDrawers: 0,
      catalogImageUrl: "/manus-storage/range-test-front.webp",
      placementUid: "island-range-30",
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 48, z: 12, rotation: 0, bottom: 0 });

    let chassis: THREE.Mesh | null = null;
    let toeRecess: THREE.Mesh | null = null;
    let cooktopSurface: THREE.Mesh | null = null;
    let backguard: THREE.Mesh | null = null;
    const feet: THREE.Mesh[] = [];
    const visibleFrontFeet: THREE.Mesh[] = [];
    const cabinetSkins: THREE.Mesh[] = [];
    const productFronts: THREE.Mesh[] = [];
    const selectionHitboxes: THREE.Mesh[] = [];
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.userData.freestandingRangeChassis) chassis = node;
      if (node.userData.freestandingRangeToeRecess) toeRecess = node;
      if (node.userData.rangeCooktop) cooktopSurface = node;
      if (node.userData.rangeBackguard) backguard = node;
      if (node.userData.freestandingRangeFoot) feet.push(node);
      if (node.userData.visibleFreestandingRangeFoot) visibleFrontFeet.push(node);
      if (node.userData.selectedStyleSideSkin) cabinetSkins.push(node);
      if (node.userData.originalProductVisual) productFronts.push(node);
      if (node.userData.applianceRangeSelectionHitbox) selectionHitboxes.push(node);
    });

    expect(chassis).not.toBeNull();
    expect(toeRecess).not.toBeNull();
    expect(cooktopSurface).not.toBeNull();
    expect(backguard).not.toBeNull();
    expect(feet).toHaveLength(4);
    expect(visibleFrontFeet).toHaveLength(2);
    expect(cabinetSkins).toHaveLength(0);
    expect(productFronts).toHaveLength(0);
    expect(selectionHitboxes).toHaveLength(1);
    expect(selectionHitboxes[0]!.userData.cabinetFront).toBe(true);
    expect(selectionHitboxes[0]!.userData.selectionOnly).toBe(true);
    expect((selectionHitboxes[0]!.material as THREE.MeshBasicMaterial).opacity).toBe(0);
    expect((selectionHitboxes[0]!.material as THREE.MeshBasicMaterial).colorWrite).toBe(false);
    expect(threeDCabinetHitFromIntersections([{ object: selectionHitboxes[0]! }])).toMatchObject({
      uid: "island-range-30",
      masterCode: "RANGE-30",
    });

    root.updateMatrixWorld(true);
    const chassisBounds = new THREE.Box3().setFromObject(chassis!);
    const cooktopBounds = new THREE.Box3().setFromObject(cooktopSurface!);
    const backguardBounds = new THREE.Box3().setFromObject(backguard!);
    const footBounds = feet.reduce(
      (bounds, foot) => bounds.union(new THREE.Box3().setFromObject(foot)),
      new THREE.Box3().makeEmpty(),
    );
    expect(footBounds.min.y).toBeCloseTo(0, 8);
    expect(footBounds.max.y).toBeCloseTo(chassisBounds.min.y, 6);
    expect(cooktopBounds.max.y).toBeCloseTo(36 / 12, 6);
    expect(backguardBounds.max.y).toBeCloseTo(47 / 12, 6);
    expect(backguard!.userData.rangeBackguardTopIn).toBe(47);
    expect(chassis!.userData.rangeFloorClearanceIn).toBeGreaterThan(0);
  });

  it("renders a selected Black Gas Range with a black chassis and five visible gas controls", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -31, cabinetId: 30, masterCode: "RANGE-30", description: '30" Black Gas Range', placementType: "appliance",
      width: 30, height: 36, depth: 25, numberOfDoors: 0, numberOfDrawers: 0,
      catalogImageUrl: "/manus-storage/30inchWideBlackGasRange-silhouette_0a25e71c.webp",
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 48, z: 12, rotation: 0, bottom: 0 });
    const gasControls: THREE.Mesh[] = [];
    const gasGrates: THREE.Mesh[] = [];
    const rearDisplays: THREE.Mesh[] = [];
    let chassis: THREE.Mesh | null = null;
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.userData.freestandingRangeChassis) chassis = node;
      if (node.userData.rangeControlType === "gas-knob") gasControls.push(node);
      if (node.userData.rangeGasGrate) gasGrates.push(node);
      if (node.userData.rangeRearControlDisplay) rearDisplays.push(node);
    });
    expect(gasControls).toHaveLength(5);
    expect(gasGrates).toHaveLength(8);
    expect(rearDisplays).toHaveLength(1);
    expect(chassis?.userData).toMatchObject({ rangeFinish: "black", rangeFuel: "gas" });
  });

  it("renders a rear-control electric range with a raised display, front controls, and glass cooktop", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -34, cabinetId: 30, masterCode: "RANGE-30", description: '30" Stainless Electric Range', placementType: "appliance",
      width: 30, height: 36, depth: 25, numberOfDoors: 0, numberOfDrawers: 0,
      catalogImageUrl: "/manus-storage/30inchWideStainlessSteelElectricRange-cropped_c6f3d3e6.webp",
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 48, z: 12, rotation: 0, bottom: 0 });
    const electricControls: THREE.Mesh[] = [];
    const backguards: THREE.Mesh[] = [];
    const rearDisplays: THREE.Mesh[] = [];
    const cooktops: THREE.Mesh[] = [];
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.userData.rangeControlType === "electric-control" && node.userData.rangeControlPosition === "rear") electricControls.push(node);
      if (node.userData.rangeBackguard) backguards.push(node);
      if (node.userData.rangeRearControlDisplay) rearDisplays.push(node);
      if (node.userData.rangeCooktopStyle === "electric-glass") cooktops.push(node);
    });
    expect(electricControls).toHaveLength(4);
    expect(backguards).toHaveLength(1);
    expect(rearDisplays).toHaveLength(1);
    expect(cooktops).toHaveLength(4);
  });

  it("renders front-control ranges with an integrated display and no raised rear backguard", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -32, cabinetId: 30, masterCode: "RANGE-30", description: '30" White Electric Front-Control Range', placementType: "appliance",
      width: 30, height: 36, depth: 25, numberOfDoors: 0, numberOfDrawers: 0,
      catalogImageUrl: "/manus-storage/30InchZlineFrontControlWhiteElectricRange-cropped_e5144787.webp",
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 48, z: 12, rotation: 0, bottom: 0 });
    const displays: THREE.Mesh[] = [];
    const panels: THREE.Mesh[] = [];
    const backguards: THREE.Mesh[] = [];
    const flatCooktops: THREE.Mesh[] = [];
    let ovenHandle: THREE.Mesh | null = null;
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.userData.rangeFrontControlDisplay) displays.push(node);
      if (node.userData.rangeFrontControlPanel) panels.push(node);
      if (node.userData.rangeBackguard) backguards.push(node);
      if (node.userData.rangeFrontControlFlatCooktop) flatCooktops.push(node);
      if (node.userData.rangeOvenHandle) ovenHandle = node;
    });
    expect(displays).toHaveLength(1);
    expect(panels).toHaveLength(1);
    expect(backguards).toHaveLength(0);
    expect(flatCooktops).toHaveLength(1);
    expect(ovenHandle).not.toBeNull();
    expect(displays[0].position.y).toBeGreaterThan(ovenHandle!.position.y);
  });

  it("keeps front-control gas ranges flat-topped with five integrated front knobs", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -33, cabinetId: 30, masterCode: "RANGE-30", description: '30" Black Stainless Front-Control Gas Range', placementType: "appliance",
      width: 30, height: 36, depth: 25, numberOfDoors: 0, numberOfDrawers: 0,
      catalogImageUrl: "/manus-storage/30InchWideBlackStainlessSteelFrontControlRange-cropped_96100940.webp",
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 48, z: 12, rotation: 0, bottom: 0 });
    const gasControls: THREE.Mesh[] = [];
    const flatCooktops: THREE.Mesh[] = [];
    const backguards: THREE.Mesh[] = [];
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.userData.rangeControlType === "gas-knob" && node.userData.rangeControlPosition === "front") gasControls.push(node);
      if (node.userData.rangeFrontControlFlatCooktop) flatCooktops.push(node);
      if (node.userData.rangeBackguard) backguards.push(node);
    });
    expect(gasControls).toHaveLength(5);
    expect(flatCooktops).toHaveLength(1);
    expect(backguards).toHaveLength(0);
  });

  it("preserves the saved tall-appliance height, dishwasher-spanning counter, and 66-inch range-hood mount in the actual scene meshes", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -36, cabinetId: 36, masterCode: "FRIDGE-36", description: "36 inch Refrigerator",
      placementType: "appliance", width: 36, height: 70, depth: 30, numberOfDoors: 0, numberOfDrawers: 0,
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 18, z: 18, rotation: 0, bottom: 0 });
    addCabinet(root, {
      distributorSkuId: -24, cabinetId: 24, masterCode: "DW-24", description: "24 inch Dishwasher",
      placementType: "appliance", width: 24, height: 34.5, depth: 24, numberOfDoors: 0, numberOfDrawers: 0,
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 66, z: 12, rotation: 0, bottom: 0 });
    addCabinet(root, {
      distributorSkuId: -30, cabinetId: 30, masterCode: "HOOD-30", description: "30 inch Range Hood",
      placementType: "appliance", width: 30, height: 18, depth: 18, mountBottom: 66, numberOfDoors: 0, numberOfDrawers: 0,
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 108, z: 12, rotation: 0, bottom: 66 });

    const fridge = root.children.find((node) => node.userData.masterCode === "FRIDGE-36")!;
    const dishwasher = root.children.find((node) => node.userData.masterCode === "DW-24")!;
    const hood = root.children.find((node) => node.userData.masterCode === "HOOD-30")!;
    let dishwasherCounter: THREE.Mesh | null = null;
    let hoodCanopy: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (node instanceof THREE.Mesh && node.userData.dishwasherCountertopSupport) dishwasherCounter = node;
      if (node.userData.rangeHoodCanopy) hoodCanopy = node;
    });
    root.updateMatrixWorld(true);

    const fridgeBounds = new THREE.Box3().setFromObject(fridge);
    const dishwasherBounds = new THREE.Box3().setFromObject(dishwasher);
    const dishwasherCounterBounds = new THREE.Box3().setFromObject(dishwasherCounter!);
    const hoodBounds = new THREE.Box3().setFromObject(hood);
    expect(fridge.userData.catalogApplianceEnvelope).toMatchObject({ heightIn: 70, mountBottomIn: 0 });
    expect(fridgeBounds.max.y - fridgeBounds.min.y).toBeCloseTo(70 / 12, 6);
    expect(dishwasherCounter).not.toBeNull();
    expect(dishwasherCounterBounds.min.x).toBeCloseTo(dishwasherBounds.min.x, 8);
    expect(dishwasherCounterBounds.max.x).toBeCloseTo(dishwasherBounds.max.x, 8);
    expect(dishwasherCounterBounds.min.y).toBeCloseTo(34.5 / 12, 8);
    expect(hood.userData.catalogApplianceEnvelope).toMatchObject({ mountBottomIn: 66, heightIn: 18 });
    expect(hoodBounds.min.y).toBeCloseTo(66 / 12, 8);
    expect(hoodBounds.max.y).toBeCloseTo(84 / 12, 6);
    expect(hoodCanopy).not.toBeNull();
  });

  it("keeps a configured microwave opening within its exact 27-by-17 Cabinet Config envelope", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: -27,
      cabinetId: 27,
      masterCode: "BMC-30",
      description: '30" Microwave Base Cabinet',
      placementType: "base",
      width: 30,
      height: 34.5,
      depth: 24,
      numberOfDoors: 0,
      numberOfDrawers: 1,
      openingType: "top",
      openingWidth: 27,
      openingHeight: 17,
      drawerHeight: 12,
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6");
    const openings: THREE.Object3D[] = [];
    root.traverse((node) => { if (node.userData.configuredOpening) openings.push(node); });
    expect(openings).toHaveLength(1);
    expect(openings[0]!.userData.openingWidthIn).toBeCloseTo(27, 12);
    expect(openings[0]!.userData.openingHeightIn).toBeCloseTo(17, 12);
  });

  it("uses distinct configured envelopes for wall and base microwave cabinets", () => {
    const fixtures = [
      { masterCode: "BMC-30", description: "Microwave Base Cabinet", placementType: "base", width: 30, height: 34.5, depth: 24, openingWidth: 27, openingHeight: 17 },
      { masterCode: "WMC-24", description: "Microwave Wall Cabinet", placementType: "wall", width: 24, height: 30, depth: 12, openingWidth: 22, openingHeight: 14 },
    ] as const;
    for (const fixture of fixtures) {
      const root = new THREE.Group();
      addCabinet(root, {
        distributorSkuId: -71,
        cabinetId: 71,
        ...fixture,
        numberOfDoors: 0,
        numberOfDrawers: 1,
        openingType: "top",
        drawerHeight: 8,
      } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6");
      const openings: THREE.Object3D[] = [];
      root.traverse((node) => { if (node.userData.configuredOpening) openings.push(node); });
      expect(openings).toHaveLength(1);
      expect(openings[0]!.userData.openingWidthIn).toBeCloseTo(fixture.openingWidth, 12);
      expect(openings[0]!.userData.openingHeightIn).toBeCloseTo(fixture.openingHeight, 12);
    }
  });

  it("renders MW3042 with two upper doors and its measured bottom opening around a modeled microwave instead of a catalog diagram", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: 2613279, cabinetId: 9390053, masterCode: "MW3042", description: '30" Microwave Wall Cabinet', placementType: "wall",
      width: 30, height: 42, depth: 18, numberOfDoors: 2, numberOfDrawers: 0,
      openingType: "bottom", doorHeight: 24, catalogImageUrl: "https://example.com/mw3042-diagram.webp",
    } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6");
    const openings: THREE.Object3D[] = [];
    const doors: THREE.Object3D[] = [];
    const microwaveFronts: THREE.Object3D[] = [];
    const microwaveGlass: THREE.Object3D[] = [];
    const microwaveControls: THREE.Object3D[] = [];
    const microwaveHandles: THREE.Object3D[] = [];
    const catalogVisuals: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.configuredOpening) openings.push(node);
      if (node.userData.cabinetFront && !node.userData.cabinetDrawerFront) doors.push(node);
      if (node.userData.wallMicrowaveFront) microwaveFronts.push(node);
      if (node.userData.wallMicrowaveGlass) microwaveGlass.push(node);
      if (node.userData.wallMicrowaveControlBand) microwaveControls.push(node);
      if (node.userData.wallMicrowaveHandle) microwaveHandles.push(node);
      if (node.userData.authoritativeCabinetFrontVisual) catalogVisuals.push(node);
    });
    expect(openings).toHaveLength(1);
    expect(doors).toHaveLength(2);
    expect(openings[0]!.position.y).toBeLessThan(doors[0]!.position.y);
    expect(microwaveFronts).toHaveLength(1);
    expect(microwaveGlass).toHaveLength(1);
    expect(microwaveControls).toHaveLength(1);
    expect(microwaveHandles).toHaveLength(1);
    expect(catalogVisuals).toHaveLength(0);
    expect(microwaveFronts[0]!.userData).toMatchObject({
      openingWidthIn: openings[0]!.userData.openingWidthIn,
      openingHeightIn: openings[0]!.userData.openingHeightIn,
      openingCenterYIn: openings[0]!.position.y / (1 / 12),
      seatedInsideConfiguredOpening: true,
    });
    expect(threeDCabinetFrontVisualUrl({
      masterCode: "MW3042",
      description: '30" Microwave Wall Cabinet',
      placementType: "wall",
      numberOfDoors: 2,
      openingType: "bottom",
      catalogImageUrl: "https://example.com/mw3042-diagram.webp",
    })).toBeNull();
    expect(threeDCabinetFrontVisualUrl({
      masterCode: "B24",
      placementType: "base",
      catalogImageUrl: "https://example.com/b24-diagram.webp",
    })).toBe("https://example.com/b24-diagram.webp");
    expect(isEnclosedWallMicrowaveCabinet({
      masterCode: "MW3030",
      placementType: "wall",
      numberOfDoors: 2,
      openingType: "bottom",
    })).toBe(true);
    expect(isEnclosedWallMicrowaveCabinet({
      masterCode: "WMS3018",
      placementType: "wall",
      numberOfDoors: 0,
      openingType: "bottom",
    })).toBe(false);
    expect(isEnclosedWallMicrowaveCabinet({
      masterCode: "MW-30",
      placementType: "appliance",
      numberOfDoors: 0,
      openingType: "bottom",
    })).toBe(false);
    expect(isEnclosedWallMicrowaveCabinet({
      masterCode: "MO3030",
      placementType: "wall",
      numberOfDoors: 2,
      openingType: "bottom",
    })).toBe(false);
  });

  it("normalizes legacy range and refrigerator base records into appliance meshes so the saved cooktop and fridge face cannot disappear", () => {
    const range = existingCabinetSku({
      uid: "legacy-range", cabinetId: 30, masterCode: "RANGE-30", description: "30 inch Range",
      placement: "base", x: 36, y: 0, width: 30, depth: 25, height: 36, rotation: 0,
    } as never);
    const fridge = existingCabinetSku({
      uid: "legacy-fridge", cabinetId: 31, masterCode: "FRIDGE-30", description: "30 inch Refrigerator",
      placement: "base", x: 72, y: 0, width: 30, depth: 24, height: 84, rotation: 0,
    } as never);
    expect(range.placementType).toBe("appliance");
    expect(fridge.placementType).toBe("appliance");

    const root = new THREE.Group();
    addCabinet(root, range, null, {}, 144, 120, "#8a9ba8", "#f8f8f6");
    addCabinet(root, fridge, null, {}, 144, 120, "#8a9ba8", "#f8f8f6");
    const cooktops: THREE.Object3D[] = [];
    const burners: THREE.Object3D[] = [];
    const refrigeratorDoors: THREE.Object3D[] = [];
    const refrigeratorFreezers: THREE.Object3D[] = [];
    const accidentalToeKicks: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.rangeCooktop) cooktops.push(node);
      if (node.userData.rangeBurner) burners.push(node);
      if (node.userData.applianceCode === "FRIDGE-30" && node.userData.refrigeratorDoor) refrigeratorDoors.push(node);
      if (node.userData.applianceCode === "FRIDGE-30" && node.userData.refrigeratorFreezer) refrigeratorFreezers.push(node);
      if (node.userData.baseToeKick) accidentalToeKicks.push(node);
    });
    expect(cooktops).toHaveLength(1);
    expect(burners).toHaveLength(4);
    expect(refrigeratorDoors).toHaveLength(2);
    expect(refrigeratorDoors.map((door) => door.userData.refrigeratorDoor).sort()).toEqual(["left", "right"]);
    expect(refrigeratorFreezers).toHaveLength(1);
    expect(accidentalToeKicks).toHaveLength(0);
  });

  it("keeps the refrigerator side and top shell neutral gray instead of inheriting the selected cabinet finish", () => {
    const root = new THREE.Group();
    const selectedCabinetFinish = "#d2aa56";
    addCabinet(root, {
      distributorSkuId: 0,
      cabinetId: 0,
      masterCode: "FRIDGE-36",
      description: 'Refrigerator 36"',
      placementType: "appliance",
      width: 36,
      height: 70,
      depth: 30,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    } as never, "back", {}, 144, 120, selectedCabinetFinish, "#f8f8f6");

    const shells: THREE.Mesh[] = [];
    const doors: THREE.Mesh[] = [];
    root.traverse((node) => {
      if (node instanceof THREE.Mesh && node.userData.refrigeratorNeutralShell) shells.push(node);
      if (node instanceof THREE.Mesh && node.userData.refrigeratorDoor) doors.push(node);
    });
    expect(shells).toHaveLength(1);
    const shellMaterial = shells[0]!.material as THREE.MeshStandardMaterial;
    expect(shellMaterial.color.getHexString()).toBe("5f666d");
    expect(shellMaterial.color.getHexString()).not.toBe(selectedCabinetFinish.slice(1));
    expect(shellMaterial.metalness).toBeCloseTo(0.58, 6);
    expect(shells[0]!.userData.neutralApplianceSidesAndTop).toBe(true);
    expect(doors).toHaveLength(2);
    expect((doors[0]!.material as THREE.MeshStandardMaterial).color.getHexString()).not.toBe(selectedCabinetFinish.slice(1));
  });

  it("preserves catalog envelopes for refrigerator, range, hood, microwave, dishwasher, and wine appliances", () => {
    const fixtures = [
      { masterCode: "FRIDGE-30", width: 30, height: 84, depth: 24, mountBottom: 0, rotation: 0 },
      { masterCode: "RANGE-30", width: 30, height: 36, depth: 25, mountBottom: 0, rotation: 0 },
      { masterCode: "HOOD-30", width: 30, height: 18, depth: 18, mountBottom: 66, rotation: 0 },
      { masterCode: "MW-30", width: 30, height: 17, depth: 15, mountBottom: 54, rotation: 0 },
      { masterCode: "DW-24", width: 24, height: 34.5, depth: 24, mountBottom: 0, rotation: 0 },
      { masterCode: "WINE-24", width: 24, height: 34.5, depth: 24, mountBottom: 0, rotation: 0 },
    ] as const;
    for (const fixture of fixtures) {
      const root = new THREE.Group();
      addCabinet(root, {
        distributorSkuId: -87,
        cabinetId: 87,
        description: fixture.masterCode,
        placementType: "appliance",
        x: 0,
        y: 0,
        ...fixture,
        numberOfDoors: 0,
        numberOfDrawers: 0,
      } as never, null, {}, 144, 120, "#8a9ba8", "#f8f8f6");
      const applianceRoot = root.children[0]!;
      expect(applianceRoot.userData.catalogApplianceEnvelope).toMatchObject({
        widthIn: fixture.width,
        heightIn: fixture.height,
        depthIn: fixture.depth,
        mountBottomIn: fixture.mountBottom,
        rotation: fixture.rotation,
      });
    }
  });

  it("centers the active saved hood on its range and suppresses the overlapping microwave placeholder", () => {
    const range = {
      uid: "active-range", cabinetId: 0, masterCode: "RANGE-30", description: 'Range / Stove 30"',
      placement: "appliance", width: 30, height: 36, depth: 25, rotation: 90, x: 0, y: 45,
    } as never;
    const hood = {
      uid: "active-hood", cabinetId: 0, masterCode: "HOOD-30", description: 'Range Hood 30"',
      placement: "appliance", width: 30, height: 18, depth: 18, rotation: 90, x: 3.5, y: 45, mountBottom: 66,
    } as never;
    const microwave = {
      uid: "legacy-over-range-microwave", cabinetId: 0, masterCode: "MW-30", description: 'Over-Range Microwave 30"',
      placement: "appliance", width: 30, height: 17, depth: 15, rotation: 90, x: 0, y: 45, mountBottom: 54,
    } as never;
    const room = { width: 144, depth: 145, ceilingHeight: 96 } as never;
    const hoodTransform = savedRangeHoodTransform(hood, [range, hood, microwave], room);
    const manuallyMovedHood = { ...hood, y: 75, rangeHoodPositionAdjusted: true } as never;
    const manualTransform = savedRangeHoodTransform(manuallyMovedHood, [range, manuallyMovedHood, microwave], room);
    const rangeTransform = existingCabinetTransform(range, room);

    expect(hoodTransform.z).toBeCloseTo(rangeTransform.z, 12);
    expect(manualTransform.z).toBeCloseTo(existingCabinetTransform(manuallyMovedHood, room).z, 12);
    expect(manualTransform.z).not.toBeCloseTo(rangeTransform.z, 12);
    expect(shouldRenderSavedSceneCabinet(range, [range, hood, microwave])).toBe(true);
    expect(shouldRenderSavedSceneCabinet(hood, [range, hood, microwave])).toBe(true);
    expect(shouldRenderSavedSceneCabinet(microwave, [range, hood, microwave])).toBe(false);
  });

  it("keeps a neighboring base cabinet visible when a refrigerator is added to the saved 3D scene", () => {
    const base = {
      uid: "left-base", cabinetId: 1, masterCode: "B-24", description: "Base cabinet",
      placement: "base", width: 24, height: 34.5, depth: 24, rotation: 0, x: 0, y: 0,
    } as never;
    const fridge = {
      uid: "fridge", cabinetId: 2, masterCode: "FRIDGE-36", description: "Refrigerator",
      placement: "appliance", width: 36, height: 70, depth: 36, rotation: 0, x: 24, y: 0,
    } as never;
    expect(shouldRenderSavedSceneCabinet(base, [base, fridge])).toBe(true);
    expect(shouldRenderSavedSceneCabinet(fridge, [base, fridge])).toBe(true);
  });

  it("keeps opposing 24-inch island faces on their saved back-to-back depth planes instead of applying a legacy room-wall anchor", () => {
    const room = { width: 144, depth: 144, ceilingHeight: 96 } as never;
    const front = {
      uid: "island-front-b24", cabinetId: 1, masterCode: "B-24", description: "Base cabinet",
      placement: "base", width: 24, height: 34.5, depth: 24, rotation: 0, x: 48, y: 72,
      islandFace: "front", islandOffset: 0,
    } as never;
    const back = {
      uid: "island-back-db24", cabinetId: 2, masterCode: "2-DB24", description: "Two drawer base",
      placement: "base", width: 24, height: 34.5, depth: 24, rotation: 180, x: 48, y: 48,
      islandFace: "back", islandOffset: 0,
    } as never;

    expect(existingCabinetTransform(front, room)).toMatchObject({ x: 60, z: 84 });
    expect(existingCabinetTransform(back, room)).toMatchObject({ x: 60, z: 60 });
    expect(existingCabinetTransform(front, room).z - existingCabinetTransform(back, room).z).toBeCloseTo(24, 12);
  });

  it("reconstructs design 8190001's persisted base run, range, hood, and refrigerator without generic fallbacks", () => {
    const room = { width: 144, depth: 145, ceilingHeight: 96 } as never;
    const placed = [
      { uid: "active-range", cabinetId: 0, masterCode: "RANGE-30", description: 'Range / Stove 30"', placement: "appliance", width: 30, height: 36, depth: 25, rotation: 90, x: 0, y: 45 },
      { uid: "active-hood", cabinetId: 0, masterCode: "HOOD-30", description: 'Range Hood 30"', placement: "appliance", width: 30, height: 18, depth: 18, rotation: 90, x: 3.5, y: 45, mountBottom: 66 },
      { uid: "active-fridge", cabinetId: 0, masterCode: "FRIDGE-36", description: 'Refrigerator 36"', placement: "appliance", width: 36, height: 72, depth: 30, rotation: 90, x: 0.75, y: 108 },
      { uid: "cdb36", cabinetId: 0, masterCode: "CDB36", description: "Corner Drawer Base", placement: "base", width: 36, height: 34.5, depth: 36, rotation: 0, x: 36, y: 0 },
      { uid: "db18", cabinetId: 0, masterCode: "DB-18-3", description: "Drawer Base", placement: "base", width: 18, height: 34.5, depth: 24, rotation: 0, x: 72, y: 0 },
      { uid: "sb36", cabinetId: 0, masterCode: "SB-36", description: "Sink Base", placement: "base", width: 36, height: 34.5, depth: 24, rotation: 0, x: 90, y: 0 },
      { uid: "db30", cabinetId: 0, masterCode: "DB-30-3", description: "Drawer Base", placement: "base", width: 30, height: 34.5, depth: 24, rotation: 0, x: 0, y: 84 },
      { uid: "b33", cabinetId: 0, masterCode: "B-33", description: "Base Cabinet", placement: "base", width: 33, height: 34.5, depth: 24, rotation: 0, x: 30, y: 84 },
    ] as never[];
    const root = new THREE.Group();
    for (const record of placed) {
      const sku = existingCabinetSku(record);
      addCabinet(root, sku, null, {}, room.width, room.depth, "#8a9ba8", "#f8f8f6", undefined, existingCabinetTransform(record, room));
    }
    const toeKicks: THREE.Object3D[] = [];
    const applianceRoots: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.baseToeKick) toeKicks.push(node);
      if (node.userData.catalogApplianceEnvelope) applianceRoots.push(node);
    });
    // CDB36 is an L-corner: two recessed leg kicks meet at one clean
    // inside-corner seam instead of using a protruding square return.
    // The five base cabinets therefore produce six toe-kick meshes.
    expect(toeKicks).toHaveLength(6);
    expect(applianceRoots).toHaveLength(3);
    expect(applianceRoots.map((node) => node.userData.masterCode)).toEqual(expect.arrayContaining(["RANGE-30", "HOOD-30", "FRIDGE-36"]));
    expect(applianceRoots.find((node) => node.userData.masterCode === "HOOD-30")!.userData.catalogApplianceEnvelope.mountBottomIn).toBe(66);
  });

  it("renders refrigerator enclosure panels as plain finished skins with no cabinet hardware", () => {
    const root = new THREE.Group();
    const panelSku = {
      distributorSkuId: 0,
      masterCode: "REPV-96",
      description: 'Refrigerator End Panel 96"H',
      placementType: "tall",
      width: 0.75,
      depth: 27,
      height: 96,
      numberOfDoors: 0,
      numberOfDrawers: 0,
      customProfile: "refrigerator-end-panel",
    } as const;
    addCabinet(root, panelSku, "back", {}, 144, 120, "#4f5549", "#ffffff", undefined, { x: 30, z: 0, rotation: 0, bottom: 0 });
    addCabinet(root, panelSku, "back", {}, 144, 120, "#4f5549", "#ffffff", undefined, { x: 66.75, z: 0, rotation: 0, bottom: 0 });
    const items: THREE.Object3D[] = [];
    root.traverse((item) => items.push(item));
    expect(items.filter((item) => item.userData?.refrigeratorEndPanel)).toHaveLength(2);
    expect(items.some((item) => item.userData?.cabinetHardware)).toBe(false);
  });

  it("renders WD1860 at the 36-inch countertop line with one upper door and two lower drawer meshes", () => {
    const root = new THREE.Group();
    addCabinet(root, {
      distributorSkuId: 9360145,
      cabinetId: 9360145,
      masterCode: "WD1860",
      description: '18" Single Door Wall Cabinet with 3 Adjustable Shelves and 2 drawers',
      placementType: "wall",
      width: 18,
      height: 60,
      depth: 12,
      // Some legacy supplier rows persisted zeroes even though WD18 family
      // identity authoritatively defines one upper door and two bottom drawers.
      numberOfDoors: 0,
      numberOfDrawers: 0,
    }, "back", {}, 144, 120, "#8a9ba8", "#f8f8f6");

    const upperDoors: THREE.Object3D[] = [];
    const bottomDrawers: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.wd18UpperDoor) upperDoors.push(node);
      if (node.userData.wd18BottomDrawer) bottomDrawers.push(node);
    });
    expect(upperDoors).toHaveLength(1);
    expect(bottomDrawers).toHaveLength(2);
    expect(upperDoors[0]!.position.y).toBeGreaterThan(Math.max(...bottomDrawers.map((drawer) => drawer.position.y)));
    const cabinetRoot = root.children.find((child) => {
      let ownsWd18Door = false;
      child.traverse((node) => { if (node.userData.wd18UpperDoor) ownsWd18Door = true; });
      return ownsWd18Door;
    });
    expect(cabinetRoot?.position.y).toBeCloseTo((36 + 30) / 12, 5);
  });

  it("enforces the admin panel door sample as the sole authoritative face texture over Cabinet Config line-art", () => {
    // The threeDCabinetFrontVisualUrl helper resolves a catalog front visual URL.
    // When a door sample URL exists (from door_styles.doorSampleImageUrl), the
    // catalog front visual must NOT be used as a face overlay. The addCabinet
    // function guards this with: `!doorSampleUrl` in the condition.
    //
    // Test the helper contract:
    const baseCabWithLineArt = { masterCode: "B24", placementType: "base", catalogImageUrl: "/manus-storage/ls3612-line-art.png" };
    const applianceWithImage = { masterCode: "RANGE30", placementType: "appliance", catalogImageUrl: "/manus-storage/range.webp" };
    const baseCabNoImage = { masterCode: "B24", placementType: "base", catalogImageUrl: null };
    const becWithWrongImage = { masterCode: "BEC24", placementType: "base", catalogImageUrl: "/manus-storage/bec-quarter-octagon.png" };

    // The helper resolves a URL for base cabinets with a catalogImageUrl
    expect(threeDCabinetFrontVisualUrl(baseCabWithLineArt)).toBe("/manus-storage/ls3612-line-art.png");
    // But appliances never get a front visual overlay
    expect(threeDCabinetFrontVisualUrl(applianceWithImage)).toBeNull();
    // And cabinets without a catalogImageUrl get null
    expect(threeDCabinetFrontVisualUrl(baseCabNoImage)).toBeNull();
    // The wrong BEC24 quarter-octagon image must not cover its square two-door mesh.
    expect(threeDCabinetFrontVisualUrl(becWithWrongImage)).toBeNull();

    // The door sample texture helpers confirm the door sample takes priority:
    expect(threeDUsesDoorSampleTexture("/manus-storage/natura-maple-door-sample.png")).toBe(true);
    expect(threeDUsesExactDoorSampleMaterial(true)).toBe(true);
    // When a door sample exists, the face material is MeshBasicMaterial with #ffffff (no tinting)
    expect(threeDFaceMaterialColor("#8a9ba8", true)).toBe("#ffffff");

    // The addCabinet guard at line 1254 is:
    //   if (catalogFrontVisualUrl && !doorSampleUrl && !doorTexture && ...)
    // This means: when doorSampleUrl is provided, catalogFrontVisualUrl is NEVER applied.
    // When doorSampleUrl is null, catalogFrontVisualUrl IS applied (if it exists).
    // This is the correct behavior: admin panel door sample > Cabinet Config line-art.

    // Verify the resolvedPlacedCabinetFrontVisual helper still works for live propagation
    expect(resolvedPlacedCabinetFrontVisual(
      { uid: "cab-1" } as any,
      { "cab-1": "/manus-storage/live-catalog-image.png" },
      null,
    )).toBe("/manus-storage/live-catalog-image.png");

    // But the resolved URL is only used as sku.catalogImageUrl — it only becomes
    // a visible overlay when doorSampleUrl is absent (the guard in addCabinet).
  });
});

describe("final high-resolution preview controls", () => {
	  it("requires a reviewed immutable reference, packages customer requests for manual AI review, and exposes a bounded administrator-only path-tracing test", () => {
    const source = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(source).toContain('data-testid="three-d-photo-render"');
	  expect(source).toContain('>Final preview</Button>');
	  expect(source).toContain('title="High-resolution exact 3D preview"');
	  expect(source).toContain('data-testid="photo-quality-admin-test"');
	  expect(source).toContain('data-testid="photo-quality-contact-lead"');
	  expect(source).toContain("Mobile-number verification protects the exact saved plan and confirmed follow-up information.");
	  expect(source).toContain("Request your photo-quality kitchen image");
    expect(source).toContain("threeDExactPlanGeometryLock");
    expect(source).toContain("const capturePhotoRenderReference = (): string | null");
    expect(source).toContain("renderer.setSize(2560, 1440, false)");
    expect(source).toContain('renderer.domElement.toDataURL("image/jpeg", 0.98)');
    expect(source).toContain("renderer.capabilities.getMaxAnisotropy()");
    expect(source).toContain("renderer.render(threeScene, camera);");
    expect(source).toContain("const hashCaptureBytes = async (dataUrl: string)");
    expect(source).toContain("Uint8Array.from(atob(base64)");
    expect(source).toContain("const [photoRenderDraft, setPhotoRenderDraft]");
    expect(source).toContain("sourceImageHash");
    expect(source).toContain('generationMethod: "manual-final-review-deterministic-webgl-v1"');
    expect(source).toContain("const approvedMaterialUrl = (value: string | null | undefined) =>");
    expect(source).toContain('value.startsWith("/manus-storage/")');
    expect(source).toContain('"https://www.cabinetdealz.com"');
    expect(source).toContain("sceneImageDataUrl: photoRenderDraft.sceneImageDataUrl");
    expect(source).toContain("provenance: photoRenderDraft.provenance");
    expect(source).toContain("if (!photoRenderDraft)");
    expect(source).toContain("if ((!savedDesignId || !isCurrentPlanSaved) && !isPhotoQualityTest)");
    expect(source).toContain("designId: savedDesignId ?? 0");
    expect(source).toContain("Finish the current placement preview before creating a high-resolution 3D preview.");
    expect(source).toContain("Save this design before creating a high-resolution 3D preview");
    expect(source).toContain("confirmation: true");
	    expect(source).toContain("Send plan to render team");
	    expect(source).toContain("Your exact plan is protected before a photo-quality image is made.");
    expect(source).toContain("Your kitchen image request was received.");
    expect(source).toContain("Retry same locked view");
    expect(source).toContain("Your editable Designer plan is unchanged.");
    expect(source).toContain("Reused from the same saved plan, materials, and camera");
    expect(source).toContain("Locked Designer reference");
    expect(source).toContain("High-resolution 3D preview");
	    expect(source).toContain("This image intentionally remains the same locked Designer scene, camera, and loaded product materials at higher resolution.");
	    expect(source).toContain("onPhotoRender={openPhotoRenderDialog}");
	    expect(source).toContain("Locked Designer view to render");
	    expect(source).toContain('data-testid="photo-quality-selected-door-input"');
	    expect(source).toContain('data-testid="photo-quality-door-reference-status"');
	    expect(source).toContain('data-testid="photo-quality-room-scene-not-applied"');
	    expect(source).toContain('data-testid="photo-quality-mobile-scroll-dialog"');
	    expect(source).toContain('data-testid="photo-quality-mobile-scroll-content"');
	    expect(source).toContain('data-testid="photo-quality-mobile-action-footer"');
	    expect(source).toContain("max-h-[calc(100dvh-1rem)]");
	    expect(source).toContain("overflow-y-auto overscroll-contain");
	    expect(source).toContain("safe-area-inset-bottom");
	    expect(source).toContain("This exact 3D preview does not use it to change lighting, cabinet materials, camera, or any kitchen object.");
	    expect(source).toContain("Exact 3D capture—not photo quality.");
	    expect(source).toContain("if (!photoRenderDoorReference.ready)");
	    expect(source).toContain('data-testid="path-trace-production-test"');
	    expect(source).toContain('data-testid="path-trace-production-result"');
    expect(source).toContain('data-testid="gemini-image-test"');
	    expect(source).toContain('data-testid="gemini-image-test-blocking-reason"');
	    expect(source).toContain("if (!photoRenderDoorReference.ready)");
	    expect(source).toContain("Open Final preview to prepare the locked saved-plan image for Google.");
	    expect(source).not.toContain("Save this kitchen plan, then reopen Final preview before running the Google test.");
	    expect(source).toContain("The earlier Google image test expired before it completed. You can start a new test.");
	    expect(source).toContain("new Date(job.startedAt)");
	    expect(source).toContain("restartPending: Boolean(geminiImageTestJobId)");
	    expect(source).toContain('disabled={startGeminiImageTestMutation.isPending || geminiCooldownActive}');
    expect(source).toContain("Start fresh Google image test");
    expect(source).toContain("saveCurrentPlanForGoogleTest");
    expect(source).toContain("Save current plan and refresh");
    expect(source).toContain("no phone verification is required for this administrator test");
    expect(source).toContain("Close preview");
    expect(source).toContain("const administratorSnapshot = isPhotoQualityTest && !isCurrentPlanSaved");
    expect(source).toContain("designId: administratorSnapshot ? 0 : savedDesignId ?? 0");
    expect(source).toContain("locked current-design snapshot");
	    expect(source).toContain("const compactGoogleImageTestInput");
	    expect(source).toContain('canvas.width = 1920');
	    expect(source).toContain('canvas.height = 1080');
	    expect(source).toContain("const GOOGLE_IMAGE_TEST_MAX_DATA_URL_CHARS = 650_000");
	    expect(source).toContain("for (const quality of [0.68, 0.58, 0.48, 0.38, 0.3])");
	    expect(source).toContain("compact.length <= GOOGLE_IMAGE_TEST_MAX_DATA_URL_CHARS");
	    expect(source).toContain("sceneImageDataUrl: googleImageInput");
    expect(source).toContain("The Google test request could not reach the server. Please refresh once and try again.");
    expect(source).toContain("const [geminiRateLimitUntil, setGeminiRateLimitUntil]");
	    expect(source).toContain("Google is rate-limited. Safe retry available in ${geminiCooldownLabel}.");
    expect(source).toContain("const geminiAutomaticRetrySeconds = Math.max(geminiQueuedRetrySeconds, geminiCooldownSeconds)");
    expect(source).toContain("Google will retry this image test automatically in ${geminiAutomaticRetryLabel}.");
	    expect(source).toContain("geminiImageTestJobQuery.data.nextRetryAt");
	    expect(source).toContain("setGeminiImageTest({ referenceUrl: photoRenderReferenceUrl, imageUrl: result.imageUrl })");
	    expect(source).toContain("disabled={startGeminiImageTestMutation.isPending || geminiCooldownActive}");
    expect(source).toContain("Try Google again in ${geminiCooldownLabel}");
	    expect(source).toContain('data-testid="gemini-image-test-result"');
	    expect(source).toContain('data-testid="open-saved-gemini-image-test"');
	    expect(source).toContain('data-testid="completed-gemini-image-test"');
	    expect(source).toContain('data-testid="open-completed-gemini-image-test"');
	    expect(source).toContain("const openCompletedGeminiImageTest = () =>");
	    expect(source).toContain("getGeminiImageTestJob.useQuery(");
    expect(source).toContain("{ enabled: canUseGeminiImageTest }");
	    expect(source).toContain('job?.status === "completed" && job.imageUrl');
	    expect(source).toContain("const startGeminiImageTest = async () =>");
    expect(source).toContain("const openSavedGeminiImageTest = () =>");
    expect(source).toContain("trpc.designPhotoRenders.startGeminiImageTest.useMutation()");
    expect(source).toContain("trpc.designPhotoRenders.pollGeminiImageTest.useMutation()");
    expect(source).toContain("trpc.designPhotoRenders.getGeminiImageTestJob.useQuery(");
    expect(source).toContain("window.setInterval(() => { void check(); }, 5_000)");
    expect(source).toContain("trpc.designPhotoRenders.getSavedGeminiImageTest.useQuery(");
    expect(source).toContain("getSavedGeminiImageTest.invalidate");
	    expect(source).toContain("getGeminiImageTestJob.invalidate");
		    expect(source).toContain("Reopen the illustrative result saved for this exact plan revision");
		    expect(source).toContain("Google/Gemini image test — locked plan");
		    expect(source).not.toContain("photoRenderDraft.provenance.designId <= 0");
		    expect(source).toContain("WebGLPathTracer");
	    expect(source).toContain("THREE_D_PATH_TRACE_PREVIEW");
	    expect(source).toContain("width: 1920");
	    expect(source).toContain("height: 1080");
	    expect(source).toContain("samples: 256");
	    expect(source).toContain("DenoiseMaterial");
	    expect(source).toContain("pathTracer.renderToCanvas = false");
	    expect(source).toContain("conservative final denoise pass");
	    expect(source).toContain("Open HD image");
	    expect(source).toContain("pathTracer.setScene(pathTraceScene, pathTraceCamera)");
	    expect(source).toContain("pathTracer.renderSample()");
	    expect(source).toContain("if (!isPhotoQualityTest) return;");
	    expect(source).toContain("does not use AI or the room-scene picture");
	  });

	  it("never captures a generic fallback while an active selected door sample is loading or has failed", () => {
	    expect(threeDPhotoRenderDoorReferenceStatus("/manus-storage/door-sample.webp", "loading")).toMatchObject({ ready: false });
	    expect(threeDPhotoRenderDoorReferenceStatus("/manus-storage/door-sample.webp", "failed")).toMatchObject({ ready: false });
	    expect(threeDPhotoRenderDoorReferenceStatus("/manus-storage/door-sample.webp", "loaded")).toMatchObject({ ready: true });
	    expect(threeDPhotoRenderDoorReferenceStatus(null, "not-requested")).toMatchObject({ ready: true });
	  });

	  it("keeps a customer-ready image visible for the current saved plan with a direct popup action", () => {
	    const source = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
	    expect(source).toContain("getLatestCustomerReadyImage.useQuery(");
	    expect(source).toContain("{ designId: savedDesignId ?? 0 }");
	    expect(source).toContain('data-testid="customer-image-ready-notice"');
	    expect(source).toContain("Your kitchen image is ready");
	    expect(source).toContain("Open image");
	    expect(source).toContain("setPhotoRenderUrl(latestCustomerReadyImageQuery.data!.imageUrl!)");
	    expect(source).toContain("will notify you in the Designer and by email");
	  });
});

import { describe, expect, it } from "vitest";
import {
  appendRefrigeratorEnclosurePlacements,
  cabinetWallDragPreview,
  cabinetWallMovePreview,
  commitConfiguredRefrigeratorCandidate,
  normalizeRefrigeratorBayUppers,
  refrigeratorMagneticSnapEnvelope,
  refrigeratorBayRunMetrics,
  refrigeratorBayVerificationMetrics,
  type PlacedCabinet,
  type RoomData,
  wallPlacementAt,
} from "./design";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

function item(overrides: Partial<PlacedCabinet>): PlacedCabinet {
  return {
    uid: "item",
    cabinetId: 1,
    masterCode: "B24",
    description: "Cabinet",
    placement: "base",
    x: 0,
    y: 0,
    width: 24,
    depth: 24,
    height: 34.5,
    rotation: 0,
    ...overrides,
  };
}

function selectedParts() {
  const fridge = item({
    uid: "fridge", masterCode: "FRIDGE-36", placement: "appliance",
    x: 24, width: 36, depth: 30, height: 70,
    refrigeratorPanelMode: "both", refrigeratorOptionsChosen: true,
  });
  const left = item({
    uid: "left", masterCode: "REPV2496", placement: "tall", x: 22.75,
    width: 0.75, depth: 24, height: 84, customProfile: "refrigerator-end-panel",
    refrigeratorAssemblyId: fridge.uid, refrigeratorAssemblyRole: "left-panel",
  });
  const right = item({
    uid: "right", masterCode: "REPV2496", placement: "tall", x: 60.5,
    width: 0.75, depth: 24, height: 84, customProfile: "refrigerator-end-panel",
    refrigeratorAssemblyId: fridge.uid, refrigeratorAssemblyRole: "right-panel",
  });
  const cap = item({
    uid: "cap", masterCode: "WR3612", placement: "wall", x: 24,
    width: 36, depth: 24, height: 12, mountBottom: 72,
    refrigeratorAssemblyId: fridge.uid, refrigeratorAssemblyRole: "bridge",
  });
  return { fridge, left, right, cap };
}

describe("independent refrigerator catalog parts", () => {
  it("uses the source refrigerator width plus half-inch clearance at both panel sides", () => {
    const { fridge } = selectedParts();
    expect(refrigeratorBayRunMetrics(fridge, room)).toMatchObject({
      refrigeratorWidth: 36,
      openingWidth: 37,
      refrigeratorCenter: 42,
      openingStart: 23.5,
      openingEnd: 60.5,
    });
  });

  it("reports exact source-part measurements without changing their positions", () => {
    const { fridge, left, right, cap } = selectedParts();
    expect(refrigeratorBayVerificationMetrics([fridge, left, right, cap], fridge, room)).toEqual({
      refrigeratorWidth: 36,
      openingWidth: 37,
      leftGap: 0.5,
      rightGap: 0.5,
      bridgeCenterOffset: 0,
      hasLeftPanel: true,
      hasRightPanel: true,
    });
  });

  it("does not infer, create, resize, or reposition parts while normalizing a saved design", () => {
    const { fridge, left, cap } = selectedParts();
    const ordinaryUpper = item({ uid: "ordinary", masterCode: "W3030", placement: "wall", x: 80, width: 30, height: 30, mountBottom: 54 });
    const saved = [fridge, left, cap, ordinaryUpper];
    expect(normalizeRefrigeratorBayUppers(saved, room)).toBe(saved);
    expect(normalizeRefrigeratorBayUppers(saved, room)).toEqual(saved);
  });

  it("moves only the refrigerator and source parts explicitly selected in its own options", () => {
    const { fridge, left, right, cap } = selectedParts();
    const leftFiller = item({
      uid: "left-filler", masterCode: "F342", placement: "wall", x: 23.5,
      width: 0.5, depth: 24, height: 12, mountBottom: 72,
      refrigeratorAssemblyId: fridge.uid, refrigeratorAssemblyRole: "bridge-left-filler",
    });
    const ordinaryWallCabinet = item({ uid: "ordinary", masterCode: "W3030", placement: "wall", x: 96, width: 30, height: 30, mountBottom: 54 });
    const moved = { ...fridge, x: 48, wallOffset: 48 };
    const result = commitConfiguredRefrigeratorCandidate(
      [fridge, left, right, cap, leftFiller, ordinaryWallCabinet],
      fridge.uid,
      moved,
      room,
    );
    expect(result).not.toBeNull();
    expect(result!.find((part) => part.uid === fridge.uid)?.x).toBe(48);
    expect(result!.find((part) => part.uid === left.uid)?.x).toBe(46.75);
    expect(result!.find((part) => part.uid === right.uid)?.x).toBe(84.5);
    expect(result!.find((part) => part.uid === cap.uid)?.x).toBe(48);
    expect(result!.find((part) => part.uid === leftFiller.uid)?.x).toBe(47.5);
    expect(result!.find((part) => part.uid === ordinaryWallCabinet.uid)).toBe(ordinaryWallCabinet);
  });

  it("moves an explicitly linked legacy refrigerator assembly and restores its durable roles", () => {
    const { fridge, left, right, cap } = selectedParts();
    const legacyMembers = [left, right, cap].map(({ refrigeratorAssemblyRole: _role, ...member }) => member);
    const result = commitConfiguredRefrigeratorCandidate(
      [fridge, ...legacyMembers],
      fridge.uid,
      { ...fridge, x: 48, wallOffset: 48 },
      room,
    );

    expect(result).not.toBeNull();
    expect(result!.find((part) => part.uid === left.uid)).toMatchObject({
      x: 46.75,
      refrigeratorAssemblyId: fridge.uid,
      refrigeratorAssemblyRole: "left-panel",
    });
    expect(result!.find((part) => part.uid === right.uid)).toMatchObject({
      x: 84.5,
      refrigeratorAssemblyRole: "right-panel",
    });
    expect(result!.find((part) => part.uid === cap.uid)).toMatchObject({
      x: 48,
      refrigeratorAssemblyRole: "bridge",
    });
  });

  it.each([
    {
      label: "a standard wall",
      room,
      wallId: "bottom",
    },
    {
      label: "a 45-degree Wall Builder wall",
      room: {
        width: 220,
        depth: 220,
        ceilingHeight: 96,
        openWallPath: true,
        vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 144 * Math.SQRT1_2, y: 144 * Math.SQRT1_2 }],
        customWalls: [{ id: "drawn-45", startVertexId: "a", endVertexId: "b", lockedAngle: 45 }],
      } satisfies RoomData,
      wallId: "drawn-45",
    },
  ])("magnetically butts a refrigerator's selected left end panel to a B36 on $label", ({ room: runRoom, wallId }) => {
    const baseSpot = wallPlacementAt(0, 36, 24, wallId as any, runRoom);
    const base = item({
      uid: "b36", masterCode: "B36", description: "36 inch base cabinet", placement: "base",
      ...baseSpot, width: 36, depth: 24, wallId, wallOffset: 0,
    });
    const fridgeSpot = wallPlacementAt(40, 36, 30, wallId as any, runRoom);
    const fridge = item({
      uid: "snap-fridge", masterCode: "FRIDGE-36", description: "36 inch refrigerator", placement: "appliance",
      ...fridgeSpot, width: 36, depth: 30, height: 70, wallId, wallOffset: 40,
      refrigeratorPanelMode: "left", refrigeratorOptionsChosen: true,
    });
    // Panel is source-sized at 3/4 in and keeps the required 1/2 in appliance
    // clearance before the refrigerator.  Its exposed face is the snap edge.
    const leftPanelSpot = wallPlacementAt(38.75, 0.75, 24, wallId as any, runRoom);
    const leftPanel = item({
      uid: "snap-left-panel", masterCode: "REP2496", description: "Refrigerator end panel", placement: "tall",
      ...leftPanelSpot, width: 0.75, depth: 24, height: 96, wallId, wallOffset: 38.75,
      customProfile: "refrigerator-end-panel", refrigeratorAssemblyId: fridge.uid, refrigeratorAssemblyRole: "left-panel",
    });
    const requested = wallPlacementAt(39.5, 36, 30, wallId as any, runRoom);
    const preview = cabinetWallMovePreview(
      fridge,
      { x: requested.x, y: requested.y },
      runRoom,
      [base],
      [],
      {
        magnet: true,
        wallId,
        seamToleranceIn: 6,
        magneticEnvelope: refrigeratorMagneticSnapEnvelope(fridge, [base, fridge, leftPanel], runRoom),
      },
    );

    expect(preview.failure).toBeNull();
    // B36 ends at 36. The physical selected panel starts there; refrigerator
    // itself starts 1.25 in later (3/4 panel + 1/2 appliance clearance).
    expect(preview.candidate?.wallOffset).toBe(37.25);
    expect(preview.candidate?.wallOffset).not.toBe(36);

    const threeDPreview = cabinetWallDragPreview(
      fridge,
      runRoom,
      [base, fridge, leftPanel],
      [],
      57.5,
    );
    expect(threeDPreview?.candidate?.wallOffset).toBe(37.25);
    expect(threeDPreview?.snapped).toBe(true);
  });

  it("rejects an explicitly selected end panel that extends beyond a drawn wall without moving the refrigerator", () => {
    const short45: RoomData = {
      width: 220,
      depth: 220,
      ceilingHeight: 96,
      openWallPath: true,
      vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 72 * Math.SQRT1_2, y: 72 * Math.SQRT1_2 }],
      customWalls: [{ id: "short45", startVertexId: "a", endVertexId: "b", lockedAngle: 45 }],
    };
    const fridge = item({
      uid: "short-fridge", masterCode: "FRIDGE-36", placement: "appliance",
      width: 36, depth: 30, height: 70, wallOffset: 36,
      ...wallPlacementAt(36, 36, 30, "short45", short45),
    });
    const right = item({
      uid: "short-right", masterCode: "REPV3096", placement: "tall",
      width: 0.75, depth: 24, height: 84, customProfile: "refrigerator-end-panel",
      refrigeratorAssemblyId: fridge.uid, refrigeratorAssemblyRole: "right-panel",
      // Deliberately request a span past 72 in; the shared append path rejects it.
      ...wallPlacementAt(71.25, 0.75, 24, "short45", short45), wallOffset: 72,
    });
    const result = appendRefrigeratorEnclosurePlacements([fridge], [right], fridge.uid, short45);
    expect(result.placed).toEqual([fridge]);
    expect(result.rejected).toEqual([right]);
    expect(result.placed[0].wallOffset).toBe(36);
  });
});

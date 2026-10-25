// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GUIDED_ROOM_WORKFLOW_STEPS, guidedRoomWorkflowStepState, numberedLayoutTile, RoomLayoutStarter, roomFromSeededShape, type SeededLayout } from "./RoomLayoutStarter";

const usePresetsQuery = vi.fn();
const useEligibleCatalogQuery = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    roomLayouts: {
      presets: { useQuery: (...args: unknown[]) => usePresetsQuery(...args) },
      eligibleCatalog: { useQuery: (...args: unknown[]) => useEligibleCatalogQuery(...args) },
    },
  },
}));

afterEach(() => {
  cleanup();
  usePresetsQuery.mockReset();
  useEligibleCatalogQuery.mockReset();
});

describe("roomFromSeededShape", () => {
  it("keeps the seeded rectangle in the standard RoomData format", () => {
    const room = roomFromSeededShape({
      id: "rectangle",
      roomType: "kitchen",
      name: "Rectangle",
      description: null,
      geometryTemplate: { vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] },
      defaultDimensions: { width: 144, depth: 120, ceilingHeight: 96 },
    });
    expect(room).toMatchObject({ width: 144, depth: 120, ceilingHeight: 96 });
    expect(room.vertices).toBeUndefined();
  });

  it("turns a seeded L-shape template into a scaled editable polygon", () => {
    const room = roomFromSeededShape({
      id: "l_shape",
      roomType: "kitchen",
      name: "L-Shape",
      description: null,
      geometryTemplate: {
        vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 1 }],
        walls: ["back", "right", "inside-a", "inside-b", "left", "front"],
      },
      defaultDimensions: { width: 156, depth: 144, ceilingHeight: 96 },
    });
    expect(room.vertices).toHaveLength(6);
    expect(room.customWalls).toHaveLength(6);
    expect(room.vertices?.[2]).toMatchObject({ x: 156, y: 72 });
    expect(room.openWallPath).toBeUndefined();
  });

  it("keeps the guided flow in floorplan, layout, design, summary order", () => {
    expect(GUIDED_ROOM_WORKFLOW_STEPS.map(({ label }) => label)).toEqual(["Floorplan", "Pick a layout", "Design your kitchen", "Summary"]);
    expect(guidedRoomWorkflowStepState(3, 2)).toEqual({ active: false, complete: true });
    expect(guidedRoomWorkflowStepState(3, 3)).toEqual({ active: true, complete: false });
    expect(guidedRoomWorkflowStepState(3, 4)).toEqual({ active: false, complete: false });
  });

  it("gives real layouts stable one-based tile numbers", () => {
    const layouts: SeededLayout[] = [
      { id: "one-wall", roomShapePresetId: "rectangle", name: "One-Wall", description: null, minimumWidth: 96, minimumDepth: 96 },
      { id: "l-kitchen", roomShapePresetId: "rectangle", name: "L Kitchen", description: null, minimumWidth: 120, minimumDepth: 120 },
    ];
    expect(numberedLayoutTile(layouts, "one-wall")).toBe(1);
    expect(numberedLayoutTile(layouts, "l-kitchen")).toBe(2);
    expect(numberedLayoutTile(layouts, "missing")).toBeNull();
  });

  it("keeps beginner room shapes visible by default and reveals the Wall Builder only after choosing advanced mode", () => {
    usePresetsQuery.mockReturnValue({
      data: {
        roomShapes: [{
          id: "rectangle",
          name: "Rectangle",
          description: "A simple four-wall room.",
          roomType: "kitchen",
          geometryTemplate: {},
          defaultDimensions: { width: 144, depth: 120, ceilingHeight: 96 },
        }],
        layouts: [{
          id: "one-wall",
          roomShapePresetId: "rectangle",
          name: "One wall",
          description: "A beginner layout.",
          minimumWidth: 96,
          minimumDepth: 96,
        }],
      },
      isLoading: false,
      error: null,
    });
    useEligibleCatalogQuery.mockReturnValue({ data: undefined, isFetching: false });

    render(createElement(RoomLayoutStarter, {
      selectedStyleId: null,
      selectedDistributorId: null,
      onApplyRoom: vi.fn(),
      onApplyContinuousRoom: vi.fn(),
    }));

    expect(screen.getByText(/easy room shapes/i)).toBeTruthy();
    expect(screen.getByRole("switch", { name: /use advanced continuous walls/i }).getAttribute("data-state")).toBe("unchecked");
    expect(screen.getByText(/1\. pick a room shape/i)).toBeTruthy();
    expect(screen.queryByText(/build walls continuously/i)).toBeNull();

    fireEvent.click(screen.getByRole("switch", { name: /use advanced continuous walls/i }));

    expect(screen.getByRole("switch", { name: /use advanced continuous walls/i }).getAttribute("data-state")).toBe("checked");
    expect(screen.getByRole("button", { name: /open builder/i })).toBeTruthy();
    expect(screen.queryByText(/1\. pick a room shape/i)).toBeNull();
    expect(screen.queryByText(/apply room shape and continue/i)).toBeNull();
  });

  it("keeps the starter layouts available and shows a cheerful coming-soon notice when continuous walls are unavailable", () => {
    usePresetsQuery.mockReturnValue({
      data: {
        roomShapes: [{
          id: "rectangle",
          name: "Rectangle",
          description: "A simple four-wall room.",
          roomType: "kitchen",
          geometryTemplate: {},
          defaultDimensions: { width: 144, depth: 120, ceilingHeight: 96 },
        }],
        layouts: [{
          id: "one-wall",
          roomShapePresetId: "rectangle",
          name: "One wall",
          description: "A beginner layout.",
          minimumWidth: 96,
          minimumDepth: 96,
        }],
      },
      isLoading: false,
      error: null,
    });
    useEligibleCatalogQuery.mockReturnValue({ data: undefined, isFetching: false });

    render(createElement(RoomLayoutStarter, {
      selectedStyleId: null,
      selectedDistributorId: null,
      onApplyRoom: vi.fn(),
      continuousWallComingSoonMessage: "Continuous walls will be ready for this storefront soon.",
    }));

    expect(screen.getByText(/continuous walls are coming soon/i)).toBeTruthy();
    expect(screen.getByText(/will be ready for this storefront soon/i)).toBeTruthy();
    expect(screen.queryByRole("switch", { name: /use advanced continuous walls/i })).toBeNull();
    expect(screen.getByText(/1\. pick a room shape/i)).toBeTruthy();
    expect(screen.queryByText(/build walls continuously/i)).toBeNull();
  });

  it("signals that the first-cabinet guide should open after applying a beginner room", () => {
    usePresetsQuery.mockReturnValue({
      data: {
        roomShapes: [{
          id: "rectangle",
          name: "Rectangle",
          description: "A simple four-wall room.",
          roomType: "kitchen",
          geometryTemplate: {},
          defaultDimensions: { width: 144, depth: 120, ceilingHeight: 96 },
        }],
        layouts: [{
          id: "one-wall",
          roomShapePresetId: "rectangle",
          name: "One wall",
          description: "A beginner layout.",
          minimumWidth: 96,
          minimumDepth: 96,
        }],
      },
      isLoading: false,
      error: null,
    });
    useEligibleCatalogQuery.mockReturnValue({ data: undefined, isFetching: false });
    const onBeginnerRoomApplied = vi.fn();

    render(createElement(RoomLayoutStarter, {
      selectedStyleId: null,
      selectedDistributorId: null,
      onApplyRoom: vi.fn(),
      onBeginnerRoomApplied,
    }));

    fireEvent.click(screen.getByRole("button", { name: /apply room shape and continue/i }));
    expect(onBeginnerRoomApplied).toHaveBeenCalledTimes(1);
  });
});

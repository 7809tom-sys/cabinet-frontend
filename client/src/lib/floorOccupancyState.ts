/**
 * Floor fixtures (tubs, toilets, fillers) are not cabinets. Placement, snapping,
 * and Auto Design read this stack so those footprints occupy the floor while a
 * call is in progress. An empty stack leaves every kitchen path unchanged.
 */
export type ActiveFloorObstacle = {
  uid: string;
  cabinetId: number;
  masterCode: string;
  description: string;
  placement: "base" | "tall";
  x: number;
  y: number;
  width: number;
  depth: number;
  height?: number;
  rotation: number;
  floorOccupancyObstacle: true;
};

const stack: ActiveFloorObstacle[][] = [];
const EMPTY: readonly ActiveFloorObstacle[] = [];

export function activeFloorObstacles(): readonly ActiveFloorObstacle[] {
  return stack.length > 0 ? stack[stack.length - 1]! : EMPTY;
}

export function withFloorObstacles<T>(obstacles: readonly ActiveFloorObstacle[], run: () => T): T {
  stack.push([...obstacles]);
  try {
    return run();
  } finally {
    stack.pop();
  }
}

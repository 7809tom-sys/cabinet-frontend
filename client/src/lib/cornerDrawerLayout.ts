// Shared by the 3D scene and the 2D elevation so a corner drawer base
// (CDB36) draws the same right-angle fronts in both views.
//
// The cabinet keeps the lazy-Susan L footprint: 24-inch legs inside a
// 36-inch square, wall corner at the local back-left. Each drawer is two
// perpendicular panels that meet at the inside corner. They sit on the
// room-facing leg fronts and stop before either neighboring run.

const INCH = 1 / 12;

/** Shallow top drawer, matching a standard three-drawer base. */
export const CORNER_DRAWER_TOP_ROW_IN = 6;

/** Same proud face and thickness the lazy-Susan doors use. */
export const CORNER_DRAWER_FACE_THICKNESS_FT = 0.052;
export const CORNER_DRAWER_FACE_PROUD_FT = 0.03;

/** Keep the outer end of each front off the plane where the next cabinet starts. */
export const CORNER_DRAWER_END_REVEAL_FT = 0.04;

/** Hairline between the two panels so the corner seam does not z-fight. */
export const CORNER_DRAWER_SEAM_GAP_FT = 0.002;

/** Reveal taken out of each row so stacked fronts do not fuse together. */
export const CORNER_DRAWER_ROW_GAP_FT = 0.012;

export type CornerDrawerLeg = "back-leg" | "side-leg";

export type CornerDrawerPanel = {
  row: number;
  leg: CornerDrawerLeg;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  thickness: number;
  /** 0 faces +Z (back-leg front). π/2 faces +X (side-leg front). */
  rotationY: number;
};

export type CornerDrawerFootprint = {
  left: number;
  right: number;
  back: number;
  front: number;
  insideX: number;
  insideZ: number;
  /** How far a finished front may project past the carcass face, in feet. */
  faceProjection: number;
};

export type CornerDrawerFrontLayout = CornerDrawerFootprint & {
  panels: CornerDrawerPanel[];
  rowHeightsIn: number[];
  legRatio: number;
};

export function isCornerDrawerBaseCabinet(input: {
  masterCode?: string | null;
  description?: string | null;
  graphicType?: string | null;
  customProfile?: string | null;
}): boolean {
  const graphic = `${input.graphicType ?? ""} ${input.customProfile ?? ""}`.toLowerCase();
  if (/corner-drawer-base/.test(graphic)) return true;
  if (/^cdb[-_]?\d/i.test(input.masterCode ?? "")) return true;
  return /corner drawer base/i.test(input.description ?? "");
}

/**
 * Row heights in inches for the visible face. Three drawers are a shallow
 * top plus two equal deeper rows. Any other count splits the face evenly.
 */
export function cornerDrawerRowHeightsIn(faceHeightIn: number, drawerCount = 3): number[] {
  const height = Math.max(0, faceHeightIn);
  const count = Math.max(1, Math.round(drawerCount) || 1);
  if (!(height > 0)) return Array.from({ length: count }, () => 0);
  if (count === 3) {
    const top = Math.min(CORNER_DRAWER_TOP_ROW_IN, height / 3);
    const lower = (height - top) / 2;
    return [top, lower, lower];
  }
  return Array.from({ length: count }, () => height / count);
}

/** Standard base leg (24in) as a fraction of the square plan, clamped like the L carcass. */
export function cornerDrawerLegRatio(boxIn: number, legDepthIn = 24): number {
  const box = Math.max(0.01, boxIn);
  return Math.max(0.3, Math.min(0.95, legDepthIn / box));
}

/**
 * One wall elevation of the L: a finished return for the perpendicular leg,
 * then the exposed drawer stack. Widths are the same 24in leg / 12in face
 * the 3D carcass uses on a 36in square.
 */
export function cornerDrawerElevationSplit(widthIn: number, heightIn: number, drawerCount = 3, legDepthIn = 24) {
  const width = Math.max(0.01, widthIn);
  const ratio = cornerDrawerLegRatio(width, legDepthIn);
  const returnIn = width * ratio;
  const faceIn = Math.max(0, width - returnIn);
  const rows = cornerDrawerRowHeightsIn(heightIn, drawerCount);
  const totalIn = rows.reduce((sum, row) => sum + row, 0) || 1;
  return {
    returnIn,
    faceIn,
    returnPct: (returnIn / width) * 100,
    facePct: (faceIn / width) * 100,
    rows,
    totalIn,
  };
}

function lCornerInside(bodyWidth: number, bodyDepth: number, legRatio: number) {
  const ratio = Math.max(0.3, Math.min(0.95, legRatio));
  const legWidth = bodyWidth * ratio;
  const legDepth = bodyDepth * ratio;
  const left = -bodyWidth / 2;
  const right = bodyWidth / 2;
  const back = -bodyDepth / 2;
  const front = bodyDepth / 2;
  return {
    ratio,
    left,
    right,
    back,
    front,
    insideX: left + legWidth,
    insideZ: back + legDepth,
  };
}

/**
 * Right-angle drawer fronts in feet, centered on the cabinet box.
 * `bodyWidth` / `bodyDepth` / `bodyHeight` are the 3D carcass size (feet).
 * `legRatio` is the same ratio the L carcass was built with.
 */
export function cornerDrawerFrontLayout(input: {
  bodyWidth: number;
  bodyDepth: number;
  bodyHeight: number;
  legRatio?: number;
  drawerCount?: number;
}): CornerDrawerFrontLayout {
  const bodyWidth = Math.max(0, input.bodyWidth);
  const bodyDepth = Math.max(0, input.bodyDepth);
  const bodyHeight = Math.max(0, input.bodyHeight);
  const shape = lCornerInside(bodyWidth, bodyDepth, input.legRatio ?? 2 / 3);
  const count = Math.max(1, Math.round(input.drawerCount ?? 3) || 1);
  const rowHeightsIn = cornerDrawerRowHeightsIn(bodyHeight / INCH, count);
  const thickness = CORNER_DRAWER_FACE_THICKNESS_FT;
  const proud = CORNER_DRAWER_FACE_PROUD_FT;
  const faceProjection = proud + thickness / 2;
  const seam = faceProjection + CORNER_DRAWER_SEAM_GAP_FT;
  const endReveal = CORNER_DRAWER_END_REVEAL_FT;
  const backWidth = Math.max(0.08, shape.right - endReveal - (shape.insideX + seam));
  const sideWidth = Math.max(0.08, shape.front - endReveal - (shape.insideZ + seam));
  const backX = shape.insideX + seam + backWidth / 2;
  const backZ = shape.insideZ + proud;
  const sideX = shape.insideX + proud;
  const sideZ = shape.insideZ + seam + sideWidth / 2;
  const panels: CornerDrawerPanel[] = [];
  let cursor = bodyHeight / 2;
  rowHeightsIn.forEach((rowIn, row) => {
    const rowFt = rowIn * INCH;
    const height = Math.max(0.08, rowFt - CORNER_DRAWER_ROW_GAP_FT);
    const y = cursor - rowFt / 2;
    cursor -= rowFt;
    panels.push(
      {
        row,
        leg: "back-leg",
        x: backX,
        y,
        z: backZ,
        width: backWidth,
        height,
        thickness,
        rotationY: 0,
      },
      {
        row,
        leg: "side-leg",
        x: sideX,
        y,
        z: sideZ,
        width: sideWidth,
        height,
        thickness,
        rotationY: Math.PI / 2,
      },
    );
  });
  return {
    panels,
    rowHeightsIn,
    legRatio: shape.ratio,
    left: shape.left,
    right: shape.right,
    back: shape.back,
    front: shape.front,
    insideX: shape.insideX,
    insideZ: shape.insideZ,
    faceProjection,
  };
}

export function cornerDrawerPanelPlanBox(panel: Pick<CornerDrawerPanel, "x" | "z" | "width" | "thickness" | "rotationY">) {
  const alongZ = Math.abs(Math.sin(panel.rotationY)) > 0.5;
  const halfAlong = panel.width / 2;
  const halfThick = panel.thickness / 2;
  return alongZ
    ? { minX: panel.x - halfThick, maxX: panel.x + halfThick, minZ: panel.z - halfAlong, maxZ: panel.z + halfAlong }
    : { minX: panel.x - halfAlong, maxX: panel.x + halfAlong, minZ: panel.z - halfThick, maxZ: panel.z + halfThick };
}

/**
 * A front stays in the cabinet when every plan corner is on the L carcass
 * or on the short finished projection in front of a room-facing leg.
 * Crossing the leg end (the next cabinet) or the open notch fails.
 */
export function cornerDrawerPanelsStayInFootprint(
  panels: Array<Pick<CornerDrawerPanel, "x" | "z" | "width" | "thickness" | "rotationY">>,
  footprint: CornerDrawerFootprint,
): boolean {
  if (!panels.length) return false;
  const eps = 1e-5;
  const { left, right, back, front, insideX, insideZ, faceProjection } = footprint;
  for (const panel of panels) {
    const box = cornerDrawerPanelPlanBox(panel);
    const corners: Array<[number, number]> = [
      [box.minX, box.minZ],
      [box.maxX, box.minZ],
      [box.maxX, box.maxZ],
      [box.minX, box.maxZ],
    ];
    for (const [x, z] of corners) {
      if (x > right + eps || z > front + eps || x < left - eps || z < back - eps) return false;
      const onBackLeg = z <= insideZ + faceProjection + eps && x <= right + eps;
      const onSideLeg = x <= insideX + faceProjection + eps && z <= front + eps;
      if (!onBackLeg && !onSideLeg) return false;
    }
  }
  return true;
}

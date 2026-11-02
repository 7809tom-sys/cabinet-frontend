// shared/walzcraftDoorTemplates.ts
//
// WalzCraft raised-panel / five-piece door templates.
//
// NOTE: Shaker doors use the separate DL Shaker blueprint
// (docs/rules/SHAKER_DOOR_RULE.md + shared/shakerDoorBlueprint.ts).
// The templates below are WalzCraft raised-panel / five-piece only and are
// intentionally kept independent of the shaker blueprint.

export type DoorType = "slab" | "five-piece";
export type GlazeOption = "none" | "black" | "gold";
export type CabinetZone = "wall" | "base";

export interface Dim {
  value: number; // inches
  estimated: boolean;
  source?: string;
}

export interface WalzProfileTemplate {
  id: string;
  name: string;
  frameProfile: string | null;
  panelProfile: string | null;
  corner: "mitered" | "cope-and-stick";
  frameWidth: Dim;
  faceBevelDeg: Dim;
  panelReveal: Dim;
  thickness: Dim;
  panelStyle: "raised-bevel" | "stepped" | "recessed";
  frameDetail: "slant-bevel" | "molded-step" | "ogee" | "square";
  notes?: string;
  baseScore: number;
}

const CATALOG_E108 = "WalzCraft catalog E.10.8";
const CATALOG_E126 = "WalzCraft catalog E.12.6";
const PRODUCT_PAGE = "WalzCraft product page";
const ESTIMATED = "estimated";

export const WALZCRAFT_PROFILE_TEMPLATES: WalzProfileTemplate[] = [
  {
    id: "S109",
    name: "Proximity",
    frameProfile: "MP722-57",
    panelProfile: "PR317-25",
    corner: "mitered",
    frameWidth: { value: 2.25, estimated: false, source: CATALOG_E108 },
    faceBevelDeg: { value: 7.4, estimated: false, source: CATALOG_E108 },
    panelReveal: { value: 1.0, estimated: false, source: CATALOG_E126 },
    thickness: { value: 0.75, estimated: false, source: PRODUCT_PAGE },
    panelStyle: "raised-bevel",
    frameDetail: "slant-bevel",
    notes:
      "Style 10M mitered. MP722-57 face bevel 7.40deg, inner edge 13/32in. PR317-25 traditional raised panel, 1in reveal, 3/4in thick.",
    baseScore: 70,
  },
  {
    id: "S102",
    name: "Marquee",
    frameProfile: "MP760-76",
    panelProfile: "PR305-19",
    corner: "mitered",
    frameWidth: { value: 3.0, estimated: false, source: CATALOG_E108 },
    faceBevelDeg: { value: 5.48, estimated: true, source: ESTIMATED },
    panelReveal: { value: 0.75, estimated: false, source: CATALOG_E126 },
    thickness: { value: 0.75, estimated: false, source: PRODUCT_PAGE },
    panelStyle: "raised-bevel",
    frameDetail: "slant-bevel",
    notes: "MP760-76 frame, 3in. PR305-19 panel, 3/4in reveal.",
    baseScore: 30,
  },
  {
    id: "S586",
    name: "Marin",
    frameProfile: "MP703-76",
    panelProfile: "PR302-32",
    corner: "mitered",
    frameWidth: { value: 3.0, estimated: false, source: CATALOG_E108 },
    faceBevelDeg: { value: 5.48, estimated: true, source: ESTIMATED },
    panelReveal: { value: 1.25, estimated: false, source: CATALOG_E126 },
    thickness: { value: 0.75, estimated: false, source: PRODUCT_PAGE },
    panelStyle: "raised-bevel",
    frameDetail: "slant-bevel",
    notes: "MP703-76 frame, 3in. PR302-32 panel, 1-1/4in reveal.",
    baseScore: 20,
  },
  {
    id: "S592",
    name: "Barrington",
    frameProfile: null,
    panelProfile: null,
    corner: "mitered",
    frameWidth: { value: 3.5, estimated: false, source: PRODUCT_PAGE },
    faceBevelDeg: { value: 5.48, estimated: true, source: ESTIMATED },
    panelReveal: { value: 1.0, estimated: true, source: ESTIMATED },
    thickness: { value: 0.75, estimated: false, source: PRODUCT_PAGE },
    panelStyle: "stepped",
    frameDetail: "molded-step",
    notes:
      "3-1/2in mitered frame with a molded step; stepped panel. Frame/panel profile numbers not published.",
    baseScore: 10,
  },
  {
    id: "S841",
    name: "Richmond",
    frameProfile: null,
    panelProfile: null,
    corner: "cope-and-stick",
    frameWidth: { value: 2.25, estimated: true, source: ESTIMATED },
    faceBevelDeg: { value: 5.48, estimated: true, source: ESTIMATED },
    panelReveal: { value: 1.25, estimated: false, source: PRODUCT_PAGE },
    thickness: { value: 0.75, estimated: false, source: PRODUCT_PAGE },
    panelStyle: "stepped",
    frameDetail: "ogee",
    notes:
      "Cope-and-stick frame with a small ogee; stepped panel, 1-1/4in reveal. Frame width estimated.",
    baseScore: 8,
  },
  {
    id: "S424",
    name: "Ontario",
    frameProfile: "MP627-76",
    panelProfile: "PR320-32",
    corner: "mitered",
    frameWidth: { value: 3.0, estimated: true, source: ESTIMATED },
    faceBevelDeg: { value: 5.48, estimated: true, source: ESTIMATED },
    panelReveal: { value: 0.375, estimated: false, source: PRODUCT_PAGE },
    thickness: { value: 0.75, estimated: false, source: PRODUCT_PAGE },
    panelStyle: "recessed",
    frameDetail: "slant-bevel",
    notes:
      "MP627-76 frame; PR320-32 recessed panel, 3/8in. Frame width estimated.",
    baseScore: 6,
  },
  {
    id: "S579",
    name: "Augusta",
    frameProfile: "MP718-76",
    panelProfile: "PR300-32",
    corner: "mitered",
    frameWidth: { value: 3.0, estimated: true, source: ESTIMATED },
    faceBevelDeg: { value: 5.48, estimated: true, source: ESTIMATED },
    panelReveal: { value: 1.25, estimated: false, source: PRODUCT_PAGE },
    thickness: { value: 0.75, estimated: false, source: PRODUCT_PAGE },
    panelStyle: "raised-bevel",
    frameDetail: "slant-bevel",
    notes: "MP718-76 frame; PR300-32 panel, 1-1/4in reveal. Frame width estimated.",
    baseScore: 5,
  },
];

export interface RankedProfile {
  template: WalzProfileTemplate;
  confidence: number;
}

export function rankProfiles(
  templates: WalzProfileTemplate[] = WALZCRAFT_PROFILE_TEMPLATES,
  limit = 4,
): RankedProfile[] {
  const sorted = templates
    .map((template, index) => ({ template, index }))
    .sort((a, b) => {
      if (b.template.baseScore !== a.template.baseScore) {
        return b.template.baseScore - a.template.baseScore;
      }
      return a.index - b.index;
    })
    .slice(0, Math.max(0, limit));

  return sorted.map(({ template }) => ({
    template,
    confidence: template.baseScore,
  }));
}

export interface ShadeColor {
  id: string;
  name: string;
  hex: string;
  finish: string;
  baseScore: number;
}

export const WALZCRAFT_SHADE_COLORS: ShadeColor[] = [
  { id: "charleston-white", name: "Charleston White", hex: "#f2efe6", finish: "SolidTone", baseScore: 70 },
  { id: "aspen-charcoal", name: "Aspen Charcoal", hex: "#4a4a48", finish: "SolidTone", baseScore: 30 },
  { id: "chocolate-frost", name: "Chocolate Frost", hex: "#5a4436", finish: "SolidTone", baseScore: 20 },
  { id: "linen", name: "Linen", hex: "#e9e1d1", finish: "SolidTone", baseScore: 10 },
  { id: "tan", name: "Tan", hex: "#c9b28f", finish: "SolidTone", baseScore: 8 },
  { id: "honey", name: "Honey", hex: "#b9833f", finish: "SolidTone", baseScore: 6 },
  { id: "nutmeg", name: "Nutmeg", hex: "#7b4a2b", finish: "SolidTone", baseScore: 5 },
  { id: "medium-brown-walnut", name: "Medium Brown Walnut", hex: "#5e3b25", finish: "SolidTone", baseScore: 4 },
];

export interface RankedShade {
  shade: ShadeColor;
  confidence: number;
}

export function rankShades(limit = 4, _doorType?: DoorType): RankedShade[] {
  const sorted = WALZCRAFT_SHADE_COLORS.map((shade, index) => ({ shade, index }))
    .sort((a, b) => {
      if (b.shade.baseScore !== a.shade.baseScore) {
        return b.shade.baseScore - a.shade.baseScore;
      }
      return a.index - b.index;
    })
    .slice(0, Math.max(0, limit));

  return sorted.map(({ shade }) => ({ shade, confidence: shade.baseScore }));
}

export interface GlazeOptionDef {
  id: GlazeOption;
  label: string;
  stroke: string;
}

export const GLAZE_OPTIONS: GlazeOptionDef[] = [
  { id: "none", label: "None", stroke: "#111111" },
  { id: "black", label: "Black", stroke: "#111111" },
  { id: "gold", label: "Gold", stroke: "#d7a46c" },
];

export const GLAZE_LINE_WIDTH_IN = 0.125;

export interface ProfileGeometry {
  outline: [number, number][];
  recesses: [number, number][][];
  widthIn: number;
  thicknessIn: number;
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function round(v: number): number {
  return Math.round(v * 10000) / 10000;
}

// Walk `d` inches along the outline from vertex `index`, backwards along the
// previous segment and forwards along the next segment, returning a polyline
// whose middle vertex is the corner itself. The polyline traces the actual
// outline segments so the glaze line sits on the drawn profile.
function recessAtVertex(
  outline: [number, number][],
  index: number,
  d: number,
): [number, number][] {
  const n = outline.length;
  if (n < 3) return [];
  const i = ((index % n) + n) % n;
  const prev = outline[(i - 1 + n) % n];
  const corner = outline[i];
  const next = outline[(i + 1) % n];

  const walk = (
    from: [number, number],
    to: [number, number],
  ): [number, number] => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy);
    if (len <= 1e-9) return [to[0], to[1]];
    const step = Math.min(d, len);
    const u = step / len;
    return [from[0] + dx * u, from[1] + dy * u];
  };

  // Walk backwards from corner toward prev, then forwards toward next.
  const back = walk(corner, prev);
  const fwd = walk(corner, next);
  return [back, [corner[0], corner[1]], fwd];
}

export function buildProfileGeometry(t: WalzProfileTemplate): ProfileGeometry {
  const thickness = clamp(t.thickness.value, 0.25, 2);
  const frameWidth = clamp(t.frameWidth.value, 0.5, 6);
  const bevelDeg = clamp(t.faceBevelDeg.value, 0, 45);
  const reveal = clamp(t.panelReveal.value, 0.125, 3);

  const fieldHeight = Math.max(0.25, thickness - 0.125);
  const bevelDrop = Math.tan((bevelDeg * Math.PI) / 180) * frameWidth;
  const frameInnerFace = Math.max(0.25, thickness - bevelDrop);

  const outline: [number, number][] = [];
  // Vertex indices we want to glaze, resolved after the outline is built.
  const recessIndices: number[] = [];

  // Back face, outer edge -> inner
  outline.push([0, 0]);

  // Outer edge up to face
  outline.push([0, thickness]);

  // Frame face detail from outer edge inward
  if (t.frameDetail === "slant-bevel") {
    outline.push([frameWidth, frameInnerFace]);
  } else if (t.frameDetail === "molded-step") {
    const step = 0.125;
    const mid = frameWidth * 0.5;
    outline.push([mid, thickness]);
    outline.push([mid, thickness - step]);
    outline.push([frameWidth, frameInnerFace]);
  } else if (t.frameDetail === "ogee") {
    // Approximate a small ogee S-curve with ~6 points
    const pts = 6;
    for (let i = 1; i <= pts; i++) {
      const u = i / pts;
      const x = frameWidth * u;
      const s = Math.sin(u * Math.PI);
      const y = thickness - (thickness - frameInnerFace) * u - 0.05 * s;
      outline.push([x, y]);
    }
  } else {
    // square
    outline.push([frameWidth, thickness]);
  }

  // Frame/panel joint: the valley where the frame's inner edge drops to the
  // panel. The vertex at (frameWidth, frameInnerFace) is the inside corner.
  const jointX = frameWidth;
  const jointY = frameInnerFace;
  const jointIndex = outline.length - 1;
  // Sanity: the last pushed point should be the joint corner.
  if (
    Math.abs(outline[jointIndex][0] - jointX) < 1e-9 &&
    Math.abs(outline[jointIndex][1] - jointY) < 1e-9
  ) {
    recessIndices.push(jointIndex);
  }

  // Tongue / gap region
  const tongueStart = frameWidth;
  const tongueEnd = frameWidth + 0.125;
  outline.push([tongueStart, jointY]);
  outline.push([tongueEnd, jointY]);

  // Panel
  const panelStart = tongueEnd;
  const panelEnd = panelStart + reveal;
  const fieldEnd = panelEnd + 1.0;

  if (t.panelStyle === "raised-bevel") {
    const panelBase = 0.25;
    outline.push([panelStart, panelBase]);
    // Deepest valley: foot of the panel bevel at (panelStart, panelBase).
    recessIndices.push(outline.length - 1);
    outline.push([panelEnd, fieldHeight]);
    outline.push([fieldEnd, fieldHeight]);
    // NOTE: the bevel-to-field top corner is convex; glaze collects in
    // concave corners only, so we do not add a recess there.
  } else if (t.panelStyle === "stepped") {
    const panelBase = 0.25;
    const midX = panelStart + reveal * 0.5;
    const midY = (panelBase + fieldHeight) / 2;
    outline.push([panelStart, panelBase]);
    // Inside corner at the foot of the first step.
    recessIndices.push(outline.length - 1);
    outline.push([midX, midY]);
    // Inside corner at the foot of the second step.
    recessIndices.push(outline.length - 1);
    outline.push([panelEnd, fieldHeight]);
    outline.push([fieldEnd, fieldHeight]);
  } else {
    // recessed
    const panelTop = 0.25;
    outline.push([panelStart, panelTop]);
    // Corner where panel meets frame.
    recessIndices.push(outline.length - 1);
    outline.push([fieldEnd, panelTop]);
  }

  // Close back to back face
  outline.push([fieldEnd, 0]);
  outline.push([0, 0]);

  const widthIn = round(fieldEnd);
  const thicknessIn = round(thickness);

  const cleanOutline: [number, number][] = outline.map(([x, y]) => [
    round(clamp(x, 0, widthIn)),
    round(y, 0, thicknessIn),
  ]);

  const recesses: [number, number][][] = recessIndices
    .map((idx) => recessAtVertex(cleanOutline, idx, 0.3))
    .filter((poly) => poly.length >= 3);

  return {
    outline: cleanOutline,
    recesses,
    widthIn,
    thicknessIn,
  };
}

export interface DrawerFrontSpec {
  zone: CabinetZone;
  style: "slab" | "five-piece";
  railProfile: string | null;
  note: string;
}

export function drawerFrontFor(
  template: WalzProfileTemplate | null,
  zone: CabinetZone,
  doorType: DoorType,
): DrawerFrontSpec {
  if (doorType === "slab" || !template) {
    return {
      zone,
      style: "slab",
      railProfile: null,
      note:
        zone === "wall"
          ? "Wall cabinets rarely carry drawer fronts; used for wall-stack / appliance garages. Slab drawer front matches slab door."
          : "Slab drawer front matches slab door.",
    };
  }

  if (zone === "wall") {
    return {
      zone,
      style: "five-piece",
      railProfile: template.frameProfile,
      note:
        "Wall cabinets rarely carry drawer fronts; used for wall-stack / appliance garages. Five-piece drawer front matches door profile.",
    };
  }

  // base
  if (template.corner === "mitered" && template.frameProfile && template.frameProfile.startsWith("MP7")) {
    const narrow =
      template.frameWidth.value <= 2.25
        ? template.frameProfile.replace(/-(\d+)$/, "-38")
        : template.frameProfile;
    return {
      zone,
      style: "five-piece",
      railProfile: narrow,
      note:
        template.frameWidth.value <= 2.25
          ? `Base drawer front uses narrow -38 variant (${narrow}). Tall drawer heights under 6in may read better as slab.`
          : `Base drawer front uses same profile (${narrow}). Tall drawer heights under 6in may read better as slab.`,
    };
  }

  return {
    zone,
    style: "five-piece",
    railProfile: template.frameProfile,
    note:
      "Base drawer front uses same profile. Tall drawer heights under 6in may read better as slab.",
  };
}

export interface DoorSelection {
  doorType: DoorType;
  profileId: string | null;
  shadeId: string | null;
  glaze: Record<string, GlazeOption>;
  drawer: {
    wall: DrawerFrontSpec | null;
    base: DrawerFrontSpec | null;
  };
}

export const STEPS = ["type", "profile", "shade", "glaze", "drawers", "review"] as const;
export type Step = (typeof STEPS)[number];

export function stepsFor(doorType: DoorType): Step[] {
  if (doorType === "slab") {
    return ["type", "shade", "drawers", "review"];
  }
  return [...STEPS];
}

export function nextStep(
  current: Step,
  doorType: DoorType,
): Step | null {
  const steps = stepsFor(doorType);
  const idx = steps.indexOf(current);
  if (idx === -1) return steps[0] ?? null;
  return steps[idx + 1] ?? null;
}

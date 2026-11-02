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
  hexEstimated: boolean;
  finish: string;
  baseScore: number;
  familyId: string;
}

export interface ShadeFamily {
  id: string;
  name: string;
  profileId: string;
  shades: ShadeColor[];
}

export const WALZCRAFT_SHADE_FAMILIES: ShadeFamily[] = [
  {
    id: "alabaster",
    name: "Alabaster / Off-White",
    profileId: "S109",
    shades: [
      { id: "classic-white", name: "Classic White", hex: "#f4f2ec", hexEstimated: true, finish: "SolidTone", baseScore: 70, familyId: "alabaster" },
      { id: "eggshell", name: "Eggshell", hex: "#efe8d8", hexEstimated: true, finish: "SolidTone", baseScore: 30, familyId: "alabaster" },
      { id: "dove-white", name: "Dove White", hex: "#ece9e0", hexEstimated: true, finish: "SolidTone", baseScore: 20, familyId: "alabaster" },
      { id: "antique-white", name: "Antique White", hex: "#e8dfcc", hexEstimated: true, finish: "SolidTone", baseScore: 10, familyId: "alabaster" },
    ],
  },
  {
    id: "gray",
    name: "Stone Gray",
    profileId: "S102",
    shades: [
      { id: "stone-gray", name: "Stone Gray", hex: "#a8a59c", hexEstimated: true, finish: "SolidTone", baseScore: 70, familyId: "gray" },
      { id: "city-gray", name: "City Gray", hex: "#8e8e88", hexEstimated: true, finish: "SolidTone", baseScore: 30, familyId: "gray" },
      { id: "castle-gray", name: "Castle Gray", hex: "#6f6e69", hexEstimated: true, finish: "SolidTone", baseScore: 20, familyId: "gray" },
      { id: "rain-cloud", name: "Rain Cloud", hex: "#b9bbb7", hexEstimated: true, finish: "SolidTone", baseScore: 10, familyId: "gray" },
    ],
  },
  {
    id: "midnight",
    name: "Midnight Blue",
    profileId: "S586",
    shades: [
      { id: "midnight-blue", name: "Midnight Blue", hex: "#2b3a55", hexEstimated: true, finish: "SolidTone", baseScore: 70, familyId: "midnight" },
      { id: "nightfall-v4", name: "Nightfall V4", hex: "#2f3440", hexEstimated: true, finish: "SolidTone", baseScore: 30, familyId: "midnight" },
      { id: "midnight", name: "Midnight", hex: "#1f2a3a", hexEstimated: true, finish: "SolidTone", baseScore: 20, familyId: "midnight" },
      { id: "moonlight", name: "Moonlight", hex: "#5b6b82", hexEstimated: true, finish: "SolidTone", baseScore: 10, familyId: "midnight" },
    ],
  },
  {
    id: "forest",
    name: "Forest Green",
    profileId: "S592",
    shades: [
      { id: "hunter-green", name: "Hunter Green", hex: "#2f4a35", hexEstimated: true, finish: "SolidTone", baseScore: 70, familyId: "forest" },
      { id: "spruce", name: "Spruce", hex: "#3e5a4a", hexEstimated: true, finish: "SolidTone", baseScore: 30, familyId: "forest" },
      { id: "sage", name: "Sage", hex: "#9aa58a", hexEstimated: true, finish: "SolidTone", baseScore: 20, familyId: "forest" },
      { id: "agave", name: "Agave", hex: "#7d8b77", hexEstimated: true, finish: "SolidTone", baseScore: 10, familyId: "forest" },
    ],
  },
  {
    id: "rust",
    name: "Forest Rust / Rust Brown",
    profileId: "S841",
    shades: [
      { id: "cordovan", name: "Cordovan", hex: "#5a2a22", hexEstimated: true, finish: "Stain", baseScore: 70, familyId: "rust" },
      { id: "auburn-v4", name: "Auburn V4", hex: "#7a3b26", hexEstimated: true, finish: "Stain", baseScore: 30, familyId: "rust" },
      { id: "cinnamon", name: "Cinnamon", hex: "#8b4a2b", hexEstimated: true, finish: "Stain", baseScore: 20, familyId: "rust" },
      { id: "nutmeg", name: "Nutmeg", hex: "#7b4a2b", hexEstimated: true, finish: "Stain", baseScore: 10, familyId: "rust" },
    ],
  },
  {
    id: "honey",
    name: "Honey Wood",
    profileId: "S424",
    shades: [
      { id: "honey", name: "Honey", hex: "#b9833f", hexEstimated: true, finish: "Stain", baseScore: 70, familyId: "honey" },
      { id: "dark-honey", name: "Dark Honey", hex: "#94622c", hexEstimated: true, finish: "Stain", baseScore: 30, familyId: "honey" },
      { id: "english-oak-v4", name: "English Oak V4", hex: "#a87a4a", hexEstimated: true, finish: "Stain", baseScore: 20, familyId: "honey" },
      { id: "golden-oak", name: "Golden Oak", hex: "#b98a4e", hexEstimated: true, finish: "Stain", baseScore: 10, familyId: "honey" },
    ],
  },
  {
    id: "charcoal",
    name: "Charcoal / Black",
    profileId: "S579",
    shades: [
      { id: "black", name: "Black", hex: "#1b1b1b", hexEstimated: true, finish: "SolidTone", baseScore: 70, familyId: "charcoal" },
      { id: "ebony", name: "Ebony", hex: "#2a2522", hexEstimated: true, finish: "SolidTone", baseScore: 30, familyId: "charcoal" },
      { id: "dark-gray", name: "Dark Gray", hex: "#4a4a48", hexEstimated: true, finish: "SolidTone", baseScore: 20, familyId: "charcoal" },
      { id: "slate", name: "Slate", hex: "#5d636a", hexEstimated: true, finish: "SolidTone", baseScore: 10, familyId: "charcoal" },
    ],
  },
];

export const WALZCRAFT_SHADE_COLORS: ShadeColor[] = WALZCRAFT_SHADE_FAMILIES.flatMap(
  (family) => family.shades,
);

export function shadesForProfile(profileId: string): ShadeColor[] {
  const family = WALZCRAFT_SHADE_FAMILIES.find((f) => f.profileId === profileId);
  return family ? family.shades : [];
}

export function familyForShade(shadeId: string): ShadeFamily | null {
  for (const family of WALZCRAFT_SHADE_FAMILIES) {
    if (family.shades.some((shade) => shade.id === shadeId)) {
      return family;
    }
  }
  return null;
}

export interface RankedShade {
  shade: ShadeColor;
  confidence: number;
}

export function rankShades(familyId?: string): RankedShade[] {
  if (familyId !== undefined) {
    const family = WALZCRAFT_SHADE_FAMILIES.find((f) => f.id === familyId);
    if (!family) return [];
    return family.shades.map((shade) => ({ shade, confidence: shade.baseScore }));
  }
  return WALZCRAFT_SHADE_FAMILIES.map((family) => {
    const leader = family.shades[0];
    return { shade: leader, confidence: leader.baseScore };
  });
}

export function rankProfilesForShade(
  shadeId: string | null,
  limit = 4,
): RankedProfile[] {
  const family = shadeId ? familyForShade(shadeId) : null;
  const ownerProfileId = family ? family.profileId : null;

  const ordered: RankedProfile[] = [];

  if (ownerProfileId) {
    const owner = WALZCRAFT_PROFILE_TEMPLATES.find((t) => t.id === ownerProfileId);
    if (owner) {
      ordered.push({ template: owner, confidence: 99 });
    }
  }

  const remaining = WALZCRAFT_PROFILE_TEMPLATES.filter(
    (t) => t.id !== ownerProfileId,
  );
  const rankedRemaining = rankProfiles(remaining, remaining.length);
  ordered.push(...rankedRemaining);

  return ordered.slice(0, Math.max(0, limit));
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
    round(clamp(y, 0, thicknessIn)),
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

export interface DrawerProfileOption {
  id: string;
  label: string;
  spec: DrawerFrontSpec;
}

export function drawerProfileOptions(
  template: WalzProfileTemplate | null,
  zone: CabinetZone,
  doorType: DoorType,
): DrawerProfileOption[] {
  const options: DrawerProfileOption[] = [];

  const match = drawerFrontFor(template, zone, doorType);
  options.push(
    match.style === "slab"
      ? { id: "slab", label: "Slab", spec: match }
      : { id: "match", label: "Match door", spec: match },
  );

  if (doorType === "five-piece" && template && template.frameProfile) {
    const fullRail = template.frameProfile;
    if (fullRail !== match.railProfile) {
      options.push({
        id: "full",
        label: "Full-width rail",
        spec: {
          zone,
          style: "five-piece",
          railProfile: fullRail,
          note: `Five-piece drawer front using the full-width door profile (${fullRail}).`,
        },
      });
    }
  }

  if (match.style !== "slab") options.push({
    id: "slab",
    label: "Slab",
    spec: {
      zone,
      style: "slab",
      railProfile: null,
      note: "Slab drawer front.",
    },
  });

  return options.slice(0, 3);
}

export interface DoorSelection {
  doorType: DoorType;
  profileId: string | null;
  shadeId: string | null;
  colorFamilyId: string | null;
  glaze: Record<string, GlazeOption>;
  drawer: {
    wall: string | null;
    base: string | null;
  };
}

export const STEPS = ["color", "type", "profile", "drawers", "glaze", "review"] as const;
export type Step = (typeof STEPS)[number];

export function stepsFor(doorType: DoorType): Step[] {
  if (doorType === "slab") {
    return ["color", "type", "drawers", "review"];
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

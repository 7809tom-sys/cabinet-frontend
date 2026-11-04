/**
 * Library door profiles: the saved geometry a style gets when the WalzCraft
 * wizard never dressed it.
 *
 * Tom's rule (Nov 4 2026), for ANY distributor or account — not only DL
 * Cabinetry:
 *
 *   A door style whose construction says shaker gets the shaker library entry.
 *   A door style whose construction says raised panel gets the raised-panel
 *   entry. If a WalzCraft wizard record exists for the style, the wizard wins and
 *   no library entry is applied.
 *
 * Every rule the entries already carry still holds here:
 *
 * - The profile builds on door and drawer fronts only. Cabinet sides, tops,
 *   bottoms, backs, end panels, end skins, and carcasses stay flat.
 * - A painted finish renders solid in the style's resolved color, with no grain
 *   and no photo. The color comes from `resolveDoorColor` (an accepted render
 *   first) and is never snapped to the brand palette.
 * - The wizard lives only in the door editor. Nothing here shows wizard UI.
 *
 * There is no distributor check anywhere in this file. `isDlStyle` and the DLC
 * finish mapping stay in `dlcFr26Mapping.ts`, where they gate only the DL photo
 * crops; they no longer decide whether a style gets a library profile.
 */
import { resolveDoorColor, type DoorColorInput } from "./doorColorResolve";
import {
  doorProfileIsSlabOrGlass,
  doorProfileMatches,
  type DoorProfileIdentityInput,
} from "./doorProfileIdentity";
import { isPaintedFinish, type PaintedFinishInput } from "./paintedFinish";
import {
  RAISED_PANEL_BLUEPRINT_ID,
  isRaisedPanelFrontSurface,
  isRaisedPanelStyle,
  raisedPanelApplicationForStyle,
  type RaisedPanelApplicationSource,
  type RaisedPanelStyleInput,
} from "./raisedPanelDoorBlueprint";
import {
  effectiveShakerRailIn,
  isHickoryDoor,
  matchStandardShakerToDl,
  shakerDoorFamily,
  standardShakerDlFacePlan,
  type ShakerStyleInput,
} from "./shakerDoorBlueprint";
import type { CabinetFacePlan } from "./doorFaceRecognition";

/** The saved library entries a style can be defaulted onto. */
export const DOOR_LIBRARY_ENTRY_IDS = {
  shaker: "dl-shaker-frame",
  raisedPanel: RAISED_PANEL_BLUEPRINT_ID,
} as const;

export type DoorLibraryEntryId = (typeof DOOR_LIBRARY_ENTRY_IDS)[keyof typeof DOOR_LIBRARY_ENTRY_IDS];

export type DoorLibraryStyleInput = ShakerStyleInput & RaisedPanelStyleInput & PaintedFinishInput & DoorProfileIdentityInput & DoorColorInput & {
  doorSampleImageUrl?: string | null;
  drawerSampleImageUrl?: string | null;
  thumbnailImageUrl?: string | null;
};

export type DoorLibraryEntry = {
  entryId: DoorLibraryEntryId;
  /** Which family the style belongs to, case-insensitively. */
  family: "shaker" | "raised-panel";
  /** Only ever "door" and "drawer". */
  appliesTo: readonly ["door", "drawer"];
};

export type DoorLibraryApplication =
  | {
      applied: true;
      /** Every library entry that applies. Shaker and raised are exclusive today. */
      entries: DoorLibraryEntry[];
      entriesApplied: true;
      source: "library";
      painted: boolean;
      /** Solid color for a painted style. Null when the wood grain stays. */
      paintedSolidHex: string | null;
      railIn: number | null;
      reason: string;
    }
  | {
      applied: false;
      entries: DoorLibraryEntry[];
      entriesApplied: false;
      /** "wizard" means the wizard's profile won; "none" means no library entry fits. */
      source: "wizard" | "none";
      painted: boolean;
      paintedSolidHex: null;
      railIn: number | null;
      reason: string;
    };

/**
 * The library entries that describe this style's face, ignoring the wizard.
 * Empty for a slab, glass, or unrecognized build.
 */
export function libraryEntriesForStyle(style: DoorLibraryStyleInput | null | undefined): DoorLibraryEntry[] {
  if (!style) return [];
  // A slab or glass build has no library entry; the front is a plain panel.
  if (doorProfileIsSlabOrGlass(style)) return [];

  const entries: DoorLibraryEntry[] = [];
  // Shaker is checked first: "Slim Shaker" and "Double Shaker" are their own
  // families and are deliberately not the 2.75/3 in shaker entry.
  if (shakerDoorFamily(style) === "shaker") {
    entries.push({ entryId: DOOR_LIBRARY_ENTRY_IDS.shaker, family: "shaker", appliesTo: ["door", "drawer"] });
  }
  // Raised only when the style is not already a shaker build, so a
  // "Traditional Shaker" is not handed both entries.
  if (entries.length === 0 && isRaisedPanelStyle(style)) {
    entries.push({ entryId: DOOR_LIBRARY_ENTRY_IDS.raisedPanel, family: "raised-panel", appliesTo: ["door", "drawer"] });
  }
  // A style can be named for a profile the construction fields never state; the
  // name fallback inside each family helper already covers that case.
  return entries;
}

/** Style families whose own name is a shaker word, for reporting and tests. */
export function isShakerNamedStyle(style: DoorLibraryStyleInput | null | undefined): boolean {
  return doorProfileMatches(style, /shaker/);
}

/**
 * Decide what a style renders with.
 *
 * - `wizardProfile: true` → the wizard's profile wins; nothing is defaulted.
 * - Otherwise a matching library entry is applied automatically, for every
 *   distributor, with no DL-only gate.
 */
export function doorLibraryApplicationForStyle(
  style: DoorLibraryStyleInput | null | undefined,
  options: { wizardProfile?: boolean } = {},
): DoorLibraryApplication {
  const entries = libraryEntriesForStyle(style);
  const painted = isPaintedFinish(style);
  const decision = style ? resolveDoorColor(style) : null;
  const railIn = style ? effectiveShakerRailIn(style) : null;

  if (options.wizardProfile) {
    return {
      applied: false,
      entries,
      entriesApplied: false,
      source: "wizard",
      painted,
      paintedSolidHex: null,
      railIn,
      reason: "The WalzCraft wizard saved a profile for this style, so the wizard profile wins and no library entry is applied.",
    };
  }
  if (entries.length === 0) {
    return {
      applied: false,
      entries,
      entriesApplied: false,
      source: "none",
      painted,
      paintedSolidHex: null,
      railIn,
      reason: "No library entry matches this door style (not shaker, raised panel, slim, or double).",
    };
  }

  const ids = entries.map((entry) => entry.entryId).join(", ");
  const colorNote = painted && decision ? ` Painted: solid ${decision.appliedHex} (${decision.appliedSource}).` : " Wood finish: grain is kept.";
  return {
    applied: true,
    entries,
    entriesApplied: true,
    source: "library",
    painted,
    paintedSolidHex: painted && decision ? decision.appliedHex : null,
    railIn,
    reason: `No WalzCraft profile for this style, so the library ${ids} is applied on door and drawer fronts only.${colorNote}`,
  };
}

/**
 * Where the raised-panel entry sits for a style, delegating to the raised-panel
 * module. Kept here so a caller has one import for every library question.
 */
export function raisedPanelSourceForStyle(
  style: DoorLibraryStyleInput | null | undefined,
  options: { wizardProfile?: boolean } = {},
): RaisedPanelApplicationSource {
  return raisedPanelApplicationForStyle(style, options).source;
}

/** The raised-panel face for a style, or null when it is not a raised front. */
export function raisedPanelLibraryFacePlan(
  style: DoorLibraryStyleInput | null | undefined,
  placement: string | null | undefined,
  options: { wizardProfile?: boolean } = {},
): CabinetFacePlan | null {
  const application = raisedPanelApplicationForStyle(style, options);
  if (!application.applied || !style) return null;
  const wall = (placement ?? "").toLowerCase() === "wall";
  const decision = resolveDoorColor(style);
  const painted = isPaintedFinish(style);
  // The raised entry supplies geometry (frame, bevel, raised center), which the
  // renderer builds from the shared numbers. A painted front is an opaque solid of
  // the resolved color with no photo and no grain; a stained front keeps its own
  // photo, and a style with no photo stays on the solid color.
  const door = painted ? "" : ((style.doorSampleImageUrl ?? "").trim() || (style.thumbnailImageUrl ?? "").trim());
  const drawer = painted ? "" : (style.drawerSampleImageUrl ?? "").trim();
  return {
    sourceKind: "split",
    doorUrl: door || null,
    drawerUrl: wall ? null : (drawer || door || null),
    sections: wall ? 1 : 2,
    drawerTextureApplied: !wall && Boolean(drawer || door),
    grainRotation: 0,
    // The renderer reads solidColor for the face and for every structural
    // surface, so a raised cabinet is one color even when it has no photo.
    dlcCrop: {
      slug: RAISED_PANEL_BLUEPRINT_ID,
      doorSize: [12, 24],
      drawerSize: wall ? null : [12, 7.5],
      drawerSolidColor: null,
      solidColor: decision.appliedHex,
      grainUrl: null,
      normalUrl: null,
      tintHex: null,
    },
  };
}

/**
 * The shaker face for a style, or null when it is not the 2.75/3 in family.
 * Thin wrapper so callers do not have to know about `standardShakerDlFacePlan`.
 */
export function shakerLibraryFacePlan(
  style: DoorLibraryStyleInput | null | undefined,
  placement: string | null | undefined,
  options: { wizardProfile?: boolean } = {},
): CabinetFacePlan | null {
  if (!style) return null;
  return standardShakerDlFacePlan(style, placement, options);
}

/**
 * Everything a caller needs to build the library default for one style: which
 * entry applies, how it colors, and whether a wizard record overrides it.
 *
 * Both families are exclusive today. A painted shaker face is the blueprint's
 * opaque solid; a stained shaker keeps its grain. A raised face is the raised
 * entry's geometry, which the renderer builds from the shared numbers.
 */
export function libraryDoorFacePlan(
  style: DoorLibraryStyleInput | null | undefined,
  placement: string | null | undefined,
  options: { wizardProfile?: boolean } = {},
): CabinetFacePlan | null {
  const application = doorLibraryApplicationForStyle(style, options);
  if (!application.applied || !style) return null;
  if (application.entries.some((entry) => entry.family === "shaker")) {
    return shakerLibraryFacePlan(style, placement, options);
  }
  if (application.entries.some((entry) => entry.family === "raised-panel")) {
    const raised = raisedPanelLibraryFacePlan(style, placement, options);
    if (!raised || application.painted) return raised;
    // A stained raised face keeps the style's own door photo. Nothing is invented:
    // a style with no photo stays on the solid resolved color.
    const door = (style.doorSampleImageUrl ?? "").trim() || (style.thumbnailImageUrl ?? "").trim();
    const drawer = (style.drawerSampleImageUrl ?? "").trim();
    if (!door) return raised;
    const wall = (placement ?? "").toLowerCase() === "wall";
    return {
      sourceKind: "split",
      doorUrl: door,
      drawerUrl: wall ? null : (drawer || door),
      sections: wall ? 1 : 2,
      drawerTextureApplied: !wall && Boolean(drawer || door),
      grainRotation: 0,
    };
  }
  return null;
}

/**
 * The library entry that explains a shaker face whose 2.75/3 in adoption is
 * declined, or null. Used by callers that still need a plan (for example a
 * hickory shaker on its own photo), so a profile decision is never silently lost.
 */
export function shakerLibraryEntryFor(
  style: DoorLibraryStyleInput | null | undefined,
): DoorLibraryEntry | null {
  return libraryEntriesForStyle(style).find((entry) => entry.family === "shaker") ?? null;
}

/** True when the library default may put geometry on this surface. */
export function libraryProfileAppliesToFront(role: string | null | undefined): boolean {
  return isRaisedPanelFrontSurface(role);
}

/** Re-exported so a caller can prove hickory keeps its own photo even as a shaker. */
export { isHickoryDoor, matchStandardShakerToDl };

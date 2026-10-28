/**
 * Physical-spec batch copy for the admin Featured Door Style editor.
 * Identity fields (names, color, images, freight, verification) are never included.
 * The live per-style mutation is `doorStyles.adminUpdateDoorStyle` — there is no
 * `doorStyles.update`. `doorPanelType` is part of the panel group; the current
 * backend input strips it until docs/patches/cabinet-backend-admin-door-panel-type.patch
 * is applied. The other panel fields already persist.
 */

export const SPEC_GROUPS = [
  {
    id: "frame",
    label:
      "Frame (rail width, stile width, center rail, Official frame source citation)",
  },
  {
    id: "panel",
    label: "Panel construction, door panel type, and profile",
  },
  {
    id: "finish",
    label: "Finish and sheen",
  },
  {
    id: "wood",
    label: "Wood species",
  },
  {
    id: "grain",
    label: "Grain direction",
  },
  {
    id: "notes",
    label: "Profile notes and description",
  },
] as const;

export type SpecGroupId = (typeof SPEC_GROUPS)[number]["id"];

export const COPYABLE_SPEC_FIELDS = [
  "railWidth",
  "stileWidth",
  "centerRailWidth",
  "sourceSpecification",
  "panelConstruction",
  "doorPanelType",
  "bevelWidth",
  "bevelDepth",
  "insideEdgeProfile",
  "drawerFrontType",
  "finish",
  "finishSheen",
  "woodSpecies",
  "grainDirection",
  "profileNotes",
  "profileDescription",
] as const;

export type CopyableSpecField = (typeof COPYABLE_SPEC_FIELDS)[number];

/** Fields the batch apply must never send, even if a caller asks for every group. */
export const NEVER_COPY_FIELDS = [
  "ourName",
  "aliasName",
  "featuredLabel",
  "distributorName",
  "doorStyle",
  "color",
  "styleCode",
  "doorSampleImageUrl",
  "drawerSampleImageUrl",
  "roomSceneImageUrl",
  "thumbnailImageUrl",
  "cornerSwatchImageUrl",
  "warehouseZip",
  "warehouseZips",
  "flatFreightFeeCents",
  "styleVerified",
  "styleSourceNote",
  "doorSampleVerified",
  "drawerSampleVerified",
  "isFeatured",
  "featuredRank",
  "isActive",
] as const;

export const FRAME_CITATION_REQUIRED =
  "A source citation is required before a frame can render in Designer";

export type DoorStyleBatchCandidate = {
  id: number;
  distributorId: number;
  ourName: string;
  styleCode?: string | null;
  color?: string | null;
  doorStyle?: string | null;
  isActive?: boolean;
};

export type DoorStyleSpecValues = {
  railWidth: number | null;
  stileWidth: number | null;
  centerRailWidth: number | null;
  sourceSpecification: string | null;
  panelConstruction: "raised" | "flat" | "slab" | "glass" | null;
  doorPanelType: string | null;
  bevelWidth: number | null;
  bevelDepth: number | null;
  insideEdgeProfile: string | null;
  drawerFrontType: "five-piece-raised" | "five-piece-flat" | "slab" | null;
  finish: string | null;
  finishSheen: "satin" | "matte" | "gloss" | null;
  woodSpecies: string | null;
  grainDirection:
    | "vertical-stiles-horizontal-rails"
    | "vertical"
    | "horizontal"
    | "none"
    | null;
  profileNotes: string | null;
  profileDescription: string | null;
};

export type DoorStyleSpecPatch = Partial<DoorStyleSpecValues>;

export type EditorSpecInput = {
  railWidth: string;
  stileWidth: string;
  centerRailWidth: string;
  sourceSpecification: string;
  panelConstruction: NonNullable<DoorStyleSpecValues["panelConstruction"]>;
  doorPanelType: string | null;
  bevelWidth: string;
  bevelDepth: string;
  insideEdgeProfile: string;
  drawerFrontType: NonNullable<DoorStyleSpecValues["drawerFrontType"]>;
  finish: string;
  finishSheen: NonNullable<DoorStyleSpecValues["finishSheen"]>;
  woodSpecies: string;
  grainDirection: NonNullable<DoorStyleSpecValues["grainDirection"]>;
  profileNotes: string;
  profileDescription: string;
};

export type SpecBatchSelection = {
  styleIds: number[];
  groups: SpecGroupId[];
  styleNames: string[];
  vendorLabel: string;
};

const GROUP_FIELDS: Record<SpecGroupId, readonly CopyableSpecField[]> = {
  frame: ["railWidth", "stileWidth", "centerRailWidth", "sourceSpecification"],
  panel: [
    "panelConstruction",
    "doorPanelType",
    "bevelWidth",
    "bevelDepth",
    "insideEdgeProfile",
    "drawerFrontType",
  ],
  finish: ["finish", "finishSheen"],
  wood: ["woodSpecies"],
  grain: ["grainDirection"],
  notes: ["profileNotes", "profileDescription"],
};

export function defaultSpecGroupIds(): SpecGroupId[] {
  return SPEC_GROUPS.map((group) => group.id);
}

export function doorStyleVendorLabel(style: {
  distributorId: number;
  supplierBrandName?: string | null;
  supplierName?: string | null;
}): string {
  return (
    style.supplierBrandName?.trim() ||
    style.supplierName?.trim() ||
    `Distributor #${style.distributorId}`
  );
}

export function siblingDoorStyles<T extends DoorStyleBatchCandidate>(
  styles: readonly T[],
  current: { id: number; distributorId: number },
): T[] {
  return styles
    .filter(
      (style) =>
        style.distributorId === current.distributorId &&
        style.id !== current.id,
    )
    .slice()
    .sort(
      (left, right) =>
        left.ourName.localeCompare(right.ourName) || left.id - right.id,
    );
}

export function toggleSelectedId(
  selected: readonly number[],
  id: number,
  checked: boolean,
): number[] {
  if (checked) return selected.includes(id) ? [...selected] : [...selected, id];
  return selected.filter((item) => item !== id);
}

/** Same positive-inch rule the editor uses before a rail or stile can be saved. */
export function parsedPositiveInches(value: string): number | null {
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 99 ? parsed : null;
}

export function specValuesFromEditor(
  input: EditorSpecInput,
): DoorStyleSpecValues {
  return {
    railWidth: parsedPositiveInches(input.railWidth),
    stileWidth: parsedPositiveInches(input.stileWidth),
    centerRailWidth: input.centerRailWidth.trim()
      ? Number.parseFloat(input.centerRailWidth)
      : null,
    sourceSpecification: input.sourceSpecification.trim() || null,
    panelConstruction: input.panelConstruction,
    doorPanelType: input.doorPanelType?.trim() || null,
    bevelWidth: input.bevelWidth.trim()
      ? Number.parseFloat(input.bevelWidth)
      : null,
    bevelDepth: input.bevelDepth.trim()
      ? Number.parseFloat(input.bevelDepth)
      : null,
    insideEdgeProfile: input.insideEdgeProfile.trim() || null,
    drawerFrontType: input.drawerFrontType,
    finish: input.finish.trim() || null,
    finishSheen: input.finishSheen,
    woodSpecies: input.woodSpecies.trim() || null,
    grainDirection: input.grainDirection,
    profileNotes: input.profileNotes.trim() || null,
    profileDescription: input.profileDescription.trim() || null,
  };
}

export function buildSpecPatch(
  source: DoorStyleSpecValues,
  groups: readonly SpecGroupId[],
): DoorStyleSpecPatch {
  const selected = new Set(groups);
  const patch: DoorStyleSpecPatch = {};
  for (const group of SPEC_GROUPS) {
    if (!selected.has(group.id)) continue;
    for (const field of GROUP_FIELDS[group.id]) {
      patch[field] = source[field] as never;
    }
  }
  return patch;
}

/**
 * Batch frame copies use the same complete-frame rule as the editor save:
 * positive rail and stile require the official citation that will be copied.
 * Image source notes are not a substitute here, because they are not copied.
 */
export function frameCopyBlockReason(
  source: DoorStyleSpecValues,
  groups: readonly SpecGroupId[],
): string | null {
  if (!groups.includes("frame")) return null;
  const complete = source.railWidth != null && source.stileWidth != null;
  if (complete && !source.sourceSpecification?.trim())
    return FRAME_CITATION_REQUIRED;
  return null;
}

export function stylesWillChangeLabel(count: number): string {
  return `${count} style${count === 1 ? "" : "s"} will change`;
}

export function specGroupLabels(groups: readonly SpecGroupId[]): string[] {
  const selected = new Set(groups);
  return SPEC_GROUPS.filter((group) => selected.has(group.id)).map(
    (group) => group.label,
  );
}

export function specBatchToast(
  saved: number,
  failed: number,
): { kind: "success" | "error"; message: string } {
  if (failed === 0) {
    return {
      kind: "success",
      message: `Style updated. Applied specs to ${saved} other style${saved === 1 ? "" : "s"}.`,
    };
  }
  const total = saved + failed;
  return {
    kind: "error",
    message: `Style updated. Applied specs to ${saved} of ${total} other styles. ${failed} failed.`,
  };
}

export async function applySpecPatchToStyles(
  updateStyle: (input: { id: number } & DoorStyleSpecPatch) => Promise<unknown>,
  styleIds: readonly number[],
  patch: DoorStyleSpecPatch,
): Promise<{ saved: number; failed: number }> {
  if (styleIds.length === 0 || Object.keys(patch).length === 0)
    return { saved: 0, failed: 0 };
  const results = await Promise.allSettled(
    styleIds.map((id) => updateStyle({ id, ...patch })),
  );
  const saved = results.filter(
    (result) => result.status === "fulfilled",
  ).length;
  return { saved, failed: results.length - saved };
}

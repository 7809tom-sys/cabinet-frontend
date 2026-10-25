import {
  glassStackerParentPlacement,
  glassStackerFamily,
  isGlassDoorCabinet,
  isStacker,
  resolvedDesignCabinetDimensions,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";

export type GlassStackerBulkPlacementCandidate = {
  parentUid: string;
  parentCode: string;
  stacker: PlacedCabinet;
};

export type GlassStackerBulkHeightOption = {
  height: number;
  candidates: GlassStackerBulkPlacementCandidate[];
};

export type GlassStackerCeilingBlock = {
  parentUid: string;
  parentCode: string;
  requiredTop: number;
  ceiling: number;
};

/**
 * A stacker must match the structural wall family below it before width is
 * considered. Width alone is not a safe compatibility rule: DCW/WDC diagonal
 * corner cabinets and ordinary W wall cabinets can both be 24 inches wide but
 * are not interchangeable products.
 */
function isMatchingStackerFamily(parent: Pick<PlacedCabinet, "masterCode">, stacker: Pick<PlacedCabinet, "masterCode">): boolean {
  const stackerFamily = glassStackerFamily(stacker);
  const parentFamily = glassStackerFamily(parent);
  return stackerFamily != null && stackerFamily === parentFamily;
}

/**
 * Identifies only actual glass stackers that have a saved parent relationship.
 * This deliberately retains the parent wall cabinet, ordinary glass uppers,
 * and any unstacked cabinet in the design.
 */
export function glassStackerUidsForRemoval(placed: readonly PlacedCabinet[]): string[] {
  return placed.flatMap((cabinet) => (
    cabinet.placement === "wall" &&
    cabinet.stackedOnCabinetUid != null &&
    isStacker(cabinet) &&
    isGlassDoorCabinet(cabinet)
      ? [cabinet.uid]
      : []
  ));
}

function stackerDraft(source: PlacedCabinet, catalog: DesignCabinet, parent: PlacedCabinet): PlacedCabinet {
  const dimensions = resolvedDesignCabinetDimensions(catalog);
  // Preserve the selected finish/style but never copy the source cabinet's
  // corner geometry onto a different catalog stacker. A DCW source must not
  // make a listed straight W stacker render as a diagonal cabinet.
  const {
    mountBottom: _mountBottom,
    mountBottomAdjusted: _mountBottomAdjusted,
    stackedOnCabinetUid: _stackedOnCabinetUid,
    cornerType: _cornerType,
    isCornerCabinet: _isCornerCabinet,
    cornerSnapUnlocked: _cornerSnapUnlocked,
    pullMin: _pullMin,
    pullMax: _pullMax,
    blindPull: _blindPull,
    ...base
  } = source;
  return {
    ...base,
    uid: `glass-stacker-bulk-${parent.uid}`,
    cabinetId: catalog.id,
    masterCode: catalog.masterCode,
    description: catalog.description,
    category: catalog.category ?? null,
    subCategory: catalog.subCategory ?? null,
    x: parent.x,
    y: parent.y,
    width: dimensions.width,
    nominalWidth: dimensions.width,
    depth: dimensions.depth,
    nominalDepth: dimensions.depth,
    height: dimensions.height,
    nominalHeight: dimensions.height,
    rotation: parent.rotation,
    wallId: parent.wallId,
    wallOffset: parent.wallOffset,
    peninsulaSide: parent.peninsulaSide,
    numberOfDoors: catalog.numberOfDoors,
    numberOfDrawers: catalog.numberOfDrawers,
    isCornerCabinet: catalog.isCornerCabinet ?? null,
    cornerType: catalog.cornerType ?? null,
    pullMin: catalog.pullMin ?? null,
    pullMax: catalog.pullMax ?? null,
    catalogImageUrl: catalog.catalogImageUrl ?? null,
    fixedShelfCount: (catalog as any).numberOfFixedShelves ?? null,
    adjustableShelfCount: (catalog as any).numberOfAdjShelves ?? null,
    customProfile: (catalog as any).graphicType ?? null,
    genericDrawingUrl: (catalog as any).specImageUrl ?? null,
    glassDoor: true,
    glassIncluded: catalog.glassIncluded ?? null,
    glassDoorAddonCode: catalog.glassDoorAddonCode ?? null,
  };
}

/**
 * The selected stacker is already a purchasable, placed catalog product. It is
 * therefore a safe fallback for another same-width compatible parent while the
 * full wall-cabinet pool is still loading or lacks a separately listed variant.
 */
function sourceStackerDraft(source: PlacedCabinet, parent: PlacedCabinet): PlacedCabinet {
  const { mountBottom: _mountBottom, mountBottomAdjusted: _mountBottomAdjusted, stackedOnCabinetUid: _stackedOnCabinetUid, ...base } = source;
  return {
    ...base,
    uid: `glass-stacker-bulk-${parent.uid}`,
    x: parent.x,
    y: parent.y,
    rotation: parent.rotation,
    wallId: parent.wallId,
    wallOffset: parent.wallOffset,
    peninsulaSide: parent.peninsulaSide,
    glassDoor: true,
  };
}

/**
 * Finds the exact same-height glass stacker catalog item that can sit above
 * every compatible wall cabinet. The original selected stacker remains in the
 * plan; candidates represent only the additional matching upper stacks.
 */
export function glassStackerBulkPlacementCandidates(
  placed: PlacedCabinet[],
  sourceStackerUid: string,
  room: RoomData,
  stackerCatalog: DesignCabinet[],
): GlassStackerBulkPlacementCandidate[] {
  const source = placed.find((cabinet) => cabinet.uid === sourceStackerUid);
  if (!source || !isStacker(source) || !isGlassDoorCabinet(source)) return [];

  const sourceHeight = Number(source.height);
  const occupiedParentUids = new Set(
    placed.flatMap((cabinet) => cabinet.stackedOnCabinetUid ? [cabinet.stackedOnCabinetUid] : []),
  );
  const glassStackerCatalog = stackerCatalog.filter((catalog) => {
    const dimensions = resolvedDesignCabinetDimensions(catalog);
    return catalog.placement === "wall" &&
      isStacker({ ...catalog, height: dimensions.height }) &&
      isGlassDoorCabinet(catalog) &&
      Math.abs(dimensions.height - sourceHeight) <= 0.5;
  });

  return placed.flatMap((parent) => {
    if (
      parent.uid === source.stackedOnCabinetUid ||
      parent.placement !== "wall" ||
      parent.islandFace ||
      parent.noDoor === true ||
      isStacker(parent) ||
      occupiedParentUids.has(parent.uid)
    ) return [];

    const matchingCatalog = glassStackerCatalog.filter((catalog) => {
      const dimensions = resolvedDesignCabinetDimensions(catalog);
      return Math.abs(dimensions.width - Number(parent.width)) <= 0.5 &&
        isMatchingStackerFamily(parent, catalog);
    });
    const drafts = matchingCatalog.map((catalog) => stackerDraft(source, catalog, parent));
    if (
      drafts.length === 0 &&
      Math.abs(Number(source.width) - Number(parent.width)) <= 0.5 &&
      isMatchingStackerFamily(parent, source)
    ) {
      drafts.push(sourceStackerDraft(source, parent));
    }

    for (const draft of drafts) {
      const placement = glassStackerParentPlacement(draft, placed, room, parent.uid);
      if (placement.ok && placement.parentUid === parent.uid) {
        return [{
          parentUid: parent.uid,
          parentCode: parent.masterCode,
          stacker: {
            ...draft,
            x: placement.x,
            y: placement.y,
            rotation: placement.rotation,
            mountBottom: placement.mountBottom,
            stackedOnCabinetUid: placement.parentUid,
          },
        }];
      }
    }
    return [];
  });
}

/**
 * Lists only real selected-vendor glass-stacker heights that can be added now.
 * Unlike the post-placement flow, this deliberately does not fall back to an
 * arbitrary source stacker: every offered height must exist in the active
 * vendor/style catalog and match the eligible parent cabinet width.
 */
export function glassStackerBulkHeightOptions(
  placed: PlacedCabinet[],
  room: RoomData,
  stackerCatalog: DesignCabinet[],
): GlassStackerBulkHeightOption[] {
  const occupiedParentUids = new Set(
    placed.flatMap((cabinet) => cabinet.stackedOnCabinetUid ? [cabinet.stackedOnCabinetUid] : []),
  );
  const vendorStackers = stackerCatalog.filter((catalog) => {
    const dimensions = resolvedDesignCabinetDimensions(catalog);
    return catalog.placement === "wall" &&
      isStacker({ ...catalog, height: dimensions.height }) &&
      isGlassDoorCabinet(catalog) &&
      dimensions.height >= 12 && dimensions.height <= 24;
  });
  const heights = Array.from(new Set(vendorStackers.map((catalog) => resolvedDesignCabinetDimensions(catalog).height)))
    .sort((left, right) => left - right);

  return heights.flatMap((height) => {
    const candidates = placed.flatMap((parent) => {
      if (
        parent.placement !== "wall" ||
        parent.islandFace ||
        parent.noDoor === true ||
        isStacker(parent) ||
        occupiedParentUids.has(parent.uid)
      ) return [];
      const catalogChoices = vendorStackers.filter((catalog) => {
        const dimensions = resolvedDesignCabinetDimensions(catalog);
        return Math.abs(dimensions.height - height) <= 0.5 &&
          Math.abs(dimensions.width - Number(parent.width)) <= 0.5 &&
          isMatchingStackerFamily(parent, catalog);
      });
      for (const catalog of catalogChoices) {
        const draft = stackerDraft(parent, catalog, parent);
        const placement = glassStackerParentPlacement(draft, placed, room, parent.uid);
        if (placement.ok && placement.parentUid === parent.uid) {
          return [{
            parentUid: parent.uid,
            parentCode: parent.masterCode,
            stacker: {
              ...draft,
              x: placement.x,
              y: placement.y,
              rotation: placement.rotation,
              mountBottom: placement.mountBottom,
              stackedOnCabinetUid: placement.parentUid,
              depthPositionAdjusted: true,
            },
          }];
        }
      }
      return [];
    });
    return candidates.length > 0 ? [{ height, candidates }] : [];
  });
}

/**
 * Reports compatible cabinets that would accept the selected stacker family,
 * but cannot physically receive it because the cabinet already reaches the
 * configured ceiling. The bulk action uses this to explain a skipped WDC42
 * corner rather than silently omitting it from a 12-inch stacker operation.
 */
export function glassStackerBulkCeilingBlocksAtHeight(
  placed: PlacedCabinet[],
  room: RoomData,
  stackerCatalog: DesignCabinet[],
  height: number,
): GlassStackerCeilingBlock[] {
  const occupiedParentUids = new Set(
    placed.flatMap((cabinet) => cabinet.stackedOnCabinetUid ? [cabinet.stackedOnCabinetUid] : []),
  );
  const stackersAtHeight = stackerCatalog.filter((catalog) => {
    const dimensions = resolvedDesignCabinetDimensions(catalog);
    return catalog.placement === "wall" &&
      isStacker({ ...catalog, height: dimensions.height }) &&
      isGlassDoorCabinet(catalog) &&
      Math.abs(dimensions.height - height) <= 0.5;
  });

  return placed.flatMap((parent) => {
    if (
      parent.placement !== "wall" ||
      parent.islandFace ||
      parent.noDoor === true ||
      isStacker(parent) ||
      occupiedParentUids.has(parent.uid)
    ) return [];

    for (const catalog of stackersAtHeight) {
      const dimensions = resolvedDesignCabinetDimensions(catalog);
      if (Math.abs(dimensions.width - Number(parent.width)) > 0.5) continue;
      if (!isMatchingStackerFamily(parent, catalog)) continue;
      const placement = glassStackerParentPlacement(stackerDraft(parent, catalog, parent), placed, room, parent.uid);
      if (
        !placement.ok &&
        placement.reason === "ceiling" &&
        placement.parentCode === parent.masterCode &&
        typeof placement.requiredTop === "number" &&
        typeof placement.ceiling === "number"
      ) {
        return [{
          parentUid: parent.uid,
          parentCode: parent.masterCode,
          requiredTop: placement.requiredTop,
          ceiling: placement.ceiling,
        }];
      }
    }
    return [];
  });
}

/**
 * Candidates are normally rebuilt from the catalog just before the dialog
 * opens. This final guard also handles a prompt held open across a hot reload
 * or design restore, so stale diagonal metadata cannot alter a straight W
 * stacker's shape during the actual write.
 */
function normalizeStackerGeometryForApply(stacker: PlacedCabinet): PlacedCabinet {
  const family = glassStackerFamily(stacker);
  if (family === "W") {
    return {
      ...stacker,
      isCornerCabinet: false,
      cornerType: null,
      pullMin: null,
      pullMax: null,
      blindPull: null,
      cornerSnapUnlocked: undefined,
    };
  }
  if (family === "WDC") {
    return {
      ...stacker,
      isCornerCabinet: true,
      cornerType: stacker.cornerType ?? "diagonal",
    };
  }
  return stacker;
}

export function applyGlassStackerBulkPlacement(
  placed: PlacedCabinet[],
  candidates: GlassStackerBulkPlacementCandidate[],
  makeUid: () => string,
): PlacedCabinet[] {
  const existingParents = new Set(
    placed.flatMap((cabinet) => cabinet.stackedOnCabinetUid ? [cabinet.stackedOnCabinetUid] : []),
  );
  const additional = candidates.flatMap((candidate) => {
    if (existingParents.has(candidate.parentUid)) return [];
    existingParents.add(candidate.parentUid);
    return [{ ...normalizeStackerGeometryForApply(candidate.stacker), uid: makeUid() }];
  });
  return [...placed, ...additional];
}

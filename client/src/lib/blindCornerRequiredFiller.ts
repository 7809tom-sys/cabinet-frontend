import {
  BLIND_CORNER_FILLER_WIDTH_IN,
  STD,
  blindCornerAutoFiller,
  isBaseBlindCorner,
  isBlindCorner,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { isWallBlindCornerCabinet } from "./cabinetGraphics";
import {
  catalogFillerForGap,
  fittedCatalogFillerDescription,
  isCatalogFiller,
  type CatalogFillerCandidate,
} from "./catalogFiller";
import { installedFillerVerticalSpec, removePlacedCabinetGroup } from "./smallGapFiller";

export type RequiredBlindCornerFillerResult =
  | { ok: true; filler: PlacedCabinet }
  | { ok: false; reason: "not-blind" | "missing-catalog-filler" | "invalid-corner" };

function finite(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function requiredBlindCornerFillerGroupId(
  blind: Pick<PlacedCabinet, "uid" | "masterCode" | "description">,
) {
  return `${isWallBlindCornerCabinet(blind) ? "wbc" : "bbc"}-required-filler-${blind.uid}`;
}

export function isRequiredBlindCornerFillerGroupId(groupId: string | null | undefined) {
  return /^(?:bbc|wbc)-required-filler-/.test(groupId ?? "");
}

/**
 * Cabinet Config controls the WBC filler independently from the BBC rule.
 * A base blind corner always carries its base-side clearance filler; a wall
 * blind receives the integrated left face filler only when the live catalog
 * row says it is required. This deliberately does not give a WBC any BBC pull
 * behavior.
 */
export function requiresConfiguredBlindCornerFiller(
  blind: Pick<PlacedCabinet, "masterCode" | "description" | "placement" | "fillerRequired">,
) {
  return isBaseBlindCorner(blind)
    || (isWallBlindCornerCabinet(blind) && blind.fillerRequired === true);
}

function wallBlindCornerCatalogFiller(
  candidates: readonly CatalogFillerCandidate[],
  cabinetHeight: number,
) {
  return candidates
    .filter(isCatalogFiller)
    .filter((candidate) => finite(candidate.width, 0) + 0.001 >= BLIND_CORNER_FILLER_WIDTH_IN)
    .sort((left, right) => {
      const widthDelta = finite(left.width, 0) - finite(right.width, 0);
      if (Math.abs(widthDelta) > 0.001) return widthDelta;
      const heightDelta = Math.abs(finite(left.height, cabinetHeight) - cabinetHeight)
        - Math.abs(finite(right.height, cabinetHeight) - cabinetHeight);
      if (Math.abs(heightDelta) > 0.001) return heightDelta;
      return left.masterCode.localeCompare(right.masterCode);
    })[0] ?? null;
}

/**
 * Builds the required three-inch, catalog-backed filler on the perpendicular
 * run at a BBC's open-side front. The installed footprint reserves the full
 * base depth for countertop support and zero-overlap placement; the active
 * catalog item remains the billing, pricing, finish, and cart identity.
 */
export function buildRequiredBlindCornerFiller(
  blind: PlacedCabinet,
  room: RoomData,
  candidates: readonly CatalogFillerCandidate[],
  makeUid: () => string,
  styleId: number | null,
): RequiredBlindCornerFillerResult {
  if (!isBlindCorner(blind.masterCode, blind.description) || !requiresConfiguredBlindCornerFiller(blind)) {
    return { ok: false, reason: "not-blind" };
  }
  const wallBlind = isWallBlindCornerCabinet(blind);
  const placement = wallBlind ? "wall" : "base";
  const catalog = wallBlind
    ? wallBlindCornerCatalogFiller(candidates, finite(blind.height, STD.WALL_HEIGHT))
    : catalogFillerForGap(candidates, BLIND_CORNER_FILLER_WIDTH_IN, placement);
  if (!catalog) return { ok: false, reason: "missing-catalog-filler" };
  if (wallBlind) {
    const catalogWidth = finite(catalog.width, BLIND_CORNER_FILLER_WIDTH_IN);
    const height = installedFillerVerticalSpec("wall", finite(blind.height, STD.WALL_HEIGHT)).storedHeight;
    return {
      ok: true,
      filler: {
        uid: makeUid(),
        cabinetId: catalog.id,
        masterCode: catalog.masterCode,
        description: `${fittedCatalogFillerDescription(catalog, BLIND_CORNER_FILLER_WIDTH_IN)} — integrated left of WBC door`,
        category: catalog.category ?? "Filler",
        subCategory: catalog.subCategory ?? "Filler",
        placement: "wall",
        x: blind.x,
        y: blind.y,
        width: BLIND_CORNER_FILLER_WIDTH_IN,
        nominalWidth: catalogWidth,
        depth: 0,
        nominalDepth: finite(catalog.depth, STD.WALL_DEPTH),
        height,
        nominalHeight: height,
        mountBottom: blind.mountBottom ?? null,
        rotation: blind.rotation,
        numberOfDoors: 0,
        numberOfDrawers: 0,
        catalogImageUrl: catalog.catalogImageUrl ?? null,
        styleId,
        fillerPieceGroupId: requiredBlindCornerFillerGroupId(blind),
        fillerBillingRole: "primary",
        fillerTotalWidth: BLIND_CORNER_FILLER_WIDTH_IN,
        fillerPlacementMode: "left",
        fillerForCabinetUid: blind.uid,
        integratedWallBlindFiller: true,
      },
    };
  }
  const layout = blindCornerAutoFiller(blind, room, makeUid);
  if (!layout.filler) return { ok: false, reason: "invalid-corner" };

  const catalogWidth = finite(catalog.width, BLIND_CORNER_FILLER_WIDTH_IN);
  const height = installedFillerVerticalSpec("base", finite(blind.height, STD.BASE_HEIGHT)).storedHeight;
  return {
    ok: true,
    filler: {
      ...layout.filler,
      cabinetId: catalog.id,
      masterCode: catalog.masterCode,
	      // Avoid the literal phrase "blind corner" here: that phrase is an
	      // intentional legacy classifier for cabinet records and would inflate
	      // this real 3-by-24 filler into a BBC footprint.
	      description: `${fittedCatalogFillerDescription(catalog, BLIND_CORNER_FILLER_WIDTH_IN)} — required BBC clearance`,
      category: catalog.category ?? "Filler",
      subCategory: catalog.subCategory ?? "Filler",
      width: BLIND_CORNER_FILLER_WIDTH_IN,
      nominalWidth: catalogWidth,
      // Reserve the full base run physically. The renderer already presents
      // fitted fillers as trim/panel geometry and spans their countertop.
      depth: STD.BASE_DEPTH,
      nominalDepth: finite(catalog.depth, STD.BASE_DEPTH),
      height,
      nominalHeight: height,
      mountBottom: blind.mountBottom ?? 0,
      numberOfDoors: 0,
      numberOfDrawers: 0,
      catalogImageUrl: catalog.catalogImageUrl ?? null,
      styleId,
      fillerPieceGroupId: requiredBlindCornerFillerGroupId(blind),
	      fillerPlacementMode: layout.filler.fillerPlacementMode ?? "right",
      fillerTotalWidth: BLIND_CORNER_FILLER_WIDTH_IN,
      fillerForCabinetUid: blind.uid,
    },
  };
}

/**
 * Removes a BBC and its one required catalog filler as a single saved-design
 * assembly. Selecting the filler itself removes the owning BBC too; unrelated
 * small-gap filler groups retain their existing group-removal behavior.
 */
export function removePlacedCabinetWithRequiredBlindCornerFiller(
  placed: PlacedCabinet[],
  uid: string,
): PlacedCabinet[] {
  const selected = placed.find((item) => item.uid === uid);
  if (!selected) return placed;
  const directGroupId = requiredBlindCornerFillerGroupId(selected);
  const selectedRequiredGroupId = isRequiredBlindCornerFillerGroupId(selected.fillerPieceGroupId)
    ? selected.fillerPieceGroupId
    : null;
  const groupId = isBlindCorner(selected.masterCode, selected.description)
    ? directGroupId
    : selectedRequiredGroupId;
  if (!groupId) return removePlacedCabinetGroup(placed, uid);
  const blindUid = groupId.replace(/^(?:bbc|wbc)-required-filler-/, "");
  return placed.filter((item) => item.uid !== blindUid && item.fillerPieceGroupId !== groupId);
}

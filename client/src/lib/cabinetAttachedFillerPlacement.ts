import {
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  matchInstalledFillerToCabinet,
  wallPlacementAt,
} from "@/lib/design";
import {
  attachedFillerPlanForCandidate,
  type AttachedFillerChoice,
  type AttachedFillerPlan,
} from "@/lib/cabinetAttachedFillers";
import {
  catalogFillerForGap,
  fittedCatalogFillerDescription,
  type CatalogFillerCandidate,
} from "@/lib/catalogFiller";
import { installedFillerVerticalSpec } from "@/lib/smallGapFiller";

export type AttachedFillerPlacementResult =
  | {
      ok: true;
      plan: AttachedFillerPlan;
      cabinet: PlacedCabinet;
      fillers: PlacedCabinet[];
    }
  | { ok: false; reason: string };

/**
 * Builds one atomic, regular-Designer cabinet + attached-filler proposal.
 * Every physical strip resolves to an existing CabinetDealz catalog board; an
 * installed short strip is a field cut, never an invented short SKU or price.
 */
export function buildAttachedFillerPlacement({
  cabinet,
  placed,
  room,
  choice,
  catalogFillers,
  makeUid,
  styleId,
}: {
  cabinet: PlacedCabinet;
  placed: readonly PlacedCabinet[];
  room: RoomData;
  choice: AttachedFillerChoice;
  catalogFillers: readonly CatalogFillerCandidate[];
  makeUid: () => string;
  styleId: number | null;
}): AttachedFillerPlacementResult {
  const plan = attachedFillerPlanForCandidate(cabinet, placed, room, choice);
  if (!plan) return { ok: false, reason: "The chosen attached filler no longer fits the measured, bounded cabinet run." };

  const cabinetSpot = wallPlacementAt(
    plan.cabinetStartIn,
    plan.cabinetSpanIn,
    cabinet.depth,
    plan.wall,
    room,
    cabinet.peninsulaSide,
  );
  const positionedCabinet: PlacedCabinet = {
    ...cabinet,
    x: cabinetSpot.x,
    y: cabinetSpot.y,
    rotation: cabinetSpot.rotation,
    ...(cabinetSpot.wallId ? {
      wallId: cabinetSpot.wallId,
      wallOffset: cabinetSpot.wallOffset,
      peninsulaSide: cabinetSpot.peninsulaSide,
    } : {}),
  };

  const fillers: PlacedCabinet[] = [];
  for (const piece of plan.pieces) {
    const stock = catalogFillerForGap(catalogFillers, piece.widthIn, plan.placement);
    if (!stock) {
      return {
        ok: false,
        reason: `No active CabinetDealz ${plan.placement} filler stock can cover the selected ${piece.widthIn} inch ${piece.side} field cut.`,
      };
    }
    const stockDepth = Number(stock.depth) || (plan.placement === "wall" ? 12 : 24);
    const vertical = installedFillerVerticalSpec(
      plan.placement,
      Number(positionedCabinet.height) || (plan.placement === "wall" ? 30 : plan.placement === "tall" ? 96 : 34.5),
    );
    const groupId = `attached-filler-${positionedCabinet.uid}-${piece.side}-${makeUid()}`;
    const raw: PlacedCabinet = {
      uid: makeUid(),
      cabinetId: stock.id,
      masterCode: stock.masterCode,
      description: `${fittedCatalogFillerDescription(stock, piece.widthIn)} — attached ${piece.side} field cut from this CabinetDealz stock board`,
      category: stock.category ?? "Filler",
      subCategory: stock.subCategory ?? "Filler",
      placement: plan.placement,
      x: 0,
      y: 0,
      width: piece.widthIn,
      nominalWidth: Number(stock.width) || piece.widthIn,
      depth: stockDepth,
      nominalDepth: stockDepth,
      height: vertical.storedHeight,
      nominalHeight: Number(stock.height) || vertical.storedHeight,
      rotation: 0,
      numberOfDoors: 0,
      numberOfDrawers: 0,
      catalogImageUrl: stock.catalogImageUrl ?? null,
      styleId,
      fillerPieceGroupId: groupId,
      fillerBillingRole: "primary",
      fillerTotalWidth: piece.widthIn,
      fillerPlacementMode: piece.side,
      fillerForCabinetUid: positionedCabinet.uid,
      fillerAttachmentSide: piece.side,
      fillerNeedsReview: false,
    };
    const matched = matchInstalledFillerToCabinet(raw, positionedCabinet, room);
    const fillerSpot = wallPlacementAt(piece.startIn, piece.widthIn, matched.depth, plan.wall, room, positionedCabinet.peninsulaSide);
    fillers.push({
      ...matched,
      x: fillerSpot.x,
      y: fillerSpot.y,
      rotation: fillerSpot.rotation,
      ...(fillerSpot.wallId ? {
        wallId: fillerSpot.wallId,
        wallOffset: fillerSpot.wallOffset,
        peninsulaSide: fillerSpot.peninsulaSide,
      } : {}),
    });
  }

  return { ok: true, plan, cabinet: positionedCabinet, fillers };
}

/** True only for ordinary regular-Designer cabinet types with an optional chooser. */
export function supportsAttachedFillerChoice(cabinet: Pick<DesignCabinet, "placement" | "masterCode" | "description">) {
  return cabinet.placement === "base" || cabinet.placement === "wall" || cabinet.placement === "tall";
}

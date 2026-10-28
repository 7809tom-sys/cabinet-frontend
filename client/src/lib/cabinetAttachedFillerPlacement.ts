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
  if (!plan) return { ok: false, reason: attachedFillerDoesNotFitReason(cabinet, placed, room, choice) };

  const cabinetSpot = wallPlacementAt(
    plan.cabinetStartIn,
    plan.cabinetSpanIn,
    cabinet.depth,
    plan.wall,
    room,
    cabinet.peninsulaSide,
  );
  // A corner cabinet keeps its exact corner seat; only its leg fillers are added.
  const positionedCabinet: PlacedCabinet = plan.cornerCabinet ? cabinet : {
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
    const pieceWall = piece.wall ?? plan.wall;
    const attachmentSide = piece.attachmentSide ?? piece.side;
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
      fillerPlacementMode: attachmentSide,
      fillerForCabinetUid: positionedCabinet.uid,
      fillerAttachmentSide: attachmentSide,
      fillerNeedsReview: false,
    };
    const matched = matchInstalledFillerToCabinet(raw, positionedCabinet, room);
    const fillerSpot = wallPlacementAt(piece.startIn, piece.widthIn, matched.depth, pieceWall, room, pieceWall === plan.wall ? positionedCabinet.peninsulaSide : undefined);
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

function inches(value: number) {
  const rounded = Math.round(value * 8) / 8;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(3).replace(/0+$/, "")}"`;
}

/** Explains a refused filler choice with the real free space on each side. */
export function attachedFillerDoesNotFitReason(
  cabinet: PlacedCabinet,
  placed: readonly PlacedCabinet[],
  room: RoomData,
  choice: AttachedFillerChoice,
): string {
  const chosen = [
    choice.leftIn > 0 ? `left ${inches(choice.leftIn)}` : null,
    choice.rightIn > 0 ? `right ${inches(choice.rightIn)}` : null,
  ].filter(Boolean).join(" and ");
  if (choice.leftIn > 6 || choice.rightIn > 6) return `A filler can be ⅛" to 6" wide; ${chosen} was not placed.`;
  const free = attachedFillerPlanForCandidate(cabinet, placed, room);
  if (!free) return `The ${chosen} filler does not fit beside ${cabinet.masterCode}.`;
  const space = free.cornerCabinet
    ? `left ${inches(free.leftGapIn)}, right ${inches(free.rightGapIn)}`
    : `${inches(free.availableFillerIn)} in total (left ${inches(free.leftGapIn)}, right ${inches(free.rightGapIn)})`;
  return `The ${chosen} filler does not fit beside ${cabinet.masterCode}: the free space is ${space} before the next wall or cabinet.`;
}

/** True only for ordinary regular-Designer cabinet types with an optional chooser. */
export function supportsAttachedFillerChoice(cabinet: Pick<DesignCabinet, "placement" | "masterCode" | "description">) {
  return cabinet.placement === "base" || cabinet.placement === "wall" || cabinet.placement === "tall";
}

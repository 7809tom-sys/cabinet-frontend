import { catalogFillerForGap, type CatalogFillerCandidate } from "@/lib/catalogFiller";
import {
  cabinetWall,
  isRefrigerator,
  isRefrigeratorWallCabinet,
  placedFootprint,
  refrigeratorAssemblyMemberRole,
  type IslandZone,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
} from "@/lib/design";
import {
  findIslandSmallGapFillerOpportunity,
  findSmallGapFillerOpportunity,
  type SmallGapFillerOpportunity,
} from "@/lib/smallGapFiller";

export type PreSavePlanReviewAction =
  | { kind: "filler"; opportunity: SmallGapFillerOpportunity; fillerCode: string }
  | { kind: "refrigerator"; refrigeratorUid: string; replaceCabinetUid?: string; replaceCabinetCode?: string }
  | { kind: "issue"; cabinetUid: string };

export type PreSavePlanReviewFinding = {
  id: string;
  severity: "recommendation" | "attention";
  title: string;
  description: string;
  actionLabel: string;
  action: PreSavePlanReviewAction;
};

export type PreSavePlanReview = {
  findings: PreSavePlanReviewFinding[];
};

export type PreSavePlanReviewInput = {
  room: RoomData;
  placed: readonly PlacedCabinet[];
  openings: readonly WallOpening[];
  island: IslandZone | null;
  catalogFillers: readonly CatalogFillerCandidate[];
  conflictUids: ReadonlySet<string>;
};

/**
 * Finds an ordinary wall cabinet sitting across a refrigerator's measured wall
 * span. It deliberately ignores dedicated refrigerator-wall/bridge cabinets:
 * only the ordinary upper needs an approval-based replacement recommendation.
 */
export function unsuitableWallCabinetAboveRefrigerator(
  refrigerator: PlacedCabinet,
  placed: readonly PlacedCabinet[],
  room: RoomData,
): PlacedCabinet | null {
  const refrigeratorWall = cabinetWall(refrigerator, room);
  const refrigeratorFootprint = placedFootprint(refrigerator);
  const horizontal = refrigeratorWall === "top" || refrigeratorWall === "bottom";
  const refrigeratorStart = horizontal ? refrigerator.x : refrigerator.y;
  const refrigeratorSpan = horizontal ? refrigeratorFootprint.w : refrigeratorFootprint.d;
  const refrigeratorEnd = refrigeratorStart + refrigeratorSpan;

  return placed.find((member) => {
    if (member.uid === refrigerator.uid || member.placement !== "wall") return false;
    if (cabinetWall(member, room) !== refrigeratorWall || isRefrigeratorWallCabinet(member)) return false;
    const memberFootprint = placedFootprint(member);
    const memberStart = horizontal ? member.x : member.y;
    const memberSpan = horizontal ? memberFootprint.w : memberFootprint.d;
    return memberStart < refrigeratorEnd && memberStart + memberSpan > refrigeratorStart;
  }) ?? null;
}

/**
 * Builds a pre-save construction review strictly from the existing, measured
 * plan. The review never changes the design itself; callers decide whether to
 * open the existing filler, refrigerator, or selected-cabinet workflow.
 */
export function buildPreSavePlanReview({
  room,
  placed,
  openings,
  island,
  catalogFillers,
  conflictUids,
}: PreSavePlanReviewInput): PreSavePlanReview {
  const findings: PreSavePlanReviewFinding[] = [];
  const recordedFillers = new Set<string>();

  for (const cabinet of placed) {
    const opportunity = cabinet.islandFace && island
      ? findIslandSmallGapFillerOpportunity(island, placed, cabinet.uid)
      : findSmallGapFillerOpportunity(room, placed, openings, cabinet.uid);
    if (!opportunity) continue;

    const filler = catalogFillerForGap(catalogFillers, opportunity.remaining, opportunity.layer);
    const uniqueOpening = `${opportunity.islandFace ?? opportunity.wall}:${opportunity.layer}:${opportunity.openingStart}:${opportunity.openingLength}`;
    if (!filler || recordedFillers.has(uniqueOpening)) continue;
    recordedFillers.add(uniqueOpening);
    findings.push({
      id: `filler:${cabinet.uid}:${uniqueOpening}`,
      severity: "recommendation",
      title: `Finish a ${opportunity.remaining}\" gap with ${filler.masterCode}`,
      description: `${cabinet.masterCode} nearly fills this measured ${opportunity.layer} opening. Review the existing left, right, or split filler choices before saving.`,
      actionLabel: "Review filler",
      action: { kind: "filler", opportunity, fillerCode: filler.masterCode },
    });
  }

  for (const refrigerator of placed.filter(isRefrigerator)) {
    const hasOverFridgeCabinet = placed.some((member) =>
      member.uid !== refrigerator.uid && refrigeratorAssemblyMemberRole(member, refrigerator, room) === "bridge",
    );
    if (hasOverFridgeCabinet) continue;
    const unsuitableWallCabinet = unsuitableWallCabinetAboveRefrigerator(refrigerator, placed, room);
    findings.push({
      id: `refrigerator:${refrigerator.uid}`,
      severity: "recommendation",
      title: unsuitableWallCabinet
        ? `Review ${unsuitableWallCabinet.masterCode} above the refrigerator`
        : "Consider a cabinet above the refrigerator",
      description: unsuitableWallCabinet
        ? `${unsuitableWallCabinet.masterCode} crosses the refrigerator span but is not a dedicated over-refrigerator cabinet. Review a compatible replacement; the current cabinet remains until you approve the change.`
        : `${refrigerator.masterCode} does not yet have a dedicated over-refrigerator cabinet. Review the compatible enclosure options before saving.`,
      actionLabel: unsuitableWallCabinet ? "Review compatible replacement" : "Review refrigerator options",
      action: {
        kind: "refrigerator",
        refrigeratorUid: refrigerator.uid,
        ...(unsuitableWallCabinet ? { replaceCabinetUid: unsuitableWallCabinet.uid, replaceCabinetCode: unsuitableWallCabinet.masterCode } : {}),
      },
    });
  }

  for (const cabinetUid of Array.from(conflictUids)) {
    const cabinet = placed.find((item) => item.uid === cabinetUid);
    if (!cabinet) continue;
    findings.push({
      id: `attention:${cabinetUid}`,
      severity: "attention",
      title: `Review ${cabinet.masterCode} placement`,
      description: "This item has an unresolved clearance, overlap, corner, opening, or ceiling check. Review its measured placement before saving.",
      actionLabel: "Review placement",
      action: { kind: "issue", cabinetUid },
    });
  }

  return { findings };
}

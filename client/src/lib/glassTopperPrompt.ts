/**
 * Rule 12: ONE glass-topper (glass stacker) prompt populates every wall cabinet of matching width.
 *
 * The existing bulk placement engine (`glassStackerBulkPlacement.ts`) already finds the right
 * parents, but nothing guaranteed that a single prompt covers every matching wall cabinet of that
 * width on the plan: a cabinet whose parent link was never written was silently left bare. This
 * module is the prompt-level contract — one answer, every matching cabinet, with the ones that
 * could not take it named on the review list (never silently skipped).
 */
import {
  glassStackerBulkCeilingBlocksAtHeight,
  glassStackerBulkHeightOptions,
  glassStackerBulkPlacementCandidates,
  type GlassStackerBulkPlacementCandidate,
} from "./glassStackerBulkPlacement";
import { glassStackerFamily, glassStackerParentPlacement, isStacker, placedHeight, type DesignCabinet, type PlacedCabinet, type RoomData } from "./design";
import type { DesignerReviewFinding } from "./designerReviewFindings";

function numberOf(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function placedHeightOf(value: { height?: string | number | null }): number {
  const parsed = Number(value.height);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type GlassTopperPromptResult = {
  /** Every parent the one prompt fills. */
  candidates: GlassStackerBulkPlacementCandidate[];
  /** Review findings for cabinets of the matching width that could not take the topper. */
  findings: DesignerReviewFinding[];
  /** Wall cabinets of the matching width the prompt covers (candidates + reported misses). */
  matchingWidthCount: number;
};

/**
 * One prompt, every matching wall cabinet.
 *
 * `stackerSourceUid` is the stacker the user picked; a real vendor stacker of that height is used
 * for each parent. `stackerCatalog` is the selected line's stacker catalog so a parent of another
 * width still receives its own source SKU when one exists.
 */
export function fillEveryMatchingWallCabinetWithTopper(input: {
  placed: readonly PlacedCabinet[];
  stackerSourceUid: string;
  room: RoomData;
  stackerCatalog: readonly DesignCabinet[];
}): GlassTopperPromptResult {
  const source = input.placed.find((item) => item.uid === input.stackerSourceUid);
  if (!source || !isStacker(source)) return { candidates: [], findings: [], matchingWidthCount: 0 };
  const candidates = glassStackerBulkPlacementCandidates(
    [...input.placed],
    input.stackerSourceUid,
    input.room,
    [...input.stackerCatalog],
  );
  const filledParents = new Set(candidates.map((candidate) => candidate.parentUid));
  const sourceWidth = Number(source.width);
  const sourceHeight = placedHeight(source);
  // Every wall cabinet of the matching width that the prompt did NOT fill must be named.
  const matching = input.placed.filter((item) => (
    item.placement === "wall"
    && !item.islandFace
    && !isStacker(item)
    && item.noDoor !== true
    && !item.stackedOnCabinetUid
    && Math.abs(Number(item.width) - sourceWidth) <= 0.5
  ));
  const ceilingBlocks = glassStackerBulkCeilingBlocksAtHeight([...input.placed], input.room, [...input.stackerCatalog], sourceHeight);
  const findings: DesignerReviewFinding[] = [];
  for (const parent of matching) {
    if (filledParents.has(parent.uid)) continue;
    if (parent.uid === source.stackedOnCabinetUid) continue;
    // A parent whose family has no compatible stacker of this height is the common miss.
    const familyCompatible = [...input.stackerCatalog, source].some((candidate) => {
      if (Math.abs(numberOf(candidate.width) - Number(parent.width)) > 0.5) return false;
      if (Math.abs(placedHeightOf(candidate) - sourceHeight) > 0.5) return false;
      return glassStackerFamily(candidate) != null && glassStackerFamily(candidate) === glassStackerFamily(parent);
    });
    const block = ceilingBlocks.find((entry) => entry.parentUid === parent.uid);
    if (block) {
      findings.push({
        ruleId: "glass-topper-all-matching",
        code: "topper-blocked-by-ceiling",
        severity: "warning",
        title: `${parent.masterCode} cannot take the glass topper`,
        detail: `The topper needs ${block.requiredTop}″ and this wall is ${block.ceiling}″ high. Shorten the cabinet or raise the ceiling allowance.`,
        cabinetUid: parent.uid,
        cabinetCode: parent.masterCode,
      });
      continue;
    }
    findings.push({
      ruleId: "glass-topper-all-matching",
      code: familyCompatible ? "topper-blocked" : "topper-no-compatible-source",
      severity: "warning",
      title: `${parent.masterCode} has no matching glass topper`,
      detail: familyCompatible
        ? `The prompt covers every ${sourceWidth}″ wall cabinet, but the matching ${sourceHeight}″ glass stacker could not be seated on this cabinet.`
        : `The prompt covers every ${sourceWidth}″ wall cabinet, but this cabinet's family has no ${sourceHeight}″ glass stacker in the selected line.`,
      cabinetUid: parent.uid,
      cabinetCode: parent.masterCode,
    });
  }
  return { candidates, findings, matchingWidthCount: matching.length + (source.stackedOnCabinetUid ? 1 : 0) };
}

/**
 * Every real height the one prompt may offer. The prompt shows one list; the answer applies to all
 * matching wall cabinets at once.
 */
export function glassTopperPromptOptions(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  stackerCatalog: readonly DesignCabinet[];
}): number[] {
  return glassStackerBulkHeightOptions([...input.placed], input.room, [...input.stackerCatalog]).map((option) => option.height);
}

/** Names the parents a prompt will fill, so the dialog can say "all 4 matching wall cabinets". */
export function glassTopperPromptParentCodes(candidates: readonly GlassStackerBulkPlacementCandidate[]): string[] {
  return candidates.map((candidate) => candidate.parentCode);
}

/** True when a wall cabinet can take a topper at the given height without a collision. */
export function canTakeTopperAtHeight(input: {
  parent: PlacedCabinet;
  placed: readonly PlacedCabinet[];
  room: RoomData;
  stacker: PlacedCabinet;
}): boolean {
  const placement = glassStackerParentPlacement(input.stacker, [...input.placed], input.room, input.parent.uid);
  return placement.ok && placement.parentUid === input.parent.uid;
}

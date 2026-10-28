import type { PlacedCabinet } from "@/lib/design";
import { isFillerItem } from "@/lib/design";

/**
 * A cut at or below one inch is field-cut from a larger filler already on the
 * order when the group's installed cuts add up to more than 2.5 inches.
 */
export const COMBINED_FILLER_MAX_IN = 1;

/**
 * When the filler pieces in one group add up to this width or less, order one
 * stock filler and cut every piece from it.
 */
export const FILLER_CUT_GROUP_MAX_IN = 2.5;

const WIDTH_EPSILON_IN = 0.001;

export function installedFillerCutWidthIn(cabinet: Pick<PlacedCabinet, "width" | "fillerTotalWidth">): number {
  const cut = Number(cabinet.fillerTotalWidth);
  if (Number.isFinite(cut) && cut > 0) return cut;
  return Number(cabinet.width) || 0;
}

type FillerOrderPlan = {
  absorbed: Set<string>;
  sourceUid: Map<string, string>;
  noteByAbsorbed: Map<string, string>;
};

function orderableFillers(placed: readonly PlacedCabinet[]): PlacedCabinet[] {
  return placed.filter((cabinet) => isFillerItem(cabinet) && cabinet.fillerBillingRole !== "secondary");
}

/** Same door style, filler type, and stock SKU. One design is one job. */
function fillerGroupKey(cabinet: PlacedCabinet): string {
  const style = cabinet.styleId ?? "job";
  const layer = cabinet.placement ?? "base";
  return `${style}|${layer}|${cabinet.masterCode}`;
}

function stockWidthIn(members: readonly PlacedCabinet[]): number {
  const nominals = members
    .map((member) => Number(member.nominalWidth))
    .filter((width) => Number.isFinite(width) && width > 0);
  if (nominals.length > 0) return Math.max(...nominals);
  const widestCut = Math.max(...members.map(installedFillerCutWidthIn));
  return widestCut <= 3 + WIDTH_EPSILON_IN ? 3 : widestCut;
}

function pieceList(cuts: readonly number[]): string {
  const formatted = cuts.map(formatCut);
  if (formatted.length === 2 && formatted[0] === formatted[1]) return `two ${formatted[0]} pieces`;
  if (formatted.length === 1) return `${formatted[0]} piece`;
  return `${formatted.slice(0, -1).join(", ")} and ${formatted[formatted.length - 1]} pieces`;
}

export function fillerPiecesCutFromOneStockNote(cuts: readonly number[], stockIn: number): string {
  return `${pieceList(cuts)} cut from one ${formatCut(stockIn)} filler`;
}

function planFillerOrders(placed: readonly PlacedCabinet[]): FillerOrderPlan {
  const orderable = orderableFillers(placed);
  const absorbed = new Set<string>();
  const sourceUid = new Map<string, string>();
  const noteByAbsorbed = new Map<string, string>();
  const groups = new Map<string, PlacedCabinet[]>();

  for (const cabinet of orderable) {
    const key = fillerGroupKey(cabinet);
    const members = groups.get(key);
    if (members) members.push(cabinet);
    else groups.set(key, [cabinet]);
  }

  for (const members of Array.from(groups.values())) {
    const total = members.reduce((sum, member) => sum + installedFillerCutWidthIn(member), 0);
    if (members.length < 2 || total > FILLER_CUT_GROUP_MAX_IN + WIDTH_EPSILON_IN) continue;
    const billed = [...members].sort((left, right) => {
      const widthDelta = installedFillerCutWidthIn(right) - installedFillerCutWidthIn(left);
      return Math.abs(widthDelta) > WIDTH_EPSILON_IN ? widthDelta : left.uid.localeCompare(right.uid);
    })[0]!;
    const absorbedMembers = members
      .filter((member) => member.uid !== billed.uid)
      .sort((left, right) => left.uid.localeCompare(right.uid));
    const note = fillerPiecesCutFromOneStockNote(members.map(installedFillerCutWidthIn), stockWidthIn(members));
    absorbedMembers.forEach((member, index) => {
      absorbed.add(member.uid);
      sourceUid.set(member.uid, billed.uid);
      if (index === 0) noteByAbsorbed.set(member.uid, note);
    });
  }

  for (const cabinet of orderable) {
    if (absorbed.has(cabinet.uid)) continue;
    if (installedFillerCutWidthIn(cabinet) > COMBINED_FILLER_MAX_IN + WIDTH_EPSILON_IN) continue;
    const source = orderable.find((candidate) =>
      candidate.uid !== cabinet.uid
      && !absorbed.has(candidate.uid)
      && installedFillerCutWidthIn(candidate) > COMBINED_FILLER_MAX_IN + WIDTH_EPSILON_IN,
    );
    if (!source) continue;
    absorbed.add(cabinet.uid);
    sourceUid.set(cabinet.uid, source.uid);
    noteByAbsorbed.set(
      cabinet.uid,
      `Includes ${formatCut(installedFillerCutWidthIn(cabinet))} field-cut from ${source.masterCode} already on order`,
    );
  }

  return { absorbed, sourceUid, noteByAbsorbed };
}

export function isCombinedSmallFiller(cabinet: PlacedCabinet, placed: readonly PlacedCabinet[]): boolean {
  if (!isFillerItem(cabinet) || cabinet.fillerBillingRole === "secondary") return false;
  return planFillerOrders(placed).absorbed.has(cabinet.uid);
}

export function fillerCutSourceFor(cabinet: PlacedCabinet, placed: readonly PlacedCabinet[]): PlacedCabinet | null {
  if (!isFillerItem(cabinet) || cabinet.fillerBillingRole === "secondary") return null;
  const source = planFillerOrders(placed).sourceUid.get(cabinet.uid);
  if (!source) return null;
  return placed.find((candidate) => candidate.uid === source) ?? null;
}

export function combinedFillerNote(cabinet: PlacedCabinet, placed: readonly PlacedCabinet[]): string | null {
  if (!fillerCutSourceFor(cabinet, placed)) return null;
  return planFillerOrders(placed).noteByAbsorbed.get(cabinet.uid) ?? null;
}

function formatCut(value: number): string {
  const rounded = Math.round(value * 16) / 16;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}"`;
}

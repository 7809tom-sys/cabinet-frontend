/**
 * Filler labels on the 2D plan must never cover each other or a cabinet label.
 *
 * A plan with five small boards along one run used to draw five wide
 * "FILLER 1-1/4" · MAX 3"" banners at the same height, stacked on top of each
 * other and on the cabinet codes underneath. The fix is not a smaller font: it
 * is to place the labels, not just paint them.
 *
 * This module decides, for one run, how each label is drawn:
 *
 *   - labels that overlap horizontally are stacked into lanes, nearest lane
 *     first, so a pair of neighbours reads as two lines instead of one smear;
 *   - when a run is too crowded for every label to stay wide, its labels
 *     collapse to a short form ("F 1-1/4\"") — the full text stays in the
 *     tooltip, so nothing is lost, only condensed;
 *   - a run that is crowded even after collapsing keeps every label in a lane of
 *     its own rather than drawing two on top of each other.
 *
 * The result is pure data: offsets and text. `PlanCanvas` only applies them.
 */

export type FillerLabelInput = {
  uid: string;
  /**
   * Labels only collide inside one run: the top wall's boards never cover the
   * bottom wall's. Two labels with different `groupId`s are laid out independently.
   */
  groupId: string;
  /** Horizontal center of the label on the canvas, in CSS pixels. */
  centerXPx: number;
  /** Full text ("FILLER 1-1/4" · MAX 3\""). Used for its width and its tooltip. */
  fullText: string;
  /** Short text used when the run is crowded ("F 1-1/4\""). */
  shortText: string;
};

export type FillerLabelPlacement = {
  uid: string;
  /** Draw this text. Either the full or the short form. */
  text: string;
  /** Pixels above the default position. 0 is the nearest lane. */
  offsetYPx: number;
  /** Lane index, 0 being the nearest to the board. */
  lane: number;
  /** True when the short form was used. */
  collapsed: boolean;
};

export type FillerLabelLayoutOptions = {
  /** Vertical step between lanes. Two 8px labels need about 13px. */
  laneHeightPx?: number;
  /** Width of one character at the label's font size and weight. */
  charWidthPx?: number;
  /** Horizontal padding plus border on both sides. */
  paddingPx?: number;
  /** Extra horizontal clearance so two labels never read as one. */
  clearancePx?: number;
  /** More lanes than this on one run means the labels must also collapse. */
  maxLanesBeforeCollapse?: number;
};

const DEFAULTS = {
  laneHeightPx: 13,
  charWidthPx: 4.8,
  paddingPx: 12,
  clearancePx: 4,
  maxLanesBeforeCollapse: 2,
} as const;

/** Width of one banner, in CSS pixels, matching its text-[8px] font-extrabold style. */
export function fillerLabelWidthPx(text: string, options: FillerLabelLayoutOptions = {}): number {
  const settings = { ...DEFAULTS, ...options } as Required<FillerLabelLayoutOptions>;
  return Math.max(18, Math.round(text.length * settings.charWidthPx + settings.paddingPx));
}

function labelWidth(text: string, options: Required<FillerLabelLayoutOptions>): number {
  return fillerLabelWidthPx(text, options);
}

type Box = { uid: string; left: number; right: number };

/** Greedy lane assignment: the first lane whose boxes do not overlap this one. */
function assignLanes(boxes: readonly Box[], clearance: number): Map<string, number> {
  const lanes: Box[][] = [];
  const assigned = new Map<string, number>();
  for (const box of [...boxes].sort((left, right) => left.left - right.left)) {
    let lane = 0;
    for (; lane < lanes.length; lane += 1) {
      const taken = lanes[lane]!;
      const collides = taken.some((other) => box.left < other.right + clearance && other.left < box.right + clearance);
      if (!collides) break;
    }
    if (!lanes[lane]) lanes[lane] = [];
    lanes[lane]!.push(box);
    assigned.set(box.uid, lane);
  }
  return assigned;
}

/**
 * Places one run's filler labels: stacked into lanes when they overlap, and
 * collapsed to the short form when the run needs more lanes than it has room
 * for. Deterministic — the same plan always produces the same layout.
 */
export function layoutFillerLabels(
  labels: readonly FillerLabelInput[],
  options: FillerLabelLayoutOptions = {},
): FillerLabelPlacement[] {
  const settings = { ...DEFAULTS, ...options } as Required<FillerLabelLayoutOptions>;
  const byUid = new Map(labels.map((label) => [label.uid, label]));
  const groups = new Map<string, FillerLabelInput[]>();
  for (const label of labels) {
    const group = groups.get(label.groupId) ?? [];
    group.push(label);
    groups.set(label.groupId, group);
  }
  const placements = new Map<string, FillerLabelPlacement>();
  for (const group of Array.from(groups.values())) {
    // A single label on its run never needs a lane and never collapses.
    if (group.length === 1) {
      const only = group[0]!;
      placements.set(only.uid, { uid: only.uid, text: only.fullText, offsetYPx: 0, lane: 0, collapsed: false });
      continue;
    }
    const boxesFor = (useShort: boolean): Box[] => group.map((label) => {
      const width = labelWidth(useShort ? label.shortText : label.fullText, settings);
      return { uid: label.uid, left: label.centerXPx - width / 2, right: label.centerXPx + width / 2 };
    });
    const wideLanes = assignLanes(boxesFor(false), settings.clearancePx);
    const widestLane = Math.max(...Array.from(wideLanes.values()));
    const collapse = widestLane + 1 > settings.maxLanesBeforeCollapse;
    const lanes = collapse ? assignLanes(boxesFor(true), settings.clearancePx) : wideLanes;
    for (const label of group) {
      const lane = lanes.get(label.uid) ?? 0;
      placements.set(label.uid, {
        uid: label.uid,
        text: collapse ? label.shortText : label.fullText,
        offsetYPx: lane * settings.laneHeightPx,
        lane,
        collapsed: collapse,
      });
    }
  }
  // Preserve the caller's order so a render pass is stable across renders.
  return labels.map((label) => placements.get(label.uid) ?? {
    uid: label.uid, text: label.fullText, offsetYPx: 0, lane: 0, collapsed: false,
  }).filter((placement) => byUid.has(placement.uid));
}

/** The short form of a filler banner: "F 1-1/4\"" (or "F 1-1/4\" ⚠" when over its maximum). */
export function shortFillerLabel(installedText: string, overMaximum = false): string {
  return `F ${installedText}${overMaximum ? " ⚠" : ""}`;
}

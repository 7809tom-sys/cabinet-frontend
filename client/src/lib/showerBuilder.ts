/**
 * The Build Shower wizard's model.
 *
 * Tom's rules, encoded here so the UI and the tests share one definition:
 *
 * 1. EVERY STEP PICKS ITS OWN WALL. The pan, the heads & faucets, and the niches &
 *    soap trays each go on a wall the shopper chooses in that step. They are never
 *    forced onto the surround's wall. The default is the surround's back wall, but
 *    back, left and right are all available.
 * 2. EVERY STEP IS OPTIONAL. A step can be skipped outright ("Skip / don't add"),
 *    and the remaining parts must still make sense — a glass door with no surround
 *    still sits on the pan/curb line, and a part that needs a mounting wall says so
 *    instead of being dropped somewhere arbitrary.
 * 3. EVERY OFFERED ITEM IS A REAL, PRICED PELICAN PRODUCT. Nothing is invented,
 *    generic, or unpriced. If a step's category had no priced product the step
 *    reports that instead of offering a placeholder.
 */
import type { WallSide } from "./design";

/** The five things the wizard can add. */
export type ShowerStepId = "surround" | "pan" | "heads" | "niche" | "door";

/** Which wall a part is mounted on. A pan always sits on the floor. */
export type ShowerWall = Extract<WallSide, "top" | "left" | "right">;

export const SHOWER_WALLS: readonly ShowerWall[] = ["top", "left", "right"] as const;

export const SHOWER_WALL_LABELS: Record<ShowerWall, string> = {
  top: "Back wall",
  left: "Left wall",
  right: "Right wall",
};

/** A priced Pelican catalog row offered in a step. */
export type ShowerCatalogPart = {
  /** Exact purchasable SKU, finish/size variant included. */
  code: string;
  /** Catalog row id, used for the cart line and the 3D placement. */
  id: number;
  name: string;
  /** Real catalog price. Never null: an unpriced row is not offered. */
  price: number;
  size?: string | null;
  imageUrl?: string | null;
  /** Which kind of shower part this is, from the catalog row itself. */
  kind: ShowerPartKind;
};

export type ShowerPartKind = "surround" | "pan" | "system" | "niche" | "soap" | "door";

export type ShowerStepDef = {
  id: ShowerStepId;
  title: string;
  blurb: string;
  /** Every part kind this step may offer. */
  kinds: readonly ShowerPartKind[];
  /**
   * Whether the step lets the shopper pick the wall the part goes on.
   * A pan is a floor fixture, so it has no wall; the rest do.
   */
  picksWall: boolean;
  /** Always true in this wizard: every step can be skipped. */
  optional: true;
  /** The step whose wall seeds this step's default, when there is one. */
  defaultWallFrom?: ShowerStepId;
};

export const SHOWER_STEPS: readonly ShowerStepDef[] = [
  {
    id: "surround",
    title: "Wall panels & surround",
    blurb: "The waterproof wall panels. These define the back wall the rest of the shower defaults to.",
    kinds: ["surround"],
    picksWall: true,
    optional: true,
  },
  {
    id: "pan",
    title: "Shower pan",
    blurb: "The floor of the shower. It sits on the floor, aligned to the surround's opening.",
    kinds: ["pan"],
    picksWall: false,
    optional: true,
  },
  {
    id: "heads",
    title: "Heads & faucets",
    blurb: "The valve and shower head. Choose which wall the plumbing is on — often not the back wall.",
    kinds: ["system"],
    picksWall: true,
    optional: true,
    defaultWallFrom: "surround",
  },
  {
    id: "niche",
    title: "Niches & soap trays",
    blurb: "Recessed niches and soap trays. Each goes on a wall you choose.",
    kinds: ["niche", "soap"],
    picksWall: true,
    optional: true,
    defaultWallFrom: "surround",
  },
  {
    id: "door",
    title: "Glass door",
    blurb: "The enclosure door. It hangs on the pan's curb line and needs no wall.",
    kinds: ["door"],
    picksWall: false,
    optional: true,
  },
];

export function showerStep(id: ShowerStepId): ShowerStepDef {
  const step = SHOWER_STEPS.find((candidate) => candidate.id === id);
  if (!step) throw new Error(`unknown shower step: ${id}`);
  return step;
}

/** One choice in one step: a real product, and the wall it goes on. */
export type ShowerPick = {
  stepId: ShowerStepId;
  /** Null when the step was skipped. */
  part: ShowerCatalogPart | null;
  /** Null for a floor part (a pan) or a wall-mounted part with no wall chosen. */
  wall: ShowerWall | null;
};

/** What the shopper decided in every step, keyed by step. */
export type ShowerSelection = Partial<Record<ShowerStepId, ShowerPick>>;

/** The wall the whole shower defaults to when nothing has been chosen yet. */
export function defaultSurroundWall(): ShowerWall {
  return "top";
}

/**
 * The default wall for a step: the surround's back wall when the shopper picked a
 * surround wall, otherwise the shared default. It is only a starting point — the
 * shopper may choose left or right for any step.
 */
export function defaultWallForStep(stepId: ShowerStepId, selection: ShowerSelection): ShowerWall {
  const step = showerStep(stepId);
  if (!step.defaultWallFrom) return defaultSurroundWall();
  const source = selection[step.defaultWallFrom];
  return source?.wall ?? defaultSurroundWall();
}

/**
 * Parts offered in a step, filtered to real priced catalog rows.
 *
 * An unpriced row is dropped rather than shown, because the wizard promises a real
 * price on every card. `offeredParts` also reports how many were dropped so the
 * step can say so instead of silently hiding inventory.
 */
export function offeredParts(
  stepId: ShowerStepId,
  catalog: readonly ShowerCatalogPart[],
): { parts: ShowerCatalogPart[]; droppedUnpriced: number } {
  const step = showerStep(stepId);
  const inStep = catalog.filter((part) => step.kinds.includes(part.kind));
  const parts = inStep
    .filter((part) => Number.isFinite(part.price) && part.price >= 0 && part.code.trim() !== "")
    .slice()
    // A complete set or kit first, then cheapest, then name. A loose special-order
    // component is still a real product and still offered, but it should not be the
    // first thing in the step: the reference bathrooms all show a full shower set.
    .sort((a, b) => completenessRank(b) - completenessRank(a) || a.price - b.price || a.name.localeCompare(b.name));
  return { parts, droppedUnpriced: inStep.length - parts.length };
}

/**
 * How complete a part is on its own. A valve+head set or a 3-piece surround kit is a
 * whole installed component; a loose shower head or a tub spout is one piece of one.
 * Used only for ordering, never to hide a real product.
 */
function completenessRank(part: ShowerCatalogPart): number {
  const text = part.name.toLowerCase();
  if (/special order/.test(text)) return 0;
  if (/\bset\b|\bkit\b|3-piece|trim/.test(text)) return 2;
  return 1;
}

/** The step was completed by explicitly skipping it. */
export function skipStep(selection: ShowerSelection, stepId: ShowerStepId): ShowerSelection {
  return { ...selection, [stepId]: { stepId, part: null, wall: null } };
}

/**
 * Choose a part in a step, with its own wall.
 *
 * The wall argument is honoured even when another step chose a different wall: each
 * step owns its wall. Only a part that cannot take a wall (a pan) ignores it.
 */
export function choosePart(
  selection: ShowerSelection,
  stepId: ShowerStepId,
  part: ShowerCatalogPart,
  wall?: ShowerWall | null,
): ShowerSelection {
  const step = showerStep(stepId);
  if (!step.kinds.includes(part.kind)) {
    throw new Error(`${part.code} is a ${part.kind}, which the ${step.id} step does not offer`);
  }
  if (!(Number.isFinite(part.price) && part.price >= 0)) {
    throw new Error(`${part.code} has no catalog price, so it cannot be offered`);
  }
  const resolvedWall = step.picksWall ? (wall ?? defaultWallForStep(stepId, selection)) : null;
  return { ...selection, [stepId]: { stepId, part, wall: resolvedWall } };
}

/** Every step that has neither a part nor an explicit skip yet. */
export function unansweredSteps(selection: ShowerSelection): ShowerStepId[] {
  return SHOWER_STEPS.filter((step) => selection[step.id] == null).map((step) => step.id);
}

export type ShowerPlacementIssue = { stepId: ShowerStepId; message: string };

/**
 * Whether the chosen parts can be built where the shopper put them.
 *
 * Nothing here blocks the wizard — every step is optional, so a partial shower is a
 * valid shower. These are the warnings a partial build should state plainly rather
 * than silently producing a nonsensical room.
 */
export function showerPlacementIssues(selection: ShowerSelection): ShowerPlacementIssue[] {
  const issues: ShowerPlacementIssue[] = [];
  const around = selection.surround?.part ?? null;
  const pan = selection.pan?.part ?? null;
  const door = selection.door?.part ?? null;
  const heads = selection.heads;
  const niche = selection.niche;

  if (door && !around && !pan) {
    issues.push({
      stepId: "door",
      message: "This door will sit on the floor line with no pan or surround behind it. Add a pan, or check the opening size.",
    });
  } else if (door && !around) {
    issues.push({
      stepId: "door",
      message: "The door is set on the pan's curb line. There are no wall panels yet, so the opening has nothing to seal against.",
    });
  }
  if (around && !pan) {
    issues.push({
      stepId: "pan",
      message: "Wall panels are in, but there is no shower pan. The panels need a waterproof floor under them.",
    });
  }
  if (heads?.part && !around) {
    issues.push({
      stepId: "heads",
      message: "The shower valve needs a waterproof wall. Add wall panels, or confirm the wall is already tiled.",
    });
  }
  if (niche?.part && !around) {
    issues.push({
      stepId: "niche",
      message: "A recessed niche has to be built into a wall panel. Add wall panels first, or use a surface-mounted caddy.",
    });
  }
  return issues;
}

/**
 * The cart lines for a shower: one line per chosen part, carrying that part's real
 * catalog price and quantity one.
 *
 * A skipped step contributes nothing. A part is never merged with another part,
 * because each is its own SKU with its own price.
 */
export type ShowerCartLine = {
  masterCode: string;
  name: string;
  unitPrice: number;
  qty: number;
  pelicanProductId: number;
  category: string;
  stepId: ShowerStepId;
  wall: ShowerWall | null;
};

export function showerCartLines(selection: ShowerSelection): ShowerCartLine[] {
  const lines: ShowerCartLine[] = [];
  for (const step of SHOWER_STEPS) {
    const pick = selection[step.id];
    if (!pick?.part) continue;
    lines.push({
      masterCode: `PEL-${pick.part.id}`,
      name: pick.part.name,
      unitPrice: pick.part.price,
      qty: 1,
      pelicanProductId: pick.part.id,
      category: "Shower & Bath",
      stepId: step.id,
      wall: pick.wall,
    });
  }
  return lines;
}

/** Total of the shower's own cart lines. */
export function showerSubtotal(selection: ShowerSelection): number {
  return showerCartLines(selection).reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
}

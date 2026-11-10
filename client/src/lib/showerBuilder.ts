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

/**
 * The step was completed by explicitly skipping it.
 */
export function skipStep(selection: ShowerSelection, stepId: ShowerStepId): ShowerSelection {
  return { ...selection, [stepId]: { stepId, part: null, wall: null } };
}

/**
 * How a surround SKU is decorated.
 *
 * Pelican sells the same surround in four décors, so the wizard offers the décor
 * first and the size second instead of dumping 28 near-identical SKUs at the
 * shopper. The order is Tom's: Carrara Marble, Grey Wood, White Wood, White Brick.
 */
export type ShowerSurroundDecorId = "marble" | "grey-wood" | "white-wood" | "brick";

export type ShowerSurroundDecor = {
  id: ShowerSurroundDecorId;
  label: string;
  /** Face colour, matching the 3D material so the swatch predicts the wall. */
  swatch: string;
  /** Vein / grout / grain colour, so the swatch reads as the real décor. */
  accent: string;
};

export const SHOWER_SURROUND_DECORS: readonly ShowerSurroundDecor[] = [
  { id: "marble", label: "Carrara Marble", swatch: "#ddd8d0", accent: "#6f6a62" },
  { id: "grey-wood", label: "Grey Wood", swatch: "#8b8883", accent: "#54514d" },
  { id: "white-wood", label: "White Wood", swatch: "#dcd7cf", accent: "#948d84" },
  { id: "brick", label: "White Brick", swatch: "#d9d4cb", accent: "#8c857c" },
];

/**
 * The décor a surround SKU carries, read from the catalog's own description.
 *
 * A surround is identified by its décor word, not by its size, so the same test
 * works for every width and height Pelican sells.
 */
export function showerSurroundDecor(
  part: Pick<ShowerCatalogPart, "code" | "name">,
): ShowerSurroundDecorId | null {
  const text = `${part.code} ${part.name}`.toLowerCase();
  // Marble first: "Carrara Marble" must not be caught by a wood or tile word.
  if (/carrara|marble/.test(text)) return "marble";
  if (/grey wood|gray wood|grey grain|gray grain/.test(text)) return "grey-wood";
  if (/white wood/.test(text)) return "white-wood";
  if (/brick/.test(text)) return "brick";
  return null;
}

/** One physical surround size, parsed from the catalog's `size` field. */
export type ShowerSurroundSize = {
  /** The size exactly as the catalog prints it, used as the option label. */
  label: string;
  widthIn: number;
  depthIn: number;
  heightIn: number;
  /** A 74" wall set is a tub surround, not a full-height shower surround. */
  tubHeight: boolean;
};

/**
 * Parse `60" x 30" x 96"` (and the `60" x 30"` two-number form) into numbers.
 *
 * Returns null for a row whose size cannot be read, so a malformed catalog row is
 * not offered as a size the shopper cannot reason about.
 */
export function showerSurroundSize(part: Pick<ShowerCatalogPart, "size">): ShowerSurroundSize | null {
  const label = (part.size ?? "").trim();
  if (!label) return null;
  const numbers = Array.from(label.matchAll(/(\d+(?:\.\d+)?)/g)).map((match) => Number(match[1]));
  if (numbers.length < 2) return null;
  const [widthIn, depthIn, heightIn = 0] = numbers;
  if (!(widthIn > 0 && depthIn > 0)) return null;
  return {
    label,
    widthIn,
    depthIn,
    heightIn,
    tubHeight: heightIn > 0 && heightIn < 80,
  };
}

/** One décor with every size Pelican sells it in, largest fitting room first. */
export type ShowerSurroundGroup = {
  decor: ShowerSurroundDecor;
  options: Array<{ size: ShowerSurroundSize; part: ShowerCatalogPart }>;
};

/**
 * Group the surround catalogue into décor → size options.
 *
 * A row whose décor or size cannot be read stays out of the two-stage picker but is
 * still a real product, so it is reported through `unreadable` rather than silently
 * disappearing.
 */
export function showerSurroundGroups(catalog: readonly ShowerCatalogPart[]): {
  groups: ShowerSurroundGroup[];
  unreadable: ShowerCatalogPart[];
} {
  const byDecor = new Map<ShowerSurroundDecorId, Array<{ size: ShowerSurroundSize; part: ShowerCatalogPart }>>();
  const unreadable: ShowerCatalogPart[] = [];
  for (const part of catalog) {
    if (part.kind !== "surround") continue;
    const decorId = showerSurroundDecor(part);
    const size = showerSurroundSize(part);
    if (!decorId || !size) {
      unreadable.push(part);
      continue;
    }
    const list = byDecor.get(decorId) ?? [];
    list.push({ size, part });
    byDecor.set(decorId, list);
  }
  const groups: ShowerSurroundGroup[] = [];
  for (const decor of SHOWER_SURROUND_DECORS) {
    const options = byDecor.get(decor.id);
    if (!options?.length) continue;
    // Full-height shower surrounds before tub-height sets, then by width so the
    // sizes read as a ladder rather than in catalog-import order.
    options.sort((a, b) =>
      Number(a.size.tubHeight) - Number(b.size.tubHeight)
      || a.size.widthIn - b.size.widthIn
      || a.size.depthIn - b.size.depthIn
      || a.size.heightIn - b.size.heightIn);
    groups.push({ decor, options });
  }
  return { groups, unreadable };
}

/**
 * How well a surround size fits an alcove: 0 is exact, and anything over the
 * tolerance is called out in words rather than hidden.
 *
 * The width has to span the alcove because the back panel is the waterproof wall;
 * the depth is what the pan then has to live inside.
 */
export function showerSizeFit(
  size: ShowerSurroundSize,
  alcoveWidthIn: number | null | undefined,
): { ok: boolean; message: string | null } {
  if (alcoveWidthIn == null || !(alcoveWidthIn > 0)) return { ok: true, message: null };
  const gap = alcoveWidthIn - size.widthIn;
  const tolerance = 2;
  if (Math.abs(gap) <= tolerance) return { ok: true, message: null };
  return {
    ok: false,
    message: gap > 0
      ? `${size.widthIn}″ panels leave a ${round1(gap)}″ gap in this ${round1(alcoveWidthIn)}″ alcove.`
      : `${size.widthIn}″ panels overrun this ${round1(alcoveWidthIn)}″ alcove by ${round1(-gap)}″.`,
  };
}

function round1(value: number): string {
  return String(Math.round(value * 10) / 10);
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

import {
  STUDIO_ILLUSTRATIVE_SHOE_PITCH_DEG, studioBasketPlacementsForWall, studioBays, studioFixedBottom, studioFixedTop, studioItemHeight, studioStockWidth,
  type StudioBay, type StudioDesign, type StudioItem, type StudioWall,
} from "./vendorClosetStudio";

/**
 * Decorative content for the Closet Studio previews: clothes on the rods, folded stacks on the
 * shelves, and shoes on the shoe organizers.
 *
 * Two rules make this safe:
 *  1. It is *presentation only*. Nothing here is a sourced part, so it never reaches
 *     `studioTakeoff`, the material reference, the CSV download, or any price. The views and the
 *     3D scene draw it; the parts list never sees it.
 *  2. It is *derived*, never stored. Every item is computed from the design with a small seeded
 *     PRNG keyed on the wall/bay/item id, so a saved draft stays byte-identical whether the decor
 *     toggle is on or off, `restoreStudioDesign` never has to validate it, and two renders of the
 *     same design are pixel-identical.
 */

export type DecorHanger = { kind: "shirt" | "dress" | "coat" | "trouser"; leftIn: number; widthIn: number };
/** Folded stacks rest on an adjustable shelf; `leftIn` positions the stack in the bay. */
export type DecorFolded = { leftIn: number; stackIn: number; hueIndex: number; widthIn: number };
/**
 * A pair standing on a shoe organizer. `shelfBottomIn` is that organizer's own elevation, so the
 * pair rests on the shelf it belongs to wherever the shelf sits (and in either mount mode) instead
 * of at a height of its own.
 */
export type DecorShoe = { leftIn: number; widthIn: number; hueIndex: number; heightIn: number; shelfBottomIn: number };

export type StudioDecorBay = {
  bayId: string;
  wallId: StudioWall;
  /** Hanging garments that swing from a rod, positioned relative to the bay's left edge. */
  hangers: (DecorHanger & { rodBottomIn: number })[];
  /** Folded stacks resting on an adjustable shelf. */
  folded: (DecorFolded & { shelfBottomIn: number })[];
  /** Pairs standing on a shoe organizer. */
  shoes: DecorShoe[];
};

/** A garment only goes on a rod with real hanging length below it. */
const HANGER_MIN_DROP_IN = { shirt: 30, trouser: 36, dress: 52, coat: 46 } as const;
/** One hanger plus the fabric beside it; keeps a rod from looking like a solid block. */
const HANGER_PITCH_IN = 4;
/** Folded stacks need this much clear height above the shelf to look right. */
const FOLDED_STACK_HEIGHT_IN = 6;
/** A pair of shoes on the illustrative 45° board. */
const SHOE_PAIR_WIDTH_IN = 4.6;
/** The pair's own height, in inches; placement comes from the shelf, never from this number. */
const SHOE_PAIR_HEIGHT_IN = 2.4;
/** Sourced shoe-board thickness; a pair rests on this board, not at a height of its own. */
export const STUDIO_DECOR_SHOE_BOARD_IN = 0.75;
/** Depth of an illustrative pair along the board, in inches. */
export const STUDIO_DECOR_SHOE_DEPTH_IN = 8.5;
/** How far back from the board's front edge a pair's centre rests, clear of the illustrative fence. */
export const STUDIO_DECOR_SHOE_REST_BACK_IN = 5;

/**
 * Where one pair sits inside its own shoe shelf's group. That group is the one the scene places at
 * the shelf's `bottomIn` and tilts to `STUDIO_ILLUSTRATIVE_SHOE_PITCH_DEG`, with the board's front
 * low edge on the group origin — so these numbers are relative to the shelf, never to the floor.
 *
 * The board's top face is the plane at `STUDIO_DECOR_SHOE_BOARD_IN`, so a pair's centre is half its
 * own height above that face and it inherits the board's pitch instead of standing upright.
 */
export function studioDecorShoeRest(shoe: DecorShoe, bayWidthIn: number, pairIndex = 0): {
  /** Pair centre across the bay, in inches from the bay's centre line. */
  offsetFromBayCenterIn: number;
  /** Pair centre above the shelf's own bottom face, in inches. */
  aboveShelfBottomIn: number;
  /** Pair centre behind the shelf's front edge, in inches (positive goes back into the tower). */
  behindFrontEdgeIn: number;
  /** Pitch the pair inherits from the board, in degrees. */
  pitchDeg: number;
} {
  return {
    offsetFromBayCenterIn: shoe.leftIn + pairIndex * shoe.widthIn * 0.52 + shoe.widthIn * 0.23 - bayWidthIn / 2,
    aboveShelfBottomIn: STUDIO_DECOR_SHOE_BOARD_IN + shoe.heightIn / 2,
    behindFrontEdgeIn: STUDIO_DECOR_SHOE_REST_BACK_IN,
    pitchDeg: STUDIO_ILLUSTRATIVE_SHOE_PITCH_DEG,
  };
}

/**
 * Small deterministic PRNG (mulberry32). Seeded from the ids so the same design always draws the
 * same clothes, which matters for screenshots, tests, and the customer's own saved draft.
 */
function seeded(seed: string): () => number {
  let state = 0x9e3779b9;
  for (let index = 0; index < seed.length; index += 1) {
    state = (state ^ seed.charCodeAt(index)) >>> 0;
    state = Math.imul(state, 0x01000193) >>> 0;
  }
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The clear hanging length a rod actually has. Only what sits *below* the rod limits it: another
 * rod in a double hang, a drawer stack, or a shelf under the hanging space. A shelf above the rod
 * is not a limit, which is why the shelf over an upper rod must not be read as one.
 */
function hangingDropIn(design: StudioDesign, bay: StudioBay, rod: StudioItem): number {
  const below = bay.items
    .filter((item) => item.id !== rod.id && item.bottomIn < rod.bottomIn)
    .map((item) => item.bottomIn + studioItemHeight(item.kind));
  const floorIn = studioFixedBottom(design) + studioItemHeight("shelf");
  // Clearance so a garment on the upper rod never grazes the rod below it.
  const clearanceIn = bay.items.some((item) => item.id !== rod.id && item.kind === "rod" && item.bottomIn < rod.bottomIn) ? 2 : 0;
  const obstructionIn = below.length ? Math.max(...below, floorIn) : floorIn;
  return rod.bottomIn - obstructionIn - clearanceIn;
}

/** The clear height above an adjustable shelf, up to the next part or the fixed top shelf. */
function shelfHeadroomIn(design: StudioDesign, bay: StudioBay, shelf: StudioItem): number {
  const above = bay.items
    .filter((item) => item.kind !== "rod" && item.bottomIn > shelf.bottomIn)
    .map((item) => item.bottomIn);
  const nextIn = above.length ? Math.min(...above) : studioFixedTop(design);
  return nextIn - (shelf.bottomIn + studioItemHeight(shelf.kind));
}

/**
 * Decoration for one bay. Empty when the bay is a field-cut shelving tower (nothing hangs or stands
 * in a cut bay) or when the bay has no parts at all beyond its fixed shelves.
 */
export function studioBayDecor(design: StudioDesign, bay: StudioBay, wallId: StudioWall): StudioDecorBay {
  const random = seeded(`${wallId}:${bay.id}`);
  const widthIn = studioStockWidth(bay);
  const marginIn = 1.1;
  const innerIn = Math.max(0, widthIn - marginIn * 2);
  const hangers: StudioDecorBay["hangers"] = [];
  const folded: StudioDecorBay["folded"] = [];
  const shoes: StudioDecorBay["shoes"] = [];

  for (const item of bay.items) {
    if (item.kind === "rod") {
      const dropIn = hangingDropIn(design, bay, item);
      // Long garments first: on a single high rod they are what the bay is for. A 40 in lower rod
      // in a double hang only takes shirts and folded trousers.
      const types = (["dress", "coat", "shirt", "trouser"] as const)
        .filter((kind) => dropIn >= HANGER_MIN_DROP_IN[kind])
        .sort((a, b) => HANGER_MIN_DROP_IN[b] - HANGER_MIN_DROP_IN[a]);
      if (!types.length) continue;
      // A long garment needs the whole bay width to look right; shirts and trousers pack tighter.
      const longHang = dropIn >= HANGER_MIN_DROP_IN.dress;
      const fitCount = Math.floor(innerIn / HANGER_PITCH_IN);
      const count = longHang ? Math.min(fitCount, 6) : Math.min(fitCount, 9);
      const usedIn = count * HANGER_PITCH_IN;
      const startIn = marginIn + Math.max(0, (innerIn - usedIn) / 2);
      for (let index = 0; index < count; index += 1) {
        const kind = types[index % types.length];
        hangers.push({ kind, rodBottomIn: item.bottomIn, leftIn: startIn + index * HANGER_PITCH_IN, widthIn: HANGER_PITCH_IN * (kind === "dress" || kind === "coat" ? 1.25 : 1) });
      }
    }
  }

  for (const item of bay.items) {
    if (item.kind !== "shelf") continue;
    if (shelfHeadroomIn(design, bay, item) < FOLDED_STACK_HEIGHT_IN + studioItemHeight("shelf")) continue;
    // Two or three stacks per shelf reads as "folded clothes" without turning into a striped block.
    const stacks = innerIn >= 24 ? 3 : innerIn >= 15 ? 2 : 1;
    const stackWidthIn = innerIn / stacks;
    for (let index = 0; index < stacks; index += 1) {
      folded.push({
        shelfBottomIn: item.bottomIn,
        leftIn: marginIn + index * stackWidthIn + stackWidthIn * 0.14,
        stackIn: 3,
        widthIn: stackWidthIn * 0.72,
        hueIndex: Math.floor(random() * 5),
      });
    }
  }

  for (const item of bay.items) {
    if (item.kind !== "shoe") continue;
    const pairs = Math.max(1, Math.floor(innerIn / SHOE_PAIR_WIDTH_IN));
    const pairWidthIn = innerIn / pairs;
    for (let index = 0; index < pairs; index += 1) {
      shoes.push({
        leftIn: marginIn + index * pairWidthIn + pairWidthIn * 0.18,
        widthIn: pairWidthIn * 0.64,
        heightIn: SHOE_PAIR_HEIGHT_IN,
        // The pair belongs to this shelf: it rides that elevation, not a fixed one, so the shoes
        // follow the shelf wherever the customer puts it and in either mount mode.
        shelfBottomIn: item.bottomIn,
        hueIndex: Math.floor(random() * 6),
      });
    }
  }

  return { bayId: bay.id, wallId, hangers, folded, shoes };
}

/** Decoration for every bay on one wall, in bay order so the callers can index it alongside `studioBays`. */
export function studioWallDecor(design: StudioDesign, wall: StudioWall): StudioDecorBay[] {
  return studioBays(design, wall).map((bay) => studioBayDecor(design, bay, wall));
}

/** True when the design has anything worth decorating; lets a caller skip the work entirely. */
export function studioHasDecor(design: StudioDesign): boolean {
  return studioBays(design).some((bay) => bay.items.some((item) => item.kind === "rod" || item.kind === "shelf" || item.kind === "shoe"));
}

/** Fabric palette for the drawn clothes. Deliberately presentation-only colours, not catalog finishes. */
export const STUDIO_DECOR_FABRIC_HEX = ["#b9c6cf", "#cbbfa8", "#a8b5a1", "#c9aeb0", "#8f9aa6"] as const;
export const STUDIO_DECOR_SHOE_HEX = ["#4b4238", "#7a5540", "#2f3439", "#8b8378", "#5d4a3c", "#a3a099"] as const;

/** A stable index into a palette for a drawn garment or pair of shoes. */
export const studioDecorColor = (palette: readonly string[], seed: string, offset = 0): string =>
  palette[Math.abs(Math.floor(seeded(seed)() * palette.length) + offset) % palette.length];

/** Bays that have a basket visual plan; decor steps aside so it never draws through a basket. */
export const studioBasketBayIds = (design: StudioDesign, wall: StudioWall): Set<string> =>
  new Set(studioBasketPlacementsForWall(design, wall).map((placement) => placement.bayId));

/** Fixed shelves are part of the tower frame, never decor. */
export const studioDecorShelfBottoms = (design: StudioDesign): { bottom: number; top: number }[] => [
  { bottom: studioFixedBottom(design), top: studioFixedBottom(design) + studioItemHeight("shelf") },
  { bottom: studioFixedTop(design), top: studioFixedTop(design) + studioItemHeight("shelf") },
];

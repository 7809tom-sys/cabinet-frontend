/**
 * Tall oven / pantry cabinets in the measured Auto-Design build.
 *
 * A line sells its tall boxes as real cabinet records (33" × 90" oven pantry,
 * 30" × 84" double-oven tower, plain pantry, utility tower). Auto-Design never
 * drops one into a run on its own: a tall box replaces a floor-and-upper span,
 * so the person building the kitchen chooses it explicitly in the tall-cabinet
 * pop-up. A pick auto-places it — there is no drag or manual drop step — inside
 * a free span that respects the wall ends, the refrigerator panel limit, the
 * ceiling, and every cabinet already seated.
 *
 * Roll-out trays, valances, moldings, panels, and similar accessories are NOT
 * tall boxes and never appear here; they stay add-on accessory lines.
 */
import { cabinetDrawingType } from "./cabinetGraphics";
import {
  COLLISION_EPSILON_IN,
  STD,
  appendCollisionFreePlacements,
  cabinetWall,
  dim,
  footprintDepth,
  freeSegmentsOnWall,
  isPanelItem,
  isSinkBaseCabinet,
  resolvedDesignCabinetDimensions,
  roomWallRunFrames,
  wallCeilingMin,
  wallPlacementAt,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
  type WallSide,
} from "./design";
import { refrigeratorLimitIn } from "./autoDesignAnchors";
import { boundedWallPlacementAt } from "./designerBounds";

export type AutoDesignTallKind = "oven-pantry" | "pantry" | "utility";

export type AutoDesignTallProduct = {
  id: number;
  /** Display SKU with the distributor's alias suffix removed, e.g. UOC3390(O339024) → UOC3390. */
  masterCode: string;
  /** The catalog row's exact stored code, used when the box is placed. */
  catalogCode: string;
  description: string;
  subCategory: string | null;
  kind: AutoDesignTallKind;
  widthIn: number;
  heightIn: number;
  depthIn: number;
};

export type AutoDesignTallGroup = { kind: AutoDesignTallKind; label: string; products: AutoDesignTallProduct[] };

export const AUTO_DESIGN_TALL_KIND_LABELS: Record<AutoDesignTallKind, string> = {
  "oven-pantry": "Oven pantry / oven tower",
  pantry: "Pantry",
  utility: "Utility / broom tower",
};

/**
 * Distributors store the line's own code with the manufacturer alias in
 * parentheses ("UOC3390(O339024)"). The customer-facing SKU is the first part;
 * the full stored code is kept for placement and pricing.
 */
export function displayTallSku(code: string | null | undefined): string {
  const raw = (code ?? "").trim();
  const beforeAlias = raw.split("(")[0]!.trim();
  return beforeAlias || raw;
}

/**
 * Resolve the tall box picked in the tall pop-up to its catalog row. Matching is
 * by id first, then by the alias-stripped SKU, so a saved pick survives a
 * catalog re-import that keeps the code and changes the id.
 */
export function resolveTallPick(
  catalog: readonly DesignCabinet[],
  pick: { cabinetId: number; masterCode: string },
): DesignCabinet | null {
  const byId = catalog.find((row) => row.id === pick.cabinetId);
  if (byId) return byId;
  const wanted = displayTallSku(pick.masterCode).toUpperCase();
  return catalog.find((row) => row.placement === "tall" && displayTallSku(row.masterCode).toUpperCase() === wanted) ?? null;
}

function normalizedCode(code: string | null | undefined): string {
  return displayTallSku(code).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const OVEN_TALL_CODE = /^(?:UOC|TOS|TOD|O3\d|OVEN)/;
const UTILITY_CODE = /^(?:U[0-9]|UB|UTL|BROOM|TOS2DBID)/;
const NOT_A_TALL_BOX = /filler|panel|skin|moulding|molding|crown|light rail|toe ?kick|valance|roll[- ]?out|tray|shelf|sample|touch.?up/i;

type TallCandidate = DesignCabinet & { placement?: string | null; isNotCabinet?: boolean | null };

/** A real tall cabinet box the Auto-Design pop-up can offer. */
export function isAutoDesignTallBox(row: TallCandidate): boolean {
  if ((row.placement ?? "") !== "tall") return false;
  if (row.isNotCabinet) return false;
  if (isPanelItem(row) || isSinkBaseCabinet(row)) return false;
  const text = `${row.masterCode ?? ""} ${row.description ?? ""} ${row.subCategory ?? ""}`;
  if (NOT_A_TALL_BOX.test(text)) return false;
  if (!hasPositiveMeasures(row)) return false;
  if (!isTallShape(row)) return false;
  return true;
}

function hasPositiveMeasures(row: TallCandidate): boolean {
  const dims = resolvedDesignCabinetDimensions(row);
  return dims.width > 0 && dims.height > 0 && dims.depth > 0;
}

/** An oven/pantry tower, not a 24"-deep base that a distributor filed on the tall tab. */
function isTallShape(row: TallCandidate): boolean {
  const dims = resolvedDesignCabinetDimensions(row);
  if (dims.height < STD.BASE_HEIGHT + 6) return false;
  return true;
}

export function autoDesignTallKind(row: TallCandidate): AutoDesignTallKind {
  const drawingType = cabinetDrawingType(row);
  const code = normalizedCode(row.masterCode);
  const text = `${row.description ?? ""} ${row.subCategory ?? ""}`.toLowerCase();
  if (drawingType === "oven-tall" || OVEN_TALL_CODE.test(code) || /\boven\b/.test(text)) return "oven-pantry";
  if (UTILITY_CODE.test(code) || /utility|broom|cleaning/.test(text)) return "utility";
  return "pantry";
}

/**
 * Every tall box the selected line can place, one entry per catalog row. A row
 * the Designer cannot draw (no width, height, or depth) is left out: there is no
 * box to place, and Auto-Design reports that instead of inventing one.
 */
export function autoDesignTallProducts(catalog: readonly TallCandidate[]): AutoDesignTallProduct[] {
  const seen = new Set<string>();
  const products: AutoDesignTallProduct[] = [];
  for (const row of catalog) {
    if (!isAutoDesignTallBox(row)) continue;
    const dims = resolvedDesignCabinetDimensions(row);
    const catalogCode = (row.masterCode ?? "").trim();
    const key = `${displayTallSku(catalogCode)}|${dims.width}|${dims.height}`;
    if (seen.has(key)) continue;
    seen.add(key);
    products.push({
      id: row.id,
      masterCode: displayTallSku(catalogCode),
      catalogCode,
      description: row.description ?? displayTallSku(catalogCode),
      subCategory: row.subCategory ?? null,
      kind: autoDesignTallKind(row),
      widthIn: dims.width,
      heightIn: dims.height,
      depthIn: dims.depth,
    });
  }
  return products.sort((left, right) =>
    left.kind.localeCompare(right.kind)
    || left.widthIn - right.widthIn
    || left.heightIn - right.heightIn
    || left.masterCode.localeCompare(right.masterCode, undefined, { numeric: true }));
}

export function groupTallProducts(products: readonly AutoDesignTallProduct[]): AutoDesignTallGroup[] {
  const order: AutoDesignTallKind[] = ["oven-pantry", "pantry", "utility"];
  return order.flatMap((kind) => {
    const rows = products.filter((product) => product.kind === kind);
    if (rows.length === 0) return [];
    return [{
      kind,
      label: AUTO_DESIGN_TALL_KIND_LABELS[kind],
      products: [...rows].sort((left, right) => left.widthIn - right.widthIn || left.heightIn - right.heightIn),
    }];
  });
}

export type AutoDesignTallFit =
  | { ok: true; wallId: string; alongIn: number; placement: ReturnType<typeof wallPlacementAt> & { wallId?: string; wallOffset?: number } }
  | { ok: false; reason: string };

/**
 * Seats one tall box in the first free span of the kitchen's own walls.
 *
 * Rules kept from the rest of the Designer:
 * - never past a wall end (`boundedWallPlacementAt`),
 * - never across the refrigerator's panel limit,
 * - never through an opening, a corner clearance, or another cabinet,
 * - the box's real height must clear that wall's lowest ceiling.
 */
export function planAutoDesignTallFit(input: {
  product: AutoDesignTallProduct;
  room: RoomData;
  placed: readonly PlacedCabinet[];
  openings: readonly WallOpening[];
  /** Walls the measured build owns, in run order. */
  wallIds: readonly string[];
}): AutoDesignTallFit {
  const { product, room } = input;
  const walls = input.wallIds.length > 0
    ? [...input.wallIds]
    : roomWallRunFrames(room).filter((frame) => frame.kind !== "peninsula").map((frame) => frame.id);
  let ceilingBlocked = false;
  let panelBlocked = false;
  for (const wallId of walls) {
    const ceiling = wallCeilingMin(room, wallId as WallSide);
    if (Number.isFinite(ceiling) && ceiling > 0 && ceiling + COLLISION_EPSILON_IN < product.heightIn) {
      ceilingBlocked = true;
      continue;
    }
    const frame = roomWallRunFrames(room).find((candidate) => candidate.id === wallId);
    if (!frame) continue;
    const limit = refrigeratorLimitIn({ placed: [...input.placed], room, wallId });
    const segments = freeSegmentsOnWall(
      wallId as WallSide,
      room,
      [...input.placed],
      [...input.openings],
      product.widthIn,
      0,
      "tall",
      false,
      undefined,
      product.depthIn,
    );
    for (const segment of segments) {
      if (segment.length + COLLISION_EPSILON_IN < product.widthIn) continue;
      const start = Math.max(segment.start, frame.runStart);
      if (limit && start < limit.endIn - COLLISION_EPSILON_IN && start + product.widthIn > limit.startIn + COLLISION_EPSILON_IN) {
        panelBlocked = true;
        continue;
      }
      const spot = boundedWallPlacementAt(start, product.widthIn, product.depthIn, wallId, room);
      if (!spot) continue;
      const seat = startOf(spot, start);
      if (limit && seat < limit.endIn - COLLISION_EPSILON_IN && seat + product.widthIn > limit.startIn + COLLISION_EPSILON_IN) {
        panelBlocked = true;
        continue;
      }
      const probe = tallPlacement(product, wallId, spot, seat);
      if (appendCollisionFreePlacements([...input.placed], [probe], room).rejected.length > 0) continue;
      return { ok: true, wallId, alongIn: seat, placement: spot };
    }
  }
  if (ceilingBlocked) {
    return {
      ok: false,
      reason: `${product.masterCode} is ${product.heightIn}″ tall and does not clear this room's ceiling on any kitchen wall.`,
    };
  }
  if (panelBlocked) {
    return {
      ok: false,
      reason: `No free span wide enough for ${product.masterCode} (${product.widthIn}″) that also stays clear of the refrigerator end panels.`,
    };
  }
  return {
    ok: false,
    reason: `No free ${product.widthIn}″ span on the kitchen walls for ${product.masterCode}. Shorten a run or remove a cabinet to make room; nothing was placed.`,
  };
}

function startOf(spot: { wallOffset?: number }, fallback: number): number {
  const offset = Number(spot.wallOffset);
  return Number.isFinite(offset) ? offset : fallback;
}

/** The real placed record for a tall pick; the caller commits it with the run. */
export function tallCabinetPlacement(input: {
  product: AutoDesignTallProduct;
  source: DesignCabinet;
  wallId: string;
  spot: ReturnType<typeof wallPlacementAt>;
  alongIn: number;
  uid: string;
  styleId: number | null;
}): PlacedCabinet {
  const { product, source } = input;
  return {
    uid: input.uid,
    cabinetId: source.id,
    masterCode: source.masterCode,
    description: source.description,
    category: source.category ?? null,
    subCategory: source.subCategory ?? null,
    placement: "tall",
    ...input.spot,
    width: product.widthIn,
    depth: footprintDepth(source) || product.depthIn,
    height: product.heightIn,
    mountBottom: 0,
    catalogImageUrl: source.catalogImageUrl ?? null,
    numberOfDoors: source.numberOfDoors,
    numberOfDrawers: source.numberOfDrawers,
    styleId: input.styleId,
  };
}

function tallPlacement(
  product: AutoDesignTallProduct,
  wallId: string,
  spot: ReturnType<typeof wallPlacementAt>,
  alongIn: number,
): PlacedCabinet {
  return {
    uid: "auto-design-tall-probe",
    cabinetId: product.id,
    masterCode: product.catalogCode,
    description: product.description,
    placement: "tall",
    ...spot,
    width: product.widthIn,
    depth: product.depthIn,
    height: product.heightIn,
    mountBottom: 0,
    wallId: spot.wallId ?? wallId,
    wallOffset: spot.wallOffset ?? alongIn,
  } as PlacedCabinet;
}

/** Walls the auto-designer owns, in run order: every perimeter wall, never a peninsula. */
export function autoDesignKitchenWallIds(room: RoomData): string[] {
  return roomWallRunFrames(room).filter((frame) => frame.kind !== "peninsula").map((frame) => frame.id);
}

/** True when a placed tall box already occupies the kitchen, so the pop-up stays quiet. */
export function hasPlacedTallCabinet(placed: readonly PlacedCabinet[], room: RoomData): boolean {
  return placed.some((item) => item.placement === "tall" && !isPanelItem(item) && cabinetWall(item, room) != null);
}

/** One-line note used by the pop-up card and the review list. */
export function describeTallProduct(product: AutoDesignTallProduct): string {
  const kind = AUTO_DESIGN_TALL_KIND_LABELS[product.kind];
  return `${product.masterCode} · ${kind} · ${product.widthIn}″ W × ${product.heightIn}″ H`;
}

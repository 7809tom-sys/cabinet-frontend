/**
 * Auto Design corner decision (Tom, Nov 14 2026, voice 1:26 and 1:28 PM CT).
 *
 *  1. Recognize every true 90° inside corner of the cabineted runs first, and
 *     reserve the inside-corner square (24" along each meeting leg, the base
 *     depth) before any fill — leftover, "use every inch", and the 15-rule
 *     intake repack. A plain B## must never occupy that square.
 *  2. After fixed appliances are seated, measure the available run on each
 *     meeting leg: from the inside corner to the nearest fixed appliance, or
 *     to that appliance's required clearance when one applies (the 15"
 *     refrigerator landing is one). The relevant measurement is the shorter
 *     of the two legs. That number selects the TYPE (the bands below). The
 *     selected line's live, source-priced catalog then selects the SKU and
 *     size. Cabinet widths are never hardcoded.
 *  3. Bands (available run, inches):
 *       - 45 or more: a lazy Susan.
 *       - 43.5 up to (but not including) 45: a pull-out / sliding / adjustable
 *         corner base that slides 3–6". If the line sells none, try the next
 *         valid type (a blind that can pull 3–6", then a lazy Susan that fits).
 *       - 42 up to (but not including) 43.5: a lazy Susan from the catalog
 *         plus a 9" cabinet beside it (see pickNineInchCompanion). Interpretation
 *         of Tom's "9 inch tall cabinet": 9" is the *width* to look up in the
 *         catalog. Prefer a 9" base, pull-out, or tray base so the countertop
 *         stays continuous; use a 9"-wide tall only when the line sells no 9"
 *         base. If the line has no 9" SKU, or no lazy Susan that leaves 9"
 *         beside it, fall to the next valid type.
 *       - 33 up to (but not including) 42: the best catalog fit — a lazy
 *         Susan whose published width fits the available run, or a blind
 *         corner with its 3" filler and its catalog pull distance.
 *       - 27 up to (but not including) 33: always a corner cabinet, and it
 *         must be a blind. The blind is turned so its open leg (base depth
 *         + the 3" filler, 27" on a standard 24" base) sits on the tight
 *         leg, and its width runs along the more open leg. 27" is that
 *         open-leg geometry, not a hardcoded cabinet size. The 1.8" filler
 *         target lives only on the DeepSeek branch and is not used here.
 *       - under 27: keep the square blocked and raise corner-cabinet-not-seated.
 *
 * A blind always carries its 3" filler. A lazy Susan or diagonal base still
 * gets a diagonal corner upper. BLB and BCB are true blinds. A fridge stays
 * at the start or end of an L run.
 */
import { autoBuildSelectedWallCornerReservations, subtractAnchorRunReservations, type AnchorRunReservation } from "./autoDesignAutoBuild";
import {
  autoDesignCornerFamily,
  isPullOutCornerCabinet,
  type AutoBuildCornerCandidate,
  type AutoDesignCornerFamily,
} from "./autoDesignCornerStage";
import { isTrueBlindCornerCode } from "./designerCornerSection";
import { LANDING_MIN_IN } from "./autoDesignFifteenRules";
import { cornerLegClearance } from "./cornerFirst";
import {
  BLIND_CORNER_FILLER_WIDTH_IN,
  STD,
  appendCollisionFreePlacements,
  cabinetWall,
  dim,
  isFillerItem,
  isPanelItem,
  isPlainBaseCode,
  isRangeOrOven,
  isRefrigerator,
  standardHeight,
  wallLength,
  wallPlacementAt,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";

/** Width may be optional or null on catalog rows; keep this looser than DesignCabinet. */
type CornerOptionForDecision = Pick<AutoBuildCornerCandidate, "masterCode" | "description" | "cornerType" | "width" | "subCategory" | "placement">;

/** The inside-corner square along each meeting leg: a standard 24" base depth. */
export const INSIDE_CORNER_SQUARE_IN = STD.BASE_DEPTH;

/** Open leg of a blind: base depth plus the required 3" filler, not a catalog size. */
export const BLIND_OPEN_LEG_IN = INSIDE_CORNER_SQUARE_IN + BLIND_CORNER_FILLER_WIDTH_IN;

/** Typical two-leg corner width only when the line has not published one. */
export const TWO_LEG_CORNER_DEFAULT_IN = 36;

/** The 9" companion width Tom named for the 42" band — looked up in the catalog, never invented. */
export const NINE_INCH_COMPANION_IN = 9;

/** Measured-run type bands (inches). These are not cabinet sizes. */
export const CORNER_BAND_LAZY_SUSAN_MIN_IN = 45;
export const CORNER_BAND_PULL_OUT_MIN_IN = 43.5;
export const CORNER_BAND_LAZY_PLUS_NINE_MIN_IN = 42;
export const CORNER_BAND_CATALOG_FIT_MIN_IN = 33;
/** Same value as BLIND_OPEN_LEG_IN (24 + 3). Below this the square stays blocked. */
export const CORNER_BAND_ROTATED_BLIND_MIN_IN = BLIND_OPEN_LEG_IN;

export type CornerBandId =
  | "lazy-susan"
  | "pull-out"
  | "lazy-susan-plus-nine"
  | "catalog-fit"
  | "rotated-blind"
  | "blocked";

export type CornerLegAvailability = {
  wallId: string;
  /** Inches from the corner to the nearest cabinet or appliance body. */
  clearIn: number;
  /** Required clearance of that nearest appliance, if any (15" fridge landing). */
  clearanceIn: number;
  /** clearIn minus clearanceIn — the available run used for the type band. */
  availableIn: number;
  /** The box that ends the available run on this leg, if any. */
  limitingItem?: PlacedCabinet | null;
};

export type CornerTypeDecision = {
  band: CornerBandId;
  /** Shorter available run of the two legs. */
  availableIn: number;
  /** The tighter leg, whose available run selected the band. */
  relevantWallId: string | null;
  /** The more open leg — the run a rotated blind should follow. */
  openWallId: string | null;
  tightness: "tight" | "open";
  /** Families to try, first to last. `other` is always last when present. */
  order: AutoDesignCornerFamily[];
  reason: string;
  twoLegNeedIn: number;
  /** True when a 9" catalog companion should sit beside a lazy Susan (42" band). */
  companionNine: boolean;
  /** True when the blind must be turned so its open leg is on the tight run. */
  rotateBlind: boolean;
  /** Under 27": do not seat anything; raise corner-cabinet-not-seated. */
  blocked: boolean;
};

/** Reservations of the inside-corner square on every cabineted run. */
export function autoDesignInsideCornerReservations(
  room: RoomData,
  runWallIds: readonly string[],
  depthIn = INSIDE_CORNER_SQUARE_IN,
): Array<AnchorRunReservation & { wallId: string }> {
  const reserved: Array<AnchorRunReservation & { wallId: string }> = [];
  for (const wallId of runWallIds) {
    for (const span of autoBuildSelectedWallCornerReservations(wallId, room, runWallIds, depthIn)) {
      reserved.push({ wallId, start: span.start, end: span.end });
    }
  }
  return reserved;
}

export function cornerReservationsOnWall(
  wallId: string,
  reserved: ReadonlyArray<{ wallId?: string; start: number; end: number }>,
): AnchorRunReservation[] {
  return reserved
    .filter((span) => !span.wallId || span.wallId === wallId)
    .map((span) => ({ start: span.start, end: span.end }));
}

/** Drop reserved corner squares from otherwise free run segments. */
export function subtractInsideCornerReservations(
  segments: ReadonlyArray<{ start: number; length: number }>,
  reservations: ReadonlyArray<AnchorRunReservation>,
  minLen = 0,
): Array<{ start: number; length: number }> {
  return subtractAnchorRunReservations(segments, reservations).filter((segment) => segment.length >= minLen - 1e-6);
}

export function twoLegCornerNeedIn(options: readonly CornerOptionForDecision[]): number {
  const widths = options
    .filter((option) => {
      const family = autoDesignCornerFamily(option);
      return family === "diagonal" || family === "lazy-susan";
    })
    .map((option) => dim(option.width, 0))
    .filter((width) => width >= 9);
  return widths.length ? Math.min(...widths) : TWO_LEG_CORNER_DEFAULT_IN;
}

function requiredClearanceIn(item: PlacedCabinet): number {
  return isRefrigerator(item) ? LANDING_MIN_IN : 0;
}

/**
 * Available run on each meeting leg: corner to the nearest fixed appliance
 * (or other box), minus that appliance's required clearance.
 */
export function cornerLegAvailability(input: {
  room: RoomData;
  cornerWallIds: readonly string[];
  corner: { x: number; y: number };
  placed: readonly PlacedCabinet[];
}): CornerLegAvailability[] {
  const clears = cornerLegClearance(input);
  return clears.map((leg) => {
    const frame = wallRunFrame(leg.wallId, input.room);
    let clearanceIn = 0;
    let nearest: { distance: number; item: PlacedCabinet } | null = null;
    if (frame) {
      const atStart = Math.hypot(frame.start.x - input.corner.x, frame.start.y - input.corner.y) <= 0.01;
      const fromVertex = (along: number) => Math.max(0, atStart ? along : frame.length - along);
      for (const item of input.placed) {
        if (item.islandFace) continue;
        if (cabinetWall(item, input.room) !== leg.wallId) continue;
        if (isFillerItem(item) || isPanelItem(item)) continue;
        const start = wallRunOffset(item, leg.wallId, input.room);
        const span = wallRunSpan(item, leg.wallId, input.room);
        if (!(span > 0)) continue;
        const distance = Math.min(fromVertex(start), fromVertex(start + span));
        if (!nearest || distance < nearest.distance - 0.01) nearest = { distance, item };
      }
      if (nearest && Math.abs(nearest.distance - leg.clearIn) <= 0.5) {
        clearanceIn = requiredClearanceIn(nearest.item);
      }
    }
    const availableIn = Math.round(Math.max(0, leg.clearIn - clearanceIn) * 1000) / 1000;
    return { wallId: leg.wallId, clearIn: leg.clearIn, clearanceIn, availableIn, limitingItem: nearest?.item ?? null };
  });
}

export function cornerBandForAvailableIn(availableIn: number): CornerBandId {
  if (availableIn >= CORNER_BAND_LAZY_SUSAN_MIN_IN - 1e-6) return "lazy-susan";
  if (availableIn >= CORNER_BAND_PULL_OUT_MIN_IN - 1e-6) return "pull-out";
  if (availableIn >= CORNER_BAND_LAZY_PLUS_NINE_MIN_IN - 1e-6) return "lazy-susan-plus-nine";
  if (availableIn >= CORNER_BAND_CATALOG_FIT_MIN_IN - 1e-6) return "catalog-fit";
  if (availableIn >= CORNER_BAND_ROTATED_BLIND_MIN_IN - 1e-6) return "rotated-blind";
  return "blocked";
}

function widthOf(option: { width?: string | number | null }): number {
  return dim(option.width == null ? null : String(option.width), 0);
}

function lazySusanFitting(options: readonly CornerOptionForDecision[], availableIn: number, extraIn = 0): CornerOptionForDecision[] {
  return options.filter((option) => {
    if (autoDesignCornerFamily(option) !== "lazy-susan") return false;
    const width = widthOf(option);
    return width >= 9 && width + extraIn <= availableIn + 0.05;
  });
}

/**
 * A 9"-wide catalog cabinet to sit beside the lazy Susan on the 42" band.
 *
 * Interpretation of Tom's "a 9 inch tall cabinet" (document so he can correct
 * it): 9" is the width to look up in the live catalog. Prefer a 9" base,
 * pull-out, or tray base so the countertop stays continuous. Use a 9"-wide
 * tall only when the line sells no 9" base. Never invent a SKU or a price,
 * and never use a wall cabinet (that would break the counter).
 */
export function pickNineInchCompanion<T extends Pick<DesignCabinet, "masterCode" | "description" | "subCategory" | "placement" | "width" | "cornerType">>(
  catalog: readonly T[],
): T | null {
  const matches = catalog.filter((row) => {
    const width = widthOf(row);
    if (Math.abs(width - NINE_INCH_COMPANION_IN) > 0.2) return false;
    const placement = (row.placement ?? "").toLowerCase();
    if (placement === "wall" || placement === "appliance" || placement.includes("accessory") || placement.includes("trim")) return false;
    if (isPlainBaseCode(row.masterCode) || placement === "base" || placement === "tall") {
      if (isTrueBlindCornerCode(row.masterCode)) return false;
      if (autoDesignCornerFamily(row) !== "other" && autoDesignCornerFamily(row) !== "pull-out") {
        // A 9" lazy Susan / diagonal / blind is not the companion beside the corner.
        if (!isPlainBaseCode(row.masterCode)) return false;
      }
      if (isPullOutCornerCabinet(row)) return false;
      return placement === "base" || placement === "tall" || isPlainBaseCode(row.masterCode);
    }
    return false;
  });
  if (!matches.length) return null;
  const rank = (row: T): number => {
    const placement = (row.placement ?? "").toLowerCase();
    const text = `${row.masterCode} ${row.description ?? ""} ${row.subCategory ?? ""}`.toLowerCase();
    const trayOrPull = placement === "base" && /(?:^|\b)(?:bt|tray|pull-?out|pullout|spice)/.test(text);
    if (placement === "base" || isPlainBaseCode(row.masterCode)) return trayOrPull ? 0 : 1;
    if (placement === "tall") return 2;
    return 3;
  };
  return [...matches].sort((left, right) => rank(left) - rank(right) || left.masterCode.localeCompare(right.masterCode))[0] ?? null;
}

export function placeCompanionBesideCorner(input: {
  source: DesignCabinet;
  corner: PlacedCabinet;
  wallId: string;
  cornerPoint: { x: number; y: number };
  room: RoomData;
  placed: readonly PlacedCabinet[];
  makeUid: () => string;
  styleId: number | null;
}): { placed: PlacedCabinet[]; companion: PlacedCabinet } | null {
  const width = dim(input.source.width, 0);
  const depth = dim(input.source.depth, STD.BASE_DEPTH);
  if (!(width > 0)) return null;
  const frame = wallRunFrame(input.wallId, input.room);
  if (!frame) return null;
  const atStart = Math.hypot(frame.start.x - input.cornerPoint.x, frame.start.y - input.cornerPoint.y) <= 0.01;
  const cornerStart = wallRunOffset(input.corner, input.wallId, input.room);
  const cornerSpan = wallRunSpan(input.corner, input.wallId, input.room);
  if (!(cornerSpan > 0)) return null;
  const along = atStart ? cornerStart + cornerSpan : cornerStart - width;
  if (along < -0.05 || along + width > frame.length + 0.05) return null;
  const spot = wallPlacementAt(Math.max(0, along), width, depth, input.wallId as WallSide, input.room);
  const companion: PlacedCabinet = {
    uid: input.makeUid(),
    cabinetId: input.source.id,
    masterCode: input.source.masterCode,
    description: input.source.description,
    category: input.source.category,
    subCategory: input.source.subCategory,
    placement: (input.source.placement as PlacedCabinet["placement"]) ?? "base",
    ...spot,
    width,
    depth,
    height: dim(input.source.height, standardHeight((input.source.placement as "base" | "tall" | "wall") ?? "base")),
    catalogImageUrl: input.source.catalogImageUrl ?? null,
    numberOfDoors: input.source.numberOfDoors,
    numberOfDrawers: input.source.numberOfDrawers,
    styleId: input.styleId,
  };
  const accepted = appendCollisionFreePlacements([...input.placed], [companion], input.room);
  if (accepted.rejected.length > 0) return null;
  return { placed: accepted.placed, companion };
}

/**
 * Decide the corner TYPE from the available run (appliance-first), then let
 * the catalog supply the SKU. Intake door-line preference does not override
 * a measured band.
 */
export function decideAutoDesignCornerTypeOrder(input: {
  room: RoomData;
  cornerWallIds: readonly string[];
  corner: { x: number; y: number };
  placed: readonly PlacedCabinet[];
  options: readonly CornerOptionForDecision[];
  /** Full line catalog, used only to see whether a 9" companion SKU exists. */
  companionCatalog?: readonly Pick<DesignCabinet, "masterCode" | "description" | "subCategory" | "placement" | "width" | "cornerType">[];
  wiggleLimitIn?: number;
  preferLazySusan?: boolean;
  preferBlind?: boolean;
}): CornerTypeDecision {
  void input.wiggleLimitIn;
  void input.preferLazySusan;
  void input.preferBlind;
  const legs = cornerLegAvailability(input);
  const need = twoLegCornerNeedIn(input.options);
  const tighter = [...legs].sort((left, right) => left.availableIn - right.availableIn)[0];
  const opener = [...legs].sort((left, right) => right.availableIn - left.availableIn)[0];
  const availableIn = tighter?.availableIn ?? 0;
  const relevantWallId = tighter?.wallId ?? null;
  const openWallId = opener && tighter && opener.wallId !== tighter.wallId ? opener.wallId : opener?.wallId ?? null;
  const hasNearbyAppliance = legs.some((leg) => {
    const length = wallLength(leg.wallId, input.room);
    return length > 0 && leg.clearIn < length - 0.5;
  });

  const finish = (
    band: CornerBandId,
    order: AutoDesignCornerFamily[],
    reason: string,
    extras: Partial<Pick<CornerTypeDecision, "companionNine" | "rotateBlind" | "blocked" | "tightness">> = {},
  ): CornerTypeDecision => ({
    band,
    availableIn,
    relevantWallId,
    openWallId,
    tightness: extras.tightness ?? (band === "lazy-susan" && !hasNearbyAppliance ? "open" : "tight"),
    order,
    reason,
    twoLegNeedIn: need,
    companionNine: extras.companionNine ?? false,
    rotateBlind: extras.rotateBlind ?? false,
    blocked: extras.blocked ?? false,
  });

  const catalogFitOrder = (): AutoDesignCornerFamily[] => {
    const fitting = lazySusanFitting(input.options, availableIn);
    return fitting.length
      ? ["lazy-susan", "blind", "diagonal", "pull-out", "other"]
      : ["blind", "lazy-susan", "diagonal", "pull-out", "other"];
  };

  let band = cornerBandForAvailableIn(availableIn);

  if (band === "lazy-susan-plus-nine") {
    // When the full line catalog is supplied, confirm a 9" SKU exists and a
    // lazy Susan leaves 9" beside it. If either is missing, fall to 33–42 logic.
    // When the catalog is omitted (unit tests of the band itself), keep the type.
    if (input.companionCatalog) {
      const nine = pickNineInchCompanion(input.companionCatalog);
      const fitting = lazySusanFitting(input.options, availableIn, NINE_INCH_COMPANION_IN);
      if (!nine || !fitting.length) band = "catalog-fit";
    }
  }

  if (band === "blocked") {
    const tightLeg = legs.find((leg) => leg.wallId === relevantWallId) ?? [...legs].sort((a, b) => a.availableIn - b.availableIn)[0];
    const limiter = tightLeg?.limitingItem ?? null;
    let inTheWay = "";
    if (limiter) {
      if (isRangeOrOven(limiter.masterCode, limiter.description)) {
        inTheWay = " The range is too close to slide a corner cabinet in.";
      } else if (isRefrigerator(limiter)) {
        inTheWay = " The refrigerator is too close to seat a corner cabinet.";
      } else {
        inTheWay = ` ${limiter.masterCode} is too close to seat a corner cabinet.`;
      }
    }
    return finish("blocked", [], `Available run is ${fmt(availableIn)}", under the ${fmt(CORNER_BAND_ROTATED_BLIND_MIN_IN)}" open-leg minimum of a turned blind (base depth plus the 3" filler). The corner stays blocked.${inTheWay}`, { blocked: true, tightness: "tight" });
  }
  if (band === "rotated-blind") {
    return finish("rotated-blind", ["blind", "other"], `Available run is ${fmt(availableIn)}" (under 33"). A blind corner is required, turned so its open leg (base depth + 3" filler) sits on the tight run.`, { rotateBlind: true, tightness: "tight" });
  }
  if (band === "catalog-fit") {
    const fitting = lazySusanFitting(input.options, availableIn);
    const reason = fitting.length
      ? `Available run is ${fmt(availableIn)}" (33" up to 42"). A catalog lazy Susan of ${fitting.map((row) => `${row.masterCode} ${widthOf(row)}"`).join(", ")} fits; otherwise a blind with its 3" filler and pull.`
      : `Available run is ${fmt(availableIn)}" (33" up to 42"). No lazy Susan in the line fits, so a blind corner with its 3" filler and pull is used.`;
    return finish("catalog-fit", catalogFitOrder(), reason, { tightness: "tight" });
  }
  if (band === "lazy-susan-plus-nine") {
    return finish(
      "lazy-susan-plus-nine",
      ["lazy-susan", "blind", "diagonal", "pull-out", "other"],
      `Available run is ${fmt(availableIn)}" (42" up to 43.5"). A catalog lazy Susan plus a 9" cabinet beside it (prefer a 9" base, pull-out, or tray so the counter stays continuous).`,
      { companionNine: true, tightness: "tight" },
    );
  }
  if (band === "pull-out") {
    return finish(
      "pull-out",
      ["pull-out", "blind", "lazy-susan", "diagonal", "other"],
      `Available run is ${fmt(availableIn)}" (43.5" up to 45"). A pull-out / sliding / adjustable corner that slides 3–6". If the line sells none, the next valid type is used.`,
      { tightness: "tight" },
    );
  }
  return finish(
    "lazy-susan",
    ["lazy-susan", "diagonal", "pull-out", "blind", "other"],
    `Available run is ${fmt(availableIn)}" (45" or more). A lazy Susan from the line.`,
    { tightness: hasNearbyAppliance ? "tight" : "open" },
  );
}

/** Options in the decided family order, largest first inside each family. The first family with no SKU is simply skipped. */
export function cornerOptionsInTypeOrder<T extends AutoBuildCornerCandidate>(
  options: readonly T[],
  order: readonly AutoDesignCornerFamily[],
): T[] {
  const seen = new Set<number | string>();
  const out: T[] = [];
  const byWidth = (family: AutoDesignCornerFamily) => [...options]
    .filter((option) => autoDesignCornerFamily(option) === family)
    .sort((left, right) => dim(right.width, 0) - dim(left.width, 0) || left.masterCode.localeCompare(right.masterCode));
  for (const family of order) {
    for (const option of byWidth(family)) {
      const key = option.id ?? option.masterCode;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(option);
    }
  }
  for (const option of options) {
    const key = option.id ?? option.masterCode;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(option);
  }
  return out;
}

export function describeCornerTypeDecision(slotLabel: string, decision: CornerTypeDecision): string {
  const typeName = decision.band === "blocked" ? "no corner cabinet (square stays blocked)"
    : decision.band === "rotated-blind" ? "a turned blind corner"
    : decision.band === "pull-out" ? "a pull-out / sliding corner"
    : decision.band === "lazy-susan-plus-nine" ? "a lazy Susan with a 9 in cabinet beside it"
    : decision.band === "catalog-fit" ? (decision.order[0] === "lazy-susan" ? "a catalog-fitting lazy Susan (or a blind if none fits)" : "a blind corner, or a smaller lazy Susan that fits")
    : "a lazy Susan";
  return `${slotLabel}: ${typeName} — ${decision.reason}`;
}

function fmt(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return String(rounded);
}

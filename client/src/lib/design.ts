// ─── Kitchen Design geometry & snapping engine ──────────────────────────────
// All real-world units are INCHES. The canvas converts inches → pixels via PPI.
import { freestandingCountertopSurfaces, isFreestandingBase } from "@/lib/freestandingRun";
import {
  closestWall as closestPolygonWall,
  isLocked45Wall,
  pointInPolygon,
  positionAlongWall,
  wallAngle as polygonWallAngle,
  wallSegmentLength as polygonWallSegmentLength,
} from "./polygonRoom";
import { VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES, verifiedPelicanBathroomFixtureProfile } from "./pelicanBathroomFixtureProfiles";
import { aefPrintedGeometryForSku, hasAefPrintedGeometry } from "@shared/aefFramelessGeometry";
export { isGlassPolicyNomenclature } from "./glassPolicy";

export const STD = {
  BASE_HEIGHT: 34.5,
  // A freestanding range replaces the 1½-inch countertop slab in its opening,
  // so its burner surface must align with the finished counter top—not the
  // lower 34½-inch base-box top. This keeps a neighboring slab from visually
  // crossing over the stove in every Designer view.
  RANGE_COOKING_SURFACE_HEIGHT: 36,
  // Freestanding range backguards rise above the cooktop to this finished-floor top line.
  RANGE_BACKGUARD_TOP: 47,
  BASE_DEPTH: 24,
  COUNTERTOP_THICKNESS: 1.5,
  COUNTERTOP_HEIGHT: 36,
  WALL_HEIGHT: 30,
  WALL_DEPTH: 12,
  WALL_MOUNT_BOTTOM: 54,
  TALL_HEIGHT: 84,
  TALL_DEPTH: 24,
  TOE_KICK: 4.5,
  SNAP_THRESHOLD: 6,
  // Finished end panels, decorative door panels, and skins are 3/4" stock.
  PANEL_THICKNESS: 0.75,
};

// True for finished end panels, decorative panels, refrigerator/dishwasher
// skins, and door panels — all of which are 3/4" thick flat stock.
export function isPanelItem(c: { description?: string | null; masterCode?: string | null; subCategory?: string | null }): boolean {
  const hay = `${c.subCategory ?? ""} ${c.description ?? ""} ${c.masterCode ?? ""}`.toLowerCase();
  // Match "panel"/"skin" but not unrelated words like "panelized".
  return /\bpanel\b|\bskin\b|end panel|dishwasher panel|refrigerator panel|decorative panel/.test(hay);
}

/** Base end/dishwasher panels are floor-level flat stock, not decorative or refrigerator skins. */
export function isDishwasherPanel(c: {
  description?: string | null;
  masterCode?: string | null;
  subCategory?: string | null;
}): boolean {
  const hay = `${c.subCategory ?? ""} ${c.description ?? ""} ${c.masterCode ?? ""}`.toLowerCase();
  if (/refrigerator|decorative/.test(hay)) return false;
  const code = `${c.masterCode ?? ""}`.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return /^DW(?:EP|PANEL)$/.test(code)
    || /dishwasher\s*(?:end\s*)?panel|\bdw\s*[-_ ]?(?:end\s*)?panel\b|\bbase\s+end\s+panel\b/.test(hay);
}

export const DISHWASHER_PANEL_MAX_MOUNT_BOTTOM_IN = 1 / 3;

/** Enforce the physical installation envelope on new and restored DW panels. */
export function normalizeDishwasherPanelPlacement<T extends {
  placement: Placement;
  mountBottom?: number | null;
  mountBottomAdjusted?: boolean;
} & {
  description?: string | null;
  masterCode?: string | null;
  subCategory?: string | null;
}>(item: T): T {
  if (!isDishwasherPanel(item)) return item;
  const requestedBottom = Number(item.mountBottom);
  const mountBottom = Number.isFinite(requestedBottom)
    ? Math.max(0, Math.min(DISHWASHER_PANEL_MAX_MOUNT_BOTTOM_IN, requestedBottom))
    : 0;
  return { ...item, placement: "base", mountBottom, mountBottomAdjusted: mountBottom > 0 };
}

/** Full-height refrigerator enclosure panels are architectural skins, never cabinet fronts. */
export function isRefrigeratorEndPanel(c: {
  description?: string | null;
  masterCode?: string | null;
  subCategory?: string | null;
  customProfile?: string | null;
}): boolean {
  const hay = `${c.subCategory ?? ""} ${c.description ?? ""} ${c.masterCode ?? ""} ${c.customProfile ?? ""}`.toLowerCase();
  return /refrigerator[-\s]?end[-\s]?panel|refrigerator panel|refrigerator[-\s]?panel|refrigerator-end-panel|\brepv\b/.test(hay);
}

// Loose trim/molding/hardware sold by the linear foot or by the each that is
// NOT a physical box on the floor plan — crown, light rail, toe-kick molding,
// scribe, batten/filler strips, roll-out trays, hinges, knobs/pulls. These stay
// as quantity BOM lines and are not drawn on the canvas.
export function isLooseTrimItem(c: {
  description?: string | null;
  masterCode?: string | null;
  subCategory?: string | null;
}): boolean {
  const hay = `${c.subCategory ?? ""} ${c.description ?? ""} ${c.masterCode ?? ""}`.toLowerCase();
  return /crown|light rail|\btoe ?kick\b|\bscribe\b|\bbatten\b|\bfiller\b|roll[- ]?out|pull[- ]?out tray|\bhinge\b|\bknob\b|\bpull\b|\bhardware\b|molding|moulding|\btrim\b/.test(
    hay
  );
}

// True for accessory-tab items that are physical objects which should be PLACED
// on the drawing (a box/panel the shop sets in the run): decorative end panels,
// base/dishwasher/refrigerator end panels, skins/wallskins, and appliance
// garages. Excludes the loose by-the-foot trim/hardware above. This drives
// whether an accessory drops onto the canvas vs. only adds a BOM line.
export function isPlaceableAccessory(c: {
  description?: string | null;
  masterCode?: string | null;
  subCategory?: string | null;
}): boolean {
  // TEP3096 is a stock panel selected only by Refrigerator Options. The workflow
  // installs it as a cut-to-fit refrigerator side skin beside a bridge cabinet;
  // it must not be offered as a free-standing panel in the ordinary palette.
  if ((c.masterCode ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase() === "TEP3096") return false;
  const hay = `${c.subCategory ?? ""} ${c.description ?? ""} ${c.masterCode ?? ""}`.toLowerCase();
  // Fillers and floating shelves are physical pieces that belong on the plan.
  // They must be considered before the loose-trim exclusion because some vendor
  // catalogs file them under a broad Trim & Molding category.
  if (/\bf(?:ill)?[-_]?\d|\bfiller\b/.test(hay)) return true;
  if (isFloatingShelfItem(c) || isWallOpenShelfCabinet(c)) return true;
  if (isLooseTrimItem(c)) return false;
  if (isPanelItem(c)) return true; // end panels / skins / decorative panels
  // Appliance garages sit on the counter as a real box.
  if (/appliance garage|\bag-?\d/.test(hay)) return true;
  // A knee drawer is a real shallow cabinet box that fits in a seated work
  // area. It must appear in the plan rather than becoming a loose BOM line.
  if (isKneeDrawerItem(c)) return true;
  return false;
}

/** A thin, independently mounted floating shelf—not a full wall open-shelf cabinet. */
export function isFloatingShelfItem(c: {
  description?: string | null;
  masterCode?: string | null;
  subCategory?: string | null;
}): boolean {
  const code = `${c.masterCode ?? ""}`.trim().toUpperCase();
  const hay = `${c.subCategory ?? ""} ${c.description ?? ""}`.toLowerCase();
  return /^FS[-_ ]?\d+(?:\.\d+)?$/.test(code)
    || /\bfloating\s+shelf\b/.test(hay)
    || (/\bopen\s+shelf\b/.test(hay) && !isWallOpenShelfCabinet(c));
}

/**
 * Catalog wall open-shelf cabinets are full-height, wall-mounted cabinet boxes.
 * They must never be reduced to a 2.06-inch floating shelf just because their
 * description includes "open shelf." The KitchenCrest WOS family is a standard
 * wall-open shelf; a WEOS or an explicit Wall End Shelf is a distinct end form.
 */
export function isWallOpenShelfCabinet(c: {
  description?: string | null;
  masterCode?: string | null;
  subCategory?: string | null;
}): boolean {
  const code = `${c.masterCode ?? ""}`.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const hay = `${c.subCategory ?? ""} ${c.description ?? ""}`.toLowerCase();
  return /^W(?:E)?OS\d{4}$/.test(code)
    || kitchenCrestGenericOpenEndShelfCount(c) != null
    || /\bwall\s+(?:end\s+)?open\s+shelf\b|\bwall\s+end\s+shelf\b|\bopen\s+end\s+shelf\s+wall\b/.test(hay);
}

/**
 * The 2023 KitchenCrest line-art book documents OE630/OE636/OE642 as square
 * six-inch wall open-end shelves: two interior shelves at 30 inches and three
 * at 36/42 inches. The code and an explicit open-shelf description must both
 * match, so an unrelated source line can never inherit this generic form.
 * This is visual/configuration normalization only; source dimensions, price,
 * availability, image, and the sellable identity remain untouched.
 */
export function kitchenCrestGenericOpenEndShelfCount(c: {
  description?: string | null;
  masterCode?: string | null;
  subCategory?: string | null;
}): number | null {
  const code = `${c.masterCode ?? ""}`.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const hay = `${c.subCategory ?? ""} ${c.description ?? ""}`.toLowerCase();
  if (!/^OE6(?:30|36|42)$/.test(code) || !/\bopen\s+(?:end\s+)?shelf\b/.test(hay)) return null;
  return code === "OE630" ? 2 : 3;
}

export const KNEE_DRAWER_MIN_MOUNT_BOTTOM_IN = 24;
export const KNEE_DRAWER_DEFAULT_MOUNT_BOTTOM_IN = 30;
export const KNEE_DRAWER_MAX_MOUNT_BOTTOM_IN = 30;

/** A shallow pull-out drawer mounted in a seated knee-space opening. */
export function isKneeDrawerItem(c: {
  description?: string | null;
  masterCode?: string | null;
  subCategory?: string | null;
  category?: string | null;
}): boolean {
  const code = (c.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const hay = `${c.category ?? ""} ${c.subCategory ?? ""} ${c.description ?? ""}`.toLowerCase();
  return /\bknee\s*drawer\b|\bknee\b/.test(hay) || /^(?:VKD|DKD|KD)\d/.test(code);
}

/**
 * Repairs legacy FS catalog rows that were imported with a base-cabinet body.
 * The source shelf series is consistently a 12-inch-deep, 2.06-inch-thick wall
 * shelf; its code supplies the authoritative nominal width. This normalizer is
 * deliberately limited to FS-width shelf codes so no other accessory changes.
 */
export function normalizeFloatingShelfPlacement(cabinet: PlacedCabinet): PlacedCabinet {
  if (!isFloatingShelfItem(cabinet)) return cabinet;
  const widthMatch = /^FS[-_ ]?(\d+(?:\.\d+)?)$/i.exec(cabinet.masterCode ?? "");
  const width = Number(widthMatch?.[1]);
  if (!Number.isFinite(width) || width <= 0) return cabinet;
  return {
    ...cabinet,
    placement: "wall",
    width,
    nominalWidth: width,
    depth: STD.WALL_DEPTH,
    nominalDepth: STD.WALL_DEPTH,
    height: 2.06,
    nominalHeight: 2.06,
    numberOfDoors: 0,
    numberOfDrawers: 0,
  };
}

/**
 * Restores stale WOS/WEOS placements that were once incorrectly normalized as
 * thin floating shelves. The source nomenclature is width-first then height:
 * WOS0930 / WEOS0930 = 9-inch wide × 30-inch high and a 12-inch wall depth.
 * Only the explicit Wall End Shelf (WEOS) carries the verified bowed-front,
 * two-fixed-shelf geometry; a standard WOS retains its own source attributes.
 */
export function normalizeWallOpenShelfPlacement(cabinet: PlacedCabinet): PlacedCabinet {
  if (!isWallOpenShelfCabinet(cabinet)) return cabinet;
  const code = `${cabinet.masterCode ?? ""}`.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const match = /^W(?:E)?OS(\d{2})(\d{2})$/.exec(code);
  const genericShelfCount = kitchenCrestGenericOpenEndShelfCount(cabinet);
  if (!match && genericShelfCount == null) return cabinet;
  const width = match ? Number(match[1]) : Number(cabinet.width);
  const height = match ? Number(match[2]) : Number(cabinet.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return cabinet;
  return {
    ...cabinet,
    placement: "wall",
    width,
    nominalWidth: width,
    depth: STD.WALL_DEPTH,
    nominalDepth: STD.WALL_DEPTH,
    height,
    nominalHeight: height,
    numberOfDoors: 0,
    numberOfDrawers: 0,
    fixedShelfCount: genericShelfCount
      ?? (/^WEOS\d{4}$/.test(code) ? 2 : cabinet.fixedShelfCount),
  };
}

/** True for physical filler strips, including compact catalog codes such as F342. */
export function isFillerItem(c: {
  masterCode?: string | null;
  description?: string | null;
  subCategory?: string | null;
}) {
  const code = `${c.masterCode ?? ""}`.trim().toUpperCase();
  const hay = `${c.subCategory ?? ""} ${c.description ?? ""}`.toLowerCase();
  return /^F(?:ILL)?[-_]?\d/.test(code) || /\bfiller\b/.test(hay);
}

const FILLER_ADJACENCY_TOLERANCE_IN = 0.25;

function fillerLayer(placement: Placement): "wall" | "floor" | null {
  if (placement === "wall") return "wall";
  if (placement === "base" || placement === "tall" || placement === "appliance") return "floor";
  return null;
}

/**
 * Returns the cabinet whose exposed side directly borders an installed filler.
 * An explicit saved owner is authoritative; older plans are repaired by exact
 * same-wall edge contact. Wall and floor runs never cross-match.
 */
export function adjacentCabinetForFiller(
  filler: PlacedCabinet,
  placed: readonly PlacedCabinet[],
  room: RoomData,
): PlacedCabinet | null {
  if (!isFillerItem(filler)) return null;
  const explicitOwner = filler.fillerForCabinetUid
    ? placed.find((item) => item.uid === filler.fillerForCabinetUid && !isFillerItem(item)) ?? null
    : null;
  if (explicitOwner) return explicitOwner;

  const layer = fillerLayer(filler.placement);
  if (!layer) return null;
  const wall = cabinetWall(filler, room);
  const fillerStart = wallRunOffset(filler, wall, room);
  const fillerEnd = fillerStart + wallRunSpan(filler, wall, room);
  return placed
    .filter((item) => item.uid !== filler.uid && !isFillerItem(item))
    .filter((item) => fillerLayer(item.placement) === layer && cabinetWall(item, room) === wall)
    .map((item) => {
      const start = wallRunOffset(item, wall, room);
      const end = start + wallRunSpan(item, wall, room);
      return { item, edgeGap: Math.min(Math.abs(fillerStart - end), Math.abs(fillerEnd - start)) };
    })
    .filter(({ edgeGap }) => edgeGap <= FILLER_ADJACENCY_TOLERANCE_IN)
    .sort((left, right) => {
      const placementPriority = (left.item.placement === "appliance" ? 1 : 0) - (right.item.placement === "appliance" ? 1 : 0);
      return placementPriority || left.edgeGap - right.edgeGap;
    })[0]?.item ?? null;
}

/**
 * A refrigerator-side filler is an architectural strip for that refrigerator.
 * At restore time only, a direct refrigerator edge supersedes a stale saved
 * base-owner link. This never affects ordinary explicitly owned fillers.
 */
function refrigeratorAdjacentToFiller(
  filler: PlacedCabinet,
  placed: readonly PlacedCabinet[],
  room: RoomData,
): PlacedCabinet | null {
  if (!isFillerItem(filler) || fillerLayer(filler.placement) !== "floor") return null;
  const wall = cabinetWall(filler, room);
  const fillerStart = wallRunOffset(filler, wall, room);
  const fillerEnd = fillerStart + wallRunSpan(filler, wall, room);
  return placed
    .filter((item) => item.uid !== filler.uid && isRefrigerator(item) && cabinetWall(item, room) === wall)
    .map((item) => {
      const start = wallRunOffset(item, wall, room);
      const end = start + wallRunSpan(item, wall, room);
      return { item, edgeGap: Math.min(Math.abs(fillerStart - end), Math.abs(fillerEnd - start)) };
    })
    .filter(({ edgeGap }) => edgeGap <= FILLER_ADJACENCY_TOLERANCE_IN)
    .sort((left, right) => left.edgeGap - right.edgeGap)[0]?.item ?? null;
}

/**
 * A required blind-corner filler is trim, not a second cabinet body. Its
 * installed face is capped at the trade-standard 3 inches and may touch the
 * owning BBC/WBC at the intended return. Unrelated fillers remain collisions.
 */
function isRequiredBlindCornerFillerJoinPeer(
  filler: PlacedCabinet,
  peer: PlacedCabinet,
): boolean {
  if (!isFillerItem(filler) || !isBlindCorner(peer.masterCode, peer.description)) return false;
  const hasRequiredGroup = /^(?:bbc|wbc)-required-filler-/.test(filler.fillerPieceGroupId ?? "");
  const explicitlyOwned = filler.fillerForCabinetUid === peer.uid && hasRequiredGroup;
  const installedWidth = Math.min(Math.abs(Number(filler.width)), Math.abs(Number(filler.depth)));
  if (!Number.isFinite(installedWidth) || installedWidth <= 0 || installedWidth > BLIND_CORNER_FILLER_WIDTH_IN + COLLISION_EPSILON_IN) return false;
  const fillerElevation = elevationBox(filler);
  const peerElevation = elevationBox(peer);
  if (filler.placement !== peer.placement
    || Math.abs(fillerElevation.bottom - peerElevation.bottom) > COLLISION_EPSILON_IN
    || Math.abs(fillerElevation.height - peerElevation.height) > COLLISION_EPSILON_IN) return false;
  if (explicitlyOwned) return true;
  if (filler.fillerForCabinetUid || filler.fillerPieceGroupId || hasRequiredGroup) return false;

  // Older saved drawings can retain the real 3-inch filler code and geometry
  // without fillerForCabinetUid/fillerPieceGroupId. Permit only the shallow
  // boundary overlap that represents the BBC return; do not waive a filler
  // buried inside a cabinet or an unrelated cabinet-sized overlap.
  const fillerFootprint = placedFootprint(filler);
  const peerFootprint = placedFootprint(peer);
  const overlapX = Math.min(filler.x + fillerFootprint.w, peer.x + peerFootprint.w) - Math.max(filler.x, peer.x);
  const overlapY = Math.min(filler.y + fillerFootprint.d, peer.y + peerFootprint.d) - Math.max(filler.y, peer.y);
  return overlapX > COLLISION_EPSILON_IN
    && overlapY > COLLISION_EPSILON_IN
    && Math.min(overlapX, overlapY) <= 0.5;
}

/**
 * Installation rule: a filler is cut to the exact vertical envelope of the
 * cabinet beside it and sits on the same front-depth datum. Catalog/nominal
 * dimensions remain available for purchasing; installed dimensions drive the
 * plan, elevation, 3D scene, and build sheet.
 */
export function matchInstalledFillerToCabinet(
  filler: PlacedCabinet,
  owner: PlacedCabinet,
  room?: Pick<RoomData, "ceilingHeight"> | null,
): PlacedCabinet {
  if (!isFillerItem(filler) || isFillerItem(owner)) return filler;
  const ownerElevation = elevationBox(owner, room);
  const placement: Placement = owner.placement === "wall"
    ? "wall"
    : owner.placement === "tall" ? "tall" : "base";
  const ownerDepth = Number(owner.depth);
  return {
    ...filler,
    placement,
    depth: Number.isFinite(ownerDepth) && ownerDepth > 0
      ? ownerDepth
      : placement === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH,
    height: ownerElevation.height,
    mountBottom: ownerElevation.bottom,
    fillerForCabinetUid: owner.uid,
    fillerMatchesFullOwnerEnvelope: owner.placement === "appliance" && isRefrigerator(owner),
  };
}

/** Repairs legacy filler records before collision checks and rendering. */
export function normalizeInstalledFillersToAdjacentCabinets(
  placements: PlacedCabinet[],
  room: RoomData,
): PlacedCabinet[] {
  let changed = false;
  const next = placements.map((item) => {
    if (!isFillerItem(item) || item.integratedWallBlindFiller === true) return item;
    const roleLinkedBridgeOwner = (item.refrigeratorAssemblyRole === "bridge-left-filler" || item.refrigeratorAssemblyRole === "bridge-right-filler")
      && item.refrigeratorAssemblyId
      ? placements.find((candidate) => candidate.refrigeratorAssemblyId === item.refrigeratorAssemblyId
        && candidate.refrigeratorAssemblyRole === "bridge"
        && !isFillerItem(candidate)) ?? null
      : null;
    // The durable cap-filler role was added after the original refrigerator
    // enclosure picker. Those older saved fillers still carry the user's exact
    // selected bridge UID. When that owner is a wall cabinet explicitly linked
    // to a refrigerator, it is a cap filler—not a floor-to-fridge-side strip.
    // Preserve that proven association before the refrigerator edge fallback.
    const explicitBridgeOwner = item.fillerForCabinetUid
      ? placements.find((candidate) => candidate.uid === item.fillerForCabinetUid
        && candidate.placement === "wall"
        && candidate.refrigeratorAssemblyId
        && placements.some((refrigerator) => refrigerator.uid === candidate.refrigeratorAssemblyId && isRefrigerator(refrigerator))) ?? null
      : null;
    const bridgeOwner = roleLinkedBridgeOwner ?? explicitBridgeOwner;
    const refrigeratorOwner = refrigeratorAdjacentToFiller(item, placements, room);
    // A saved cap filler can predate its explicit bridge UID and still retain
    // the refrigerator assembly role. That role is more specific than merely
    // touching the refrigerator: it follows the cabinet above the fridge, not
    // the refrigerator's floor-to-top side-filler envelope.
    const owner = bridgeOwner ?? refrigeratorOwner ?? adjacentCabinetForFiller(item, placements, room);
    if (!owner) return item;
    // Front-miter pairs retain their deliberately shallow physical board and
    // measured plan footprint. Their vertical band still belongs exactly to
    // the cabinet face they butt, including raised uppers and tall cabinets.
    if (item.fillerTransitionKind) {
      const ownerElevation = elevationBox(owner, room);
      const placement: Placement = owner.placement === "wall"
        ? "wall"
        : owner.placement === "tall" ? "tall" : "base";
      const differs = item.placement !== placement
        || Math.abs(Number(item.height) - ownerElevation.height) > 0.001
        || Math.abs(Number(item.mountBottom ?? 0) - ownerElevation.bottom) > 0.001
        || item.fillerForCabinetUid !== owner.uid
        || item.fillerMatchesFullOwnerEnvelope !== (owner.placement === "appliance" && isRefrigerator(owner));
      if (!differs) return item;
      changed = true;
      return {
        ...item,
        placement,
        height: ownerElevation.height,
        mountBottom: ownerElevation.bottom,
        fillerForCabinetUid: owner.uid,
        fillerMatchesFullOwnerEnvelope: owner.placement === "appliance" && isRefrigerator(owner),
      };
    }
    const matched = matchInstalledFillerToCabinet(item, owner, room);
    const itemBottom = item.mountBottom == null ? null : Number(item.mountBottom);
    const matchedBottom = matched.mountBottom == null ? null : Number(matched.mountBottom);
    const differs = matched.placement !== item.placement
      || Math.abs(Number(matched.depth) - Number(item.depth)) > 0.001
      || Math.abs(Number(matched.height) - Number(item.height)) > 0.001
      || itemBottom !== matchedBottom
      || item.fillerForCabinetUid !== matched.fillerForCabinetUid
      || item.fillerMatchesFullOwnerEnvelope !== matched.fillerMatchesFullOwnerEnvelope;
    if (!differs) return item;
    changed = true;
    return matched;
  });
  return changed ? next : placements;
}

export const FILLER_MIN_WIDTH_IN = 0.125;

/** A filler may trim down to 1/8in, but never grows beyond its own catalog width. */
export function fillerWidthRange(c: {
  masterCode?: string | null;
  description?: string | null;
  subCategory?: string | null;
  width?: number | null;
  nominalWidth?: number | null;
}) {
  if (!isFillerItem(c)) return null;
  const catalogWidth = Number(c.nominalWidth ?? c.width);
  return {
    min: FILLER_MIN_WIDTH_IN,
    max: Number.isFinite(catalogWidth) && catalogWidth > 0 ? catalogWidth : 3,
  };
}

// Which placement a placeable accessory should take when dropped. Panels/skins
// and appliance garages mounted high read as wall items; everything else sits
// on the floor as a base-zone object.
export function accessoryPlacement(c: {
  description?: string | null;
  masterCode?: string | null;
  subCategory?: string | null;
}): Placement {
  const hay = `${c.subCategory ?? ""} ${c.description ?? ""} ${c.masterCode ?? ""}`.toLowerCase();
  if (isKneeDrawerItem(c)) return "baseTop";
  if (isDishwasherPanel(c)) return "base";
  if (/appliance garage|\bag-?\d/.test(hay)) return "wall";
  if (isFloatingShelfItem(c) || isWallOpenShelfCabinet(c)) return "wall";
  if (/wall ?skin|\bws\b|wall panel|refrigerator panel/.test(hay)) return "wall";
  return "base";
}

export type Placement = "base" | "wall" | "tall" | "appliance" | "baseTop" | "underCabinet";

// Synthetic appliance catalog. Appliances are not cabinets (no DB row / price),
// so they carry id = 0 and are skipped by the pricing engine. Dimensions are in
// inches; `elevHeight` and `elevBottom` describe how they sit on the wall in the
// front elevation view.
// A design room type. Each drives a room-specific palette of cabinets +
// fixtures. "closet" keeps its modular-parts behavior; "other" is a generic
// catch-all that shows the full cabinet set.
export type RoomType = "kitchen" | "bathroom" | "laundry" | "closet" | "other";

export const ROOM_TYPES: { value: RoomType; label: string }[] = [
  { value: "kitchen", label: "Kitchen" },
  { value: "bathroom", label: "Bathroom" },
  { value: "laundry", label: "Laundry" },
  { value: "closet", label: "Closet" },
  { value: "other", label: "Other" },
];

export interface ApplianceDef {
  key: string;
  masterCode: string;
  description: string;
  width: number;
  depth: number;
  elevBottom: number; // inches from floor
  elevHeight: number; // visible height in elevation
  /** Product visual selected in the designer palette; geometry remains catalog-owned. */
  catalogImageUrl?: string | null;
  // Which room types this fixture/appliance shows up in. Kitchen items default
  // to ["kitchen"]; shared items (e.g. a sink) can list multiple rooms.
  rooms: RoomType[];
}

export const APPLIANCES: ApplianceDef[] = [
  // ── Kitchen ──────────────────────────────────────────────────────────────
  { key: "range-black-gas", masterCode: "RANGE-30", description: '30" Black Gas Range', width: 30, depth: 25, elevBottom: 0, elevHeight: 36, catalogImageUrl: "/manus-storage/30inchWideBlackGasRange-silhouette_0a25e71c.webp", rooms: ["kitchen"] },
  { key: "range-black-stainless-front-control", masterCode: "RANGE-30", description: '30" Black Stainless Front-Control Range', width: 30, depth: 25, elevBottom: 0, elevHeight: 36, catalogImageUrl: "/manus-storage/30InchWideBlackStainlessSteelFrontControlRange-cropped_96100940.webp", rooms: ["kitchen"] },
  { key: "range-white-electric-front-control", masterCode: "RANGE-30", description: '30" White Electric Front-Control Range', width: 30, depth: 25, elevBottom: 0, elevHeight: 36, catalogImageUrl: "/manus-storage/30InchZlineFrontControlWhiteElectricRange-cropped_e5144787.webp", rooms: ["kitchen"] },
  { key: "range-stainless-electric", masterCode: "RANGE-30", description: '30" Stainless Electric Range', width: 30, depth: 25, elevBottom: 0, elevHeight: 36, catalogImageUrl: "/manus-storage/30inchWideStainlessSteelElectricRange-cropped_c6f3d3e6.webp", rooms: ["kitchen"] },
  { key: "range-stainless-front-control", masterCode: "RANGE-30", description: '30" Stainless Front-Control Range', width: 30, depth: 25, elevBottom: 0, elevHeight: 36, catalogImageUrl: "/manus-storage/30InchWideStainlessSteelFrontControlRange-cropped_da918204.webp", rooms: ["kitchen"] },
  { key: "range-stainless-gas", masterCode: "RANGE-30", description: '30" Stainless Gas Range', width: 30, depth: 25, elevBottom: 0, elevHeight: 36, catalogImageUrl: "/manus-storage/30inchWideStainlessSteelGasRange.webp-cropped_fa82008a.webp", rooms: ["kitchen"] },
  { key: "range-white-electric", masterCode: "RANGE-30", description: '30" White Electric Range', width: 30, depth: 25, elevBottom: 0, elevHeight: 36, catalogImageUrl: "/manus-storage/30inchWideWhiteElectricrange-cropped_e64ebed4.webp", rooms: ["kitchen"] },
  { key: "range-white-gas", masterCode: "RANGE-30", description: '30" White Gas Range', width: 30, depth: 25, elevBottom: 0, elevHeight: 36, catalogImageUrl: "/manus-storage/30inchWideWhiteGasRange-cropped_df211ef6.webp", rooms: ["kitchen"] },
  { key: "fridge30", masterCode: "FRIDGE-30", description: 'Refrigerator 30"', width: 30, depth: 30, elevBottom: 0, elevHeight: 70, rooms: ["kitchen"] },
  { key: "fridge", masterCode: "FRIDGE-36", description: 'Refrigerator 36"', width: 36, depth: 30, elevBottom: 0, elevHeight: 70, catalogImageUrl: "/manus-storage/lg_french_door_refrigerator_front_b498406f.webp", rooms: ["kitchen"] },
  { key: "dishwasher", masterCode: "DW-24", description: 'Dishwasher 24"', width: 24, depth: 24, elevBottom: 0, elevHeight: 34.5, catalogImageUrl: "/manus-storage/whirlpool_dishwasher_front_5c695d52.webp", rooms: ["kitchen"] },
  { key: "winecooler", masterCode: "WINE-24", description: 'Wine Cooler 24"', width: 24, depth: 24, elevBottom: 0, elevHeight: 34.5, rooms: ["kitchen"] },
  { key: "sink", masterCode: "SINK-33", description: 'Sink 33"', width: 33, depth: 22, elevBottom: 30, elevHeight: 6, rooms: ["kitchen"] },
  { key: "hood-glass-stainless", masterCode: "HOOD-30", description: '30" Glass Stainless Range Hood', width: 30, depth: 18, elevBottom: 66, elevHeight: 18, catalogImageUrl: "/manus-storage/30InchGlassStainlessRangeHood-cropped_4a695aa8.webp", rooms: ["kitchen"] },
  { key: "hood-stainless-30", masterCode: "HOOD-30", description: '30" Stainless Range Hood', width: 30, depth: 18, elevBottom: 66, elevHeight: 18, catalogImageUrl: "/manus-storage/30InchWideStainlessRangeHood-cropped_b83ef9d3.webp", rooms: ["kitchen"] },
  { key: "hood-stainless-36", masterCode: "HOOD-36", description: '36" Stainless Range Hood', width: 36, depth: 18, elevBottom: 66, elevHeight: 18, catalogImageUrl: "/manus-storage/36InchStainlessRangeHood-cropped_275ed94d.webp", rooms: ["kitchen"] },
  { key: "microwave", masterCode: "MW-30", description: 'Over-Range Microwave 30"', width: 30, depth: 15, elevBottom: 56, elevHeight: 16, catalogImageUrl: "/manus-storage/zline_over_range_microwave_front_4976b7ab.webp", rooms: ["kitchen"] },
  // ── Bathroom fixtures (layout-only props, quoted separately) ──────────────
  { key: "shower", masterCode: "FIX-SHOWER-36", description: 'Shower 36"', width: 36, depth: 36, elevBottom: 0, elevHeight: 78, rooms: ["bathroom"] },
  { key: "tub", masterCode: "FIX-TUB-60", description: 'Bathtub 60"', width: 60, depth: 30, elevBottom: 0, elevHeight: 20, rooms: ["bathroom"] },
  { key: "toilet", masterCode: "FIX-TOILET", description: "Toilet", width: 20, depth: 28, elevBottom: 0, elevHeight: 30, rooms: ["bathroom"] },
  { key: "bathsink", masterCode: "FIX-BATHSINK-24", description: 'Bathroom Sink 24"', width: 24, depth: 21, elevBottom: 30, elevHeight: 6, rooms: ["bathroom"] },
  // ── Laundry fixtures (layout-only props, quoted separately) ───────────────
  { key: "washer", masterCode: "FIX-WASHER-27", description: 'Washer 27"', width: 27, depth: 30, elevBottom: 0, elevHeight: 38, rooms: ["laundry"] },
  { key: "dryer", masterCode: "FIX-DRYER-27", description: 'Dryer 27"', width: 27, depth: 30, elevBottom: 0, elevHeight: 38, rooms: ["laundry"] },
  { key: "laundrytub", masterCode: "FIX-LAUNDRYTUB-25", description: 'Laundry Tub 25"', width: 25, depth: 22, elevBottom: 0, elevHeight: 34.5, rooms: ["laundry"] },
];

export function isApplianceCode(masterCode: string): boolean {
  return /^(RANGE|FRIDGE|DW|SINK|HOOD|MW|WINE|FIX)-/.test((masterCode || "").toUpperCase());
}

/**
 * A base-height appliance occupies a base cabinet bay below the finished
 * counter line and supports the same continuous slab as a base cabinet.
 * Classification is structural—catalog category/subcategory plus installed
 * elevation—not a SKU allow-list. Countertop-opening and freestanding
 * appliances are explicit openings instead.
 */
export function isBaseHeightAppliance(p: {
  placement?: Placement | null;
  category?: string | null;
  subCategory?: string | null;
  height?: number | string | null;
  mountBottom?: number | string | null;
  applianceRole?: "base-height" | "countertop-opening" | "freestanding" | null;
}): boolean {
  if (p.applianceRole === "countertop-opening" || p.applianceRole === "freestanding") return false;
  const category = `${p.category ?? ""}`.trim().toLowerCase();
  const subCategory = `${p.subCategory ?? ""}`.trim().toLowerCase();
  const isApplianceCategory = category.includes("appliance") || subCategory.includes("appliance");
  if (p.placement !== "appliance" && !isApplianceCategory) return false;
  if (!isApplianceCategory) return false;
  const bottom = Number(p.mountBottom ?? 0);
  const height = Number(p.height);
  return Number.isFinite(bottom) && bottom <= 1
    && Number.isFinite(height) && height > 0 && height <= STD.BASE_HEIGHT + STD.COUNTERTOP_THICKNESS;
}

// Appliances/fixtures available for a given room type. Kitchen shows the kitchen
// appliance set; bathroom/laundry show their fixtures. Closet/other show none
// (closet uses modular parts; other relies on cabinets only).
export function appliancesForRoom(roomType: RoomType): ApplianceDef[] {
  return APPLIANCES.filter((a) => a.rooms.includes(roomType));
}

// Convert an appliance definition into a DesignCabinet-like object so it flows
// through the same add/drag/drop placement pipeline as cabinets.
export function applianceAsDesignCabinet(a: ApplianceDef): DesignCabinet {
  return {
    id: 0,
    masterCode: a.masterCode,
    description: a.description,
    category: "Appliance",
    subCategory: null,
    width: String(a.width),
    height: String(a.elevHeight),
    depth: String(a.depth),
    placement: "appliance",
    numberOfDoors: null,
    numberOfDrawers: null,
    catalogImageUrl: a.catalogImageUrl ?? null,
    isCornerCabinet: false,
    mountBottom: a.elevBottom,
  };
}

/**
 * Keeps an explicitly selected appliance visual on a saved placement. Older
 * placements did not persist visual choices, so a deterministic first supplied
 * appearance is used for the matching appliance family instead of falling back
 * to a generic drawing.
 */
export function applianceAppearanceImage(masterCode: string | null | undefined, selectedUrl?: string | null): string | null {
  const explicit = selectedUrl?.trim();
  if (explicit) return explicit;
  const normalized = `${masterCode ?? ""}`.toUpperCase();
  return APPLIANCES.find((item) => item.masterCode === normalized && Boolean(item.catalogImageUrl))?.catalogImageUrl ?? null;
}

export type RangeVisualAppearance = {
  finish: "stainless" | "black-stainless" | "white" | "black";
  fuel: "gas" | "electric";
  controlPosition: "front" | "rear";
  cooktopStyle: "gas-grate" | "electric-glass";
  backPanel: "raised" | "none";
  controlCount: number;
  ovenConfiguration: "single" | "double";
  bodyColor: string;
  controlColor: string;
};

/** Resolve the selected catalog range variant into deterministic 2D/3D finish data. */
export function rangeVisualAppearance(input: { description?: string | null; catalogImageUrl?: string | null }): RangeVisualAppearance {
  const source = `${input.description ?? ""} ${input.catalogImageUrl ?? ""}`.toLowerCase();
  const finish = /black[\s-]*stainless/.test(source)
    ? "black-stainless"
    : /\bwhite\b/.test(source)
      ? "white"
      : /\bblack\b/.test(source)
        ? "black"
        : "stainless";
  const fuel = /\bgas\b/.test(source) ? "gas" : "electric";
  const controlPosition = /front[\s-]*control/.test(source) ? "front" : "rear";
  const cooktopStyle = fuel === "gas" ? "gas-grate" : "electric-glass";
  const backPanel = controlPosition === "rear" ? "raised" : "none";
  const controlCount = fuel === "gas" ? 5 : 4;
  const ovenConfiguration = /double[\s-]*oven/.test(source) ? "double" : "single";
  const colors: Record<RangeVisualAppearance["finish"], Pick<RangeVisualAppearance, "bodyColor" | "controlColor">> = {
    stainless: { bodyColor: "#c7cbd0", controlColor: "#3b4147" },
    "black-stainless": { bodyColor: "#343a40", controlColor: "#12161b" },
    white: { bodyColor: "#f1f3f5", controlColor: "#aeb6c0" },
    black: { bodyColor: "#15191e", controlColor: "#070a0e" },
  };
  return { finish, fuel, controlPosition, cooktopStyle, backPanel, controlCount, ovenConfiguration, ...colors[finish] };
}

export function applianceElevationPresentation(masterCode: string | null | undefined): "vector" | "photo" {
  // A microwave is a front-facing wall appliance, so an approved catalog front
  // image reads correctly in elevation. Ranges remain measured vectors because
  // their catalog photography often exposes a perspective cooktop.
  return /^MW[-_]?/i.test(masterCode ?? "") ? "photo" : "vector";
}

export interface DesignCabinet {
  id: number;
  masterCode: string;
  /** Palette-only label for a composed catalog choice; never persisted or priced as a SKU. */
  displayMasterCode?: string | null;
  description: string;
  category: string | null;
  subCategory: string | null;
  width: string | null;
  height: string | null;
  depth: string | null;
  placement: Placement;
  /** Distributor-specific construction marker; AEF uses printed geometry instead of shared-master defaults. */
  constructionMethod?: string | null;
  applianceRole?: "base-height" | "countertop-opening" | "freestanding" | null;
  applianceProductId?: number | null;
  applianceCatalogCode?: string | null;
  applianceCatalogName?: string | null;
  applianceCatalogPrice?: number | null;
  cooktopConversionStatus?: CooktopConversionStatus;
  numberOfDoors: number | null;
  numberOfDrawers: number | null;
  isCornerCabinet: boolean | null;
  /** Cabinet Config requirement for a linked blind-corner filler assembly. */
  fillerRequired?: boolean | null;
  /** Floor height for an appliance or configured wall-mounted item. */
  mountBottom?: number | null;
  catalogImageUrl?: string | null;
  // Live Cabinet Config drawing rules. These are refreshed into older placed
  // designs so a catalog correction applies without re-placing the cabinet.
  specImageUrl?: string | null;
  graphicType?: string | null;
  // Manufacturer blind-corner pull range (inches across the corner). Optional;
  // when absent for a blind corner, the design flags a conflict so the admin
  // can enter the spec.
  pullMin?: number | null;
  pullMax?: number | null;
  // Corner cabinet type from the catalog config (lazy-susan, blind-corner,
  // diagonal, pie-cut, l-shape, triangle). Optional for backward-compat.
  cornerType?: string | null;
  openingType?: "top" | "middle" | "bottom" | null;
  doorHeight?: number | null;
  drawerHeight?: number | null;
  /** Explicit count of side-by-side door leaves in a source-configured row. */
  doorsPerRow?: number | null;
  doorOrientation?: "side-by-side" | "stacked" | null;
  /** Source-defined oven configuration when the selected catalog tower has no user choice. */
  ovenType?: "single" | "double" | null;
  /** Only an explicit distributor source record may replace generic oven drawer defaults. */
  sourceOvenDrawerLayout?: boolean | null;
  layoutSpec?: string | null;
  drawerLayout?: string | null;
	  customProfile?: string | null;
	  facePattern?: "slats" | "criss-cross" | "lattice" | "open" | null;
	  /** Catalog choice represents a glass-front cabinet configuration. */
	  glassDoor?: boolean | null;
	  glassDoorAddonCode?: string | null;
	  /** Selected distributor includes the glass insert in this glass SKU's price. */
	  glassIncluded?: boolean | null;
}

// Door hinge side as seen from the front of the cabinet. "none" is used for
// items without a hinged door (drawer bases, open shelves, panels, appliances).
export type DoorSwing = "left" | "right" | "double" | "none";
export type DecorativeEndTreatment = "none" | "left" | "right" | "both";
/** Horizontal position of the visible pull or knob on a placed cabinet front. */
export type CabinetHardwarePosition = "auto" | "left" | "center" | "right" | "paired" | "top-center";

export type RefrigeratorAssemblyRole =
  | "bridge"
  | "bridge-left-filler"
  | "bridge-right-filler"
  | "left-panel"
  | "right-panel";
export type RefrigeratorPanelMode = "left" | "right" | "both" | "none";
/**
 * The appliance manufacturer requires one half inch of installation clearance
 * at either side of a refrigerator.  This is a physical opening dimension, not
 * a camera/rendering allowance and therefore belongs in the shared plan model.
 */
export const REFRIGERATOR_SIDE_CLEARANCE_IN = 0.5;
export type IslandFace = "front" | "back" | "left" | "right";
/** Floor treatment for a shallow wall cabinet intentionally used as an island face. */
export type IslandWallCabinetBaseTreatment = "toe-kick" | "base-molding";

export interface PlacedCabinet {
  uid: string;
  cabinetId: number;
  masterCode: string;
  description: string;
  /**
   * Identifies a cabinet created by one Peninsula Wizard transaction. This is
   * deliberately separate from `wallId`: a customer can add ordinary cabinets
   * to a peninsula wall without allowing a later Wizard edit to overwrite them.
   */
  peninsulaWizardId?: string | null;
  // Catalog category / sub-category, carried from the source cabinet so the
  // canvas drawing + accessibility label classify the PLACED cabinet the same
  // way the palette does. Without these, cabinetDrawingType() can't tell a real
  // base/wall/tall box from an accessory strip and a normal base cabinet whose
  // description mentions "shelf"/"panel" gets mislabeled "accessory / trim".
  // Optional for backward-compat with older saved designs.
  category?: string | null;
  subCategory?: string | null;
  /** Current master corner classification, refreshed into older saved designs. */
  isCornerCabinet?: boolean | null;
  /** Persisted Cabinet Config requirement for a linked blind-corner filler assembly. */
  fillerRequired?: boolean | null;
  placement: Placement;
  /** Preserves distributor-specific printed geometry through placement and restore. */
  constructionMethod?: string | null;
  /** Structural appliance classification used by countertop/rendering parity. */
  applianceRole?: "base-height" | "countertop-opening" | "freestanding" | null;
  /** Selected catalog product when this is a first-class appliance item. */
  applianceProductId?: number | null;
  applianceCatalogCode?: string | null;
  applianceCatalogName?: string | null;
  applianceCatalogPrice?: number | null;
  cooktopConversionStatus?: CooktopConversionStatus;
  x: number;
  y: number;
  width: number;
  depth: number;
  // Real vertical height in inches. Optional for backward-compat with older
  // saved designs that never stored a height; elevationBox falls back to the
  // standard height for the placement bucket when this is missing.
  height?: number;
  // Hinge side (Left/Right) of the door, so the shop knows how to hinge it.
  // Optional for backward-compat; resolve with resolveSwing() which falls back
  // to a sensible default based on the cabinet's door count.
  swing?: DoorSwing;
  numberOfDoors?: number | null;
  numberOfDrawers?: number | null;
  rotation: number;
  // Set after an intentional 3D Move In/Move Out action. Legacy placements
  // without this flag are seated against their nearest physical wall in 3D.
  depthPositionAdjusted?: boolean;
  // Set after an intentional left/right move of a mounted range hood. Hoods
  // without this flag remain auto-centered above their matching range.
  rangeHoodPositionAdjusted?: boolean;
  // Official 20/20 catalog line-art for this cabinet code, if available.
  // Optional for backward-compat with older saved designs; the canvas falls
  // back to the to-scale code-drawn shape when absent.
  catalogImageUrl?: string | null;
  // Optional Custom Cabinet Rule profile and generic line drawing. These come
  // from Cabinet Config and preserve non-standard cabinet rendering in designs.
  customProfile?: string | null;
  genericDrawingUrl?: string | null;
  fixedShelfCount?: number | null;
  adjustableShelfCount?: number | null;
  // User override for a WALL cabinet's mount height (inches from floor to the
  // BOTTOM of the box). When set, the elevation uses this exactly; when absent,
  // elevationBox derives the bottom from the default rule (stacker stacks on
  // top at 84"; a standalone short wall cabinet hangs from the 84" top line).
  mountBottom?: number | null;
  /** True after a user intentionally changes mountBottom; automatic over-sink cleanup must preserve it. */
  mountBottomAdjusted?: boolean;
	/** True for the short W30 cabinet directly above an MW-30 over a range. */
	overRangeMicrowaveBridge?: boolean;
  /** WSC30 spice-cabinet UID when this wall cabinet is deliberately stacked above it. */
  spiceStackParentUid?: string | null;
  /** Wall cabinet whose top physically supports this glass stacker. */
  stackedOnCabinetUid?: string | null;
  /** Refrigerator UID that owns this over-fridge cabinet or enclosure panel. */
  refrigeratorAssemblyId?: string | null;
  /** Durable role inside a refrigerator enclosure so movement/rebuild cannot orphan a member. */
  refrigeratorAssemblyRole?: RefrigeratorAssemblyRole | null;
  /** Requested enclosure-panel mode persisted on the refrigerator appliance. */
  refrigeratorPanelMode?: RefrigeratorPanelMode | null;
  /**
   * True once the customer confirmed the Refrigerator options popup for this
   * appliance. A freshly placed refrigerator is auto-stamped `refrigeratorPanelMode: "none"`
   * by bay normalization, so the mode alone cannot tell "never configured" from
   * "deliberately chose no panels"; this flag can.
   */
  refrigeratorOptionsChosen?: boolean | null;
  /** Explicit run on a wall-free island scene; retained through save/restore. */
  islandFace?: IslandFace | null;
  /** A shallow wall cabinet intentionally used as a counter-height island face. */
  islandCounterHeightWallCabinet?: boolean;
  /** Island-only floor finish: recessed kick or a full-depth furniture plinth. */
  islandWallCabinetBaseTreatment?: IslandWallCabinetBaseTreatment | null;
  /** Left-to-right position in inches along the selected island face. */
  islandOffset?: number | null;
  // Blind corner cabinets install ACROSS the corner with a manufacturer pull
  // range: the cabinet can be pulled away from the corner between pullMin and
  // pullMax inches (e.g. a 36" blind base that pulls out to 39"). These come
  // from the manufacturer spec and are carried onto the placed item. When a
  // blind corner cabinet has NO pull spec, the design is flagged as a conflict
  // so the administrator can enter the manufacturer's min/max pull.
  pullMin?: number | null;
  pullMax?: number | null;
  /**
   * User intentionally detached this cabinet from its automatic corner vertex.
   * The cabinet remains fully collision-protected but does not re-acquire the
   * green locked-corner state or force a corner target during a subsequent drag.
   */
  cornerSnapUnlocked?: boolean;
  /** Freeze this individual cabinet while leaving the rest of the layout editable. */
  locked?: boolean;
  // Per-cabinet finish/door-style override for TWO-TONE designs. When set, this
  // cabinet uses this styleId instead of the design's default finish — e.g. a
  // white perimeter with a contrasting island/uppers. Must belong to the same
  // locked distributor family as the design. When null/undefined the cabinet
  // inherits the design's default styleId (see effectiveStyleId).
  styleId?: number | null;
  /** Shared identifier for physical pieces cut from one purchased catalog filler. */
  fillerPieceGroupId?: string | null;
	/** `secondary` is bundled with its primary; every front-miter board is primary and billable. */
  fillerBillingRole?: "primary" | "secondary" | null;
  /** Total installed filler width represented by every piece in the group. */
  fillerTotalWidth?: number | null;
  /** Installation choice retained in saved designs for build-sheet clarity. */
  fillerPlacementMode?: "left" | "right" | "split" | null;
	/** Cabinet whose measured opening owns this editable filler group. */
	fillerForCabinetUid?: string | null;
	/** Side of an optional regular-Designer cabinet that owns this attached filler. */
	fillerAttachmentSide?: "left" | "right" | null;
	/** Set when an attached filler loses its wall/cabinet termination after a later edit. */
	fillerNeedsReview?: boolean | null;
	/** Refrigerator-side fillers align to the appliance's complete bottom-to-top envelope. */
	fillerMatchesFullOwnerEnvelope?: boolean | null;
	/**
	 * Cut angle on this individual fitted filler board. Legacy records retain a
	 * 45° single cut; a pair that changes the run by 45° uses two 22.5° cuts.
	 */
	fillerMiterAngle?: 22.5 | 45 | null;
	/** Which end of the filler is cut at the continuous-wall miter vertex. */
	fillerMiteredEnd?: "start" | "end" | null;
  /**
   * Legacy full-depth wedge, a temporary one-cabinet corner filler, or the
   * completed two-piece front-only 45° miter pair. The temporary board is
   * replaced by the pair once the adjoining cabinet is placed.
   */
  fillerTransitionKind?: "angled-wedge" | "corner-provisional" | "front-miter-pair" | null;
  /** Identifies which physical front filler piece owns this saved miter board. */
  fillerTransitionPiece?: "owner" | "neighbor" | null;
	/** Cabinet on the adjoining measured wall that owns the other transition edge. */
	fillerTransitionNeighborUid?: string | null;
	/** Exact measured gap at the wall/rear edge of the transition. */
	fillerTransitionRearWidthIn?: number | null;
	/** Exact measured gap between the two visible cabinet face-side corners. */
	fillerTransitionFrontWidthIn?: number | null;
	/** Real catalog filler stock width selected to cover the larger measured edge. */
	fillerTransitionStockWidthIn?: number | null;
	/** Exact room-plan footprint of the fabricated wedge/trapezoid at placement time. */
	fillerTransitionPlanFootprint?: Array<{ x: number; y: number }> | null;
	/** Installation contract: each cabinet remains independently wall-supported. */
	fillerIndependentCabinetSupport?: boolean | null;
	/**
   * A WBC's required F342 is integrated into the cabinet face rather than being
   * a second cabinet footprint. The priced line remains persisted for the cart,
   * materials list, and grouped removal, while the owning WBC renders the strip.
   */
  integratedWallBlindFiller?: boolean | null;
  // Original catalog width (inches) captured when the cabinet was placed. The
  // live `width` is what the customer sees/edits; when it differs from
  // nominalWidth the cabinet is a CUSTOM size and is flagged on the build sheet
  // and order. Optional for backward-compat with older saved designs.
  nominalWidth?: number | null;
  // Original catalog HEIGHT and DEPTH (inches) captured when placed. Live
  // height/depth are what the customer edits; when they differ from these the
  // cabinet is flagged CUSTOM. Optional for backward-compat with older designs.
  nominalHeight?: number | null;
  nominalDepth?: number | null;
  /** Optional board-level MasterTrac tower group; not an installation or hardware claim. */
  masterTracTowerId?: string | null;
  masterTracTowerRole?: "left" | "center" | "right" | "corner-return" | "fixed-bottom" | "fixed-top" | "adjustable" | null;
  masterTracTowerBayIndex?: number | null;
  /** One purchased shelf SKU, field-trimmed for an installed tower opening. Stock remains billable;
   * installed width drives saved 2D/3D geometry. No cut labor, edge work, or drilling is priced. */
  masterTracShelfCut?: { stockWidthIn: number; installedWidthIn: number; offcutIn: number } | null;
  /** Illustrative per-bay storage, anchored on the exact fixed-bottom board.
   * The referenced SKUs are 2022 List-only; shapes/rail positions are not installation drawings. */
  masterTracConceptStorage?: {
    kind: "drawers" | "shoe" | "rod";
    count: number;
    drawerSize?: "small" | "large";
    frontStyle?: "slab" | "shaker";
    fenceFinish?: "Chrome" | "Matt Nickel";
    rodFinish?: "Chrome" | "Matt Nickel";
    rodHeightsIn?: number[];
    fixedTopIn?: number;
    skuReferences: string[];
  } | null;
  /** Additive positioned Closet contents; absent for unchanged legacy storage layouts. */
  masterTracStorageItems?: import("./masterTracTower").TowerStorageItem[];
  // Per-cabinet door/hardware attributes (set from the right-click attributes
  // dialog). All optional for backward-compat with older saved designs.
  // noDoor: order this cabinet as an OPEN unit (no door/front) — e.g. open
  // shelving or a glass-ready box; the shop omits the door.
  noDoor?: boolean;
  // Legacy left/right pull position. Retained so older saved designs restore
  // unchanged; new individual hardware choices use `hardwarePosition` below.
  handleSide?: "left" | "right" | "top" | "bottom" | null;
  // Individual cabinet hardware placement chosen in Attributes. `auto` (or no
  // value) retains the cabinet's hinge-aware supplier/default pull position.
  // `paired` places one pull at the meeting edge of each leaf on paired doors.
  hardwarePosition?: CabinetHardwarePosition | null;
  // rolloutQty: number of roll-out (pull-out) trays to add inside this base
  // cabinet. Priced as an add-on line per tray.
  rolloutQty?: number | null;
  // Per-item discount (negative) or surcharge (positive) as a percentage.
  // e.g. -10 means 10% off, +5 means 5% surcharge. Applied to the unit price
  // before computing the line total. Null/undefined means no adjustment.
  discountPct?: number | null;
  // Glass door upgrade: when true, the cabinet is ordered as its GD variant
  // (e.g. W-30-30 → W-30-30GD). Only valid for wall cabinets that have a
  // matching GD code in the catalog.
  glassDoor?: boolean;
  /** Distributor policy captured with a glass cabinet/door line. False = buy glass separately. */
  glassIncluded?: boolean | null;
  // Optional decorative door-style panel on one or both exposed cabinet ends.
  // Ordinary cabinet sides remain plain selected-finish skins by default.
  decorativeEnd?: DecorativeEndTreatment;
  // Blind corner pull distance (inches): how far the blind portion extends
  // past the perpendicular wall into the corner. Editable by the user within
  // [pullMin, pullMax] (defaults 3-6"). When set, the cabinet is positioned
  // so that exactly this many inches are the "blind" section. When absent,
  // defaults to pullMax (6") for auto-placed BBCs.
  blindPull?: number | null;
  // Waterfall countertop edge: when true, the countertop material cascades
  // down the left and/or right side of this cabinet to the floor. Typically
  // used on island ends or end-of-run bases. Adds extra material to the BOM.
  waterfallLeft?: boolean;
  waterfallRight?: boolean;
  // Oven type for tall oven cabinets (O-code). 'single' = 1 oven + 3 drawers;
  // 'double' = 2 stacked ovens + 1 drawer. Drives the elevation renderer.
  ovenType?: "single" | "double" | null;
  // Appliance opening position: 'top' | 'middle' | 'bottom'. Drives elevation layout.
  openingType?: "top" | "middle" | "bottom" | null;
  // Maximum interior appliance opening envelope from Cabinet Config, in inches.
  openingWidth?: number | null;
  openingHeight?: number | null;
  // Door height in inches (for cabinets with appliance openings). Used to
  // calculate exact opening size: opening = totalHeight - doorHeight - drawerHeight.
  doorHeight?: number | null;
  // Drawer height in inches (height of each drawer front)
  drawerHeight?: number | null;
  // Door orientation: 'side-by-side' or 'stacked'. Drives elevation layout.
  doorOrientation?: "side-by-side" | "stacked" | null;
  // Explicit source leaf count per door row. Retained with the placement so
  // line-specific face configurations do not fall back to shared-master rules.
  doorsPerRow?: number | null;
  /** True only for a distributor source record with a verified oven drawer layout. */
  sourceOvenDrawerLayout?: boolean | null;
  // Sink base top type: what sits on top of this sink base cabinet.
  // 'sink' = a sink fixture (default); 'gas' | 'electric' | 'smooth-top' = range top type.
  // When a range top is chosen, no sink fixture is added and the elevation
  // renders the range top burners/coils instead of a faucet.
  sinkTopType?: "sink" | "gas" | "electric" | "induction" | "smooth-top" | null;
  // Pelican product id of the chosen sink or range top (for cart/BOM).
  sinkTopProductId?: number | null;
  // Pelican product id of the chosen faucet (for cart/BOM and elevation rendering).
  faucetProductId?: number | null;
  // Image URL of the chosen faucet product (for elevation rendering).
  faucetImageUrl?: string | null;
  // Image URL of the chosen sink product (for elevation rendering).
  sinkImageUrl?: string | null;
  // Image URL of the chosen range top product (for elevation rendering).
  rangeTopImageUrl?: string | null;
  // Range top finish for the elevation face panel: 'stainless' (default) or 'black-glass'.
  // Independent of sinkTopType (gas/electric/smooth-top) — any burner type can have either finish.
  rangeTopFinish?: "stainless" | "black-glass" | null;
  /** Polygon room: which custom wall segment this cabinet is placed on.
   *  Only used when the room has customWalls. */
  wallId?: string | null;
  /** Inches from the selected custom-wall start vertex. Preserves exact angled-run gaps. */
  wallOffset?: number | null;
  /** Which face of a two-sided peninsula run owns this cabinet. */
  peninsulaSide?: PeninsulaCabinetSide | null;
  // Visual layout spec JSON: {baseType, sections:[{type,count,height}]}
  // When present, the elevation renderer uses this exact spec instead of the
  // legacy auto-detect logic. Sections are ordered top-to-bottom in the array
  // and rendered bottom-up in the elevation view.
  layoutSpec?: string | null;
  // Drawer row layout JSON: [{count:N, height?:H}, ...]
  // Each entry is a row of N side-by-side drawers. When present, the elevation
  // renderer uses this to render drawers side-by-side instead of stacked.
  drawerLayout?: string | null;
  // Corner cabinet type from the catalog: null = standard, or one of the
  // corner types. Carried from the catalog so the plan canvas and elevation
  // can render the correct footprint/shape without relying solely on code-
  // pattern matching. Optional for backward-compat with older saved designs.
  cornerType?: string | null;
  // Face pattern for specialty open-front cabinets (wine racks, plate racks, etc.)
  // When set, the elevation renderer replaces door/drawer panels with this pattern.
  facePattern?: "slats" | "criss-cross" | "lattice" | "open" | null;
  // Glass door add-on: masterCode of the separate glass door SKU (same distributor).
  // When set, the designer shows an "Add Glass Door" button.
  glassDoorAddonCode?: string | null;
}

/** The master fields editable from Designer Edit Config that affect 2D drawing. */
export type MasterCabinetDrawingRefresh = {
  cabinetId: number;
  masterCode?: string | null;
  description?: string | null;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  category?: string | null;
  subCategory?: string | null;
  isCornerCabinet?: boolean | null;
  fillerRequired?: boolean | null;
  cornerType?: string | null;
  pullMin?: number | null;
  pullMax?: number | null;
  mountBottom?: number | null;
  graphicType?: string | null;
  specImageUrl?: string | null;
  numberOfDoors?: number | null;
  numberOfDrawers?: number | null;
  openingType?: "top" | "middle" | "bottom" | null;
  openingWidth?: number | null;
  openingHeight?: number | null;
  doorHeight?: number | null;
  drawerHeight?: number | null;
  doorsPerRow?: number | null;
  doorOrientation?: "side-by-side" | "stacked" | null;
  ovenType?: "single" | "double" | null;
  sourceOvenDrawerLayout?: boolean | null;
  layoutSpec?: string | null;
  drawerLayout?: string | null;
  customProfile?: string | null;
  facePattern?: "slats" | "criss-cross" | "lattice" | "open" | null;
  glassIncluded?: boolean | null;
};

/**
 * Applies a persisted master drawing change to all matching cabinets already
 * placed in the open design. This makes the selected elevation/plan refresh
 * instantly instead of waiting for the cabinet palette to be reopened.
 */
export function refreshPlacedCabinetsFromMasterConfig(
  placed: PlacedCabinet[],
  master: MasterCabinetDrawingRefresh,
): PlacedCabinet[] {
  return placed.map((cabinet) => {
    if (cabinet.cabinetId !== master.cabinetId) return cabinet;
    const blind = isBlindCorner(master.masterCode ?? cabinet.masterCode, master.description ?? cabinet.description);
    const blindWidth = blind
      ? blindCornerNominalWidth({ masterCode: master.masterCode ?? cabinet.masterCode, width: master.width ?? cabinet.width })
      : null;
    return {
      ...cabinet,
	      ...(blindWidth != null ? { width: blindWidth, nominalWidth: blindWidth } : {}),
	      ...(blind && master.depth != null ? { depth: Number(master.depth), nominalDepth: Number(master.depth) } : {}),
	      ...(blind && master.height != null ? { height: Number(master.height), nominalHeight: Number(master.height) } : {}),
      ...(master.category !== undefined ? { category: master.category } : {}),
      ...(master.subCategory !== undefined ? { subCategory: master.subCategory } : {}),
      ...(master.isCornerCabinet !== undefined ? { isCornerCabinet: master.isCornerCabinet } : {}),
      ...(master.fillerRequired !== undefined ? { fillerRequired: master.fillerRequired } : {}),
      ...(master.cornerType !== undefined ? { cornerType: master.cornerType } : {}),
      ...(master.pullMin !== undefined ? { pullMin: master.pullMin } : {}),
      ...(master.pullMax !== undefined ? { pullMax: master.pullMax } : {}),
      ...(master.mountBottom !== undefined ? { mountBottom: master.mountBottom } : {}),
      ...(master.graphicType !== undefined
        ? { customProfile: master.graphicType && master.graphicType !== "standard" ? master.graphicType : null }
        : {}),
      ...(master.specImageUrl !== undefined ? { genericDrawingUrl: master.specImageUrl } : {}),
      ...(master.numberOfDoors !== undefined ? { numberOfDoors: master.numberOfDoors } : {}),
      ...(master.numberOfDrawers !== undefined ? { numberOfDrawers: master.numberOfDrawers } : {}),
      ...(master.openingType !== undefined ? { openingType: master.openingType } : {}),
      ...(master.openingWidth !== undefined ? { openingWidth: master.openingWidth } : {}),
      ...(master.openingHeight !== undefined ? { openingHeight: master.openingHeight } : {}),
      ...(master.doorHeight !== undefined ? { doorHeight: master.doorHeight } : {}),
      ...(master.drawerHeight !== undefined ? { drawerHeight: master.drawerHeight } : {}),
      ...(master.doorsPerRow !== undefined ? { doorsPerRow: master.doorsPerRow } : {}),
      ...(master.doorOrientation !== undefined ? { doorOrientation: master.doorOrientation } : {}),
      ...(master.ovenType !== undefined ? { ovenType: master.ovenType } : {}),
      ...(master.sourceOvenDrawerLayout !== undefined ? { sourceOvenDrawerLayout: master.sourceOvenDrawerLayout } : {}),
      ...(master.layoutSpec !== undefined ? { layoutSpec: master.layoutSpec } : {}),
      ...(master.drawerLayout !== undefined ? { drawerLayout: master.drawerLayout } : {}),
      ...(master.customProfile !== undefined ? { customProfile: master.customProfile } : {}),
      ...(master.facePattern !== undefined ? { facePattern: master.facePattern } : {}),
      ...(master.glassIncluded !== undefined ? { glassIncluded: master.glassIncluded } : {}),
    };
  });
}

/**
 * Reapplies every currently available Cabinet Config drawing rule to an open
 * design. Saved designs intentionally retain their placement and dimensions,
 * but their drawing metadata must never become a stale source of truth after
 * the catalog configuration changes.
 */
export function refreshPlacedCabinetsFromMasterRules(
  placed: PlacedCabinet[],
  masters: MasterCabinetDrawingRefresh[],
): PlacedCabinet[] {
  const byCabinetId = new Map(masters.map((master) => [master.cabinetId, master]));
  let changed = false;
  const refreshed = placed.map((cabinet) => {
    const master = byCabinetId.get(cabinet.cabinetId);
    if (!master) return cabinet;
    const next = refreshPlacedCabinetsFromMasterConfig([cabinet], master)[0]!;
    if (
	      next.category !== cabinet.category ||
	      next.width !== cabinet.width ||
	      next.depth !== cabinet.depth ||
	      next.height !== cabinet.height ||
      next.subCategory !== cabinet.subCategory ||
      next.isCornerCabinet !== cabinet.isCornerCabinet ||
      next.fillerRequired !== cabinet.fillerRequired ||
      next.cornerType !== cabinet.cornerType ||
      next.pullMin !== cabinet.pullMin ||
      next.pullMax !== cabinet.pullMax ||
      next.mountBottom !== cabinet.mountBottom ||
      next.customProfile !== cabinet.customProfile ||
      next.genericDrawingUrl !== cabinet.genericDrawingUrl ||
      next.numberOfDoors !== cabinet.numberOfDoors ||
      next.numberOfDrawers !== cabinet.numberOfDrawers ||
	      next.openingType !== cabinet.openingType ||
	      next.openingWidth !== cabinet.openingWidth ||
      next.doorHeight !== cabinet.doorHeight ||
      next.drawerHeight !== cabinet.drawerHeight ||
      next.doorsPerRow !== cabinet.doorsPerRow ||
      next.doorOrientation !== cabinet.doorOrientation ||
      next.ovenType !== cabinet.ovenType ||
      next.sourceOvenDrawerLayout !== cabinet.sourceOvenDrawerLayout ||
      next.layoutSpec !== cabinet.layoutSpec ||
	      next.drawerLayout !== cabinet.drawerLayout ||
	      next.facePattern !== cabinet.facePattern ||
	      next.glassIncluded !== cabinet.glassIncluded
    ) {
      changed = true;
      return next;
    }
    return cabinet;
  });
  return changed ? refreshed : placed;
}

// Generic "is this live dimension custom?" check: true when a captured nominal
// value exists and the live value differs by more than a rounding margin.
export function isCustomDim(live: number, nominal?: number | null): boolean {
  if (typeof nominal !== "number" || nominal <= 0) return false;
  return Math.abs(live - nominal) >= 0.25;
}

// True when the placed cabinet has been resized to a custom width (its live
// width differs from the catalog nominal width by more than a rounding margin).
// Falls back to false when no nominal width was captured (older designs).
export function isCustomWidth(p: { width: number; nominalWidth?: number | null }): boolean {
  return isCustomDim(p.width, p.nominalWidth);
}

export function isCustomHeight(p: { height?: number; nominalHeight?: number | null }): boolean {
  return typeof p.height === "number" && isCustomDim(p.height, p.nominalHeight);
}

export function isCustomDepth(p: { depth: number; nominalDepth?: number | null }): boolean {
  return isCustomDim(p.depth, p.nominalDepth);
}

// True when ANY of width/height/depth has been customized.
export function isCustomSize(p: {
  width: number; depth: number; height?: number;
  nominalWidth?: number | null; nominalHeight?: number | null; nominalDepth?: number | null;
}): boolean {
  return isCustomWidth(p) || isCustomHeight(p) || isCustomDepth(p);
}

// Flat surcharge applied ONCE to any cabinet that has been custom-resized in
// any dimension. Covers the shop's manual size-adjustment labor.
export const CUSTOM_SIZE_FEE = 100;

// $100 if this cabinet is custom-sized, else 0.
export function customSizeFee(p: {
  width: number; depth: number; height?: number;
  nominalWidth?: number | null; nominalHeight?: number | null; nominalDepth?: number | null;
  masterCode?: string | null; description?: string | null; category?: string | null; subCategory?: string | null;
}): number {
  // Fillers and scribes are catalog trim pieces intentionally cut to the field
  // measurement. Their approved SKU price is the source of truth; applying the
  // generic cabinet-resize fee would manufacture a second, unsupported charge.
  const identity = `${p.masterCode ?? ""} ${p.description ?? ""} ${p.category ?? ""} ${p.subCategory ?? ""}`.toLowerCase();
  if (/\bfiller\b|\bscribe\b/.test(identity)) return 0;
  return isCustomSize(p) ? CUSTOM_SIZE_FEE : 0;
}

// Compact note of the custom dims, e.g. "CUSTOM 27\"W × 36\"H" (only the changed
// dims), for build-sheet descriptions. Returns "" when nothing is custom.
export function customSizeNote(p: PlacedCabinet): string {
  const parts: string[] = [];
  if (isCustomWidth(p)) parts.push(`${fmtIn(Math.round(p.width * 10) / 10)}\"W`);
  if (isCustomHeight(p)) parts.push(`${fmtIn(Math.round(placedHeight(p) * 10) / 10)}\"H`);
  if (isCustomDepth(p)) parts.push(`${fmtIn(Math.round(p.depth * 10) / 10)}\"D`);
  return parts.length ? `CUSTOM ${parts.join(" × ")}` : "";
}

/** Full-height/tall floor cabinets use the upper end of a side rail by default. */
export function isFullHeightCabinet(p: { masterCode?: string | null; description?: string | null; category?: string | null; subCategory?: string | null; placement?: Placement | string | null }): boolean {
  const code = `${p.masterCode ?? ""}`.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const hay = `${p.category ?? ""} ${p.subCategory ?? ""} ${p.description ?? ""}`.toLowerCase();
  return p.placement === "tall" || /\bfull\s*height\b|\btall\s+(?:cabinet|pantry)|\bpantry\b/.test(hay) || /^(?:FHD|FH|PANTRY)\d/.test(code);
}
/** Trash/waste rollout cabinets retain a selectable door-handle placement. */
export function isTrashCanRolloutCabinet(p: { masterCode?: string | null; description?: string | null; category?: string | null; subCategory?: string | null; rolloutQty?: number | null }): boolean {
  const code = `${p.masterCode ?? ""}`.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const hay = `${p.category ?? ""} ${p.subCategory ?? ""} ${p.description ?? ""}`.toLowerCase();
  const b15OrB18WithRollout = /^(?:B15|B18)$/.test(code) && Number(p.rolloutQty ?? 0) > 0;
  return b15OrB18WithRollout || /trash|waste|\btcpo\b|\bfhtcpo\b/.test(hay) || /(?:TCPO|FHTCPO)$/.test(code);
}
/** TD and BT9PO have a construction-defined centered pull on the top rail. */
export function requiresCenteredTopDoorPull(p: { masterCode?: string | null; placement?: Placement | string | null }): boolean {
  const code = `${p.masterCode ?? ""}`.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return p.placement === "base" && /^(?:B(?:12|15|18)TD|BT9PO)$/.test(code);
}
/** B15/B18 trashcan doors expose a user-selectable placement choice. */
export function supportsTrashCanHandleChoice(p: { masterCode?: string | null; placement?: Placement | null; description?: string | null; category?: string | null; subCategory?: string | null }): boolean {
  const code = `${p.masterCode ?? ""}`.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return p.placement === "base" && /^(?:B15|B18)(?:FH)?(?:TCPO|FHTCPO)$/.test(code) && isTrashCanRolloutCabinet(p);
}
/** True when a wall cabinet is used as floor casework rather than as an upper.
 * Its door pull stays on the same hinge-aware side rail but moves upward for
 * comfortable access. Island ownership remains authoritative for older saves
 * whose mountBottom still contains the former room-wall value. */
export function usesRaisedFloorWallDoorPull(p: {
  masterCode?: string | null;
  description?: string | null;
  category?: string | null;
  subCategory?: string | null;
  placement?: Placement | string | null;
  mountBottom?: number | null;
  islandFace?: IslandFace | null;
  islandCounterHeightWallCabinet?: boolean | null;
}): boolean {
  if (isTrashCanRolloutCabinet(p)) return false;
  if (isFullHeightCabinet(p)) return true;
  if (p.placement !== "wall") return false;
  if (p.islandFace || p.islandCounterHeightWallCabinet === true) return true;
  return typeof p.mountBottom === "number"
    && Math.abs(p.mountBottom - STD.TOE_KICK) <= COLLISION_EPSILON_IN;
}

export function resolveCabinetHardwarePosition(p: {
  hardwarePosition?: CabinetHardwarePosition | null;
  handleSide?: "left" | "right" | "top" | "bottom" | null;
  masterCode?: string | null;
  description?: string | null;
  category?: string | null;
  subCategory?: string | null;
  placement?: Placement | string | null;
  mountBottom?: number | null;
  islandFace?: IslandFace | null;
  islandCounterHeightWallCabinet?: boolean | null;
}): CabinetHardwarePosition {
  if (requiresCenteredTopDoorPull(p)) return "top-center";
  // The raised position is a construction rule for floor-seated wall cabinets,
  // not an editable hardware style. Retire any saved top-center override while
  // preserving an explicit left/right rail choice.
  if (usesRaisedFloorWallDoorPull(p) && p.hardwarePosition === "top-center") return "auto";
  // A door pull cannot sit in the center panel. Older plans may have saved the
  // retired Center option; treat it as Automatic so every hinged door returns
  // to the applicable opening-edge stile without mutating the saved cabinet.
  if (p.hardwarePosition === "center") return "auto";
  if (
    p.hardwarePosition === "auto" ||
    p.hardwarePosition === "left" ||
    p.hardwarePosition === "right" ||
    p.hardwarePosition === "paired" ||
    p.hardwarePosition === "top-center"
  ) {
    return p.hardwarePosition;
  }
  if (p.handleSide === "left" || p.handleSide === "right") return p.handleSide;
  return "auto";
}

/** Persist one door-hardware choice using both the current field and the legacy
 * left/right alias needed by older saved-design consumers. */
export function cabinetHardwarePositionPatch(
  side: CabinetHardwarePosition,
): Pick<PlacedCabinet, "hardwarePosition" | "handleSide"> {
  const normalizedSide = side === "center" ? "auto" : side;
  return {
    hardwarePosition: normalizedSide === "auto" ? null : normalizedSide,
    handleSide: normalizedSide === "left" || normalizedSide === "right" ? normalizedSide : null,
  };
}

/** Top-rail pulls are construction-defined for TD/BT9PO; B15/B18 trashcans may choose. */
export function supportsCenteredTopDoorPull(p: {
  masterCode?: string | null;
  description?: string | null;
  category?: string | null;
  subCategory?: string | null;
  placement?: Placement | null;
  islandFace?: IslandFace | null;
  islandCounterHeightWallCabinet?: boolean | null;
}): boolean {
  if (requiresCenteredTopDoorPull(p)) return true;
  const code = `${p.masterCode ?? ""}`.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return p.placement === "base" && (/^(?:B15|B18)/.test(code) || isTrashCanRolloutCabinet(p));
}

/** True when a placed record has a real door front eligible for the requested
 * bulk hardware choice. Drawers, appliances, panels, and open units are never
 * changed. Paired hardware applies only to two-door cabinet fronts. */
export function isCabinetDoorHardwareEligible(
  p: PlacedCabinet,
  side: CabinetHardwarePosition,
): boolean {
  if (p.noDoor || p.placement === "appliance" || !hasDoorSwing(p)) return false;
  if (side === "top-center") return supportsCenteredTopDoorPull(p);
  if (side !== "paired") return true;
  return resolveSwing(p) === "double" || (p.numberOfDoors ?? 0) >= 2;
}

/** Copy a door-hardware choice to every eligible cabinet without touching any
 * unrelated cabinet attribute. Drawer pulls remain centered by renderer rule. */
export function applyCabinetDoorHardwareToAll(
  placed: PlacedCabinet[],
  side: CabinetHardwarePosition,
): PlacedCabinet[] {
  const patch = cabinetHardwarePositionPatch(side);
  let changed = false;
  const next = placed.map((cabinet) => {
    if (!isCabinetDoorHardwareEligible(cabinet, side)) return cabinet;
    if (cabinet.hardwarePosition === patch.hardwarePosition && cabinet.handleSide === patch.handleSide) return cabinet;
    changed = true;
    return { ...cabinet, ...patch };
  });
  return changed ? next : placed;
}

export function cabinetAttrNote(p: {
  noDoor?: boolean;
  handleSide?: "left" | "right" | "top" | "bottom" | null;
  hardwarePosition?: CabinetHardwarePosition | null;
}): string {
  if (p.noDoor) return "No door (open unit)";
  const hardwarePosition = resolveCabinetHardwarePosition(p);
  if (hardwarePosition !== "auto") return `Hardware ${hardwarePosition}`;
  return "";
}

// Resolve which door-style/finish a placed cabinet should actually use:
// its own per-cabinet override when present, otherwise the design's default
// finish. This is the single source of truth for both pricing and rendering so
// two-tone designs price and draw each cabinet by its real finish.
export function effectiveStyleId(
  cab: { styleId?: number | null },
  defaultStyleId: number | null
): number | null {
  return cab.styleId != null ? cab.styleId : defaultStyleId;
}

/**
 * When Color 1 changes in a single-finish design (no Color 2), ALL per-cabinet
 * style overrides must be cleared so every cabinet inherits the new active style.
 * This handles the case where cabinets were placed under different styles during
 * browsing — switching the design style must update the entire kitchen uniformly.
 * Explicit two-tone overrides are preserved whenever a second style is active.
 */
export function rebaseFormerDefaultStyleOverrides<T extends { styleId?: number | null }>(
  cabinets: T[],
  formerDefaultStyleId: number | null,
  nextDefaultStyleId: number,
  preserveTwoToneOverrides: boolean,
): T[] {
  if (formerDefaultStyleId == null || formerDefaultStyleId === nextDefaultStyleId || preserveTwoToneOverrides) return cabinets;
  // In single-finish mode, clear ALL per-cabinet overrides so every cabinet
  // follows the new design default. This prevents stale overrides from previous
  // style selections from showing different finishes in the list and cart.
  return cabinets.map((cabinet) =>
    cabinet.styleId != null ? { ...cabinet, styleId: null } as T : cabinet
  );
}

/**
 * Saved plans may contain an obsolete per-cabinet finish from a different
 * supplier line. It cannot be priced against the plan's locked distributor, so
 * clear only that foreign override and let the cabinet inherit the plan finish.
 * Same-distributor two-tone overrides remain untouched.
 */
export function clearForeignSavedStyleOverrides<T extends { styleId?: number | null }>(
  cabinets: T[],
  selectedDistributorId: number | null | undefined,
  distributorByStyleId: ReadonlyMap<number, number>,
): T[] {
  if (selectedDistributorId == null) return cabinets;
  return cabinets.map((cabinet) => {
    const overrideDistributorId = cabinet.styleId == null ? undefined : distributorByStyleId.get(cabinet.styleId);
    return overrideDistributorId != null && overrideDistributorId !== selectedDistributorId
      ? { ...cabinet, styleId: null } as T
      : cabinet;
  });
}

/**
 * Resolve the finish used for price lookups. A saved cabinet can retain a
 * legacy per-cabinet style from another distributor until client state has
 * normalized. That foreign finish must never create a cross-distributor price
 * lookup: price it at the plan's active finish instead. Explicit same-line
 * two-tone overrides remain intact, and an unknown historic style is retained
 * rather than guessed.
 */
export function pricingStyleId(
  cab: { styleId?: number | null },
  defaultStyleId: number | null,
  selectedDistributorId: number | null | undefined,
  distributorByStyleId: ReadonlyMap<number, number>,
): number | null {
  const overrideStyleId = cab.styleId;
  const overrideDistributorId = overrideStyleId == null
    ? undefined
    : distributorByStyleId.get(overrideStyleId);
  if (
    defaultStyleId != null &&
    selectedDistributorId != null &&
    overrideDistributorId != null &&
    overrideDistributorId !== selectedDistributorId
  ) {
    return defaultStyleId;
  }
  return effectiveStyleId(cab, defaultStyleId);
}

/**
 * Rendering follows the active selected sample for a normal one-finish design.
 * Per-cabinet style IDs are honored only after the user has explicitly selected
 * a distinct second two-tone style; this prevents stale placement metadata from
 * repainting a single-finish elevation in several unrelated colors.
 */
export function displayedStyleId(
  cab: { styleId?: number | null },
  activeStyleId: number | null,
  twoToneEnabled: boolean,
): number | null {
  if (activeStyleId == null) return null;
  return twoToneEnabled ? effectiveStyleId(cab, activeStyleId) : activeStyleId;
}

// The set of distinct EFFECTIVE finish styleIds used across a design, in first-
// seen order. The design default (if set) is always first so the primary finish
// leads the summary; per-cabinet overrides that differ follow. Returns [] when
// there is no default and no cabinet carries a style. Used to drive the
// "Finish applied to design" summary so two-tone designs list every finish.
export function distinctStyleIds(
  cabs: Array<{ styleId?: number | null }>,
  defaultStyleId: number | null
): number[] {
  const seen: number[] = [];
  const add = (id: number | null) => {
    if (id != null && !seen.includes(id)) seen.push(id);
  };
  add(defaultStyleId);
  for (const c of cabs) add(effectiveStyleId(c, defaultStyleId));
  return seen;
}

// True when a design uses more than one finish (i.e. at least one per-cabinet
// override resolves to a styleId different from the others) — a two-tone design.
export function isMixedFinish(
  cabs: Array<{ styleId?: number | null }>,
  defaultStyleId: number | null
): boolean {
  return distinctStyleIds(cabs, defaultStyleId).length > 1;
}

// True when a cabinet has a hinged door whose swing side is meaningful. A
// drawer-only base, an appliance, an open cabinet, or a panel has no swing.
export function hasDoorSwing(p: { placement: Placement; numberOfDoors?: number | null; numberOfDrawers?: number | null; description?: string | null; masterCode?: string | null; subCategory?: string | null }): boolean {
  if (p.placement === "appliance") return false;
  if (isPanelItem(p)) return false;
  // Lazy Susan and Easy Reach base cabinets need a user-selectable opening side
  // even when a legacy catalog row records their two physical face panels.
  const code = (p.masterCode ?? "").toUpperCase();
  const hay = `${p.description ?? ""} ${p.masterCode ?? ""}`.toLowerCase();
  if (/^(?:LSB?|ERB|BER)[-_]?\d/.test(code) || /lazy\s*susan|easy\s*reach/.test(hay)) return true;
  // Prefer an explicit positive count. Some legacy placed designs copied a
  // master-default zero even though the source-backed description explicitly
  // identifies a single-door cabinet (for example B-15). Preserve hinge editing
  // for that unambiguous case without turning drawer-only products into doors.
  if (typeof p.numberOfDoors === "number") {
    if (p.numberOfDoors > 0) return true;
    if (/\b(?:single|one|1)[- ]door\b/.test(hay)) return true;
    return false;
  }
  // Drawer-only bases (no doors) typically have a drawer count and no doors.
  if (/\bdrawer base\b|^db|drawer\b/.test(hay) && !/door/.test(hay)) return false;
  // Default: assume it has a door.
  return true;
}

// Resolve a placed cabinet's swing, defaulting double-door cabinets to "double"
// and single-door cabinets to "left" (most common), and "none" for no-door items.
export function resolveSwing(p: PlacedCabinet): DoorSwing {
  if (!hasDoorSwing(p)) return "none";
  if (p.swing && p.swing !== "none") return p.swing;
  const code = (p.masterCode ?? "").toUpperCase();
  const hay = `${p.description ?? ""} ${p.masterCode ?? ""}`.toLowerCase();
  if (/^(?:LSB?|ERB|BER)[-_]?\d/.test(code) || /lazy\s*susan|easy\s*reach/.test(hay)) return "left";
  if (typeof p.numberOfDoors === "number" && p.numberOfDoors >= 2) return "double";
  // `none` on a legacy one-door placement means the swing was never authored,
  // not that the physical door disappeared. Once hasDoorSwing has established
  // a real hinged door, use the standard left default until the user selects a
  // side in Cabinet Attributes.
  return "left";
}

// Cycle a single-door swing Left -> Right -> Left. Double doors stay double.
export function cycleSwing(current: DoorSwing): DoorSwing {
  if (current === "double" || current === "none") return current;
  return current === "left" ? "right" : "left";
}

// Short label for the swing, e.g. "L", "R", "LR".
export function swingLabel(s: DoorSwing): string {
  if (s === "left") return "L";
  if (s === "right") return "R";
  if (s === "double") return "LR";
  return "";
}

// Full-word swing label for build sheets, e.g. "Left hinge".
export function swingText(s: DoorSwing): string {
  if (s === "left") return "Left hinge";
  if (s === "right") return "Right hinge";
  if (s === "double") return "Double door";
  return "";
}

// Standard height (inches) for a placement bucket, used as a fallback when a
// placed cabinet has no explicit height (legacy saved designs).
export function standardHeight(placement: Placement): number {
  if (placement === "wall") return STD.WALL_HEIGHT;
  if (placement === "tall") return STD.TALL_HEIGHT;
  if (placement === "appliance") return STD.COUNTERTOP_HEIGHT;
  if (placement === "baseTop") return 10; // knee drawers, spice racks: typically 10-12" tall
  if (placement === "underCabinet") return 8; // stem glass holders: typically 8-10" tall
  return STD.BASE_HEIGHT;
}

// Resolve a placed cabinet's real height, falling back to the bucket standard.
export function placedHeight(p: PlacedCabinet): number {
  if (typeof p.height === "number" && p.height > 0) return p.height;
  return standardHeight(p.placement);
}

// The standard top line (inches from floor) used for stackers and short bridge
// cabinets that hang from the ceiling/soffit line. A standard 30" wall cabinet
// bottomed at 54" also tops out here (84").
export const WALL_CABINET_TOP = STD.WALL_MOUNT_BOTTOM + STD.WALL_HEIGHT; // 84"
/** The fixed bottom line for a real W30 cabinet directly above the MW-30. */
export const OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM = 72;
/** Standard finished-floor bottom for a short cabinet directly above a sink. */
export const OVER_SINK_WALL_MOUNT_BOTTOM = 70;

// On taller ceilings the upper run hangs higher so its top finishes near the
// ceiling instead of leaving a big dead gap. We leave a small reveal so crown
// has room and the boxes don't jam into the ceiling. On a standard 8ft ceiling
// this resolves to the classic 84" line, so existing layouts are unchanged.
export const CEILING_SOFFIT_REVEAL_IN = 12; // gap from ceiling to top of uppers on tall ceilings
export function wallCabinetTopLine(room?: { ceilingHeight?: number } | null): number {
  const ceil = roomCeiling(room);
  // Standard 8ft (96"): keep the historical 84" line exactly.
  if (ceil <= DEFAULT_CEILING_HEIGHT) return WALL_CABINET_TOP;
  // Taller ceilings: hang the run so its top sits one reveal below the ceiling,
  // but never below the historical 84" line (uppers only move UP, never down).
  return Math.max(WALL_CABINET_TOP, ceil - CEILING_SOFFIT_REVEAL_IN);
}
// Returns the uids of placed cabinets that do not fit under the room's ceiling.
// A tall cabinet (pantry/oven cabinet) is measured from the floor; a wall
// cabinet is measured at its hung top line. Anything whose top exceeds the
// ceiling is flagged so the user can pick a shorter box or raise the ceiling.
export function ceilingFitViolations(
  placed: PlacedCabinet[],
  room?: RoomData | { ceilingHeight?: number } | null,
): Set<string> {
  const globalCeil = roomCeiling(room ?? undefined);
  const bad = new Set<string>();
  for (const p of placed) {
    // Use the ceiling of the wall this cabinet sits on (its LOW point when the
    // ceiling slopes), so a tall/wall box under a low slope is flagged. Falls
    // back to the global ceiling when we can't resolve a wall.
    const ceil = room && "width" in room
      ? wallCeilingMin(room as RoomData, cabinetWall(p, room as RoomData))
      : globalCeil;
    if (p.placement === "wall") {
      // Use the exact elevation contract, including the dedicated 72-inch
      // 12-inch upper mount and any persisted manual/stacker exceptions.
      const box = elevationBox(p, room);
      const top = box.bottom + box.height;
      if (top > ceil + 0.5) bad.add(p.uid);
    } else if (p.placement === "tall") {
      // Tall boxes stand on the floor; their height is the top line.
      if (placedHeight(p) > ceil + 0.5) bad.add(p.uid);
    }
    // base/appliance always fit under any valid ceiling (>= 84").
  }
  return bad;
}

// Standard mount line: the BOTTOM of a wall cabinet sits 54" above the floor
// (18" above a 36" counter). Standard wall cabinets are bottom-anchored here,
// so 30"/36"/42" boxes all start at 54" and rise higher as they get taller.
export const WALL_MOUNT_BOTTOM = STD.WALL_MOUNT_BOTTOM; // 54"

/** Short ordinary wall boxes finish at the standard 84-inch upper-run top line. */
export const TWELVE_INCH_WALL_MOUNT_BOTTOM = 72;

/** The 30-inch-wide short-upper family shares one 72-inch bottom datum. */
function isThirtyInchShortUpperAt72(p: {
  placement?: Placement | null;
  height?: number | null;
  masterCode?: string | null;
}): boolean {
  if (p.placement !== "wall") return false;
  const normalizedCode = (p.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^W30(?:12|15|18|21|24)$/.test(normalizedCode)
    && [12, 15, 18, 21, 24].includes(Number(p.height));
}

/** The default mount for a room-wall cabinet before a user applies an override. */
export function ordinaryWallMountBottom(p: {
  placement?: Placement | null;
  height?: number | null;
  masterCode?: string | null;
  description?: string | null;
  subCategory?: string | null;
}): number {
  const height = Number(p.height);
  if (isThirtyInchShortUpperAt72(p)) return TWELVE_INCH_WALL_MOUNT_BOTTOM;
  return p.placement === "wall" && !isStacker(p) && height > 0 && height < 30
    ? WALL_CABINET_TOP - height
    : WALL_MOUNT_BOTTOM;
}

/** A single wall's ceiling. Either a flat height, or a slope between a high end
 *  and a low end (for vaulted / knee-wall / angled ceilings). Heights are in
 *  inches from the floor. `slopeFrom` indicates which END of the wall the HIGH
 *  side is on, as you look at that wall in the Front View (left-to-right along
 *  the wall's plan span). */
export interface WallCeiling {
  /** High-side height in inches (or the flat height when not sloped). */
  high: number;
  /** Low-side height in inches. Equal to `high` for a flat ceiling. */
  low: number;
  /** Which end of the wall the HIGH side sits on. Only meaningful when high !== low. */
  slopeFrom?: "start" | "end";
}

/** A single painted finish applied uniformly to the room's perimeter or custom walls. */
export interface RoomWallAppearance {
  color?: string;
  texture?: DrywallPonyWallTexture;
}

/** Saved user appearance preferences for dimension labels in a Floor Plan. */
export interface FloorPlanDimensionLabelStyle {
  /** SVG/CSS pixel size for labels. Kept separate from room scale in inches. */
  fontSizePx?: number;
  /** CSS color value used for every readable dimension label. */
  color?: string;
  /** Display-only unit system for Floor Plan dimensions. All geometry remains inches. */
  unitSystem?: FloorPlanDimensionUnit;
}

/** User-facing display units for the Floor Plan's dimension annotation layer. */
export type FloorPlanDimensionUnit = "imperial" | "metric";

/**
 * A display-only manual offset for one exterior dimension chain. `alongIn`
 * moves the chain parallel to its wall; `outsideIn` moves it farther into the
 * exterior drafting gutter. Neither value changes wall geometry or placement.
 */
export interface FloorPlanDimensionAdjustment {
  alongIn?: number;
  outsideIn?: number;
}

export interface RoomData {
  width: number;
  depth: number;
  /** Floor-to-ceiling height in inches. Optional for back-compat; falls back to
   *  DEFAULT_CEILING_HEIGHT when absent. Drives how much wall shows above the
   *  upper cabinets in the elevation/Front View. Acts as the GLOBAL/default
   *  ceiling for any wall that has no explicit per-wall override. */
  ceilingHeight?: number;
  /** Optional per-wall ceiling overrides, keyed by plan wall side
   *  (top/bottom/left/right). A wall absent here uses `ceilingHeight`. Lets a
   *  room have a different (or sloped) ceiling on each wall. */
  wallCeilings?: Partial<Record<WallSide, WallCeiling>>;
  /** Optional painted finish shared by every physical perimeter/custom room wall. */
  wallAppearance?: RoomWallAppearance;
  /** Saved presentation preferences for the Floor Plan's display-only dimensions. */
  dimensionLabelStyle?: FloorPlanDimensionLabelStyle;
  /** Per-chain manual positions for exterior Floor Plan leaders and labels. */
  dimensionAdjustments?: Record<string, FloorPlanDimensionAdjustment>;
  /** Polygon room: ordered vertices defining the room shape. When present,
   *  the room is a polygon; when absent, it's the classic rectangle. */
  vertices?: import("@/lib/polygonRoom").RoomVertex[];
  /** Polygon room: wall segments connecting vertices. */
  customWalls?: import("@/lib/polygonRoom").CustomWall[];
  /** True when customWalls form an intentional connected path rather than a closed perimeter. */
  openWallPath?: boolean;
  /** Free-standing cabinet-supported runs that leave a room wall as a peninsula. */
  peninsulaRuns?: PeninsulaRun[];
  /**
   * Complete saved 2D entities that sit alongside the room shell. Persisting
   * them with the room makes a reloaded 3D scene a deterministic conversion of
   * the same source plan rather than a partial reconstruction.
   */
  persistedEntities?: PersistedDesignEntities;
}

export type PeninsulaTurn = 45 | 90;
export type PeninsulaDirection = "left" | "right";
/** The side of a peninsula center line where a cabinet is seated. */
export type PeninsulaCabinetSide = "left" | "right";

/** The exact recipe required to reopen a Wizard-built peninsula safely. */
export interface PeninsulaWizardRecipe {
  schemaVersion: 1;
  /** Cardinal or measured Continuous Wall Builder run that owns the attachment. */
  parentWall: string;
  startOffset: number;
  endTurn: "none" | 45;
  endDirection: PeninsulaDirection;
  cabinetSide: PeninsulaCabinetSide;
  applianceCode: "none" | "DW-24" | "WINE-24";
  seatingOverhang: 0 | 10 | 12 | 15;
  waterfall: boolean;
  /** Optional visual corbels under the raised bar (off by default). */
  corbels?: boolean;
  addPonyWall: boolean;
  ponyWallLength: number;
  ponyWallHeight: number;
  primaryCabinetIds: number[];
  returnCabinetIds: number[];
  countertopTreatment: "regular" | "split-level";
  showBarStools: boolean;
}

export interface PeninsulaRun {
  id: string;
  /** Physical room wall run (cardinal or measured) where a primary peninsula begins. */
  parentWall?: string;
  /** Optional connected peninsula run whose far endpoint anchors this return. */
  parentRunId?: string;
  /** Exact distance in inches from a primary parent wall's start corner. */
  startOffset: number;
  /**
   * A primary peninsula turns the parent wall into an open connection at its
   * attachment. The longer original wall section remains available for cabinets
   * and the shorter section becomes the open connection. Kept optional so
   * already-saved peninsula runs follow this default rule.
   */
  terminatesParentWall?: boolean;
  /** Locked continuation turn relative to the parent wall. */
  turn: PeninsulaTurn;
  direction: PeninsulaDirection;
  /** Measured pulled length in inches. */
  length: number;
  /** Finished peninsula wall/rail height; base cabinets remain floor-supported. */
  height: number;
  /** Default face for new cabinets placed on this two-sided peninsula run. */
  cabinetSide?: PeninsulaCabinetSide;
  /** Extra seating projection past the standard 1½-inch cabinet edge. */
  countertopSeatingOverhang?: 0 | 10 | 12 | 15;
  /** Bar projection that carries the slab across a drywall pony wall and past its back face. */
  countertopPonyWallBarOverhang?: 0 | 10 | 12 | 15;
  /** A separate 42-inch seating bar behind the counter-height worktop. */
  countertopRaisedBar?: boolean;
  /**
   * Historical 12/15-inch seating projection. New and restored raised bars use
   * the cabinet-supported 1½-inch finished edge, so this is retained only to
   * deserialize older drafts without widening their countertop footprint.
   */
  countertopRaisedBarOverhang?: 1.5 | 12 | 15;
  /** Optional visual iron corbels under the bar. Off by default: installers use a 1/4" support bar. */
  countertopRaisedBarCorbels?: boolean;
  /** A full-height counter panel at this run's exposed far end. */
  countertopWaterfallEnd?: boolean;
  /**
   * Freezes the whole connected peninsula assembly at its current measured
   * attachment and return geometry. Stored on the root run; children resolve
   * the same protection through peninsulaRunAssemblyLocked().
   */
  locked?: boolean;
  /** A persisted, user-owned Wizard recipe. Present on the root Wizard run. */
  wizardRecipe?: PeninsulaWizardRecipe;
  label?: string;
}

/** Finds the root of a connected peninsula assembly without trusting run order. */
export function peninsulaRootRunId(run: PeninsulaRun, room: Pick<RoomData, "peninsulaRuns">): string {
  const runs = room.peninsulaRuns ?? [];
  const visited = new Set<string>();
  let current = run;
  while (current.parentRunId && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = runs.find((candidate) => candidate.id === current.parentRunId);
    if (!parent) break;
    current = parent;
  }
  return current.id;
}

/** A lock on any selected peninsula segment protects its root and every return. */
export function peninsulaRunAssemblyLocked(run: PeninsulaRun, room: Pick<RoomData, "peninsulaRuns">): boolean {
  const rootId = peninsulaRootRunId(run, room);
  return Boolean((room.peninsulaRuns ?? []).find((candidate) => candidate.id === rootId)?.locked);
}

/**
 * The installer clearance belongs only to an acute 45-degree inside turn.
 * A square 90-degree return is served by normal cabinet footprint collision
 * and must allow a cabinet to seat directly at its available corner.
 */
export function peninsulaRunHas45StartInsideCornerClearance(run: PeninsulaRun): boolean {
  return Boolean(run.parentRunId && run.turn === 45);
}

export function peninsulaRunHas45EndInsideCornerClearance(run: PeninsulaRun, room: RoomData): boolean {
  return Boolean(room.peninsulaRuns?.some((candidate) => candidate.parentRunId === run.id && candidate.turn === 45));
}

/** Exact room-space line geometry for a persisted peninsula run. */
export function peninsulaRunEndpoints(run: PeninsulaRun, room: RoomData): {
  start: { x: number; y: number };
  end: { x: number; y: number };
  radians: number;
} {
  const parentRun = run.parentRunId
    ? (room as RoomData).peninsulaRuns?.find((candidate) => candidate.id === run.parentRunId)
    : undefined;
  const parentWall = run.parentWall ?? "top";
  const parentFrame = !parentRun ? wallRunFrame(parentWall, room) : null;
  const span = parentFrame?.length ?? (parentWall === "top" || parentWall === "bottom" ? room.width : room.depth);
  const offset = Math.max(0, Math.min(span, Number(run.startOffset) || 0));
  const rootStart = parentFrame
    ? {
        x: Math.round((parentFrame.start.x + parentFrame.tangent.x * offset) * 8) / 8,
        y: Math.round((parentFrame.start.y + parentFrame.tangent.y * offset) * 8) / 8,
      }
    : parentWall === "top"
      ? { x: offset, y: 0 }
      : parentWall === "bottom"
        ? { x: offset, y: room.depth }
        : parentWall === "left"
          ? { x: 0, y: offset }
          : { x: room.width, y: offset };
  const parentRadians: Record<WallSide, number> = {
    top: 0,
    right: Math.PI / 2,
    bottom: Math.PI,
    left: -Math.PI / 2,
  };
  // A primary peninsula always leaves its parent wall through the interior on
  // one straight cabinet-ready axis. 45° is valid only for a child run from
  // that primary's free end. Treating an old primary 45° record as straight
  // preserves saved layouts while preventing its cabinet footprint from
  // becoming the diamond-shaped pseudo-corner shown in older plans.
  const parentGeometry = parentRun ? peninsulaRunEndpoints(parentRun, room) : null;
  const start = parentGeometry?.end ?? rootStart;
  const parentHeading = parentGeometry?.radians ?? parentFrame?.angle ?? parentRadians[parentWall as WallSide];
  // A primary run leaves its room wall through the room interior. A connected
  // return leaves the prior run's far endpoint and turns relative to that run.
  const radians = parentGeometry
    ? parentHeading + (run.turn === 90
      ? (run.direction === "right" ? Math.PI / 2 : -Math.PI / 2)
      : (run.direction === "right" ? Math.PI / 4 : -Math.PI / 4))
    : parentFrame
      ? Math.atan2(parentFrame.inward.y, parentFrame.inward.x)
      : parentHeading + Math.PI / 2;
  const length = Math.max(6, Number(run.length) || 6);
  return {
    start,
    end: {
      x: Math.round((start.x + Math.cos(radians) * length) * 8) / 8,
      y: Math.round((start.y + Math.sin(radians) * length) * 8) / 8,
    },
    radians,
  };
}

/** Maximum interior pull length before a peninsula continuation reaches a room boundary. */
export function peninsulaRunMaxLength(run: Omit<PeninsulaRun, "length"> & { length?: number }, room: RoomData): number {
  const { start, radians } = peninsulaRunEndpoints({ ...run, length: 6 }, room);
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);
  const candidates: number[] = [];
  if (dx > 1e-9) candidates.push((room.width - start.x) / dx);
  if (dx < -1e-9) candidates.push(-start.x / dx);
  if (dy > 1e-9) candidates.push((room.depth - start.y) / dy);
  if (dy < -1e-9) candidates.push(-start.y / dy);
  const maximum = Math.min(...candidates.filter((candidate) => Number.isFinite(candidate) && candidate >= 0));
  return Math.max(6, Math.floor(maximum * 8) / 8);
}

/** Projects a room point to the parent wall and clamps a moved peninsula attachment to that adjoining wall. */
export function peninsulaRunStartOffsetAtPoint(
  run: PeninsulaRun,
  room: RoomData,
  point: { x: number; y: number },
): number {
  // Returns are anchored to their parent run's far endpoint; only a primary
  // run may slide its joined attachment along its measured parent wall.
  if (run.parentRunId || !run.parentWall) return 0;
  const parentFrame = wallRunFrame(run.parentWall, room);
  const parentLength = parentFrame?.length ?? wallLength(run.parentWall, room);
  const rawOffset = parentFrame
    ? wallRunAlongAtPoint(parentFrame, point)
    : run.parentWall === "top" || run.parentWall === "bottom" ? point.x : point.y;
  return Math.max(0, Math.min(Math.max(0, parentLength - 6), Math.round(rawOffset * 8) / 8));
}

/** Measures a room point along a locked peninsula run, clamped to its usable length. */
export function peninsulaRunOffsetAtPoint(run: PeninsulaRun, room: Pick<RoomData, "width" | "depth">, point: { x: number; y: number }): number {
  const { start, radians } = peninsulaRunEndpoints(run, room);
  const projected = (point.x - start.x) * Math.cos(radians) + (point.y - start.y) * Math.sin(radians);
  return Math.max(0, Math.min(run.length, Math.round(projected * 8) / 8));
}

/**
 * Resolves the closest committed peninsula segment at a plan point. This keeps
 * catalog drag/drop independent of the rectangle-wall fallback: a cabinet that
 * is dropped on the visible peninsula must belong to that exact run.
 */
export function peninsulaRunHitAtPoint(
  room: RoomData,
  point: { x: number; y: number },
  maximumDistance = Number.POSITIVE_INFINITY,
): { run: PeninsulaRun; offset: number; distance: number } | null {
  let nearest: { run: PeninsulaRun; offset: number; distance: number } | null = null;
  for (const run of room.peninsulaRuns ?? []) {
    const { start, radians } = peninsulaRunEndpoints(run, room);
    const tangent = { x: Math.cos(radians), y: Math.sin(radians) };
    const rawOffset = (point.x - start.x) * tangent.x + (point.y - start.y) * tangent.y;
    const offset = Math.max(0, Math.min(run.length, Math.round(rawOffset * 8) / 8));
    const nearestPoint = {
      x: start.x + tangent.x * offset,
      y: start.y + tangent.y * offset,
    };
    const distance = Math.hypot(point.x - nearestPoint.x, point.y - nearestPoint.y);
    if (distance <= maximumDistance && (!nearest || distance < nearest.distance)) {
      nearest = { run, offset, distance };
    }
  }
  return nearest;
}

export function peninsulaRunById(room: RoomData, wallId?: string | null): PeninsulaRun | null {
  if (!wallId) return null;
  return room.peninsulaRuns?.find((run) => run.id === wallId) ?? null;
}

/**
 * A connected peninsula is one countertop path. Its root run owns the seating
 * projection so a legacy child saved with zero cannot narrow the slab and leave
 * an uncovered triangular cabinet corner at a 45-degree joint.
 */
export function peninsulaCountertopSeatingOverhang(
  run: PeninsulaRun,
  room: Pick<RoomData, "peninsulaRuns">,
): 0 | 10 | 12 | 15 {
  const lineage: PeninsulaRun[] = [];
  const visited = new Set<string>();
  let current: PeninsulaRun | undefined = run;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    lineage.push(current);
    current = current.parentRunId
      ? room.peninsulaRuns?.find((candidate) => candidate.id === current!.parentRunId)
      : undefined;
  }
  const root = lineage[lineage.length - 1];
  const rootValue = root?.countertopSeatingOverhang;
  if (rootValue === 0 || rootValue === 10 || rootValue === 12 || rootValue === 15) return rootValue;
  for (let index = lineage.length - 2; index >= 0; index -= 1) {
    const value = lineage[index]?.countertopSeatingOverhang;
    if (value === 10 || value === 12 || value === 15) return value;
  }
  return 0;
}

/**
 * A connected peninsula shares one bar treatment. The root run owns the
 * across-pony-wall projection so a return cannot leave an uncovered notch at
 * the shared bend.
 */
export function peninsulaCountertopPonyWallBarOverhang(
  run: PeninsulaRun,
  room: Pick<RoomData, "peninsulaRuns">,
): 0 | 10 | 12 | 15 {
  const lineage: PeninsulaRun[] = [];
  const visited = new Set<string>();
  let current: PeninsulaRun | undefined = run;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    lineage.push(current);
    current = current.parentRunId ? room.peninsulaRuns?.find((candidate) => candidate.id === current!.parentRunId) : undefined;
  }
  const root = lineage[lineage.length - 1];
  const rootValue = root?.countertopPonyWallBarOverhang;
  if (rootValue === 0 || rootValue === 10 || rootValue === 12 || rootValue === 15) return rootValue;
  for (let index = lineage.length - 2; index >= 0; index -= 1) {
    const value = lineage[index]?.countertopPonyWallBarOverhang;
    if (value === 10 || value === 12 || value === 15) return value;
  }
  return 0;
}

/** Standard framed/drywall pony-wall thickness used when a bar top crosses it. */
export const DRYWALL_PONY_WALL_COUNTERTOP_SUPPORT_DEPTH_IN = 4.5;
/** Standard finished height for a two-level seating bar. */
export const RAISED_BAR_HEIGHT_IN = 42;

/**
 * The selected bar top must first cross the finished pony wall, then project
 * beyond it. A zero setting preserves the existing cabinet-front-only top.
 */
export function peninsulaCountertopPonyWallBackExtensionIn(
  run: PeninsulaRun,
  room: Pick<RoomData, "peninsulaRuns">,
): number {
  const barOverhang = peninsulaCountertopPonyWallBarOverhang(run, room);
  return barOverhang > 0 ? DRYWALL_PONY_WALL_COUNTERTOP_SUPPORT_DEPTH_IN + barOverhang : 0;
}

/** A root-owned raised bar keeps every connected peninsula setting consistent. */
export function peninsulaCountertopRaisedBarEnabled(
  run: PeninsulaRun,
  room: Pick<RoomData, "peninsulaRuns">,
): boolean {
  const rootId = peninsulaRootRunId(run, room);
  return Boolean(room.peninsulaRuns?.find((candidate) => candidate.id === rootId)?.countertopRaisedBar);
}

/**
 * A raised bar is a separate 42-inch-height slab with a 15-inch exposed
 * seating projection beyond the cabinet-supported front edge. The lower
 * worktop keeps its normal 1½-inch finished edge.
 */
export function peninsulaCountertopRaisedBarOverhang(
  run: PeninsulaRun,
  room: Pick<RoomData, "peninsulaRuns">,
): 15 {
  void run;
  void room;
  return 15;
}

/**
 * Every peninsula countertop level follows its cabinet structure: 24-inch base
 * depth plus the finished 1½-inch front edge. Historical seating/pony-wall
 * projection values are retained for old drafts but never widen a countertop.
 */
export function peninsulaLowerWorktopOppositeSideExtensionIn(
  run: PeninsulaRun,
  room: Pick<RoomData, "peninsulaRuns">,
): number {
  // Regular (non-step) tops only: the chosen 12/15-inch seating projection grows
  // AWAY from the cabinet faces (the back of the peninsula). The front edge stays
  // at the 1½-inch finished edge, and a split-level bar keeps its own strip.
  const runs = room.peninsulaRuns ?? [];
  const root = (() => {
    let current: PeninsulaRun | undefined = run;
    const seen = new Set<string>();
    while (current?.parentRunId && !seen.has(current.id)) {
      seen.add(current.id);
      current = runs.find((candidate) => candidate.id === current!.parentRunId);
    }
    return current ?? run;
  })();
  if (run.countertopRaisedBar === true || root.countertopRaisedBar === true) return 0;
  // Only Peninsula Wizard assemblies carry this option; hand-placed peninsulas
  // keep following the cabinet footprint exactly.
  if (!(root as { wizardRecipe?: unknown }).wizardRecipe) return 0;
  return peninsulaCountertopSeatingOverhang(run, room);
}

/** A connected countertop has one exposed far end; move a legacy root flag to the terminal run. */
export function peninsulaCountertopWaterfallEnd(
  run: PeninsulaRun,
  room: Pick<RoomData, "peninsulaRuns">,
): boolean {
  const runs = room.peninsulaRuns ?? [];
  if (runs.some((candidate) => candidate.parentRunId === run.id)) return false;
  const visited = new Set<string>();
  let current: PeninsulaRun | undefined = run;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.countertopWaterfallEnd === true) return true;
    current = current.parentRunId
      ? runs.find((candidate) => candidate.id === current!.parentRunId)
      : undefined;
  }
  return false;
}

/**
 * Older saved plans can contain cabinets visibly seated on a peninsula without
 * the explicit `wallId` / `wallOffset` metadata added for connected runs. Those
 * legacy records otherwise look like perimeter cabinets to the free-span and
 * collision routines: a new cabinet is placed into their occupied space and is
 * then rejected as an overlap. Recover the unambiguous run ownership from the
 * existing saved geometry, preserving its actual width, face side, and position.
 * Cabinets already assigned to a room wall, island, custom wall, or peninsula
 * are deliberately left untouched.
 */
export function normalizeLegacyPeninsulaCabinets(placed: PlacedCabinet[], room: RoomData): PlacedCabinet[] {
  if (!room.peninsulaRuns?.length) return placed;
  let changed = false;
  const normalized = placed.map((cabinet) => {
    if (cabinet.islandFace || !["base", "wall", "tall", "appliance"].includes(cabinet.placement)) return cabinet;
    const width = Math.max(0, Number(cabinet.width) || 0);
    const depth = Math.max(0, Number(cabinet.depth) || 0);
    if (width <= 0 || depth <= 0) return cabinet;
    const ownedRun = peninsulaRunById(room, cabinet.wallId);
    // Explicit run metadata is authoritative after a saved plan reload. Rebuild
    // the plan position from the run ID, saved along-run offset, and selected
    // cabinet side for both primary and connected segments. This clears stale
    // diagonal rotations/coordinates that otherwise survive refresh as a large
    // diamond even though the cabinet belongs to the highlighted straight run.
    if (ownedRun) {
      const currentFootprint = placedFootprint(cabinet);
      const currentCenter = { x: cabinet.x + currentFootprint.w / 2, y: cabinet.y + currentFootprint.d / 2 };
      const projectedOffset = peninsulaRunOffsetAtPoint(ownedRun, room, currentCenter) - width / 2;
      const rawOffset = Number.isFinite(Number(cabinet.wallOffset))
        ? Number(cabinet.wallOffset)
        : Math.max(0, projectedOffset);
      const offset = Math.max(0, Math.min(Math.max(0, ownedRun.length - width), rawOffset));
      // The selected run side is authoritative. Legacy cabinet-level side
      // values can describe the pre-migration diagonal and would otherwise
      // keep a corrected cabinet visibly on the opposite side of its wall.
      const peninsulaSide = ownedRun.cabinetSide ?? cabinet.peninsulaSide ?? "left";
      const spot = wallPlacementAt(offset, width, depth, ownedRun.id as WallSide, room, peninsulaSide);
      const alreadyCanonical = (
        Math.abs(cabinet.x - spot.x) <= 0.01 &&
        Math.abs(cabinet.y - spot.y) <= 0.01 &&
        Math.abs((((cabinet.rotation - spot.rotation + 540) % 360) - 180)) <= 0.01 &&
        cabinet.wallId === ownedRun.id &&
        Math.abs((Number(cabinet.wallOffset) || 0) - (spot.wallOffset ?? 0)) <= 0.01 &&
        cabinet.peninsulaSide === (spot.peninsulaSide ?? peninsulaSide)
      );
      if (alreadyCanonical) return cabinet;
      changed = true;
      return { ...cabinet, ...spot, wallId: ownedRun.id, wallOffset: spot.wallOffset ?? 0, peninsulaSide: spot.peninsulaSide ?? peninsulaSide };
    }
    // A legacy peninsula cabinet can still carry its original parent-wall ID;
    // that stale perimeter owner must be recoverable from its seated geometry.
    let footprint = placedFootprint(cabinet);
    let center = { x: cabinet.x + footprint.w / 2, y: cabinet.y + footprint.d / 2 };
    let hit = peninsulaRunHitAtPoint(room, center, depth / 2 + 1);
    // A record saved before the run existed can preserve the parent-wall
    // rotation. Re-evaluate its center using the matching connected-run axis so
    // the old rotation cannot shift the recovered span by a cabinet depth.
    const parentOwnedRun = !hit && cabinet.wallId
      ? (room.peninsulaRuns ?? []).find((run) => run.parentWall === cabinet.wallId)
      : hit && cabinet.wallId === hit.run.parentWall
        ? hit.run
        : null;
    if (parentOwnedRun) {
      const { radians } = peninsulaRunEndpoints(parentOwnedRun, room);
      const intendedRotation = ((radians * 180) / Math.PI + 360) % 360;
      const rotationDistance = (left: number, right: number) => Math.abs((((left - right + 540) % 360) - 180));
      const matchesIntendedAxis = rotationDistance(cabinet.rotation, intendedRotation) <= 0.51
        || rotationDistance(cabinet.rotation, intendedRotation + 180) <= 0.51;
      if (!matchesIntendedAxis) {
        footprint = placedFootprint({ ...cabinet, rotation: intendedRotation });
        center = { x: cabinet.x + footprint.w / 2, y: cabinet.y + footprint.d / 2 };
        const recoveredHit = peninsulaRunHitAtPoint(room, center, depth / 2 + 1);
        if (recoveredHit?.run.id === parentOwnedRun.id) hit = recoveredHit;
      }
    }
    if (!hit || (cabinet.wallId && cabinet.wallId !== hit.run.parentWall)) return cabinet;
    // A real parent-wall corner unit can sit at the peninsula attachment and
    // naturally fall within the run hit-test tolerance. It is not a legacy
    // peninsula cabinet: retaining its parent-wall ownership lets the automatic
    // peninsula start offset clear its actual body before the first cabinet is
    // added. Reassigning it to the peninsula instead blocks the full run span.
    const isParentWallCorner = cabinet.wallId === hit.run.parentWall && (
      placedCornerGeometryKind(cabinet) === "l-shape" ||
      placedCornerGeometryKind(cabinet) === "diagonal" ||
      placedCornerGeometryKind(cabinet) === "corner-drawer" ||
      placedCornerGeometryKind(cabinet) === "blind-corner"
    );
    if (isParentWallCorner) return cabinet;
    const { radians } = peninsulaRunEndpoints(hit.run, room);
    const tangentRotation = ((radians * 180) / Math.PI + 360) % 360;
    const rotationDistance = (left: number, right: number) => Math.abs((((left - right + 540) % 360) - 180));
    const matchesRunAxis = rotationDistance(cabinet.rotation, tangentRotation) <= 0.51
      || rotationDistance(cabinet.rotation, tangentRotation + 180) <= 0.51;
    // A persisted cabinet can retain the perimeter wall's old rotation even
    // when its center is visibly seated in the run that splits from that wall.
    // The parent-wall identity plus the geometric hit is more authoritative
    // than this stale rotation; retain the rotation guard for unowned records.
    const hasLegacyParentWallOwner = cabinet.wallId === hit.run.parentWall;
    if (!matchesRunAxis && !hasLegacyParentWallOwner) return cabinet;
    const start = peninsulaRunEndpoints(hit.run, room).start;
    const leftNormal = { x: -Math.sin(radians), y: Math.cos(radians) };
    const lateral = (center.x - start.x) * leftNormal.x + (center.y - start.y) * leftNormal.y;
    const peninsulaSide: PeninsulaCabinetSide = lateral >= 0 ? "left" : "right";
    const spot = wallPlacementAt(hit.offset - width / 2, width, depth, hit.run.id as WallSide, room, peninsulaSide);
    changed = true;
    return { ...cabinet, ...spot, wallId: hit.run.id, wallOffset: spot.wallOffset ?? 0, peninsulaSide: spot.peninsulaSide ?? peninsulaSide };
  });
  return changed ? normalized : placed;
}

/**
 * Removes one free-standing peninsula run and only the cabinets that explicitly
 * belong to it. Perimeter/custom room walls and cabinets on every other wall
 * are intentionally preserved. Countertop, price, and materials collections are
 * derived from placed cabinets, so callers receive the matching retained list.
 */
export function removePeninsulaRun(room: RoomData, placed: PlacedCabinet[], runId: string): {
  room: RoomData;
  placed: PlacedCabinet[];
  removedCabinetUids: string[];
} {
  const run = peninsulaRunById(room, runId);
  if (!run) return { room, placed, removedCabinetUids: [] };
  const removedRunIds = new Set<string>([run.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const candidate of room.peninsulaRuns ?? []) {
      if (candidate.parentRunId && removedRunIds.has(candidate.parentRunId) && !removedRunIds.has(candidate.id)) {
        removedRunIds.add(candidate.id);
        changed = true;
      }
    }
  }
  const removedCabinetUids = placed
    .filter((cabinet) => removedRunIds.has(cabinetWall(cabinet, room)))
    .map((cabinet) => cabinet.uid);
  return {
    room: {
      ...room,
      peninsulaRuns: (room.peninsulaRuns ?? []).filter((candidate) => !removedRunIds.has(candidate.id)),
    },
    placed: placed.filter((cabinet) => !removedRunIds.has(cabinetWall(cabinet, room))),
    removedCabinetUids,
  };
}

export interface PersistedDesignEntities {
  openings: WallOpening[];
  sinks: SinkFixture[];
  /** Wall-mounted fixtures are persisted separately from countertop sink fixtures. */
  potFillers?: PotFillerFixture[];
  island: IslandZone | null;
  furniture: PlacedFurniture[];
  ponyWalls: PonyWall[];
}

export function roomWithPersistedEntities(room: RoomData, entities: PersistedDesignEntities): RoomData {
  return { ...room, persistedEntities: entities };
}

/**
 * Database rows use selectedStyleId/selectedDistributorId while some legacy
 * client snapshots use styleId/distributorId. Resolve both without losing the
 * saved design's active finish during a reload.
 */
export function restoredSavedDesignStyle(input: {
  styleId?: number | null;
  selectedStyleId?: number | null;
  distributorId?: number | null;
  selectedDistributorId?: number | null;
}) {
  return {
    styleId: input.styleId ?? input.selectedStyleId ?? null,
    distributorId: input.distributorId ?? input.selectedDistributorId ?? null,
  };
}

// Standard US ceiling height. Common alternatives: 108" (9ft), 120" (10ft).
export const DEFAULT_CEILING_HEIGHT = 96;
export const CEILING_HEIGHT_PRESETS = [96, 108, 120] as const;
export const MIN_CEILING_HEIGHT = 84;
export const MAX_CEILING_HEIGHT = 144;
export function roomCeiling(room: { ceilingHeight?: number } | null | undefined): number {
  const h = room?.ceilingHeight;
  return typeof h === "number" && h >= MIN_CEILING_HEIGHT && h <= MAX_CEILING_HEIGHT
    ? h
    : DEFAULT_CEILING_HEIGHT;
}

// Clamp a raw ceiling-height value into the allowed range. Out-of-range or
// non-finite inputs fall back to the standard ceiling height.
export function clampCeilingHeight(h: number | null | undefined): number {
  if (typeof h !== "number" || !Number.isFinite(h)) return DEFAULT_CEILING_HEIGHT;
  return Math.max(MIN_CEILING_HEIGHT, Math.min(MAX_CEILING_HEIGHT, Math.round(h)));
}

// Resolve the ceiling definition for a specific wall. Falls back to the room's
// global flat ceiling when the wall has no override, so legacy designs and
// untouched walls behave exactly as before.
export function wallCeiling(
  room: { ceilingHeight?: number; wallCeilings?: Partial<Record<WallSide, WallCeiling>>; customWalls?: RoomData["customWalls"] } | null | undefined,
  side: WallSide,
): WallCeiling {
  const override = room?.wallCeilings?.[side];
  if (override && Number.isFinite(override.high) && Number.isFinite(override.low)) {
    const high = clampCeilingHeight(override.high);
    const low = clampCeilingHeight(override.low);
    return { high: Math.max(high, low), low: Math.min(high, low), slopeFrom: override.slopeFrom ?? "start" };
  }
  // One room ceiling. A drawn wall carries its own height (half wall, pony
  // wall, full height) which can never exceed the ceiling; the usable top for
  // uppers and crown on that wall is the lower of the two. Wall heights are NOT
  // clamped to the ceiling range; only the ceiling itself uses 84-144 inches.
  const flat = wallTopLimit(room, side);
  return { high: flat, low: flat };
}
/** Minimum wall height the model accepts (a knee-wall / pony-wall cap). */
export const MIN_WALL_HEIGHT = 34.5;
/**
 * Highest point anything can reach on a wall: the room ceiling, or a drawn
 * wall's own shorter height. Shared by placement limits, elevation, 3D and
 * the wall-run frame so every tool agrees.
 */
export function wallTopLimit(
  room: { ceilingHeight?: number; customWalls?: RoomData["customWalls"] } | null | undefined,
  side: WallSide,
): number {
  const ceiling = roomCeiling(room ?? undefined);
  const customHeight = Number(room?.customWalls?.find((wall) => wall.id === side)?.height);
  if (!Number.isFinite(customHeight) || customHeight <= 0) return ceiling;
  return Math.min(ceiling, Math.max(MIN_WALL_HEIGHT, Math.round(customHeight * 8) / 8));
}

// True when the given wall has a sloped (angled) ceiling rather than a flat one.
export function wallCeilingIsSloped(
  room: { ceilingHeight?: number; wallCeilings?: Partial<Record<WallSide, WallCeiling>>; customWalls?: RoomData["customWalls"] } | null | undefined,
  side: WallSide,
): boolean {
  const c = wallCeiling(room, side);
  return Math.abs(c.high - c.low) > 0.5;
}

// The LOWEST ceiling height anywhere on a wall (the binding constraint for what
// can fit under it). For a flat wall this equals its height; for a slope it is
// the low end.
export function wallCeilingMin(
  room: { ceilingHeight?: number; wallCeilings?: Partial<Record<WallSide, WallCeiling>>; customWalls?: RoomData["customWalls"] } | null | undefined,
  side: WallSide,
): number {
  const c = wallCeiling(room, side);
  return Math.min(c.high, c.low);
}

// Ceiling height at a fractional position (0..1) along a wall's plan span,
// measured left-to-right as drawn in the Front View. Interpolates linearly for
// sloped walls; returns the flat height otherwise. `slopeFrom: "start"` means
// the HIGH side is at fraction 0 (left), `"end"` means the high side is at
// fraction 1 (right).
export function wallCeilingAt(
  room: { ceilingHeight?: number; wallCeilings?: Partial<Record<WallSide, WallCeiling>>; customWalls?: RoomData["customWalls"] } | null | undefined,
  side: WallSide,
  frac: number,
): number {
  const c = wallCeiling(room, side);
  if (Math.abs(c.high - c.low) <= 0.5) return c.high;
  const f = Math.max(0, Math.min(1, frac));
  // At the high end the value is c.high; at the low end it is c.low.
  const highAtStart = (c.slopeFrom ?? "start") === "start";
  const startVal = highAtStart ? c.high : c.low;
  const endVal = highAtStart ? c.low : c.high;
  return startVal + (endVal - startVal) * f;
}

/**
 * Highest legal mount bottom for a wall cabinet at its current plan position.
 * Uses the selected wall's real flat or sloped ceiling across the cabinet's
 * complete run span instead of the legacy global room ceiling.
 */
export function wallCabinetVerticalMoveLimit(cabinet: PlacedCabinet, room: RoomData) {
	const side = cabinetWall(cabinet, room);
	const wallLength = wallRunFrame(side, room)?.length ?? 0;
	const runStart = wallRunOffset(cabinet, side, room);
	const runEnd = runStart + wallRunSpan(cabinet, side, room);
	const startFraction = wallLength > 0 ? Math.max(0, Math.min(1, runStart / wallLength)) : 0;
	const endFraction = wallLength > 0 ? Math.max(0, Math.min(1, runEnd / wallLength)) : 1;
	const ceiling = Math.min(
		wallCeilingAt(room, side, startFraction),
		wallCeilingAt(room, side, endFraction),
	);
	const height = elevationBox(cabinet, room).height;
	return {
		side,
		ceiling: Math.round(ceiling * 1000) / 1000,
		maxBottom: Math.max(0, Math.round((ceiling - height) * 1000) / 1000),
	};
}

/**
 * A vertical move can expose a legacy horizontal seam overlap that was hidden
 * while two wall cabinets occupied different elevation bands. Repair only a
 * pointer-near wall-run error (the same three-inch attraction used by dragging)
 * to exact edge contact; never approve or preserve positive overlap.
 */
export function repairWallCabinetPlanSeamForVerticalMove(
	candidate: PlacedCabinet,
	room: RoomData,
	peers: PlacedCabinet[],
	openings: WallOpening[],
	maxRepairIn = 3,
): PlacedCabinet | null {
	if (candidate.placement !== "wall" || !hasCollision(candidate, peers)) return candidate;
	const side = cabinetWall(candidate, room);
	if (!isAgainstWall(candidate, side, room)) return null;
	const horizontal = side === "top" || side === "bottom";
	const footprint = placedFootprint(candidate);
	const runSpan = horizontal ? footprint.w : footprint.d;
	const wallDepth = horizontal ? footprint.d : footprint.w;
	const currentStart = horizontal ? candidate.x : candidate.y;
	const available = freeSegmentsOnWall(
		side,
		room,
		peers,
		openings,
		Math.min(runSpan, 9),
		WALL_OPENING_CLEARANCE_IN,
		"wall",
		false,
		candidate,
	);
	const repairedStart = nearestAvailableWallStart(available, currentStart, runSpan);
	if (repairedStart == null || Math.abs(repairedStart - currentStart) > maxRepairIn + COLLISION_EPSILON_IN) return null;
	const repaired = { ...candidate, ...wallPlacementAt(repairedStart, runSpan, wallDepth, side, room) };
	return hasCollision(repaired, peers) ? null : repaired;
}

export const DEFAULT_ROOM: RoomData = { width: 144, depth: 120, ceilingHeight: DEFAULT_CEILING_HEIGHT };

export function dim(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const raw = String(value).trim().replace(/[″"]/g, "");
  // Supplier exports commonly store a 3/4-inch panel as "3/4". parseFloat
  // reads that as 3, which turns a 36-inch refrigerator with two skins into a
  // visibly incorrect 42-inch enclosure. Honor ordinary and mixed fractions
  // before accepting a decimal/whole-number prefix.
  const mixedFraction = raw.match(/^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)(?:\D|$)/);
  if (mixedFraction) {
    const whole = Number(mixedFraction[1]);
    const numerator = Number(mixedFraction[2]);
    const denominator = Number(mixedFraction[3]);
    const measured = whole + numerator / denominator;
    return Number.isFinite(measured) && measured > 0 ? measured : fallback;
  }
  const fraction = raw.match(/^(\d+)\s*\/\s*(\d+)(?:\D|$)/);
  if (fraction) {
    const measured = Number(fraction[1]) / Number(fraction[2]);
    return Number.isFinite(measured) && measured > 0 ? measured : fallback;
  }
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Refrigerator end panels are thin finish skins. Supplier CSVs can express
 * their thickness as "3/4", "0.75", or a nominal 1.5-inch double panel.
 * Keep that structural thickness distinct from a panel's 24-inch depth so the
 * finished enclosure never inflates a 36-inch refrigerator to 42 inches.
 */
export function refrigeratorEndPanelThickness(
  value: string | null | undefined,
  fallback = 0.75,
): number {
  const parsed = dim(value, fallback);
  return parsed > 0 && parsed <= 3 ? parsed : fallback;
}

export type CabinetDimensionsIn = { width: number; height: number; depth: number };

/**
 * Authoritative dimension formats used by active wall-cabinet catalog lines.
 * A style/distributor prefix may precede the SKU; the dimensional code must be
 * the final token. W-36-24 therefore always resolves to 36W × 24H × 12D even
 * when a stale catalog column incorrectly contains 12 for width.
 */
export function wallCabinetSkuDimensions(masterCode: string | null | undefined): CabinetDimensionsIn | null {
  const code = (masterCode ?? "").trim().toUpperCase();
  const match = (pattern: RegExp) => code.match(pattern);
  let parsed = match(/(?:^|[^A-Z0-9])W-(\d{2})-(\d{2})$/);
  if (parsed) return { width: Number(parsed[1]), height: Number(parsed[2]), depth: 12 };
  parsed = match(/(?:^|[^A-Z0-9])WR(\d{2})(\d{2})$/);
  if (parsed) return { width: Number(parsed[1]), height: Number(parsed[2]), depth: 24 };
  parsed = match(/(?:^|[^A-Z0-9])W(\d{2})(\d{2})GD$/);
  if (parsed) return { width: Number(parsed[1]), height: Number(parsed[2]), depth: 12 };
  parsed = match(/(?:^|[^A-Z0-9])W(\d{2})(\d{2})(\d{2})$/);
  if (parsed) return { width: Number(parsed[1]), height: Number(parsed[2]), depth: Number(parsed[3]) };
  parsed = match(/(?:^|[^A-Z0-9])W(\d{2})(\d{2})$/);
  if (parsed) return { width: Number(parsed[1]), height: Number(parsed[2]), depth: 12 };
  return null;
}

export type GlassDoorCabinetLike = {
  masterCode?: string | null;
  description?: string | null;
  subCategory?: string | null;
  customProfile?: string | null;
  glassDoor?: boolean | null;
  fixedShelfCount?: number | null;
	adjustableShelfCount?: number | null;
};

/**
 * Distributor glass policy is nomenclature-driven. Every cabinet, stacker, or
 * replacement door whose normalized code ends in PG, GD, or G follows the
 * selected supplier's one policy setting. Keep this broader than the visual
 * glass-door classifier: a PG replacement part may not render as a cabinet,
 * but it still needs the correct purchase disclosure.
 */
/**
 * Catalog GD products are glass-door cabinets by definition. Saved layouts may
 * predate the explicit `glassDoor` flag, so normalized SKU, description,
 * subcategory, and configured graphic type all remain authoritative signals.
 */
export function isGlassDoorCabinet(cabinet: GlassDoorCabinetLike): boolean {
  if (cabinet.glassDoor === true) return true;
  const code = (cabinet.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const text = `${cabinet.description ?? ""} ${cabinet.subCategory ?? ""} ${cabinet.customProfile ?? ""}`.toLowerCase();
  return /GD$/.test(code) || /glass[ -]?door/.test(text) || /(?:^|_)glass(?:_|$)/.test(text);
}
/** Glass-front cabinet products are valid only in the wall layer. */
export function glassCabinetPlacementAllowed(
  cabinet: GlassDoorCabinetLike & { placement: Placement },
): boolean {
  return cabinet.placement === "wall" || !isGlassDoorCabinet(cabinet);
}
/**
 * Keep authored shelf fields primary. Some imported GD records describe their
 * shelves only in catalog prose (for example W2442GD: "3 Adjustable Shelves").
 */
export function glassDoorShelfCount(cabinet: GlassDoorCabinetLike): number {
  const configured = Math.max(0, Math.round(Number(cabinet.fixedShelfCount ?? 0)))
    + Math.max(0, Math.round(Number(cabinet.adjustableShelfCount ?? 0)));
  if (configured > 0) return Math.min(8, configured);
  const described = `${cabinet.description ?? ""}`.match(/(\d+)\s+(?:adjustable\s+|fixed\s+)?shel(?:f|ves)\b/i);
  return described ? Math.min(8, Math.max(0, Number(described[1]))) : 0;
}

export function resolvedDesignCabinetDimensions(cabinet: DesignCabinet): CabinetDimensionsIn {
  if (hasAefPrintedGeometry(cabinet)) {
    const printed = aefPrintedGeometryForSku(cabinet.masterCode);
    if (printed) {
      return {
        width: printed.width,
        height: printed.height,
        depth: printed.depth,
      };
    }
    return {
      width: isBlindCorner(cabinet.masterCode, cabinet.description)
        ? blindCornerNominalWidth(cabinet)
        : dim(cabinet.width, 24),
      height: dim(cabinet.height, standardHeight(cabinet.placement)),
      depth: dim(
        cabinet.depth,
        cabinet.placement === "wall"
          ? STD.WALL_DEPTH
          : cabinet.placement === "tall"
            ? STD.TALL_DEPTH
            : STD.BASE_DEPTH,
      ),
    };
  }
  const sku = cabinet.placement === "wall" ? wallCabinetSkuDimensions(cabinet.masterCode) : null;
  return {
    width: isBlindCorner(cabinet.masterCode, cabinet.description)
      ? blindCornerNominalWidth(cabinet)
      : sku?.width ?? dim(cabinet.width, 24),
    height: sku?.height ?? dim(cabinet.height, standardHeight(cabinet.placement)),
    depth: sku?.depth ?? footprintDepth(cabinet),
  };
}

/**
 * A Base End Corner (BEC) is a 24x24 end return with two 12-inch faces. It is
 * deliberately not a lazy-Susan, diagonal, blind, or room-corner cabinet.
 */
export function isBaseEndCornerCabinet(c: Pick<DesignCabinet, "masterCode" | "description" | "cornerType"> | Pick<PlacedCabinet, "masterCode" | "description" | "cornerType">): boolean {
  const code = (c.masterCode ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const description = (c.description ?? "").toLowerCase();
  return c.cornerType === "base-end-corner" || /^bec\d/.test(code) || /base end (corner|angle|cabinet)/.test(description);
}

export function footprintDepth(c: DesignCabinet): number {
  // Panels/skins are flat 3/4" stock regardless of placement bucket.
  if (isPanelItem(c)) return dim(c.depth, STD.PANEL_THICKNESS) || STD.PANEL_THICKNESS;
  // AEF's distributor-specific depth is printed geometry, not the shared SKU
  // parser's standard 12-inch wall depth. Keep it authoritative in every
  // plan/placement path that asks for a footprint.
  if (hasAefPrintedGeometry(c)) {
    return aefPrintedGeometryForSku(c.masterCode)?.depth ?? dim(
      c.depth,
      c.placement === "wall" ? STD.WALL_DEPTH : c.placement === "tall" ? STD.TALL_DEPTH : STD.BASE_DEPTH,
    );
  }
  const wallSku = c.placement === "wall" ? wallCabinetSkuDimensions(c.masterCode) : null;
  if (wallSku) return wallSku.depth;
  // BEC end returns occupy a true 24x24 box, even if historical supplier data
  // stored a shallow depth. They do not use room-corner snapping or fillers.
  if (isBaseEndCornerCabinet(c)) return STD.BASE_DEPTH;
  // A diagonal corner cabinet occupies the same span on BOTH walls, so its
  // plan footprint is a square bounding box (e.g. 24" wide => 24" deep), not the
  // standard shallow wall/base depth.
  // cornerType="base-end-corner" is the admin override for BEC cabinets.
  if (
    c.cornerType === "base-end-corner"
    || isAngledWallCabinet(c.masterCode || "", c.description || undefined)
    || isDiagonalCorner(c.masterCode || "", c.description || undefined)
  ) {
    const w = dim(c.width, 24);
    return w > 0 ? w : 24;
  }
  // Blind corner cabinets (BBC/WBC) are standard rectangular boxes: their
  // width is the nominal size (e.g. 42") and depth is always the standard
  // base/wall depth (24" for base, 12" for wall). The catalog depth field
  // sometimes stores the pull dimension instead, so we force standard depth.
  if (isBlindCorner(c.masterCode || "", c.description || undefined)) {
    if (c.placement === "wall") return STD.WALL_DEPTH;
    return STD.BASE_DEPTH;
  }
  // An L-shaped corner cabinet (lazy-Susan / easy-reach corner) runs the
  // SAME length along both walls (e.g. a 36" lazy-Susan is 36" on each wall),
  // so its plan bounding box is a square = width, with a notch cut at the inner
  // corner. The actual leg depth (how far it projects from each wall) is the
  // cabinet's stored depth (~24") and is handled by cornerLegDepth().
  if (isLCornerCabinet(c.masterCode || "", c.description || undefined)) {
    const w = dim(c.width, 24);
    return w > 0 ? w : 24;
  }
  if (c.placement === "wall") return dim(c.depth, STD.WALL_DEPTH);
  if (c.placement === "tall") return dim(c.depth, STD.TALL_DEPTH);
  if (c.placement === "appliance") return dim(c.depth, STD.BASE_DEPTH);
  return dim(c.depth, STD.BASE_DEPTH);
}

export function rotatedSize(p: PlacedCabinet): { w: number; d: number } {
  const rot = ((p.rotation % 360) + 360) % 360;
  const blind = isBlindCorner(p.masterCode, p.description);
  const width = blind ? blindCornerNominalWidth(p) : p.width;
  const depth = blind ? (p.placement === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH) : p.depth;
  if (rot === 90 || rot === 270) {
    return { w: depth, d: width };
  }
  // Locked 45° cabinets retain their nominal body but reserve the smallest
  // axis-aligned screen envelope for general room bounds/cross-run checks.
  // Right-side seating flips the cabinet by 180° (45→225 or 315→135), so all
  // four diagonal quadrants must use the same expanded envelope. Treating only
  // 45/315 as diagonal shifts the rendered 135/225 body across its wall.
  if (rot === 45 || rot === 135 || rot === 225 || rot === 315) {
    const diagonal = Math.SQRT1_2;
    return { w: Math.abs(width * diagonal) + Math.abs(depth * diagonal), d: Math.abs(width * diagonal) + Math.abs(depth * diagonal) };
  }
  return { w: width, d: depth };
}

// Rotation-aware RENDER footprint for a placed cabinet. This is what the canvas
// should draw. For an L-shaped corner cabinet the plan bounding box is ALWAYS a
// square (side = the cabinet's nominal width), with the corner notch cut by the
// clip-path. Older saved placements may carry a stale shallow depth (e.g. a 36"
// lazy-Susan stored as 36x24); squaring here makes both old and new placements
// render correctly without a data migration. Non-corner cabinets fall back to
// the plain rotated size.
// A true L or diagonal corner needs a square plan box, but that square is the
// selected catalog item's actual installed span on each wall. A 33-inch ERB or
// Lazy Susan therefore owns 33 inches on both runs—not a generic 36-inch CDB
// reservation. Only malformed legacy records fall back to the normal corner
// dimensions for their placement bucket.
export function lCornerBoxSide(p: Pick<PlacedCabinet, "width" | "placement">): number {
  const sourceWidth = Number(p.width);
  if (Number.isFinite(sourceWidth) && sourceWidth > COLLISION_EPSILON_IN) return sourceWidth;
  return p.placement === "wall" ? 24 : 36;
}

/**
 * The single saved-placement corner classification shared by the 2D plan and
 * the deterministic 3D renderer.  A renderer must never infer a different
 * shape from its own SKU heuristics: this exact result decides whether a saved
 * placement is a diagonal clipped corner, a right triangle, a blind box, an
 * L-corner, or an ordinary cabinet.
 */
export type PlacedCornerGeometryKind = "standard" | "diagonal" | "triangle" | "blind-corner" | "l-shape" | "corner-drawer" | "base-end";

export function placedCornerGeometryKind(p: PlacedCabinet): PlacedCornerGeometryKind {
  if (isBaseEndCornerCabinet(p)) return "base-end";
  // AW is a regular wall-run END cabinet. Its own mesh/plan clip contains the
  // 45-degree exposed face; placement must retain the owning wall's rotation.
  // This guard also repairs older saved AW rows that still carry cornerType.
  if (isAngledWallCabinet(p.masterCode, p.description)) return "standard";
  if (/^cdb[-_]?\d/i.test(p.masterCode) || /corner drawer base/i.test(p.description ?? "")) return "corner-drawer";
  if (isTriangleCorner(p.masterCode, p.cornerType)) return "triangle";
  if (p.cornerType === "diagonal" || isDiagonalCorner(p.masterCode, p.description)) return "diagonal";
  if (p.cornerType === "blind-corner" || isBlindCorner(p.masterCode, p.description)) return "blind-corner";
  if (
    p.cornerType === "lazy-susan" ||
    p.cornerType === "pie-cut" ||
    p.cornerType === "l-shape" ||
    isLCornerCabinet(p.masterCode, p.description)
  ) return "l-shape";
  return "standard";
}

export function placedFootprint(p: PlacedCabinet): { w: number; d: number } {
  // A required WBC face filler is a commerce/build-sheet attachment to its owner,
  // not a second physical cabinet. Its visible 3-inch strip is rendered on the
  // WBC face, so it must reserve zero additional plan area and cannot overlap or
  // displace an adjoining cabinet run.
  if (p.integratedWallBlindFiller) return { w: 0, d: 0 };
  const cornerKind = placedCornerGeometryKind(p);
  // BEC24 is a 24×24 square end-of-run box with two doors on its one flat
  // front. Preserve this plan envelope through rotation, snap and collision;
  // it is neither a diagonal corner nor a folded two-face return.
  if (cornerKind === "base-end") {
    return { w: STD.BASE_DEPTH, d: STD.BASE_DEPTH };
  }
  // Diagonal and L-corner records share a square plan envelope. The shared
  // classifier above is deliberately the only source of this decision for both
  // PlanCanvas and the deterministic 3D renderer.
  if (cornerKind === "diagonal" || cornerKind === "l-shape" || cornerKind === "corner-drawer") {
    const side = lCornerBoxSide(p);
    return { w: side, d: side };
  }
  if (cornerKind === "blind-corner") {
    const stdDepth = p.placement === "wall" ? 12 : 24;
    const nominalWidth = blindCornerNominalWidth(p);
    const rot = ((p.rotation % 360) + 360) % 360;
    return rot === 90 || rot === 270 ? { w: stdDepth, d: nominalWidth } : { w: nominalWidth, d: stdDepth };
  }
  const sz = rotatedSize(p);
  // Defensive floor: a real cabinet box must never render as an invisible sliver
  // because of bad/missing catalog data (e.g. depth 0/0.75/NULL). We do NOT
  // normalize to the standard 24"/12" depth here — legitimately shallow boxes
  // (12" spice pull-outs, 21" vanities, etc.) must keep their real depth. We only
  // enforce a small absolute minimum so nothing can vanish. Flat stock
  // (panels/skins/fillers) is intentionally thin and is exempt.
  // A closet upright is finished flat stock, even when its catalog description
  // says "Left End" rather than "panel". Clamping it to a 6-inch kitchen box
  // makes an actual shelf between two ¾-inch uprights collide on restore.
  const isFlatStock = isPanelItem(p) || isLooseTrimItem(p) || p.category === "MasterTrac Closet";
  if (isFlatStock) return sz;
  const MIN_VISIBLE = 6; // inches — smallest a real cabinet box may render
  return { w: Math.max(sz.w, MIN_VISIBLE), d: Math.max(sz.d, MIN_VISIBLE) };
}

// One-time normalization for placed cabinets coming from a saved design / restore.
// Older saves stored L-shaped corner cabinets with a shallow depth (e.g. a 36"
// lazy-Susan as 36x24). The current model treats their plan footprint as a
// SQUARE (depth == width) with the leg notch cut by the clip-path. Rewriting the
// stored depth here means every downstream consumer (snapping, collision,
// front view, BOM) sees the correct square footprint without a DB migration.
export function normalizeLCornerDepths(placed: PlacedCabinet[]): PlacedCabinet[] {
  let changed = false;
  const next = placed.map((p) => {
    if (!isLCornerCabinet(p.masterCode, p.description)) return p;
    const side = lCornerBoxSide(p);
    if (p.depth === side && p.width === side) return p;
    changed = true;
    return { ...p, width: side, depth: side };
  });
  return changed ? next : placed;
}

// Format an inch value without trailing zeros (34.5 -> "34.5", 24 -> "24").
export function fmtIn(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

// Full 3-dimensional size label for a placed item: W x H x D in inches.
// Width/depth are rotation-aware (a turned cabinet swaps its footprint), while
// height comes from the placed height (with a sensible bucket fallback).
export function dimLabel(p: PlacedCabinet): string {
  // The 45-degree bounding envelope is not a product dimension. A 3DB18 stays
  // 18-by-24 when it is seated on a 45°
  // continuous wall; reporting its 29.70-inch diagonal bounding box falsely
  // makes the user think that a different product was placed and obscures the
  // true run span used by snapping, collision, pricing, and materials.
  let w = Math.max(0, Number(p.width) || 0);
  let d = Math.max(0, Number(p.depth) || 0);
  const h = placedHeight(p);
  // Fillers (FILL-3, FILL-6): the plan width/depth may be swapped when placed on
  // a vertical wall (rotation 90/270). The TRUE filler width is encoded in the
  // masterCode suffix. Use the nominal width for display.
  const fillMatch = /^FILL-(\d+(?:\.\d+)?)$/i.exec(p.masterCode);
  if (fillMatch) {
    const nomW = parseFloat(fillMatch[1]);
    if (Number.isFinite(nomW) && nomW > 0) {
      // Depth is the cabinet run depth (24" base, 12" wall); width is the filler strip.
      const runDepth = Math.max(w, d);
      w = nomW;
      d = runDepth;
    }
  } else if (Math.abs((((p.rotation ?? 0) % 360) + 360) % 180 - 90) < 0.01) {
    // A cardinal quarter-turn swaps the room-facing width and depth labels;
    // never use the much larger diagonal bounding box of a 45-degree turn.
    [w, d] = [d, w];
  }
  const base = `${fmtIn(w)}"W \u00d7 ${fmtIn(h)}"H \u00d7 ${fmtIn(d)}"D`;
  return isCustomSize(p) ? `${base} \u00b7 Custom` : base;
}

export function snapPosition(
  moving: PlacedCabinet,
  room: RoomData,
  others: PlacedCabinet[],
  island?: { x: number; y: number; width: number; depth: number } | null
): { x: number; y: number; snappedWall: boolean; snappedIsland: boolean; snappedCabinet: boolean; snappedGrid: boolean } {
  // Use the PLAN footprint (not the raw rotated size) so L-corner cabinets
  // (lazy-Susan / corner base) snap by their true SQUARE box. Their stored depth
  // can be the shallow ~24" leg depth, which would leave the box short of the
  // right/bottom walls and break corner-notch rotation in 3 of the 4 corners.
  const { w, d } = placedFootprint(moving);
  let x = moving.x;
  let y = moving.y;
  let snappedWall = false;
  let snappedIsland = false;
  let snappedCabinet = false;

  const T = STD.SNAP_THRESHOLD;

  // ── Island edge snapping ───────────────────────────────────────────────────
  // When a cabinet is dragged within SNAP_THRESHOLD of any island edge, snap it
  // flush to that edge. Left/right edges snap the X axis; top/bottom snap Y.
  if (island) {
    const iRight = island.x + island.width;
    const iBottom = island.y + island.depth;
    // Vertical overlap check (cabinet Y range overlaps island Y range)
    const yOverlapIsland = y < iBottom + T && y + d > island.y - T;
    if (yOverlapIsland) {
      // Snap right edge of cabinet to left edge of island
      if (Math.abs(x + w - island.x) <= T) { x = island.x - w; snappedIsland = true; }
      // Snap left edge of cabinet to right edge of island
      if (Math.abs(x - iRight) <= T) { x = iRight; snappedIsland = true; }
    }
    // Horizontal overlap check (cabinet X range overlaps island X range)
    const xOverlapIsland = x < iRight + T && x + w > island.x - T;
    if (xOverlapIsland) {
      // Snap bottom edge of cabinet to top edge of island
      if (Math.abs(y + d - island.y) <= T) { y = island.y - d; snappedIsland = true; }
      // Snap top edge of cabinet to bottom edge of island
      if (Math.abs(y - iBottom) <= T) { y = iBottom; snappedIsland = true; }
    }
  }

	  // Collect every nearby edge before moving the candidate. Applying edges in
	  // iteration order can snap toward a farther unit merely because it occurs
	  // first in saved-plan order. Per axis, the closest valid edge wins.
	  type SnapCandidate = { value: number; distance: number; source: "wall" | "cabinet" };
	  const nearest = (candidates: SnapCandidate[]): SnapCandidate | null => candidates
	    .filter((candidate) => candidate.distance <= T + COLLISION_EPSILON_IN)
	    .sort((left, right) => left.distance - right.distance || left.value - right.value)[0] ?? null;

	  const xCandidates: SnapCandidate[] = [
	    { value: 0, distance: Math.abs(x), source: "wall" },
	    { value: room.width - w, distance: Math.abs(x + w - room.width), source: "wall" },
	  ];
	  const yCandidates: SnapCandidate[] = [
	    { value: 0, distance: Math.abs(y), source: "wall" },
	    { value: room.depth - d, distance: Math.abs(y + d - room.depth), source: "wall" },
	  ];

	  for (const o of others) {
	    if (o.uid === moving.uid) continue;
	    if (!sharesPlanCollisionZone(moving, o)) continue;
	    const os = placedFootprint(o);
	    const yOverlap = y < o.y + os.d && y + d > o.y;
	    if (yOverlap) {
	      xCandidates.push(
	        { value: o.x - w, distance: Math.abs(x + w - o.x), source: "cabinet" },
	        { value: o.x + os.w, distance: Math.abs(x - (o.x + os.w)), source: "cabinet" },
	      );
	    }
	    const xOverlap = x < o.x + os.w && x + w > o.x;
	    if (xOverlap) {
	      yCandidates.push(
	        { value: o.y - d, distance: Math.abs(y + d - o.y), source: "cabinet" },
	        { value: o.y + os.d, distance: Math.abs(y - (o.y + os.d)), source: "cabinet" },
	      );
	    }
	  }

	  const xSnap = nearest(xCandidates);
	  if (xSnap) {
	    x = xSnap.value;
	    snappedWall ||= xSnap.source === "wall";
	    snappedCabinet ||= xSnap.source === "cabinet";
	  }
	  const ySnap = nearest(yCandidates);
	  if (ySnap) {
	    y = ySnap.value;
	    snappedWall ||= ySnap.source === "wall";
	    snappedCabinet ||= ySnap.source === "cabinet";
	  }

  // Overlap prevention: even after edge-snapping, a fast drag can still land the
  // cabinet ON TOP of a neighbor. Push it back out so it BUTTS flush against the
  // cabinet it overlaps, along whichever axis needs the smallest correction.
  // Iterated a few times so a cabinet dragged into a tight run settles between
  // its neighbors instead of stacking on one of them.
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const o of others) {
      if (o.uid === moving.uid) continue;
      if (!sharesPlanCollisionZone(moving, o)) continue;
      const os = placedFootprint(o);
      const overlapX = Math.min(x + w, o.x + os.w) - Math.max(x, o.x);
      const overlapY = Math.min(y + d, o.y + os.d) - Math.max(y, o.y);
      if (overlapX > COLLISION_EPSILON_IN && overlapY > COLLISION_EPSILON_IN) {
        // Resolve along the axis of least penetration (the natural "butt" edge).
        if (overlapX <= overlapY) {
          // Push left or right to the nearer side of the neighbor.
          const center = x + w / 2;
          const oCenter = o.x + os.w / 2;
          x = center < oCenter ? o.x - w : o.x + os.w;
        } else {
          const center = y + d / 2;
          const oCenter = o.y + os.d / 2;
          y = center < oCenter ? o.y - d : o.y + os.d;
        }
        moved = true;
      }
    }
    if (!moved) break;
  }

  x = Math.max(0, Math.min(x, room.width - w));
  y = Math.max(0, Math.min(y, room.depth - d));

  // Free-floating plan objects must land on the same 1/8-inch precision grid
  // as wall-run placements, nudges, resize, and catalog drops. Apply this only
  // after the closest wall/island/cabinet edge has won, so a true butt seam
  // stays exact instead of drifting to an arbitrary screen-pixel position.
  const roundedX = roundToEighth(x);
  const roundedY = roundToEighth(y);
  const snappedGrid = Math.abs(roundedX - x) > COLLISION_EPSILON_IN
    || Math.abs(roundedY - y) > COLLISION_EPSILON_IN;
  x = roundedX;
  y = roundedY;

  return { x, y, snappedWall, snappedIsland, snappedCabinet, snappedGrid };
}

// Auto-orientation: when a cabinet is dragged near a wall, it should turn so its
// BACK is to that wall and it faces into the room. Back/front (horizontal) walls
// want rotation 0; left/right (vertical) walls want rotation 90. We pick the
// SINGLE nearest wall within the snap threshold (so a corner does not flip-flop)
// and only suggest a turn when the cabinet's current orientation does not already
// match that wall. Returns the target rotation, or null when no wall is close
// enough (e.g. the cabinet is out in the middle / on an island) so the caller
// can leave the user's chosen rotation alone.
export function orientToWall(
  moving: PlacedCabinet,
  room: RoomData,
  island?: { x: number; y: number; width: number; depth: number } | null
): number | null {
  const { w, d } = rotatedSize(moving);
  const T = STD.SNAP_THRESHOLD;

  // ── Island-wall orientation ────────────────────────────────────────────────
  // When a cabinet is dragged within SNAP_THRESHOLD of any island edge, rotate
  // it so its back faces that island wall (same logic as room-wall orientation).
  if (island) {
    const iRight = island.x + island.width;
    const iBottom = island.y + island.depth;
    const yOverlap = moving.y < iBottom + T && moving.y + d > island.y - T;
    const xOverlap = moving.x < iRight + T && moving.x + w > island.x - T;
    const distIsland: { side: "top" | "bottom" | "left" | "right"; dist: number }[] = [];
    if (yOverlap) {
      distIsland.push({ side: "right", dist: Math.abs(moving.x + w - island.x) }); // cab right → island left
      distIsland.push({ side: "left",  dist: Math.abs(moving.x - iRight) });         // cab left → island right
    }
    if (xOverlap) {
      distIsland.push({ side: "bottom", dist: Math.abs(moving.y + d - island.y) }); // cab bottom → island top
      distIsland.push({ side: "top",    dist: Math.abs(moving.y - iBottom) });       // cab top → island bottom
    }
    let bestIsland: { side: "top" | "bottom" | "left" | "right" } | null = null;
    let bestIslandDist = T;
    for (const e of distIsland) {
      if (e.dist <= bestIslandDist) { bestIslandDist = e.dist; bestIsland = e; }
    }
    if (bestIsland) {
      const horizontal = bestIsland.side === "top" || bestIsland.side === "bottom";
      const targetRot = horizontal ? 0 : 90;
      const cur = ((Math.round(moving.rotation) % 180) + 180) % 180;
      if (cur !== targetRot) return targetRot;
      return null;
    }
  }

  // ── Room-wall orientation ──────────────────────────────────────────────────
  // Note: island cabinets sit out in the middle of the room, so they never fall
  // within the wall snap threshold below and are left untouched automatically.
  const dist: Record<WallSide, number> = {
    top: Math.abs(moving.y - 0),
    bottom: Math.abs(moving.y + d - room.depth),
    left: Math.abs(moving.x - 0),
    right: Math.abs(moving.x + w - room.width),
  };
  // Nearest wall within threshold.
  let best: WallSide | null = null;
  let bestDist = T;
  (Object.keys(dist) as WallSide[]).forEach((side) => {
    if (dist[side] <= bestDist) { bestDist = dist[side]; best = side; }
  });
  if (!best) return null;
  const horizontal = best === "top" || best === "bottom";
  const targetRot = horizontal ? 0 : 90;
  const cur = ((Math.round(moving.rotation) % 180) + 180) % 180;
  // Already correctly oriented for this wall axis -> no change needed.
  if (cur === targetRot) return null;
  return targetRot;
}

/** User-approved near-seam snap range; accepted placements are normalized to exact zero gap and zero overlap. */
export const CABINET_SEAM_SNAP_IN = 1 / 16;
/** Ordinary wall/base adjacency magnet range; closes the common half-inch hand-placement gap. */
export const CABINET_ADJACENCY_MAGNET_IN = 0.5;
/** A deliberate magnetic cabinet drop may be corrected to an exact seam within one inch. */
export const CABINET_CONFLICT_LOCK_IN = 1;
/** Floating-point dust only. Any real positive overlap remains invalid. */
export const COLLISION_EPSILON_IN = 1e-9;
/** Required cabinet setback on each adjoining peninsula leg at an inside turn. */
export const PENINSULA_INSIDE_CORNER_CLEARANCE_IN = 11;

export type CabinetCollisionDetail = {
  cabinet: PlacedCabinet;
  overlapX: number;
  overlapY: number;
  /** Smallest penetration axis, which is the amount the cabinet must move to clear the collision. */
  penetration: number;
};

export function cabinetCollisionDetail(moving: PlacedCabinet, others: PlacedCabinet[]): CabinetCollisionDetail | null {
  const { w, d } = placedFootprint(moving);
  for (const o of others) {
    if (o.uid === moving.uid) continue;
    if (!sharesPlanCollisionZone(moving, o)) continue;
    // Two cabinets seated on the same run compare along that run, on every wall
    // kind alike; the commit boundary keeps every wallOffset current.
    const sameExplicitRun = Boolean(
      moving.wallId && moving.wallId === o.wallId &&
      moving.wallOffset != null && o.wallOffset != null &&
      Number.isFinite(Number(moving.wallOffset)) && Number.isFinite(Number(o.wallOffset)),
    );
    if (sameExplicitRun) {
      const start = Number(moving.wallOffset);
      const end = start + alongRunSpan(moving);
      const otherStart = Number(o.wallOffset);
      const otherEnd = otherStart + alongRunSpan(o);
      const overlap = Math.min(end, otherEnd) - Math.max(start, otherStart);
      if (overlap > COLLISION_EPSILON_IN) {
        return { cabinet: o, overlapX: overlap, overlapY: Math.min(moving.depth, o.depth), penetration: overlap };
      }
      // Their axis-aligned visual boxes may overlap even when two angled cabinets
      // are correctly butted along their shared 45° run.
      continue;
    }
    const os = placedFootprint(o);
    const overlapX = Math.min(moving.x + w, o.x + os.w) - Math.max(moving.x, o.x);
    const overlapY = Math.min(moving.y + d, o.y + os.d) - Math.max(moving.y, o.y);
    if (overlapX > COLLISION_EPSILON_IN && overlapY > COLLISION_EPSILON_IN) {
      const movingAxis = (((moving.rotation % 180) + 180) % 180) === 90 ? "vertical" : "horizontal";
      const otherAxis = (((o.rotation % 180) + 180) % 180) === 90 ? "vertical" : "horizontal";
      const penetration = moving.placement === o.placement && movingAxis === otherAxis
        ? movingAxis === "horizontal" ? overlapX : overlapY
        : Math.min(overlapX, overlapY);
      return { cabinet: o, overlapX, overlapY, penetration };
    }
  }
  return null;
}

type PlanFootprintPoint = { x: number; y: number };

function planRectanglePolygon(x: number, y: number, width: number, depth: number): PlanFootprintPoint[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + depth },
    { x, y: y + depth },
  ];
}

/** Returns a cabinet's actual rotated body instead of its screen-space bounding box. */
function rotatedCabinetBodyPolygon(cabinet: PlacedCabinet): PlanFootprintPoint[] {
  const bounds = placedFootprint(cabinet);
  const center = { x: cabinet.x + bounds.w / 2, y: cabinet.y + bounds.d / 2 };
  const radians = (((cabinet.rotation % 360) + 360) % 360) * Math.PI / 180;
  const tangent = { x: Math.cos(radians), y: Math.sin(radians) };
  const normal = { x: -Math.sin(radians), y: Math.cos(radians) };
  const halfWidth = Math.max(0, Number(cabinet.width) || 0) / 2;
  const halfDepth = Math.max(0, Number(cabinet.depth) || 0) / 2;
  return [
    { x: center.x - tangent.x * halfWidth - normal.x * halfDepth, y: center.y - tangent.y * halfWidth - normal.y * halfDepth },
    { x: center.x + tangent.x * halfWidth - normal.x * halfDepth, y: center.y + tangent.y * halfWidth - normal.y * halfDepth },
    { x: center.x + tangent.x * halfWidth + normal.x * halfDepth, y: center.y + tangent.y * halfWidth + normal.y * halfDepth },
    { x: center.x - tangent.x * halfWidth + normal.x * halfDepth, y: center.y - tangent.y * halfWidth + normal.y * halfDepth },
  ];
}

/** True only for the thin face board at a saved 45° fitted-filler seam. */
function isMiteredWallFiller(cabinet: PlacedCabinet): boolean {
  return (cabinet.placement === "wall" || cabinet.placement === "base")
    && cabinet.fillerTransitionKind !== "angled-wedge"
    && cabinet.fillerMiterAngle === 45
    && (cabinet.fillerMiteredEnd === "start" || cabinet.fillerMiteredEnd === "end");
}

/**
 * The collision body for a 45° fitted filler is a thin, diagonal-cut front
 * board, never the full base or wall depth. Rendering uses the same 3/4-inch
 * board depth while the original selected-line stock fields retain pricing and
 * cut authority.
 */
function miteredWallFillerBodyPolygon(cabinet: PlacedCabinet): PlanFootprintPoint[] {
  const bounds = placedFootprint(cabinet);
  const center = { x: cabinet.x + bounds.w / 2, y: cabinet.y + bounds.d / 2 };
  const radians = (((cabinet.rotation % 360) + 360) % 360) * Math.PI / 180;
  const tangent = { x: Math.cos(radians), y: Math.sin(radians) };
  const normal = { x: -Math.sin(radians), y: Math.cos(radians) };
  const halfWidth = Math.max(0, Number(cabinet.width) || 0) / 2;
  const fullDepth = Math.max(0, Number(cabinet.depth) || 0);
  const faceDepth = Math.min(fullDepth, 0.75);
  const front = fullDepth / 2;
  const back = front - faceDepth;
  const cut = Math.min(Math.max(0, faceDepth), halfWidth * 2);
  const local = cabinet.fillerMiteredEnd === "start"
    ? [[-halfWidth + cut, front], [halfWidth, front], [halfWidth, back], [-halfWidth, back]]
    : [[-halfWidth, front], [halfWidth - cut, front], [halfWidth, back], [-halfWidth, back]];
  return local.map(([along, outward]) => ({
    x: center.x + tangent.x * along + normal.x * outward,
    y: center.y + tangent.y * along + normal.y * outward,
  }));
}

/** The two solid legs of an L-corner; its interior notch is intentionally empty. */
function lCornerBodyPolygons(cabinet: PlacedCabinet): PlanFootprintPoint[][] {
  const bounds = placedFootprint(cabinet);
  const leg = Math.min(bounds.w, bounds.d) * cornerLegRatioForPlaced(cabinet);
  const right = cabinet.x + bounds.w;
  const bottom = cabinet.y + bounds.d;
  switch ((((cabinet.rotation % 360) + 360) % 360)) {
    case 90:
      return [planRectanglePolygon(cabinet.x, cabinet.y, bounds.w, leg), planRectanglePolygon(right - leg, cabinet.y + leg, leg, bounds.d - leg)];
    case 180:
      return [planRectanglePolygon(cabinet.x, bottom - leg, bounds.w, leg), planRectanglePolygon(right - leg, cabinet.y, leg, bounds.d - leg)];
    case 270:
      return [planRectanglePolygon(cabinet.x, bottom - leg, bounds.w, leg), planRectanglePolygon(cabinet.x, cabinet.y, leg, bounds.d - leg)];
    default:
      return [planRectanglePolygon(cabinet.x, cabinet.y, bounds.w, leg), planRectanglePolygon(cabinet.x, cabinet.y + leg, leg, bounds.d - leg)];
  }
}

/**
 * Countertop polygon for an easy-reach / Lazy-Susan corner base.
 *
 * The top follows the cabinet's TRUE L footprint (two carcass legs seated in
 * the room corner), not its square bounding box. Each of the two exposed fronts
 * carries the same finished front overhang as the adjoining straight runs, so
 * the corner top meets the neighbouring run slabs on one continuous front line
 * with no step, gap, or square "plug" projecting into the open floor. The two
 * wall-side edges remain flush to the walls. The same canonical outline is
 * used for every rotation, in both ordinary rectangular rooms and measured
 * continuous-wall rooms.
 */
export function lCornerCountertopWorldPolygon(
  cabinet: PlacedCabinet,
  frontOverhang = COUNTERTOP_DEPTH_IN - STD.BASE_DEPTH,
): PlanFootprintPoint[] {
  const bounds = placedFootprint(cabinet);
  const leg = Math.min(bounds.w, bounds.d) * cornerLegRatioForPlaced(cabinet);
  const projected = Math.max(0, Math.min(
    Number.isFinite(frontOverhang) ? frontOverhang : 0,
    Math.max(0, bounds.w - leg),
    Math.max(0, bounds.d - leg),
  ));
  const rotation = ((Number(cabinet.rotation) % 360) + 360) % 360;
  const radians = rotation * Math.PI / 180;
  const tangent = { x: Math.cos(radians), y: Math.sin(radians) };
  const normal = { x: -Math.sin(radians), y: Math.cos(radians) };
  // `wallPlacementAt` saves a measured angled wall placement from the rotated
  // bounding-box origin. Recover that same physical center used by the 3D
  // cabinet transform before rotating the one canonical L outline. Cardinal
  // rooms retain their ordinary 36-by-36 placement origin unchanged.
  const rotatedMeasuredPlacement = Boolean(
    cabinet.wallId
    && cabinet.wallOffset != null
    && ![0, 90, 180, 270].includes(Math.round(rotation)),
  );
  const rotatedWidth = Math.abs(bounds.w * tangent.x) + Math.abs(bounds.d * normal.x);
  const rotatedDepth = Math.abs(bounds.w * tangent.y) + Math.abs(bounds.d * normal.y);
  const center = {
    x: cabinet.x + (rotatedMeasuredPlacement ? rotatedWidth : bounds.w) / 2,
    y: cabinet.y + (rotatedMeasuredPlacement ? rotatedDepth : bounds.d) / 2,
  };
  const clean = (value: number) => Math.abs(value) < 1e-9 ? 0 : Math.round(value * 1e9) / 1e9;
  const worldPoint = (local: PlanFootprintPoint): PlanFootprintPoint => {
    const along = local.x - bounds.w / 2;
    const inward = local.y - bounds.d / 2;
    return {
      x: clean(center.x + tangent.x * along + normal.x * inward),
      y: clean(center.y + tangent.y * along + normal.y * inward),
    };
  };
  // Local frame (rotation 0): wall corner at top-left. The back leg runs along
  // the top wall (y: 0..leg) and the side leg runs down the left wall
  // (x: 0..leg). Both room-facing fronts step out by the finished overhang.
  return [
    { x: 0, y: 0 },
    { x: bounds.w, y: 0 },
    { x: bounds.w, y: leg + projected },
    { x: leg + projected, y: leg + projected },
    { x: leg + projected, y: bounds.d },
    { x: 0, y: bounds.d },
  ].map(worldPoint);
}

function cabinetPlanBodyPolygons(cabinet: PlacedCabinet): PlanFootprintPoint[][] {
  return (cabinet.fillerTransitionKind === "angled-wedge" || cabinet.fillerTransitionKind === "front-miter-pair") && (cabinet.fillerTransitionPlanFootprint?.length ?? 0) >= 3
    ? [cabinet.fillerTransitionPlanFootprint!.map((point) => ({ x: point.x, y: point.y }))]
    : isMiteredWallFiller(cabinet)
    ? [miteredWallFillerBodyPolygon(cabinet)]
    : placedCornerGeometryKind(cabinet) === "l-shape"
    ? lCornerBodyPolygons(cabinet)
    : [rotatedCabinetBodyPolygon(cabinet)];
}

/** Convex separating-axis test where flush edge contact remains valid. */
function convexPlanPolygonsIntersect(left: PlanFootprintPoint[], right: PlanFootprintPoint[]): boolean {
  for (const polygon of [left, right]) {
    for (let index = 0; index < polygon.length; index++) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];
      const axis = { x: -(end.y - start.y), y: end.x - start.x };
      const project = (points: PlanFootprintPoint[]) => points.reduce(
        (range, point) => {
          const value = point.x * axis.x + point.y * axis.y;
          return { min: Math.min(range.min, value), max: Math.max(range.max, value) };
        },
        { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
      );
      const leftRange = project(left);
      const rightRange = project(right);
      if (leftRange.max <= rightRange.min + COLLISION_EPSILON_IN || rightRange.max <= leftRange.min + COLLISION_EPSILON_IN) return false;
    }
  }
  return true;
}

export function cabinetPlanBodiesIntersect(left: PlacedCabinet, right: PlacedCabinet): boolean {
  return cabinetPlanBodyPolygons(left).some((leftPolygon) =>
    cabinetPlanBodyPolygons(right).some((rightPolygon) => convexPlanPolygonsIntersect(leftPolygon, rightPolygon)),
  );
}

/** True when either body is a free (unseated) standard base at an odd 45° turn. */
function usesFreestandingFortyFiveBodyCheck(moving: PlacedCabinet, other: PlacedCabinet): boolean {
  const isFreeFortyFive = (cabinet: PlacedCabinet) => {
    const rotation = (((Math.round(Number(cabinet.rotation)) % 360) + 360) % 360);
    return !cabinet.wallId
      && cabinet.placement === "base"
      && placedCornerGeometryKind(cabinet) === "standard"
      && (rotation === 45 || rotation === 135 || rotation === 225 || rotation === 315);
  };
  return (moving.placement === "base" && other.placement === "base") && (isFreeFortyFive(moving) || isFreeFortyFive(other));
}
function usesPeninsulaCornerJoinBodyCheck(moving: PlacedCabinet, other: PlacedCabinet, room: RoomData): boolean {
  if (moving.placement !== "base" || other.placement !== "base") return false;
  const run = peninsulaRunById(room, moving.wallId);
  return Boolean(
    (run?.turn === 45 || run?.turn === 90) &&
    run.parentWall &&
    cabinetWall(other, room) === run.parentWall &&
    placedCornerGeometryKind(other) === "l-shape",
  );
}

/**
 * A true corner cabinet seated at a shared measured-wall vertex consumes a leg
 * of the adjoining wall even when the two rotated screen bounding boxes do not
 * intersect. This covers an ERB36 at a diagonal 90-degree vertex: a B12 at
 * offset 0 on the adjoining diagonal must not occupy the ERB's cabinet leg.
 */
function customWallCornerReservationCollision(
  corner: PlacedCabinet,
  neighbor: PlacedCabinet,
  blockedBy: PlacedCabinet,
  room: RoomData,
): CabinetCollisionDetail | null {
  // A plan-view corner footprint is only a collision when the two installed
  // elevation envelopes also overlap. A 34½-inch ERB/LS/BBC base must protect
  // the adjoining *base* run, but it cannot reserve the 54-inch-and-up wall
  // cabinet band. Tall cabinets remain intentionally blocking because their
  // vertical envelope crosses both layers.
  if (!sharesPlanCollisionZone(corner, neighbor)) return null;
  const kind = placedCornerGeometryKind(corner);
  if (kind !== "l-shape" && kind !== "diagonal" && kind !== "corner-drawer") return null;
  if (!room.vertices?.length || !room.customWalls?.length) return null;
  if (!corner.wallId || !neighbor.wallId || corner.wallId === neighbor.wallId) return null;
  if (!isCustomRoomWall(room, corner.wallId) || !isCustomRoomWall(room, neighbor.wallId)) return null;

  const cornerWall = room.customWalls.find((wall) => wall.id === corner.wallId);
  const neighborWall = room.customWalls.find((wall) => wall.id === neighbor.wallId);
  if (!cornerWall || !neighborWall) return null;
  const sharedVertex = [cornerWall.startVertexId, cornerWall.endVertexId].find((vertexId) => (
    vertexId === neighborWall.startVertexId || vertexId === neighborWall.endVertexId
  ));
  if (!sharedVertex) return null;

  const cornerLength = wallLength(corner.wallId as WallSide, room);
  const cornerStart = wallRunOffset(corner, corner.wallId, room);
  const cornerEnd = cornerStart + wallRunSpan(corner, corner.wallId, room);
  const seatedAtSharedVertex = sharedVertex === cornerWall.startVertexId
    ? cornerStart <= COLLISION_EPSILON_IN
    : cornerEnd >= cornerLength - COLLISION_EPSILON_IN;
  if (!seatedAtSharedVertex) return null;

  const footprint = placedFootprint(corner);
  // Keep final collision in agreement with freeSegmentsOnWall. The continuous
  // outer edge of a seated L-corner reaches the full 36-inch corner envelope on
  // its adjoining wall; the interior notch is not an exposed cabinet-run edge.
  // A straight base or dishwasher must therefore seat at that outer edge.
  const adjacentLeg = kind === "l-shape"
    ? Math.max(0, footprint.w)
    : Math.min(footprint.w, footprint.d);
  const neighborStartsAtSharedVertex = sharedVertex === neighborWall.startVertexId;
  const neighborLength = wallLength(neighbor.wallId as WallSide, room);
  const reservedStart = neighborStartsAtSharedVertex ? 0 : Math.max(0, neighborLength - adjacentLeg);
  const reservedEnd = neighborStartsAtSharedVertex ? Math.min(neighborLength, adjacentLeg) : neighborLength;
  const neighborStart = wallRunOffset(neighbor, neighbor.wallId, room);
  const neighborEnd = neighborStart + wallRunSpan(neighbor, neighbor.wallId, room);
  const overlap = Math.min(neighborEnd, reservedEnd) - Math.max(neighborStart, reservedStart);
  if (overlap <= COLLISION_EPSILON_IN) return null;
  return {
    cabinet: blockedBy,
    overlapX: overlap,
    overlapY: Math.min(Math.max(0, Number(corner.depth) || 0), Math.max(0, Number(neighbor.depth) || 0)),
    penetration: overlap,
  };
}

/**
 * A diagonal continuous-wall corner is encoded as two separate wall frames.
 * Their axis-aligned render envelopes can overlap even after a straight cabinet
 * has seated exactly at the L-corner's exposed outer edge. The measured run
 * reservation above is authoritative for that pair; this identifies when its
 * zero-overlap result can safely replace the screen-envelope fallback.
 */
function hasSeatedCustomWallCornerPair(
  left: PlacedCabinet,
  right: PlacedCabinet,
  room: RoomData,
): boolean {
  if (!room.vertices?.length || !room.customWalls?.length) return false;
  const pair = [left, right] as const;
  for (const corner of pair) {
    const neighbor = corner.uid === left.uid ? right : left;
    const kind = placedCornerGeometryKind(corner);
    if (kind !== "l-shape" && kind !== "diagonal" && kind !== "corner-drawer") continue;
    if (!corner.wallId || !neighbor.wallId || corner.wallId === neighbor.wallId) continue;
    if (!isCustomRoomWall(room, corner.wallId) || !isCustomRoomWall(room, neighbor.wallId)) continue;
    const cornerWall = room.customWalls.find((wall) => wall.id === corner.wallId);
    const neighborWall = room.customWalls.find((wall) => wall.id === neighbor.wallId);
    if (!cornerWall || !neighborWall) continue;
    const sharedVertex = [cornerWall.startVertexId, cornerWall.endVertexId].find((vertexId) => (
      vertexId === neighborWall.startVertexId || vertexId === neighborWall.endVertexId
    ));
    if (!sharedVertex) continue;
    const cornerStart = wallRunOffset(corner, corner.wallId, room);
    const cornerEnd = cornerStart + wallRunSpan(corner, corner.wallId, room);
    const cornerLength = wallLength(corner.wallId as WallSide, room);
    const seated = sharedVertex === cornerWall.startVertexId
      ? cornerStart <= COLLISION_EPSILON_IN
      : cornerEnd >= cornerLength - COLLISION_EPSILON_IN;
    if (seated) return true;
  }
  return false;
}

/**
 * A saved mitered filler is a thin finish board for one named physical 45°
 * continuous-wall vertex. It may touch the cabinet on the adjoining wall at
 * that vertex, but it must not disable collision checks for any other cabinet
 * body.
 */
function isMiteredWallFillerJoinPeer(
  filler: PlacedCabinet,
  peer: PlacedCabinet,
  room: RoomData,
): boolean {
  if (!isMiteredWallFiller(filler) || !filler.wallId || !peer.wallId || filler.wallId === peer.wallId) return false;
  if (filler.fillerTransitionKind === "front-miter-pair"
    && peer.uid !== filler.fillerForCabinetUid
    && peer.uid !== filler.fillerTransitionNeighborUid) return false;
  const fillerWall = room.customWalls?.find((wall) => wall.id === filler.wallId);
  const peerWall = room.customWalls?.find((wall) => wall.id === peer.wallId);
  if (!fillerWall || !peerWall || !customWallJoinTurnsFortyFive(fillerWall, peerWall, room)) return false;
  const miterVertex = filler.fillerMiteredEnd === "start" ? fillerWall.startVertexId : fillerWall.endVertexId;
  if (peerWall.startVertexId !== miterVertex && peerWall.endVertexId !== miterVertex) return false;
  const peerLength = wallLength(peer.wallId as WallSide, room);
  const peerStart = wallRunOffset(peer, peer.wallId, room);
  const peerEnd = peerStart + wallRunSpan(peer, peer.wallId, room);
  const peerSeatedAtVertex = peerWall.startVertexId === miterVertex
    ? peerStart <= COLLISION_EPSILON_IN
    : peerEnd >= peerLength - COLLISION_EPSILON_IN;
  if (!peerSeatedAtVertex) return false;
  const fillerElevation = elevationBox(filler, room);
  const peerElevation = elevationBox(peer, room);
  return Math.abs(fillerElevation.bottom - peerElevation.bottom) <= COLLISION_EPSILON_IN
    && Math.abs(fillerElevation.height - peerElevation.height) <= COLLISION_EPSILON_IN;
}

/**
 * A measured wedge belongs to exactly two independently supported cabinets.
 * Those named side faces are allowed to touch the transition; every other
 * cabinet remains subject to the stored exact-footprint collision check.
 */
function isAngledTransitionFillerJoinPeer(
  filler: PlacedCabinet,
  peer: PlacedCabinet,
  room: RoomData,
): boolean {
  const isLegacyWedge = filler.fillerTransitionKind === "angled-wedge";
  const isFrontMiterPair = filler.fillerTransitionKind === "front-miter-pair";
  if (!isLegacyWedge && !isFrontMiterPair) return false;
  const isNamedSupportingCabinet = peer.uid === filler.fillerForCabinetUid || peer.uid === filler.fillerTransitionNeighborUid;
  const isMatchedMiterPiece = isFrontMiterPair
    && Boolean(filler.fillerPieceGroupId)
    && filler.fillerPieceGroupId === peer.fillerPieceGroupId;
  if (!isNamedSupportingCabinet && !isMatchedMiterPiece) return false;
  if (peer.placement !== filler.placement) return false;
  const fillerElevation = elevationBox(filler, room);
  const peerElevation = elevationBox(peer, room);
  return Math.abs(fillerElevation.bottom - peerElevation.bottom) <= COLLISION_EPSILON_IN
    && Math.abs(fillerElevation.height - peerElevation.height) <= COLLISION_EPSILON_IN;
}

/**
 * Placement-time collision calculation uses physical plan bodies when a
 * peninsula joins an L-corner on its parent wall. This prevents either a 45°
 * diagonal envelope or a square 90° envelope from creating a false setback;
 * all other cabinet pairs retain generic collision behavior.
 */
export function cabinetPlacementCollisionDetail(
  moving: PlacedCabinet,
  others: PlacedCabinet[],
  room?: RoomData,
): CabinetCollisionDetail | null {
  if (!room) return cabinetCollisionDetail(moving, others);
  for (const other of others) {
    if (isRequiredBlindCornerFillerJoinPeer(moving, other) || isRequiredBlindCornerFillerJoinPeer(other, moving)) continue;
    // Test both directions so a shared-corner reservation is enforced whether
    // the straight cabinet or the ERB/L/diagonal cabinet is moving.
    const movingCornerReservation = customWallCornerReservationCollision(moving, other, other, room);
    if (movingCornerReservation) return movingCornerReservation;
    const otherCornerReservation = customWallCornerReservationCollision(other, moving, other, room);
    if (otherCornerReservation) return otherCornerReservation;
    if (isMiteredWallFillerJoinPeer(moving, other, room) || isMiteredWallFillerJoinPeer(other, moving, room)) continue;
		if (isAngledTransitionFillerJoinPeer(moving, other, room) || isAngledTransitionFillerJoinPeer(other, moving, room)) continue;
    const detail = cabinetCollisionDetail(moving, [other]);
    if (!detail) continue;
		// A measured transition stores its exact convex wedge/trapezoid. Its axis-
		// aligned saved envelope overlaps both cabinet envelopes by design, but the
		// physical polygon only touches their side faces. Keep every unrelated body
		// collision active and waive only false envelope overlap.
    if ((moving.fillerTransitionKind === "angled-wedge" || moving.fillerTransitionKind === "front-miter-pair" || other.fillerTransitionKind === "angled-wedge" || other.fillerTransitionKind === "front-miter-pair")
		  && !cabinetPlanBodiesIntersect(moving, other)) continue;
    // For a real diagonal continuous-wall vertex the two cabinets live in
    // different local wall frames. If the exact corner-run reservation says
    // their spans only touch, do not let the overlapping rectangular render
    // envelopes reject a valid DB24/dishwasher seam.
    if (hasSeatedCustomWallCornerPair(moving, other, room)) continue;
    if (usesPeninsulaCornerJoinBodyCheck(moving, other, room) && !cabinetPlanBodiesIntersect(moving, other)) continue;
    // A free cabinet turned to 45° in the open room stores a diagonal screen
    // envelope that overlaps its flush neighbour by design; only the true
    // rotated bodies decide (edge contact at the miter stays valid).
    if (usesFreestandingFortyFiveBodyCheck(moving, other) && !cabinetPlanBodiesIntersect(moving, other)) continue;
    return detail;
  }
  return null;
}

/**
 * Finds the earliest usable start of a primary peninsula when an adjoining
 * parent-wall corner unit occupies the physical join. The measurement uses the
 * exact same placement collision rule as the final catalog add, so the first
 * cabinet is seated immediately after true clearance rather than created at
 * offset zero and then rejected. It deliberately applies only to base/tall/
 * appliance floor items on a 45° or 90° primary peninsula; later cabinets are
 * already handled by the normal explicit-run free-span calculation.
 */
export function peninsulaAutomaticStartOffset(
  side: WallSide,
  room: RoomData,
  placed: PlacedCabinet[],
  width: number,
  depth: number,
  placement: Placement,
  requestedPeninsulaSide?: PeninsulaCabinetSide | null,
): number {
  const run = peninsulaRunById(room, side);
  if (!run?.parentWall || run.parentRunId || !["base", "tall", "appliance"].includes(placement) || width <= 0 || depth <= 0) return 0;
  const joinCorners = placed.filter((cabinet) => {
    const kind = placedCornerGeometryKind(cabinet);
    return (
      cabinetWall(cabinet, room) === run.parentWall &&
      (kind === "l-shape" || kind === "diagonal" || kind === "corner-drawer" || kind === "blind-corner")
    );
  });
  if (!joinCorners.length) return 0;

  const maximumOffset = Math.max(0, Number(run.length) - width);
  const steps = Math.round(maximumOffset * 8);
  for (let step = 0; step <= steps; step++) {
    const offset = step / 8;
    const spot = wallPlacementAt(offset, width, depth, side, room, requestedPeninsulaSide);
    const candidate: PlacedCabinet = {
      uid: "peninsula-start-clearance-probe",
      cabinetId: -1,
      masterCode: "PENINSULA-START-PROBE",
      description: "Peninsula start clearance probe",
      placement,
      x: spot.x,
      y: spot.y,
      width,
      depth,
      rotation: spot.rotation,
      wallId: spot.wallId,
      wallOffset: spot.wallOffset,
      peninsulaSide: spot.peninsulaSide,
    };
    if (!cabinetPlacementCollisionDetail(candidate, joinCorners, room)) return offset;
  }
  return 0;
}

/**
 * Returns the first physical location where a standard catalog cabinet can sit
 * on the selected peninsula. Unlike the older corner-only offset, this checks
 * every existing cabinet body with the same placement-time collision rule used
 * by the final add operation. A catalog click therefore needs no manual
 * nudging around a parent-wall base, corner, or a prior peninsula cabinet.
 */
export function firstCollisionFreePeninsulaPlacement(
  side: WallSide,
  room: RoomData,
  placed: PlacedCabinet[],
  width: number,
  depth: number,
  placement: Placement,
  bounds?: { start: number; end: number },
): { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number; peninsulaSide?: PeninsulaCabinetSide } | null {
  const run = peninsulaRunById(room, side);
  if (!run || width <= 0 || depth <= 0) return null;
  const floorSupported = ["base", "tall", "appliance"].includes(placement);
  const has45StartInsideCorner = peninsulaRunHas45StartInsideCornerClearance(run);
  const has45EndInsideCorner = peninsulaRunHas45EndInsideCornerClearance(run, room);
  const farInsideCornerClearance = floorSupported && has45EndInsideCorner ? PENINSULA_INSIDE_CORNER_CLEARANCE_IN : 0;
  const availableRunLength = Math.max(0, Number(run.length) - farInsideCornerClearance);
  if (availableRunLength + COLLISION_EPSILON_IN < width) return null;
  const maximumOffset = Math.max(0, availableRunLength - width);
  const requestedMinimum = Number(bounds?.start);
  const requestedMaximum = Number(bounds?.end);
  // Only an acute 45-degree return needs the installer clearance. A 90-degree
  // corner uses its exact product footprint and stays available for a corner
  // cabinet or a flush straight-cabinet run.
  const insideCornerClearance = floorSupported && has45StartInsideCorner
    ? PENINSULA_INSIDE_CORNER_CLEARANCE_IN
    : 0;
  const minimumOffset = Math.max(
    insideCornerClearance,
    Number.isFinite(requestedMinimum) ? Math.max(0, requestedMinimum) : 0,
  );
  const boundedMaximum = Number.isFinite(requestedMaximum)
    ? Math.max(0, Math.min(maximumOffset, requestedMaximum))
    : maximumOffset;
  if (boundedMaximum + COLLISION_EPSILON_IN < minimumOffset) return null;
  const earliest = Math.max(
    minimumOffset,
    peninsulaAutomaticStartOffset(side, room, placed, width, depth, placement),
  );
  const firstStep = Math.max(0, Math.ceil(earliest * 8 - 0.001));
  const lastStep = Math.floor(boundedMaximum * 8 + 0.001);
  for (let step = firstStep; step <= lastStep; step++) {
    const spot = wallPlacementAt(step / 8, width, depth, side, room);
    const candidate: PlacedCabinet = {
      uid: "peninsula-first-clear-probe",
      cabinetId: -1,
      masterCode: "PENINSULA-FIRST-CLEAR-PROBE",
      description: "Peninsula first clear placement probe",
      placement,
      x: spot.x,
      y: spot.y,
      width,
      depth,
      rotation: spot.rotation,
      wallId: spot.wallId,
      wallOffset: spot.wallOffset,
      peninsulaSide: spot.peninsulaSide,
    };
    if (!cabinetPlacementCollisionDetail(candidate, placed, room)) return spot;
  }
  return null;
}

export function hasCollision(moving: PlacedCabinet, others: PlacedCabinet[]): boolean {
  const detail = cabinetCollisionDetail(moving, others);
  if (!detail) return false;
  // Free 45° bodies: the diagonal envelope may overlap a flush neighbour while
  // the real rotated boxes only share an edge at the miter.
  if (usesFreestandingFortyFiveBodyCheck(moving, detail.cabinet) && !cabinetPlanBodiesIntersect(moving, detail.cabinet)) {
    return hasCollision(moving, others.filter((other) => other.uid !== detail.cabinet.uid));
  }
  return true;
}

/**
 * Finds the nearest 1/8-inch mounting height that clears every existing item.
 * The caller supplies a unique preview item, so its source shelf remains a real
 * peer and prevents a duplicate from snapping into the original shelf.
 */
export function nearestCollisionFreeMountBottom(moving: PlacedCabinet, others: PlacedCabinet[], desiredBottom: number, maximumBottom: number): number | null {
  const maxStep = Math.max(0, Math.round(maximumBottom * 8));
  const desiredStep = Math.max(0, Math.min(maxStep, Math.round(desiredBottom * 8)));
  const atStep = (step: number): PlacedCabinet => ({ ...moving, mountBottom: step / 8, mountBottomAdjusted: true });
  if (!hasCollision(atStep(desiredStep), others)) return desiredStep / 8;

  for (let distance = 1; distance <= maxStep; distance++) {
    const lower = desiredStep - distance;
    const upper = desiredStep + distance;
    if (lower >= 0 && !hasCollision(atStep(lower), others)) return lower / 8;
    if (upper <= maxStep && !hasCollision(atStep(upper), others)) return upper / 8;
  }
  return null;
}

/**
 * Resolve a near seam (gap or penetration within the supplied tolerance) to exact edge
 * contact for every same-category base/base and wall/wall pair. This never
 * approves an overlap: it returns coordinates whose saved gap and penetration
 * are both zero. Larger overlaps remain untouched for normal rejection.
 */
export function snapCabinetSeamOverlap(
  moving: PlacedCabinet,
  others: PlacedCabinet[],
  toleranceIn = CABINET_ADJACENCY_MAGNET_IN,
  room?: RoomData,
): PlacedCabinet {
  let next = moving;
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const other of others) {
      if (other.uid === next.uid || other.placement !== next.placement) continue;
      if (next.placement !== "base" && next.placement !== "wall") continue;
      // A corner cabinet on a drawn wall reserves its exact catalog leg through
      // the shared wall-run model.  When the moving cabinet is already seated
      // flush against that leg, its rotated screen-space bounding box can still
      // appear one inch deep inside the diagonal corner.  Do not apply a second
      // axis-aligned seam correction: it would turn an exact 0" run seam into a
      // physical overlap.  A real overlap still goes through the normal snap /
      // collision path below.
      const sharedCustomRun = room
        && next.wallId
        && next.wallId === other.wallId
        && isCustomRoomWall(room, next.wallId)
        && wallRunFrame(next.wallId, room);
      if (sharedCustomRun) {
        const nextStart = wallRunOffset(next, next.wallId!, room!);
        const nextEnd = nextStart + wallRunSpan(next, next.wallId!, room!);
        const otherStart = wallRunOffset(other, other.wallId!, room!);
        const otherEnd = otherStart + wallRunSpan(other, other.wallId!, room!);
        const exactRunSeam = Math.min(
          Math.abs(nextEnd - otherStart),
          Math.abs(otherEnd - nextStart),
        ) <= COLLISION_EPSILON_IN;
        if (exactRunSeam && !cabinetPlacementCollisionDetail(next, [other], room)) continue;
      }
      const size = placedFootprint(next);
      const otherSize = placedFootprint(other);
      const overlapX = Math.min(next.x + size.w, other.x + otherSize.w) - Math.max(next.x, other.x);
      const overlapY = Math.min(next.y + size.d, other.y + otherSize.d) - Math.max(next.y, other.y);
      const axis = (((next.rotation % 180) + 180) % 180) === 90 ? "vertical" : "horizontal";
      const otherAxis = (((other.rotation % 180) + 180) % 180) === 90 ? "vertical" : "horizontal";
      const nextCornerKind = placedCornerGeometryKind(next);
      const otherCornerKind = placedCornerGeometryKind(other);
      const isTrueCornerEnvelope = (kind: PlacedCornerGeometryKind) => (
        kind === "l-shape" || kind === "diagonal" || kind === "corner-drawer" || kind === "triangle"
      );
      const nextIsCornerEnvelope = isTrueCornerEnvelope(nextCornerKind);
      const otherIsCornerEnvelope = isTrueCornerEnvelope(otherCornerKind);
      // A wall diagonal/L corner has a corner-specific rotation, which differs
      // from the straight cabinet on one of its two adjoining walls. Measure
      // that pair along the straight cabinet's wall axis so a near edge can
      // resolve to true zero-overlap contact instead of being rejected by a
      // one-eighth-inch rectangular-envelope collision. Two corner envelopes
      // still retain their normal collision behavior.
      const seamAxis = axis === otherAxis
        ? axis
        : next.placement === "wall" && nextIsCornerEnvelope !== otherIsCornerEnvelope
          ? nextIsCornerEnvelope ? otherAxis : axis
          : null;
      if (!seamAxis) continue;
      // The cabinets must overlap on the perpendicular axis, but the seam axis
      // may be either a tiny penetration or a positive gap. The latter is the
      // normal half-inch hand-placement case: the magnetic seam should close it
      // to exact zero contact rather than leaving a visible split.
      const crossOverlap = seamAxis === "horizontal" ? overlapY : overlapX;
      if (crossOverlap <= COLLISION_EPSILON_IN) continue;
      if (seamAxis === "horizontal") {
        const nextCenter = next.x + size.w / 2;
        const otherCenter = other.x + otherSize.w / 2;
        const seamDelta = nextCenter <= otherCenter
          ? other.x - (next.x + size.w)
          : other.x + otherSize.w - next.x;
        if (Math.abs(seamDelta) > toleranceIn + COLLISION_EPSILON_IN || Math.abs(seamDelta) <= COLLISION_EPSILON_IN) continue;
        next = { ...next, x: next.x + seamDelta };
      } else {
        const nextCenter = next.y + size.d / 2;
        const otherCenter = other.y + otherSize.d / 2;
        const seamDelta = nextCenter <= otherCenter
          ? other.y - (next.y + size.d)
          : other.y + otherSize.d - next.y;
        if (Math.abs(seamDelta) > toleranceIn + COLLISION_EPSILON_IN || Math.abs(seamDelta) <= COLLISION_EPSILON_IN) continue;
        next = { ...next, y: next.y + seamDelta };
      }
      changed = true;
    }
    if (!changed) break;
  }
  return next;
}

/** Returns an actionable explanation when a placement is rejected for a true collision. */
export function collisionReason(moving: PlacedCabinet, others: PlacedCabinet[], room?: RoomData): string | null {
  const detail = cabinetPlacementCollisionDetail(moving, others, room);
  if (!detail) return null;
  const conflicting = detail.cabinet;
  const category = conflicting.placement === "wall" ? "wall cabinet" : conflicting.placement === "base" ? "base cabinet" : "item";
  const overlap = formatEighthInches(detail.penetration);
  const normalizedCode = conflicting.masterCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const seatedFlushCorner = room ? cabinetCornerPlacementInfo(conflicting, room)?.placement === "flush" : false;
  const seatedBlindCorner = room ? blindCornerSnapInfo(conflicting, room)?.placement === "flush" : false;
  if (normalizedCode === "ERB36" && seatedFlushCorner) {
    return `Corner protected: ${conflicting.masterCode} is snapped into this corner. ${moving.masterCode} would overlap its reserved adjoining leg by ${overlap}. Move it to the next clear wall span; edge-to-edge contact is allowed, but physical overlap must be 0".`;
  }
  if (isBlindCorner(conflicting.masterCode, conflicting.description) && seatedBlindCorner) {
    return `Corner protected: ${conflicting.masterCode} is snapped into this blind corner. ${moving.masterCode} would overlap its cabinet body or required filler by ${overlap}. Move it to the next clear wall span; edge-to-edge contact is allowed, but physical overlap must be 0".`;
  }
  return `Cannot place ${moving.masterCode} here: it overlaps ${conflicting.masterCode}, another ${category}, by ${overlap}. Edge-to-edge contact is allowed; physical overlap must be 0".`;
}

/** Custom placement cannot bypass same-category base/base or wall/wall physical overlap. */
export function shouldBlockPlacementCollision(
  moving: PlacedCabinet,
  others: PlacedCabinet[],
  customPlacement = false,
  room?: RoomData,
): boolean {
  const detail = cabinetPlacementCollisionDetail(moving, others, room);
  if (!detail) return false;
  if (detail.cabinet.placement === moving.placement && (moving.placement === "base" || moving.placement === "wall")) return true;
  return !customPlacement;
}

/**
 * Items reserve the same plan run only when their placement category matches or
 * their physical elevation envelopes intersect. This allows a wall cabinet to
 * occupy the plan space above a base cabinet while retaining wall-to-wall and
 * base-to-base collision prevention.
 */
export function sharesPlanCollisionZone(a: PlacedCabinet, b: PlacedCabinet): boolean {
  // Refrigerator end panels are thin finish skins at the appliance opening.
  // They intentionally share the seam projection with the refrigerator and its
  // neighboring cabinet, so they must never cause either side to be discarded
  // by batch placement or legacy-layout cleanup.
  if (isRefrigeratorEndPanel(a) || isRefrigeratorEndPanel(b)) return false;
  if (isHoodOverRangePair(a, b)) return false;
  // An over-range microwave snaps to the center of a range but lives in the
  // upper elevation band (normally 54–71 inches). It can therefore share the
  // plan projection with the floor range without either item physically
  // occupying the other. Keep ordinary appliance overlaps blocked below.
  if (isMicrowaveOverRangePair(a, b)) return false;
  // Wall cabinets can share a plan projection when their elevation bands do
  // not intersect (for example, a short bridge mounted above a window).
  // Same-height wall cabinets remain true collisions.
  if (a.placement === b.placement) {
    return a.placement === "wall" ? verticalEnvelopesOverlap(a, b) : true;
  }
  if (!verticalEnvelopesOverlap(a, b)) return false;
  if (
    (isSinkAppliance(a) && isSinkBaseCabinet(b)) ||
    (isSinkAppliance(b) && isSinkBaseCabinet(a))
  ) return false;
  return !isBridgeOverRange(a, b);
}

/** A wall-mounted range hood intentionally occupies the same plan projection as the range below it. */
export function isHoodOverRangePair(a: PlacedCabinet, b: PlacedCabinet): boolean {
  const isHood = (item: PlacedCabinet) => /^HOOD-/.test((item.masterCode || "").toUpperCase());
  const isRange = (item: PlacedCabinet) => isRangeOrOven(item.masterCode, item.description);
  return (isHood(a) && isRange(b)) || (isHood(b) && isRange(a));
}

/**
 * An MW-* appliance is a valid over-range companion only when its elevation
 * envelope clears a compatible range. The placement flow centers it on the
 * range; this helper deliberately does not turn any same-height appliance
 * overlap into a valid layout.
 */
export function isMicrowaveOverRangePair(a: PlacedCabinet, b: PlacedCabinet): boolean {
  const isMicrowave = (item: PlacedCabinet) =>
    item.placement === "appliance" && /^MW-/.test((item.masterCode || "").toUpperCase());
  const isRange = (item: PlacedCabinet) =>
    item.placement === "appliance" && !isMicrowave(item) && isRangeOrOven(item.masterCode, item.description);
  const microwave = isMicrowave(a) ? a : isMicrowave(b) ? b : null;
  const range = isRange(a) ? a : isRange(b) ? b : null;
  if (!microwave || !range || verticalEnvelopesOverlap(microwave, range)) return false;

  // A real OTR installation centers the microwave on the range across the
  // cabinet run. The perpendicular plan coordinate differs because the range
  // is 25 inches deep and the microwave is 15 inches deep, so only compare the
  // run axis. Matching rotation keeps the two appliance backs on the same wall.
  const rangeRotation = ((Math.round(range.rotation ?? 0) % 360) + 360) % 360;
  const microwaveRotation = ((Math.round(microwave.rotation ?? 0) % 360) + 360) % 360;
  if (rangeRotation !== microwaveRotation) return false;
  const rangeSize = placedFootprint(range);
  const microwaveSize = placedFootprint(microwave);
  const runAxisIsX = rangeRotation === 0 || rangeRotation === 180;
  const rangeCenter = runAxisIsX ? range.x + rangeSize.w / 2 : range.y + rangeSize.d / 2;
  const microwaveCenter = runAxisIsX ? microwave.x + microwaveSize.w / 2 : microwave.y + microwaveSize.d / 2;
  return Math.abs(rangeCenter - microwaveCenter) <= 0.5;
}

export type CollisionResolution = {
  placed: PlacedCabinet[];
  rejected: PlacedCabinet[];
};

/**
 * Repairs stale saved wall-cabinet envelopes from the dimensional SKU. A user
 * custom size is preserved when the installed value differs from its recorded
 * nominal catalog value; otherwise the SKU remains authoritative.
 */
export function normalizePlacedWallCabinetSkuDimensions(cabinet: PlacedCabinet): PlacedCabinet {
  if (cabinet.placement !== "wall") return cabinet;
  const sku = wallCabinetSkuDimensions(cabinet.masterCode);
  if (!sku) return cabinet;
  const intentionallyCustom = (value: number, nominal: number | null | undefined) =>
    Number.isFinite(nominal) && Math.abs(value - Number(nominal)) > COLLISION_EPSILON_IN;
  const customWidth = intentionallyCustom(cabinet.width, cabinet.nominalWidth);
  const customHeight = intentionallyCustom(cabinet.height ?? sku.height, cabinet.nominalHeight);
  const customDepth = intentionallyCustom(cabinet.depth, cabinet.nominalDepth);
  const width = customWidth ? cabinet.width : sku.width;
  const height = customHeight ? cabinet.height : sku.height;
  const depth = customDepth ? cabinet.depth : sku.depth;
  const nominalWidth = customWidth ? cabinet.nominalWidth : sku.width;
  const nominalHeight = customHeight ? cabinet.nominalHeight : sku.height;
  const nominalDepth = customDepth ? cabinet.nominalDepth : sku.depth;
  if (
    cabinet.width === width && cabinet.height === height && cabinet.depth === depth &&
    cabinet.nominalWidth === nominalWidth && cabinet.nominalHeight === nominalHeight && cabinet.nominalDepth === nominalDepth
  ) return cabinet;
  return { ...cabinet, width, height, depth, nominalWidth, nominalHeight, nominalDepth };
}

/** Adds a batch only when every new placement clears all accepted footprints. */
export function appendCollisionFreePlacements(
  existing: PlacedCabinet[],
  additions: PlacedCabinet[],
  room?: RoomData,
): CollisionResolution {
  const placed = [...existing];
  const rejected: PlacedCabinet[] = [];
  for (const candidate of additions) {
    // A candidate that already carries exact run geometry (wallId + wallOffset
    // from wallPlacementAt) was seated by the shared 1/8-inch engine, so the
    // rectangular screen-space seam snap must not move it. Only legacy x/y-only
    // candidates still use the seam snap, on every kind of wall alike.
    const carriesRunGeometry = Boolean(room && candidate.wallId && candidate.wallOffset != null && wallRunFrame(candidate.wallId, room));
    const snappedCandidate = carriesRunGeometry ? candidate : snapCabinetSeamOverlap(candidate, placed);
    const collision = room
      ? cabinetPlacementCollisionDetail(snappedCandidate, placed, room)
      : hasCollision(snappedCandidate, placed);
    if (collision) {
      rejected.push(candidate);
      continue;
    }
    placed.push(snappedCandidate);
  }
  return { placed, rejected };
}

/**
 * Upgrades required fillers that older builds attached to WBC cabinets through
 * the BBC perpendicular-run path. The real catalog line and pricing identity
 * remain untouched, but its saved geometry becomes a zero-volume face attachment
 * owned by the WBC; the WBC renderer draws the three-inch strip left of the door.
 */
export function normalizeWallBlindCornerRequiredFillers(placements: PlacedCabinet[]): PlacedCabinet[] {
  const byUid = new Map(placements.map((item) => [item.uid, item]));
  let changed = false;
  const next = placements.map((item) => {
    const groupId = item.fillerPieceGroupId ?? "";
    const ownerUid = item.fillerForCabinetUid
      ?? groupId.match(/^(?:bbc|wbc)-required-filler-(.+)$/)?.[1]
      ?? null;
    if (!ownerUid) return item;
    const owner = byUid.get(ownerUid);
    const ownerCode = String(owner?.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const ownerDescription = String(owner?.description ?? "").toLowerCase();
    const ownerIsWbc = /^WBC\d/.test(ownerCode) || /(?:wall.*blind corner|blind corner.*wall)/.test(ownerDescription);
    if (!owner || !ownerIsWbc) return item;
    const nextGroupId = `wbc-required-filler-${owner.uid}`;
    const alreadyNormalized = item.integratedWallBlindFiller === true
      && groupId === nextGroupId
      && item.fillerForCabinetUid === owner.uid
      && item.placement === "wall"
      && item.x === owner.x
      && item.y === owner.y
      && item.rotation === owner.rotation
      && item.depth === 0
      && item.fillerPlacementMode === "left";
    if (alreadyNormalized) return item;
    changed = true;
    return {
      ...item,
      description: `${item.description.replace(/\s+—\s+(?:required BBC clearance|integrated left of WBC door)$/i, "")} — integrated left of WBC door`,
      placement: "wall" as const,
      x: owner.x,
      y: owner.y,
      rotation: owner.rotation,
      depth: 0,
      height: owner.height ?? item.height ?? STD.WALL_HEIGHT,
      mountBottom: owner.mountBottom ?? item.mountBottom ?? null,
      fillerPieceGroupId: nextGroupId,
      fillerPlacementMode: "left" as const,
      fillerForCabinetUid: owner.uid,
      integratedWallBlindFiller: true,
    };
  });
  return changed ? next : placements;
}

/**
 * Repairs legacy/imported layouts before they render while preserving saved
 * order. Earlier accepted cabinets remain authoritative; a later overlapping
 * refrigerator or other item is rejected instead of replacing its neighbor.
 */
export function removeOverlappingPlacements(placements: PlacedCabinet[], room?: RoomData): CollisionResolution {
  const wallBlindNormalized = normalizeWallBlindCornerRequiredFillers(placements);
  const stackerNormalized = room
    ? normalizeGlassStackersToParentFronts(wallBlindNormalized, room)
    : wallBlindNormalized;
  const fillerNormalized = room
    ? normalizeInstalledFillersToAdjacentCabinets(stackerNormalized, room)
    : stackerNormalized;
  const normalizedPlacements = fillerNormalized.map(normalizePlacedWallCabinetSkuDimensions);
  const resolution: CollisionResolution = { placed: [], rejected: [] };
  for (const candidate of normalizedPlacements) {
    if (isRefrigeratorEndPanel(candidate) && refrigeratorEndPanelConflictDetail(candidate, resolution.placed, undefined, room)) {
      resolution.rejected.push(candidate);
      continue;
    }
    // Sink bases are required planning anchors.  Keep them in the restored or
    // newly committed plan even when the user intentionally places one over a
    // window/opening conflict; the Designer reports the conflict as an advisory
    // instead of silently deleting the required cabinet.
    if (isSinkBaseCabinet(candidate)) {
      resolution.placed.push(candidate);
      continue;
    }
    // A countertop-opening cooktop intentionally occupies the same plan bay as
    // its supporting base box. It is a nested visual/appliance placement, not a
    // second freestanding cabinet, so the generic overlap repair must not
    // delete it immediately after a successful legacy-SB conversion.
    const ownerUid = candidate.uid.endsWith(":cooktop") ? candidate.uid.slice(0, -":cooktop".length) : null;
    const supportingBase = ownerUid
      ? resolution.placed.find((item) => item.uid === ownerUid && item.placement === "base" && Math.abs(item.x - candidate.x) < COLLISION_EPSILON_IN && Math.abs(item.y - candidate.y) < COLLISION_EPSILON_IN && Math.abs(item.width - candidate.width) < COLLISION_EPSILON_IN && Math.abs(item.depth - candidate.depth) < COLLISION_EPSILON_IN && Math.abs(Number(item.rotation ?? 0) - Number(candidate.rotation ?? 0)) < COLLISION_EPSILON_IN && item.wallId === candidate.wallId && item.islandFace === candidate.islandFace)
      : null;
    if (candidate.placement === "appliance" && candidate.applianceRole === "countertop-opening" && supportingBase) {
      resolution.placed.push(candidate);
      continue;
    }
    const appended = appendCollisionFreePlacements(resolution.placed, [candidate], room);
    resolution.placed = appended.placed;
    resolution.rejected.push(...appended.rejected);
  }
  const accepted = new Map(resolution.placed.map((placement) => [placement.uid, placement]));
  return {
    placed: placements.flatMap((placement) => {
      const normalized = accepted.get(placement.uid);
      return normalized ? [normalized] : [];
    }),
    rejected: placements.filter((placement) => !accepted.has(placement.uid)),
  };
}

/**
 * Refrigerator end panels are architectural finish pieces and intentionally do
 * not participate in normal cabinet collision cleanup. They still may not cover
 * an existing cabinet. Return the first physical footprint conflict so the UI
 * can skip that panel while preserving the already placed neighbor.
 */
export interface RefrigeratorEndPanelConflictDetail {
  panel: PlacedCabinet;
  cabinet: PlacedCabinet;
  overlapIn: number;
}

export function refrigeratorEndPanelConflictDetail(
  panel: PlacedCabinet,
  existing: PlacedCabinet[],
  refrigeratorUid?: string | null,
  room?: RoomData | null,
): RefrigeratorEndPanelConflictDetail | null {
  if (!isRefrigeratorEndPanel(panel)) return null;
  const panelSize = placedFootprint(panel);
  for (const item of existing) {
    if (item.uid === refrigeratorUid || item.uid === panel.uid || isRefrigeratorEndPanel(item)) continue;
    const itemSize = placedFootprint(item);
    const overlapX = Math.min(panel.x + panelSize.w, item.x + itemSize.w) - Math.max(panel.x, item.x);
    const overlapY = Math.min(panel.y + panelSize.d, item.y + itemSize.d) - Math.max(panel.y, item.y);
    if (overlapX <= COLLISION_EPSILON_IN || overlapY <= COLLISION_EPSILON_IN) continue;
    // AABB overlap is not physical overlap on a diagonal wall. Adjacent rotated
    // rectangles share a large screen-space box, which previously rejected a
    // valid refrigerator end panel and made it disappear at 45 degrees.
    const physicallyIntersects = cabinetPlanBodiesIntersect(panel, item);
    if (!physicallyIntersects) continue;
    const sameMeasuredWall = Boolean(room && cabinetWall(panel, room) === cabinetWall(item, room));
    const overlapIn = room
      ? (() => {
          const side = cabinetWall(panel, room);
          // At a corner, measure the collision along the panel's wall run.
          // Using the smaller screen-axis overlap can under-shift a panel when
          // the perpendicular cabinet enters the panel footprint by only a few
          // inches even though a longer open segment is available on the panel wall.
          const runInterval = (candidate: PlacedCabinet) => {
            const size = placedFootprint(candidate);
            const start = side === "top" || side === "bottom" ? candidate.x : candidate.y;
            const span = side === "top" || side === "bottom" ? size.w : size.d;
            return { start, end: start + span };
          };
          const panelRun = runInterval(panel);
          const itemRun = runInterval(item);
          return Math.max(0, Math.min(panelRun.end, itemRun.end) - Math.max(panelRun.start, itemRun.start));
        })()
      : Math.min(overlapX, overlapY);
    return { panel, cabinet: item, overlapIn };
  }
  return null;
}

export function refrigeratorEndPanelConflict(
  panel: PlacedCabinet,
  existing: PlacedCabinet[],
  refrigeratorUid?: string | null,
): PlacedCabinet | null {
  return refrigeratorEndPanelConflictDetail(panel, existing, refrigeratorUid)?.cabinet ?? null;
}

export interface RefrigeratorEnclosurePlacementResult extends CollisionResolution {
  panelConflicts: RefrigeratorEndPanelConflictDetail[];
}

export interface ExplicitRefrigeratorOptionFitResult {
  /** The refrigerator may move with the newly selected option parts. Existing cabinets never move. */
  existing: PlacedCabinet[];
  /** Newly selected cap, panels, and optional fillers at their fitted coordinates. */
  additions: PlacedCabinet[];
  /** Signed along-run displacement applied to the refrigerator and its selected options. */
  shiftIn: number;
}

/**
 * Fits a refrigerator and the cap/panels explicitly selected in its attributes
 * popup into the same wall run.  This is deliberately a *configuration-time*
 * operation, not an assembly ownership rule: later drag, nudge, delete, and
 * restore actions keep every catalog part independent.
 *
 * At a wall edge or beside a base cabinet, the temporary panel coordinate can
 * start outside the run or overlap the existing neighbor.  Translate only the
 * refrigerator and the options currently being accepted by the exact measured
 * amount that clears the conflict.  Never shift, replace, or delete an already
 * placed cabinet.  If neither direction has a safe space, return the original
 * positions so the normal rejection path explains the blocker.
 */
export function fitExplicitRefrigeratorOptionPlacements(
  existing: PlacedCabinet[],
  additions: PlacedCabinet[],
  refrigeratorUid: string,
  room: RoomData,
): ExplicitRefrigeratorOptionFitResult {
  const refrigerator = existing.find((item) => item.uid === refrigeratorUid);
  if (!refrigerator) return { existing, additions, shiftIn: 0 };

  const side = cabinetWall(refrigerator, room);
  const runLength = wallLength(side, room);
  const alongStart = (item: PlacedCabinet) => (
    item.wallId === side && Number.isFinite(Number(item.wallOffset))
      ? Number(item.wallOffset)
      : wallRunOffset(item, side, room)
  );
  const alongLength = (item: PlacedCabinet) => wallRunSpan(item, side, room);
  const refrigeratorStart = alongStart(refrigerator);
  const members = [refrigerator, ...additions];
  const enclosureStart = Math.min(...members.map(alongStart));
  const enclosureEnd = Math.max(...members.map((item) => alongStart(item) + alongLength(item)));
  const peers = existing.filter((item) => item.uid !== refrigeratorUid && !isRefrigeratorEndPanel(item));
  const panelConflicts = additions
    .filter(isRefrigeratorEndPanel)
    .flatMap((panel) => {
      const conflict = refrigeratorEndPanelConflictDetail(panel, peers, refrigeratorUid, room);
      return conflict ? [conflict] : [];
    });

  const candidateShifts = [
    Math.max(0, -enclosureStart),
    Math.min(0, runLength - enclosureEnd),
    Math.max(0, ...panelConflicts
      .filter(({ panel }) => alongStart(panel) < refrigeratorStart)
      .map(({ overlapIn }) => overlapIn)),
    -Math.max(0, ...panelConflicts
      .filter(({ panel }) => alongStart(panel) >= refrigeratorStart)
      .map(({ overlapIn }) => overlapIn)),
  ].filter((shift, index, all) => Math.abs(shift) > COLLISION_EPSILON_IN && all.indexOf(shift) === index);

  const shifted = (item: PlacedCabinet, shiftIn: number): PlacedCabinet => {
    // Preserve a temporary negative or end-overrun panel while testing.  The
    // normal clamped placement helper would fold that panel back onto the
    // refrigerator and hide the exact displacement that needs to be applied.
    const spot = wallPlacementAtUnbounded(
      alongStart(item) + shiftIn,
      alongLength(item),
      Math.max(0, Number(item.depth) || 0),
      side,
      room,
      item.peninsulaSide,
    );
    return {
      ...item,
      ...spot,
      wallId: spot.wallId ?? item.wallId,
      wallOffset: spot.wallOffset ?? item.wallOffset,
    };
  };
  const withinRunAndRoom = (item: PlacedCabinet): boolean => {
    const start = alongStart(item);
    const end = start + alongLength(item);
    if (start < -COLLISION_EPSILON_IN || end > runLength + COLLISION_EPSILON_IN) return false;
    // A run-owned body is valid inside a drawn or peninsula wall when its
    // measured offset fits.  Cardinal walls also need their full footprint in
    // the rectangular room bounds.
    if (isCustomRoomWall(room, side) || peninsulaRunById(room, side)) return true;
    const size = placedFootprint(item);
    return item.x >= -COLLISION_EPSILON_IN
      && item.y >= -COLLISION_EPSILON_IN
      && item.x + size.w <= room.width + COLLISION_EPSILON_IN
      && item.y + size.d <= room.depth + COLLISION_EPSILON_IN;
  };

  const fittedAt = (shiftIn: number): ExplicitRefrigeratorOptionFitResult | null => {
    const shiftedRefrigerator = shifted(refrigerator, shiftIn);
    const shiftedAdditions = additions.map((item) => shifted(item, shiftIn));
    if (!withinRunAndRoom(shiftedRefrigerator) || shiftedAdditions.some((item) => !withinRunAndRoom(item))) return null;
    if (cabinetPlacementCollisionDetail(shiftedRefrigerator, peers, room)) return null;
    // Refrigerator end panels are architectural skins. Their only collision
    // guard is the narrow panel-vs-existing-cabinet check below; sending them
    // through the generic cabinet-body collision path re-rejects valid corner
    // placements after the panel fitter has already found clear run space.
    if (shiftedAdditions
      .filter((item) => !isRefrigeratorEndPanel(item))
      .some((item) => cabinetPlacementCollisionDetail(item, peers, room))) return null;
    if (shiftedAdditions
      .filter(isRefrigeratorEndPanel)
      .some((panel) => refrigeratorEndPanelConflictDetail(panel, peers, refrigeratorUid, room))) return null;
    return {
      existing: existing.map((item) => item.uid === refrigeratorUid ? shiftedRefrigerator : item),
      additions: shiftedAdditions,
      shiftIn,
    };
  };

  // Preserve an already valid placement exactly; fitting is only corrective.
  const unchanged = fittedAt(0);
  if (unchanged) return unchanged;

  // First attempt exact known boundary/panel-overlap displacements. This is the
  // common case and preserves the source geometry without an arbitrary nudge.
  for (const shiftIn of candidateShifts) {
    const result = fittedAt(shiftIn);
    if (result) return result;
  }

  // A normal base/tall cabinet can create a real collision that is not a
  // refrigerator-panel-specific conflict (for example B24 ends exactly at the
  // appliance but overlaps the panel's 3/4-in thickness). Walk the same 1/8-in
  // grid used by Designer drag placement to find the nearest safe displacement.
  // Only the newly configured refrigerator/options move; `peers` are immutable.
  const maximumPositive = Math.max(0, runLength - enclosureEnd);
  const maximumNegative = Math.max(0, enclosureStart);
  const maxSteps = Math.ceil(Math.max(maximumPositive, maximumNegative) * 8 - COLLISION_EPSILON_IN);
  for (let step = 1; step <= maxSteps; step += 1) {
    const distance = step / 8;
    if (distance <= maximumPositive + COLLISION_EPSILON_IN) {
      const result = fittedAt(distance);
      if (result) return result;
    }
    if (distance <= maximumNegative + COLLISION_EPSILON_IN) {
      const result = fittedAt(-distance);
      if (result) return result;
    }
  }
  return { existing, additions, shiftIn: 0 };
}

export function appendRefrigeratorEnclosurePlacements(
  existing: PlacedCabinet[],
  additions: PlacedCabinet[],
  refrigeratorUid?: string | null,
  room?: RoomData | null,
): RefrigeratorEnclosurePlacementResult {
  const panelConflicts = additions.flatMap((panel) => {
    const detail = refrigeratorEndPanelConflictDetail(panel, existing, refrigeratorUid, room);
    return detail ? [detail] : [];
  });
  const blockedPanelUids = new Set(panelConflicts.map(({ panel }) => panel.uid));
  // Every member must lie inside its wall run. A right panel whose offset runs
  // past the end of a short drawn wall is not "placed"; it is rejected here so
  // the caller reports it instead of committing a bay with a part off the wall.
  const refrigerator = refrigeratorUid ? existing.find((item) => item.uid === refrigeratorUid) ?? null : null;
  const offRun = new Set<string>();
  if (room && refrigerator) {
    const side = cabinetWall(refrigerator, room);
    const runLength = wallLength(side, room);
    for (const addition of additions) {
      const start = addition.wallId === side && Number.isFinite(Number(addition.wallOffset))
        ? Number(addition.wallOffset)
        : wallRunOffset(addition, side, room);
      const span = wallRunSpan(addition, side, room);
      if (start < -COLLISION_EPSILON_IN || start + span > runLength + COLLISION_EPSILON_IN) offRun.add(addition.uid);
    }
  }
  const allowedAdditions = additions.filter((addition) => !blockedPanelUids.has(addition.uid) && !offRun.has(addition.uid));
  const panels = allowedAdditions.filter(isRefrigeratorEndPanel);
  const ordinaryAdditions = allowedAdditions.filter((addition) => !isRefrigeratorEndPanel(addition));
  const appended = appendCollisionFreePlacements(existing, ordinaryAdditions, room ?? undefined);
  const blockedPanels = additions.filter((addition) => blockedPanelUids.has(addition.uid) || offRun.has(addition.uid));
  return {
    placed: [...appended.placed, ...panels],
    rejected: [...blockedPanels, ...appended.rejected],
    panelConflicts,
  };
}

function verticalEnvelopesOverlap(a: PlacedCabinet, b: PlacedCabinet): boolean {
  const aBox = elevationBox(a);
  const bBox = elevationBox(b);
  const tolerance = 0.01;
  return (
    aBox.bottom < bBox.bottom + bBox.height - tolerance &&
    aBox.bottom + aBox.height > bBox.bottom + tolerance
  );
}

/**
 * Finds the mount height for a short bridge spanning a window, when that bridge
 * can clear the opening by the required clearance and remain below the ceiling.
 */
export function bridgeMountBottomAboveWindow(
  cabinet: PlacedCabinet,
  openings: WallOpening[],
  room: RoomData,
  clearance = WALL_OPENING_CLEARANCE_IN,
): number | null {
  if (cabinet.placement !== "wall" || placedHeight(cabinet) >= 30) return null;
  const side = cabinetWall(cabinet, room);
  const horizontal = side === "top" || side === "bottom";
  const size = rotatedSize(cabinet);
  const start = horizontal ? cabinet.x : cabinet.y;
  const end = start + (horizontal ? size.w : size.d);
  const windows = openings.filter((opening) => {
    if (opening.kind !== "window" || opening.side !== side) return false;
    return start < opening.offset + opening.width - 0.01 && end > opening.offset + 0.01;
  });
  if (windows.length === 0) return null;
  const bottom = Math.max(...windows.map((opening) => opening.sill + opening.height + clearance));
  const ceiling = room.ceilingHeight ?? 96;
  return bottom + placedHeight(cabinet) <= ceiling + 0.01 ? bottom : null;
}

/**
 * Returns the run-axis start that centers a short wall cabinet over a sink
 * base. A matching window is not required: an over-sink cabinet must remain
 * centered above the sink whether the wall has a window or not.
 */
export function overSinkWindowStart(
  cabinet: PlacedCabinet,
  placed: PlacedCabinet[],
  openings: WallOpening[],
  room: RoomData,
): number | null {
  if (cabinet.placement !== "wall" || placedHeight(cabinet) >= 30) return null;
  const side = cabinetWall(cabinet, room);
  const horizontal = side === "top" || side === "bottom";
  const cabinetSize = rotatedSize(cabinet);
  const cabinetSpan = horizontal ? cabinetSize.w : cabinetSize.d;
  const wallLength = horizontal ? room.width : room.depth;
  const shortCabinetCenter = (horizontal ? cabinet.x + cabinetSize.w / 2 : cabinet.y + cabinetSize.d / 2);
  const matchingSinks = placed.filter((item) => isSinkBaseCabinet(item) && cabinetWall(item, room) === side);
  if (matchingSinks.length === 0) return null;
  const sinkBase = matchingSinks.reduce((nearest, item) => {
    const itemSize = rotatedSize(item);
    const itemCenter = horizontal ? item.x + itemSize.w / 2 : item.y + itemSize.d / 2;
    const nearestSize = rotatedSize(nearest);
    const nearestCenter = horizontal ? nearest.x + nearestSize.w / 2 : nearest.y + nearestSize.d / 2;
    return Math.abs(itemCenter - shortCabinetCenter) < Math.abs(nearestCenter - shortCabinetCenter) ? item : nearest;
  });
  const sinkSize = rotatedSize(sinkBase);
  const sinkCenter = horizontal ? sinkBase.x + sinkSize.w / 2 : sinkBase.y + sinkSize.d / 2;
  const centeredStart = sinkCenter - cabinetSpan / 2;
  return Math.max(0, Math.min(centeredStart, Math.max(0, wallLength - cabinetSpan)));
}

/**
 * An explicitly selected sink base is a deliberate target. A short wall
 * cabinet chosen next is centered over that sink on the sink's own wall instead
 * of entering the generic selected-wall sequence. When no eligible sink is
 * selected, callers fall back to the normal left-to-right placement rule.
 */
export function selectedSinkBaseWallPlacement(
  selected: PlacedCabinet | null | undefined,
  room: RoomData,
  width: number,
  depth: number,
  height: number,
  placed: PlacedCabinet[] = [],
  openings: WallOpening[] = [],
): { x: number; y: number; rotation: number } | null {
  if (!selected || !isSinkBaseCabinet(selected) || selected.placement !== "base") return null;
  const side = cabinetWall(selected, room);
  const horizontal = side === "top" || side === "bottom";
  const sinkFootprint = placedFootprint(selected);
  const sinkStart = horizontal ? selected.x : selected.y;
  const sinkSpan = horizontal ? sinkFootprint.w : sinkFootprint.d;
  const wallLength = horizontal ? room.width : room.depth;
  const centeredStart = Math.max(0, Math.min(sinkStart + sinkSpan / 2 - width / 2, Math.max(0, wallLength - width)));
  const centeredSpot = wallPlacementAt(centeredStart, width, depth, side, room);
  const candidate: PlacedCabinet = {
    ...selected,
    uid: "__selected-sink-wall-target__",
    masterCode: "SELECTED-SINK-WALL-TARGET",
    placement: "wall",
    ...centeredSpot,
    width,
    depth,
    height,
    mountBottom: height < 30 ? OVER_SINK_WALL_MOUNT_BOTTOM : WALL_MOUNT_BOTTOM,
  };
  const samePlanWithoutSink = placed.filter((cabinet) => cabinet.uid !== selected.uid);
  const available = freeSegmentsOnWall(
    side,
    room,
    samePlanWithoutSink,
    openings,
    width,
    WALL_OPENING_CLEARANCE_IN,
    "wall",
    false,
    candidate,
  );
	  const fittedStart = nearestAvailableWallStart(available, centeredStart, width);
	  if (fittedStart == null) return null;
	  const fittedEnd = fittedStart + width;
	  const sinkEnd = sinkStart + sinkSpan;
	  const alignedSpan = Math.max(0, Math.min(fittedEnd, sinkEnd) - Math.max(fittedStart, sinkStart));
	  const minimumAlignedSpan = Math.min(width, sinkSpan) / 2;
	  if (alignedSpan + COLLISION_EPSILON_IN < minimumAlignedSpan) return null;
	  const fittedSpot = wallPlacementAt(fittedStart, width, depth, side, room);
	  const fittedCandidate = { ...candidate, ...fittedSpot };
  if (hasCollision(fittedCandidate, placed)) return null;
  return fittedSpot;
}

/**
 * Centers a new sink base below an existing window on the active wall.  The
 * window owns the design intent: the cabinet's run center is made identical to
 * the window center, while the usual collision rules retain the real cabinet
 * body and all adjoining corner reservations.  A manual drag remains manual;
 * callers use this only for a normal catalog placement with no explicit point.
 */
export function sinkBaseWindowPlacement(
  side: WallSide,
  room: RoomData,
  width: number,
  depth: number,
  height: number,
  placed: PlacedCabinet[] = [],
  openings: WallOpening[] = [],
): {
  openingUid: string;
  spot: { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number };
} | null {
  if (width <= 0 || depth <= 0) return null;
  const runLength = wallLength(side, room);
  if (runLength + COLLISION_EPSILON_IN < width) return null;
  const windows = openings
    .filter((opening) => opening.kind === "window" && opening.side === side)
    .sort((left, right) => left.offset - right.offset);
  for (const window of windows) {
    const centeredStart = Math.max(
      0,
      Math.min(window.offset + window.width / 2 - width / 2, Math.max(0, runLength - width)),
    );
    const spot = wallPlacementAt(centeredStart, width, depth, side, room);
    const candidate: PlacedCabinet = {
      uid: "__sink-base-window-target__",
      cabinetId: -1,
      masterCode: "SINK-BASE-WINDOW-TARGET",
      description: "Sink base centered under window",
      placement: "base",
      ...spot,
      width,
      depth,
      height,
      wallId: spot.wallId,
      wallOffset: spot.wallOffset,
    };
    if (!cabinetPlacementCollisionDetail(candidate, placed, room)) {
      return { openingUid: window.uid, spot };
    }
  }
  return null;
}

/**
 * Aligns a wall cabinet to the exact projection of an intentionally selected
 * lower cabinet or floor appliance. Unlike the sink-specific helper above, this
 * target never slides to a different upper opening: it returns null when the
 * selected lower run is too narrow, belongs to a corner, is a refrigerator, or
 * already has an upper occupying the same elevation band. This lets a user aim
 * W-36-24 at a clear 36-inch lower run without the earlier 24-inch upper gap
 * taking precedence.
 */
export function selectedLowerCabinetWallPlacement(
  selected: PlacedCabinet | null | undefined,
  room: RoomData,
  width: number,
  depth: number,
  height: number,
  placed: PlacedCabinet[] = [],
  openings: WallOpening[] = [],
): { x: number; y: number; rotation: number } | null {
  if (!selected || (selected.placement !== "base" && selected.placement !== "appliance")) return null;
  if (selected.placement === "appliance" && (isRefrigerator(selected) || isRangeOrOven(selected.masterCode, selected.description) || elevationBox(selected, room).bottom > COLLISION_EPSILON_IN)) return null;
  if (placedCornerGeometryKind(selected) !== "standard") return null;
  const side = cabinetWall(selected, room);
  // The lower's run offset and catalog width along its wall, on every wall kind.
  const lowerStart = wallRunOffset(selected, side, room);
  const lowerSpan = wallRunSpan(selected, side, room);
  if (width > lowerSpan + COLLISION_EPSILON_IN) return null;
  const runLength = wallLength(side, room);
  const centeredStart = Math.max(0, Math.min(lowerStart + lowerSpan / 2 - width / 2, Math.max(0, runLength - width)));
  const centeredSpot = wallPlacementAt(centeredStart, width, depth, side, room);
  const candidate: PlacedCabinet = {
    ...selected,
    uid: "__selected-lower-wall-target__",
    masterCode: "SELECTED-LOWER-WALL-TARGET",
    placement: "wall",
    ...centeredSpot,
    width,
    depth,
    height,
  };
  const available = freeSegmentsOnWall(
    side,
    room,
    placed,
    openings,
    width,
    WALL_OPENING_CLEARANCE_IN,
    "wall",
    false,
    candidate,
  );
  const exactProjectionIsClear = available.some((segment) => (
    centeredStart >= segment.start - COLLISION_EPSILON_IN
    && centeredStart + width <= segment.start + segment.length + COLLISION_EPSILON_IN
  ));
  if (exactProjectionIsClear && !hasCollision(candidate, placed)) return centeredSpot;

  // A lower box already seated at a real 45° vertex is the designer's explicit
  // alignment target. Older saved plans can legitimately have that box inside
  // the generic 11-inch first-cabinet hold. Do not slide its matching upper by
  // an inch merely because the *initial-placement* reserve starts at 11 inches:
  // retain the exact lower projection when it is inside this wall's measured
  // limits, clears actual upper geometry, and does not cross a wall opening.
  // This is deliberately narrow—normal unselected catalog placement still uses
  // the shared corner hold, and an occupied upper or opening still wins.
  const targetEnd = centeredStart + width;
  const crossesOpening = openings.some((opening) => (
    opening.side === side
    && centeredStart < opening.offset + opening.width - COLLISION_EPSILON_IN
    && targetEnd > opening.offset + COLLISION_EPSILON_IN
  ));
  const selectedRun = seatedWallRunFrame(selected, room);
  const isExactSelectedRunProjection = Boolean(
    selectedRun
    && selected.wallId === side
    && Math.abs(lowerStart - centeredStart) <= COLLISION_EPSILON_IN
    && centeredStart >= -COLLISION_EPSILON_IN
    && targetEnd <= selectedRun.length + COLLISION_EPSILON_IN,
  );
  if (isExactSelectedRunProjection && !crossesOpening && !cabinetPlacementCollisionDetail(candidate, placed, room)) {
    return centeredSpot;
  }
  return null;
}

/**
 * Seats a wall cabinet directly above a selected true corner base. The upper
 * shares the actual corner endpoint—not merely the base's screen bounding box—
 * so ERB36/diagonal corners stay aligned on custom, cardinal, and diagonal
 * continuous walls. A regular upper keeps its 12-inch depth while its outer
 * edge remains flush with the same vertex as the floor corner cabinet.
 */
export function selectedCornerBaseWallPlacement(
  selected: PlacedCabinet | null | undefined,
  room: RoomData,
  width: number,
  depth: number,
  height: number,
  placed: PlacedCabinet[] = [],
  openings: WallOpening[] = [],
): { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number } | null {
  if (!selected || selected.placement !== "base") return null;
  if (!isCornerCabinet(selected.masterCode, selected.description) || isBlindCorner(selected.masterCode, selected.description)) return null;

  const side = cabinetWall(selected, room);
  const runLength = wallLength(side, room);
  const selectedStart = wallRunOffset(selected, side, room);
  const selectedEnd = selectedStart + wallRunSpan(selected, side, room);
  const cornerAtRunEnd = selectedEnd >= runLength - COLLISION_EPSILON_IN;
  const alignedStart = cornerAtRunEnd ? Math.max(0, runLength - width) : 0;
  const spot = wallPlacementAt(alignedStart, width, depth, side, room);
  const candidate: PlacedCabinet = {
    ...selected,
    uid: "__selected-corner-base-wall-target__",
    masterCode: "SELECTED-CORNER-BASE-WALL-TARGET",
    placement: "wall",
    ...spot,
    width,
    depth,
    height,
    wallId: spot.wallId ?? selected.wallId,
    wallOffset: spot.wallOffset ?? alignedStart,
  };
  const available = freeSegmentsOnWall(
    side,
    room,
    placed,
    openings,
    width,
    WALL_OPENING_CLEARANCE_IN,
    "wall",
    false,
    candidate,
  );
  const exactCornerProjectionIsClear = available.some((segment) => (
    alignedStart >= segment.start - COLLISION_EPSILON_IN
    && alignedStart + width <= segment.start + segment.length + COLLISION_EPSILON_IN
  ));
  if (!exactCornerProjectionIsClear || cabinetPlacementCollisionDetail(candidate, placed, room)) return null;
  return spot;
}

/**
 * Finds the first clear lower run whose physical span matches the requested
 * upper width. This is the deterministic click-to-add counterpart to an
 * explicit 2D/3D drop on a lower cabinet: occupied projections are skipped,
 * and no unrelated lower width is guessed or centered automatically.
 */
export function matchingLowerCabinetWallPlacement(
  side: WallSide,
  room: RoomData,
  width: number,
  depth: number,
  height: number,
  placed: PlacedCabinet[] = [],
  openings: WallOpening[] = [],
): { targetUid: string; spot: { x: number; y: number; rotation: number } } | null {
  const horizontal = side === "top" || side === "bottom";
  const candidates = placed
    .filter((cabinet) => (cabinet.placement === "base" || cabinet.placement === "appliance") && cabinetWall(cabinet, room) === side)
    .filter((cabinet) => {
      if (cabinet.placement === "appliance" && (isRefrigerator(cabinet) || isRangeOrOven(cabinet.masterCode, cabinet.description) || elevationBox(cabinet, room).bottom > COLLISION_EPSILON_IN)) return false;
      if (placedCornerGeometryKind(cabinet) !== "standard") return false;
      return Math.abs(wallRunSpan(cabinet, side, room) - width) <= 0.5;
    })
    .sort((left, right) => wallRunOffset(left, side, room) - wallRunOffset(right, side, room));
  for (const candidate of candidates) {
    const spot = selectedLowerCabinetWallPlacement(candidate, room, width, depth, height, placed, openings);
    if (spot) return { targetUid: candidate.uid, spot };
  }
  return null;
}

/**
 * A short cabinet directly above a sink is bottom-mounted at 70 inches from
 * the finished floor. It is raised only when a window on that same wall/run
 * requires the minimum three-inch opening clearance.
 */
export function overSinkWallMountBottom(
  cabinet: PlacedCabinet,
  placed: PlacedCabinet[],
  openings: WallOpening[],
  room: RoomData,
): number | null {
  if (cabinet.placement !== "wall" || placedHeight(cabinet) >= 30) return null;
  const centeredStart = overSinkWindowStart(cabinet, placed, openings, room);
  if (centeredStart == null) return null;
  const side = cabinetWall(cabinet, room);
  const horizontal = side === "top" || side === "bottom";
  const currentStart = horizontal ? cabinet.x : cabinet.y;
  if (Math.abs(currentStart - centeredStart) > 0.5) return null;
  return Math.max(OVER_SINK_WALL_MOUNT_BOTTOM, bridgeMountBottomAboveWindow(cabinet, openings, room) ?? 0);
}

export type OverSinkWindowClearanceMeasure = {
  side: WallSide;
  openingLabel: string;
  openingTop: number;
  clearance: number;
  requiredBottom: number;
  cabinetHeight: number;
  requiredTop: number;
  ceiling: number;
  shortage: number;
};

export function overSinkWindowClearanceMeasure(
  cabinet: PlacedCabinet,
  placed: PlacedCabinet[],
  openings: WallOpening[],
  room: RoomData,
  clearance = WALL_OPENING_CLEARANCE_IN,
): OverSinkWindowClearanceMeasure | null {
  if (cabinet.placement !== "wall" || placedHeight(cabinet) >= 30) return null;
  const centeredStart = overSinkWindowStart(cabinet, placed, openings, room);
  if (centeredStart == null) return null;
  const side = cabinetWall(cabinet, room);
  const horizontal = side === "top" || side === "bottom";
  const currentStart = horizontal ? cabinet.x : cabinet.y;
  if (Math.abs(currentStart - centeredStart) > 0.5) return null;
  const size = rotatedSize(cabinet);
  const span = horizontal ? size.w : size.d;
  const crossedWindows = openings.filter((opening) =>
    opening.kind === "window" &&
    opening.side === side &&
    currentStart < opening.offset + opening.width - 0.01 &&
    currentStart + span > opening.offset + 0.01,
  );
  if (crossedWindows.length === 0) return null;
  const limitingWindow = crossedWindows.reduce((highest, opening) => opening.sill + opening.height > highest.sill + highest.height ? opening : highest);
  const openingTop = limitingWindow.sill + limitingWindow.height;
  const requiredBottom = Math.max(OVER_SINK_WALL_MOUNT_BOTTOM, openingTop + clearance);
  const cabinetHeight = placedHeight(cabinet);
  const requiredTop = requiredBottom + cabinetHeight;
  const ceiling = room.ceilingHeight ?? 96;
  return { side, openingLabel: limitingWindow.label || "window", openingTop, clearance, requiredBottom, cabinetHeight, requiredTop, ceiling, shortage: Math.max(0, requiredTop - ceiling) };
}

/** Whether a short over-sink cabinet crosses a window that cannot clear below the ceiling. */
export function overSinkWindowClearanceBlocked(cabinet: PlacedCabinet, placed: PlacedCabinet[], openings: WallOpening[], room: RoomData): boolean {
  return (overSinkWindowClearanceMeasure(cabinet, placed, openings, room)?.shortage ?? 0) > 0.01;
}

/**
 * Repairs saved drafts after a window or sink base changes. A prior automatic
 * over-window mount must not leave the same short cabinet hovering at its old
 * ceiling-adjacent height once the window is removed.
 */
export function normalizeOverSinkWallMounts(
  placed: PlacedCabinet[],
  openings: WallOpening[],
  room: RoomData,
): PlacedCabinet[] {
  let changed = false;
  const normalized = placed.map((cabinet) => {
    if (cabinet.mountBottomAdjusted) return cabinet;
    const mountBottom = overSinkWallMountBottom(cabinet, placed, openings, room);
    if (mountBottom == null || cabinet.mountBottom === mountBottom) return cabinet;
    changed = true;
    return { ...cabinet, mountBottom };
  });
  return changed ? normalized : placed;
}

/** Repair old WD18 placements that inherited the generic 54-inch wall mount. */
export function normalizeWd18CountertopMounts(placed: PlacedCabinet[]): PlacedCabinet[] {
  let changed = false;
  const normalized = placed.map((cabinet) => {
    if (!isWd18CountertopDrawerCabinet(cabinet)) return cabinet;
    const storedBottom = typeof cabinet.mountBottom === "number" && cabinet.mountBottom >= 0
      ? cabinet.mountBottom
      : null;
    if (storedBottom != null && Math.abs(storedBottom - WALL_MOUNT_BOTTOM) > 0.01) return cabinet;
    if (storedBottom === STD.COUNTERTOP_HEIGHT) return cabinet;
    changed = true;
    return { ...cabinet, mountBottom: STD.COUNTERTOP_HEIGHT };
  });
  return changed ? normalized : placed;
}

/**
 * Restores the fixed room-wall elevation rule on saved layouts created while
 * ordinary upper cabinets could inherit a neighboring cabinet's top line.
 *
 * Standard room-wall cabinets start at 54 inches. The automatic exceptions
 * remain source/installation-specific: 12-inch wall boxes at 72 inches, WD18
 * countertop cabinets, stackers, refrigerator uppers at 72 inches, appliance
 * garages on the countertop, and a short cabinet that must clear a real
 * sink/window opening. A customer-set vertical move is explicitly marked and
 * is never rewritten here.
 */
export function normalizeStandardWallMounts(
  placed: PlacedCabinet[],
  openings: WallOpening[],
  room: RoomData,
): PlacedCabinet[] {
  let changed = false;
  const normalized = placed.map((cabinet) => {
    // An MW-30 companion is an installation-specific wall cabinet, not an
    // ordinary upper. Preserve the fixed 72-inch bridge datum for newly added
    // bridges and recover older saved bridges that predate the ownership flag.
    if (isOverRangeMicrowaveBridge(cabinet, placed, room)) {
      if (
        typeof cabinet.mountBottom === "number"
        && Math.abs(cabinet.mountBottom - OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM) <= 0.01
        && cabinet.mountBottomAdjusted
        && cabinet.overRangeMicrowaveBridge
      ) return cabinet;
      changed = true;
      return {
        ...cabinet,
        mountBottom: OVER_RANGE_MICROWAVE_BRIDGE_MOUNT_BOTTOM,
        mountBottomAdjusted: true,
        overRangeMicrowaveBridge: true,
      };
    }
    if (
      cabinet.placement !== "wall"
      || cabinet.islandFace
      || cabinet.mountBottomAdjusted
      || cabinet.spiceStackParentUid
      || isWd18CountertopDrawerCabinet(cabinet)
      || isStacker(cabinet)
    ) return cabinet;

    if (isRefrigeratorWallCabinet(cabinet)) {
      if (typeof cabinet.mountBottom === "number" && Math.abs(cabinet.mountBottom - 72) <= 0.01) return cabinet;
      changed = true;
      return { ...cabinet, mountBottom: 72 };
    }

    const haystack = `${cabinet.subCategory ?? ""} ${cabinet.description ?? ""} ${cabinet.masterCode ?? ""}`.toLowerCase();
    if (/appliance garage|\bag-?\d/.test(haystack)) return cabinet;

    // A verified sink/window clearance is an installation necessity, not an
    // inherited run height. Preserve and repair that exact computed datum.
    const requiredWindowBottom = overSinkWallMountBottom(cabinet, placed, openings, room);
    const targetBottom = requiredWindowBottom ?? ordinaryWallMountBottom(cabinet);
    if (typeof cabinet.mountBottom === "number" && Math.abs(cabinet.mountBottom - targetBottom) <= 0.01) return cabinet;
    changed = true;
    return { ...cabinet, mountBottom: targetBottom };
  });
  return changed ? normalized : placed;
}

/** Whether a wall cabinet crosses a window only after clearing it vertically. */
export function wallCabinetClearsWindow(
  cabinet: PlacedCabinet,
  opening: WallOpening,
  room: RoomData,
  clearance = WALL_OPENING_CLEARANCE_IN,
): boolean {
  if (cabinet.placement !== "wall" || opening.kind !== "window") return false;
  const side = cabinetWall(cabinet, room);
  if (opening.side !== side) return false;
  const start = wallRunOffset(cabinet, side, room);
  const end = start + wallRunSpan(cabinet, side, room);
  const crossesWindow = start < opening.offset + opening.width - 0.01 && end > opening.offset + 0.01;
  return crossesWindow && !windowVerticallyOverlapsCabinet(cabinet, opening, room, clearance);
}

// Footprint rectangle (rotation-aware) for a placed item.
function footprintRect(p: PlacedCabinet): { x1: number; y1: number; x2: number; y2: number } {
  const { w, d } = placedFootprint(p);
  return { x1: p.x, y1: p.y, x2: p.x + w, y2: p.y + d };
}

// Do two placed items overlap in plan? Uses a small tolerance so cabinets that
// merely touch edge-to-edge (a normal, valid run) are NOT treated as overlapping.
function footprintsOverlap(a: PlacedCabinet, b: PlacedCabinet, tol = 0.5): boolean {
  const ra = footprintRect(a);
  const rb = footprintRect(b);
  return (
    ra.x1 < rb.x2 - tol &&
    ra.x2 > rb.x1 + tol &&
    ra.y1 < rb.y2 - tol &&
    ra.y2 > rb.y1 + tol
  );
}

// Conflict detection: an APPLIANCE physically running into a CABINET.
// Appliances (range, fridge, dishwasher, sink, hood, microwave) must sit in
// their own opening; if an appliance footprint overlaps a real cabinet box the
// design is not buildable, so both items are flagged as a conflict.
//
// Wall-mounted items (wall cabinets, hood, over-range microwave) only conflict
// with other wall/over-counter items, and floor items only with floor items, so
// an upper cabinet sitting "above" a base appliance in plan is not a conflict.
function occupiesUpperZone(p: PlacedCabinet): boolean {
  if (p.placement === "wall") return true;
  // Hoods and over-range microwaves hang above the counter.
  return /^(HOOD|MW)-/.test((p.masterCode || "").toUpperCase());
}

// A cabinet is "on the island" when its footprint center sits inside the island
// rectangle. Used so dragging the island carries its cabinets along.
export function isOnIsland(
  p: PlacedCabinet,
  island: { x: number; y: number; width: number; depth: number }
): boolean {
  if (p.islandFace) return true;
  const { w, d } = rotatedSize(p);
  const cx = p.x + w / 2;
  const cy = p.y + d / 2;
  return (
    cx >= island.x &&
    cx <= island.x + island.width &&
    cy >= island.y &&
    cy <= island.y + island.depth
  );
}

// A sink BASE cabinet (e.g. SB-36, "Sink Base 36"). Detected from
// subCategory / description / masterCode so it works for placed items and
// catalog rows alike.
export function isSinkBaseCabinet(c: {
  description?: string | null;
  masterCode?: string | null;
  subCategory?: string | null;
}): boolean {
  // The DESCRIPTION is the reliable signal across distributors. Code prefixes
  // are deliberately conservative because several families collide with
  // non-sink cabinets (verified against the live catalog):
  //   - LSB = "Base Easy Reach with Lazy Susan" (NOT a sink)
  //   - VA-30 = "Vanity Sink Base" (IS) but VA-48 = "Arched Valance" (NOT)
  //   - BFH-30 = "Vanity Sink Cabinet" (IS) but BFH-18 = "Full Height Base" (NOT)
  // So we only trust unambiguous code stems and otherwise defer to the text.
  const hay = `${c.subCategory ?? ""} ${c.description ?? ""}`.toLowerCase();
  const descIsSink =
    /\bsink\s*base\b/.test(hay) ||                      // "Sink Base", "Corner Sink Base"
    /\bvanity\s*sink\b/.test(hay) ||                    // "Vanity Sink Base"
    /\bsink\s*(?:floor|front)\b/.test(hay) ||           // "Diagonal Sink Floor"
    /\b(?:farm(?:house)?|apron)\b[^.]*\bsink\b/.test(hay) ||
    /\bsink\b[^.]*\b(?:base|cabinet|floor|front)\b/.test(hay);
  if (descIsSink) return true;
  // Unambiguous sink-base code stems only (each requires a following size digit
  // or end, and none collide with the non-sink families above):
  //   SB-36, FSB-30, CSB-36, SBF-42-42, VSD-36, ADA-SB-33R, ADA-VS-30, ADA-VSD-48
  const code = (c.masterCode ?? "").toUpperCase();
  return (
    /^(?:ADA-)?F?SB[-_ ]?\d/.test(code) || // SB / FSB + size
    /^CSB[-_ ]?\d/.test(code) ||           // corner sink base
    /^(?:UV-)?SBF[-_ ]?\d/.test(code) ||   // sink base front / sink floor
    /^(?:ADA-)?VSD?[-_ ]?\d/.test(code) || // vanity sink (drawer) base
    /^ADA-SB[-_ ]?\d/.test(code)           // ADA sink base
  );
}

/** True for farm/farmhouse sink bases that must resolve through the active-wall palette path. */
export function isFarmSinkBasePaletteItem(c: {
  masterCode?: string | null;
  description?: string | null;
  subCategory?: string | null;
}): boolean {
  if (!isSinkBaseCabinet(c)) return false;
  const code = `${c.masterCode ?? ""}`.toLowerCase();
  const hay = `${c.description ?? ""} ${c.subCategory ?? ""}`.toLowerCase();
  return /^fsb[-_]?\d/.test(code) || /farm(?:house)?\s+sink/.test(hay);
}

/** A sink fixture belongs to a sink base when its center lies inside that cabinet's true footprint. */
export function fixtureIsOnCabinetFootprint(
  fixture: { x: number; y: number; width: number; depth: number },
  cabinet: PlacedCabinet,
): boolean {
  const footprint = placedFootprint(cabinet);
  const centerX = fixture.x + fixture.width / 2;
  const centerY = fixture.y + fixture.depth / 2;
  return (
    centerX >= cabinet.x && centerX <= cabinet.x + footprint.w &&
    centerY >= cabinet.y && centerY <= cabinet.y + footprint.d
  );
}

/** Exact sink-base ownership is authoritative; footprint matching preserves legacy saved fixtures. */
export function fixtureBelongsToCabinet(fixture: SinkFixture, cabinet: PlacedCabinet): boolean {
  return fixture.cabinetUid === cabinet.uid || fixtureIsOnCabinetFootprint(fixture, cabinet);
}

/**
 * Returns true if the cabinet is a farmer's / apron-front sink base (FSB-*).
 * These have an exposed apron face below the countertop and no bottom rail.
 */
export function isFarmerSinkBase(c: {
  description?: string | null;
  masterCode?: string | null;
  subCategory?: string | null;
}): boolean {
  const hay = `${c.subCategory ?? ""} ${c.description ?? ""}`.toLowerCase();
  const descMatch =
    /\b(?:farm(?:house)?|apron)\b[^.]*\bsink\b/.test(hay) ||
    /\bsink\b[^.]*\b(?:farm(?:house)?|apron)\b/.test(hay);
  if (descMatch) return true;
  const code = (c.masterCode ?? "").toUpperCase();
  // FSB-30, FSB-33, FSB-36, ADA-FSB-30, etc.
  return /^(?:ADA-)?FSB[-_ ]?\d/.test(code);
}

// A sink FIXTURE placed as an appliance (the SINK-33 palette entry). The kitchen
// sink naturally sits INSIDE the sink-base cabinet, so a sink appliance over a
// sink base is expected — never a conflict.
export function isSinkAppliance(c: {
  description?: string | null;
  masterCode?: string | null;
}): boolean {
  const code = (c.masterCode ?? "").toUpperCase();
  if (code.startsWith("SINK")) return true;
  return /\bsink\b/.test((c.description ?? "").toLowerCase());
}

// An over-range microwave (MW-*) hangs above the counter in the upper zone. A
// short bridge may intentionally sit above that microwave. A wall-mounted hood
// is different: its complete plan/elevation span remains reserved and must not
// be shared by a cabinet or cabinet part.
export function isOverRangeAppliance(p: {
  masterCode?: string | null;
  placement?: Placement;
}): boolean {
  if (p.placement !== "appliance") return false;
  return /^MW-/.test((p.masterCode || "").toUpperCase());
}

// True when `a` and `b` form the intended bridge-over-microwave pairing. Range
// hoods are deliberately excluded because their complete wall span is occupied.
export function isBridgeOverRange(a: PlacedCabinet, b: PlacedCabinet): boolean {
  const wallBridge = (x: PlacedCabinet) => x.placement === "wall";
  return (
    (wallBridge(a) && isOverRangeAppliance(b)) ||
    (wallBridge(b) && isOverRangeAppliance(a))
  );
}

export function conflictingUids(placed: PlacedCabinet[], room?: RoomData): Set<string> {
  const conflicts = new Set<string>();
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i];
      const b = placed[j];
      // At least one must be an appliance for an appliance-in-cabinet conflict.
      const oneAppliance = a.placement === "appliance" || b.placement === "appliance";
      if (!oneAppliance) continue;
      // Don't flag two appliances against each other (e.g. hood over range).
      if (a.placement === "appliance" && b.placement === "appliance") continue;
      // EXEMPTION: a sink appliance sitting over a sink-base cabinet is the
      // intended layout (the sink drops INTO the sink base), so it must never be
      // flagged as a conflict.
      const sinkOverSinkBase =
        (isSinkAppliance(a) && isSinkBaseCabinet(b)) ||
        (isSinkAppliance(b) && isSinkBaseCabinet(a));
      if (sinkOverSinkBase) continue;
      const cooktopOverOwnBase = (cooktop: PlacedCabinet, base: PlacedCabinet) => (
        cooktop.placement === "appliance"
        && cooktop.applianceRole === "countertop-opening"
        && cooktop.uid === `${base.uid}:cooktop`
        && base.placement === "base"
        && Math.abs(cooktop.x - base.x) < COLLISION_EPSILON_IN
        && Math.abs(cooktop.y - base.y) < COLLISION_EPSILON_IN
        && Math.abs(cooktop.width - base.width) < COLLISION_EPSILON_IN
        && Math.abs(cooktop.depth - base.depth) < COLLISION_EPSILON_IN
      );
      if (cooktopOverOwnBase(a, b) || cooktopOverOwnBase(b, a)) continue;
      // EXEMPTION: a bridge (short) wall cabinet mounted over an over-range
      // microwave/hood is the intended layout, so it must never be flagged.
      if (isBridgeOverRange(a, b)) continue;
      // A floor refrigerator is tall enough to occupy the wall-cabinet band;
      // standard base appliances remain below it.
      if (!verticalEnvelopesOverlap(a, b)) continue;
      // A 45° continuous-wall run is stored as an axis-aligned plan envelope.
      // Two cabinets can share that envelope while their physical along-wall
      // spans meet at exactly one edge. When room geometry is available, use
      // the same wall-aware collision gate used for placement and 3D movement;
      // retain the legacy rectangle fallback for callers without a room.
      const physicalOverlap = room
        ? cabinetPlacementCollisionDetail(a, [b], room) != null
        : footprintsOverlap(a, b);
      if (physicalOverlap) {
        conflicts.add(a.uid);
        conflicts.add(b.uid);
      }
    }
  }
  return conflicts;
}

// Blind corner rule: a blind corner cabinet needs a 3" filler on its blind side,
// which means the ADJACENT cabinet on the perpendicular run must be pulled at
// least 3" off the corner so the blind cabinet's door can clear. If a neighbor
// butts up against the blind cabinet's blind edge closer than 3", the layout is
// not buildable. Returns the uids of blind corner cabinets whose required pull
// is violated (so they can be flagged). Detection of "blind corner" is driven by
// the product description / code via isBlindCorner.
export function blindCornerViolations(
  placed: PlacedCabinet[],
  fillerIn = BLIND_CORNER_FILLER_WIDTH_IN
): Set<string> {
  const bad = new Set<string>();
  const blinds = placed.filter((p) => isBlindCorner(p.masterCode, p.description));
  for (const blind of blinds) {
    const rb = footprintRect(blind);
    for (const o of placed) {
      if (o.uid === blind.uid) continue;
      if (isBlindCorner(o.masterCode, o.description)) continue;
	      // A filler is trim, not the perpendicular cabinet body measured by
	      // the blind-corner pull-clearance rule.
	      if (isFillerItem(o)) continue;
      // A 3-inch-or-smaller filler is the required trim return beside a BBC,
      // not the perpendicular cabinet that the pull-clearance rule measures.
      // It must not reintroduce a red conflict after placement or restore.
      if (isRequiredBlindCornerFillerJoinPeer(o, blind)) continue;
      // Only same vertical zone neighbors matter (base-vs-base, wall-vs-wall).
      if (occupiesUpperZone(o) !== occupiesUpperZone(blind)) continue;
      const ro = footprintRect(o);
      // Perpendicular neighbor whose run approaches the blind cabinet's corner.
      // Vertical adjacency: neighbor sits beside the blind cab along x, with
      // overlapping y-extent — the gap between their facing edges must be >= filler.
      const yOverlap = rb.y1 < ro.y2 && rb.y2 > ro.y1;
      const xOverlap = rb.x1 < ro.x2 && rb.x2 > ro.x1;
      if (yOverlap && !xOverlap) {
        const gap = ro.x1 >= rb.x2 ? ro.x1 - rb.x2 : rb.x1 - ro.x2;
        if (gap >= -0.5 && gap < fillerIn - 0.01) bad.add(blind.uid);
      } else if (xOverlap && !yOverlap) {
        const gap = ro.y1 >= rb.y2 ? ro.y1 - rb.y2 : rb.y1 - ro.y2;
        if (gap >= -0.5 && gap < fillerIn - 0.01) bad.add(blind.uid);
      }
    }
  }
  return bad;
}

const GLASS_STACKER_HEIGHTS = new Set([12, 15, 18, 21, 24]);

function glassStackerHeight(p: { height?: number | string | null; masterCode?: string | null }): number | null {
  const explicit = Number(p.height);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const pairs = ((p.masterCode ?? "").toUpperCase().match(/\d{2}/g) ?? []).map(Number);
  const inferred = pairs[pairs.length - 1];
  return Number.isFinite(inferred) ? inferred : null;
}

/**
 * Structural family identity for a short glass wall stacker and the wall
 * cabinet it can sit above. This is deliberately narrower than a width match:
 * a DCW/WDC diagonal corner stacker must never be used above a straight wall
 * cabinet just because both products are 24 inches wide.
 */
export function glassStackerFamily(p: { masterCode?: string | null }): "WDC" | "W" | null {
  const code = (p.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  // Supplier catalogs use both WDC-2412GD and DCW2412GD for the same diagonal
  // wall-corner stacker family. Keep those identities together, but never let
  // either one stack above a conventional straight W24 wall cabinet.
  if (code.includes("WDC") || code.includes("DCW")) return "WDC";
  if (code.startsWith("W") || /^GD?S\d/.test(code)) return "W";
  return null;
}

// Every 12", 15", 18", 21", or 24" glass wall cabinet is a stacker: it sits
// directly ON TOP of a same-width cabinet from its respective wall family. This
// includes both conventional W3012GD/W3012PG identities and distributor formats
// such as 2412WDCGD. Taller glass wall cabinets remain normal wall cabinets.
export function isStacker(p: { description?: string | null; masterCode?: string | null; subCategory?: string | null; height?: number | string | null }): boolean {
  const hay = `${p.subCategory ?? ""} ${p.description ?? ""} ${p.masterCode ?? ""}`.toLowerCase();
  const height = glassStackerHeight(p);
  const supportedHeight = height == null || GLASS_STACKER_HEIGHTS.has(height);
  const code = (p.masterCode ?? "").toUpperCase();
  const normalized = code.replace(/[^A-Z0-9]/g, "");
  const glassIdentity = normalized.endsWith("GD") || normalized.endsWith("PG") || /\bglass\b/.test(hay);
  const explicitGlassStackerCode = /^GD?S[-_ ]?\d/.test(code);
  // Text signals: "stacker", "glass stacker", "stacking"/"stacked".
  // A generic non-glass wall cabinet must never become a stacker only because a
  // stale catalog subcategory says "Bridge / Stacker". The physical stacking
  // rule is reserved for actual glass stackers.
  if (/\bstacker\b|\bstack(?:ing|ed)?\b|glass\s*stack/.test(hay)) return (glassIdentity || explicitGlassStackerCode) && supportedHeight;
  // Code signals: GS-* / GDS-* stacker families used across lines (e.g. GS-3012,
  // GDS-3015). Require a following size digit so we never match unrelated codes.
  if (explicitGlassStackerCode) return supportedHeight;
  return glassIdentity && height != null && GLASS_STACKER_HEIGHTS.has(height);
}

export type GlassStackerParentPlacementResult =
  | { ok: true; x: number; y: number; rotation: number; mountBottom: number; parentUid: string; parentCode: string }
  | { ok: false; reason: "not-stacker" | "no-matching-parent" | "ceiling"; parentCode?: string; requiredTop?: number; ceiling?: number };

export type GlassStackerParentPlacementOptions = {
  /**
   * Catalog-click mode. The stacker has no meaningful position yet (the add
   * flow only holds a placeholder spot, which falls back to the room centre
   * when the Back wall's upper row is full), so the parent is found from the
   * wall cabinets themselves, on whichever wall they hang: the selected
   * cabinet first, then a matching cabinet with no stacker yet (the active
   * wall first), then the nearest. Without this a perfectly good 36" wall
   * cabinet on the Back wall was rejected because the placeholder spot read
   * as the Front wall.
   */
  anyWall?: boolean;
  /** Wall to try first among otherwise equal parents (the Designer's active wall). */
  preferredSide?: WallSide | null;
};

/**
 * A shallow glass stacker above a deeper upper (most commonly a 12-inch glass
 * cabinet above a 24-inch refrigerator/corner upper) is packed out from the
 * wall so both cabinet faces finish flush. The space behind the stacker is a
 * concealed support/filler chase; it is rendered separately in 3D.
 */
export function glassStackerFrontFlushSpot(
  stacker: Pick<PlacedCabinet, "width" | "depth">,
  parent: PlacedCabinet,
  room: RoomData,
): { x: number; y: number; rotation: number } {
  const side = cabinetWall(parent, room);
  const parentFootprint = placedFootprint(parent);
  const parentRotation = ((Math.round(Number(parent.rotation) || 0) % 360) + 360) % 360;
  const stackerFootprint = parentRotation === 90 || parentRotation === 270
    ? { w: Number(stacker.depth), d: Number(stacker.width) }
    : { w: Number(stacker.width), d: Number(stacker.depth) };
  const parentCenter = {
    x: parent.x + parentFootprint.w / 2,
    y: parent.y + parentFootprint.d / 2,
  };
  const cardinalFront = side === "top"
    ? { x: 0, y: 1 }
    : side === "bottom"
      ? { x: 0, y: -1 }
      : side === "left"
        ? { x: 1, y: 0 }
        : side === "right"
          ? { x: -1, y: 0 }
          : null;
  const radians = Number(parent.rotation || 0) * Math.PI / 180;
  const front = cardinalFront ?? { x: Math.sin(radians), y: Math.cos(radians) };
  const parentDepth = Math.max(0.125, Number(parent.depth) || STD.WALL_DEPTH);
  const stackerDepth = Math.max(0.125, Number(stacker.depth) || STD.WALL_DEPTH);
  const frontCenter = {
    x: parentCenter.x + front.x * parentDepth / 2,
    y: parentCenter.y + front.y * parentDepth / 2,
  };
  const stackerCenter = {
    x: frontCenter.x - front.x * stackerDepth / 2,
    y: frontCenter.y - front.y * stackerDepth / 2,
  };
  return {
    x: stackerCenter.x - stackerFootprint.w / 2,
    y: stackerCenter.y - stackerFootprint.d / 2,
    rotation: parent.rotation,
  };
}

/**
 * Resolve the physical cabinet that a glass stacker belongs on. Matching is
 * strict by room wall, installed width, and cabinet family; a WDC glass stacker
 * cannot silently land on a standard W cabinet. The currently selected matching
 * parent wins, otherwise the nearest matching run position is used.
 *
 * A stacker is never rejected for being SHALLOWER than its parent: a 12-inch
 * deep glass stacker on a 24-inch deep wall cabinet (for example a 36x12x24
 * refrigerator wall cabinet) is valid. It is brought forward flush with the
 * parent's face by glassStackerFrontFlushSpot and a concealed false back fills
 * the 12-inch gap behind it.
 */
export function glassStackerParentPlacement(
  stacker: PlacedCabinet,
  placed: readonly PlacedCabinet[],
  room: RoomData,
  preferredParentUid?: string | null,
  options?: GlassStackerParentPlacementOptions,
): GlassStackerParentPlacementResult {
  if (stacker.placement !== "wall" || !isStacker(stacker)) return { ok: false, reason: "not-stacker" };
  const anyWall = options?.anyWall === true;
  const side = cabinetWall(stacker, room);
  const horizontal = side === "top" || side === "bottom";
  const stackerFamily = glassStackerFamily(stacker);
  const stackerWidth = Number(stacker.width);
  const stackerStart = horizontal ? stacker.x : stacker.y;
  const stackerCenter = stackerStart + stackerWidth / 2;
  const stackerFootprint = placedFootprint(stacker);
  const stackerPlanCenter = { x: stacker.x + stackerFootprint.w / 2, y: stacker.y + stackerFootprint.d / 2 };
  // A parent that already carries a stacker (explicit link, or a stacker sitting
  // right on its top) is the last choice in catalog-click mode, so a second
  // glass cabinet goes on the next free matching wall cabinet.
  const hasStacker = (parent: PlacedCabinet): boolean => {
    const parentFootprint = placedFootprint(parent);
    const parentElevation = elevationBox(parent, room);
    return placed.some((other) => {
      if (other.uid === stacker.uid || other.placement !== "wall" || !isStacker(other)) return false;
      if (other.stackedOnCabinetUid === parent.uid) return true;
      const otherFootprint = placedFootprint(other);
      const overlapW = Math.min(parent.x + parentFootprint.w, other.x + otherFootprint.w) - Math.max(parent.x, other.x);
      const overlapD = Math.min(parent.y + parentFootprint.d, other.y + otherFootprint.d) - Math.max(parent.y, other.y);
      if (overlapW <= 1 || overlapD <= 1) return false;
      return Math.abs(elevationBox(other, room).bottom - (parentElevation.bottom + parentElevation.height)) <= 0.5;
    });
  };
  const candidates = placed.filter((parent) => {
    if (parent.uid === stacker.uid || parent.placement !== "wall" || parent.islandFace || isStacker(parent)) return false;
    const parentSide = cabinetWall(parent, room);
    if (!isAgainstWall(parent, parentSide, room)) return false;
    if (!anyWall && parentSide !== side) return false;
    if (Math.abs(Number(parent.width) - stackerWidth) > 0.5) return false;
    const parentFamily = glassStackerFamily(parent);
    return stackerFamily == null || parentFamily === stackerFamily;
  }).map((parent) => ({ parent, parentSide: cabinetWall(parent, room), occupied: anyWall ? hasStacker(parent) : false }))
    .sort((left, right) => {
      if (anyWall && left.occupied !== right.occupied) return left.occupied ? 1 : -1;
      const leftPreferred = left.parent.uid === preferredParentUid ? 0 : 1;
      const rightPreferred = right.parent.uid === preferredParentUid ? 0 : 1;
      if (leftPreferred !== rightPreferred) return leftPreferred - rightPreferred;
      if (anyWall) {
        const wantedSide = options?.preferredSide ?? null;
        if (wantedSide) {
          const leftWall = left.parentSide === wantedSide ? 0 : 1;
          const rightWall = right.parentSide === wantedSide ? 0 : 1;
          if (leftWall !== rightWall) return leftWall - rightWall;
        }
        const planDistance = (candidate: PlacedCabinet) => {
          const footprint = placedFootprint(candidate);
          return Math.hypot(candidate.x + footprint.w / 2 - stackerPlanCenter.x, candidate.y + footprint.d / 2 - stackerPlanCenter.y);
        };
        return planDistance(left.parent) - planDistance(right.parent);
      }
      const leftStart = horizontal ? left.parent.x : left.parent.y;
      const rightStart = horizontal ? right.parent.x : right.parent.y;
      return Math.abs(leftStart + Number(left.parent.width) / 2 - stackerCenter) - Math.abs(rightStart + Number(right.parent.width) / 2 - stackerCenter);
    })
    .map((entry) => entry.parent);
  if (candidates.length === 0) return { ok: false, reason: "no-matching-parent" };
  let firstCeilingBlock: Extract<GlassStackerParentPlacementResult, { ok: false }> | null = null;
  for (const parent of candidates) {
    // Each parent is measured on ITS wall (a catalog click can pick a parent
    // on a different wall than the placeholder spot).
    const parentSide = cabinetWall(parent, room);
    const parentHorizontal = parentSide === "top" || parentSide === "bottom";
    const wallLengthIn = Math.max(1, parentHorizontal ? room.width : room.depth);
    const parentBox = elevationBox(parent, room);
    const mountBottom = parentBox.bottom + parentBox.height;
    const footprint = placedFootprint(parent);
    const start = parentHorizontal ? parent.x : parent.y;
    const span = parentHorizontal ? footprint.w : footprint.d;
    const ceiling = Math.min(
      wallCeilingAt(room, parentSide, start / wallLengthIn),
      wallCeilingAt(room, parentSide, (start + span) / wallLengthIn),
    );
    const requiredTop = mountBottom + placedHeight(stacker);
    if (requiredTop <= ceiling + COLLISION_EPSILON_IN) {
      const frontFlush = glassStackerFrontFlushSpot(stacker, parent, room);
      return {
        ok: true,
        x: frontFlush.x,
        y: frontFlush.y,
        rotation: frontFlush.rotation,
        mountBottom,
        parentUid: parent.uid,
        parentCode: parent.masterCode,
      };
    }
    firstCeilingBlock ??= { ok: false, reason: "ceiling", parentCode: parent.masterCode, requiredTop, ceiling };
  }
  return firstCeilingBlock ?? { ok: false, reason: "no-matching-parent" };
}

/** Repairs older saved stackers and keeps live plans flush when a parent moves. */
export function normalizeGlassStackersToParentFronts(placed: PlacedCabinet[], room: RoomData): PlacedCabinet[] {
  let changed = false;
  const normalized = placed.map((stacker) => {
    if (stacker.placement !== "wall" || !isStacker(stacker)) return stacker;
	    const placement = glassStackerParentPlacement(stacker, placed, room, stacker.stackedOnCabinetUid);
	    if (!placement.ok) return stacker;
	    const parent = placed.find((cabinet) => cabinet.uid === placement.parentUid);
	    const needsFrontDepthOverride = Boolean(parent && (Number(parent.depth) || STD.WALL_DEPTH) - (Number(stacker.depth) || STD.WALL_DEPTH) > 0.25);
	    if (
      Math.abs(stacker.x - placement.x) <= COLLISION_EPSILON_IN &&
      Math.abs(stacker.y - placement.y) <= COLLISION_EPSILON_IN &&
      Math.abs(Number(stacker.rotation) - placement.rotation) <= COLLISION_EPSILON_IN &&
      Math.abs(Number(stacker.mountBottom) - placement.mountBottom) <= COLLISION_EPSILON_IN &&
	      stacker.stackedOnCabinetUid === placement.parentUid &&
	      (!needsFrontDepthOverride || stacker.depthPositionAdjusted === true)
    ) return stacker;
    changed = true;
    return {
      ...stacker,
      x: placement.x,
      y: placement.y,
      rotation: placement.rotation,
      mountBottom: placement.mountBottom,
	      stackedOnCabinetUid: placement.parentUid,
	      ...(needsFrontDepthOverride ? { depthPositionAdjusted: true } : {}),
    };
  });
  return changed ? normalized : placed;
}

export type GlassStackerFrontSnapTarget = {
  x: number;
  y: number;
  rotation: number;
  mountBottom: number;
  parentUid: string;
  parentCode: string;
  gapDepth: number;
  alreadyAligned: boolean;
};

/** Eligibility and exact destination for the user-facing Snap to Front action. */
export function glassStackerFrontSnapTarget(
  stacker: PlacedCabinet,
  placed: PlacedCabinet[],
  room: RoomData,
): GlassStackerFrontSnapTarget | null {
  if (stacker.placement !== "wall" || !isStacker(stacker)) return null;
  const placement = glassStackerParentPlacement(stacker, placed, room, stacker.stackedOnCabinetUid);
  if (!placement.ok) return null;
  const parent = placed.find((cabinet) => cabinet.uid === placement.parentUid);
  if (!parent) return null;
  const gapDepth = (Number(parent.depth) || STD.WALL_DEPTH) - (Number(stacker.depth) || STD.WALL_DEPTH);
  if (gapDepth <= 0.25) return null;
  const alreadyAligned =
    Math.abs(stacker.x - placement.x) <= COLLISION_EPSILON_IN &&
    Math.abs(stacker.y - placement.y) <= COLLISION_EPSILON_IN &&
    Math.abs(Number(stacker.rotation) - placement.rotation) <= COLLISION_EPSILON_IN &&
    Math.abs(Number(stacker.mountBottom) - placement.mountBottom) <= COLLISION_EPSILON_IN &&
    stacker.depthPositionAdjusted === true;
  return { ...placement, gapDepth, alreadyAligned };
}

/**
 * WD1848 / WD1854 / WD1860 are the single-door countertop cabinet family:
 * an 18-inch-wide upper box with one tall door above two bottom drawers. The
 * no-dash identity intentionally excludes ordinary WD-18-xx double-door wall
 * cabinets, which remain standard 54-inch-mounted uppers.
 */
export function isWd18CountertopDrawerCabinet(p: {
  masterCode?: string | null;
  placement?: string | null;
}): boolean {
  if (p.placement != null && p.placement !== "wall") return false;
  return /^WD18(?:48|54|60)$/i.test((p.masterCode ?? "").trim());
}

export type Wd18CountertopFaceLayout = {
  doorHeight: number;
  drawerHeights: number[];
};

/** Physical WD18 face sections in inches, ordered top-to-bottom. */
export function wd18CountertopFaceLayout(
  p: { masterCode?: string | null; placement?: string | null; numberOfDrawers?: number | null },
  cabinetHeight: number,
): Wd18CountertopFaceLayout | null {
  if (!isWd18CountertopDrawerCabinet(p)) return null;
  const height = Math.max(1, cabinetHeight);
  const drawerCount = Math.max(1, Math.round(p.numberOfDrawers ?? 2));
  // The supplied product drawing shows two shallow lower drawers below the tall
  // door. Use a six-inch face for each drawer while retaining a usable door on
  // every 48-, 54-, and 60-inch family member.
  const drawerArea = Math.min(height * 0.45, drawerCount * 6);
  return {
    doorHeight: height - drawerArea,
    drawerHeights: Array.from({ length: drawerCount }, () => drawerArea / drawerCount),
  };
}

export function elevationBox(
  p: PlacedCabinet,
  room?: { ceilingHeight?: number } | null
): { bottom: number; height: number } {
  if (isFillerItem(p) && p.fillerMatchesFullOwnerEnvelope === true) {
    return {
      bottom: typeof p.mountBottom === "number" && p.mountBottom >= 0 ? p.mountBottom : 0,
      height: placedHeight(p),
    };
  }
  // Refrigerator enclosure panels are full architectural skins. They never
  // inherit a neighboring base cabinet's mount height or an arbitrary room
  // ceiling: their selected/source height is kept until assembly normalization
  // sizes the pair to the refrigerator bridge's physical cap.
  if (isRefrigeratorEndPanel(p)) {
    return { bottom: 0, height: placedHeight(p) };
  }
  // A shallow wall cabinet used on an island is a counter-height opposing face,
  // not a room-wall upper. Its top aligns with the adjoining base cabinet box.
  if (isCounterHeightIslandWallCabinet(p)) {
    const height = placedHeight(p);
    return { bottom: Math.max(0, STD.BASE_HEIGHT - height), height };
  }
  // Island cabinets and compatible parts build from the finished floor rather
  // than inheriting room-wall hanging defaults. A deliberate elevation edit is
  // retained through mountBottomAdjusted, including after save and restore.
  if (p.islandFace && p.mountBottomAdjusted !== true) {
    return { bottom: 0, height: placedHeight(p) };
  }
  // The top line the upper run finishes at. On a standard 8ft ceiling this is
  // the historical 84" line; on taller ceilings the run hangs higher so it
  // finishes near the ceiling (see wallCabinetTopLine).
  const topLine = wallCabinetTopLine(room);
  if (p.placement === "appliance") {
    const def = APPLIANCES.find((a) => a.masterCode === p.masterCode);
    // Use the stored height when the user has resized the appliance (e.g. fridge height set to 72").
    // Fall back to the catalog elevHeight when no custom height is stored.
    const storedH = typeof p.height === "number" && p.height > 0 ? p.height : null;
    if (def) {
      // Catalog mount height is the safe default, but the placement flow may
      // persist an intentional appliance mount (notably an MW-30 over a range).
      // Respect that value so collision detection and elevation use the same
      // physical vertical envelope as the designer.
      const storedBottom = typeof p.mountBottom === "number" && p.mountBottom >= 0
        ? p.mountBottom
        : def.elevBottom;
      return { bottom: storedBottom, height: storedH ?? def.elevHeight };
    }
    // Unknown appliance code (e.g. FRIDGE-33 after resize): use stored height if available,
    // otherwise fall back to countertop height as a safe default.
    if (storedH) return { bottom: 0, height: storedH };
    return { bottom: 0, height: STD.COUNTERTOP_HEIGHT };
  }
  // A deliberate 3D attributes adjustment may vertically offset a base or tall
  // cabinet. Persist the exact 2D elevation rather than allowing the 3D scene
  // to drift away from its plan record. Wall/appliance records are handled in
  // their specialized branches below so their catalog defaults remain intact.
  if ((p.placement === "base" || p.placement === "tall") && typeof p.mountBottom === "number" && p.mountBottom >= 0) {
    return { bottom: p.mountBottom, height: placedHeight(p) };
  }
  if (p.placement === "wall") {
    const h = placedHeight(p);
    // WD18 countertop cabinets default to the 36-inch finished countertop line.
    // A stale standard-wall 54-inch mount is treated as the former incorrect
    // default; any other explicit user-adjusted mount remains intentional.
    if (isWd18CountertopDrawerCabinet(p)) {
      const storedBottom = typeof p.mountBottom === "number" && p.mountBottom >= 0 ? p.mountBottom : null;
      return {
        bottom: storedBottom == null || Math.abs(storedBottom - WALL_MOUNT_BOTTOM) <= 0.01
          ? STD.COUNTERTOP_HEIGHT
          : storedBottom,
        height: h,
      };
    }
    // 1) Explicit user override always wins (drag/adjust up or down).
    if (typeof p.mountBottom === "number" && p.mountBottom >= 0) {
      return { bottom: p.mountBottom, height: h };
    }
    // 2) Glass stackers sit ON TOP of the wall cabinet below them: their bottom
    //    rests on the upper-run top line and they grow up toward the ceiling.
    //    On a taller ceiling the top line rises, so the stacker hangs higher.
    if (isStacker(p)) {
      return { bottom: topLine, height: h };
    }
    // 2b) Appliance garages (AG-*) mount ON the countertop surface (36") and
    //     rise up to 54" (36" + 18"). They are NOT top-anchored like wall
    //     cabinets — they sit between the countertop and the wall cabinets above.
    {
      const agHay = `${p.subCategory ?? ""} ${p.description ?? ""} ${p.masterCode ?? ""}`.toLowerCase();
      if (/appliance garage|\bag-?\d/.test(agHay)) {
        return { bottom: STD.COUNTERTOP_HEIGHT, height: h };
      }
    }
    // 3) Dedicated refrigerator uppers have one appliance-relative exception:
    //    absent a saved/normalized custom height, a WR cabinet begins at 72"
    //    above the floor for the standard 70" refrigerator. A live matching
    //    refrigerator remains authoritative through normalizeRefrigeratorBayUppers.
    if (isRefrigeratorWallCabinet(p)) {
      return { bottom: 72, height: h };
    }
    // 4) Ordinary wall cabinets start at 54 inches, with the customer's
    //    explicit 72-inch datum for a non-stacker 12-inch upper. Users who
    //    want a different position set an explicit mountBottom (branch #1),
    //    which wins.
    return { bottom: ordinaryWallMountBottom(p), height: h };
  }
  // baseTop: specialty items (knee drawers, spice racks) that sit in the
  // counter-height zone. A knee drawer may be installed from 24–30 inches off
  // the finished floor; 30 inches is the default just below the countertop.
  if (p.placement === "baseTop") {
    const requested = typeof p.mountBottom === "number" ? p.mountBottom : KNEE_DRAWER_DEFAULT_MOUNT_BOTTOM_IN;
    const bottom = isKneeDrawerItem(p)
      ? Math.min(KNEE_DRAWER_MAX_MOUNT_BOTTOM_IN, Math.max(KNEE_DRAWER_MIN_MOUNT_BOTTOM_IN, requested))
      : requested;
    return { bottom, height: placedHeight(p) };
  }
  // underCabinet: specialty items (stem glass holders) that hang under wall cabinets
  // They mount at the wall cabinet's bottom line (54") and hang down
  if (p.placement === "underCabinet") {
    const h = placedHeight(p);
    return { bottom: WALL_MOUNT_BOTTOM - h, height: h }; // bottom of item is at 54", grows downward
  }
  // Base, tall, vanity: the box normally sits on the floor (bottom = 0). One
  // exception: a wall (upper) cabinet that was "dropped to the floor" is stood
  // on a standard 4.5" toe kick — it carries an explicit mountBottom so it reads
  // like a real cabinet on a toe-kick base rather than sitting flat on the slab.
  if (typeof p.mountBottom === "number" && p.mountBottom > 0) {
    return { bottom: p.mountBottom, height: placedHeight(p) };
  }
  if (p.placement === "tall") {
    return { bottom: 0, height: placedHeight(p) };
  }
  return { bottom: 0, height: placedHeight(p) };
}

// Find the next free position along the back wall so newly-added cabinets
// march left-to-right against the wall instead of stacking on the same spot.
export function nextFreeSpot(
  width: number,
  depth: number,
  placement: Placement,
  room: RoomData,
  existing: PlacedCabinet[]
): { x: number; y: number } {
  // Wall cabinets sit on the back wall (y=0). Base/tall also default to back wall.
  const y = 0;
  // Only consider cabinets on the same layer (so a wall cab can sit above a base cab).
  const sameLayer = existing.filter((p) => p.placement === placement);
  // March along x at the back wall, packing flush against the rightmost neighbor.
  let x = 0;
  const rowItems = sameLayer
    .filter((p) => p.y < depth) // anything near the back wall band
    .sort((a, b) => a.x - b.x);
  for (const item of rowItems) {
    const iw = rotatedSize(item).w;
    // If the candidate slot [x, x+width] overlaps this item, push past it.
    if (x < item.x + iw && x + width > item.x) {
      x = item.x + iw;
    }
  }
  // If it runs off the right edge, drop to a second row offset from the wall.
  if (x + width > room.width) {
    x = 0;
    return { x, y: Math.min(depth - height_safe(depth, placement), depth * 0.45) };
  }
  return { x, y };
}

function height_safe(roomDepth: number, _placement: Placement): number {
  return Math.min(roomDepth, 24);
}

// ─── Corner cabinet detection & L-shape rendering ───────────────────────────
// Corner cabinets (Lazy Susan, blind corner, diagonal corner, easy-reach corner)
// occupy an L-shaped footprint in plan view, not a plain square. We detect them
// by masterCode prefix so both placed packages and palette drops render correctly.
export function isCornerCabinet(masterCode: string, description?: string): boolean {
  const code = (masterCode || "").toUpperCase();
  const desc = (description || "").toLowerCase();
  // AW = angled WALL-END cabinet. It finishes a normal wall run with a 45°
  // exposed face; it is not installed in or owned by a room corner.
  if (/^AW[-\d]/.test(code) || (/\bangle(?:d)? wall end\b/.test(desc) && !/corner/.test(desc))) return false;
  // ERB/BER are the easy-reach corner base codes (BER is the Skyline naming;
  // ERB is how the catalog stores the same cabinet). WER is the wall easy-reach.
  // LS## = Lazy Susan (e.g. LS3612, LS3312); LSB## = Lazy Susan Base (older naming)
  // BER## = Easy-Reach corner base (Skyline naming, e.g. BER33, BER36)
  if (/^(BBC|WBC|BLB|LSB?|CSB|WLS|DCW|DCB|ER|ERB|BER|WER|WDC|KWD|AG-|AG\d|CAG)/.test(code)) return true;
  if (/-CNR|CORNER/.test(code)) return true;
  return /corner|lazy susan|easy reach|blind|diagonal|angled (wall|corner)/.test(desc);
}

// An ANGLED WALL-END cabinet (AW-*) has a 45° exposed end face on a normal wall
// run. It is a regular wall-tab cabinet — NOT a corner cabinet. Use
// this to keep AW units OUT of the Corner palette tab while its dedicated plan
// clip and 3D profile still render the angled exposed end.
export function isAngledWallCabinet(masterCode: string, description?: string): boolean {
  const code = (masterCode || "").toUpperCase();
  const desc = (description || "").toLowerCase();
  // A genuine corner unit (e.g. "corner" in the text) is never an angled wall.
  if (/corner/.test(desc)) return false;
  return /^AW[-\d]/.test(code) || /\bangled wall\b/.test(desc);
}

/**
 * True only for cabinets whose installed location is owned by a room vertex.
 * AW1230/AW-12-30 remains a diagonal-profile wall-run end: it can be
 * moved by measured wall offset and must never be forced into the protected
 * ERB/WDC/LS-style corner-snap workflow merely because its face is angled.
 */
export function isProtectedCornerCabinet(masterCode: string, description?: string): boolean {
  return isCornerCabinet(masterCode, description) && !isAngledWallCabinet(masterCode, description);
}

/** Catalog add/drop routes reserve a room vertex only for a true, non-blind corner cabinet. */
export function requiresRoomCornerPlacement(cabinet: Pick<PlacedCabinet, "masterCode" | "description" | "placement">): boolean {
  return (cabinet.placement === "base" || cabinet.placement === "wall")
    && isProtectedCornerCabinet(cabinet.masterCode, cabinet.description)
    && !isBlindCorner(cabinet.masterCode, cabinet.description);
}

// A diagonal corner cabinet has a single 45-degree angled front face spanning
// the corner (NOT an L-shaped notch like a blind/lazy-susan corner). Codes like
// DCW (Diagonal Corner Wall), WDC, KWD and descriptions containing "diagonal".
export function isDiagonalCorner(masterCode: string, description?: string): boolean {
  const code = (masterCode || "").toUpperCase();
  const normalizedCode = code.replace(/[^A-Z0-9]/g, "");
  // Diagonal corner wall/base and corner appliance garages (AG) occupy room
  // corners. AW wall-end cabinets are deliberately excluded and use their own
  // non-corner profile and placement rule.
  // BEC = Base End Cabinet: an end-of-run angle cabinet, never a room-corner
  // cabinet. It is handled by the independent end-angle drawing profile.
  if (/^(DCW|WDC|KWD|DCB|DCFF|AG-|AG\d|CAG)/.test(code) || normalizedCode.includes("DCW") || normalizedCode.includes("WDC")) return true;
  const desc = (description || "").toLowerCase();
  if (/diagonal|angled corner|appliance garage/.test(desc)) return true;
  return false;
}

// Returns a CSS clip-path describing the plan footprint of a diagonal corner
// cabinet. The cabinet comes out a fixed depth (~12") along EACH wall, then the
// front cuts back at a 45-degree diagonal across the inside corner. Within a
// square bounding box this is a pentagon: two short legs (the wall-facing backs)
// plus the angled front face. `legRatio` is the leg depth as a fraction of the
// box (12" of a 24" box = 0.5). Rotation selects which corner is the wall corner
// (rot 0 = wall corner at top-left; the diagonal face points to bottom-right).
export function diagonalCornerClipPath(rotation: number, legRatio = 0.5): string {
  const r = ((rotation % 360) + 360) % 360;
  const k = Math.round(legRatio * 100); // leg depth as %
  switch (r) {
    case 90: // wall corner top-right; face toward bottom-left
      return `polygon(100% 0, 100% 100%, ${100 - k}% 100%, 0 ${k}%, 0 0)`;
    case 180: // wall corner bottom-right; face toward top-left
      return `polygon(100% 100%, 0 100%, 0 ${100 - k}%, ${100 - k}% 0, 100% 0)`;
    case 270: // wall corner bottom-left; face toward top-right
      return `polygon(0 100%, 0 0, ${k}% 0, 100% ${100 - k}%, 100% 100%)`;
    default: // 0 — wall corner top-left; face toward bottom-right
      return `polygon(0 0, 100% 0, 100% ${k}%, ${k}% 100%, 0 100%)`;
  }
}

// Returns a CSS clip-path for a triangle corner cabinet (WTC/BTC). The cabinet
// body is a right-triangle: two legs along the back walls, hypotenuse is the
// angled door face. The bounding box is square (width × width). Rotation selects
// which corner is the wall corner (rot 0 = wall corner top-left, face bottom-right).
export function triangleCornerClipPath(rotation: number): string {
  const r = ((rotation % 360) + 360) % 360;
  switch (r) {
    case 90:  // wall corner top-right; face toward bottom-left
      return `polygon(0 0, 100% 0, 0 100%)`;
    case 180: // wall corner bottom-right; face toward top-left
      return `polygon(100% 0, 100% 100%, 0 100%)`;
    case 270: // wall corner bottom-left; face toward top-right
      return `polygon(0 0, 100% 100%, 0 100%)`;
    default:  // 0 — wall corner top-left; face toward bottom-right
      return `polygon(0 0, 100% 0, 100% 100%)`;
  }
}

// True for triangle corner cabinets (WTC/BTC). Detected by cornerType field or
// by code prefix WTC/BTC.
export function isTriangleCorner(masterCode: string, cornerType?: string | null): boolean {
  if (cornerType === "triangle") return true;
  const code = (masterCode || "").toUpperCase();
  return /^(WTC|BTC)/.test(code);
}

// True for L-shaped corner cabinets (lazy-Susan, blind corner, easy-reach
// corner). These are corner cabinets that are NOT diagonal — they form a square
// footprint with an L-notch cut at the interior corner. We reuse isCornerCabinet
// for detection and exclude the diagonal family.
export function isLCornerCabinet(masterCode: string, description?: string): boolean {
  if (isDiagonalCorner(masterCode, description)) return false;
  // Blind corner cabinets (BBC/WBC) are NOT L-shaped — they are standard
  // rectangular cabinets that sit in a corner with a blind (hidden) portion.
  // Their footprint is width x standard-depth (e.g. BBC-36 = 36" x 24"),
  // NOT a square like lazy-Susan or easy-reach corners.
  if (isBlindCorner(masterCode, description)) return false;
  return isCornerCabinet(masterCode, description);
}

// How far an L-shaped corner cabinet projects from each wall (its leg depth, in
// inches). This is the cabinet's real stored depth (~24" base / ~12" wall),
// NOT the square bounding-box side. Falls back to a standard depth by placement.
export function cornerLegDepth(c: DesignCabinet): number {
  const fallback = c.placement === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH;
  const d = dim(c.depth, fallback);
  const w = dim(c.width, 24);
  // The leg can never be deeper than the square box side; clamp for safety.
  return Math.min(d > 0 ? d : fallback, w);
}

// The leg-keep ratio for the L clip-path of a corner cabinet: the fraction of
// the square box side occupied by each leg (legDepth / boxWidth). For a 36"
// lazy-Susan with 24" legs this is 24/36 = 0.667 (notch is the inner 12x12).
export function cornerLegRatio(c: DesignCabinet): number {
  const w = dim(c.width, 24);
  if (w <= 0) return 0.667;
  const leg = cornerLegDepth(c);
  const ratio = leg / w;
  // Keep within sane bounds so the polygon is always a valid L.
  return Math.max(0.3, Math.min(0.95, ratio));
}

// Leg-keep ratio for a PLACED corner cabinet. After footprintDepth() squares the
// bounding box (depth == width), the real leg depth is the standard run depth for
// the placement bucket (24" base/tall, 12" wall). The notch = boxWidth - legDepth
// on each side, so a 36" lazy-Susan with 24" legs keeps 24/36 = 0.667 and notches
// the inner 12x12; a 33" unit keeps 24/33 = 0.727 (9x9 notch).
export function cornerLegRatioForPlaced(p: {
  width: number;
  placement: Placement;
}): number {
  // The plan box is the source-backed nominal span of this exact corner
  // cabinet. Its physical legs remain the standard 24-inch base/tall or
  // 12-inch wall depth, so a 33-inch ERB keeps a 24/33 ratio and a 9-inch
  // interior notch rather than inheriting a 36-inch cabinet's footprint.
  const box = lCornerBoxSide(p);
  const legDepth = p.placement === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH;
  const ratio = legDepth / box;
  return Math.max(0.3, Math.min(0.95, ratio));
}

// Returns a CSS clip-path polygon describing an L-shape inscribed in the
// cabinet's bounding box. The "notch" is cut from the corner pointing toward
// the room interior, chosen from the cabinet's rotation so the two legs hug the
// two adjacent walls. `legRatio` is the fraction of each side kept as a leg.
export function cornerClipPath(rotation: number, legRatio = 0.667): string {
  const r = ((rotation % 360) + 360) % 360;
  const k = Math.round(legRatio * 100); // leg length as %
  const j = 100 - k; // complementary point used by the mirrored corners
  // Each corner is an exact geometric mirror of the confirmed-correct rot 0
  // (top-left) shape. rot 0 keeps a full-width strip along the TOP and a
  // full-height strip along the LEFT, cutting the notch from the bottom-right
  // so both legs hug the top + left walls and the L opens into the room.
  //   rot 90  = horizontal mirror  → legs hug top + RIGHT   (notch bottom-left)
  //   rot 180 = 180° rotation      → legs hug bottom + RIGHT (notch top-left)
  //   rot 270 = vertical mirror    → legs hug bottom + LEFT   (notch top-right)
  switch (r) {
    case 90: // top-right: legs hug top + right, notch bottom-left
      return `polygon(0 0, 100% 0, 100% 100%, ${j}% 100%, ${j}% ${k}%, 0 ${k}%)`;
    case 180: // bottom-right: legs hug bottom + right, notch top-left
      return `polygon(${j}% 0, 100% 0, 100% 100%, 0 100%, 0 ${j}%, ${j}% ${j}%)`;
    case 270: // bottom-left: legs hug bottom + left, notch top-right
      return `polygon(0 0, ${k}% 0, ${k}% ${j}%, 100% ${j}%, 100% 100%, 0 100%)`;
    default: // 0 — top-left: legs hug top + left, notch bottom-right
      return `polygon(0 0, 100% 0, 100% ${k}%, ${k}% ${k}%, ${k}% 100%, 0 100%)`;
  }
}

// Which wall corner a placed L-corner cabinet sits in, derived from its position
// in the room. The interior notch of the L must point AWAY from both walls
// (toward the room interior), so the corner determines the clip-path rotation.
//   back-left  (x≈0, y≈0)            → walls top+left   → notch bottom-right → rot 0
//   back-right (x+w≈room.w, y≈0)       → walls top+right  → notch bottom-left  → rot 90
//   front-right(x+w≈room.w, y+d≈room.d)→ walls bot+right  → notch top-left     → rot 180
//   front-left (x≈0, y+d≈room.d)        → walls bot+left   → notch top-right    → rot 270
// Falls back to the cabinet's own rotation when it is not seated in a corner.
export function cornerRotationForPlaced(
  p: PlacedCabinet,
  room: RoomData,
  tol = 2
): number {
  // ONE rule for every wall kind: a corner body seated on a run (standard
  // side, drawn wall) whose plan position matches the shared corner seat at
  // either end of that run takes that seat's turn. A drawn room's bounding
  // rectangle says nothing about which way a 90° join between two Wall
  // Builder walls opens, so the rectangle inference below is only the
  // fallback for run-less legacy records.
  const seatedRun = p.wallId ? wallRunFrame(p.wallId, room) : null;
  if (seatedRun) {
    for (const at of ["start", "end"] as const) {
      const seat = wallRunCornerPlacement(p, seatedRun, at, room);
      if (seat && Math.abs(seat.x - p.x) <= tol && Math.abs(seat.y - p.y) <= tol) {
        return ((Math.round(seat.rotation) % 360) + 360) % 360;
      }
    }
  }
  const { w, d } = placedFootprint(p);
  // Prefer a tight snap: if the box is within `tol` of two perpendicular walls,
  // that corner is unambiguous.
  const nearLeft = p.x <= tol;
  const nearRight = Math.abs(p.x + w - room.width) <= tol;
  const nearTop = p.y <= tol;
  const nearBottom = Math.abs(p.y + d - room.depth) <= tol;
  if (nearTop && nearLeft) return 0;
  if (nearTop && nearRight) return 90;
  if (nearBottom && nearRight) return 180;
  if (nearBottom && nearLeft) return 270;
  // Otherwise (the cabinet was dragged near a corner but not snapped tight to
  // BOTH walls), fall back to the NEAREST room corner by the box center. This
  // keeps the L-notch pointing into the room interior for every corner instead
  // of defaulting to rot 0 (notch bottom-right), which only looked right in the
  // top-left corner. This is what previously made ERB cabinets in the top-right
  // and bottom-right corners render as a near-solid box.
  const cx = p.x + w / 2;
  const cy = p.y + d / 2;
  const left = cx <= room.width / 2;
  const top = cy <= room.depth / 2;
  if (top && left) return 0; // top-left  → notch bottom-right
  if (top && !left) return 90; // top-right → notch bottom-left
  if (!top && !left) return 180; // bottom-right → notch top-left
  return 270; // bottom-left → notch top-right
}

// Center-to-center distance between two placed cabinets, in inches.
export function centerDistance(a: PlacedCabinet, b: PlacedCabinet): number {
  const sa = rotatedSize(a);
  const sb = rotatedSize(b);
  const ax = a.x + sa.w / 2;
  const ay = a.y + sa.d / 2;
  const bx = b.x + sb.w / 2;
  const by = b.y + sb.d / 2;
  return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
}

// Format an inch value as feet'inches" for readable callouts.
export function formatInches(inches: number): string {
  const rounded = Math.round(inches);
  const ft = Math.floor(rounded / 12);
  const inch = rounded % 12;
  if (ft <= 0) return `${rounded}"`;
  return inch === 0 ? `${ft}'` : `${ft}' ${inch}"`;
}

/** Format a measured span to the nearest 1/8 inch for installation-oriented UI. */
export function formatEighthInches(inches: number): string {
  const measured = Math.max(0, Number.isFinite(inches) ? inches : 0);
  const eighths = Math.round(measured * 8);
  if (measured > COLLISION_EPSILON_IN && eighths === 0) return `<⅛"`;
  const whole = Math.floor(eighths / 8);
  const fraction = eighths % 8;
  const glyph = ["", "⅛", "¼", "⅜", "½", "⅝", "¾", "⅞"][fraction];
  return `${whole || !glyph ? whole : ""}${glyph}"`;
}

// ─── Doors & Windows (wall openings) ────────────────────────────────────────
// A wall opening is anchored to one of the four room walls and positioned by an
// offset (inches from the wall's start corner). Width is along the wall; for
// elevation, sillHeight is inches from floor to the bottom of the opening and
// height is the vertical size. Doors typically sit on the floor (sill 0).
export type WallSide = "top" | "bottom" | "left" | "right";
// "opening" = a cased opening / pass-through (a doorway WITH NO DOOR). Like a
// door it breaks the floor run (no base cabinet can cross it) and renders as a
// full-height open gap in the elevation; unlike a window it sits on the floor.
export type OpeningKind = "door" | "window" | "opening";

// Openings that break the BASE (floor) run: a person/traffic passes through, so
// no base cabinet may sit across them. Windows do NOT (a base cabinet can sit
// under a window). Used by base-overlap detection.
export function blocksFloorRun(kind: OpeningKind): boolean {
  return kind === "door" || kind === "opening";
}

/**
 * A window blocks a cabinet only where their real elevation envelopes overlap.
 * Base cabinets and under-counter appliances remain usable below a raised sill;
 * wall, tall, and hood/upper appliances remain blocked in the window zone.
 * Doors and cased openings continue to use the separate floor-run rule above.
 */
export function windowVerticallyOverlapsCabinet(
  cabinet: PlacedCabinet,
  opening: WallOpening,
  room: RoomData,
  clearance = 0,
): boolean {
  if (opening.kind !== "window") return false;
  const box = elevationBox(cabinet, room);
  const openingBottom = opening.sill - clearance;
  const openingTop = opening.sill + opening.height + clearance;
  return box.bottom < openingTop - COLLISION_EPSILON_IN
    && box.bottom + box.height > openingBottom + COLLISION_EPSILON_IN;
}

/** A window below the finished countertop must be corrected before base placement. */
export function isWindowBelowCountertop(opening: WallOpening): boolean {
  return opening.kind === "window" && opening.sill < STD.COUNTERTOP_HEIGHT - COLLISION_EPSILON_IN;
}

export interface OpeningDef {
  key: string;
  kind: OpeningKind;
  label: string;
  width: number; // along the wall
  height: number; // vertical (elevation)
  sill: number; // inches from floor to bottom of opening
}

export const OPENINGS: OpeningDef[] = [
  { key: "entry-door", kind: "door", label: 'Entry Door 36"', width: 36, height: 80, sill: 0 },
  { key: "interior-door", kind: "door", label: 'Interior Door 30"', width: 30, height: 80, sill: 0 },
  { key: "patio-door", kind: "door", label: 'Patio / Sliding 72"', width: 72, height: 80, sill: 0 },
  { key: "window-std", kind: "window", label: 'Window 36"', width: 36, height: 36, sill: 42 },
  { key: "window-wide", kind: "window", label: 'Window 60"', width: 60, height: 36, sill: 42 },
  { key: "window-over-sink", kind: "window", label: 'Over-Sink Window 36" × 48"', width: 36, height: 48, sill: 42 },
  // Cased openings / pass-throughs (no door). Width is fully adjustable after
  // placing — measure with a tape and type the exact inches.
  { key: "cased-opening", kind: "opening", label: 'Cased Opening 36"', width: 36, height: 80, sill: 0 },
  { key: "cased-opening-wide", kind: "opening", label: 'Wide Opening 60"', width: 60, height: 84, sill: 0 },
  { key: "pass-through", kind: "opening", label: 'Pass-Through 48"', width: 48, height: 36, sill: 40 },
];

export interface WallOpening {
  uid: string;
  kind: OpeningKind;
  /** Optional per-window photographic scene; absent windows use the Designer default. */
  windowSceneKind?: "daylight" | "garden" | "woodland" | "coastal" | "urban" | "mountain" | "night" | "city-skyline" | "desert" | "snow" | "seasonal-garden" | "autumn-woodland" | "suburban" | "privacy";
  /** Optional per-window architectural frame finish; absent windows use the Designer default. */
  windowFrameStyle?: "white" | "black" | "wood";
  /** Optional per-window construction style; absent windows remain picture windows. */
  windowConstructionStyle?: "picture" | "double-hung" | "casement" | "slider" | "french-cottage";
  /** Optional per-window mullion preset; absent windows use the selected scene's grid. */
  windowGridStyle?: "scene-default" | "none" | "1x0" | "2x0" | "3x0" | "0x1" | "0x2" | "0x3" | "1x1" | "2x1" | "2x2" | "3x2";
  /** Generic room-door illustration, not a catalog MasterTrac door or a hardware specification. */
  doorStyle?: "bifold";
  /** User-selected room-door paint color; absent standard doors render white. */
  doorColor?: string;
  /** 3D planning opacity only, not a glass/product specification. */
  doorOpacity?: number;
  /** Generic single-leaf planning swing; not a sliding/bifold hardware model. */
  doorOpenAngle?: 0 | 90;
  doorHinge?: "left" | "right";
  label: string;
  side: WallSide;
  offset: number; // inches from the wall start (left for top/bottom, top for left/right)
  width: number;
  height: number;
  sill: number;
}

export function wallLength(side: WallSide | string, room: RoomData): number {
  const peninsula = peninsulaRunById(room, side);
  if (peninsula) return Math.max(6, peninsula.length);
  // If the side is actually a custom wall ID in a polygon room, compute from vertices.
  if (room.vertices && room.customWalls) {
    const wall = room.customWalls.find((w) => w.id === side);
    if (wall) {
      return polygonWallSegmentLength(wall, room.vertices);
    }
  }
  return side === "top" || side === "bottom" ? room.width : room.depth;
}

/** Prospective longer-side wall segment shown before a Compass split commits. */
export function retainedWallSegmentForSplit(side: WallSide, room: RoomData, splitIn: number): { start: number; length: number } {
  const fullLength = side === "top" || side === "bottom" ? room.width : room.depth;
  const split = Math.max(0, Math.min(fullLength, Number(splitIn) || 0));
  const suffixLength = fullLength - split;
  return split >= suffixLength
    ? { start: 0, length: split }
    : { start: split, length: suffixLength };
}

/**
 * The usable segment of a cardinal room wall for cabinet placement and plan
 * rendering. A primary peninsula opens the shorter side of its parent wall at
 * the attachment point and preserves the longer side for continued cabinet
 * placement. This intentionally does not change `wallLength`: the full room
 * span is still required when moving the attachment and measuring the shell.
 */
export function cabinetWallRunSegment(side: WallSide, room: RoomData): { start: number; length: number } {
  const fullLength = side === "top" || side === "bottom" ? room.width : room.depth;
  const terminatingOffsets = (room.peninsulaRuns ?? [])
    .filter((run) => !run.parentRunId && run.parentWall === side && run.terminatesParentWall !== false)
    .map((run) => Math.max(0, Math.min(fullLength, Number(run.startOffset) || 0)));
  if (terminatingOffsets.length === 0) return { start: 0, length: fullLength };
  const split = terminatingOffsets.reduce((best, offset) => {
    const retained = Math.max(offset, fullLength - offset);
    const bestRetained = Math.max(best, fullLength - best);
    return retained > bestRetained ? offset : best;
  });
  return retainedWallSegmentForSplit(side, room, split);
}

export function cabinetWallRunLength(side: WallSide, room: RoomData): number {
  return cabinetWallRunSegment(side, room).length;
}

// Clamp an opening to its owning wall in both run and elevation directions.
export function clampOpening(o: WallOpening, room: RoomData): WallOpening {
  const len = wallLength(o.side, room);
  const width = Math.max(6, Math.min(o.width, len));
  const offset = Math.max(0, Math.min(o.offset, len - width));
  const ceiling = wallCeilingMin(room, o.side);
  const height = Math.max(6, Math.min(o.height, ceiling));
  const sill = Math.max(0, Math.min(o.sill, ceiling - height));
  return { ...o, width, offset, height, sill };
}

export function makeOpening(def: OpeningDef, side: WallSide, room: RoomData): WallOpening {
  const len = wallLength(side, room);
  const offset = Math.max(0, (len - def.width) / 2);
  return clampOpening(
    {
      uid: makeUid(),
      kind: def.kind,
      label: def.label,
      side,
      offset,
      width: def.width,
      height: def.height,
      sill: def.sill,
    },
    room
  );
}

let uidCounter = 0;
export function makeUid(): string {
  uidCounter += 1;
  return `c${Date.now().toString(36)}_${uidCounter}`;
}

// ─── Finish / trim color mapping ────────────────────────────────────────────
// When a user picks a door style ("trim"), placed cabinets re-skin to that
// finish on the canvas + elevation. We derive a representative fill color from
// the style code/name so the design updates instantly without per-style image
// assets. Falls back to a warm wood tone.
export interface FinishColors {
  face: string; // cabinet door/face fill
  edge: string; // darker edge/shadow line
  label: string; // text color that stays legible on the face
}

// Keyword table. Order matters — the FIRST regex that matches the combined
// style text wins. We match against the brand name AND the underlying paint
// color / finish / wood species, so e.g. "Aero Obsidian (SW 6258 Tricorn Black)"
// resolves to the black finish even though the brand word isn't "black".
//
// Hex values are sourced directly from the official Sherwin-Williams color chart
// (images.sherwin-williams.com/content_images/sw-pdf-sherwin-williams-colorc.pdf)
// for the most common cabinet paint colors, giving precise color accuracy.
const FINISH_BY_KEYWORD: { match: RegExp; face: string; edge: string; label: string; swName?: string }[] = [
  // ── SPECIFIC SW CABINET COLORS (matched before generic families) ──────────
  // SW 7006 Extra White — LRV 86, crisp cool white
  { match: /extra white|sw\s*7006|sw7006/, face: "#eeefea", edge: "#d0d1cc", label: "#2a2a2a", swName: "Extra White SW 7006" },
  // SW 7008 Alabaster — warm white, most popular cabinet white
  { match: /alabaster|sw\s*7008|sw7008/, face: "#edeae0", edge: "#cfc9b8", label: "#2a2a2a", swName: "Alabaster SW 7008" },
  // SW 7012 Creamy — soft yellow-cream
  { match: /creamy|sw\s*7012|sw7012/, face: "#efe9d4", edge: "#d4c9a8", label: "#2e2a1e", swName: "Creamy SW 7012" },
  // SW 7005 Pure White
  { match: /pure white|sw\s*7005|sw7005/, face: "#f4f1e8", edge: "#d8d4c6", label: "#2a2a2a", swName: "Pure White SW 7005" },
  // SW 7004 Snowbound
  { match: /snowbound|sw\s*7004|sw7004/, face: "#eef0ec", edge: "#d0d2ce", label: "#2a2a2a", swName: "Snowbound SW 7004" },
  // SW 7029 Agreeable Gray — warm gray, very popular
  { match: /agreeable gray|agreeable grey|sw\s*7029|sw7029/, face: "#d1cbc1", edge: "#b0a99e", label: "#1f1e1c", swName: "Agreeable Gray SW 7029" },
  // SW 7015 Repose Gray — true neutral greige
  { match: /repose gray|repose grey|sw\s*7015|sw7015/, face: "#ccc9c0", edge: "#a8a59c", label: "#1f1e1c", swName: "Repose Gray SW 7015" },
  // SW 7016 Mindful Gray — warm neutral gray
  { match: /mindful gray|mindful grey|sw\s*7016|sw7016/, face: "#bbb6ad", edge: "#96918a", label: "#1a1917", swName: "Mindful Gray SW 7016" },
  // SW 6244 Naval — deep navy blue
  { match: /naval(?!\s*gray)|sw\s*6244|sw6244/, face: "#3d5166", edge: "#26354a", label: "#f0f4f8", swName: "Naval SW 6244" },
  // SW 6258 Tricorn Black — true black
  { match: /tricorn black|sw\s*6258|sw6258/, face: "#2f2f2f", edge: "#161616", label: "#f5f5f5", swName: "Tricorn Black SW 6258" },
  // SW 6990 Caviar — near-black warm
  { match: /caviar|sw\s*6990|sw6990/, face: "#3b3635", edge: "#1e1b1a", label: "#f5f5f5", swName: "Caviar SW 6990" },
  // SW 7069 Iron Ore — dark charcoal
  { match: /iron ore|sw\s*7069|sw7069/, face: "#4b4d4e", edge: "#2c2e2f", label: "#f5f5f5", swName: "Iron Ore SW 7069" },
  // SW 7048 Urbane Bronze — dark warm brown-gray
  { match: /urbane bronze|sw\s*7048|sw7048/, face: "#645c54", edge: "#433e38", label: "#f5efe8", swName: "Urbane Bronze SW 7048" },
  // SW 6119 Antique White — warm cream with beige undertone
  { match: /antique white|sw\s*6119|sw6119/, face: "#ede0c8", edge: "#ccc0a0", label: "#2e2a1e", swName: "Antique White SW 6119" },
  // SW 6385 Accessible Beige
  { match: /accessible beige|sw\s*6385|sw6385/, face: "#d4c9b6", edge: "#b0a590", label: "#2a2520", swName: "Accessible Beige SW 6385" },
  // SW 9166 Evergreen Fog — muted sage green
  { match: /evergreen fog|sw\s*9166|sw9166/, face: "#7a8c7e", edge: "#5a6a5e", label: "#f0f4f0", swName: "Evergreen Fog SW 9166" },
  // SW 6177 Pewter Green
  { match: /pewter green|sw\s*6177|sw6177/, face: "#6b7d6a", edge: "#4e5e4d", label: "#f0f4f0", swName: "Pewter Green SW 6177" },
  // ── GENERIC COLOR FAMILIES (fallback when no specific SW name matches) ────
  // WHITES (broad)
  { match: /white|snow|arctic|alpine|pearl|dove(?!tail)|blanc|alba|marshmallow|chantilly|frost(?!ed gray)|ivory|cotton|dawn/, face: "#f3f1ec", edge: "#cfc9bf", label: "#3a3a3a" },
  // GREYS (incl. repose/dovetail/agreeable/mindful greige-leaning grays)
  { match: /grey|gray|stone|pewter|graphite|slate|fog|cinder|relic|repose|dovetail|grizzle|greige|ash|smoke|nickel|harbor|mist|pebble|amberg/, face: "#9aa0a6", edge: "#6f747a", label: "#1f2937" },
  // BLUES
  { match: /navy|blue|indigo|ocean|naval|cobalt|abyss|cobblestone|denim|sapphire|marine|teal|peacock/, face: "#3b4d63", edge: "#26354a", label: "#f8fafc" },
  // GREENS (incl. Aston Green, sage breeze)
  { match: /green|sage|forest|hunter|olive|fern|moss|evergreen|basil|juniper|aston/, face: "#566f5a", edge: "#3c4f40", label: "#f8fafc" },
  // BLACKS / NEAR-BLACK (incl. Iron Black, Midnight Glass/Black, Charcoal)
  { match: /black|onyx|carbon|tricorn|obsidian|jet|raven|charcoal|iron ore|peppercorn|caviar|midnight|iron black/, face: "#2b2b2e", edge: "#161618", label: "#f5f5f5" },
  // DARK BROWNS (espresso/walnut/mocha/treasure chest)
  { match: /walnut|mocha|coffee|chocolate|brown|espresso|umbra|shadow|java|truffle|cocoa|bourbon|treasure/, face: "#6b4a32", edge: "#4c3422", label: "#fbeee6" },
  // REDDISH WOODS
  { match: /cherry|mahogany|chestnut|cinnamon|spice|sienna|russet|brick|garnet/, face: "#7a4a32", edge: "#5a3422", label: "#fbeee6" },
  // MID WARM WOODS (oak/maple/honey/saddle/autumn/rustic wood/blonde oak)
  { match: /honey|oak|natural|maple|wheat|amber|toffee|saddle|autumn|caramel|pecan|harvest|golden|butterscotch|solar|rustic wood|blonde/, face: "#c08a4e", edge: "#9a6a36", label: "#3a2410" },
  // CREAMS / WARM NEUTRALS
  { match: /cream|almond|biscuit|linen|sand|beige|tan|creamy|manila|wicker|navajo|buttermilk|antique white|aged/, face: "#e6dcc6", edge: "#c7b79a", label: "#3a3526" },
];

// Deterministic distinct-color palette for styles whose text doesn't match any
// keyword. A stable hash of the style name picks one of these, so two different
// unmatched styles still look different (instead of all collapsing to one wood
// tone) and the SAME style always renders the same color across renders.
const FALLBACK_FINISHES: FinishColors[] = [
  { face: "#c79a63", edge: "#a07a45", label: "#3a2410" }, // warm oak
  { face: "#b78c64", edge: "#8f6a45", label: "#2e1c0e" }, // tan wood
  { face: "#8a9a8e", edge: "#65756a", label: "#1f2a23" }, // muted sage
  { face: "#7e8a99", edge: "#5a6675", label: "#f4f6fa" }, // blue-grey
  { face: "#a98f7a", edge: "#806656", label: "#2c1d12" }, // taupe
  { face: "#cdbfa6", edge: "#a99a7e", label: "#33301f" }, // greige
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const DEFAULT_FINISH: FinishColors = FALLBACK_FINISHES[0];
export const DEFAULT_FINISH_COLORS = DEFAULT_FINISH;

// Door-panel treatment derived from the door-style family name. Used to render
// the correct front detail (recessed Shaker frame, raised center, flat slab,
// beaded boards, stacked double-shaker) on door swatches AND on placed cabinets
// in the elevation view, so picking a style visibly changes the door look.
export type DoorPanelKind = "shaker" | "slim-shaker" | "raised" | "slab" | "beaded" | "inset" | "double-shaker";
export function doorPanelKind(doorStyle?: string | null): DoorPanelKind {
  const s = (doorStyle ?? "").toLowerCase();
  if (/double/.test(s)) return "double-shaker";
  // Slim / narrow Shaker: a Shaker door built with a narrow ~1/2" rail & stile
  // instead of the standard ~2.25". Detect it before the generic shaker so the
  // swatch can draw the thin frame.
  if (/slim|narrow|thin[ -]?frame|skinny/.test(s) && /shaker/.test(s)) return "slim-shaker";
  if (/slim shaker|narrow shaker/.test(s)) return "slim-shaker";
  if (/raised|cathedral|arch/.test(s)) return "raised";
  if (/slab|flat|contemporary|euro|modern/.test(s)) return "slab";
  if (/bead/.test(s)) return "beaded";
  if (/inset/.test(s)) return "inset";
  return "shaker";
}

// Returns the matched SW color entry including swName when available.
// Used by the product detail hero to display the SW color name as attribution.
export function finishColorsWithName(...parts: (string | null | undefined)[]): FinishColors & { swName?: string } {
  // If any part is a valid 6-digit hex color, use it directly.
  for (const p of parts) {
    if (p && /^#[0-9a-fA-F]{6}$/.test(p.trim())) {
      return colorsFromHex(p.trim().toLowerCase());
    }
  }
  const s = parts.filter(Boolean).join(" ").toLowerCase();
  for (const f of FINISH_BY_KEYWORD) {
    if (f.match.test(s)) return { face: f.face, edge: f.edge, label: f.label, swName: f.swName };
  }
  if (!s.trim()) return DEFAULT_FINISH;
  return FALLBACK_FINISHES[hashString(s) % FALLBACK_FINISHES.length];
}

// Derive edge and label colors from a hex face color.
// Edge is darkened ~15%, label is white for dark faces and dark for light faces.
function colorsFromHex(hex: string): FinishColors {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Darken by ~18% for edge
  const dr = Math.round(r * 0.82);
  const dg = Math.round(g * 0.82);
  const db = Math.round(b * 0.82);
  const edge = `#${dr.toString(16).padStart(2,'0')}${dg.toString(16).padStart(2,'0')}${db.toString(16).padStart(2,'0')}`;
  // Luminance check for label contrast
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const label = lum > 160 ? '#2a2520' : '#f5f0eb';
  return { face: hex, edge, label };
}

// Accepts any combination of the style's brand name, paint color, finish text,
// and wood species — all are scanned together so the most specific signal wins.
// When a hex color code is present in the parts, it is used directly so every
// door style renders with its exact brand color regardless of keyword matching.
// Falls back to a deterministic per-name color (never the same tone for every
// style) when nothing matches.
export function finishColors(...parts: (string | null | undefined)[]): FinishColors {
  // First pass: if any part is a valid 6-digit hex color, use it directly.
  for (const p of parts) {
    if (p && /^#[0-9a-fA-F]{6}$/.test(p.trim())) {
      return colorsFromHex(p.trim().toLowerCase());
    }
  }
  const s = parts.filter(Boolean).join(" ").toLowerCase();
  for (const f of FINISH_BY_KEYWORD) {
    if (f.match.test(s)) return { face: f.face, edge: f.edge, label: f.label };
  }
  if (!s.trim()) return DEFAULT_FINISH;
  return FALLBACK_FINISHES[hashString(s) % FALLBACK_FINISHES.length];
}

// ─── Crown molding & toe kick (design trim, rendered in elevation) ──────────
// These are toggleable trim layers in the Design Tool. Crown runs along the top
// of every wall cabinet; toe kick is the recessed strip under base/tall cabinets.
// Linear footage for the BOM is derived from the combined widths of the relevant
// cabinets (wall widths for crown, base+tall widths for toe kick).
export const CROWN_HEIGHT_IN = 3;     // visual crown band height in elevation
export const TOE_KICK_HEIGHT_IN = STD.TOE_KICK; // 4.5"
export const LIGHT_RAIL_HEIGHT_IN = 1.5; // light rail valance under wall cabinets
// Other simple wall-run trim retains the existing 3" per-run allowance. Crown
// has a separate exact takeoff because its exposed perimeter can include returns,
// depth steps, and 45° cuts around outside cabinet corners.
export const MITER_ALLOWANCE_IN = 3;
// Each end of an exposed crown miter cut receives four inches. An outside
// corner joins two cut ends, so it contributes eight inches to the takeoff.
export const CROWN_MITER_ALLOWANCE_IN = 4;
// Light rail is installed below upper cabinets. Add four inches once for each
// continuous exposed rail assembly to provide the owner's installation buffer.
export const LIGHT_RAIL_INSTALLATION_ALLOWANCE_IN = 4;

// Which of the four walls is this cabinet sitting against?
//
// ORIENTATION-FIRST: a cabinet's rotation tells us which PAIR of walls it can
// belong to — horizontal (rot 0/180) faces off the top/bottom walls, vertical
// (rot 90/270) faces off the left/right walls. We must decide the pair before
// proximity, because a cabinet parked in a CORNER is flush against two walls at
// once (e.g. a range in the bottom-left corner touches BOTH the bottom and the
// left wall). A naive "first flush wall wins" check would mis-assign such a
// cabinet to the wrong elevation (it would show a left-wall range on the Front
// view). Using orientation first keeps a vertical corner cabinet on Left/Right
// and a horizontal one on Top/Bottom; proximity only breaks the tie WITHIN the
// oriented pair.
export function cabinetWall(p: PlacedCabinet, room: RoomData): WallSide {
  // A cabinet that names one of this room's runs (standard side, drawn wall
  // or peninsula) belongs to that run; the same ownership rule on every wall
  // kind. Only run-less legacy records fall through to geometric inference.
  if (p.wallId && wallRunFrame(p.wallId, room)) return p.wallId as WallSide;
  const horizontal = ((Math.round(p.rotation) % 180) + 180) % 180 === 0;
  const { w, d } = rotatedSize(p);
  if (horizontal) {
    // Belongs to top or bottom. Prefer the flush edge; else nearest by center.
    if (isAgainstWall(p, "top", room)) return "top";
    if (isAgainstWall(p, "bottom", room)) return "bottom";
    return p.y + d / 2 < room.depth / 2 ? "top" : "bottom";
  }
  // Vertical: belongs to left or right. Prefer the flush edge; else nearest.
  if (isAgainstWall(p, "left", room)) return "left";
  if (isAgainstWall(p, "right", room)) return "right";
  return p.x + w / 2 < room.width / 2 ? "left" : "right";
}

/**
 * Returns the wall-flush spot for a microwave centered on a compatible range.
 * The microwave's shallow plan depth is preserved while only its run-axis
 * center follows the range, including a measured continuous-wall run.
 */
export function mountedMicrowaveOverRangeSpot(
  microwave: Pick<PlacedCabinet, "width" | "depth">,
  range: PlacedCabinet,
  room: RoomData,
): { x: number; y: number; rotation: number } {
  const side = cabinetWall(range, room);
  const rangeStart = wallRunOffset(range, side, room);
  const rangeSpan = wallRunSpan(range, side, room);
  // The microwave's catalog width follows the cabinet run on every wall. Its
  // shallow depth only projects into the room, including after a 90° turn on a
  // left/right wall. Using depth here offset a right-wall MW-30 by 7½ inches,
  // which made the final mounted-pair collision exemption fail.
  const microwaveSpan = microwave.width;
  return wallPlacementAt(
    rangeStart + rangeSpan / 2 - microwaveSpan / 2,
    microwave.width,
    microwave.depth,
    side,
    room,
  );
}

/**
 * Select the range that an over-range microwave should mount above. A selected
 * range takes precedence, then ranges on the active wall, then the nearest
 * range in the current design. This keeps palette adds from inheriting an
 * arbitrary free canvas position in the center of the room.
 */
export function preferredRangeForOverRangeMicrowave(
  placed: PlacedCabinet[],
  room: RoomData,
  activeWall: WallSide | null | undefined,
  selectedUid: string | null | undefined,
  target: Pick<PlacedCabinet, "x" | "y">,
): PlacedCabinet | undefined {
  const isRange = (cabinet: PlacedCabinet) => isRangeOrOven(cabinet.masterCode, cabinet.description);
  const selectedRange = placed.find((cabinet) => cabinet.uid === selectedUid && isRange(cabinet));
  if (selectedRange) return selectedRange;
  const activeWallRanges = activeWall
    ? placed.filter((cabinet) => isRange(cabinet) && cabinetWall(cabinet, room) === activeWall)
    : [];
  const candidates = activeWallRanges.length > 0 ? activeWallRanges : placed.filter(isRange);
  return [...candidates].sort(
    (a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y),
  )[0];
}

/** Returns the mounted range and exact wall spot for a palette or drag MW-30 add. */
export function overRangeMicrowaveAttachment(
  placed: PlacedCabinet[],
  room: RoomData,
  activeWall: WallSide | null | undefined,
  selectedUid: string | null | undefined,
  target: Pick<PlacedCabinet, "x" | "y">,
  microwave: Pick<PlacedCabinet, "width" | "depth">,
): { range: PlacedCabinet; spot: { x: number; y: number; rotation: number } } | null {
  const range = preferredRangeForOverRangeMicrowave(placed, room, activeWall, selectedUid, target);
  return range ? { range, spot: mountedMicrowaveOverRangeSpot(microwave, range, room) } : null;
}

// Sum a mitered trim run grouped by wall, adding the miter allowance once per
// wall that actually has trim on it. `cabs` are the cabinets the trim runs over.
export function miteredTrimInches(cabs: PlacedCabinet[], room: RoomData): number {
  if (cabs.length === 0) return 0;
  const perWall = new Map<string, number>();
  for (const p of cabs) {
    const wall = cabinetTakeoffWallId(p, room);
    perWall.set(wall, (perWall.get(wall) ?? 0) + alongRunSpan(p));
  }
  let total = 0;
  perWall.forEach((width) => {
    if (width > 0) total += width + MITER_ALLOWANCE_IN;
  });
  return total;
}

/**
 * Physical run nearest a cabinet body for trim takeoff. A cabinet deliberately
 * turned or pulled off its wall is no longer *seated* there, so it correctly
 * has no wallId/wallOffset. It still contributes its catalog width to the
 * nearest run's material takeoff without inventing a cardinal wall in a drawn
 * room. Measurement association is intentionally separate from wall seating.
 */
export function cabinetTakeoffWallId(p: PlacedCabinet, room: RoomData): string {
  if (p.wallId && seatedWallRunFrame(p, room)) return p.wallId;
  return nearestWallRunAtPoint(room, placedPlanCenter(p))?.frame.id ?? cabinetWall(p, room);
}

// Legacy width-only crown estimate for non-render callers. The live Designer
// order uses the final exposed 3D crown perimeter, including every return and
// the four-inch allowance at both cut ends of each outside corner.
export function isCrownEligibleCabinet(p: PlacedCabinet, room?: RoomData): boolean {
  if (p.placement !== "tall" && p.placement !== "wall") return false;
  // MasterTrac boards are closet components, not upper kitchen casework.
  if (p.category === "MasterTrac Closet" || /^CL-/.test(p.masterCode)) return false;
  // Island wall cabinets are floor/counter-height casework, never upper runs.
  // The explicit island marker remains authoritative for older saves whose
  // mountBottom may still contain a room-wall value.
  if (usesRaisedFloorWallDoorPull(p)) return false;
  // A wall cabinet deliberately dropped to a 4½-inch toe kick is floor-seated
  // casework. Use the rendered elevation bottom so restored plans, counter-height
  // variants, and explicit mountBottom values all follow the same physical rule.
  const box = elevationBox(p, room);
  if (box.bottom <= STD.TOE_KICK + COLLISION_EPSILON_IN && p.placement === "wall") return false;
  if (!room) return true;

  // Crown sits on the actual top of EVERY wall cabinet, including the
  // refrigerator bridge, which hangs at its own mount height (72" over a 70"
  // refrigerator) rather than the standard upper-run line. Excluding the bridge
  // left the neighbouring upper's crown return running into the bridge body
  // instead of stopping at it and continuing along the bridge top.
  // A ceiling-filling glass stacker is a complete enclosure, leaving no
  // physical space for another crown profile above it. Tall pantry cabinets
  // remain crown-bearing: the crown follows their actual top line, including
  // when that line is the ceiling line, so tall runs do not lose their wrap.
  const isCeilingFillingGlassStacker = isStacker(p) && isGlassDoorCabinet(p);
  if (p.placement === "tall") return true;
  if (!isCeilingFillingGlassStacker) return true;
  const ceiling = wallCabinetVerticalMoveLimit(p, room).ceiling;
  const top = box.bottom + box.height;
  return ceiling - top >= CROWN_HEIGHT_IN - COLLISION_EPSILON_IN;
}

/**
 * Every upper or tall cabinet body is a physical obstacle for crown, whether or
 * not it receives crown itself. A ceiling-height pantry or a refrigerator
 * surround at the same top line must still clip the neighbouring run's return
 * so no rail is ever drawn through a cabinet box.
 */
export function crownBlockingCabinets(placed: readonly PlacedCabinet[], room?: RoomData): PlacedCabinet[] {
  const eligibleUids = new Set(crownEligibleCabinets(placed, room).map((cabinet) => cabinet.uid));
  return placed.filter((cabinet) => (
    eligibleUids.has(cabinet.uid)
    || ((cabinet.placement === "tall" || cabinet.placement === "wall") && !usesRaisedFloorWallDoorPull(cabinet))
  ));
}

/**
 * Crown belongs only on exposed cabinet tops. A short glass wall cabinet that
 * is physically stacked on a wall cabinet replaces the lower cabinet's exposed
 * top, so crown moves to the glass stacker's top rather than running between
 * the two boxes. This resolves the same parent with the existing glass-stacker
 * placement contract, avoiding false suppression for nearby or mismatched runs.
 */
export function crownEligibleCabinets(placed: readonly PlacedCabinet[], room?: RoomData): PlacedCabinet[] {
  const eligible = placed.filter((cabinet) => isCrownEligibleCabinet(cabinet, room));
  if (!room) return eligible;

  const coveredLowerCabinetUids = new Set<string>();
  for (const stacker of placed) {
    if (stacker.placement !== "wall" || !isStacker(stacker) || !isGlassDoorCabinet(stacker)) continue;
    const parentPlacement = glassStackerParentPlacement(stacker, placed, room, stacker.stackedOnCabinetUid);
    if (!parentPlacement.ok) continue;
    const parent = eligible.find((cabinet) => cabinet.uid === parentPlacement.parentUid);
    if (!parent) continue;
    const parentBox = elevationBox(parent, room);
    const stackerBox = elevationBox(stacker, room);
    const parentTop = parentBox.bottom + parentBox.height;
    if (Math.abs(stackerBox.bottom - parentTop) <= COLLISION_EPSILON_IN) {
      coveredLowerCabinetUids.add(parent.uid);
    }
  }

  return eligible.filter((cabinet) => !coveredLowerCabinetUids.has(cabinet.uid));
}

export function crownLinearInches(placed: PlacedCabinet[], room?: RoomData): number {
  // Crown caps the top of upper (wall) cabinets and tall pantry/oven cabinets.
  const wallCabs = crownEligibleCabinets(placed, room);
  if (wallCabs.length === 0) return 0;
  if (!room) {
    // No room context: fall back to a single continuous run + one allowance.
    const run = wallCabs.reduce((s, p) => s + alongRunSpan(p), 0);
    return run + MITER_ALLOWANCE_IN;
  }
  return miteredTrimInches(wallCabs, room);
}

export function toeKickLinearInches(placed: PlacedCabinet[]): number {
  return placed
    .filter((p) => p.category !== "MasterTrac Closet" && (p.placement === "base" || p.placement === "tall"))
    .reduce((sum, p) => sum + alongRunSpan(p), 0);
}

export interface LightRailTakeoff {
  exposedLinearInches: number;
  installationAllowanceInches: number;
  totalLinearInches: number;
  assemblies: number;
}

export function isLightRailEligibleCabinet(p: PlacedCabinet, room?: RoomData): boolean {
  if (p.category === "MasterTrac Closet") return false;
  if (p.placement !== "wall") return false;
  if (usesRaisedFloorWallDoorPull(p)) return false;
  return !room || elevationBox(p, room).bottom > STD.TOE_KICK + COLLISION_EPSILON_IN;
}

/** Run-axis rectangle: back along the wall, front a catalog-depth normal away. */
type LightRailFootprint = { cabinet: PlacedCabinet; wall: string; start: number; end: number; depth: number };
function lightRailFootprint(p: PlacedCabinet, room?: RoomData): LightRailFootprint {
  const wall = room ? cabinetTakeoffWallId(p, room) : ((Math.round(p.rotation) % 180 + 180) % 180 === 0 ? "top" : "left");
  const start = room ? wallRunOffset(p, wall, room) : (wall === "top" ? p.x : p.y);
  return { cabinet: p, wall, start, end: start + alongRunSpan(p), depth: Number(p.depth) || STD.WALL_DEPTH };
}
function lightRailAssemblies(footprints: LightRailFootprint[]): LightRailFootprint[][] {
  const remaining = [...footprints];
  const groups: LightRailFootprint[][] = [];
  while (remaining.length > 0) {
    const group = [remaining.shift()!];
    for (let index = 0; index < group.length; index++) {
      for (let candidate = remaining.length - 1; candidate >= 0; candidate--) {
        const a = group[index];
        const b = remaining[candidate];
        if (a.wall === b.wall && a.start <= b.end + COLLISION_EPSILON_IN && b.start <= a.end + COLLISION_EPSILON_IN) {
          group.push(b);
          remaining.splice(candidate, 1);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}
function lightRailExposedEdgeInches(footprint: LightRailFootprint, all: LightRailFootprint[]): number {
  // The back edge is against its owning run, regardless of the wall's angle.
  // Side returns are hidden only by a touching same-run upper at the same depth.
  const joined = (end: "start" | "end") => all.some((other) => (
    other.cabinet.uid !== footprint.cabinet.uid
    && other.wall === footprint.wall
    && Math.abs(other.depth - footprint.depth) <= COLLISION_EPSILON_IN
    && (end === "start"
      ? Math.abs(other.end - footprint.start) <= COLLISION_EPSILON_IN
      : Math.abs(other.start - footprint.end) <= COLLISION_EPSILON_IN)
  ));
  return footprint.end - footprint.start + (joined("start") ? 0 : footprint.depth) + (joined("end") ? 0 : footprint.depth);
}
/**
 * Light rail follows the visible underside perimeter of upper cabinets: front
 * widths plus exposed depth returns, never hidden shared sides or wall backs.
 * Each connected installed assembly receives one four-inch cut/installation
 * allowance, so a standalone W1230 takes off at 12 + 12 + 12 + 4 = 40 inches.
 */
export function lightRailTakeoff(placed: PlacedCabinet[], room?: RoomData): LightRailTakeoff {
  const footprints = placed.filter((p) => isLightRailEligibleCabinet(p, room)).map((p) => lightRailFootprint(p, room));
  if (footprints.length === 0) return { exposedLinearInches: 0, installationAllowanceInches: 0, totalLinearInches: 0, assemblies: 0 };
  const assemblies = lightRailAssemblies(footprints);
  const exposedLinearInches = footprints.reduce((total, footprint) => total + lightRailExposedEdgeInches(footprint, footprints), 0);
  const installationAllowanceInches = assemblies.length * LIGHT_RAIL_INSTALLATION_ALLOWANCE_IN;
  return {
    exposedLinearInches,
    installationAllowanceInches,
    totalLinearInches: exposedLinearInches + installationAllowanceInches,
    assemblies: assemblies.length,
  };
}

// Light rail runs along the exposed underside of true upper cabinets only. It
// excludes wall backs, shared cabinet sides, island/floor wall casework, tall,
// base, and appliance cabinets.
export function lightRailLinearInches(placed: PlacedCabinet[], room?: RoomData): number {
  return lightRailTakeoff(placed, room).totalLinearInches;
}

// ─── Valance (VA) ────────────────────────────────────────────────────────────
// Arched valance is a decorative trim piece that spans above a window opening
// between wall cabinet runs. Only VA-48 exists in the catalog (48"W x 6"H,
// field-trimmed to fit the window width). One VA-48 piece is ordered per window
// on a wall that has wall cabinets.

export interface ValancePiece {
  code: string;   // always "VA-48" (the only catalog SKU)
  width: number;  // window width it covers (for display); piece is 48" trimmed on site
  wall: WallSide;
}

/**
 * Determine which valance pieces are needed for windows in the design.
 * A valance is suggested when a window sits on a wall that also has wall cabinets
 * (i.e., the window is between or adjacent to wall cabinet runs).
 * Each window gets one VA-48 piece (trimmed on site to fit).
 */
export function valancePiecesNeeded(
  openings: WallOpening[],
  placed: PlacedCabinet[],
  room?: RoomData,
): ValancePiece[] {
  const windows = openings.filter((o) => o.kind === "window");
  if (windows.length === 0) return [];
  // Walls that have at least one wall cabinet
  const wallsWithUppers = new Set<WallSide>();
  for (const p of placed) {
    if (p.placement === "wall" && p.cabinetId !== 0) {
      if (room) {
        wallsWithUppers.add(cabinetWall(p, room));
      } else {
        // Fallback: assume all walls have uppers
        wallsWithUppers.add("top");
        wallsWithUppers.add("bottom");
        wallsWithUppers.add("left");
        wallsWithUppers.add("right");
      }
    }
  }
  const pieces: ValancePiece[] = [];
  for (const win of windows) {
    // Only suggest valance if there are wall cabinets on the same wall
    if (!wallsWithUppers.has(win.side)) continue;
    // One VA-48 per window (trimmed to fit on site)
    pieces.push({ code: "VA-48", width: win.width, wall: win.side });
  }
  return pieces;
}

// ─── Batten molding (BAM) ─────────────────────────────────────────────────────
// Batten Molding is a slim 3/4" x 3/16" strip used to cover the VERTICAL seams
// where two cabinets (or a cabinet and a finished end panel) meet, giving a
// clean built-in look. Unlike crown/toe-kick (which run horizontally over
// cabinet widths), batten runs vertically, so the run is derived from the
// number of cabinet-to-cabinet seams x the seam height, not from cabinet width.
export const BATTEN_WIDTH_IN = 0.75;   // 3/4" face width
export const BATTEN_THICKNESS_IN = 0.1875; // 3/16" thickness

// Count adjacent cabinet seams on each wall: cabinets sitting flush edge-to-edge
// share a vertical seam that a batten can cover. We approximate the batten run
// as (number of seams) x (representative seam height). Wall cabinets use ~30",
// base/tall use their own height.
export function battenLinearInches(placed: PlacedCabinet[], room?: RoomData): number {
  if (placed.length < 2) return 0;
  // Group by wall so we only count seams between neighbours on the same wall.
  const groups = new Map<WallSide, PlacedCabinet[]>();
  for (const p of placed) {
    if (p.cabinetId === 0) continue;
    const wall: WallSide = room ? cabinetWall(p, room) : "top";
    const arr = groups.get(wall) ?? [];
    arr.push(p);
    groups.set(wall, arr);
  }
  let totalInches = 0;
  const TOL = 1.5; // inches of gap tolerance to still count as a shared seam
  for (const cabs of Array.from(groups.values())) {
    if (cabs.length < 2) continue;
    // Sort along the run axis (x). Walls are already grouped, so a simple x-sort
    // is sufficient to find edge-to-edge neighbours.
    const sorted = [...cabs].sort((a, b) => a.x - b.x);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const aEnd = a.x + rotatedSize(a).w;
      const bStart = b.x;
      if (Math.abs(bStart - aEnd) <= TOL) {
        // Shared seam: batten covers the taller of the two cabinet faces.
        const seamHeight = Math.max(placedHeight(a), placedHeight(b));
        totalInches += seamHeight;
      }
    }
  }
  return totalInches;
}

export function inchesToLinearFeet(inches: number): number {
  return Math.ceil((inches / 12) * 10) / 10; // 1 decimal, rounded up
}

// Trim (crown molding, toe kick) is sold in fixed stick lengths, not arbitrary
// fractional runs. Real ordering: measure the run, add a cut/waste allowance,
// then round UP to a whole number of standard sticks. Default stick = 96" (8 ft),
// default waste = 10%.
export const TRIM_STICK_INCHES = 96; // standard 8 ft trim stick
export const TRIM_WASTE = 0.1;       // 10% cut/waste allowance

export interface TrimOrder {
  pieces: number;      // whole sticks to order
  stickFeet: number;   // length of each stick, in feet (e.g. 8)
  orderedFeet: number; // total feet ordered (pieces * stickFeet)
  measuredFeet: number; // the raw measured run, in feet (1 decimal)
}

/**
 * Convert a measured trim run (in inches) into a sensible order: whole sticks
 * of `stickInches` length, including a `waste` allowance, rounded up.
 */
export function trimPiecesNeeded(
  runInches: number,
  stickInches: number = TRIM_STICK_INCHES,
  waste: number = TRIM_WASTE
): TrimOrder {
  const stickFeet = stickInches / 12;
  if (runInches <= 0) {
    return { pieces: 0, stickFeet, orderedFeet: 0, measuredFeet: 0 };
  }
  const withWaste = runInches * (1 + waste);
  const pieces = Math.max(1, Math.ceil(withWaste / stickInches));
  return {
    pieces,
    stickFeet,
    orderedFeet: pieces * stickFeet,
    measuredFeet: Math.round((runInches / 12) * 10) / 10,
  };
}

// ─── Countertops ────────────────────────────────────────────────────────────
// The Designer measures exact countertop area for material quantity and quoting.
// Selected whole slabs may carry a catalog price; edge work and fabrication remain quoted.
// Standard countertop depth is 25.5" (24" base box + ~1.5" front overhang).
// Island tops use the island footprint directly.
export const COUNTERTOP_DEPTH_IN = 25.5;

/**
 * A bathroom vanity keeps its catalog body depth in the shared countertop
 * geometry. Pelican vanity bases are 21 inches deep, so their finished top is
 * 22.5 inches (the standard 1.5-inch front overhang), not the kitchen-only
 * 25.5-inch depth. Other base/filler/corner families retain the established
 * 24-inch kitchen base standard and therefore remain 25.5 inches deep.
 */
export function countertopDepthForCabinet(cabinet: Pick<PlacedCabinet, "masterCode" | "description" | "category" | "subCategory" | "depth">): number {
  const source = `${cabinet.masterCode ?? ""} ${cabinet.category ?? ""} ${cabinet.subCategory ?? ""} ${cabinet.description ?? ""}`;
  const isVanity = /\bvanity\b/i.test(source) || /^(?:VSD|VDB|VDDB|VS)\d/i.test((cabinet.masterCode ?? "").trim());
  const cabinetDepth = Number(cabinet.depth);
  if (isVanity && Number.isFinite(cabinetDepth) && cabinetDepth > 0) {
    return cabinetDepth + 1.5;
  }
  return COUNTERTOP_DEPTH_IN;
}

export interface CountertopMeasurement {
  linearFeet: number; // total run of base cabinets that take a top, in feet
  squareFeet: number; // run x countertop depth (+ island + waterfall), in sq ft
  perimeterSquareFeet: number; // wall-run bases plus their existing waterfall panels
  islandSquareFeet: number; // exact rendered island slab area
  runInches: number;  // raw base run, inches
  hasIsland: boolean;
  waterfallSqFt: number; // extra sq ft from waterfall panels (height × depth per side)
}

export interface CountertopSlabMeasurement {
  width: number;
  depth: number;
}

/**
 * Measure the countertop needed for a layout: base-cabinet run x standard depth,
 * plus the island footprint if present. Wall/tall cabinets don't take a top.
 */
export function countertopArea(
  placed: PlacedCabinet[],
  island?: IslandZone | null,
  islandSlabs?: readonly CountertopSlabMeasurement[] | null,
  room?: RoomData | null,
): CountertopMeasurement {
  const hasExplicitIslandFaces = island ? placed.some((item) => item.islandFace != null) : false;
  const isIslandMember = (item: PlacedCabinet) => island != null && (
    hasExplicitIslandFaces ? item.islandFace != null : isOnIsland(item, island)
  );
  const perimeterPlaced = island ? placed.filter((item) => !isIslandMember(item)) : placed;
  const peninsulaRunIds = new Set((room?.peninsulaRuns ?? []).map((run) => run.id));
  const straightBases = perimeterPlaced
    .filter((p) => bearsCountertop(p) && !peninsulaRunIds.has(cabinetWall(p, room ?? DEFAULT_ROOM)));
  const straightRunInches = straightBases
    .reduce((sum, p) => sum + rotatedSize(p).w, 0);
  const straightCountertopSquareIn = straightBases
    .reduce((sum, p) => sum + rotatedSize(p).w * countertopDepthForCabinet(p), 0);
  const peninsulaSurfaces = room
    ? countertopSurfaces(perimeterPlaced, room).filter((surface) => Boolean(surface.peninsulaRunId))
    : [];
  const peninsulaRunInches = peninsulaSurfaces.reduce((sum, surface) => sum + (surface.runLinearInches ?? surface.linearInches ?? 0), 0);
  const peninsulaSquareIn = peninsulaSurfaces.reduce((sum, surface) => sum + (surface.areaInches ?? 0), 0);
  const runInches = straightRunInches + peninsulaRunInches;
  let squareIn = straightCountertopSquareIn + peninsulaSquareIn;
  let islandSquareIn = 0;
  const islandSupports = island ? placed.filter((item) => isIslandMember(item) && bearsIslandCountertop(item)) : [];
  const measuredIslandSquareIn = island && islandSlabs != null
    ? islandSlabs.reduce((sum, slab) => {
        const width = Number(slab.width);
        const depth = Number(slab.depth);
        return Number.isFinite(width) && Number.isFinite(depth) && width > 0 && depth > 0
          ? sum + width * depth
          : sum;
      }, 0)
    : null;
  const hasIsland = measuredIslandSquareIn == null ? islandSupports.length > 0 : measuredIslandSquareIn > 0;
  if (measuredIslandSquareIn != null) {
    squareIn += measuredIslandSquareIn;
    islandSquareIn = measuredIslandSquareIn;
  } else if (hasIsland && island) {
    const footprints = islandSupports.map((item) => ({ item, footprint: placedFootprint(item) }));
    const minX = Math.min(...footprints.map(({ item }) => item.x));
    const minY = Math.min(...footprints.map(({ item }) => item.y));
    const maxX = Math.max(...footprints.map(({ item, footprint }) => item.x + footprint.w));
    const maxY = Math.max(...footprints.map(({ item, footprint }) => item.y + footprint.d));
    const configuredOverhang = Number(island.countertopOverhang);
    const overhang = island.countertopOverhang == null || !Number.isFinite(configuredOverhang)
      ? 1.5
      : Math.max(0, Math.min(24, configuredOverhang));
    const slabWidth = island.countertopWidth ?? maxX - minX + overhang * 2;
    const slabDepth = island.countertopDepth ?? maxY - minY + overhang * 2;
    islandSquareIn = slabWidth * slabDepth;
    squareIn += islandSquareIn;
  }
  // Waterfall panels: each side adds height × depth (the panel is as tall as
  // the countertop height from floor and as deep as the cabinet depth).
  let waterfallSqIn = 0;
  for (const p of perimeterPlaced) {
    if (p.placement !== "base" || peninsulaRunIds.has(cabinetWall(p, room ?? DEFAULT_ROOM))) continue;
    const sides = (p.waterfallLeft ? 1 : 0) + (p.waterfallRight ? 1 : 0);
    if (sides === 0) continue;
    const h = placedHeight(p); // cabinet box height (typically 34.5")
    const d = p.depth;         // cabinet depth (typically 24")
    waterfallSqIn += sides * h * d;
  }
  for (const surface of peninsulaSurfaces) {
    if (surface.raisedBar) continue;
    const rootRun = room?.peninsulaRuns?.find((candidate) => candidate.id === surface.peninsulaRunId);
    const terminalRun = surface.peninsulaTerminalRunId
      ? room?.peninsulaRuns?.find((candidate) => candidate.id === surface.peninsulaTerminalRunId) ?? rootRun
      : rootRun;
    const reachesFarEnd = Boolean(surface.peninsulaTerminalRunId)
      || (surface.runStartIn ?? 0) + (surface.linearInches ?? surface.width) >= (terminalRun?.length ?? Number.POSITIVE_INFINITY) - COLLISION_EPSILON_IN;
    if (terminalRun && peninsulaCountertopWaterfallEnd(terminalRun, room ?? { peninsulaRuns: [] }) && reachesFarEnd) {
      const terminalDepth = COUNTERTOP_DEPTH_IN
        + peninsulaLowerWorktopOppositeSideExtensionIn(terminalRun, room ?? { peninsulaRuns: [] });
      waterfallSqIn += STD.BASE_HEIGHT * terminalDepth;
    }
  }
  squareIn += waterfallSqIn;
  const waterfallSqFt = Math.ceil((waterfallSqIn / 144) * 10) / 10;
  const perimeterSquareFeet = Math.ceil(((straightCountertopSquareIn + peninsulaSquareIn + waterfallSqIn) / 144) * 10) / 10;
  const islandSquareFeet = Math.ceil((islandSquareIn / 144) * 10) / 10;
  return {
    runInches,
    linearFeet: Math.round((runInches / 12) * 10) / 10,
    squareFeet: Math.ceil((squareIn / 144) * 10) / 10, // round up to 0.1 sq ft
    perimeterSquareFeet,
    islandSquareFeet,
    hasIsland,
    waterfallSqFt,
  };
}

// ─── Blind corner fillers ───────────────────────────────────────────────────
// Every BLIND corner cabinet (base BBC / wall WBC) must ship with a corner
// filler strip so the adjacent door/drawer has clearance to open past the blind
// section. We detect blind corners specifically (a subset of corner cabinets)
// and auto-add one filler per blind corner to the BOM. Standard blind-corner
// filler is 3" wide.
export const BLIND_CORNER_FILLER_WIDTH_IN = 3;

export function isBlindCorner(masterCode: string, description?: string): boolean {
  const code = (masterCode || "").toUpperCase();
  if (/^(BBC|WBC|BBL|BBR|WBL|WBR)/.test(code)) return true;
  if (/-BLIND|BLIND/.test(code)) return true;
  const desc = (description || "").toLowerCase();
  return /blind\s*corner/.test(desc);
}

/**
 * The pull-from-wall and required-filler specification belongs only to a
 * configured blind *base* cabinet. Wall blind cabinets retain their own
 * catalog-defined geometry and ordinary wall-cabinet behavior. Use the
 * catalog placement bucket carried onto the saved placement, rather than a
 * BBC/WBC code prefix, so Cabinet Config remains the source of truth.
 */
export function isBaseBlindCorner(
  cabinet: Pick<DesignCabinet, "masterCode" | "description" | "placement">
    | Pick<PlacedCabinet, "masterCode" | "description" | "placement">,
): boolean {
  return cabinet.placement === "base"
    && isBlindCorner(cabinet.masterCode, cabinet.description ?? undefined);
}

/**
 * Blind-corner master codes name their full physical run length. Supplier rows
 * sometimes store only the reduced box/opening width (BBC-36 was stored as 33),
 * which made placement, collision, fillers, and 3D disagree with the SKU.
 */
export function blindCornerNominalWidth(
  cabinet: { masterCode?: string | null; description?: string | null; width?: string | number | null; nominalWidth?: string | number | null },
): number {
  const code = `${cabinet.masterCode ?? ""}`.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const codedWidth = code.match(/^(?:BBC|WBC|BBL|BBR|WBL|WBR)(\d{2})/)?.[1];
  const parsedWidth = codedWidth == null ? Number.NaN : Number(codedWidth);
  if (Number.isFinite(parsedWidth) && parsedWidth >= 12 && parsedWidth <= 96) return parsedWidth;
  const nominal = Number(cabinet.nominalWidth);
  if (Number.isFinite(nominal) && nominal > 0) return nominal;
  const stored = Number(cabinet.width);
  return Number.isFinite(stored) && stored > 0 ? stored : 24;
}

export interface FillerLine {
  kind: "base" | "wall";
  count: number;
  width: number; // inches each
}

// Resolve the fixed trade-standard blind-corner pull range. A BBC's hidden
// portion must stay between 3" and 6"; older imports could carry width-derived
// or otherwise invalid values such as 9", which must never enlarge a cabinet,
// filler, countertop, or collision reservation. Existing values are retained
// as metadata for audit, but the physical design rule is always clamped here.
export function blindPullRange(
  p: { pullMin?: number | null; pullMax?: number | null; width?: number | null; nominalWidth?: number | null }
): { min: number; max: number } | null {
  const TRADE_MIN_PULL_IN = 3;
  const TRADE_MAX_PULL_IN = 6;
  const requestedMin = typeof p.pullMin === "number" ? p.pullMin : TRADE_MIN_PULL_IN;
  const requestedMax = typeof p.pullMax === "number" ? p.pullMax : TRADE_MAX_PULL_IN;
  const min = Math.max(TRADE_MIN_PULL_IN, Math.min(TRADE_MAX_PULL_IN, requestedMin));
  const max = Math.max(TRADE_MIN_PULL_IN, Math.min(TRADE_MAX_PULL_IN, requestedMax));
  return max < min ? { min: max, max: min } : { min, max };
}

// The reason a blind corner cabinet is flagged, so the UI can show a tailored
// message. "missing-spec" -> administrator must enter the manufacturer pull;
// "out-of-range" -> the installed pull is outside [min,max].
export type BlindSpecIssue = "missing-spec" | "out-of-range";

// Validate blind corner cabinets against their manufacturer pull spec. For each
// blind corner cabinet:
//  - If it carries NO pullMin/pullMax spec -> "missing-spec" (conflict: the
//    administrator must enter the manufacturer's min/max pull before ordering).
//  - If it has a spec but its installed width-across-the-corner is outside
//    [pullMin, pullMax] -> "out-of-range".
// Returns a map of uid -> issue so the UI can flag and explain each one.
export function blindCornerSpecViolations(
  placed: PlacedCabinet[]
): Map<string, BlindSpecIssue> {
  const out = new Map<string, BlindSpecIssue>();
  for (const p of placed) {
    if (!isBaseBlindCorner(p)) continue;
    const range = blindPullRange(p);
    if (!range) {
      // Only flag missing-spec if the cabinet has explicit pullMin/pullMax
      // that are invalid. Since we now default to 3-6", this won't fire.
      out.set(p.uid, "missing-spec");
      continue;
    }
    // The "pull" is the blind portion (how many inches are hidden behind the
    // perpendicular wall). We can't reliably measure this from the placed
    // cabinet alone without room context, so we skip range validation here.
    // The auto-stop logic in DesignTool already enforces correct positioning.
  }
  return out;
}

// Count blind corners in a layout and return the required filler lines, split
// by base vs wall so the BOM can label them correctly. One filler per blind
// corner cabinet.
export function blindCornerFillers(placed: PlacedCabinet[]): FillerLine[] {
  let base = 0;
  let wall = 0;
  for (const p of placed) {
    if (!isBlindCorner(p.masterCode, p.description)) continue;
    if (p.placement === "wall") wall += 1;
    else base += 1;
  }
  const out: FillerLine[] = [];
  if (base > 0) out.push({ kind: "base", count: base, width: BLIND_CORNER_FILLER_WIDTH_IN });
  if (wall > 0) out.push({ kind: "wall", count: wall, width: BLIND_CORNER_FILLER_WIDTH_IN });
  return out;
}

// Result of attempting to auto-place a blind corner's opposite-side filler.
// `filler` is a ready-to-place 3" filler when we can confidently determine the
// corner and the pull side. `ambiguous` is true when we cannot — per the trade
// rule "if in doubt, put it in conflict", the caller should NOT guess and should
// leave the blind corner flagged so the user resolves it manually.
export interface BlindAutoFillerResult {
  filler: PlacedCabinet | null;
  ambiguous: boolean;
  reason?: string;
}

// When a blind corner is seated in a room corner, the mandatory 3-inch filler
// belongs on the PERPENDICULAR adjoining run at the BBC's exposed front edge.
// That clearance keeps the next cabinet's door, drawer, and handles from
// striking the blind-corner front. The filler remains fixed at that same
// corner-wall distance while the BBC itself pulls 3-6 inches along its owning
// wall; the pull never moves, widens, or replaces the required filler.
export function blindCornerAutoFiller(
  blind: PlacedCabinet,
  room: RoomData,
  makeUidFn: () => string = makeUid
): BlindAutoFillerResult {
  if (!isBlindCorner(blind.masterCode, blind.description)) {
    return { filler: null, ambiguous: false, reason: "not-blind" };
  }
  const wall = cabinetWall(blind, room);
  const horizontal = wall === "top" || wall === "bottom";
  const footprint = placedFootprint(blind);
  const W = BLIND_CORNER_FILLER_WIDTH_IN;

  // Resolve which end of the owning wall is the room corner.
  const runStart = horizontal ? blind.x : blind.y;
  const runSpan = horizontal ? footprint.w : footprint.d;
  const runEnd = runStart + runSpan;
  const runMax = horizontal ? room.width : room.depth;

  // Which end sits in the room corner? A corner end is within tolerance of 0 or
  // the wall's far end. If NEITHER end is in a corner, the placement is
  // ambiguous — we can't tell which side the pull/return faces.
  const pullMax = blindPullRange(blind)?.max ?? 6;
  // A pulled BBC is intentionally several inches off the corner on its short
  // return. Treat any position inside the manufacturer's pull envelope as the
  // same corner ownership; the back remains seated on the owning wall.
  const T = pullMax + 2;
  const atStart = runStart <= T;
  const atEnd = runEnd >= runMax - T;
  if (atStart === atEnd) {
    // Both in a corner (cabinet spans the whole wall) or neither -> ambiguous.
    return { filler: null, ambiguous: true, reason: "corner-undetermined" };
  }

  const adjacentWall: WallSide = horizontal
    ? (atStart ? "left" : "right")
    : (atStart ? "top" : "bottom");
  const rearGap = blindCornerRearCountertopExtensionIn(blind, room);
  const ownerWallDepth = horizontal ? footprint.d : footprint.w;
  const frontDistanceFromCorner = rearGap + ownerWallDepth;
  const adjacentWallLength = adjacentWall === "top" || adjacentWall === "bottom" ? room.width : room.depth;
  const adjacentCornerAtStart = adjacentWall === "left" || adjacentWall === "right"
    ? wall === "top"
    : wall === "left";
  const fillerAlong = adjacentCornerAtStart
    ? frontDistanceFromCorner
    : adjacentWallLength - frontDistanceFromCorner - W;
  if (fillerAlong < -0.01 || fillerAlong + W > adjacentWallLength + 0.01) {
    return { filler: null, ambiguous: true, reason: "no-room-for-filler" };
  }

  // Build a confirmed installed filler on the perpendicular adjoining wall.
  const fillerPlacement: Placement = blind.placement === "wall" ? "wall" : "base";
  const fillerDepth = fillerPlacement === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH;
  const blindHeight = Number(blind.height);
  const fillerHeight = Number.isFinite(blindHeight) && blindHeight > 0
    ? blindHeight
    : fillerPlacement === "wall" ? STD.WALL_HEIGHT : STD.BASE_HEIGHT;
  const spot = wallPlacementAt(fillerAlong, W, fillerDepth, adjacentWall, room);
  const fillerGroupId = `blind-filler-${blind.uid}`;
  const filler: PlacedCabinet = {
    uid: makeUidFn(),
    cabinetId: 0,
    masterCode: `FILL-${W}`,
    description: `${W}" Blind Corner Filler (opposite pull)`,
    category: "Filler",
    subCategory: "Filler",
    placement: fillerPlacement,
    x: spot.x,
    y: spot.y,
    width: W,
    nominalWidth: W,
    depth: fillerDepth,
    nominalDepth: fillerDepth,
    height: fillerHeight,
    nominalHeight: fillerHeight,
    rotation: spot.rotation,
    numberOfDoors: 0,
    numberOfDrawers: 0,
    fillerPieceGroupId: fillerGroupId,
    fillerBillingRole: "primary",
    fillerTotalWidth: W,
    fillerPlacementMode: adjacentCornerAtStart ? "left" : "right",
  };
  return { filler, ambiguous: false };
}

// ─── Explicit wall placement ────────────────────────────────────────────────
// Snap a placed cabinet flush to a chosen wall, keeping it inside the room and
// preserving its position along that wall (clamped). Used by the wall-selector
// UI so a user can place a cabinet on the wall they actually want instead of
// relying on drag-proximity guessing.
export function snapToWall(p: PlacedCabinet, side: WallSide, room: RoomData): { x: number; y: number } {
  // Use the square plan footprint so L-corner cabinets seat flush to the wall
  // (their stored depth may be the shallow leg depth, which would leave a gap on
  // the bottom/right walls and break corner-notch rotation).
  const { w, d } = placedFootprint(p);
  // Keep the position along the wall but clamp it inside the room.
  let x = Math.max(0, Math.min(p.x, Math.max(0, room.width - w)));
  let y = Math.max(0, Math.min(p.y, Math.max(0, room.depth - d)));
  switch (side) {
    case "top":
      y = 0;
      break;
    case "bottom":
      y = Math.max(0, room.depth - d);
      break;
    case "left":
      x = 0;
      break;
    case "right":
      x = Math.max(0, room.width - w);
      break;
  }
  return { x, y };
}

/**
 * Wall cabinets are mounted products, not free-standing room objects. Preserve
 * their along-wall position and mount height, but always reseat their shallow
 * depth against the wall they already belong to.
 */
export function snapWallCabinetToOwningWall(p: PlacedCabinet, room: RoomData): PlacedCabinet {
  if (p.placement !== "wall" || p.islandFace) return p;
  const side = cabinetWall(p, room);
  const frame = wallRunFrame(side, room);
  if (!frame) return p;
  // Corner bodies keep their own corner seating rules.
  if (placedCornerGeometryKind(p) !== "standard") {
    if (frame.kind !== "cardinal") return p;
    const { x, y } = snapToWall(p, side, room);
    return { ...p, x, y, depthPositionAdjusted: false };
  }
  // Re-seat the shallow box against the wall it belongs to through the shared
  // run frame: the along-run position of the CURRENT body is kept (a drag may
  // have moved x/y without refreshing wallOffset), the depth is pushed to the wall.
  const projectedAlong = wallRunAlongAtPoint(frame, placedPlanCenter(p)) - p.width / 2;
  const savedAlong = p.wallId === side && p.wallOffset != null ? Number(p.wallOffset) : null;
  const along = savedAlong != null && Math.abs(savedAlong - projectedAlong) <= 0.5 ? savedAlong : projectedAlong;
  const spot = wallPlacementAt(along, p.width, p.depth, side, room, p.peninsulaSide);
  // A saved same-axis half turn is a valid record of the same run on any
  // wall; keep it rather than rewriting the plan graphic.
  const sameAxis = ((Math.round(p.rotation) % 180) + 180) % 180 === ((spot.rotation % 180) + 180) % 180;
  const rotation = sameAxis ? p.rotation : spot.rotation;
  if (Math.abs(spot.x - p.x) <= COLLISION_EPSILON_IN && Math.abs(spot.y - p.y) <= COLLISION_EPSILON_IN && rotation === p.rotation && p.wallId === spot.wallId && p.wallOffset === spot.wallOffset) return p;
  return { ...p, ...spot, rotation, wallId: spot.wallId, wallOffset: spot.wallOffset, depthPositionAdjusted: false };
}

// ─── Room dimension parsing / formatting ────────────────────────────────────
// Room dimensions are stored in inches. The editable UI lets users type feet +
// inches, so we convert between the two. Clamp to a sane kitchen range.
export const ROOM_MIN_IN = 36;   // 3 ft
export const ROOM_MAX_IN = 480;  // 40 ft

export function feetInchesToInches(feet: number, inches: number): number {
  const total = (Number.isFinite(feet) ? feet : 0) * 12 + (Number.isFinite(inches) ? inches : 0);
  return clampRoomInches(total);
}

/**
 * Parse a free-form tape-measure length into inches (unclamped).
 * Accepts: 10' 6", 10ft 6in, 126", 126, 120 1/2, 10' 6 1/2", 8.5', 102.5
 * Returns null when the string can't be understood.
 */
export function parseLengthToInches(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw).trim().toLowerCase();
  if (!s) return null;
  // normalize unit words/symbols to ' (feet) and " (inches)
  s = s
    .replace(/feet|foot|ft/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/inches|inch|in\b/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/''/g, '"');
  s = s.replace(/\s+/g, " ").trim();

  // turn a numeric token (with optional fraction) into a number
  const toNum = (tok: string): number | null => {
    tok = tok.trim();
    if (!tok) return null;
    const mixed = tok.match(/^(\d+)\s*[- ]\s*(\d+)\s*\/\s*(\d+)$/);
    if (mixed) {
      const den = parseInt(mixed[3], 10);
      if (den === 0) return null;
      return parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / den;
    }
    const frac = tok.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (frac) {
      const den = parseInt(frac[2], 10);
      if (den === 0) return null;
      return parseInt(frac[1], 10) / den;
    }
    if (/^\d+(\.\d+)?$/.test(tok)) return parseFloat(tok);
    return null;
  };

  let feet = 0;
  let inches = 0;
  let matched = false;

  const footMatch = s.match(/^([\d./\- ]+?)'/);
  if (footMatch) {
    const f = toNum(footMatch[1]);
    if (f != null) { feet = f; matched = true; }
    s = s.slice(footMatch[0].length).trim();
  }

  const inchStr = s.replace(/"/g, "").trim();
  if (inchStr) {
    const i = toNum(inchStr);
    if (i != null) { inches = i; matched = true; }
    else if (!matched) return null;
  }

  if (!matched) return null;
  const total = feet * 12 + inches;
  if (!Number.isFinite(total) || total <= 0) return null;
  return total;
}

export function inchesToFeetInches(totalInches: number): { feet: number; inches: number } {
  const t = Math.round(totalInches);
  return { feet: Math.floor(t / 12), inches: t % 12 };
}

export function clampRoomInches(inches: number): number {
  if (!Number.isFinite(inches)) return ROOM_MIN_IN;
  return Math.max(ROOM_MIN_IN, Math.min(ROOM_MAX_IN, Math.round(inches)));
}


// ─── Active-wall placement ──────────────────────────────────────────────────
// The Design Tool has a persistent "active wall" the user selects. Newly added
// cabinets/appliances are placed flush against that wall and march along it,
// packing next to the existing items already on that wall. This makes adding a
// run of cabinets to a specific wall predictable instead of guessing.

export const WALL_LABELS: Record<WallSide, string> = {
  top: "Back",
  bottom: "Front",
  left: "Left",
  right: "Right",
};

// Is the placed item sitting against `side` (within a tolerance)?
export function isAgainstWall(p: PlacedCabinet, side: WallSide, room: RoomData): boolean {
	  const rotated = rotatedSize(p);
	  const cornerKind = placedCornerGeometryKind(p);
	  const trueRoomCorner = cornerKind === "l-shape" || cornerKind === "diagonal" || cornerKind === "corner-drawer" || cornerKind === "triangle";
	  const footprint = trueRoomCorner ? placedFootprint(p) : rotated;
	  const T = 2; // inches tolerance
	  switch (side) {
	    case "top":
	      return Math.abs(p.y - 0) <= T;
	    case "bottom":
	      return trueRoomCorner
	        ? p.y <= room.depth + T && p.y + footprint.d >= room.depth - T
	        : Math.abs(p.y + rotated.d - room.depth) <= T;
	    case "left":
	      return Math.abs(p.x - 0) <= T;
	    case "right":
	      return trueRoomCorner
	        ? p.x <= room.width + T && p.x + footprint.w >= room.width - T
	        : Math.abs(p.x + rotated.w - room.width) <= T;
	  }
}

// Find the next free position for a `width`×`depth` item placed flush against
// `side`, marching along that wall and packing past items already on it.
// Returns inches. Falls back to the wall's start corner if the wall is full.
export function nextFreeSpotOnWall(
  width: number,
  depth: number,
  placement: Placement,
  side: WallSide,
  room: RoomData,
  existing: PlacedCabinet[]
): { x: number; y: number; rotation: number } {
  const horizontal = side === "top" || side === "bottom";
  // The cabinet is authored as width(along front) × depth(into room) at
  // rotation 0. On the back/front (horizontal) walls it keeps that orientation.
  // On the left/right (vertical) walls we rotate it 90°, so its ORIGINAL depth
  // now runs along the wall and its ORIGINAL width faces into the room.
  const alongSpan = horizontal ? width : depth;
  const intoRoom = horizontal ? depth : depth;

  // Fixed coordinate pinned to the wall.
  let x = 0;
  let y = 0;
  if (side === "top") y = 0;
  if (side === "bottom") y = Math.max(0, room.depth - intoRoom);
  if (side === "left") x = 0;
  if (side === "right") x = Math.max(0, room.width - intoRoom);

  // Items already on the same wall + layer, sorted along the wall axis.
  const onWall = existing
    .filter((p) => p.placement === placement && isAgainstWall(p, side, room))
    .map((p) => {
      const s = rotatedSize(p);
      const along = horizontal ? p.x : p.y;
      const span = horizontal ? s.w : s.d;
      return { along, span };
    })
    .sort((a, b) => a.along - b.along);

  // March a cursor along the wall, pushing past any overlapping neighbor.
  let cursor = 0;
  for (const item of onWall) {
    if (cursor < item.along + item.span && cursor + alongSpan > item.along) {
      cursor = item.along + item.span;
    }
  }

  const wallLen = horizontal ? room.width : room.depth;
  // If it runs off the end, just clamp to the wall start (will overlap-flag in UI).
  if (cursor + alongSpan > wallLen) cursor = Math.max(0, wallLen - alongSpan);

  if (horizontal) x = cursor;
  else y = cursor;

  // Rotation needed so the cabinet's depth faces into the room from this wall.
  // Base footprint is width(along) × depth(into) at rotation 0 (top/bottom wall).
  // Left/right walls need a 90° turn so depth runs horizontally into the room.
  const rotation = horizontal ? 0 : 90;

  return { x, y, rotation };
}

// ─── Range / oven corner clearance rule ─────────────────────────────────────
// Trade rule: when a range or oven sits at a wall CORNER directly adjacent to a
// cabinet, a filler must separate the appliance from that cabinet so the range
// handle (and the cabinet door/drawer handle) have clearance and don't collide.
// Standard clearance filler is 3" (same width as a blind-corner filler).
//
// We flag a range/oven when:
//   (1) it is a range or oven appliance/cabinet (masterCode RANGE-* / OVEN, or
//       description mentions range/oven), AND
//   (2) one of its run-axis ends is AT a wall corner (the appliance touches the
//       start or end of the wall it sits on), AND
//   (3) a real cabinet butts up against that SAME end closer than the required
//       clearance filler width.
// Returns the uids of the offending range/oven items so the UI can warn and
// offer a one-click "Add clearance filler".
export const RANGE_CLEARANCE_FILLER_IN = 3;

export function isRangeOrOven(masterCode?: string | null, description?: string | null): boolean {
  const code = (masterCode || "").toUpperCase();
  const desc = (description || "").toLowerCase();
  // RHF is a wood wall-cabinet range-hood FRONT. It must never acquire range
  // appliance collision, countertop, or mounting behavior just because its
  // source description includes the words “Range Hood Front”.
  if (/^RHF[\s_-]*\d/.test(code) || /range\s*hood\s*front/.test(desc)) return false;
  if (/^(RANGE|OVEN|RNG|OV|STOVE|STV|COOKTOP|CT)[\s_-]*\d/.test(code) || /^(RANGE|OVEN|RNG|OV|STOVE|STV|COOKTOP|CT)$/.test(code)) return true;
  return /\brange\b|\boven\b|\bstove\b|\bcooktop\b/.test(desc);
}

// An OVER-THE-RANGE microwave specifically (MW-*), as opposed to a range hood.
// This is the appliance that auto-mounts over the cooktop/range and pairs with a
// short "bridge" wall cabinet above it. Hoods (HOOD-*) are excluded because they
// vent rather than hang a cabinet above.
export function isOverRangeMicrowave(p: {
  masterCode?: string | null;
  placement?: Placement;
}): boolean {
  if (p.placement !== "appliance") return false;
  return /^MW-/.test((p.masterCode || "").toUpperCase());
}

/**
 * Identifies a real W30 microwave bridge without confusing an ordinary W3024
 * upper elsewhere in the plan. New placements persist the explicit ownership
 * flag; older drafts are recognized only when a permitted W30 box is centered
 * over an actual MW-30/range pair on the same physical wall.
 */
export function isOverRangeMicrowaveBridge(
  cabinet: PlacedCabinet,
  placed: readonly PlacedCabinet[],
  room: RoomData,
): boolean {
  if (cabinet.placement !== "wall") return false;
  if (cabinet.overRangeMicrowaveBridge === true) return true;
  const code = (cabinet.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^W30(?:12|15|18|21|24)$/.test(code)) return false;
  const dimensions = wallCabinetSkuDimensions(cabinet.masterCode);
  if (!dimensions || dimensions.width !== 30) return false;
  const side = cabinetWall(cabinet, room);
  const bridgeCenter = wallRunOffset(cabinet, side, room) + wallRunSpan(cabinet, side, room) / 2;
  const microwave = placed.find((candidate) => (
    isOverRangeMicrowave(candidate)
    && cabinetWall(candidate, room) === side
    && Math.abs(
      wallRunOffset(candidate, side, room) + wallRunSpan(candidate, side, room) / 2 - bridgeCenter,
    ) <= 0.5
  ));
  return Boolean(microwave && placed.some((candidate) => isMicrowaveOverRangePair(microwave, candidate)));
}

// The standard short "bridge" wall cabinet SKU that mounts directly above an
// over-range microwave of a given width. Bridge cabinets fill the gap between
// the OTR microwave top and the wall cabinet top line. The bridge height depends
// on the chosen wall cabinet height:
//   30" walls → 12" bridge
//   33" walls → 15" bridge
//   36" walls → 18" bridge
//   39" walls → 21" bridge
//   42" walls → 24" bridge
// Widths that are not a stock bridge width snap to the nearest available stock
// width (30, 33, or 36) so we always suggest a real, orderable SKU.
export const BRIDGE_STOCK_WIDTHS = [30, 33, 36] as const;
export const BRIDGE_STOCK_HEIGHTS = [12, 15, 18, 21, 24] as const;

/** Map wall cabinet height to the appropriate bridge height. */
export function bridgeHeightForWallHeight(wallCabH: number): number {
  if (wallCabH >= 42) return 24;
  if (wallCabH >= 39) return 21;
  if (wallCabH >= 36) return 18;
  if (wallCabH >= 33) return 15;
  return 12;
}

export function bridgeCabinetCodeForWidth(width: number, wallCabHeight?: number): string {
  const w = Number.isFinite(width) ? width : 30;
  // Snap to the nearest stock bridge width.
  const nearest = BRIDGE_STOCK_WIDTHS.reduce((best, cand) =>
    Math.abs(cand - w) < Math.abs(best - w) ? cand : best
  , BRIDGE_STOCK_WIDTHS[0]);
  const bh = bridgeHeightForWallHeight(wallCabHeight ?? 30);
  return `W-${nearest}-${bh}`;
}

// True for a refrigerator appliance (FRIDGE-*). Refrigerators trigger the
// Refrigerator Options flow (cabinet above + end panels + smooth panel) when
// dropped, and the surround pieces mounted above/beside them are exempt from
// the appliance-vs-cabinet collision check because they live in a different
// vertical zone (upper) or are thin flat panels flush to the fridge side.
export function isRefrigerator(p: {
  masterCode?: string | null;
  placement?: Placement;
}): boolean {
  if (p.placement !== "appliance") return false;
  return /^FRIDGE-/.test((p.masterCode || "").toUpperCase());
}

/** A dedicated refrigerator-wall/bridge cabinet, not an ordinary upper. */
export function isRefrigeratorWallCabinet(p: Pick<PlacedCabinet, "masterCode" | "description" | "placement">): boolean {
  if (p.placement !== "wall") return false;
  const code = (p.masterCode ?? "").toUpperCase();
  const description = (p.description ?? "").toLowerCase();
  return /^WR\d{4}$/.test(code) || /^RW[-\d]/.test(code) || /refrigerator\s*(wall|bridge|cabinet|upper)/.test(description);
}

/**
 * The single source of truth for a refrigerator bay on any wall type.  The
 * refrigerator itself remains its source-sized appliance.  The clear opening is
 * one half inch wider at each side; finished panels sit outside that opening.
 * Every placement, move, recovery, dimension display, and countertop break uses
 * these measured run-axis values instead of an image or Three.js envelope.
 */
export function refrigeratorBayRunMetrics(
  refrigerator: PlacedCabinet,
  room: RoomData,
) {
  const side = cabinetWall(refrigerator, room);
  const refrigeratorStart = wallRunOffset(refrigerator, side, room);
  const refrigeratorWidth = wallRunSpan(refrigerator, side, room);
  const refrigeratorEnd = refrigeratorStart + refrigeratorWidth;
  const openingStart = refrigeratorStart - REFRIGERATOR_SIDE_CLEARANCE_IN;
  const openingEnd = refrigeratorEnd + REFRIGERATOR_SIDE_CLEARANCE_IN;
  return {
    side,
    refrigeratorStart,
    refrigeratorEnd,
    refrigeratorWidth,
    refrigeratorCenter: refrigeratorStart + refrigeratorWidth / 2,
    openingStart,
    openingEnd,
    openingWidth: refrigeratorWidth + REFRIGERATOR_SIDE_CLEARANCE_IN * 2,
  };
}

export function refrigeratorAssemblyMemberRole(
  member: PlacedCabinet,
  refrigerator: PlacedCabinet,
  room: RoomData,
): RefrigeratorAssemblyRole | null {
  if (member.refrigeratorAssemblyId === refrigerator.uid && member.refrigeratorAssemblyRole) {
    return member.refrigeratorAssemblyRole;
  }
  if (cabinetWall(member, room) !== cabinetWall(refrigerator, room)) return null;
  const side = cabinetWall(refrigerator, room);
  const refrigeratorStart = wallRunOffset(refrigerator, side, room);
  const refrigeratorEnd = refrigeratorStart + wallRunSpan(refrigerator, side, room);
  const memberStart = wallRunOffset(member, side, room);
  const memberEnd = memberStart + wallRunSpan(member, side, room);
  if (isRefrigeratorWallCabinet(member) && footprintsOverlap(member, refrigerator)) return "bridge";
  // A saved plan may use a correctly sized ordinary wall SKU above the appliance
  // rather than a source record whose name is explicitly "refrigerator wall".
  // It is still the refrigerator enclosure cap when it spans the appliance and
  // uses the refrigerator-top-plus-two-inch installation datum. Treating that
  // physical assembly as a bridge lets the normal source-backed side-panel repair run, while a
  // standard 54-inch wall cabinet remains an ordinary wall cabinet.
  const memberSpan = memberEnd - memberStart;
  const refrigeratorSpan = refrigeratorEnd - refrigeratorStart;
  const memberElevation = elevationBox(member, room);
  const refrigeratorElevation = elevationBox(refrigerator, room);
  const refrigeratorUpperDatum = refrigeratorSurroundElevation(
    room,
    refrigeratorElevation.bottom + refrigeratorElevation.height,
    memberElevation.height,
  ).mountBottom;
  if (
    member.placement === "wall"
    && footprintsOverlap(member, refrigerator)
    && Math.abs(memberSpan - refrigeratorSpan) <= 0.25
    && Math.abs(memberElevation.bottom - refrigeratorUpperDatum) <= 0.25
  ) return "bridge";
  if (!isRefrigeratorEndPanel(member)) return null;
  if (Math.abs(memberEnd - refrigeratorStart) <= 3) return "left-panel";
  if (Math.abs(memberStart - refrigeratorEnd) <= 3) return "right-panel";
  return null;
}

export function refrigeratorAssemblyMembers(
  placed: PlacedCabinet[],
  refrigerator: PlacedCabinet,
  room?: RoomData | null,
) {
  const enclosure = room ?? DEFAULT_ROOM;
  return placed.flatMap((member) => {
    if (member.uid === refrigerator.uid) return [];
    const role = refrigeratorAssemblyMemberRole(member, refrigerator, enclosure);
    return role ? [{ member, role }] : [];
  });
}

/**
 * Returns only source parts that were expressly selected in this refrigerator's
 * Attributes dialog. This is intentionally narrower than
 * `refrigeratorAssemblyMembers`: that inspection helper can identify an old,
 * correctly seated enclosure by physical geometry, while a move may never
 * silently absorb a nearby manually placed cabinet or panel.
 *
 * Some saved designs predate the durable role field but retain the explicit
 * refrigeratorAssemblyId written by the Attributes transaction. Their source
 * parts remain an intentional assembly, so recover only their missing role
 * from already-linked geometry and persist it after a successful move.
 */
export function configuredRefrigeratorAssemblyMembers(
  placed: PlacedCabinet[],
  refrigerator: PlacedCabinet,
  room?: RoomData | null,
) {
  const enclosure = room ?? DEFAULT_ROOM;
  return placed.flatMap((member) => {
    if (member.uid === refrigerator.uid || member.refrigeratorAssemblyId !== refrigerator.uid) return [];
    const role = member.refrigeratorAssemblyRole
      ?? refrigeratorAssemblyMemberRole(member, refrigerator, enclosure);
    return role ? [{ member, role }] : [];
  });
}

/**
 * Measured, source-geometry proof for a completed refrigerator bay. The same
 * values drive the 3D inspector and regression fixtures: they deliberately use
 * the catalog appliance span and persisted member locations, never a rendered
 * appliance mesh or a screen-space bounding box.
 */
export function refrigeratorBayVerificationMetrics(
  placed: PlacedCabinet[],
  refrigerator: PlacedCabinet,
  room?: RoomData | null,
): {
  refrigeratorWidth: number;
  openingWidth: number;
  leftGap: number | null;
  rightGap: number | null;
  bridgeCenterOffset: number | null;
  hasLeftPanel: boolean;
  hasRightPanel: boolean;
} {
  const enclosure = room ?? DEFAULT_ROOM;
  const metrics = refrigeratorBayRunMetrics(refrigerator, enclosure);
  const members = refrigeratorAssemblyMembers(placed, refrigerator, enclosure);
  const leftPanel = members.find(({ role }) => role === "left-panel")?.member;
  const rightPanel = members.find(({ role }) => role === "right-panel")?.member;
  const bridge = members.find(({ role }) => role === "bridge")?.member;
  const leftGap = leftPanel
    ? metrics.refrigeratorStart - (wallRunOffset(leftPanel, metrics.side, enclosure) + wallRunSpan(leftPanel, metrics.side, enclosure))
    : null;
  const rightGap = rightPanel
    ? wallRunOffset(rightPanel, metrics.side, enclosure) - metrics.refrigeratorEnd
    : null;
  const bridgeCenterOffset = bridge
    ? (wallRunOffset(bridge, metrics.side, enclosure) + wallRunSpan(bridge, metrics.side, enclosure) / 2) - metrics.refrigeratorCenter
    : null;
  return {
    refrigeratorWidth: metrics.refrigeratorWidth,
    openingWidth: metrics.openingWidth,
    leftGap,
    rightGap,
    bridgeCenterOffset,
    hasLeftPanel: Boolean(leftPanel),
    hasRightPanel: Boolean(rightPanel),
  };
}

/**
 * The refrigerator box is not always the physical edge that should meet the
 * next base cabinet.  When the owner explicitly selected refrigerator end
 * panels, the exposed panel edge is the run boundary; the box itself sits
 * behind that source-sized panel plus the required appliance clearance.
 *
 * This returns only the actual, already-selected panel extension.  It never
 * invents a panel or treats a loose/tall cabinet as part of the refrigerator.
 * The common wall-run magnet consumes this envelope so a refrigerator snaps to
 * a B36 (or any other floor cabinet) without driving its selected panel into
 * the base cabinet.
 */
export function refrigeratorMagneticSnapEnvelope(
  refrigerator: PlacedCabinet,
  placed: PlacedCabinet[],
  room?: RoomData | null,
): { startExtensionIn: number; endExtensionIn: number } {
  const enclosure = room ?? DEFAULT_ROOM;
  if (!isRefrigerator(refrigerator)) return { startExtensionIn: 0, endExtensionIn: 0 };
  const side = cabinetWall(refrigerator, enclosure);
  const refrigeratorStart = wallRunOffset(refrigerator, side, enclosure);
  const refrigeratorEnd = refrigeratorStart + wallRunSpan(refrigerator, side, enclosure);
  let startExtensionIn = 0;
  let endExtensionIn = 0;
  for (const { member, role } of configuredRefrigeratorAssemblyMembers(placed, refrigerator, enclosure)) {
    if (role !== "left-panel" && role !== "right-panel") continue;
    // A configured part must remain on the refrigerator's own wall run.  This
    // excludes stale legacy metadata from influencing a live drag.
    if (cabinetWall(member, enclosure) !== side) continue;
    const memberStart = wallRunOffset(member, side, enclosure);
    const memberEnd = memberStart + wallRunSpan(member, side, enclosure);
    if (role === "left-panel") {
      startExtensionIn = Math.max(startExtensionIn, refrigeratorStart - memberStart);
    } else {
      endExtensionIn = Math.max(endExtensionIn, memberEnd - refrigeratorEnd);
    }
  }
  return {
    startExtensionIn: roundToEighth(Math.max(0, startExtensionIn)),
    endExtensionIn: roundToEighth(Math.max(0, endExtensionIn)),
  };
}

export const REFRIGERATOR_UPPER_CLEARANCE_IN = 2;

export function refrigeratorSurroundElevation(_room: RoomData | null | undefined, fridgeTop: number, upperHeight: number) {
  // A refrigerator upper always begins two inches above the *actual selected
  // refrigerator height*. The normal 70-inch appliance therefore begins at the
  // familiar 72-inch installation datum, while another source-sized appliance
  // keeps the same verified clearance instead of intersecting its upper.
  const mountBottom = Math.max(0, fridgeTop) + REFRIGERATOR_UPPER_CLEARANCE_IN;
  return { mountBottom, top: mountBottom + upperHeight };
}

/**
 * Re-seat a dedicated refrigerator wall cabinet on top of its matching
 * refrigerator. This repairs legacy plans that stored WR3624 as a normal upper
 * at the standard 54-inch wall mount, where it visibly ran into a refrigerator.
 * A dedicated refrigerator cabinet starts two inches above its selected
 * appliance height and then tops out at the surrounding tall-cabinet cap.
 * Ordinary wall cabinets deliberately remain unchanged and are still rejected
 * by the refrigerator collision rule.
 */
export function normalizeRefrigeratorBayUppers(placed: PlacedCabinet[], _room?: RoomData | null): PlacedCabinet[] {
  // Compatibility shim for saved designs. A refrigerator, cabinet-above,
  // filler, and end panels are independent catalog parts; do not infer, move,
  // resize, create, remove, or group them during normal plan processing.
  return placed;
}

/** Commits one changed cabinet without moving any neighboring catalog part. */
export function commitIndependentCabinetCandidate(
  placed: PlacedCabinet[],
  candidate: PlacedCabinet,
): PlacedCabinet[] {
  return placed.map((item) => item.uid === candidate.uid ? candidate : item);
}

/**
 * Moves a refrigerator with only the cap, cap fillers, and end panels that were
 * explicitly selected in its own options dialog.  These source-priced members
 * are a physical surround, not unrelated cabinets: treating them as external
 * collision peers prevents the refrigerator from moving at all (for example it
 * reports an overlap with its own F342 filler).  Manual W1842s, loose panels,
 * and every other cabinet remain peers and are never moved or absorbed.
 */
export function commitConfiguredRefrigeratorCandidate(
  placed: PlacedCabinet[],
  refrigeratorUid: string,
  candidate: PlacedCabinet,
  room?: RoomData | null,
): PlacedCabinet[] | null {
  const source = placed.find((item) => item.uid === refrigeratorUid);
  if (!source || !isRefrigerator(source)) return null;
  const enclosure = room ?? DEFAULT_ROOM;
  const members = configuredRefrigeratorAssemblyMembers(placed, source, enclosure)
    .map(({ member, role }) => ({ ...member, refrigeratorAssemblyRole: role }));
  if (members.length === 0) return commitIndependentCabinetCandidate(placed, candidate);

  const memberUids = new Set(members.map((item) => item.uid));
  const peers = placed.filter((item) => item.uid !== refrigeratorUid && !memberUids.has(item.uid));
  const side = cabinetWall(candidate, enclosure);
  const metrics = refrigeratorBayRunMetrics(candidate, enclosure);
  const bridge = members.find((item) => item.refrigeratorAssemblyRole === "bridge");
  const bridgeHeight = Math.max(0, Number(bridge?.height) || 0);
  const surround = bridgeHeight > 0
    ? refrigeratorSurroundElevation(
      enclosure,
      elevationBox(candidate, enclosure).bottom + elevationBox(candidate, enclosure).height,
      bridgeHeight,
    )
    : null;

  const repositioned = members.map((member) => {
    const role = member.refrigeratorAssemblyRole!;
    const span = wallRunSpan(member, cabinetWall(member, enclosure), enclosure);
    const depth = Math.max(0, Number(member.depth) || 0);
    const along = role === "bridge"
      ? metrics.refrigeratorStart + (metrics.refrigeratorWidth - span) / 2
      : role === "bridge-left-filler"
        ? metrics.openingStart
        : role === "bridge-right-filler"
          ? metrics.refrigeratorEnd
          : role === "left-panel"
            ? metrics.openingStart - span
            : role === "right-panel"
              ? metrics.openingEnd
              : wallRunOffset(member, cabinetWall(member, enclosure), enclosure);
    const spot = wallPlacementAtUnbounded(along, span, depth, side, enclosure, candidate.peninsulaSide);
    return {
      ...member,
      ...spot,
      refrigeratorAssemblyId: candidate.uid,
      refrigeratorAssemblyRole: role,
      ...(role === "bridge" && surround ? { mountBottom: surround.mountBottom } : {}),
      ...((role === "bridge-left-filler" || role === "bridge-right-filler") && surround
        ? { mountBottom: surround.mountBottom, height: bridgeHeight }
        : {}),
      ...(role === "left-panel" || role === "right-panel"
        ? { mountBottom: 0, height: surround?.top ?? member.height }
        : {}),
    };
  });

  const runLength = wallLength(side, enclosure);
  const insideRun = (item: PlacedCabinet) => {
    const start = wallRunOffset(item, side, enclosure);
    const span = wallRunSpan(item, side, enclosure);
    if (start < -COLLISION_EPSILON_IN || start + span > runLength + COLLISION_EPSILON_IN) return false;
    const clamped = clampCabinetToRoom(item, enclosure);
    return Math.abs(clamped.x - item.x) <= COLLISION_EPSILON_IN
      && Math.abs(clamped.y - item.y) <= COLLISION_EPSILON_IN;
  };
  const group = [candidate, ...repositioned];
  if (group.some((item) => !insideRun(item))) return null;
  if (group.some((item) => cabinetPlacementCollisionDetail(item, peers, enclosure))) return null;

  const replacements = new Map<string, PlacedCabinet>([
    [candidate.uid, candidate],
    ...repositioned.map((item) => [item.uid, item] as const),
  ]);
  return placed.map((item) => replacements.get(item.uid) ?? item);
}

/**
 * Legacy compatibility hook. Earlier builds moved neighboring cabinets away
 * from refrigerator panel seams during restore, which silently changed a user's
 * saved run. Earlier cabinets are now authoritative; invalid newer panels are
 * rejected when the enclosure is added or when collision cleanup restores the
 * saved order. Never move an accepted cabinet here.
 */
export function normalizeRefrigeratorPanelSeams(placed: PlacedCabinet[], _room?: RoomData | null): PlacedCabinet[] {
  return placed;
}

// ── Staggered built-in look ────────────────────────────────────────────────
// A custom "stepped" upper run reads richer than a flat wall of identical
// cabinets: the ends and the refrigerator/corner cabinet step UP (taller) and
// the fridge/corner box steps OUT (deeper), and crown wraps the stagger. These
// constants + helpers capture the shop rules the owner uses:
//   - End cabinets on BOTH ends of an upper run are +6" TALLER than the
//     standard wall cabinet (finished taller bookends).
//   - The refrigerator / corner deep upper projects to 27" DEEP (proud of the
//     24" fridge box / 12" standard uppers) and is also +6" TALLER.
//   - A furred-out corner packs a corner wall cabinet out ~3" (a 2x4 behind it)
//     so its FACE steps proud of the neighbors for the same stepped look.
export const STAGGER_TALLER_IN = 6; // ends + fridge/corner upper are 6" taller
export const FRIDGE_CORNER_UPPER_DEPTH_IN = 27; // deep proud projection
export const FURRED_OUT_CORNER_IN = 3; // 2x4 pack-out behind a corner cabinet

// The finished height of a standard wall cabinet (before any stagger bump).
export function standardWallCabinetHeight(): number {
  return STD.WALL_HEIGHT;
}

// The height of a "stepped-up" cabinet (an end cabinet or the fridge/corner
// upper): the standard wall height plus the stagger bump.
export function staggeredWallCabinetHeight(baseHeight: number = STD.WALL_HEIGHT): number {
  const h = Number.isFinite(baseHeight) && baseHeight > 0 ? baseHeight : STD.WALL_HEIGHT;
  return h + STAGGER_TALLER_IN;
}

// Mount bottom for a stepped-up cabinet so its TOP finishes at the same top
// line as the rest of the run (the run caps flush; only the step is taller, so
// a taller box hangs LOWER at the bottom while sharing the top line). Given the
// run's top line and the stepped height, bottom = topLine - height.
export function staggeredMountBottom(topLine: number, height: number): number {
  return topLine - height;
}

// Depth of the refrigerator/corner deep upper for the proud stagger look.
export function fridgeCornerUpperDepth(): number {
  return FRIDGE_CORNER_UPPER_DEPTH_IN;
}

// A built-in OVEN CABINET (O338424, UOC3390, TOS2DB3084, TOD3094 ...) is a
// 24"-deep tall cabinet with the oven inside a 24" opening: the oven door and
// handle stay inside the box and can never reach a neighbor. It is a cabinet,
// not a free-standing range, so the corner handle-clearance filler never
// applies on either side of it (user rule, 2026-10-19). A "Range Base"
// (RB2DB30 ...) is likewise just a base cabinet under a cooktop.
export function isBuiltInOvenCabinet(p: {
  masterCode?: string | null;
  description?: string | null;
  placement?: string | null;
}): boolean {
  if (p.placement === "appliance") return false;
  const code = (p.masterCode || "").toUpperCase();
  const desc = (p.description || "").toLowerCase();
  if (/^(?:UOC|TOS|TOD|O3\d)/.test(code)) return true;
  return /\boven\b/.test(desc) && (p.placement === "tall" || p.placement === "wall" || p.placement === "base");
}
export function rangeOvenClearanceViolations(
  placed: PlacedCabinet[],
  room: RoomData,
  fillerIn = RANGE_CLEARANCE_FILLER_IN
): Set<string> {
  const bad = new Set<string>();
  // Only a FREE-STANDING range/oven appliance has a protruding front handle that
  // can strike a neighbor's handle. Cabinets that merely contain or sit under
  // one (oven cabinets, range bases) are ordinary cabinets and never qualify.
  const ranges = placed.filter(
    (p) => p.placement === "appliance" && isRangeOrOven(p.masterCode, p.description) && !isBuiltInOvenCabinet(p)
  );
  for (const range of ranges) {
    const side = cabinetWall(range, room);
    const horizontal = side === "top" || side === "bottom";
    const wallLen = horizontal ? room.width : room.depth;
    const rs = rotatedSize(range);
    const start = horizontal ? range.x : range.y;
    const end = start + (horizontal ? rs.w : rs.d);
    const atStartCorner = Math.abs(start - 0) <= 1.0;
    const atEndCorner = Math.abs(end - wallLen) <= 1.0;
    if (!atStartCorner && !atEndCorner) continue;

    // Look for a real cabinet butting the INTERIOR end of the range (the end
    // that faces into the run, away from the corner).
    for (const o of placed) {
      if (o.uid === range.uid) continue;
      if (o.placement !== "base" && o.placement !== "tall") continue;
      if (isRangeOrOven(o.masterCode, o.description)) continue;
      // An oven cabinet beside a range never needs a filler (its oven door and
      // handle stay inside the 24" opening).
      if (isBuiltInOvenCabinet(o)) continue;
      // Skip a filler/scribe that is already doing its job.
      if (/\bfiller\b|\bscribe\b/i.test(`${o.masterCode} ${o.description}`)) continue;
      if (cabinetWall(o, room) !== side) continue;
      const os = rotatedSize(o);
      const oStart = horizontal ? o.x : o.y;
      const oEnd = oStart + (horizontal ? os.w : os.d);
      // The neighbor must overlap the appliance's depth-band (same run) — since
      // both are on the same wall that's already true; check run-axis gap.
      let gap: number | null = null;
      if (atStartCorner) {
        // Interior end is `end`; neighbor should be to the right of it.
        if (oStart >= end - 1.0) gap = oStart - end;
      } else {
        // atEndCorner: interior end is `start`; neighbor to the left of it.
        if (oEnd <= start + 1.0) gap = start - oEnd;
      }
      if (gap != null && gap >= -0.5 && gap < fillerIn - 0.01) {
        bad.add(range.uid);
      }
    }
  }
  return bad;
}

// Result of an auto-filler pass: the (possibly extended) placed array plus the
// uids of the fillers that were inserted, so the UI can report how many were
// added and the caller can decide whether anything changed.
export interface RangeFillerResult {
  placed: PlacedCabinet[];
  added: PlacedCabinet[];
}

// Auto-place the required clearance filler(s) next to any range/oven that sits
// at a wall corner directly against a cabinet (the violations reported by
// rangeOvenClearanceViolations). For each violating appliance we insert a
// `fillerIn`-wide (default 3") filler on the INTERIOR side of the appliance —
// the side that faces away from the corner and toward the adjacent cabinet —
// and shift that neighboring cabinet (and any cabinets further down the run on
// the same wall, on the appliance's interior side) outward by the filler width
// so the filler has room. This gives the range handle and the cabinet door/
// drawer handle clearance to operate without colliding.
export function autoPlaceRangeFillers(
  placed: PlacedCabinet[],
  room: RoomData,
  fillerIn = RANGE_CLEARANCE_FILLER_IN,
  makeUidFn: () => string = makeUid
): RangeFillerResult {
  const violations = rangeOvenClearanceViolations(placed, room, fillerIn);
  if (violations.size === 0) return { placed, added: [] };

  // Work on a shallow copy so callers get a new array only when something
  // changed; individual cabinets we shift are replaced with new objects.
  const next = placed.slice();
  const added: PlacedCabinet[] = [];

  for (const uid of Array.from(violations)) {
    const idx = next.findIndex((p) => p.uid === uid);
    if (idx < 0) continue;
    const range = next[idx];
    const side = cabinetWall(range, room);
    const horizontal = side === "top" || side === "bottom";
    const wallLen = horizontal ? room.width : room.depth;
    const rs = rotatedSize(range);
    const start = horizontal ? range.x : range.y;
    const end = start + (horizontal ? rs.w : rs.d);
    const atStartCorner = Math.abs(start - 0) <= 1.0;

    // The interior end is the end facing away from the corner. The filler sits
    // just past that interior end; everything on the run beyond it gets nudged.
    // atStartCorner  -> corner at `start`, interior end is `end`, filler to the
    //                   right/down; shift cabinets with run-start >= end.
    // atEndCorner    -> corner at `end`, interior end is `start`, filler to the
    //                   left/up; shift cabinets with run-end <= start.
    const fillerAlong = atStartCorner ? end : start - fillerIn;

    const fillerDepth = STD.BASE_DEPTH;
    const fillerHeight = STD.BASE_HEIGHT;
    let fx: number, fy: number, fw: number, fd: number;
    if (horizontal) {
      fx = fillerAlong;
      fy = side === "top" ? 0 : Math.max(0, room.depth - fillerDepth);
      fw = fillerIn;
      fd = fillerDepth;
    } else {
      fy = fillerAlong;
      fx = side === "left" ? 0 : Math.max(0, room.width - fillerDepth);
      fw = fillerDepth;
      fd = fillerIn;
    }

    // Shift neighbor cabinets on the interior side outward by fillerIn so the
    // new filler has room. Only same-wall base/tall cabinets are moved.
    for (let i = 0; i < next.length; i++) {
      const o = next[i];
      if (o.uid === range.uid) continue;
      if (o.placement !== "base" && o.placement !== "tall") continue;
      if (cabinetWall(o, room) !== side) continue;
      const os = rotatedSize(o);
      const oStart = horizontal ? o.x : o.y;
      const oEnd = oStart + (horizontal ? os.w : os.d);
      const onInterior = atStartCorner ? oStart >= end - 1.0 : oEnd <= start + 1.0;
      if (!onInterior) continue;
      const delta = atStartCorner ? fillerIn : -fillerIn;
      next[i] = horizontal
        ? { ...o, x: clampInRoom(o.x + delta, 0, wallLen - os.w) }
        : { ...o, y: clampInRoom(o.y + delta, 0, wallLen - os.d) };
    }

    const filler: PlacedCabinet = {
      uid: makeUidFn(),
      cabinetId: 0,
      masterCode: `FILL-${fillerIn}`,
      description: `${fillerIn}" Range/Oven Clearance Filler`,
      placement: "base",
      x: fx,
      y: fy,
      width: fw,
      depth: fd,
      height: fillerHeight,
      rotation: horizontal ? 0 : 90,
    };
    next.push(filler);
    added.push(filler);
  }

  return { placed: next, added };
}

// Clamp a run-axis position into [lo, hi], tolerating hi < lo (returns lo).
function clampInRoom(v: number, lo: number, hi: number): number {
  if (hi < lo) return lo;
  return Math.max(lo, Math.min(v, hi));
}

// Wall cabinets must keep at least this clearance (inches) from doors and
// windows on both sides of the opening. Base cabinets are exempt (counters/
// fillers can run beneath a window), so this buffer is only applied when
// filling the WALL layer.
export const WALL_OPENING_CLEARANCE_IN = 3;

export type CabinetPlacementHoverDetail = {
  title: string;
  dimensions: CabinetDimensionsIn;
  clearance: string;
};

/**
 * Returns a concise, physically accurate hover explanation for the two
 * frequently positioned 24-inch items. A drawer base and dishwasher are both
 * allowed to meet a neighboring base at the exact shared edge: their required
 * cabinet-run clearance is zero, while positive overlap remains blocked.
 *
 * Dimensions always come from the current catalog record rather than a
 * hard-coded nominal value so an approved shallow/deep supplier variant is
 * described truthfully in the palette and floor plan.
 */
export function cabinetPlacementHoverDetail(
  cabinet: Pick<DesignCabinet, "masterCode" | "placement" | "description"> & {
    width?: string | number | null;
    height?: string | number | null;
    depth?: string | number | null;
  },
): CabinetPlacementHoverDetail | null {
  const normalizedCode = (cabinet.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const isDishwasher = /^DW\d*$/.test(normalizedCode) || /^DISHWASHER\d*$/.test(normalizedCode);
  const isDb24 = /^(?:\d+)?DB24(?:[A-Z0-9]*)$/.test(normalizedCode);
  if (!isDishwasher && !isDb24) return null;

  const dimensions = resolvedDesignCabinetDimensions({
    id: 0,
    masterCode: cabinet.masterCode,
    description: cabinet.description,
    category: null,
    subCategory: null,
    width: cabinet.width == null ? null : String(cabinet.width),
    height: cabinet.height == null ? null : String(cabinet.height),
    depth: cabinet.depth == null ? null : String(cabinet.depth),
    placement: cabinet.placement,
    numberOfDoors: null,
    numberOfDrawers: null,
    isCornerCabinet: null,
  });
  const label = isDishwasher ? "Dishwasher" : "DB24 drawer base";
  return {
    title: label,
    dimensions,
    clearance: "0 in. at either adjoining cabinet seam — flush edge contact is allowed; physical overlap is not.",
  };
}

// Wall cabinets must keep a minimum clearance (default 3") from door/window
// openings. Returns the uids of WALL cabinets whose run-axis extent comes within
// `clearance` inches of any opening on the SAME wall (including overlap). Used
// for the design-check warning. Pure + deterministic.
export function wallOpeningClearanceViolations(
  placed: PlacedCabinet[],
  openings: WallOpening[],
  room: RoomData,
  clearance = WALL_OPENING_CLEARANCE_IN
): Set<string> {
  const bad = new Set<string>();
  if (openings.length === 0) return bad;
	  for (const p of placed) {
	    if (p.placement !== "wall") continue;
	    // Fillers are seam trim, not wall-cabinet faces that require opening clearance.
	    if (isFillerItem(p)) continue;
	    const side = cabinetWall(p, room);
	    const cStart = wallRunOffset(p, side, room);
	    const cEnd = cStart + wallRunSpan(p, side, room);
    for (const o of openings) {
      if (o.side !== side) continue;
      if (wallCabinetClearsWindow(p, o, room, clearance)) continue;
      const oStart = o.offset;
      const oEnd = o.offset + o.width;
      // Gap between the cabinet span and the opening span along the run axis.
      // Negative gap means they overlap; positive means a clear distance.
      const gap = Math.max(oStart - cEnd, cStart - oEnd);
      if (gap < clearance - 0.01) {
        bad.add(p.uid);
        break;
      }
    }
  }
  return bad;
}

// Base (and tall/appliance) cabinets must not sit ACROSS a floor-blocking
// opening (a door or a cased pass-through). Returns the uids of floor-layer
// cabinets whose run-axis extent overlaps any door/opening on the SAME wall.
// Windows are ignored (a base cabinet can sit under a window). Pure +
// deterministic so it can be unit-tested.
export function baseOpeningOverlaps(
  placed: PlacedCabinet[],
  openings: WallOpening[],
  room: RoomData
): Set<string> {
  const bad = new Set<string>();

	  for (const p of placed) {
	    // Floor layer = base + appliance; tall spans the floor too.
	    if (p.placement === "wall") continue;
	    // Fillers close a measured seam and do not create a floor-run opening
	    // conflict of their own.
	    if (isFillerItem(p)) continue;
	    const side = cabinetWall(p, room);
	    const cStart = wallRunOffset(p, side, room);
	    const cEnd = cStart + wallRunSpan(p, side, room);
    for (const o of openings) {
      if (o.side !== side) continue;
      const blocksFloorPlacement = blocksFloorRun(o.kind)
        || windowVerticallyOverlapsCabinet(p, o, room);
      if (!blocksFloorPlacement) continue;
      const oStart = o.offset;
      const oEnd = o.offset + o.width;
      // Any positive overlap along the run axis is a conflict.
      const overlap = Math.min(cEnd, oEnd) - Math.max(cStart, oStart);
      if (overlap > 0.01) {
        bad.add(p.uid);
        break;
      }
    }
  }
  return bad;
}

// ─── Free wall segments (break the run around openings) ─────────────────────
// Compute the OPEN gaps along a wall's run axis, after removing the run-axis
// extents of existing same-layer cabinets and the openings that actually block
// that layer. Windows reserve the upper/wall-cabinet layer but a base cabinet,
// drawer base, or dishwasher can legitimately sit below a window. Floor-level
// doors and cased openings still break every floor run.
//
// Returns segments as { start, length } in inches along the wall's run axis
// (X for top/bottom walls, Y for left/right). Only segments >= `minLen` are
// returned. Pure + deterministic so it can be unit-tested.
export interface WallSegment {
  start: number;
  length: number;
}

/**
 * Finds the nearest collision-free start coordinate for a cabinet span on one
 * wall run. Candidate starts are clamped inside every segment that can contain
 * the span; distance ties intentionally resolve toward the left/start edge.
 */
export function nearestAvailableWallStart(
  segments: WallSegment[],
  requestedStart: number,
  span: number,
): number | null {
  if (!Number.isFinite(span) || span <= 0) return null;
  const candidates = segments
    .filter((segment) => segment.length + 0.001 >= span)
    .map((segment) => Math.max(segment.start, Math.min(requestedStart, segment.start + segment.length - span)));
  if (candidates.length === 0) return null;
  return candidates.reduce((best, candidate) => {
    const candidateDistance = Math.abs(candidate - requestedStart);
    const bestDistance = Math.abs(best - requestedStart);
    return candidateDistance < bestDistance || (candidateDistance === bestDistance && candidate < best)
      ? candidate
      : best;
  });
}

/**
 * Applies the Designer's ordinary near-edge magnetic behavior to an explicit
 * continuous wall or peninsula run. The measured wall remains the authority:
 * a cabinet can be placed freely within a clear segment when it is not near an
 * edge, but a drag within the shared snap threshold resolves to the exact
 * adjoining run seam. This avoids tiny visual gaps and prevents a later 3D
 * chassis from disagreeing with the plan collision model.
 */
export function magneticAvailableWallStart(
  segments: WallSegment[],
  requestedStart: number,
  span: number,
  threshold = STD.SNAP_THRESHOLD,
): number | null {
  const nearest = nearestAvailableWallStart(segments, requestedStart, span);
  if (nearest == null || !Number.isFinite(threshold) || threshold < 0) return nearest;
  const edgeCandidates = segments
    .filter((segment) => segment.length + 0.001 >= span)
    .flatMap((segment) => [
      segment.start,
      segment.start + segment.length - span,
    ])
    .filter((edge) => Math.abs(edge - requestedStart) <= threshold + COLLISION_EPSILON_IN)
    .sort((left, right) => Math.abs(left - requestedStart) - Math.abs(right - requestedStart) || left - right);
  return edgeCandidates[0] ?? nearest;
}

export function freeSegmentsOnWall(
  side: WallSide,
  room: RoomData,
  placed: PlacedCabinet[],
  openings: WallOpening[],
  minLen = 9,
  // Extra clearance padded onto EACH side of every opening before computing
  // free segments. Pass WALL_OPENING_CLEARANCE_IN when tiling wall cabinets.
  openingClearance = 0,
  // Which placement LAYER we're tiling. Items only block their own layer: wall
  // cabinets hang ABOVE base cabinets, so a wall cabinet must tile against other
  // wall cabinets only (and vice-versa). Defaults to "base" for back-compat.
  layer: Placement = "base",
  // Full-height floor appliances (refrigerators) reserve the upper wall band
  // in addition to their normal appliance/base span.
  reserveUpperZone = false,
  // A short bridge may cross a window only when its explicit mount height
  // clears the opening vertically.
  candidate?: PlacedCabinet,
  // A 12-inch upper reaches less far into a 45-degree corner than a 24-inch
  // base. Callers that know the intended cabinet pass its real depth here.
  layerDepth?: number,
): WallSegment[] {
  const frame = wallRunFrame(side, room);
  const peninsulaRun = peninsulaRunById(room, side);
  // ONE run source on every wall kind: the frame's usable run (a peninsula may
  // shorten a standard wall; drawn walls and peninsulas use their full length).
  const wallStart = frame ? frame.runStart : 0;
  const wallEnd = frame ? frame.runEnd : wallLength(side, room);
  const wallLen = wallEnd;

  // Collect blocked [start, end] intervals along the run axis.
  const blocked: { s: number; e: number }[] = [];
  if (peninsulaRun && ["base", "tall", "appliance"].includes(layer)) {
    // A child 45-degree run owns the near-end reservation. Its parent reserves
    // the matching far end. No 11-inch rule applies to a 90-degree return.
    if (peninsulaRun.parentRunId && peninsulaRun.turn === 45) {
      blocked.push({ s: 0, e: Math.min(PENINSULA_INSIDE_CORNER_CLEARANCE_IN, wallLen) });
    }
    if (peninsulaRunHas45EndInsideCornerClearance(peninsulaRun, room)) {
      blocked.push({ s: Math.max(0, wallLen - PENINSULA_INSIDE_CORNER_CLEARANCE_IN), e: wallLen });
    }
  }

  // Inside-corner installation hold by join angle on the actual cabinet layer.
  // A 45° join holds 11 inches for a 24-inch base, 5.5 inches for a 12-inch
  // upper, and proportionally for other real cabinet depths.
  if (frame && frame.kind !== "peninsula" && ["base", "wall", "tall"].includes(layer)) {
    const defaultDepth = layer === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH;
    // The hold protects an *ordinary* run cabinet from intruding into a turn.
    // A true L/diagonal/blind corner cabinet has its own explicit corner-seat
    // geometry and must not be rejected by the ordinary-run hold. Keep the
    // proven base reference for that candidate; its adjoining legs are still
    // reserved below for every following cabinet.
    const candidateIsTrueCorner = candidate != null && (
      placedCornerGeometryKind(candidate) === "l-shape"
      || placedCornerGeometryKind(candidate) === "diagonal"
      || placedCornerGeometryKind(candidate) === "corner-drawer"
      || placedCornerGeometryKind(candidate) === "blind-corner"
    );
    const requestedDepth = candidateIsTrueCorner
      ? defaultDepth
      : Math.max(0, Number(layerDepth ?? candidate?.depth) || defaultDepth);
    const startJoin = wallRunJoinAt(frame, "start", room);
    const endJoin = wallRunJoinAt(frame, "end", room);
    const startHold = startJoin ? insideCornerHoldIn(startJoin.turnDeg, requestedDepth) : 0;
    const endHold = endJoin ? insideCornerHoldIn(endJoin.turnDeg, requestedDepth) : 0;
    if (startHold > 0) blocked.push({ s: 0, e: Math.min(startHold, wallLen) });
    if (endHold > 0) blocked.push({ s: Math.max(0, wallLen - endHold), e: wallLen });
  }

  // Only items on the SAME layer (wall vs floor) block this run. Tall cabinets
  // span floor-to-ceiling, so they block BOTH the base and wall layers.
  const blocksThisLayer = (item: PlacedCabinet): boolean => {
    const pl = item.placement;
    if (pl === "tall") return true;
    if (reserveUpperZone && pl === "wall") return true;
    if (layer === "tall") return pl === "base" || pl === "appliance" || pl === "wall";
    // A refrigerator occupies the standard upper-cabinet elevation band. Normal
    // wall-run sequencing must reserve that span, while a dedicated refrigerator
    // wall cabinet may deliberately share it above the appliance.
    if (layer === "wall") return pl === "wall" || isRangeHoodPlacement(item) || (reserveUpperZone && isRefrigerator(item));
    // base/appliance share the floor layer
    return pl === "base" || pl === "appliance";
  };
  for (const p of placed) {
    // Island-face cabinets are attached to the island's own perimeter. Their
    // plan footprint can be nearer to a room wall than the island's outline,
    // but they are never members of a room-wall run and must not shorten a
    // Wall mode opening or its remaining-clearance display.
    if (p.islandFace) continue;
    if (!blocksThisLayer(p)) continue;
    // Ordinary cabinets belong only to their oriented wall. A true room-corner
    // footprint (lazy Susan/easy reach, diagonal corner, or corner drawer)
    // physically reserves both wall legs, however. Include that footprint on
    // the adjoining wall so a catalog click/drop starts at the corner's actual
    // edge instead of being created inside it and rejected as a full overlap.
    const assignedWall = cabinetWall(p, room);
    const cornerKind = placedCornerGeometryKind(p);
    const trueCorner = cornerKind === "l-shape" || cornerKind === "diagonal" || cornerKind === "corner-drawer" || cornerKind === "blind-corner";
    // A true corner box seated at the vertex shared by its own wall and this
    // one reserves its adjoining leg here. The join is resolved on the run
    // frames, so a rectangle corner and a drawn-wall vertex are the same case.
    const cornerJoin = (() => {
      if (!trueCorner || assignedWall === side || !frame) return null;
      const sourceFrame = wallRunFrame(assignedWall, room);
      if (!sourceFrame) return null;
      const sourceLength = sourceFrame.length;
      const sourceStart = wallRunOffset(p, assignedWall, room);
      const sourceEnd = sourceStart + wallRunSpan(p, assignedWall, room);
      // A configured BBC stays at the same room corner even when its blind
      // portion is deliberately pulled 3–6 inches along its owning wall. Its
      // full 24-inch adjoining leg must still reserve the adjacent run;
      // otherwise a false 0–24-inch opening invites a DW-24 into the BBC body.
      const cornerSeatTolerance = isBaseBlindCorner(p)
        ? Math.max(2, blindPullRange(p)?.max ?? 0)
        : 2;
      const atSourceStart = sourceStart <= cornerSeatTolerance;
      const atSourceEnd = sourceEnd >= sourceLength - cornerSeatTolerance;
      for (const at of ["start", "end"] as const) {
        const join = wallRunJoinAt(frame, at, room);
        if (!join || join.frame.id !== sourceFrame.id) continue;
        const sharedIsSourceStart = Math.hypot(join.frame.start.x - (at === "start" ? frame.start : frame.end).x, join.frame.start.y - (at === "start" ? frame.start : frame.end).y) <= 0.01;
        if ((sharedIsSourceStart && atSourceStart) || (!sharedIsSourceStart && atSourceEnd)) return { at };
      }
      return null;
    })();
	    const reservesAdjoiningWall = trueCorner && (cornerJoin != null || isAgainstWall(p, side, room));
    if (assignedWall !== side && !reservesAdjoiningWall) continue;
    if (assignedWall !== side && cornerJoin) {
      // The next unit must butt the corner's exposed outer edge. The apparent
      // 12-inch L notch is interior access space, not a valid parallel cabinet
      // run. Reserve the corner box's full leg along this run from the shared
      // vertex (36-inch LSB36/ERB36 envelope, 24-inch diagonal/blind leg) —
      // one rule for a rectangle corner and a drawn-wall vertex alike.
      const envelope = placedFootprint(p);
      const adjacentLeg = cornerKind === "l-shape"
        ? Math.max(0, envelope.w)
        : Math.min(envelope.w, envelope.d);
      if (cornerJoin.at === "start") {
        blocked.push({ s: 0, e: Math.min(wallLen, adjacentLeg) });
      } else {
        blocked.push({ s: Math.max(0, wallLen - adjacentLeg), e: wallLen });
      }
      continue;
    }
    // A raised short bridge above a sink/window can share the plan projection
    // with a neighboring upper only when its elevation band is genuinely
    // separate. Same-height uppers still reserve their run as before.
    if (layer === "wall" && candidate && p.placement === "wall") {
      const candidateBox = elevationBox(candidate, room);
      const placedBox = elevationBox(p, room);
      const verticallySeparate =
        candidateBox.bottom >= placedBox.bottom + placedBox.height - 0.01 ||
        placedBox.bottom >= candidateBox.bottom + candidateBox.height - 0.01;
      if (verticallySeparate) continue;
    }
    if (assignedWall !== side) {
      // A true corner box reserved on its adjoining leg blocks its full square envelope.
      const envelope = placedFootprint(p);
      const start = side === "top" || side === "bottom" ? p.x : p.y;
      const span = side === "top" || side === "bottom" ? envelope.w : envelope.d;
      blocked.push({ s: start, e: start + span });
      continue;
    }
    const start = wallRunOffset(p, side, room);
    const span = wallRunSpan(p, side, room);
    blocked.push({ s: start, e: start + span });
  }

  // Openings on this wall. A raised window blocks only a cabinet whose actual
  // elevation reaches its sill-to-top zone. Doors and cased openings still
  // block floor layers. Candidate-aware use keeps drag/drop and final placement
  // collision validation in lockstep.
  const openingBlocksLayer = (opening: WallOpening) => {
    if (blocksFloorRun(opening.kind)) return true;
    if (opening.kind !== "window") return false;
    if (candidate) return windowVerticallyOverlapsCabinet(candidate, opening, room, openingClearance);
    return layer === "wall" || layer === "tall" || isWindowBelowCountertop(opening);
  };
  for (const o of openings) {
    if (o.side !== side) continue;
    if (!openingBlocksLayer(o)) continue;
    blocked.push({
      s: Math.max(wallStart, o.offset - openingClearance),
      e: Math.min(wallEnd, o.offset + o.width + openingClearance),
    });
  }

  // Merge overlapping/touching blocked intervals.
  blocked.sort((a, b) => a.s - b.s);
  const merged: { s: number; e: number }[] = [];
  for (const rawBlock of blocked) {
    const b = { s: Math.max(wallStart, rawBlock.s), e: Math.min(wallEnd, rawBlock.e) };
    if (b.e <= b.s + COLLISION_EPSILON_IN) continue;
    const last = merged[merged.length - 1];
    if (last && b.s <= last.e + 0.01) {
      last.e = Math.max(last.e, b.e);
    } else {
      merged.push({ ...b });
    }
  }

  // The free segments are the gaps between merged blocks (and the ends).
  const segments: WallSegment[] = [];
  let cursor = wallStart;
  for (const b of merged) {
    const gap = b.s - cursor;
    if (gap >= minLen) segments.push({ start: cursor, length: Math.round(gap * 100) / 100 });
    cursor = Math.max(cursor, b.e);
  }
  const tail = wallEnd - cursor;
  if (tail >= minLen) segments.push({ start: cursor, length: Math.round(tail * 100) / 100 });

  return segments;
}

/**
 * Resolves a palette-added cabinet to the next position in its selected-wall
 * run. Floor items (base/appliance/tall) and wall items keep independent
 * left-to-right cursors, while tall cabinets reserve both layers. We never
 * back-fill an earlier gap after a run has started: the newly chosen cabinet
 * belongs immediately after the rightmost item in its layer, advancing past a
 * door/window only when the required opening clearance interrupts that run.
 * Returning null is intentional; the caller must preserve the existing plan.
 */
export function paletteActiveWallPlacement(
  side: WallSide,
  room: RoomData,
  placed: PlacedCabinet[],
  openings: WallOpening[],
  width: number,
  depth: number,
  placement: Placement,
  reserveFullHeightAppliances = false,
): { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number } | null {
  // A selected peninsula is a compact work run, not a wall users should have
  // to manually nudge around. Find the first genuinely clear physical location
  // across every nearby cabinet body, then return the exact saved run metadata.
  if (peninsulaRunById(room, side)) {
    return firstCollisionFreePeninsulaPlacement(side, room, placed, width, depth, placement);
  }
  const segments = freeSegmentsOnWall(
    side,
    room,
    placed,
    openings,
    Math.min(width, 9),
    placement === "wall" ? WALL_OPENING_CLEARANCE_IN : 0,
    placement,
    reserveFullHeightAppliances,
    undefined,
    depth,
  );
  // Work from the selected wall's visible left edge toward its right edge. A
  // later tall cabinet or prior intentional gap must not push the next cabinet
  // beyond a perfectly valid earlier opening. Narrow segments are skipped, but
  // the first segment that can contain the requested cabinet is authoritative.
  const segment = segments.find((candidate) => candidate.length + 0.001 >= width);
  if (segment) {
    // The free-segment engine already accounted for every cabinet on this wall,
    // so the segment start is the placement on every wall kind. Only an angled
    // (45°-family) body can make an axis-aligned envelope look occupied at a
    // vertex when the physical span is clear; that case, and only that case,
    // is refined by the shared 1/8-inch collision-free search.
    const direct = wallPlacementAt(segment.start, width, depth, side, room);
    const probe: PlacedCabinet = {
      uid: "wall-placement-probe",
      cabinetId: 0,
      masterCode: "WALL-PLACEMENT",
      description: "Wall placement probe",
      placement,
      x: direct.x,
      y: direct.y,
      width,
      depth,
      rotation: direct.rotation,
      wallId: direct.wallId,
      wallOffset: direct.wallOffset,
    };
    const collision = cabinetPlacementCollisionDetail(probe, placed, room);
    if (!collision) return direct;
    const angled = (item: Pick<PlacedCabinet, "rotation">) => ((Math.round(item.rotation) % 90) + 90) % 90 !== 0;
    if (!angled(probe) && !angled(collision.cabinet)) return direct;
    return firstCollisionFreeWallPlacement(side, room, placed, width, depth, placement, segment.start, segment.start, segment.start + segment.length - width);
  }
  return null;
}

/**
 * Resolves the nearest collision-free position on ANY wall run (standard side,
 * drawn wall or peninsula). It preserves the selected wall, searches only the
 * given span in 1/8-inch increments from the desired start, and never permits a
 * physical cabinet-body overlap. This is the single placement search shared by
 * catalog drops, moves, nudges and Snap-to-wall in both Designer tools.
 */
export function firstCollisionFreeWallPlacement(
  side: WallSide,
  room: RoomData,
  placed: PlacedCabinet[],
  width: number,
  depth: number,
  placement: Placement,
  desiredStart: number,
  minStart = 0,
  maxStart = Math.max(0, wallLength(side, room) - width),
  /**
   * Palette drops must be previewed as the actual catalog cabinet, not a
   * generic rectangle.  Several catalog types carry collision/elevation
   * semantics (corner bodies, appliance companions, a stored mount height).
   * Keeping those fields here makes the preflight search agree with the final
   * add transaction on standard and measured wall runs.
   */
  candidateTemplate?: Partial<Pick<PlacedCabinet, "cabinetId" | "masterCode" | "description" | "height" | "mountBottom" | "mountBottomAdjusted" | "cornerType" | "customProfile">>,
): { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number; peninsulaSide?: PeninsulaCabinetSide } | null {
  const lower = Math.max(0, Math.min(maxStart, minStart));
  const upper = Math.max(lower, maxStart);
  const preferred = Math.max(lower, Math.min(upper, roundToEighth(desiredStart)));
  const candidateAt = (start: number) => {
    const spot = wallPlacementAt(start, width, depth, side, room);
    const candidate: PlacedCabinet = {
      uid: "wall-placement-preview",
      cabinetId: candidateTemplate?.cabinetId ?? 0,
      masterCode: candidateTemplate?.masterCode ?? "WALL-PLACEMENT",
      description: candidateTemplate?.description ?? "Wall placement preview",
      placement,
      x: spot.x,
      y: spot.y,
      width,
      depth,
      rotation: spot.rotation,
      wallId: spot.wallId,
      wallOffset: spot.wallOffset,
      ...(candidateTemplate?.height != null ? { height: candidateTemplate.height } : {}),
      ...(candidateTemplate?.mountBottom != null ? { mountBottom: candidateTemplate.mountBottom } : {}),
      ...(candidateTemplate?.mountBottomAdjusted != null ? { mountBottomAdjusted: candidateTemplate.mountBottomAdjusted } : {}),
      ...(candidateTemplate?.cornerType != null ? { cornerType: candidateTemplate.cornerType } : {}),
      ...(candidateTemplate?.customProfile != null ? { customProfile: candidateTemplate.customProfile } : {}),
    };
    return cabinetPlacementCollisionDetail(candidate, placed, room) ? null : spot;
  };
  const direct = candidateAt(preferred);
  if (direct) return direct;
  const increment = 0.125;
  for (let distance = increment; preferred + distance <= upper + COLLISION_EPSILON_IN || preferred - distance >= lower - COLLISION_EPSILON_IN; distance += increment) {
    if (preferred + distance <= upper + COLLISION_EPSILON_IN) {
      const forward = candidateAt(Math.min(upper, preferred + distance));
      if (forward) return forward;
    }
    if (preferred - distance >= lower - COLLISION_EPSILON_IN) {
      const backward = candidateAt(Math.max(lower, preferred - distance));
      if (backward) return backward;
    }
  }
  return null;
}

/**
 * A base blind corner is set back from its room corner by the customer-selected
 * 3–6 inch pull.  A normal 36-inch free-span lookup happens before that pull is
 * applied, which can leave a BBC intersecting a small same-run F342 even though
 * the next true seam is exactly pull + 36 inches from the corner.
 *
 * This is intentionally a narrow regular-Designer recovery, not a global
 * snap rule: it only considers a floor-layer filler no wider than the real
 * blind-corner clearance, preserves the already selected pull exactly, stays
 * on its existing cardinal wall, and requires the entire post-pull cabinet body
 * to fit one actual opening with zero physical collision.  The required
 * perpendicular BBC filler remains the caller's existing atomic transaction.
 */
export function resolveBaseBlindCornerFillerSnap(
  blind: PlacedCabinet,
  room: RoomData,
  placed: readonly PlacedCabinet[],
  openings: WallOpening[],
): { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number } | null {
  if (!isBaseBlindCorner(blind) || blind.islandFace) return null;
  const side = (blind.wallId ?? cabinetWall(blind, room)) as WallSide;
  const frame = wallRunFrame(side, room);
  // Measured/peninsula run ownership is already handled by their dedicated
  // placement engines.  Do not let this cabinet-specific recovery reinterpret
  // their geometry or Continuous Wall Builder behavior.
  if (!frame || frame.kind !== "cardinal") return null;
  const pull = Number(blind.blindPull);
  const range = blindPullRange(blind);
  if (!range || !Number.isFinite(pull) || pull < range.min - COLLISION_EPSILON_IN || pull > range.max + COLLISION_EPSILON_IN) return null;
  const bodySpan = wallRunSpan(blind, side, room);
  const depth = Number(blind.depth) || STD.BASE_DEPTH;
  if (bodySpan <= COLLISION_EPSILON_IN || depth <= COLLISION_EPSILON_IN) return null;

  const currentStart = wallRunOffset(blind, side, room);
  const wallSpan = wallLength(side, room);
  const currentEnd = currentStart + bodySpan;
  const cornerAtStart = currentStart <= wallSpan - currentEnd;
  const expectedStart = cornerAtStart ? pull : wallSpan - bodySpan - pull;
  const expectedEnd = expectedStart + bodySpan;
  if (expectedStart < -COLLISION_EPSILON_IN || expectedEnd > wallSpan + COLLISION_EPSILON_IN) return null;

  const ownRunFillerAtSeam = placed.some((item) => {
    if (!isFillerItem(item) || item.islandFace || item.placement !== "base") return false;
    if (cabinetWall(item, room) !== side) return false;
    const fillerSpan = wallRunSpan(item, side, room);
    if (fillerSpan <= COLLISION_EPSILON_IN || fillerSpan > BLIND_CORNER_FILLER_WIDTH_IN + COLLISION_EPSILON_IN) return false;
    const fillerStart = wallRunOffset(item, side, room);
    const fillerEnd = fillerStart + fillerSpan;
    const seam = cornerAtStart ? fillerStart : fillerEnd;
    return Math.abs(seam - (cornerAtStart ? expectedEnd : expectedStart)) <= COLLISION_EPSILON_IN;
  });
  if (!ownRunFillerAtSeam) return null;

  const segmentContainsBody = freeSegmentsOnWall(
    side,
    room,
    [...placed],
    openings,
    Math.min(bodySpan, 9),
    0,
    "base",
    false,
    blind,
    depth,
  ).some((segment) => (
    segment.start <= expectedStart + COLLISION_EPSILON_IN
    && segment.start + segment.length >= expectedEnd - COLLISION_EPSILON_IN
  ));
  if (!segmentContainsBody) return null;

  const spot = wallPlacementAt(expectedStart, bodySpan, depth, side, room);
  const candidate: PlacedCabinet = {
    ...blind,
    ...spot,
    wallId: spot.wallId ?? side,
    wallOffset: spot.wallOffset ?? expectedStart,
  };
	return cabinetPlacementCollisionDetail(candidate, [...placed], room) ? null : spot;
}
/** @deprecated One search serves every wall; kept for older call sites and tests. */
export const firstCollisionFreeCustomWallPlacement = firstCollisionFreeWallPlacement;

export interface CabinetWallMoveOptions {
  /** Magnet on: resolve to the nearest clear span and pull near edges into exact seams. */
  magnet: boolean;
  /**
   * Optional physical run extensions for a selected cabinet.  Refrigerator end
   * panels use this so their outside face, rather than the appliance box, is
   * what magnetically contacts the neighboring base cabinet.
   */
  magneticEnvelope?: { startExtensionIn?: number; endExtensionIn?: number } | null;
  /** The pointer/keyboard requested this exact along-run start; no magnet, only clamping. */
  exact?: boolean;
  /** An explicit run target (corner snap, typed offset) wins over the projected point. */
  target?: { wallId?: string | null; wallOffset?: number | null } | null;
  /** Which wall to move along when the request does not name one. */
  wallId?: WallSide | string | null;
  /** Seam tolerance for the final edge-contact resolution. */
  seamToleranceIn?: number;
}

export type CabinetWallMoveFailure = "no-wall" | "no-opening" | "no-clear-position";

export interface CabinetWallMovePreview {
  candidate: PlacedCabinet | null;
  wall: WallSide | null;
  frame: WallRunFrame | null;
  /** Requested along-run start before the engine resolved it. */
  requestedStart: number | null;
  /** True when a wall or cabinet edge within the snap threshold pulled the cabinet into contact. */
  snapped: boolean;
  failure: CabinetWallMoveFailure | null;
}

/**
 * THE shared along-wall move engine. A cabinet requested at plan point (x, y)
 * is projected onto its wall run, resolved into a clear 1/8-inch position and
 * seated with wallPlacementAt. Standard walls, drawn walls and peninsulas go
 * through exactly the same steps, so Floor Plan drags, 3D moves, keyboard
 * nudges and Snap-to-wall behave identically in the Designer and the
 * Continuous Wall Builder. The caller still applies its collision guard.
 */
export function cabinetWallMovePreview(
  cabinet: PlacedCabinet,
  requested: { x: number; y: number },
  room: RoomData,
  peers: PlacedCabinet[],
  openings: WallOpening[],
  options: CabinetWallMoveOptions,
): CabinetWallMovePreview {
  const requestedBody: PlacedCabinet = { ...cabinet, x: requested.x, y: requested.y };
  const center = placedPlanCenter(requestedBody);
  const targetWallId = options.target?.wallId ?? options.wallId ?? null;
  const width = Math.max(0, Number(cabinet.width) || 0);
  const depth = Number(cabinet.depth) || (cabinet.placement === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH);
  let frame = targetWallId ? wallRunFrame(targetWallId, room) : null;
  if (!frame) {
    // The wall magnet reaches the same 6 inches on every wall: a floor cabinet
    // whose body is within STD.SNAP_THRESHOLD of a run seats on it, otherwise it
    // stays a free-floating plan item. Wall-hung boxes always belong to a wall.
    const reach = depth / 2 + STD.SNAP_THRESHOLD;
    const owned = cabinet.wallId ? wallRunFrame(cabinet.wallId, room) : null;
    // A cabinet already seated on a peninsula must keep that actual wall and
    // face while its pointer crosses the center line. Previously the generic
    // nearest-run lookup ignored peninsulas unless the pointer landed exactly
    // on their centre line, so a range could switch to the outer room wall and
    // visibly pass through the peninsula. Give every peninsula the same normal
    // wall-magnet reach as its perimeter-wall peers; an explicit target still
    // wins, and a cabinet released beyond that reach remains free to move.
    const nearest = nearestWallRunAtPoint(room, center, reach);
    const ownedDistance = owned ? wallRunDistanceToPoint(owned, center) : Number.POSITIVE_INFINITY;
    const preferred = nearest && (!owned || nearest.distance + STD.SNAP_THRESHOLD < ownedDistance) ? nearest : owned ? { frame: owned, distance: ownedDistance } : nearest;
    const alwaysSeated = cabinet.placement === "wall";
    frame = preferred && (alwaysSeated || preferred.distance <= reach + COLLISION_EPSILON_IN) ? preferred.frame : null;
  }
  if (!frame) return { candidate: null, wall: null, frame: null, requestedStart: null, snapped: false, failure: "no-wall" };
  const explicitOffset = options.target?.wallId === frame.id && options.target?.wallOffset != null && Number.isFinite(Number(options.target.wallOffset))
    ? Math.max(0, Number(options.target.wallOffset))
    : null;
  const projectedStart = wallRunAlongAtPoint(frame, center) - width / 2;
  const requestedStart = roundToEighth(explicitOffset ?? projectedStart);
  const minStart = frame.runStart;
  const maxStart = Math.max(frame.runStart, frame.runEnd - width);
  let clampedStart = Math.max(minStart, Math.min(maxStart, requestedStart));
  // Blind corners are deliberately not wall-magnet cabinets. Preserve the
  // corner they currently own, but allow the body to release and move only
  // through the catalog-configured pull envelope (normally 3–6 inches).
  if (isBaseBlindCorner(cabinet)) {
    const currentOffset = cabinet.wallOffset != null
      ? Math.max(frame.runStart, Math.min(maxStart, Number(cabinet.wallOffset) || 0))
      : wallRunOffset(cabinet, frame.id, room);
    const currentEndGap = Math.max(0, frame.runEnd - (currentOffset + width));
    const cornerAtStart = currentOffset <= currentEndGap;
    const range = blindPullRange(cabinet);
    if (range) {
      const pullMinStart = cornerAtStart ? frame.runStart + range.min : frame.runEnd - width - range.max;
      const pullMaxStart = cornerAtStart ? frame.runStart + range.max : frame.runEnd - width - range.min;
      const low = Math.min(pullMinStart, pullMaxStart);
      const high = Math.max(pullMinStart, pullMaxStart);
      clampedStart = Math.max(low, Math.min(high, clampedStart));
    }
  }
  const magnet = options.magnet
    && !options.exact
    && explicitOffset == null
    && !isBaseBlindCorner(cabinet);
  const startExtension = Math.max(0, Number(options.magneticEnvelope?.startExtensionIn) || 0);
  const endExtension = Math.max(0, Number(options.magneticEnvelope?.endExtensionIn) || 0);
  const magneticWidth = width + startExtension + endExtension;
  const seat = (start: number): PlacedCabinet => {
    const spot = wallPlacementAt(start, width, depth, frame!.id, room, cabinet.peninsulaSide);
    return { ...cabinet, ...spot, rotation: spot.rotation, wallId: spot.wallId ?? frame!.id, wallOffset: spot.wallOffset ?? start };
  };
  if (!magnet) {
    return { candidate: seat(clampedStart), wall: frame.id, frame, requestedStart, snapped: false, failure: null };
  }
  const segments = freeSegmentsOnWall(frame.id, room, peers, openings, 0.5, 0, cabinet.placement, false, cabinet, depth);
  // Work in exposed-envelope coordinates.  For a refrigerator with a selected
  // left end panel, a base cabinet ending at 36 in pulls the panel's outside
  // edge to 36 in, which means the refrigerator itself seats at 37.25 in.
  const envelopeRequestedStart = clampedStart - startExtension;
  const envelopeSegments = segments.map((segment) => ({
    start: segment.start,
    length: segment.length,
  }));
  const magneticEnvelopeStart = magneticAvailableWallStart(envelopeSegments, envelopeRequestedStart, magneticWidth);
  if (magneticEnvelopeStart == null) {
    return { candidate: null, wall: frame.id, frame, requestedStart, snapped: false, failure: "no-opening" };
  }
  const magnetStart = magneticEnvelopeStart + startExtension;
  const containing = envelopeSegments.find((segment) => (
    magneticEnvelopeStart >= segment.start - COLLISION_EPSILON_IN
    && magneticEnvelopeStart + magneticWidth <= segment.start + segment.length + COLLISION_EPSILON_IN
  ));
  const spot = containing
    ? firstCollisionFreeWallPlacement(frame.id, room, peers, width, depth, cabinet.placement, magnetStart, containing.start + startExtension, containing.start + containing.length - width - endExtension)
    : wallPlacementAt(magnetStart, width, depth, frame.id, room, cabinet.peninsulaSide);
  if (!spot) return { candidate: null, wall: frame.id, frame, requestedStart, snapped: false, failure: "no-clear-position" };
  const seated: PlacedCabinet = { ...cabinet, ...spot, rotation: spot.rotation, wallId: spot.wallId ?? frame.id, wallOffset: spot.wallOffset ?? magnetStart };
  // Final edge-contact resolution: a near seam within the caller's tolerance
  // becomes exact zero-gap contact. The same rectangular seam rule applies on
  // every wall; it never approves an overlap.
  const seamed = snapCabinetSeamOverlap(seated, peers, options.seamToleranceIn, room);
  const candidate = seamed === seated
    ? seated
    : { ...seamed, wallOffset: roundToEighth(wallRunAlongAtPoint(frame, placedPlanCenter(seamed)) - width / 2) };
  const snapped = Math.abs((candidate.wallOffset ?? magnetStart) - clampedStart) > COLLISION_EPSILON_IN;
  return { candidate, wall: frame.id, frame, requestedStart, snapped, failure: null };
}

/**
 * Resolves a seated-work knee drawer only into a real clear base-cabinet void.
 * Its shallow box is wall-flush, but it must never be auto-placed over a base
 * cabinet that occupies the same physical knee-space elevation.
 */
export function kneeDrawerWallPlacement(
  side: WallSide,
  room: RoomData,
  placed: PlacedCabinet[],
  openings: WallOpening[],
  width: number,
  depth: number,
): { x: number; y: number; rotation: number } | null {
  const segments = freeSegmentsOnWall(side, room, placed, openings, Math.min(width, 9), 0, "base");
  const segment = segments.find((candidate) => candidate.length + COLLISION_EPSILON_IN >= width);
  return segment ? wallPlacementAt(segment.start, width, depth, side, room) : null;
}

export type AlternateWallPlacementRecommendation = {
  side: WallSide;
  spot: { x: number; y: number; rotation: number };
  availableLength: number;
};

/**
 * When the active wall is full, find the most economical clear opening on a
 * different room wall. It reuses the authoritative layer, opening-clearance,
 * full-height-appliance, and exact wall-placement rules; it does not move any
 * existing cabinet or create a candidate that overlaps the plan.
 */
export function alternateWallPlacementRecommendation(
  activeWall: WallSide,
  room: RoomData,
  placed: PlacedCabinet[],
  openings: WallOpening[],
  width: number,
  depth: number,
  placement: Placement,
  reserveFullHeightAppliances = false,
): AlternateWallPlacementRecommendation | null {
  // A Continuous Wall Builder room uses its explicit connected segments as the
  // only real room walls. The rectangular width/depth bounds exist only to size
  // the canvas; recommending one of those invisible graph edges can place a
  // cabinet completely outside the user's drawn room.
  const orderedWalls: WallSide[] = roomWallRunFrames(room).map((frame) => frame.id);
  const options = orderedWalls.flatMap((side, order) => {
    if (side === activeWall) return [];
    const spot = paletteActiveWallPlacement(
      side,
      room,
      placed,
      openings,
      width,
      depth,
      placement,
      reserveFullHeightAppliances,
    );
    if (!spot) return [];
    const availableLength = freeSegmentsOnWall(
      side,
      room,
      placed,
      openings,
      Math.min(width, 9),
      placement === "wall" ? WALL_OPENING_CLEARANCE_IN : 0,
      placement,
      reserveFullHeightAppliances,
      undefined,
      depth,
    ).find((segment) => segment.length + 0.001 >= width)?.length;
    if (availableLength == null) return [];
    return [{ side, spot, availableLength, order }];
  });
  options.sort((left, right) => {
    const leftRemainder = left.availableLength - width;
    const rightRemainder = right.availableLength - width;
    return leftRemainder - rightRemainder || left.order - right.order;
  });
  const best = options[0];
  return best ? { side: best.side, spot: best.spot, availableLength: best.availableLength } : null;
}

/**
 * Resolves a floor/tall cabinet into an open run immediately beside an existing
 * refrigerator enclosure.  Refrigerator end panels extend the protected bay,
 * so an adjacent cabinet never overlaps the appliance or a selected panel.
 * The nearest exact opening is preferred; any final remainder is intentionally
 * left to the existing measured small-gap filler flow after placement.
 */
export function refrigeratorAdjacentOpeningPlacement(
  side: WallSide,
  room: RoomData,
  placed: PlacedCabinet[],
  openings: WallOpening[],
  width: number,
  depth: number,
  placement: Placement,
): { x: number; y: number; rotation: number } | null {
  if (placement !== "base" && placement !== "tall") return null;
  const horizontal = side === "top" || side === "bottom";
  const segments = freeSegmentsOnWall(side, room, placed, openings, width, 0, placement);
  const choices: Array<{ start: number; remainder: number }> = [];
  for (const refrigerator of placed.filter((item) => isRefrigerator(item) && cabinetWall(item, room) === side)) {
    const assembly = [refrigerator, ...placed.filter((item) => refrigeratorAssemblyMemberRole(item, refrigerator, room) !== null)];
    const bounds = assembly.reduce(
      (current, item) => {
        const footprint = placedFootprint(item);
        const itemStart = horizontal ? item.x : item.y;
        const itemSpan = horizontal ? footprint.w : footprint.d;
        return { start: Math.min(current.start, itemStart), end: Math.max(current.end, itemStart + itemSpan) };
      },
      { start: Number.POSITIVE_INFINITY, end: Number.NEGATIVE_INFINITY },
    );
    for (const segment of segments) {
      if (segment.length + COLLISION_EPSILON_IN < width) continue;
      const segmentEnd = segment.start + segment.length;
      if (Math.abs(segmentEnd - bounds.start) <= COLLISION_EPSILON_IN) {
        choices.push({ start: segmentEnd - width, remainder: segment.length - width });
      }
      if (Math.abs(segment.start - bounds.end) <= COLLISION_EPSILON_IN) {
        choices.push({ start: segment.start, remainder: segment.length - width });
      }
    }
  }
  if (choices.length === 0) return null;
  choices.sort((left, right) => left.remainder - right.remainder || left.start - right.start);
  return wallPlacementAt(choices[0].start, width, depth, side, room);
}

/**
 * Catalog-added true corner cabinets belong at a real room corner, not at the
 * first open point in a straight wall run. Starting from the active wall, test
 * all four corners in clockwise room order and return the first exact physical
 * footprint that has zero overlap with every existing item (including hoods).
 */
/**
 * Seats a square-corner body at an explicit measured vertex.  A corner cabinet
 * has two back legs, so its angle cannot be taken from whichever incident wall
 * happened to be selected: that can align one leg while turning the other into
 * the room.  Instead, derive its local +X/+Y axes from both rays leaving the
 * shared vertex.  The returned coordinates remain the axis-aligned bounding-box
 * origin used by saved plan placements and the 3D renderer.
 */
type CornerRunRay = {
  id: string;
  /** Unit direction leaving the shared vertex along this run. */
  ray: { x: number; y: number };
  /** Physical run length in inches. */
  length: number;
  /** True when the shared vertex is this run's start point. */
  vertexIsStart: boolean;
};
/**
 * Seats a square-corner body at a vertex shared by two runs that meet at 90°.
 * A corner cabinet has two back legs, so its angle cannot be taken from
 * whichever incident wall happened to be selected: that can align one leg while
 * turning the other into the room. Its local +X/+Y axes are the two rays
 * leaving the vertex. This is the only corner-seating math: a rectangle's four
 * corners and a drawn room's vertices go through it identically.
 */
function seatCornerBodyAtVertex(
  moving: PlacedCabinet,
  vertex: { x: number; y: number },
  first: CornerRunRay,
  second: CornerRunRay,
): { x: number; y: number; rotation: number; wallId: string; wallOffset: number } | null {
  // `first × second` determines which run can be local +X without mirroring
  // the physical L/diagonal body; swap when necessary. Both are the same true
  // corner, but this keeps the second leg on its actual run.
  const cross = first.ray.x * second.ray.y - first.ray.y * second.ray.x;
  if (Math.abs(Math.abs(cross) - 1) > 1e-5) return null;
  const primary = cross > 0 ? first : second;
  const secondary = cross > 0 ? second : first;
  const physical = placedFootprint(moving);
  const bodyWidth = Math.max(0, physical.w);
  const bodyDepth = Math.max(0, physical.d);
  if (bodyWidth <= COLLISION_EPSILON_IN || bodyDepth <= COLLISION_EPSILON_IN) return null;
  const center = {
    x: vertex.x + primary.ray.x * bodyWidth / 2 + secondary.ray.x * bodyDepth / 2,
    y: vertex.y + primary.ray.y * bodyWidth / 2 + secondary.ray.y * bodyDepth / 2,
  };
  const boundWidth = Math.abs(primary.ray.x * bodyWidth) + Math.abs(secondary.ray.x * bodyDepth);
  const boundDepth = Math.abs(primary.ray.y * bodyWidth) + Math.abs(secondary.ray.y * bodyDepth);
  const wallOffset = primary.vertexIsStart ? 0 : Math.max(0, primary.length - bodyWidth);
  const rotation = ((Math.round(Math.atan2(primary.ray.y, primary.ray.x) * 180 / Math.PI) % 360) + 360) % 360;
  return {
    x: center.x - boundWidth / 2,
    y: center.y - boundDepth / 2,
    rotation,
    wallId: primary.id,
    wallOffset,
  };
}
/**
 * Seats a square-corner body at the vertex where `frame` meets its adjoining
 * perimeter run at a true 90° join, on every wall kind. Returns null when the
 * run has no 90° neighbour at that end (open path end, 45° join).
 */
export function wallRunCornerPlacement(
  moving: PlacedCabinet,
  frame: WallRunFrame,
  at: "start" | "end",
  room: RoomData,
): { x: number; y: number; rotation: number; wallId: string; wallOffset: number } | null {
  const join = wallRunJoinAt(frame, at, room);
  if (!join || join.turnDeg !== 90) return null;
  const vertex = at === "start" ? frame.start : frame.end;
  const rayFrom = (run: WallRunFrame, fromStart: boolean) => fromStart
    ? { x: run.tangent.x, y: run.tangent.y }
    : { x: -run.tangent.x, y: -run.tangent.y };
  const otherIsStart = Math.hypot(join.frame.start.x - vertex.x, join.frame.start.y - vertex.y) <= 0.01;
  return seatCornerBodyAtVertex(
    moving,
    vertex,
    { id: frame.id, ray: rayFrom(frame, at === "start"), length: frame.length, vertexIsStart: at === "start" },
    { id: join.frame.id, ray: rayFrom(join.frame, otherIsStart), length: join.frame.length, vertexIsStart: otherIsStart },
  );
}
/**
 * Seats a square-corner body at an explicit measured vertex shared by two
 * drawn walls. Thin wrapper over the shared vertex/ray corner core.
 */
export function customWallTrueCornerPlacement(
  moving: PlacedCabinet,
  firstWall: NonNullable<RoomData["customWalls"]>[number],
  secondWall: NonNullable<RoomData["customWalls"]>[number],
  vertexId: string,
  room: RoomData,
): { x: number; y: number; rotation: number; wallId: string; wallOffset: number } | null {
  if (!room.vertices?.length) return null;
  const vertex = room.vertices.find((candidate) => candidate.id === vertexId);
  if (!vertex) return null;
  const rayFor = (wall: typeof firstWall): CornerRunRay | null => {
    const vertexIsStart = wall.startVertexId === vertexId;
    const otherId = vertexIsStart ? wall.endVertexId : wall.endVertexId === vertexId ? wall.startVertexId : null;
    const other = otherId ? room.vertices!.find((candidate) => candidate.id === otherId) : null;
    if (!other) return null;
    const dx = other.x - vertex.x;
    const dy = other.y - vertex.y;
    const length = Math.hypot(dx, dy);
    if (length <= COLLISION_EPSILON_IN) return null;
    return { id: wall.id, ray: { x: dx / length, y: dy / length }, length, vertexIsStart };
  };
  const first = rayFor(firstWall);
  const second = rayFor(secondWall);
  if (!first || !second) return null;
  return seatCornerBodyAtVertex(moving, vertex, first, second);
}
export function nextAvailableRoomCornerPlacement(
  moving: PlacedCabinet,
  activeWall: WallSide,
  room: RoomData,
  placed: readonly PlacedCabinet[],
  nearPoint?: { x: number; y: number },
): { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number } | null {
  // A direct drag can nominate a nearby corner. Limit that gesture to the
  // cabinet's own footprint plus a forgiving 24-inch target halo so dropping
  // near one corner never relocates a cabinet to an unrelated open corner.
  const nearPointTolerance = nearPoint
    ? Math.max(24, Math.max(Number(moving.width) || 0, Number(moving.depth) || 0) + 24)
    : Number.POSITIVE_INFINITY;
  // Walk the perimeter from the active run: its start corner, its end corner,
  // then onward through each adjoining run. A rectangle's four sides and a
  // drawn room's walls are the same run graph, so this is one search for both.
  const perimeter = roomWallRunFrames(room).filter((frame) => frame.kind !== "peninsula");
  if (!perimeter.length) return null;
  const first = perimeter.find((frame) => frame.id === activeWall) ?? perimeter[0]!;
  const visited = new Set<string>();
  const ordered: WallRunFrame[] = [];
  let cursor: WallRunFrame | null = first;
  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    ordered.push(cursor);
    const next: WallRunFrame | null = wallRunJoinAt(cursor, "end", room)?.frame ?? null;
    cursor = next && !visited.has(next.id) ? next : null;
  }
  for (const frame of perimeter) if (!visited.has(frame.id)) { visited.add(frame.id); ordered.push(frame); }
  const seenVertices = new Set<string>();
  const corners: Array<{ frame: WallRunFrame; at: "start" | "end"; vertex: { x: number; y: number } }> = [];
  for (const frame of ordered) {
    for (const at of ["start", "end"] as const) {
      const vertex = at === "start" ? frame.start : frame.end;
      const key = `${Math.round(vertex.x * 1000)}:${Math.round(vertex.y * 1000)}`;
      if (seenVertices.has(key)) continue;
      seenVertices.add(key);
      corners.push({ frame, at, vertex });
    }
  }
  const candidates = nearPoint
    ? [...corners].sort((left, right) => (
        Math.hypot(left.vertex.x - nearPoint.x, left.vertex.y - nearPoint.y)
        - Math.hypot(right.vertex.x - nearPoint.x, right.vertex.y - nearPoint.y)
      ))
    : corners;
  for (const corner of candidates) {
    if (nearPoint && Math.hypot(corner.vertex.x - nearPoint.x, corner.vertex.y - nearPoint.y) > nearPointTolerance) continue;
    const spot = wallRunCornerPlacement(moving, corner.frame, corner.at, room);
    if (!spot) continue;
    const candidate = { ...moving, ...spot };
    // Include the shared corner reservation, so a B12 cannot occupy the
    // adjoining ERB leg merely because their plan AABBs meet cleanly.
    if (!cabinetPlacementCollisionDetail(candidate, [...placed], room)) return spot;
  }
  return null;
}

/**
 * Finds an unoccupied true 90-degree corner on the selected peninsula path.
 * A primary peninsula leaves its parent wall at a square corner; a connected
 * 90-degree return creates another square corner at its start. These are real
 * cabinet corners, not generic room-edge guesses. Acute 45-degree joins stay
 * excluded because their installer clearance is not an ERB/LS/diagonal-cabinet
 * envelope.
 */
export function nextAvailablePeninsulaCornerPlacement(
  moving: PlacedCabinet,
  activeRunId: WallSide,
  room: RoomData,
  placed: readonly PlacedCabinet[],
  nearPoint?: { x: number; y: number },
): { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number; peninsulaSide?: PeninsulaCabinetSide } | null {
  const activeRun = peninsulaRunById(room, activeRunId);
  if (!activeRun) return null;
  const footprint = placedFootprint(moving);
  const requiredLeg = Math.max(footprint.w, footprint.d);
  const tolerance = nearPoint
    ? Math.max(24, requiredLeg + 24)
    : Number.POSITIVE_INFINITY;
  const allRuns = room.peninsulaRuns ?? [];
  const candidateRuns = [
    // A primary run always meets its parent wall at a true 90-degree corner.
    ...(!activeRun.parentRunId || activeRun.turn === 90 ? [activeRun] : []),
    // A selected parent run may also expose its direct 90-degree return.
    ...allRuns.filter((candidate) => candidate.parentRunId === activeRun.id && candidate.turn === 90),
  ].filter((candidate, index, candidates) => candidates.findIndex((other) => other.id === candidate.id) === index);

  const ordered = [...candidateRuns].sort((left, right) => {
    if (!nearPoint) return 0;
    const leftPoint = peninsulaRunEndpoints(left, room).start;
    const rightPoint = peninsulaRunEndpoints(right, room).start;
    return Math.hypot(leftPoint.x - nearPoint.x, leftPoint.y - nearPoint.y)
      - Math.hypot(rightPoint.x - nearPoint.x, rightPoint.y - nearPoint.y);
  });
  for (const run of ordered) {
    const joint = peninsulaRunEndpoints(run, room).start;
    if (nearPoint && Math.hypot(joint.x - nearPoint.x, joint.y - nearPoint.y) > tolerance) continue;
    // Use the real L-corner box—not the supplier's sometimes-shallow ERB depth—
    // so both legs seat flush at the shared peninsula joint.
    const spot = wallPlacementAt(0, requiredLeg, requiredLeg, run.id as WallSide, room, run.cabinetSide);
    const candidate: PlacedCabinet = { ...moving, ...spot };
    if (!cabinetPlacementCollisionDetail(candidate, [...placed], room)) return spot;
  }
  return null;
}

export type CabinetCornerPlacementInfo = {
  angle: 45 | 90;
  placement: "flush" | "clearance";
  clearanceIn: number;
};

/**
 * Describes a cabinet seated at a measured corner endpoint. Both the placement
 * confirmation and plan badge use this helper so a flush 90° corner can never
 * be described as an 11-inch clearance placement.
 */
export function cabinetCornerPlacementInfo(
  cabinet: PlacedCabinet,
  room: RoomData,
): CabinetCornerPlacementInfo | null {
  const side = cabinet.wallId ?? cabinetWall(cabinet, room);
  const run = peninsulaRunById(room, side as WallSide);
  if (run) {
    const length = Math.max(0, Number(run.length) || 0);
    const offset = Math.max(0, Number(cabinet.wallOffset) || 0);
    const startClearance = peninsulaRunHas45StartInsideCornerClearance(run)
      ? PENINSULA_INSIDE_CORNER_CLEARANCE_IN
      : 0;
    const endClearance = peninsulaRunHas45EndInsideCornerClearance(run, room)
      ? PENINSULA_INSIDE_CORNER_CLEARANCE_IN
      : 0;
    const nearStart = offset <= startClearance + COLLISION_EPSILON_IN;
    const nearEnd = offset + Math.max(0, Number(cabinet.width) || 0) >= length - endClearance - COLLISION_EPSILON_IN;
    if (!nearStart && !nearEnd) return null;
    const has45Clearance = (nearStart && peninsulaRunHas45StartInsideCornerClearance(run))
      || (nearEnd && peninsulaRunHas45EndInsideCornerClearance(run, room));
    return has45Clearance
      ? { angle: 45, placement: "clearance", clearanceIn: PENINSULA_INSIDE_CORNER_CLEARANCE_IN }
      : { angle: 90, placement: "flush", clearanceIn: 0 };
  }

  const customWalls = room.customWalls;
  const wall = customWalls?.find((candidate) => candidate.id === side);
  if (!wall || !customWalls || !room.vertices || cabinet.wallOffset == null) return null;
  const length = polygonWallSegmentLength(wall, room.vertices);
  const offset = Math.max(0, Number(cabinet.wallOffset) || 0);
  const endpoint = offset <= COLLISION_EPSILON_IN
    ? wall.startVertexId
    : offset + Math.max(0, Number(cabinet.width) || 0) >= length - COLLISION_EPSILON_IN
      ? wall.endVertexId
      : null;
  if (!endpoint) return null;
  const adjoining = customWalls.find((candidate) => candidate.id !== wall.id && (
    candidate.startVertexId === endpoint || candidate.endVertexId === endpoint
  ));
  if (!adjoining) return null;
  const wallAngle = polygonWallAngle(wall, room.vertices);
  const adjoiningAngle = polygonWallAngle(adjoining, room.vertices);
  const dotMagnitude = Math.abs(Math.cos(wallAngle - adjoiningAngle));
  if (dotMagnitude <= 1e-6) return { angle: 90, placement: "flush", clearanceIn: 0 };
  const diagonal = Math.abs(dotMagnitude - Math.SQRT1_2) <= 1e-6;
  return diagonal ? { angle: 45, placement: "flush", clearanceIn: 0 } : null;
}

/**
 * Identifies a blind corner cabinet that is locked to a real corner endpoint.
 * Blind bases are rectangular—not L-shaped—but their physical body and required
 * filler reserve the adjoining run. Keep this separate from true-corner geometry
 * so BBC42 receives confirmation feedback without changing its 42 by 24 footprint.
 */
export function blindCornerSnapInfo(
  cabinet: PlacedCabinet,
  room: RoomData,
): CabinetCornerPlacementInfo | null {
  if (!isBlindCorner(cabinet.masterCode, cabinet.description)) return null;
  const side = (cabinet.wallId ?? cabinetWall(cabinet, room)) as WallSide;
  const length = wallLength(side, room);
  if (length <= COLLISION_EPSILON_IN) return null;
  const offset = cabinet.wallOffset != null
    ? Math.max(0, Number(cabinet.wallOffset) || 0)
    : wallRunOffset(cabinet, side, room);
  const span = wallRunSpan(cabinet, side, room);
  const atStart = offset <= COLLISION_EPSILON_IN;
  const atEnd = offset + span >= length - COLLISION_EPSILON_IN;
  if (!atStart && !atEnd) return null;

  const wall = room.customWalls?.find((candidate) => candidate.id === side);
  if (wall && room.vertices) {
    const endpoint = atStart ? wall.startVertexId : wall.endVertexId;
    const hasAdjoiningWall = room.customWalls?.some((candidate) => candidate.id !== wall.id && (
      candidate.startVertexId === endpoint || candidate.endVertexId === endpoint
    ));
    if (!hasAdjoiningWall) return null;
  }
  return { angle: 90, placement: "flush", clearanceIn: 0 };
}

/**
 * Resolve the exposed BBC/WBC door side from its physical corner. Blind bases
 * may be stored flush to the wall endpoint or pulled 3–6 inches off it, so a
 * saved `swing` alone is not authoritative. The door must always face away from
 * the blind side: a start-side/left corner exposes the right door and an
 * end-side/right corner exposes the left door.
 */
/** Resolve a 3–6 inch blind-corner pull while keeping the cabinet back seated on its wall. */
export function blindCornerPullPlacement(
  cabinet: PlacedCabinet,
  room: RoomData,
  requestedPullIn: number,
): ({ x: number; y: number; rotation: number; wallId?: string; wallOffset?: number; blindPull: number } | null) {
  if (!isBaseBlindCorner(cabinet) || cabinet.islandFace) return null;
  const side = (cabinet.wallId ?? cabinetWall(cabinet, room)) as WallSide;
  const length = wallLength(side, room);
  const span = wallRunSpan(cabinet, side, room);
  const range = blindPullRange(cabinet);
  if (length <= COLLISION_EPSILON_IN || span <= COLLISION_EPSILON_IN || !range) return null;
  const pull = Math.max(range.min, Math.min(range.max, Number(requestedPullIn) || range.max));
  const currentOffset = cabinet.wallOffset != null
    ? Math.max(0, Number(cabinet.wallOffset) || 0)
    : wallRunOffset(cabinet, side, room);
  const currentEndGap = Math.max(0, length - (currentOffset + span));
  const cornerAtStart = currentOffset <= currentEndGap;
  const offset = cornerAtStart ? pull : Math.max(0, length - span - pull);
  const spot = wallPlacementAt(offset, span, Number(cabinet.depth) || STD.BASE_DEPTH, side, room, cabinet.peninsulaSide);
  return { ...spot, blindPull: pull };
}

export function blindCornerDoorSide(
  cabinet: PlacedCabinet,
  room: RoomData,
): "left" | "right" | null {
  if (!isBlindCorner(cabinet.masterCode, cabinet.description)) return null;
  const side = (cabinet.wallId ?? cabinetWall(cabinet, room)) as WallSide;
  const length = wallLength(side, room);
  if (length <= COLLISION_EPSILON_IN) return null;
  const offset = cabinet.wallOffset != null
    ? Math.max(0, Number(cabinet.wallOffset) || 0)
    : wallRunOffset(cabinet, side, room);
  const span = wallRunSpan(cabinet, side, room);
  const pullAllowance = blindPullRange(cabinet)?.max ?? 6;
  const atStart = offset <= pullAllowance + COLLISION_EPSILON_IN;
  const atEnd = offset + span >= length - pullAllowance - COLLISION_EPSILON_IN;
  if (atStart === atEnd) return null;
  return atStart ? "right" : "left";
}

/** Apply the physical BBC/WBC door side to restored placements. */
export function normalizeBlindCornerDoorSides(
  placed: PlacedCabinet[],
  room: RoomData,
): PlacedCabinet[] {
  let changed = false;
  const next = placed.map((cabinet) => {
    const swing = blindCornerDoorSide(cabinet, room);
    if (!swing || cabinet.swing === swing) return cabinet;
    changed = true;
    return { ...cabinet, swing };
  });
  return changed ? next : placed;
}

/**
 * Keeps a newly sequenced wall cabinet on the finished top line of the cabinet
 * it directly touches. This is essential for short uppers such as W-30-24:
 * their bottom changes with height, but the visible run top remains continuous.
 */
export function adjoiningWallRunMountBottom(
  cabinet: PlacedCabinet,
  room: RoomData,
  placed: PlacedCabinet[],
): number | null {
  if (cabinet.placement !== "wall" || isStacker(cabinet)) return null;
  const side = cabinetWall(cabinet, room);
  const horizontal = side === "top" || side === "bottom";
  const footprint = placedFootprint(cabinet);
  const start = horizontal ? cabinet.x : cabinet.y;
  const end = start + (horizontal ? footprint.w : footprint.d);
  const peers = placed.filter((peer) => peer.placement === "wall" && !isStacker(peer) && cabinetWall(peer, room) === side);
  const previous = peers
    .map((peer) => {
      const peerFootprint = placedFootprint(peer);
      const peerStart = horizontal ? peer.x : peer.y;
      const peerEnd = peerStart + (horizontal ? peerFootprint.w : peerFootprint.d);
      return { peer, edgeDistance: Math.abs(start - peerEnd) };
    })
    .filter(({ edgeDistance }) => edgeDistance <= CABINET_SEAM_SNAP_IN + 1e-9)
    .sort((a, b) => a.edgeDistance - b.edgeDistance)[0]?.peer;
  const next = previous ? null : peers
    .map((peer) => {
      const peerStart = horizontal ? peer.x : peer.y;
      return { peer, edgeDistance: Math.abs(peerStart - end) };
    })
    .filter(({ edgeDistance }) => edgeDistance <= CABINET_SEAM_SNAP_IN + 1e-9)
    .sort((a, b) => a.edgeDistance - b.edgeDistance)[0]?.peer;
  const neighbor = previous ?? next;
  if (!neighbor) return null;
  const neighborBox = elevationBox(neighbor, room);
  return Math.max(0, neighborBox.bottom + neighborBox.height - placedHeight(cabinet));
}


// ─── Auto-dimensioning ─────────────────────────────────────────────────────────
// Returns an array of dimension segments for a wall: each cabinet’s width and
// each gap between cabinets (or between cabinet and wall end). Used to render
// a full chain of dimension lines along the wall in the plan view.
export interface DimensionSeg {
  start: number; // run-axis start (inches)
  length: number; // segment length (inches)
  kind: "cabinet" | "gap"; // whether this is a cabinet span or empty gap
  label: string; // display label (e.g. "B15" or gap width)
}

/**
 * Display-only Floor Plan dimension segments.  Unlike the legacy cardinal
 * `wallDimensions` helper below, these chains read the one wall-run model used
 * by both the Designer and Continuous Wall Builder.  They deliberately never
 * snap, reseat, or otherwise write to a cabinet or wall.
 */
export interface FloorPlanDimensionSegment {
  start: number;
  length: number;
  kind: "cabinet" | "gap";
  /** Source record only; the visual layer intentionally displays the dimension, not a SKU. */
  cabinetUid?: string;
  masterCode?: string;
}

export interface FloorPlanWallDimensionChain {
  wallId: string;
  layer: "base" | "wall";
  /** Physical wall corner-to-corner span, in inches. */
  length: number;
  /** The usable wall-run bounds are retained for split cardinal walls. */
  runStart: number;
  runEnd: number;
  segments: FloorPlanDimensionSegment[];
}

function floorPlanDimensionLayer(cabinet: PlacedCabinet): "base" | "wall" | null {
  if (cabinet.placement === "wall") return "wall";
  if (cabinet.placement === "base" || cabinet.placement === "appliance" || cabinet.placement === "tall") return "base";
  return null;
}

/**
 * Returns a gap-and-piece dimension chain for every explicitly seated wall run.
 * Segments use `wallRunSpan`, so a 45° cabinet reports its catalog width rather
 * than its rotated screen envelope.  A chain is only returned where it has a
 * cabinet on that layer; this keeps otherwise empty walls visually quiet.
 */
export function floorPlanWallDimensionChains(
  room: RoomData,
  placed: readonly PlacedCabinet[],
): FloorPlanWallDimensionChain[] {
  const chains: FloorPlanWallDimensionChain[] = [];
  for (const frame of roomWallRunFrames(room)) {
    for (const layer of ["base", "wall"] as const) {
      const members = placed
        .filter((cabinet) => floorPlanDimensionLayer(cabinet) === layer && cabinetWall(cabinet, room) === frame.id)
        .map((cabinet) => ({
          cabinet,
          start: Math.max(0, Math.min(frame.length, wallRunOffset(cabinet, frame.id, room))),
          span: Math.max(0, wallRunSpan(cabinet, frame.id, room)),
        }))
        .filter((member) => member.start < frame.length - COLLISION_EPSILON_IN && member.start + member.span > COLLISION_EPSILON_IN)
        .sort((left, right) => left.start - right.start || left.cabinet.uid.localeCompare(right.cabinet.uid));
      if (members.length === 0) continue;

      const segments: FloorPlanDimensionSegment[] = [];
      let cursor = 0;
      for (const member of members) {
        const start = Math.max(cursor, member.start);
        const end = Math.min(frame.length, member.start + member.span);
        if (start > cursor + COLLISION_EPSILON_IN) {
          segments.push({ start: cursor, length: start - cursor, kind: "gap" });
        }
        // Physical overlap is not hidden or reinterpreted by the display layer.
        // The visible chain stops at the non-overlapping span so its total always
        // equals the actual usable wall run while collision remains authoritative.
        if (end > start + COLLISION_EPSILON_IN) {
          segments.push({
            start,
            length: end - start,
            kind: "cabinet",
            cabinetUid: member.cabinet.uid,
            masterCode: member.cabinet.masterCode,
          });
          cursor = Math.max(cursor, end);
        }
      }
      if (cursor < frame.length - COLLISION_EPSILON_IN) {
        segments.push({ start: cursor, length: frame.length - cursor, kind: "gap" });
      }
      chains.push({
        wallId: frame.id,
        layer,
        length: frame.length,
        runStart: frame.runStart,
        runEnd: frame.runEnd,
        segments,
      });
    }
  }
  return chains;
}

export function wallDimensions(
  side: WallSide,
  room: RoomData,
  placed: PlacedCabinet[],
  layer: "base" | "wall" = "base"
): DimensionSeg[] {
  const horizontal = side === "top" || side === "bottom";
  const retainedWall = cabinetWallRunSegment(side, room);
  const wallStart = retainedWall.start;
  const wallEnd = retainedWall.start + retainedWall.length;
  // Collect cabinets on this wall + layer, sorted by run-axis start.
  const onWall = placed
    .filter((p) => {
      if (layer === "wall") { if (p.placement !== "wall" && p.placement !== "tall") return false; }
      else { if (p.placement !== "base" && p.placement !== "appliance" && p.placement !== "tall") return false; }
      return isAgainstWall(p, side, room);
    })
    .map((p) => {
      const { w, d } = rotatedSize(p);
      const start = horizontal ? p.x : p.y;
      const span = horizontal ? w : d;
      return { start, span, code: p.masterCode ?? "" };
    })
    .filter((item) => item.start + item.span > wallStart + COLLISION_EPSILON_IN && item.start < wallEnd - COLLISION_EPSILON_IN)
    .sort((a, b) => a.start - b.start);

  const segs: DimensionSeg[] = [];
  let cursor = wallStart;
  for (const c of onWall) {
    const gapLen = c.start - cursor;
    if (gapLen > 0.25) {
      segs.push({ start: cursor, length: gapLen, kind: "gap", label: formatInches(gapLen) });
    }
    segs.push({ start: c.start, length: c.span, kind: "cabinet", label: c.code ? `${c.code} (${formatInches(c.span)})` : formatInches(c.span) });
    cursor = c.start + c.span;
  }
  const tail = wallEnd - cursor;
  if (tail > 0.25) {
    segs.push({ start: cursor, length: tail, kind: "gap", label: formatInches(tail) });
  }
  return segs;
}

export type MeasuredWallCabinetSide = "left" | "right";

/**
 * Resolves the physical room side of a measured custom wall. Closed room
 * outlines are authoritative by winding. An intentionally open continuous wall
 * path has no polygon area, so its first real measured turn declares the inside
 * of the connected run: a clockwise/right turn keeps cabinets on the left side;
 * a counter-clockwise/left turn keeps them on the right side.
 *
 * This one resolver prevents the plan viewport from ever deciding which side of
 * a measured wall is valid. The default preserves the established first-wall
 * convention for a one-wall/straight open path until the owner adds a turn.
 */
export function customWallCabinetSide(
  room: Pick<RoomData, "vertices" | "customWalls" | "openWallPath">,
  _wallId?: string | null,
): MeasuredWallCabinetSide {
  const vertices = room.vertices ?? [];
  const walls = room.customWalls ?? [];
  if (vertices.length < 2 || walls.length === 0) return "left";

  const pointFor = (vertexId: string) => vertices.find((vertex) => vertex.id === vertexId) ?? null;
  const crossForJoin = (first: typeof walls[number], second: typeof walls[number]) => {
    if (first.endVertexId !== second.startVertexId) return 0;
    const start = pointFor(first.startVertexId);
    const joint = pointFor(first.endVertexId);
    const end = pointFor(second.endVertexId);
    if (!start || !joint || !end) return 0;
    const firstX = joint.x - start.x;
    const firstY = joint.y - start.y;
    const secondX = end.x - joint.x;
    const secondY = end.y - joint.y;
    return firstX * secondY - firstY * secondX;
  };

  if (!room.openWallPath && walls.length === vertices.length) {
    // Screen-coordinate Y increases downward, so a positive signed area is a
    // clockwise outline whose interior is to the directed wall's left.
    let signedArea = 0;
    for (let index = 0; index < vertices.length; index += 1) {
      const current = vertices[index]!;
      const next = vertices[(index + 1) % vertices.length]!;
      signedArea += current.x * next.y - next.x * current.y;
    }
    if (Math.abs(signedArea) > COLLISION_EPSILON_IN) return signedArea > 0 ? "left" : "right";
  }

  for (let index = 0; index < walls.length - 1; index += 1) {
    const cross = crossForJoin(walls[index]!, walls[index + 1]!);
    if (Math.abs(cross) > COLLISION_EPSILON_IN) return cross > 0 ? "left" : "right";
  }
  return "left";
}

// Convert a run-axis coordinate on a wall into the {x, y, rotation} a placed
// cabinet needs. `along` is the run-axis start (X for top/bottom, Y for left/
// right); the perpendicular coordinate is pinned to the wall.
export function wallPlacementAt(
  along: number,
  width: number,
  depth: number,
  side: WallSide,
  room: RoomData,
  requestedPeninsulaSide?: PeninsulaCabinetSide | null,
  clampToRun = true,
): { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number; peninsulaSide?: PeninsulaCabinetSide } {
  const peninsula = peninsulaRunById(room, side);
  if (peninsula) {
    const { start, radians } = peninsulaRunEndpoints(peninsula, room);
    const length = Math.max(6, peninsula.length);
    const offset = clampToRun
      ? Math.max(0, Math.min(Math.max(0, length - width), along))
      : along;
    const tangent = { x: Math.cos(radians), y: Math.sin(radians) };
    const leftNormal = { x: -Math.sin(radians), y: Math.cos(radians) };
    const peninsulaSide = requestedPeninsulaSide ?? peninsula.cabinetSide ?? "left";
    const faceNormal = peninsulaSide === "left"
      ? leftNormal
      : { x: -leftNormal.x, y: -leftNormal.y };
    const center = {
      x: start.x + tangent.x * (offset + width / 2) + faceNormal.x * (depth / 2),
      y: start.y + tangent.y * (offset + width / 2) + faceNormal.y * (depth / 2),
    };
    const boundWidth = Math.abs(width * tangent.x) + Math.abs(depth * faceNormal.x);
    const boundDepth = Math.abs(width * tangent.y) + Math.abs(depth * faceNormal.y);
    return {
      x: center.x - boundWidth / 2,
      y: center.y - boundDepth / 2,
      // A cabinet's back must meet the selected face of the line. Flipping the
      // right face by 180° keeps its front facing away from the peninsula wall.
      rotation: ((Math.round(((radians + (peninsulaSide === "right" ? Math.PI : 0)) * 180) / Math.PI) % 360) + 360) % 360,
      wallId: peninsula.id,
      wallOffset: offset,
      peninsulaSide,
    };
  }
  const customWall = room.customWalls?.find((wall) => wall.id === side);
  if (customWall && room.vertices) {
    const start = room.vertices.find((vertex) => vertex.id === customWall.startVertexId);
    if (start) {
      const length = polygonWallSegmentLength(customWall, room.vertices);
      const offset = clampToRun
        ? Math.max(0, Math.min(Math.max(0, length - width), along))
        : along;
      const radians = polygonWallAngle(customWall, room.vertices);
      const tangent = { x: Math.cos(radians), y: Math.sin(radians) };
      // A closed clockwise room has its interior on the left of every directed
      // wall. An open continuous path may be traced counter-clockwise instead;
      // use its first measured turn to preserve the owner's inside face. This is
      // deliberately shared by catalog clicks, Plan drags, 3D moves, restoring a
      // saved room, countertops, and collision checks: the canvas bounds are not
      // a substitute for an actual measured wall.
      const sideOfWall = customWallCabinetSide(room, customWall.id);
      const leftNormal = { x: -Math.sin(radians), y: Math.cos(radians) };
      const inward = sideOfWall === "left"
        ? leftNormal
        : { x: -leftNormal.x, y: -leftNormal.y };
      const center = {
        x: start.x + tangent.x * (offset + width / 2) + inward.x * (depth / 2),
        y: start.y + tangent.y * (offset + width / 2) + inward.y * (depth / 2),
      };
      const boundWidth = Math.abs(width * tangent.x) + Math.abs(depth * inward.x);
      const boundDepth = Math.abs(width * tangent.y) + Math.abs(depth * inward.y);
      // A right-side run has the same physical back edge but its cabinet fronts
      // face the opposite direction. Persist that 180° rotation so Plan, 3D,
      // hardware, elevation, and the countertop all agree on the selected wall.
      const rotationRadians = radians + (sideOfWall === "right" ? Math.PI : 0);
      const rotation = ((Math.round(rotationRadians * 180 / Math.PI) % 360) + 360) % 360;
      return { x: center.x - boundWidth / 2, y: center.y - boundDepth / 2, rotation, wallId: customWall.id, wallOffset: offset };
    }
  }
  const horizontal = side === "top" || side === "bottom";
  const rotation = horizontal ? 0 : 90;
  const retainedWall = cabinetWallRunSegment(side, room);
  const runEnd = retainedWall.start + retainedWall.length;
  const clampedAlong = clampToRun
    ? Math.max(retainedWall.start, Math.min(Math.max(retainedWall.start, runEnd - width), along))
    : along;
  // depth runs into the room from the wall.
  let x = 0;
  let y = 0;
  if (side === "top") { y = 0; x = clampedAlong; }
  else if (side === "bottom") { y = Math.max(0, room.depth - depth); x = clampedAlong; }
  else if (side === "left") { x = 0; y = clampedAlong; }
  else { x = Math.max(0, room.width - depth); y = clampedAlong; }
  // A standard wall carries the same run identity as a drawn wall so every
  // downstream rule (collision, gaps, drag, nudge, 3D facing) reads one model.
  return { x, y, rotation, wallId: side, wallOffset: clampedAlong };
}

/**
 * Returns the exact measured wall frame even when an architectural member starts
 * just beyond a wall endpoint. Refrigerator fitting uses this for end panels so
 * it can shift the *entire* refrigerator enclosure into the run. Calling the
 * normal clamped helper first silently folded a start-side panel into the
 * refrigerator footprint, leaving it missing after the collision pass.
 */
export function wallPlacementAtUnbounded(
  along: number,
  width: number,
  depth: number,
  side: WallSide,
  room: RoomData,
  requestedPeninsulaSide?: PeninsulaCabinetSide | null,
): { x: number; y: number; rotation: number; wallId?: string; wallOffset?: number; peninsulaSide?: PeninsulaCabinetSide } {
  return wallPlacementAt(along, width, depth, side, room, requestedPeninsulaSide, false);
}

export const CABINET_WALL_AUTO_SNAP_IN = STD.SNAP_THRESHOLD;


/** True when a custom wall has been explicitly locked to one of the v1 diagonals. */
export function isLockedAngledCustomWall(room: RoomData, wallId?: string | null): boolean {
  return Boolean(wallId && room.customWalls?.some((wall) => wall.id === wallId && (wall.lockedAngle === 45 || wall.lockedAngle === -45)));
}

/** True for any explicit wall in a polygon room, including cardinal builder walls. */
export function isCustomRoomWall(room: RoomData, wallId?: string | null): boolean {
  return Boolean(wallId && room.vertices && room.customWalls?.some((wall) => wall.id === wallId));
}

// ─── One wall-run model for every wall ───────────────────────────────────────
// A standard room wall, a Continuous Wall Builder wall and a peninsula run are
// the same thing to the placement engine: a directed segment with a usable
// cabinet run, an inward normal and a height. Placement, snap, collision, drag
// and nudge all measure cabinets along this frame, so no caller has to ask
// which kind of wall it is working with.

/** Round any plan measurement to the Designer's 1/8-inch placement grid. */
export function roundToEighth(value: number): number {
  return Math.round((Number(value) || 0) * 8) / 8;
}

export type WallRunKind = "cardinal" | "custom" | "peninsula";

export interface WallRunFrame {
  id: WallSide;
  kind: WallRunKind;
  /** Physical wall endpoints in plan inches. */
  start: { x: number; y: number };
  end: { x: number; y: number };
  /** Direction of travel along the wall, radians from +x. */
  angle: number;
  /** Physical wall length. */
  length: number;
  /** Usable cabinet run in along-wall inches (a peninsula may shorten a standard wall). */
  runStart: number;
  runEnd: number;
  /** Wall height in inches. */
  height: number;
  tangent: { x: number; y: number };
  /** Unit normal pointing into the room, toward cabinet fronts. */
  inward: { x: number; y: number };
  /** Plan rotation (degrees) of a cabinet whose back sits on this wall. */
  facingRotation: number;
}

function frameFromSegment(
  id: WallSide,
  kind: WallRunKind,
  start: { x: number; y: number },
  end: { x: number; y: number },
  inwardIsLeftNormal: boolean,
  runStart: number,
  runEnd: number,
  height: number,
): WallRunFrame {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const angle = length > COLLISION_EPSILON_IN ? Math.atan2(dy, dx) : 0;
  const tangent = { x: Math.cos(angle), y: Math.sin(angle) };
  const leftNormal = { x: -Math.sin(angle), y: Math.cos(angle) };
  const inward = inwardIsLeftNormal ? leftNormal : { x: -leftNormal.x, y: -leftNormal.y };
  const facingRotation = ((Math.round((angle * 180) / Math.PI + (inwardIsLeftNormal ? 0 : 180)) % 360) + 360) % 360;
  return { id, kind, start, end, angle, length, runStart, runEnd, height, tangent, inward, facingRotation };
}

/** The run frame for any wall id (standard side, drawn wall or peninsula), or null when unknown. */
export function wallRunFrame(side: WallSide | string | null | undefined, room: RoomData): WallRunFrame | null {
  if (!side) return null;
  const peninsula = peninsulaRunById(room, side);
  if (peninsula) {
    const { start, end } = peninsulaRunEndpoints(peninsula, room);
    const length = Math.max(6, peninsula.length);
    return frameFromSegment(peninsula.id as WallSide, "peninsula", start, end, (peninsula.cabinetSide ?? "left") === "left", 0, length, roomCeiling(room));
  }
  const customWall = room.customWalls?.find((wall) => wall.id === side);
  if (customWall && room.vertices) {
    const start = room.vertices.find((vertex) => vertex.id === customWall.startVertexId);
    const end = room.vertices.find((vertex) => vertex.id === customWall.endVertexId);
    if (!start || !end) return null;
    const length = polygonWallSegmentLength(customWall, room.vertices);
    const height = wallTopLimit(room, customWall.id as WallSide);
    return frameFromSegment(customWall.id as WallSide, "custom", { x: start.x, y: start.y }, { x: end.x, y: end.y }, customWallCabinetSide(room, customWall.id) === "left", 0, length, height);
  }
  if (side !== "top" && side !== "bottom" && side !== "left" && side !== "right") return null;
  const run = cabinetWallRunSegment(side, room);
  const height = wallCeiling(room, side).high;
  // Along-wall inches on a standard wall are the room x (top/bottom) or the
  // room y (left/right), so they equal the exact saved plan coordinate.
  if (side === "top") return frameFromSegment("top", "cardinal", { x: 0, y: 0 }, { x: room.width, y: 0 }, true, run.start, run.start + run.length, height);
  if (side === "bottom") return frameFromSegment("bottom", "cardinal", { x: 0, y: room.depth }, { x: room.width, y: room.depth }, false, run.start, run.start + run.length, height);
  if (side === "left") return frameFromSegment("left", "cardinal", { x: 0, y: 0 }, { x: 0, y: room.depth }, false, run.start, run.start + run.length, height);
  return frameFromSegment("right", "cardinal", { x: room.width, y: 0 }, { x: room.width, y: room.depth }, true, run.start, run.start + run.length, height);
}

/** Every perimeter wall run (drawn walls when present, else the four standard sides) plus peninsulas. */
export function roomWallRunFrames(room: RoomData): WallRunFrame[] {
  const ids: string[] = room.vertices && (room.customWalls?.length ?? 0) > 0
    ? (room.customWalls ?? []).map((wall) => wall.id)
    : ["top", "bottom", "left", "right"];
  for (const run of room.peninsulaRuns ?? []) ids.push(run.id);
  return ids.map((id) => wallRunFrame(id, room)).filter((frame): frame is WallRunFrame => frame != null);
}

export interface WallRunJoin {
  /** The adjoining perimeter run. */
  frame: WallRunFrame;
  /** Interior turn between the two runs in degrees (90 for a square corner, 45 for a diagonal join). */
  turnDeg: number;
  /** Which end of the queried run the join sits on. */
  at: "start" | "end";
}
/**
 * The perimeter run that meets `frame` at the given end, on every wall kind:
 * a rectangle's four sides meet at its corners exactly like drawn walls meet
 * at their shared vertices. Peninsulas are cabinet runs, not perimeter walls,
 * and never form a room corner.
 */
export function wallRunJoinAt(frame: WallRunFrame, at: "start" | "end", room: RoomData): WallRunJoin | null {
  if (frame.kind === "peninsula") return null;
  const vertex = at === "start" ? frame.start : frame.end;
  for (const other of roomWallRunFrames(room)) {
    if (other.id === frame.id || other.kind === "peninsula") continue;
    const touchesStart = Math.hypot(other.start.x - vertex.x, other.start.y - vertex.y) <= 0.01;
    const touchesEnd = Math.hypot(other.end.x - vertex.x, other.end.y - vertex.y) <= 0.01;
    if (!touchesStart && !touchesEnd) continue;
    const raw = Math.abs(((frame.angle - other.angle + Math.PI) % (Math.PI * 2)) - Math.PI);
    const interior = Math.min(raw, Math.abs(Math.PI - raw));
    return { frame: other, turnDeg: Math.round((interior * 180) / Math.PI), at };
  }
  return null;
}
/**
 * Installation hold reserved on each leg at an inside corner, by join angle
 * and the physical cabinet depth at that layer. Two 24-inch faces meeting at
 * a 45° turn need 11 inches so the fronts do not cross at the vertex; a
 * 12-inch upper needs half that hold. A 90° corner remains flush.
 */
export function insideCornerHoldIn(turnDeg: number, cabinetDepth = STD.BASE_DEPTH): number {
  if (Math.abs(turnDeg - 45) > 0.5) return 0;
  const depth = Math.max(0, Number(cabinetDepth) || STD.BASE_DEPTH);
  return PENINSULA_INSIDE_CORNER_CLEARANCE_IN * (depth / STD.BASE_DEPTH);
}
/** Unclamped along-wall inches of a plan point on a run frame. */
export function wallRunAlongAtPoint(frame: WallRunFrame, point: { x: number; y: number }): number {
  return (point.x - frame.start.x) * frame.tangent.x + (point.y - frame.start.y) * frame.tangent.y;
}

/** Distance from a plan point to the physical wall segment. */
export function wallRunDistanceToPoint(frame: WallRunFrame, point: { x: number; y: number }): number {
  const along = Math.max(0, Math.min(frame.length, wallRunAlongAtPoint(frame, point)));
  const nearest = { x: frame.start.x + frame.tangent.x * along, y: frame.start.y + frame.tangent.y * along };
  return Math.hypot(point.x - nearest.x, point.y - nearest.y);
}

/**
 * The wall run nearest to a plan point. A peninsula wins only inside its
 * explicit hit radius so a pointer near a room edge is not stolen by a nearby
 * peninsula; otherwise the closest usable perimeter run is chosen.
 */
export function nearestWallRunAtPoint(
  room: RoomData,
  point: { x: number; y: number },
  peninsulaHitRadius = 0,
): { frame: WallRunFrame; distance: number; along: number } | null {
  const scored = roomWallRunFrames(room).map((frame) => {
    const along = wallRunAlongAtPoint(frame, point);
    // A point past either end of a run is not on that run: the same rule for
    // every wall kind, so a drop beyond a wall's end lands on its neighbour.
    const outsideRun = along < frame.runStart - COLLISION_EPSILON_IN || along > frame.runEnd + COLLISION_EPSILON_IN;
    const distance = outsideRun ? Number.POSITIVE_INFINITY : wallRunDistanceToPoint(frame, point);
    return { frame, distance, along };
  });
  const peninsula = scored
    .filter((entry) => entry.frame.kind === "peninsula" && entry.distance <= peninsulaHitRadius)
    .sort((left, right) => left.distance - right.distance)[0];
  if (peninsula) return peninsula;
  const perimeter = scored
    .filter((entry) => entry.frame.kind !== "peninsula" && Number.isFinite(entry.distance))
    .sort((left, right) => left.distance - right.distance)[0];
  return perimeter ?? null;
}

/** Plan center of a placed item's rectangular envelope. */
export function placedPlanCenter(p: PlacedCabinet): { x: number; y: number } {
  const footprint = placedFootprint(p);
  return { x: p.x + footprint.w / 2, y: p.y + footprint.d / 2 };
}

/**
 * Center inferred from a cabinet's stored plan envelope when that envelope was
 * originally seated on `frame`, even if an old save carries a screen-square
 * rotation. This prevents a rotation-only repair from sliding an upper along a
 * 45° wall just because the stale rotation made its screen bounding box smaller.
 */
function wallOrientedEnvelopeCenter(p: PlacedCabinet, frame: WallRunFrame): { x: number; y: number } {
  const span = alongRunSpan(p);
  const depth = Number(p.depth) || (p.placement === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH);
  const boundWidth = Math.abs(span * frame.tangent.x) + Math.abs(depth * frame.inward.x);
  const boundDepth = Math.abs(span * frame.tangent.y) + Math.abs(depth * frame.inward.y);
  return { x: p.x + boundWidth / 2, y: p.y + boundDepth / 2 };
}

/**
 * True when a cabinet's saved run metadata (wallId + wallOffset) names a run
 * this room knows about. The same answer on a standard side, a drawn wall or a
 * peninsula: `wallOffset` is authoritative on every wall because every commit
 * path refreshes it (see `syncWallRunOffsets`).
 */
export function seatedWallRunFrame(p: PlacedCabinet, room: RoomData): WallRunFrame | null {
  if (!p.wallId || p.wallOffset == null || !Number.isFinite(Number(p.wallOffset))) return null;
  const frame = wallRunFrame(p.wallId, room);
  if (!frame) return null;
  // A rectangular body turned off its run's axis is not seated on that run (a
  // stale or hand-edited record); consumers then fall back to plain geometry.
  // Corner bodies encode their two-leg turn in `rotation`, so they are exempt.
  const cornerKind = placedCornerGeometryKind(p);
  if (cornerKind === "standard" || cornerKind === "blind-corner") {
    const rotation = ((Math.round(Number(p.rotation) || 0) % 360) + 360) % 360;
    if (((rotation - frame.facingRotation) % 180 + 180) % 180 !== 0) return null;
  }
  if (frame.kind !== "peninsula" || !p.peninsulaSide) return frame;
  // A peninsula run has two usable faces. The run frame is built on the run's
  // default face; a cabinet seated on the opposite face sees the same run with
  // its inward normal (and therefore its facing) flipped.
  const run = peninsulaRunById(room, frame.id);
  const defaultSide = run?.cabinetSide ?? "left";
  if (p.peninsulaSide === defaultSide) return frame;
  return {
    ...frame,
    inward: { x: -frame.inward.x, y: -frame.inward.y },
    facingRotation: (frame.facingRotation + 180) % 360,
  };
}

/**
 * Along-run size of a cabinet body: its catalog width (a blind corner reserves
 * its nominal pull width). Never a rotated screen envelope.
 */
export function alongRunSpan(p: PlacedCabinet): number {
  const width = isBlindCorner(p.masterCode, p.description) ? blindCornerNominalWidth(p) : Number(p.width);
  return Math.max(0, width || 0);
}

/** Exact run offset of a cabinet on the given wall, in that wall's along-run inches. */
export function wallRunOffset(p: PlacedCabinet, side: string, room: RoomData): number {
  const frame = p.wallId === side ? seatedWallRunFrame(p, room) : null;
  if (frame) return Math.max(0, Number(p.wallOffset) || 0);
  return side === "top" || side === "bottom" ? p.x : p.y;
}

/** Along-run cabinet span. A seated cabinet uses its true catalog width, never a screen envelope. */
export function wallRunSpan(p: PlacedCabinet, side: string, room: RoomData): number {
  const frame = p.wallId === side ? seatedWallRunFrame(p, room) : null;
  if (frame) return alongRunSpan(p);
  const size = rotatedSize(p);
  return side === "top" || side === "bottom" ? size.w : size.d;
}

/** A body shifted more than one eighth off its wall is no longer seated.
 * Keep this much smaller than an intentional one-inch depth move. */
const WALL_RUN_SEAT_TOLERANCE_IN = 0.125;

/**
 * Re-derives a cabinet's run metadata from its plan body on ANY wall kind.
 * - No wallId, island faces and true corner boxes (which own their vertex
 *   snap) are returned unchanged.
 * - A body turned off its wall's facing axis, or pulled more than the seat
 *   tolerance away from it, is no longer on that run: its wallId/wallOffset
 *   are cleared so nothing trusts a stale offset.
 * - Otherwise the body is re-seated through `wallPlacementAt` at its projected
 *   1/8-inch offset with its current width/depth, keeping the user's rotation.
 * Resize, rotate and every other x/y-only edit stay correct because the commit
 * boundary runs this for every cabinet (`syncWallRunOffsets`).
 */
export function reseatOnWallRun(p: PlacedCabinet, room: RoomData): PlacedCabinet {
  if (!p.wallId || p.islandFace) return p;
  const frame = wallRunFrame(p.wallId, room);
  if (!frame) return p;
  const cornerKind = placedCornerGeometryKind(p);
  if (cornerKind !== "standard") return p;
  const strip = (): PlacedCabinet => {
    const { wallId: _wallId, wallOffset: _wallOffset, ...rest } = p;
    return rest as PlacedCabinet;
  };
  const span = alongRunSpan(p);
  const depth = Number(p.depth) || (p.placement === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH);
  const center = placedPlanCenter(p);
  const rotation = ((Math.round(p.rotation) % 360) + 360) % 360;
  const rotationMatchesWall = ((rotation - frame.facingRotation) % 180 + 180) % 180 === 0;
  // Old saved records can be physically close to a measured wall while still
  // carrying a cardinal screen rotation. Re-seat only records within the
  // ordinary wall-magnet reach, and use the frame's canonical rotation. An
  // item intentionally pulled off the wall remains untouched except for its
  // stale run metadata being cleared.
  if (!rotationMatchesWall) {
    const orientedCenter = wallOrientedEnvelopeCenter(p, frame);
    const wallReach = depth / 2 + STD.SNAP_THRESHOLD + COLLISION_EPSILON_IN;
    if (wallRunDistanceToPoint(frame, orientedCenter) > wallReach) return strip();
    const projected = wallRunAlongAtPoint(frame, orientedCenter) - span / 2;
    const maxStart = Math.max(0, frame.length - span);
    // Existing wall metadata is the user's intended along-wall location. Keep
    // it when repairing only the orientation; use the projected body center
    // only for records that never persisted an offset.
    const storedOffset = p.wallOffset != null && Number.isFinite(Number(p.wallOffset)) ? Number(p.wallOffset) : projected;
    const offset = roundToEighth(Math.max(0, Math.min(maxStart, storedOffset)));
    const spot = wallPlacementAt(offset, span, depth, frame.id, room, p.peninsulaSide);
    return { ...p, ...spot, rotation: spot.rotation, wallId: spot.wallId ?? frame.id, wallOffset: spot.wallOffset ?? offset };
  }
  const projected = wallRunAlongAtPoint(frame, center) - span / 2;
  const maxStart = Math.max(0, frame.length - span);
  const offset = roundToEighth(Math.max(0, Math.min(maxStart, projected)));
  const spot = wallPlacementAt(offset, span, depth, frame.id, room, p.peninsulaSide);
  if (Math.abs(spot.x - p.x) > WALL_RUN_SEAT_TOLERANCE_IN || Math.abs(spot.y - p.y) > WALL_RUN_SEAT_TOLERANCE_IN) return strip();
  const nextOffset = spot.wallOffset ?? offset;
  const unchanged = Math.abs(spot.x - p.x) <= COLLISION_EPSILON_IN
    && Math.abs(spot.y - p.y) <= COLLISION_EPSILON_IN
    && p.wallOffset != null
    && Math.abs(Number(p.wallOffset) - nextOffset) <= COLLISION_EPSILON_IN
    && (spot.wallId ?? frame.id) === p.wallId;
  if (unchanged) return p;
  return { ...p, x: spot.x, y: spot.y, wallId: spot.wallId ?? frame.id, wallOffset: nextOffset };
}

/** Commit-boundary pass: every seated cabinet's wallOffset agrees with its body on every wall. */
export function syncWallRunOffsets(placed: PlacedCabinet[], room: RoomData): PlacedCabinet[] {
  let changed = false;
  const next = placed.map((p) => {
    const synced = reseatOnWallRun(p, room);
    if (synced !== p) changed = true;
    return synced;
  });
  return changed ? next : placed;
}

/**
 * One-time restore normaliser for designs saved before every wall carried run
 * metadata. A rectangular perimeter cabinet with no `wallId`/`wallOffset`
 * whose back sits flush on a run (standard side, drawn wall or peninsula)
 * gains that run's id and its projected 1/8-inch offset, so it takes the same
 * engine path as a cabinet placed today. Bodies that are not flush, island
 * parts, corner bodies and records that already name a run are untouched.
 */
export function backfillLegacyWallRuns(placed: PlacedCabinet[], room: RoomData): PlacedCabinet[] {
  let changed = false;
  const next = placed.map((p) => {
    if (p.islandFace) return p;
    if (p.wallId && p.wallOffset != null && Number.isFinite(Number(p.wallOffset)) && wallRunFrame(p.wallId, room)) {
      const repaired = reseatOnWallRun(p, room);
      if (repaired !== p) changed = true;
      return repaired;
    }
    if (placedCornerGeometryKind(p) !== "standard") return p;
    const nearest = nearestWallRunAtPoint(room, placedPlanCenter(p));
    if (!nearest) return p;
    const rotation = ((Math.round(p.rotation) % 360) + 360) % 360;
    const span = alongRunSpan(p);
    const maxStart = Math.max(0, nearest.frame.length - span);
    const depth = Number(p.depth) || (p.placement === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH);
    // A legacy screen-square upper has the correct *oriented* envelope but an
    // obsolete rotation. Recover its along-run center from the intended wall
    // frame before assigning wallId/wallOffset, so this repair rotates only.
    const orientedCenter = wallOrientedEnvelopeCenter(p, nearest.frame);
    const orientedAlong = wallRunAlongAtPoint(nearest.frame, orientedCenter);
    const offset = roundToEighth(Math.max(0, Math.min(maxStart, orientedAlong - span / 2)));
    const spot = wallPlacementAt(offset, span, depth, nearest.frame.id, room, p.peninsulaSide);
    const rotationMatchesWall = ((rotation - nearest.frame.facingRotation) % 180 + 180) % 180 === 0;
    const withinWallReach = wallRunDistanceToPoint(nearest.frame, orientedCenter) <= depth / 2 + STD.SNAP_THRESHOLD + COLLISION_EPSILON_IN;
    if (!rotationMatchesWall && !withinWallReach) return p;
    if (rotationMatchesWall && (Math.abs(spot.x - p.x) > 0.125 || Math.abs(spot.y - p.y) > 0.125)) return p;
    changed = true;
    return { ...p, ...spot, rotation: spot.rotation, wallId: spot.wallId ?? nearest.frame.id, wallOffset: spot.wallOffset ?? offset };
  });
  return changed ? next : placed;
}

export type ContinuousWallApplianceSnapInfo = {
  wallId: WallSide;
  /** Floor-run cabinet touching the appliance's start edge, if any. */
  before: PlacedCabinet | null;
  /** Floor-run cabinet touching the appliance's end edge, if any. */
  after: PlacedCabinet | null;
};

/**
 * Reports a true physical appliance seam on a Continuous Wall Builder segment.
 * This uses the measured wall's catalog-width run offsets rather than rotated
 * screen envelopes, so a 45° wall can confirm a flush DW-24/SB36/DB36 run
 * without ever treating a positive overlap as a valid snap.
 */
export function continuousWallApplianceSnapInfo(
  appliance: PlacedCabinet,
  placed: PlacedCabinet[],
  room: RoomData,
): ContinuousWallApplianceSnapInfo | null {
  if (appliance.placement !== "appliance") return null;
  const wallId = cabinetWall(appliance, room);
  if (!isCustomRoomWall(room, wallId)) return null;

  const start = wallRunOffset(appliance, wallId, room);
  const end = start + wallRunSpan(appliance, wallId, room);
  if (end - start <= COLLISION_EPSILON_IN) return null;

  const floorRunPeers = placed.filter((candidate) => {
    if (candidate.uid === appliance.uid) return false;
    if (candidate.placement !== "base" && candidate.placement !== "appliance") return false;
    // A sink fixture is intentionally nested within a sink base, not a physical
    // cabinet-side neighbor for a dishwasher seam.
    if (candidate.placement === "appliance" && isSinkAppliance(candidate)) return false;
    return cabinetWall(candidate, room) === wallId;
  });

  const before = floorRunPeers.find((candidate) => {
    const candidateStart = wallRunOffset(candidate, wallId, room);
    const candidateEnd = candidateStart + wallRunSpan(candidate, wallId, room);
    return Math.abs(candidateEnd - start) <= COLLISION_EPSILON_IN;
  }) ?? null;
  const after = floorRunPeers.find((candidate) => {
    const candidateStart = wallRunOffset(candidate, wallId, room);
    return Math.abs(candidateStart - end) <= COLLISION_EPSILON_IN;
  }) ?? null;

  return before || after ? { wallId, before, after } : null;
}

/**
 * Continuous Wall Builder rooms use only their explicit measured segments.
 * Re-seat stale graph-bound or far-dragged cabinets on the closest real wall,
 * and let wallPlacementAt clamp the cabinet's full width inside that wall run.
 */
function restoredDrawnWallCornerPlacement(p: PlacedCabinet, room: RoomData) {
  if (!requiresRoomCornerPlacement(p) || !room.vertices?.length || !room.customWalls?.length || !p.wallId) return null;
  const ownedWall = room.customWalls.find((wall) => wall.id === p.wallId);
  if (!ownedWall) return null;

  // A true corner body has two wall-side legs. A normal saved-wall restore used
  // to re-seat it from its one stored wallId alone, which could leave its second
  // leg outside the connected room after refresh. Its persisted wall offset
  // identifies the original endpoint, so recover the *measured vertex* and use
  // both incident walls for the exact same placement routine used on a new drop.
  const length = polygonWallSegmentLength(ownedWall, room.vertices);
  const offset = Math.max(0, Number(p.wallOffset) || 0);
  const runSpan = Math.max(0, Number(p.width) || 0);
  const endpointIds = [ownedWall.startVertexId, ownedWall.endVertexId].sort((left, right) => {
    const leftOffset = left === ownedWall.startVertexId ? 0 : Math.max(0, length - runSpan);
    const rightOffset = right === ownedWall.startVertexId ? 0 : Math.max(0, length - runSpan);
    return Math.abs(offset - leftOffset) - Math.abs(offset - rightOffset);
  });

  for (const vertexId of endpointIds) {
    const incident = room.customWalls.filter((wall) => (
      wall.startVertexId === vertexId || wall.endVertexId === vertexId
    ));
    for (const adjoining of incident) {
      if (adjoining.id === ownedWall.id) continue;
      const primaryAngle = polygonWallAngle(ownedWall, room.vertices);
      const adjoiningAngle = polygonWallAngle(adjoining, room.vertices);
      // Only a physical 90-degree join can accept a square room-corner body.
      if (Math.abs(Math.cos(primaryAngle - adjoiningAngle)) > 1e-6) continue;
      const spot = customWallTrueCornerPlacement(p, ownedWall, adjoining, vertexId, room);
      if (spot) return spot;
    }
  }
  return null;
}

/** Plan corners of a placed body's axis-aligned envelope (rotation-aware). */
function placedEnvelopeCorners(p: PlacedCabinet): Array<{ x: number; y: number }> {
  const { w, d } = placedFootprint(p);
  return [
    { x: p.x, y: p.y },
    { x: p.x + w, y: p.y },
    { x: p.x + w, y: p.y + d },
    { x: p.x, y: p.y + d },
  ];
}
/** Point-in-polygon that also accepts points lying on the shell itself. */
function pointInsideOrOnRoomShell(px: number, py: number, vertices: NonNullable<RoomData["vertices"]>, epsilon = 1e-6): boolean {
  if (pointInPolygon(px, py, vertices)) return true;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const ax = vertices[j].x, ay = vertices[j].y, bx = vertices[i].x, by = vertices[i].y;
    const dx = bx - ax, dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
    const cx = ax + t * dx, cy = ay + t * dy;
    if (Math.hypot(px - cx, py - cy) <= epsilon) return true;
  }
  return false;
}
/** True when the whole placed envelope lies inside (or on) the drawn room shell. */
export function placedInsideDrawnRoom(p: PlacedCabinet, room: RoomData): boolean {
  const vertices = room.vertices ?? [];
  const closedShell = !room.openWallPath && vertices.length >= 3 && (room.customWalls?.length ?? 0) >= vertices.length;
  if (!closedShell) {
    // An open wall path has no enclosed polygon; its shell is the room's
    // bounding rectangle, exactly like a standard room.
    const { w, d } = placedFootprint(p);
    return p.x >= -1e-6 && p.y >= -1e-6 && p.x + w <= room.width + 1e-6 && p.y + d <= room.depth + 1e-6;
  }
  return placedEnvelopeCorners(p).every((corner) => pointInsideOrOnRoomShell(corner.x, corner.y, vertices));
}

/**
 * Shared room-shell guard for fabricated countertop surfaces. Cabinets already
 * use `placedInsideDrawnRoom`; a countertop has a polygon, not a cabinet body,
 * so it needs the same strict boundary rule in its own geometry vocabulary.
 * This prevents a seating projection or a generated peninsula slab from
 * visually passing through a room wall in Plan or 3D.
 */
export function countertopSurfaceInsideRoom(surface: CountertopSurface, room: RoomData): boolean {
  const polygon = countertopSurfacePlanPolygon(surface);
  if (polygon.length < 3) return false;
  const vertices = room.vertices ?? [];
  const closedShell = !room.openWallPath && vertices.length >= 3 && (room.customWalls?.length ?? 0) >= vertices.length;
  if (closedShell) {
    return polygon.every((point) => pointInsideOrOnRoomShell(point.x, point.y, vertices));
  }
  return polygon.every((point) => (
    point.x >= -1e-6
    && point.y >= -1e-6
    && point.x <= room.width + 1e-6
    && point.y <= room.depth + 1e-6
  ));
}

export function containCabinetOnDrawnWalls(p: PlacedCabinet, room: RoomData): PlacedCabinet {
  if (p.islandFace || !room.vertices?.length || !room.customWalls?.length) return p;
  // ONE clamp rule for every room kind: a body that already sits inside the
  // shell is left exactly where the user put it (a depth move off the wall is
  // a legitimate position, just as in a standard room). Only a body that has
  // left the shell is pulled back onto its wall run below.
  const cornerSpot = restoredDrawnWallCornerPlacement(p, room);
  // A run-owned body inside the shell is left exactly where the user put it
  // (a depth move off the wall is legitimate, as in a standard room). Legacy
  // records without run metadata still get their wallId/wallOffset back-filled.
  if (!cornerSpot && placedInsideDrawnRoom(p, room)) {
    const hasRunMetadata = Boolean(p.wallId) && p.wallOffset != null && Number.isFinite(Number(p.wallOffset));
    if (hasRunMetadata) return p;
    // A run-less body is only re-homed when its back actually sits on a wall
    // (a saved-before-metadata record). A body deliberately pulled off the
    // wall keeps its position, exactly as the standard-room clamp leaves it.
    const nearest = nearestWallRunAtPoint(room, placedPlanCenter(p));
    if (nearest) {
      const flush = wallPlacementAt(nearest.along - p.width / 2, p.width, p.depth, nearest.frame.id, room, p.peninsulaSide);
      if (Math.abs(flush.x - p.x) > 0.125 || Math.abs(flush.y - p.y) > 0.125) return p;
    }
  }
  if (cornerSpot) {
    if (
      p.x === cornerSpot.x
      && p.y === cornerSpot.y
      && p.rotation === cornerSpot.rotation
      && p.wallId === cornerSpot.wallId
      && p.wallOffset === cornerSpot.wallOffset
    ) return p;
    return { ...p, ...cornerSpot, wallId: cornerSpot.wallId, wallOffset: cornerSpot.wallOffset };
  }
  const footprint = placedFootprint(p);
  const center = { x: p.x + footprint.w / 2, y: p.y + footprint.d / 2 };
  const ownedWall = room.customWalls.find((wall) => wall.id === p.wallId);
  const wall = ownedWall ?? closestPolygonWall(center.x, center.y, room.vertices, room.customWalls);
  if (!wall) return p;
  const alongCenter = ownedWall && Number.isFinite(p.wallOffset)
    ? Number(p.wallOffset) + p.width / 2
    : positionAlongWall(center.x, center.y, wall, room.vertices);
  const spot = wallPlacementAt(alongCenter - p.width / 2, p.width, p.depth, wall.id as WallSide, room, p.peninsulaSide);
  if (
    p.x === spot.x
    && p.y === spot.y
    && p.rotation === spot.rotation
    && p.wallId === spot.wallId
    && p.wallOffset === spot.wallOffset
  ) return p;
  return {
    ...p,
    ...spot,
    wallId: spot.wallId,
    wallOffset: spot.wallOffset,
  };
}

// ─── In-bounds clamping after a room resize ─────────────────────────────────
// When the room shrinks (typed or drawn), anything that now sticks out past a
// wall must be pulled back inside. Keeps the design valid instead of leaving
// cabinets floating outside the room rectangle.
export function clampCabinetToRoom(p: PlacedCabinet, room: RoomData): PlacedCabinet {
  if (!p.islandFace && room.vertices?.length && room.customWalls?.length) {
    return containCabinetOnDrawnWalls(p, room);
  }
  // Square footprint for L-corner cabinets so a resize keeps them flush in the
  // corner instead of pulling them in by the shallow stored leg depth.
  const { w, d } = placedFootprint(p);
  const x = Math.max(0, Math.min(p.x, Math.max(0, room.width - w)));
  const y = Math.max(0, Math.min(p.y, Math.max(0, room.depth - d)));
  return p.x === x && p.y === y ? p : { ...p, x, y };
}

export function clampCabinetsToRoom(placed: PlacedCabinet[], room: RoomData): PlacedCabinet[] {
  return placed.map((p) => clampCabinetToRoom(p, room));
}

export function clampOpeningsToRoom(openings: WallOpening[], room: RoomData): WallOpening[] {
  return openings.map((o) => clampOpening(o, room));
}

export interface IslandZone {
  x: number;
  y: number;
  width: number;
  depth: number;
  /** Clockwise plan rotation of the complete island assembly, in degrees. */
  rotation?: number;
  activeFace?: IslandFace;
  /** Optional door-style override shared by island cabinets; null/undefined follows the perimeter design finish. */
  cabinetStyleId?: number | null;
	/** Optional visual countertop material override; null/undefined follows the perimeter countertop. */
	countertopMaterialId?: string | null;
	/** Exact selected countertop product for the island; null/undefined follows the perimeter product. */
	countertopProductId?: number | null;
	  /** When enabled, a Back-face cabinet may grow the work zone toward the room Back wall to accommodate its depth. */
	  autoAdjustDepthForBackFace?: boolean;
	  /** Optional continuous countertop panel at the physical left or right island end. */
	  waterfallEnd?: "none" | "left" | "right" | "both";
  /** One required continuous slab. Values are initialized from the cabinet assembly. */
  countertopWidth?: number | null;
  countertopDepth?: number | null;
  countertopOffsetX?: number | null;
  countertopOffsetY?: number | null;
  /** Exact reveal around automatic slab edges. Null/undefined uses the standard 1.5-inch reveal. */
  countertopOverhang?: number | null;
  /** A separate 42-inch seating bar, retained independently of the lower worktop. */
  raisedBar?: boolean;
  /** Side of the island that receives the raised seating bar. */
  raisedBarSide?: IslandFace;
  /** Finished seating projection beyond the lower island worktop. */
  raisedBarOverhang?: 12 | 15;
  /** When true, the explicit slab width remains centered on the island work zone instead of the current cabinet envelope. */
  countertopWidthAnchoredToZone?: boolean | null;
  /** When true, the explicit slab depth remains centered on the island work zone instead of the current cabinet envelope. */
  countertopDepthAnchoredToZone?: boolean | null;
}

export function clampIslandToRoom(island: IslandZone | null, room: RoomData): IslandZone | null {
  if (!island) return null;
  const width = Math.max(12, Math.min(island.width, room.width));
  const depth = Math.max(12, Math.min(island.depth, room.depth));
  const x = Math.max(0, Math.min(island.x, room.width - width));
  const y = Math.max(0, Math.min(island.y, room.depth - depth));
  const countertopWidth = island.countertopWidth == null ? null : Math.max(1, Math.min(island.countertopWidth, room.width));
  const countertopDepth = island.countertopDepth == null ? null : Math.max(1, Math.min(island.countertopDepth, room.depth));
  const countertopOverhang = island.countertopOverhang == null ? null : Math.max(0, Math.min(island.countertopOverhang, 24));
  return {
    ...island,
    x,
    y,
    width,
    depth,
    countertopWidth,
    countertopDepth,
    countertopOverhang,
    activeFace: island.activeFace ?? "front",
  };
}


// ─── Resize the room by dragging one wall ───────────────────────────────────
// The user can click a wall to highlight it, then drag it in/out. Dragging the
// back/front wall changes the room DEPTH; dragging the left/right wall changes
// the WIDTH. We move only the dragged wall: the top/left walls are pinned at the
// origin in our coordinate system, so growing them shifts all content; to keep
// behavior intuitive we instead always resize from the dragged edge and re-pin
// content to the origin, then clamp everything in-bounds at the call site.
//
// `deltaIn` is the signed drag distance in inches in screen space (right/down
// positive). The returned room is clamped to the sane kitchen range.
export function resizeRoomByWall(room: RoomData, side: WallSide, deltaIn: number): RoomData {
  switch (side) {
    case "right":
      return { ...room, width: clampRoomInches(room.width + deltaIn) };
    case "left":
      // Dragging the left wall left (negative delta) grows the room.
      return { ...room, width: clampRoomInches(room.width - deltaIn) };
    case "bottom":
      return { ...room, depth: clampRoomInches(room.depth + deltaIn) };
    case "top":
      // Dragging the top wall up (negative delta) grows the room.
      return { ...room, depth: clampRoomInches(room.depth - deltaIn) };
  }
}


// ─── Design add-on recommendations ──────────────────────────────────────────
// "Don't forget this" recommendations surfaced as the customer finishes a
// design. Two rules today:
//   1. Touch-up kit is ALWAYS recommended (every finished design needs one).
//   2. Roll-out trays are recommended when the design contains base cabinets
//      ("Want to add roll-out trays to any of these base cabinets?").
// These are pure data so they can be unit-tested and reused by the UI.
export type AddOnKind =
  | "touch-up-kit"
  | "roll-out-tray"
  | "end-panel"
  | "crown-molding";

export interface AddOnRecommendation {
  kind: AddOnKind;
  /** i18n key for the headline shown to the customer. */
  titleKey: string;
  /** i18n key for the supporting line. */
  bodyKey: string;
  /** masterCode to add to the cart/quote when accepted (matched at add time). */
  suggestCode: string;
  /** When true the recommendation is always shown regardless of placement. */
  always: boolean;
}

/** How many base cabinets are in the current design (drives roll-out trays). */
export function baseCabinetCount(placed: PlacedCabinet[]): number {
  return placed.filter((p) => p.placement === "base").length;
}

/** How many wall (upper) cabinets are in the design (drives crown molding). */
export function wallCabinetCount(placed: PlacedCabinet[]): number {
  return placed.filter((p) => p.placement === "wall").length;
}

/** Any cabinet that can have an exposed finished side (base/wall/tall). */
export function exposedSideCount(placed: PlacedCabinet[]): number {
  return placed.filter(
    (p) => p.placement === "base" || p.placement === "wall" || p.placement === "tall",
  ).length;
}

/**
 * Build the ordered list of add-on recommendations for a design. The touch-up
 * kit is always first (always-recommended); roll-out trays follow only when the
 * design has base cabinets. Returned in display order.
 */
export function addOnRecommendations(
  placed: PlacedCabinet[]
): AddOnRecommendation[] {
  const recs: AddOnRecommendation[] = [
    {
      kind: "touch-up-kit",
      titleKey: "addon_touchup_title",
      bodyKey: "addon_touchup_body",
      suggestCode: "TUK",
      always: true,
    },
  ];
  if (baseCabinetCount(placed) > 0) {
    recs.push({
      kind: "roll-out-tray",
      titleKey: "addon_rollout_title",
      bodyKey: "addon_rollout_body",
      // Generic roll-out tray; the actual sized RS-* is picked when added.
      suggestCode: "RS-24",
      always: false,
    });
  }
  // Exposed cabinet sides (islands, end-of-run) need a decorative end panel to
  // match the door style. Suggested once any base/wall/tall cabinet is placed.
  if (exposedSideCount(placed) > 0) {
    recs.push({
      kind: "end-panel",
      titleKey: "addon_endpanel_title",
      bodyKey: "addon_endpanel_body",
      // Base decorative end panel; the resolver picks the buyable panel in line.
      suggestCode: "BDEP",
      always: false,
    });
  }
  // Wall cabinets get a finished look with crown molding across the top.
  if (wallCabinetCount(placed) > 0) {
    recs.push({
      kind: "crown-molding",
      titleKey: "addon_crown_title",
      bodyKey: "addon_crown_body",
      suggestCode: "CM-8",
      always: false,
    });
  }
  return recs;
}


// ─── Live drag tape-measure (20/20-style) ───────────────────────────────────
// While dragging a cabinet we show the clearance on BOTH sides of it along the
// wall it sits against: from its near edge back to the previous obstacle
// (a neighbor cabinet edge, otherwise the wall start) and from its far edge to
// the next obstacle (a neighbor, otherwise the wall end). This mirrors how the
// 20/20 tape reads, e.g. "59" from the left wall" on one side and the remaining
// gap on the other. All math is in inches along the wall's run axis so it can be
// unit-tested independently of the canvas.
export interface WallSpanMeasure {
  side: WallSide;
  /** Inches from the moving item's start edge to the previous obstacle. */
  before: number;
  /** Inches from the moving item's end edge to the next obstacle. */
  after: number;
  /** Run-axis start coordinate (inches) of the moving item along the wall. */
  start: number;
  /** Run-axis end coordinate (inches) of the moving item along the wall. */
  end: number;
  /** Total wall length (inches) on the run axis. */
  wallLen: number;
  /** Whether the previous obstacle is a neighbor cabinet (vs the wall). */
  beforeIsCabinet: boolean;
  /** Whether the next obstacle is a neighbor cabinet (vs the wall). */
  afterIsCabinet: boolean;
}

// Project a placed item onto the run axis of a wall, returning [start, end] in
// inches. Peninsula and custom-wall placements carry an explicit along-run
// offset; using their rotated screen-space AABB would inflate or redirect the
// measured gap and suppress a valid post-placement filler prompt.
function runSpan(p: PlacedCabinet, side: WallSide, room?: RoomData): { start: number; end: number } {
	if (room && p.wallId === side && seatedWallRunFrame(p, room)) {
		const start = Math.max(0, Math.min(wallLength(side, room), wallRunOffset(p, side, room)));
		return { start, end: start + wallRunSpan(p, side, room) };
	}
  const { w, d } = placedFootprint(p);
  const horizontal = side === "top" || side === "bottom";
  const start = horizontal ? p.x : p.y;
  const span = horizontal ? w : d;
  return { start, end: start + span };
}

// Does an item sit on the same depth-band as the wall (i.e. is it part of this
// wall's run)? We reuse the loose wall-adjacency test for the moving item's wall
// and only consider neighbors that share the same placement layer.
export function wallSpanMeasure(
  moving: PlacedCabinet,
  room: RoomData,
  others: PlacedCabinet[],
  side: WallSide
): WallSpanMeasure {
  const wallLen = wallLength(side, room);
  const me = runSpan(moving, side, room);
  const movingLayer = floorPlanDimensionLayer(moving);

  // Neighbors on the same shared wall run + same display layer, excluding the
  // moving item. This is deliberately a read-only measurement: base cabinets,
  // appliances, tall units, panels and fillers share the lower run; uppers use
  // their own wall layer. It works on cardinal and measured/45° walls alike.
  const neighbors = others
    .filter((o) => o.uid !== moving.uid)
    .filter((o) => floorPlanDimensionLayer(o) === movingLayer)
    // A true corner body can physically occupy the adjoining standard-wall
    // seam while its durable wallId belongs to the perpendicular run. Preserve
    // that established cardinal-room measurement; measured walls continue to
    // use their explicit common run identity.
    .filter((o) => cabinetWall(o, room) === side || isAgainstWall(o, side, room))
    .map((o) => runSpan(o, side, room));

  // Previous obstacle: the closest neighbor that ends at/below our start.
  let beforeEdge = 0;
  let beforeIsCabinet = false;
  for (const n of neighbors) {
    if (n.end <= me.start + 0.001 && n.end > beforeEdge) {
      beforeEdge = n.end;
      beforeIsCabinet = true;
    }
  }

  // Next obstacle: the closest neighbor that starts at/above our end.
  let afterEdge = wallLen;
  let afterIsCabinet = false;
  for (const n of neighbors) {
    if (n.start >= me.end - 0.001 && n.start < afterEdge) {
      afterEdge = n.start;
      afterIsCabinet = true;
    }
  }

  const before = Math.max(0, me.start - beforeEdge);
  const after = Math.max(0, afterEdge - me.end);

  return {
    side,
    before,
    after,
    start: me.start,
    end: me.end,
    wallLen,
    beforeIsCabinet,
    afterIsCabinet,
  };
}

export type WallCabinetFitStatus = "fits" | "overlap" | "insufficient";

export interface WallCabinetFitMeasure {
  side: WallSide;
  layer: PlacedCabinet["placement"];
  /** Whether the cabinet is currently seated against the measured wall. */
  seated: boolean;
  requiredSpan: number;
  start: number;
  end: number;
  wallLen: number;
  availableStart: number;
  availableEnd: number;
  availableSpan: number;
  before: number;
  after: number;
  leftOverlap: number;
  rightOverlap: number;
  shortage: number;
  snapStart: number;
  snapEnd: number;
  snapBefore: number;
  snapAfter: number;
  beforeBoundary: string;
  afterBoundary: string;
  status: WallCabinetFitStatus;
}

/**
 * Measures the selected cabinet against the exact free segment on its active
 * wall. The selected item is removed from the blockers first, so the result can
 * distinguish a cabinet that fits edge-to-edge from a cabinet that is truly
 * wider than the available run. Door and window clearances use the same
 * authoritative three-inch rule as wall auto-placement.
 */
export function wallCabinetFitMeasure(
  moving: PlacedCabinet,
  room: RoomData,
  others: PlacedCabinet[],
  openings: WallOpening[],
  side: WallSide = cabinetWall(moving, room),
  openingClearance = WALL_OPENING_CLEARANCE_IN,
): WallCabinetFitMeasure {
  const wallLen = wallLength(side, room);
  const me = runSpan(moving, side, room);
  const requiredSpan = Math.max(0, me.end - me.start);
	  const peers = others
	    .filter((other) => other.uid !== moving.uid)
	    // A room-wall fit must not infer a wall run from a cabinet on an island
	    // face, even if its island position happens to be closest to this wall.
	    .filter((other) => !other.islandFace)
	    .filter((other) => sharesPlanCollisionZone(moving, other))
	    // Ordinary perpendicular cabinets belong to only one selected-wall run.
	    // A genuine diagonal/L/corner-drawer cabinet physically reserves both wall
	    // legs, including legacy WDC records whose saved rotation still points at
	    // the first wall. A configured BBC is the narrow rectangular exception: it
	    // reserves its 24-inch body on the perpendicular run and its attached
	    // 3-inch filler reserves the next span. Count both here so exact-drop
	    // feedback and automatic placement agree that the following base begins
	    // 27 inches from that corner—not inside the BBC body.
	    .filter((other) => {
	      if (cabinetWall(other, room) === side) return true;
	      const cornerKind = placedCornerGeometryKind(other);
	      const reservesPerpendicularRun = cornerKind === "l-shape"
	        || cornerKind === "diagonal"
	        || cornerKind === "corner-drawer"
	        || isBaseBlindCorner(other);
	      return reservesPerpendicularRun && isAgainstWall(other, side, room);
	    });
  const segments = freeSegmentsOnWall(
    side,
    room,
    peers,
    openings,
    0,
    moving.placement === "wall" ? openingClearance : 0,
    moving.placement,
    // A normal wall cabinet beside a refrigerator must measure against the
    // refrigerator's true edge, not an inset over-fridge bridge. Dedicated
    // refrigerator bridge cabinets remain allowed to share the appliance span.
    moving.placement === "wall" && !isRefrigeratorWallCabinet(moving),
    moving,
  );
  const distanceToSegment = (segment: WallSegment) => {
    const segmentEnd = segment.start + segment.length;
    if (me.end < segment.start) return segment.start - me.end;
    if (me.start > segmentEnd) return me.start - segmentEnd;
    return 0;
  };
	  // `minLen: 0` intentionally preserves real short spans for an
	  // insufficient-opening message. A zero-length corner remnant, however,
	  // cannot describe an opening and must not win the nearest-segment tie and
	  // suggest a snap back into a BBC body or its required filler.
	  const measurableSegments = segments.filter((segment) => segment.length > COLLISION_EPSILON_IN);
	  const selectedSegment = (measurableSegments.length > 0 ? measurableSegments : segments).reduce<WallSegment | null>((best, segment) => {
    if (!best) return segment;
    const distance = distanceToSegment(segment);
    const bestDistance = distanceToSegment(best);
    if (distance !== bestDistance) return distance < bestDistance ? segment : best;
    const center = segment.start + segment.length / 2;
    const bestCenter = best.start + best.length / 2;
    const movingCenter = (me.start + me.end) / 2;
    return Math.abs(center - movingCenter) < Math.abs(bestCenter - movingCenter) ? segment : best;
  }, null);
  const availableStart = selectedSegment?.start ?? Math.max(0, Math.min(wallLen, me.start));
  const availableEnd = selectedSegment ? selectedSegment.start + selectedSegment.length : availableStart;
  const availableSpan = Math.max(0, availableEnd - availableStart);

  let leftOverlap = 0;
  let rightOverlap = 0;
  const movingCenter = (me.start + me.end) / 2;
  for (const peer of peers) {
    const span = runSpan(peer, side, room);
    const overlap = Math.min(me.end, span.end) - Math.max(me.start, span.start);
    if (overlap <= COLLISION_EPSILON_IN) continue;
    const peerCenter = (span.start + span.end) / 2;
    if (peerCenter <= movingCenter) leftOverlap = Math.max(leftOverlap, overlap);
    else rightOverlap = Math.max(rightOverlap, overlap);
  }

  const status: WallCabinetFitStatus = leftOverlap > 0 || rightOverlap > 0
    ? "overlap"
    : availableSpan + COLLISION_EPSILON_IN < requiredSpan
      ? "insufficient"
      : "fits";
  const shortage = Math.max(0, requiredSpan - availableSpan);
  const snapStart = availableSpan + COLLISION_EPSILON_IN >= requiredSpan
    ? Math.max(availableStart, Math.min(me.start, availableEnd - requiredSpan))
    : availableStart;
  const snapEnd = snapStart + requiredSpan;
  const boundaryLabel = (coordinate: number, edge: "before" | "after"): string => {
    if (coordinate <= COLLISION_EPSILON_IN) return "wall start";
    if (coordinate >= wallLen - COLLISION_EPSILON_IN) return "wall end";
    const peer = peers.find((candidate) => {
      const span = runSpan(candidate, side, room);
      const boundary = edge === "before" ? span.end : span.start;
      return Math.abs(boundary - coordinate) <= CABINET_SEAM_SNAP_IN + COLLISION_EPSILON_IN;
    });
    if (peer) return peer.masterCode;
    const opening = openings.find((candidate) => {
      if (candidate.side !== side) return false;
      const clearance = moving.placement === "wall" ? openingClearance : 0;
      const near = candidate.offset - clearance;
      const far = candidate.offset + candidate.width + clearance;
      return Math.abs(near - coordinate) <= 0.13 || Math.abs(far - coordinate) <= 0.13;
    });
    if (opening) return `${opening.label || opening.kind} clearance`;
    return "corner/opening boundary";
  };

  return {
    side,
    layer: moving.placement,
    seated: isAgainstWall(moving, side, room),
    requiredSpan,
    start: me.start,
    end: me.end,
    wallLen,
    availableStart,
    availableEnd,
    availableSpan,
    before: Math.max(0, me.start - availableStart),
    after: Math.max(0, availableEnd - me.end),
    leftOverlap,
    rightOverlap,
    shortage,
    snapStart,
    snapEnd,
    snapBefore: Math.max(0, snapStart - availableStart),
    snapAfter: Math.max(0, availableEnd - snapEnd),
    beforeBoundary: boundaryLabel(availableStart, "before"),
    afterBoundary: boundaryLabel(availableEnd, "after"),
    status,
  };
}

/**
 * Explains whether a rejected wall placement merely needs to snap into an
 * otherwise adequate opening or whether no opening is wide enough. This keeps
 * true collision details distinct from insufficient-space guidance.
 */
export function wallCabinetPlacementReason(
  moving: PlacedCabinet,
  room: RoomData,
  others: PlacedCabinet[],
  openings: WallOpening[],
): string | null {
  // Keep the diagnostic in lockstep with the commit guard. A required or
  // legacy 3-inch BBC return may overlap the rectangular envelope by its
  // shallow boundary seam; re-checking with the raw rectangle helper here
  // incorrectly reports that allowed F342 overlap as a hard rejection.
  const collision = cabinetPlacementCollisionDetail(moving, others, room);
  if (moving.placement !== "wall" && moving.placement !== "base") return collisionReason(moving, others);
  const fit = wallCabinetFitMeasure(moving, room, others, openings);
  if (!fit.seated) return collisionReason(moving, others);
  const required = formatEighthInches(fit.requiredSpan);
  const available = formatEighthInches(fit.availableSpan);
  const sideName = ({ top: "back/top", bottom: "front/bottom", left: "left", right: "right" } as const)[fit.side];
  const layerName = moving.placement === "wall" ? "wall-cabinet layer" : "base-cabinet layer";
  const boundaries = `${fit.beforeBoundary} and ${fit.afterBoundary}`;
  if (fit.availableSpan + COLLISION_EPSILON_IN < fit.requiredSpan) {
    const shortage = formatEighthInches(fit.shortage);
    const overlapText = collision ? ` It also overlaps ${collision.cabinet.masterCode} by ${formatEighthInches(collision.penetration)}.` : "";
    return `Cannot place ${moving.masterCode} on the ${sideName} wall ${layerName}: the cabinet uses ${required}, but only ${available} is clear between ${boundaries}. The opening is ${shortage} too small.${overlapText} Choose a smaller matching cabinet or adjust the run.`;
  }
  if (collision) {
    const overlap = formatEighthInches(collision.penetration);
    return `Cannot place ${moving.masterCode} at this exact position on the ${sideName} wall ${layerName}: it overlaps ${collision.cabinet.masterCode} by ${overlap}. A ${available} clear opening exists between ${boundaries}; snap the cabinet to ${formatEighthInches(fit.snapStart)}–${formatEighthInches(fit.snapEnd)}. Edge-to-edge contact is allowed and physical overlap must be 0".`;
  }
  return null;
}

// ─── Countertop materials & surfaces ─────────────────────────────────────────
// A small, curated material palette. Each material carries a plan-view fill,
// a darker edge for the front lip/seam, and a label for legends/BOM. Colors are
// indicative renders only — actual material/edge/fabrication is supplier-quoted.
export interface CountertopMaterial {
  id: string;
  name: string;
  fill: string;   // plan/front slab fill
  edge: string;   // front lip / outline
  speckle?: string; // optional accent dots for stone look
}

export const COUNTERTOP_MATERIALS: CountertopMaterial[] = [
  { id: "white-quartz",   name: "White Quartz",   fill: "#eef0f2", edge: "#c4c9cf", speckle: "#cfd4d9" },
  { id: "carrara-marble", name: "Carrara Marble", fill: "#e9ecef", edge: "#b7bec6", speckle: "#aeb6bf" },
  { id: "black-granite",  name: "Black Granite",  fill: "#2c2f33", edge: "#15171a", speckle: "#5b6068" },
  { id: "butcher-block",  name: "Butcher Block",  fill: "#b9824a", edge: "#8a5d30", speckle: "#a06f3c" },
  { id: "concrete-gray",  name: "Concrete Gray",  fill: "#8b9097", edge: "#666b72", speckle: "#7c818a" },
  { id: "sand-quartz",    name: "Sand Quartz",    fill: "#ddd2bb", edge: "#bcae90", speckle: "#c9bc9f" },
];

export const DEFAULT_COUNTERTOP_MATERIAL_ID = "white-quartz";

export function countertopMaterial(id: string | null | undefined): CountertopMaterial {
  return (
    COUNTERTOP_MATERIALS.find((m) => m.id === id) ??
    COUNTERTOP_MATERIALS[0]
  );
}

// ─── Countertop Edge Profiles ────────────────────────────────────────────────
// Common edge profiles offered by fabricators. The profile is a visual/quote
// attribute only — it doesn't change geometry in the 2D plan. It appears on the
// build sheet and BOM so the fabricator knows what to cut.
export interface EdgeProfile {
  id: string;
  name: string;
  /** SVG path for a small cross-section icon (viewBox 0 0 24 16) */
  svgPath: string;
}

export const EDGE_PROFILES: EdgeProfile[] = [
  { id: "eased",       name: "Eased",         svgPath: "M2 14 L2 4 Q2 2 4 2 L22 2 L22 14" },
  { id: "bullnose",    name: "Full Bullnose", svgPath: "M2 14 L2 8 Q2 2 8 2 L22 2 L22 14" },
  { id: "half-bull",   name: "Half Bullnose", svgPath: "M2 14 L2 6 Q2 2 6 2 L22 2 L22 14" },
  { id: "bevel",       name: "Bevel",         svgPath: "M2 14 L2 6 L6 2 L22 2 L22 14" },
  { id: "ogee",        name: "Ogee",          svgPath: "M2 14 L2 8 Q2 5 4 4 Q6 2 8 2 L22 2 L22 14" },
  { id: "dupont",      name: "DuPont",        svgPath: "M2 14 L2 6 Q2 2 6 2 L6 4 Q6 6 8 6 L8 2 L22 2 L22 14" },
  { id: "waterfall",   name: "Waterfall",     svgPath: "M2 14 L2 2 L22 2 L22 14" },
  { id: "mitered",     name: "Mitered",       svgPath: "M2 14 L2 2 L22 2 L22 14 L18 14 L18 6 L6 6 L6 14" },
];

export const DEFAULT_EDGE_PROFILE_ID = "eased";

export function edgeProfile(id: string | null | undefined): EdgeProfile {
  return EDGE_PROFILES.find((p) => p.id === id) ?? EDGE_PROFILES[0];
}

// A rectangular countertop surface in room (inch) coordinates, used by the plan
// renderer to draw a visible slab over base cabinets and the island.
export interface CountertopSurface {
  x: number;
  y: number;
  width: number;
  depth: number;
  kind: "base" | "island";
  /** Optional locked plan rotation for a cabinet-supported peninsula slab. */
  rotation?: number;
  /** Explicit-run identity for a continuous cabinet-supported peninsula slab. */
  peninsulaRunId?: string;
  /** Every connected run represented by one unified peninsula countertop outline. */
  peninsulaRunIds?: string[];
  /** The exposed end run used for any waterfall at the end of a unified slab. */
  peninsulaTerminalRunId?: string;
  /** Along-run start for a segmented peninsula slab, measured from the run attachment. */
  runStartIn?: number;
  /** Local slab outline in inches when a connected run edge is miter-clipped. */
  polygon?: CountertopPlanPoint[];
  /** Marks the connected slab edge that participates in the shared miter. */
  miteredStart?: boolean;
  miteredEnd?: boolean;
  /** Physical slab length used for takeoff when the plan rectangle is rotated. */
  linearInches?: number;
  /** Actual connected cabinet-run length for takeoff when one polygon spans turns. */
  runLinearInches?: number;
  /** Physical slab area used for takeoff when the plan rectangle is rotated. */
  areaInches?: number;
  /** Bar projection beyond the cabinet-back drywall pony wall. */
  ponyWallBarOverhangIn?: number;
  /** Drywall thickness plus bar projection carried behind the cabinet backs. */
  ponyWallBackExtensionIn?: number;
  /** A separately fabricated 42-inch seating bar, drawn above the worktop in 3D. */
  raisedBar?: boolean;
  /** Raised bar follows the exact cabinet-supported countertop outline across its return. */
  raisedBarUsesSharedCountertopOutline?: boolean;
  /** Finished front overhang measured from the cabinet carcass. */
  raisedBarOverhangIn?: number;
  /** Finished installation height for the separate seating bar. */
  countertopHeightIn?: number;
  /** Measured continuous wall that owns this cabinet-supported countertop piece. */
  customWallId?: string;
	/** Exact standard wall that supplied the cabinet support before a corner AABB can become ambiguous. */
	supportWallId?: WallSide;
	/** Stable physical cabinet run represented by this single countertop piece. */
	cabinetRunId?: string;
  /** Lower-only structural fill at a peninsula miter, never a raised-bar source. */
  peninsulaMiterInfill?: boolean;
  /** Along-wall start for a measured continuous-wall countertop piece. */
  customWallRunStartIn?: number;
  /** Exact continuous-wall IDs joined by a physical countertop miter bridge. */
  customWallMiterWallIds?: [string, string];
  /** The shared measured wall vertex that owns this 45-degree miter bridge. */
  customWallMiterVertexId?: string;
  /** Cabinet-supported fill that closes the wall-side void at a true 45-degree inside turn. */
  customWallCornerInfill?: boolean;
  /** Exact continuous-wall IDs joined by a physical flush 90-degree countertop seam. */
  customWallSquareCornerWallIds?: [string, string];
  /** Shared measured wall vertex that owns this flush 90-degree countertop seam. */
  customWallSquareCornerVertexId?: string;
  /**
   * The exterior leg of a real L-corner cabinet that projects beyond the
   * ordinary peninsula run depth. It is a cabinet-supported portion of the
   * connected slab, never a filler or an inferred countertop span.
   */
  peninsulaCornerSupportExtension?: boolean;
  /** Free-standing (open-room) chain members covered by this one mitered slab. */
  freestandingMemberUids?: string[];
}

export interface CountertopPlanPoint {
  x: number;
  y: number;
}

function countertopSurfaceLocalPolygon(surface: CountertopSurface): CountertopPlanPoint[] {
  return surface.polygon?.map((point) => ({ ...point })) ?? [
    { x: 0, y: 0 },
    { x: surface.width, y: 0 },
    { x: surface.width, y: surface.depth },
    { x: 0, y: surface.depth },
  ];
}

export function countertopSurfacePlanPolygon(surface: CountertopSurface): CountertopPlanPoint[] {
  const radians = (surface.rotation ?? 0) * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const centerX = surface.x + surface.width / 2;
  const centerY = surface.y + surface.depth / 2;
  return countertopSurfaceLocalPolygon(surface).map((point) => {
    const localX = point.x - surface.width / 2;
    const localY = point.y - surface.depth / 2;
    return {
      x: centerX + localX * cos - localY * sin,
      y: centerY + localX * sin + localY * cos,
    };
  });
}

function countertopPolygonArea(points: CountertopPlanPoint[]): number {
  if (points.length < 3) return 0;
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]!;
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

function countertopSurfaceLocalPointFromWorld(
  surface: CountertopSurface,
  point: CountertopPlanPoint,
): CountertopPlanPoint {
  const radians = (surface.rotation ?? 0) * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const centerX = surface.x + surface.width / 2;
  const centerY = surface.y + surface.depth / 2;
  const worldX = point.x - centerX;
  const worldY = point.y - centerY;
  return {
    x: worldX * cos + worldY * sin + surface.width / 2,
    y: -worldX * sin + worldY * cos + surface.depth / 2,
  };
}

export function countertopRunFaceNormal(radians: number, side: PeninsulaCabinetSide): CountertopPlanPoint {
  const leftNormal = { x: -Math.sin(radians), y: Math.cos(radians) };
  return side === "left" ? leftNormal : { x: -leftNormal.x, y: -leftNormal.y };
}

function countertopOffsetEdgeMiterPoint(
  joint: CountertopPlanPoint,
  parentRadians: number,
  parentNormal: CountertopPlanPoint,
  parentCabinetFacingReach: number,
  childRadians: number,
  childNormal: CountertopPlanPoint,
  childCabinetFacingReach: number,
): CountertopPlanPoint {
  // A bar/seating top is deliberately deeper only *behind* the cabinets. Its
  // total depth must never be mistaken for the cabinet-facing reach at a 45°
  // miter; doing so lengthens the door-side edge by the bar projection. Each
  // angled front therefore follows the cabinet boxes at the normal 24" + 1½"
  // finished edge, while the rear projection remains part of the same slab.
  const parentOuter = { x: joint.x + parentNormal.x * parentCabinetFacingReach, y: joint.y + parentNormal.y * parentCabinetFacingReach };
  const childOuter = { x: joint.x + childNormal.x * childCabinetFacingReach, y: joint.y + childNormal.y * childCabinetFacingReach };
  const parentTangent = { x: Math.cos(parentRadians), y: Math.sin(parentRadians) };
  const childTangent = { x: Math.cos(childRadians), y: Math.sin(childRadians) };
  const determinant = parentTangent.x * childTangent.y - parentTangent.y * childTangent.x;
  const fallback = { x: (parentOuter.x + childOuter.x) / 2, y: (parentOuter.y + childOuter.y) / 2 };
  if (Math.abs(determinant) <= 1e-9) return fallback;
  const delta = { x: childOuter.x - parentOuter.x, y: childOuter.y - parentOuter.y };
  const amount = (delta.x * childTangent.y - delta.y * childTangent.x) / determinant;
  const intersection = {
    x: parentOuter.x + parentTangent.x * amount,
    y: parentOuter.y + parentTangent.y * amount,
  };
  const maximumProjection = Math.max(parentCabinetFacingReach, childCabinetFacingReach) * 2;
  return Math.hypot(intersection.x - joint.x, intersection.y - joint.y) <= maximumProjection
    ? intersection
    : fallback;
}

function countertopSurfaceWithMiterPoint(
  surface: CountertopSurface,
  run: PeninsulaRun,
  room: RoomData,
  atStart: boolean,
  miterPoint: CountertopPlanPoint,
): CountertopSurface {
  const local = countertopSurfaceLocalPolygon(surface);
  const world = countertopSurfacePlanPolygon(surface);
  const geometry = peninsulaRunEndpoints(run, room);
  const tangent = { x: Math.cos(geometry.radians), y: Math.sin(geometry.radians) };
  const cabinetFacingNormal = countertopRunFaceNormal(geometry.radians, run.cabinetSide ?? "left");
  // The lower worktop finishes on the cabinet-facing normal. A separate raised
  // seating bar is deliberately on the opposite side of that same run, so its
  // 45° miter must replace the seating-side endpoint. Selecting the lower-top
  // endpoint here turns the bar into a crossed triangle and can leave its return
  // visibly detached in 3D.
  const normal = surface.raisedBar
    ? { x: -cabinetFacingNormal.x, y: -cabinetFacingNormal.y }
    : cabinetFacingNormal;
  const targetAlong = atStart ? (surface.runStartIn ?? 0) : (surface.runStartIn ?? 0) + (surface.linearInches ?? surface.width);
  let outerIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  world.forEach((point, index) => {
    const along = (point.x - geometry.start.x) * tangent.x + (point.y - geometry.start.y) * tangent.y;
    const outward = (point.x - geometry.start.x) * normal.x + (point.y - geometry.start.y) * normal.y;
    const score = Math.abs(along - targetAlong) + Math.abs(outward - surface.depth);
    if (score < bestScore) {
      bestScore = score;
      outerIndex = index;
    }
  });
  local[outerIndex] = countertopSurfaceLocalPointFromWorld(surface, miterPoint);
  return {
    ...surface,
    polygon: local,
    areaInches: countertopPolygonArea(local),
    ...(atStart ? { miteredStart: true } : { miteredEnd: true }),
  };
}

type CountertopRunEndEdge = {
  innerIndex: number;
  outerIndex: number;
  innerPoint: CountertopPlanPoint;
  outerPoint: CountertopPlanPoint;
};

/**
 * Returns the two slab vertices at a run endpoint. The local polygon may
 * already contain a miter at its opposite endpoint, so identify this edge from
 * the measured run axis rather than assuming a four-vertex rectangle.
 */
function countertopSurfaceRunEndEdge(
  surface: CountertopSurface,
  run: PeninsulaRun,
  room: RoomData,
  atStart: boolean,
): CountertopRunEndEdge | null {
  const world = countertopSurfacePlanPolygon(surface);
  if (world.length < 3) return null;
  const geometry = peninsulaRunEndpoints(run, room);
  const tangent = { x: Math.cos(geometry.radians), y: Math.sin(geometry.radians) };
  const normal = countertopRunFaceNormal(geometry.radians, run.cabinetSide ?? "left");
  const targetAlong = atStart
    ? surface.runStartIn ?? 0
    : (surface.runStartIn ?? 0) + (surface.linearInches ?? surface.width);
  const endpoints = world
    .map((point, index) => ({
      index,
      point,
      along: (point.x - geometry.start.x) * tangent.x + (point.y - geometry.start.y) * tangent.y,
      outward: (point.x - geometry.start.x) * normal.x + (point.y - geometry.start.y) * normal.y,
    }))
    .sort((left, right) => Math.abs(left.along - targetAlong) - Math.abs(right.along - targetAlong))
    .slice(0, 2)
    .sort((left, right) => left.outward - right.outward);
  if (endpoints.length !== 2) return null;
  return {
    innerIndex: endpoints[0]!.index,
    outerIndex: endpoints[1]!.index,
    innerPoint: endpoints[0]!.point,
    outerPoint: endpoints[1]!.point,
  };
}

function countertopLineIntersection(
  firstPoint: CountertopPlanPoint,
  firstDirection: CountertopPlanPoint,
  secondPoint: CountertopPlanPoint,
  secondDirection: CountertopPlanPoint,
): CountertopPlanPoint | null {
  const determinant = firstDirection.x * secondDirection.y - firstDirection.y * secondDirection.x;
  if (Math.abs(determinant) <= 1e-9) return null;
  const delta = { x: secondPoint.x - firstPoint.x, y: secondPoint.y - firstPoint.y };
  const amount = (delta.x * secondDirection.y - delta.y * secondDirection.x) / determinant;
  return {
    x: firstPoint.x + firstDirection.x * amount,
    y: firstPoint.y + firstDirection.y * amount,
  };
}

/**
 * At a square peninsula bend raw rectangular slabs overlap in one quadrant.
 * Trim each physical outer edge back to its real intersection, then bridge the
 * measured bend itself. This creates one continuous L-shaped slab without the
 * triangular 3D hole caused by cutting both rectangles to one shared point.
 */
function countertopSurfaceWithSquareCornerMiter(
  surface: CountertopSurface,
  edge: CountertopRunEndEdge,
  outerCorner: CountertopPlanPoint,
  atStart: boolean,
  bridgePoint?: CountertopPlanPoint,
): CountertopSurface {
  const local = countertopSurfaceLocalPolygon(surface);
  // The inner endpoint is already the measured bend. Re-inserting that same
  // point created a zero-length polygon edge. Three.js can triangulate that
  // degenerate edge into the detached triangular top seen in 3D. Keep the
  // original bend vertex and replace only the physical outer endpoint so both
  // slabs share one clean, square seam from bend to outside intersection.
  local[edge.outerIndex] = countertopSurfaceLocalPointFromWorld(surface, outerCorner);

  // A seating/bar projection can make the far run's original inside corner sit
  // beyond the adjoining run's physical end. In that case the two slabs need a
  // short second seam vertex as well. Without it the new outer-corner trim is
  // mathematically valid but leaves a triangular hole between the two countertop
  // faces. Add it only when it is distinct from the endpoint already present.
  if (bridgePoint) {
    const bridgeLocal = countertopSurfaceLocalPointFromWorld(surface, bridgePoint);
    const innerLocal = local[edge.innerIndex]!;
    const outerLocal = local[edge.outerIndex]!;
    const isDistinct = Math.hypot(bridgeLocal.x - innerLocal.x, bridgeLocal.y - innerLocal.y) > 1e-6
      && Math.hypot(bridgeLocal.x - outerLocal.x, bridgeLocal.y - outerLocal.y) > 1e-6;
    if (isDistinct) {
      const insertAt = (edge.outerIndex + 1) % local.length === edge.innerIndex
        ? edge.innerIndex
        : edge.outerIndex + 1;
      local.splice(insertAt, 0, bridgeLocal);
    }
  }
  return {
    ...surface,
    polygon: local,
    areaInches: countertopPolygonArea(local),
    ...(atStart ? { miteredStart: true } : { miteredEnd: true }),
  };
}

/**
 * Joins the outer cabinet-side edges at one bounded shared point. Unlike an
 * infinite outside-line intersection, this miter cannot project beyond both
 * physical countertop edges at an acute 45-degree turn.
 */
export function miteredPeninsulaCountertopSurfaces(
  surfaces: CountertopSurface[],
  room: RoomData,
): CountertopSurface[] {
  const resolved: CountertopSurface[] = surfaces.map((surface) => ({ ...surface, polygon: surface.polygon?.map((point) => ({ ...point })) }));
  for (const child of room.peninsulaRuns ?? []) {
    if (!child.parentRunId) continue;
    const parent = room.peninsulaRuns?.find((candidate) => candidate.id === child.parentRunId);
    if (!parent || (parent.cabinetSide ?? "left") !== (child.cabinetSide ?? "left")) continue;
    const parentIndices = resolved
      .map((surface, index) => ({ surface, index }))
      .filter(({ surface }) => !surface.peninsulaCornerSupportExtension && surface.peninsulaRunId === parent.id && (surface.runStartIn ?? 0) + (surface.linearInches ?? surface.width) >= parent.length - COLLISION_EPSILON_IN);
    const childIndices = resolved
      .map((surface, index) => ({ surface, index }))
      .filter(({ surface }) => !surface.peninsulaCornerSupportExtension && surface.peninsulaRunId === child.id && (surface.runStartIn ?? 0) <= COLLISION_EPSILON_IN);
    if (parentIndices.length === 0 || childIndices.length === 0) continue;
    const parentGeometry = peninsulaRunEndpoints(parent, room);
    const childGeometry = peninsulaRunEndpoints(child, room);
    const side = parent.cabinetSide ?? "left";
	    for (const { index: parentIndex } of parentIndices) {
	      for (const { index: childIndex } of childIndices) {
	        const parentSurface = resolved[parentIndex]!;
	        const childSurface = resolved[childIndex]!;
        // Both the 36-inch worktop and the 42-inch raised level follow the
        // same cabinet face and 1½-inch front edge. Height is their only
        // different physical dimension, so their 45° miters use the identical
        // cabinet-side normals rather than a legacy seating offset.
        const parentNormal = countertopRunFaceNormal(parentGeometry.radians, side);
        const childNormal = countertopRunFaceNormal(childGeometry.radians, side);
	        const rightAngle = Math.abs(Math.cos(parentGeometry.radians - childGeometry.radians)) <= 1e-6;
	        if (rightAngle) {
	          const parentEdge = countertopSurfaceRunEndEdge(parentSurface, parent, room, false);
	          const childEdge = countertopSurfaceRunEndEdge(childSurface, child, room, true);
	          const parentTangent = { x: Math.cos(parentGeometry.radians), y: Math.sin(parentGeometry.radians) };
	          const childTangent = { x: Math.cos(childGeometry.radians), y: Math.sin(childGeometry.radians) };
	          const outerCorner = parentEdge && childEdge
	            ? countertopLineIntersection(parentEdge.outerPoint, parentTangent, childEdge.outerPoint, childTangent)
	            : null;
	          if (parentEdge && childEdge && outerCorner) {
	            resolved[parentIndex] = countertopSurfaceWithSquareCornerMiter(parentSurface, parentEdge, outerCorner, false);
	            resolved[childIndex] = countertopSurfaceWithSquareCornerMiter(childSurface, childEdge, outerCorner, true, parentEdge.innerPoint);
	            continue;
	          }
	        }
        const miterPoint = countertopOffsetEdgeMiterPoint(
          parentGeometry.end,
          parentGeometry.radians,
          parentNormal,
          parentSurface.depth,
          childGeometry.radians,
          childNormal,
          childSurface.depth,
        );
        resolved[parentIndex] = countertopSurfaceWithMiterPoint(parentSurface, parent, room, false, miterPoint);
        resolved[childIndex] = countertopSurfaceWithMiterPoint(childSurface, child, room, true, miterPoint);
      }
    }
  }
  return resolved;
}

function sameCountertopPlanPoint(left: CountertopPlanPoint, right: CountertopPlanPoint, tolerance = 0.001): boolean {
  return Math.hypot(left.x - right.x, left.y - right.y) <= tolerance;
}

function countertopBoundaryPath(points: CountertopPlanPoint[], startIndex: number, endIndex: number): CountertopPlanPoint[] {
  const result: CountertopPlanPoint[] = [];
  for (let index = startIndex; ; index = (index + 1) % points.length) {
    result.push(points[index]!);
    if (index === endIndex) return result;
  }
}

function removeConsecutiveCountertopPlanDuplicates(points: CountertopPlanPoint[]): CountertopPlanPoint[] {
  const resolved = points.filter((point, index) => index === 0 || !sameCountertopPlanPoint(point, points[index - 1]!));
  return resolved.length > 1 && sameCountertopPlanPoint(resolved[0]!, resolved[resolved.length - 1]!)
    ? resolved.slice(0, -1)
    : resolved;
}

function countertopCrossProduct(left: CountertopPlanPoint, right: CountertopPlanPoint): number {
  return left.x * right.y - left.y * right.x;
}

function countertopSegmentParameterAtIntersection(
  start: CountertopPlanPoint,
  end: CountertopPlanPoint,
  otherStart: CountertopPlanPoint,
  otherEnd: CountertopPlanPoint,
): number | null {
  const direction = { x: end.x - start.x, y: end.y - start.y };
  const otherDirection = { x: otherEnd.x - otherStart.x, y: otherEnd.y - otherStart.y };
  const denominator = countertopCrossProduct(direction, otherDirection);
  if (Math.abs(denominator) <= 1e-9) return null;
  const offset = { x: otherStart.x - start.x, y: otherStart.y - start.y };
  const along = countertopCrossProduct(offset, otherDirection) / denominator;
  const otherAlong = countertopCrossProduct(offset, direction) / denominator;
  if (along < -1e-6 || along > 1 + 1e-6 || otherAlong < -1e-6 || otherAlong > 1 + 1e-6) return null;
  return Math.min(1, Math.max(0, along));
}

function countertopPointIsStrictlyInsidePolygon(point: CountertopPlanPoint, polygon: CountertopPlanPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const current = polygon[index]!;
    const prior = polygon[previous]!;
    const edge = { x: current.x - prior.x, y: current.y - prior.y };
    const offset = { x: point.x - prior.x, y: point.y - prior.y };
    const lengthSquared = edge.x * edge.x + edge.y * edge.y;
    const projected = lengthSquared > 0 ? (offset.x * edge.x + offset.y * edge.y) / lengthSquared : -1;
    const onEdge = projected >= -1e-6 && projected <= 1 + 1e-6
      && Math.abs(countertopCrossProduct(edge, offset)) <= 1e-5;
    if (onEdge) return false;
    const crosses = (current.y > point.y) !== (prior.y > point.y);
    if (crosses && point.x < (prior.x - current.x) * (point.y - current.y) / (prior.y - current.y) + current.x) inside = !inside;
  }
  return inside;
}

function countertopPointIsOnSegment(
  point: CountertopPlanPoint,
  start: CountertopPlanPoint,
  end: CountertopPlanPoint,
  tolerance = 1e-5,
): boolean {
  const edge = { x: end.x - start.x, y: end.y - start.y };
  const offset = { x: point.x - start.x, y: point.y - start.y };
  const lengthSquared = edge.x * edge.x + edge.y * edge.y;
  if (lengthSquared <= tolerance * tolerance) return sameCountertopPlanPoint(point, start, tolerance);
  const projected = (offset.x * edge.x + offset.y * edge.y) / lengthSquared;
  return projected >= -tolerance
    && projected <= 1 + tolerance
    && Math.abs(countertopCrossProduct(edge, offset)) <= tolerance;
}

function countertopPointIsOnPolygonBoundary(point: CountertopPlanPoint, polygon: CountertopPlanPoint[]): boolean {
  return polygon.some((start, index) => countertopPointIsOnSegment(
    point,
    start,
    polygon[(index + 1) % polygon.length]!,
  ));
}

/** True only when a countertop outline has crossing, non-adjacent physical edges. */
export function countertopPolygonSelfIntersects(points: CountertopPlanPoint[]): boolean {
  if (points.length < 4) return false;
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index]!;
    const end = points[(index + 1) % points.length]!;
    for (let otherIndex = index + 1; otherIndex < points.length; otherIndex += 1) {
      if (otherIndex === index || (otherIndex + 1) % points.length === index || (index + 1) % points.length === otherIndex) continue;
      const otherStart = points[otherIndex]!;
      const otherEnd = points[(otherIndex + 1) % points.length]!;
      const parameter = countertopSegmentParameterAtIntersection(start, end, otherStart, otherEnd);
      if (parameter == null || parameter <= 1e-6 || parameter >= 1 - 1e-6) continue;
      const reverseParameter = countertopSegmentParameterAtIntersection(otherStart, otherEnd, start, end);
      if (reverseParameter != null && reverseParameter > 1e-6 && reverseParameter < 1 - 1e-6) return true;
    }
  }
  return false;
}

/**
 * Computes the external boundary of two touching/overlapping mitered slabs.
 * A deep seating/bar projection on an inside 45° turn overlaps its adjoining
 * rectangle along a short edge, not just at the cabinet-front apex. Splitting
 * every edge at measured intersections and retaining only visible segments
 * avoids the crossed outline that otherwise becomes a 3D spike/hole.
 */
function unionCountertopSurfacesAtVisibleBoundary(
  left: CountertopSurface,
  right: CountertopSurface,
  rootRunId: string,
): CountertopSurface | null {
  const leftPolygon = countertopSurfacePlanPolygon(left);
  const rightPolygon = countertopSurfacePlanPolygon(right);
  if (leftPolygon.length < 3 || rightPolygon.length < 3) return null;
  type BoundarySegment = { start: CountertopPlanPoint; end: CountertopPlanPoint };
  const visibleSegments: BoundarySegment[] = [];
  const interiorSideOfCountertopSegment = (
    polygon: CountertopPlanPoint[],
    midpoint: CountertopPlanPoint,
    start: CountertopPlanPoint,
    end: CountertopPlanPoint,
  ): "left" | "right" | null => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length <= 1e-9) return null;
    // A hundredth of an inch is enough to get off the shared boundary without
    // skipping a narrow, source-measured countertop return.
    const probe = 0.01;
    const normal = { x: -dy / length, y: dx / length };
    const leftProbe = { x: midpoint.x + normal.x * probe, y: midpoint.y + normal.y * probe };
    const rightProbe = { x: midpoint.x - normal.x * probe, y: midpoint.y - normal.y * probe };
    if (countertopPointIsStrictlyInsidePolygon(leftProbe, polygon)) return "left";
    if (countertopPointIsStrictlyInsidePolygon(rightProbe, polygon)) return "right";
    return null;
  };
  const hasEquivalentVisibleSegment = (start: CountertopPlanPoint, end: CountertopPlanPoint) => (
    visibleSegments.some((segment) => (
      (sameCountertopPlanPoint(segment.start, start) && sameCountertopPlanPoint(segment.end, end))
      || (sameCountertopPlanPoint(segment.start, end) && sameCountertopPlanPoint(segment.end, start))
    ))
  );
  const appendVisibleSegments = (polygon: CountertopPlanPoint[], other: CountertopPlanPoint[]) => {
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index]!;
      const end = polygon[(index + 1) % polygon.length]!;
      const parameters = [0, 1];
      for (let otherIndex = 0; otherIndex < other.length; otherIndex += 1) {
        const otherStart = other[otherIndex]!;
        const otherEnd = other[(otherIndex + 1) % other.length]!;
        const parameter = countertopSegmentParameterAtIntersection(start, end, otherStart, otherEnd);
        if (parameter != null) parameters.push(parameter);
        // A corner-support leg can share part of its outer boundary with the
        // existing run slab. Ordinary segment intersection intentionally treats
        // collinear edges as parallel, so explicitly split at their endpoints.
        // The midpoint test below removes that now-internal shared section.
        for (const point of [otherStart, otherEnd]) {
          if (!countertopPointIsOnSegment(point, start, end)) continue;
          const direction = { x: end.x - start.x, y: end.y - start.y };
          const lengthSquared = direction.x * direction.x + direction.y * direction.y;
          if (lengthSquared > 1e-9) parameters.push(((point.x - start.x) * direction.x + (point.y - start.y) * direction.y) / lengthSquared);
        }
      }
      const ordered = Array.from(new Set(parameters.map((value) => Math.round(value * 1e8) / 1e8))).sort((a, b) => a - b);
      for (let parameterIndex = 0; parameterIndex < ordered.length - 1; parameterIndex += 1) {
        const from = ordered[parameterIndex]!;
        const to = ordered[parameterIndex + 1]!;
        if (to - from <= 1e-7) continue;
        const midpoint = { x: start.x + (end.x - start.x) * (from + to) / 2, y: start.y + (end.y - start.y) * (from + to) / 2 };
        if (countertopPointIsStrictlyInsidePolygon(midpoint, other)) continue;
        if (countertopPointIsOnPolygonBoundary(midpoint, other)) {
          // A shared edge is internal only when the two tops occupy opposite
          // sides of it. The outside leg of an L-corner can instead be
          // coincident with a peninsula slab's exterior edge; dropping that
          // edge creates a hole/second floating top in 3D.
          const ownInterior = interiorSideOfCountertopSegment(polygon, midpoint, start, end);
          const otherInterior = interiorSideOfCountertopSegment(other, midpoint, start, end);
          if (ownInterior != null && otherInterior != null && ownInterior !== otherInterior) continue;
        }
        const segmentStart = { x: start.x + (end.x - start.x) * from, y: start.y + (end.y - start.y) * from };
        const segmentEnd = { x: start.x + (end.x - start.x) * to, y: start.y + (end.y - start.y) * to };
        if (hasEquivalentVisibleSegment(segmentStart, segmentEnd)) continue;
        visibleSegments.push({
          start: segmentStart,
          end: segmentEnd,
        });
      }
    }
  };
  appendVisibleSegments(leftPolygon, rightPolygon);
  appendVisibleSegments(rightPolygon, leftPolygon);
  if (visibleSegments.length < 3) return null;

  const remaining = [...visibleSegments];
  const first = remaining.shift()!;
  const outline = [first.start, first.end];
  let current = first.end;
  while (!sameCountertopPlanPoint(current, outline[0]!) && remaining.length > 0) {
    let nextIndex = remaining.findIndex((segment) => sameCountertopPlanPoint(segment.start, current, 0.001));
    let reverseNext = false;
    if (nextIndex < 0) {
      nextIndex = remaining.findIndex((segment) => sameCountertopPlanPoint(segment.end, current, 0.001));
      reverseNext = nextIndex >= 0;
    }
    if (nextIndex < 0) return null;
    const [next] = remaining.splice(nextIndex, 1);
    if (!next) return null;
    current = reverseNext ? next.start : next.end;
    outline.push(current);
  }
  const resolvedOutline = removeConsecutiveCountertopPlanDuplicates(outline);
  if (remaining.length > 0 || resolvedOutline.length < 3 || countertopPolygonSelfIntersects(resolvedOutline) || countertopPolygonArea(resolvedOutline) <= COLLISION_EPSILON_IN) return null;
  const minX = Math.min(...resolvedOutline.map((point) => point.x));
  const maxX = Math.max(...resolvedOutline.map((point) => point.x));
  const minY = Math.min(...resolvedOutline.map((point) => point.y));
  const maxY = Math.max(...resolvedOutline.map((point) => point.y));
  const terminalRunIds = [left.peninsulaTerminalRunId, right.peninsulaTerminalRunId].filter((id): id is string => Boolean(id));
  const runIds = Array.from(new Set([
    ...(left.peninsulaRunIds ?? (left.peninsulaRunId ? [left.peninsulaRunId] : [])),
    ...(right.peninsulaRunIds ?? (right.peninsulaRunId ? [right.peninsulaRunId] : [])),
  ]));
  return {
    x: minX,
    y: minY,
    width: Math.max(0.1, maxX - minX),
    depth: Math.max(0.1, maxY - minY),
    kind: "base",
    rotation: 0,
    peninsulaRunId: rootRunId,
    peninsulaRunIds: runIds,
    ...(terminalRunIds.length === 1 ? { peninsulaTerminalRunId: terminalRunIds[0] } : {}),
    runStartIn: 0,
    polygon: resolvedOutline.map((point) => ({ x: point.x - minX, y: point.y - minY })),
    miteredStart: left.miteredStart || right.miteredStart,
    miteredEnd: left.miteredEnd || right.miteredEnd,
    linearInches: Math.max(0.1, maxX - minX),
    runLinearInches: (left.runLinearInches ?? left.linearInches ?? 0) + (right.runLinearInches ?? right.linearInches ?? 0),
    areaInches: countertopPolygonArea(resolvedOutline),
    ponyWallBarOverhangIn: Math.max(left.ponyWallBarOverhangIn ?? 0, right.ponyWallBarOverhangIn ?? 0) || undefined,
    ponyWallBackExtensionIn: Math.max(left.ponyWallBackExtensionIn ?? 0, right.ponyWallBackExtensionIn ?? 0) || undefined,
  };
}

/**
 * A three-leg 45° assembly can leave the final miter touching the prior merged
 * outline at exactly one point. Two areas that only touch at a vertex cannot be
 * represented as one simple polygon without the short physical bridge between
 * their adjacent outside edges. Select the smallest non-crossing bridge cycle;
 * this fills only the measured join rather than taking a convex hull that could
 * project past cabinet fronts.
 */
function unionCountertopSurfacesAtVertexBridge(
  left: CountertopSurface,
  right: CountertopSurface,
  rootRunId: string,
): CountertopSurface | null {
  const leftPolygon = countertopSurfacePlanPolygon(left);
  const rightPolygon = countertopSurfacePlanPolygon(right);
  if (leftPolygon.length < 3 || rightPolygon.length < 3) return null;
  const walkWithoutShared = (polygon: CountertopPlanPoint[], sharedIndex: number, step: 1 | -1) => {
    const path: CountertopPlanPoint[] = [];
    for (let index = (sharedIndex + step + polygon.length) % polygon.length, guard = 0; guard < polygon.length - 1; guard += 1) {
      path.push(polygon[index]!);
      index = (index + step + polygon.length) % polygon.length;
    }
    return path;
  };
  const expectedArea = countertopPolygonArea(leftPolygon) + countertopPolygonArea(rightPolygon);
  let best: CountertopPlanPoint[] | null = null;
  let bestDifference = Number.POSITIVE_INFINITY;
  for (let leftIndex = 0; leftIndex < leftPolygon.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < rightPolygon.length; rightIndex += 1) {
      if (!sameCountertopPlanPoint(leftPolygon[leftIndex]!, rightPolygon[rightIndex]!, 0.125)) continue;
      for (const leftStep of [1, -1] as const) {
        for (const rightStep of [1, -1] as const) {
          const outline = removeConsecutiveCountertopPlanDuplicates([
            ...walkWithoutShared(leftPolygon, leftIndex, leftStep),
            ...walkWithoutShared(rightPolygon, rightIndex, rightStep),
          ]);
          if (outline.length < 3 || countertopPolygonSelfIntersects(outline)) continue;
          const area = countertopPolygonArea(outline);
          if (area <= COLLISION_EPSILON_IN) continue;
          const difference = Math.abs(area - expectedArea);
          if (difference < bestDifference) {
            best = outline;
            bestDifference = difference;
          }
        }
      }
    }
  }
  if (!best) return null;
  const minX = Math.min(...best.map((point) => point.x));
  const maxX = Math.max(...best.map((point) => point.x));
  const minY = Math.min(...best.map((point) => point.y));
  const maxY = Math.max(...best.map((point) => point.y));
  const terminalRunIds = [left.peninsulaTerminalRunId, right.peninsulaTerminalRunId].filter((id): id is string => Boolean(id));
  const runIds = Array.from(new Set([
    ...(left.peninsulaRunIds ?? (left.peninsulaRunId ? [left.peninsulaRunId] : [])),
    ...(right.peninsulaRunIds ?? (right.peninsulaRunId ? [right.peninsulaRunId] : [])),
  ]));
  return {
    x: minX,
    y: minY,
    width: Math.max(0.1, maxX - minX),
    depth: Math.max(0.1, maxY - minY),
    kind: "base",
    rotation: 0,
    peninsulaRunId: rootRunId,
    peninsulaRunIds: runIds,
    ...(terminalRunIds.length === 1 ? { peninsulaTerminalRunId: terminalRunIds[0] } : {}),
    runStartIn: 0,
    polygon: best.map((point) => ({ x: point.x - minX, y: point.y - minY })),
    miteredStart: left.miteredStart || right.miteredStart,
    miteredEnd: left.miteredEnd || right.miteredEnd,
    linearInches: Math.max(0.1, maxX - minX),
    runLinearInches: (left.runLinearInches ?? left.linearInches ?? 0) + (right.runLinearInches ?? right.linearInches ?? 0),
    areaInches: countertopPolygonArea(best),
    ponyWallBarOverhangIn: Math.max(left.ponyWallBarOverhangIn ?? 0, right.ponyWallBarOverhangIn ?? 0) || undefined,
    ponyWallBackExtensionIn: Math.max(left.ponyWallBackExtensionIn ?? 0, right.ponyWallBackExtensionIn ?? 0) || undefined,
  };
}

/**
 * Produces the outside boundary of two same-sided slabs that share an entire
 * reversed edge. This is deliberately an exact shared-boundary union, not an
 * AABB merge: it keeps a 45° return's physical countertop path and never fills
 * a range opening or invents a surface across a non-touching gap.
 */
function unionCountertopSurfacesAtSharedBoundary(
  left: CountertopSurface,
  right: CountertopSurface,
  rootRunId: string,
): CountertopSurface | null {
  const leftPolygon = countertopSurfacePlanPolygon(left);
  const rightPolygon = countertopSurfacePlanPolygon(right);
  if (leftPolygon.length < 3 || rightPolygon.length < 3) return null;

  for (let leftIndex = 0; leftIndex < leftPolygon.length; leftIndex += 1) {
    const leftNext = (leftIndex + 1) % leftPolygon.length;
    for (let rightIndex = 0; rightIndex < rightPolygon.length; rightIndex += 1) {
      const rightNext = (rightIndex + 1) % rightPolygon.length;
      if (!sameCountertopPlanPoint(leftPolygon[leftIndex]!, rightPolygon[rightNext]!, 0.125)) continue;
      if (!sameCountertopPlanPoint(leftPolygon[leftNext]!, rightPolygon[rightIndex]!, 0.125)) continue;

      const outline = removeConsecutiveCountertopPlanDuplicates([
        ...countertopBoundaryPath(leftPolygon, leftNext, leftIndex),
        ...countertopBoundaryPath(rightPolygon, (rightIndex + 2) % rightPolygon.length, rightIndex),
      ]);
      if (outline.length < 3) return null;
      const minX = Math.min(...outline.map((point) => point.x));
      const maxX = Math.max(...outline.map((point) => point.x));
      const minY = Math.min(...outline.map((point) => point.y));
      const maxY = Math.max(...outline.map((point) => point.y));
      const terminalRunIds = [left.peninsulaTerminalRunId, right.peninsulaTerminalRunId]
        .filter((id): id is string => Boolean(id));
      const runIds = Array.from(new Set([
        ...(left.peninsulaRunIds ?? (left.peninsulaRunId ? [left.peninsulaRunId] : [])),
        ...(right.peninsulaRunIds ?? (right.peninsulaRunId ? [right.peninsulaRunId] : [])),
      ]));
      return {
        x: minX,
        y: minY,
        width: Math.max(0.1, maxX - minX),
        depth: Math.max(0.1, maxY - minY),
        kind: "base",
        rotation: 0,
        peninsulaRunId: rootRunId,
        peninsulaRunIds: runIds,
        ...(terminalRunIds.length === 1 ? { peninsulaTerminalRunId: terminalRunIds[0] } : {}),
        runStartIn: 0,
        polygon: outline.map((point) => ({ x: point.x - minX, y: point.y - minY })),
        miteredStart: left.miteredStart || right.miteredStart,
        miteredEnd: left.miteredEnd || right.miteredEnd,
        linearInches: Math.max(0.1, maxX - minX),
        runLinearInches: (left.runLinearInches ?? left.linearInches ?? 0) + (right.runLinearInches ?? right.linearInches ?? 0),
        areaInches: countertopPolygonArea(outline),
        ponyWallBarOverhangIn: Math.max(left.ponyWallBarOverhangIn ?? 0, right.ponyWallBarOverhangIn ?? 0) || undefined,
        ponyWallBackExtensionIn: Math.max(left.ponyWallBackExtensionIn ?? 0, right.ponyWallBackExtensionIn ?? 0) || undefined,
      };
    }
  }
  return null;
}

/**
 * A 45° miter uses one shared apex rather than a reversed full edge. The two
 * cut rectangles still form one fabricated continuous top: walking from each
 * apex to its next vertex yields the outside boundary of that single slab. Do
 * not use this for arbitrary touching rectangles; callers limit it to a root
 * that actually owns a 45° peninsula return.
 */
function unionCountertopSurfacesAtSharedMiterVertex(
  left: CountertopSurface,
  right: CountertopSurface,
  rootRunId: string,
  room: RoomData,
): CountertopSurface | null {
  const leftPolygon = countertopSurfacePlanPolygon(left);
  const rightPolygon = countertopSurfacePlanPolygon(right);
  if (leftPolygon.length < 3 || rightPolygon.length < 3) return null;

  const leftRunIds = left.peninsulaRunIds ?? (left.peninsulaRunId ? [left.peninsulaRunId] : []);
  const rightRunIds = right.peninsulaRunIds ?? (right.peninsulaRunId ? [right.peninsulaRunId] : []);
  type DirectMiterJoin = {
    surface: CountertopSurface;
    polygon: CountertopPlanPoint[];
    run: PeninsulaRun;
    other: CountertopSurface;
    otherPolygon: CountertopPlanPoint[];
    otherRun: PeninsulaRun;
    runIds: string[];
  };
  let directParent: DirectMiterJoin | null = null;
  for (const parentId of leftRunIds) {
    const parentRun = room.peninsulaRuns?.find((candidate) => candidate.id === parentId);
    const childRun = room.peninsulaRuns?.find((candidate) => rightRunIds.some((id) => id === candidate.id) && candidate.parentRunId === parentId);
    if (parentRun && childRun) {
      directParent = { surface: left, polygon: leftPolygon, run: parentRun, other: right, otherPolygon: rightPolygon, otherRun: childRun, runIds: Array.from(new Set([...leftRunIds, ...rightRunIds])) };
      break;
    }
  }
  if (!directParent) {
    for (const parentId of rightRunIds) {
      const parentRun = room.peninsulaRuns?.find((candidate) => candidate.id === parentId);
      const childRun = room.peninsulaRuns?.find((candidate) => leftRunIds.some((id) => id === candidate.id) && candidate.parentRunId === parentId);
      if (parentRun && childRun) {
        directParent = { surface: right, polygon: rightPolygon, run: parentRun, other: left, otherPolygon: leftPolygon, otherRun: childRun, runIds: Array.from(new Set([...rightRunIds, ...leftRunIds])) };
        break;
      }
    }
  }

  /**
   * Direct 45° runs meet at their cabinet-facing front miter, while their rear
   * edges bridge the deeper seating/bar area. Keep that shared front vertex in
   * the unified outline. Omitting it closes a diagonal from the rear of one run
   * to the front of the other, which visually projects the top past cabinet
   * doors whenever a pony-wall bar is selected.
   */
  if (directParent) {
    const parentGeometry = peninsulaRunEndpoints(directParent.run, room);
    const childGeometry = peninsulaRunEndpoints(directParent.otherRun, room);
    const parentNormal = countertopRunFaceNormal(parentGeometry.radians, directParent.run.cabinetSide ?? "left");
    const childNormal = countertopRunFaceNormal(childGeometry.radians, directParent.otherRun.cabinetSide ?? "left");
    const walkAwayFromShared = (polygon: CountertopPlanPoint[], startIndex: number, sharedIndex: number) => {
      const step = (startIndex + 1) % polygon.length === sharedIndex ? -1 : 1;
      const path: CountertopPlanPoint[] = [];
      for (let index = startIndex, guard = 0; guard < polygon.length; guard += 1) {
        path.push(polygon[index]!);
        index = (index + step + polygon.length) % polygon.length;
        if (index === sharedIndex) break;
      }
      return path;
    };
    const outward = (point: CountertopPlanPoint, start: CountertopPlanPoint, normal: CountertopPlanPoint) => (
      (point.x - start.x) * normal.x + (point.y - start.y) * normal.y
    );

    for (let parentSharedIndex = 0; parentSharedIndex < directParent.polygon.length; parentSharedIndex += 1) {
      for (let childSharedIndex = 0; childSharedIndex < directParent.otherPolygon.length; childSharedIndex += 1) {
        const shared = directParent.polygon[parentSharedIndex]!;
        if (!sameCountertopPlanPoint(shared, directParent.otherPolygon[childSharedIndex]!, 0.125)) continue;
        const parentPrevious = (parentSharedIndex - 1 + directParent.polygon.length) % directParent.polygon.length;
        const parentNext = (parentSharedIndex + 1) % directParent.polygon.length;
        const childPrevious = (childSharedIndex - 1 + directParent.otherPolygon.length) % directParent.otherPolygon.length;
        const childNext = (childSharedIndex + 1) % directParent.otherPolygon.length;
        const parentFront = outward(directParent.polygon[parentNext]!, parentGeometry.start, parentNormal) >= outward(directParent.polygon[parentPrevious]!, parentGeometry.start, parentNormal)
          ? parentNext
          : parentPrevious;
        const parentRear = parentFront === parentNext ? parentPrevious : parentNext;
        const childFront = outward(directParent.otherPolygon[childNext]!, childGeometry.start, childNormal) >= outward(directParent.otherPolygon[childPrevious]!, childGeometry.start, childNormal)
          ? childNext
          : childPrevious;
        const childRear = childFront === childNext ? childPrevious : childNext;
        const outline = removeConsecutiveCountertopPlanDuplicates([
          directParent.polygon[parentFront]!,
          shared,
          ...walkAwayFromShared(directParent.otherPolygon, childFront, childSharedIndex),
          ...walkAwayFromShared(directParent.polygon, parentRear, parentSharedIndex),
        ]);
        if (outline.length < 3 || countertopPolygonArea(outline) <= COLLISION_EPSILON_IN) continue;
        const minX = Math.min(...outline.map((point) => point.x));
        const maxX = Math.max(...outline.map((point) => point.x));
        const minY = Math.min(...outline.map((point) => point.y));
        const maxY = Math.max(...outline.map((point) => point.y));
        const runIds = directParent.runIds;
        return {
          x: minX,
          y: minY,
          width: Math.max(0.1, maxX - minX),
          depth: Math.max(0.1, maxY - minY),
          kind: "base",
          rotation: 0,
          peninsulaRunId: rootRunId,
          peninsulaRunIds: runIds,
          runStartIn: 0,
          polygon: outline.map((point) => ({ x: point.x - minX, y: point.y - minY })),
          miteredStart: directParent.surface.miteredStart || directParent.other.miteredStart,
          miteredEnd: directParent.surface.miteredEnd || directParent.other.miteredEnd,
          linearInches: Math.max(0.1, maxX - minX),
          runLinearInches: (directParent.surface.runLinearInches ?? directParent.surface.linearInches ?? 0) + (directParent.other.runLinearInches ?? directParent.other.linearInches ?? 0),
          areaInches: countertopPolygonArea(outline),
          ponyWallBarOverhangIn: Math.max(directParent.surface.ponyWallBarOverhangIn ?? 0, directParent.other.ponyWallBarOverhangIn ?? 0) || undefined,
          ponyWallBackExtensionIn: Math.max(directParent.surface.ponyWallBackExtensionIn ?? 0, directParent.other.ponyWallBackExtensionIn ?? 0) || undefined,
        };
      }
    }
  }

  for (let leftIndex = 0; leftIndex < leftPolygon.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < rightPolygon.length; rightIndex += 1) {
      if (!sameCountertopPlanPoint(leftPolygon[leftIndex]!, rightPolygon[rightIndex]!, 0.125)) continue;
      const outline = removeConsecutiveCountertopPlanDuplicates([
        ...countertopBoundaryPath(leftPolygon, (leftIndex + 1) % leftPolygon.length, leftIndex).slice(0, -1),
        ...countertopBoundaryPath(rightPolygon, (rightIndex + 1) % rightPolygon.length, rightIndex).slice(0, -1),
      ]);
      if (outline.length < 3 || countertopPolygonArea(outline) <= COLLISION_EPSILON_IN) continue;
      const minX = Math.min(...outline.map((point) => point.x));
      const maxX = Math.max(...outline.map((point) => point.x));
      const minY = Math.min(...outline.map((point) => point.y));
      const maxY = Math.max(...outline.map((point) => point.y));
      const terminalRunIds = [left.peninsulaTerminalRunId, right.peninsulaTerminalRunId]
        .filter((id): id is string => Boolean(id));
      const runIds = Array.from(new Set([
        ...(left.peninsulaRunIds ?? (left.peninsulaRunId ? [left.peninsulaRunId] : [])),
        ...(right.peninsulaRunIds ?? (right.peninsulaRunId ? [right.peninsulaRunId] : [])),
      ]));
      return {
        x: minX,
        y: minY,
        width: Math.max(0.1, maxX - minX),
        depth: Math.max(0.1, maxY - minY),
        kind: "base",
        rotation: 0,
        peninsulaRunId: rootRunId,
        peninsulaRunIds: runIds,
        ...(terminalRunIds.length === 1 ? { peninsulaTerminalRunId: terminalRunIds[0] } : {}),
        runStartIn: 0,
        polygon: outline.map((point) => ({ x: point.x - minX, y: point.y - minY })),
        miteredStart: left.miteredStart || right.miteredStart,
        miteredEnd: left.miteredEnd || right.miteredEnd,
        linearInches: Math.max(0.1, maxX - minX),
        runLinearInches: (left.runLinearInches ?? left.linearInches ?? 0) + (right.runLinearInches ?? right.linearInches ?? 0),
        areaInches: countertopPolygonArea(outline),
        ponyWallBarOverhangIn: Math.max(left.ponyWallBarOverhangIn ?? 0, right.ponyWallBarOverhangIn ?? 0) || undefined,
        ponyWallBackExtensionIn: Math.max(left.ponyWallBackExtensionIn ?? 0, right.ponyWallBackExtensionIn ?? 0) || undefined,
      };
    }
  }
  return null;
}

/**
 * A 45° peninsula return is one fabricated countertop path, not a second
 * floating countertop. Miter first, then fold every touching segment of each
 * connected return assembly into one cabinet-supported Plan polygon. This
 * applies to both 45° seams and ordinary 90° turns: a room run is not a new
 * countertop simply because it changes direction.
 */
export function unifiedFortyFivePeninsulaCountertopSurfaces(
  surfaces: CountertopSurface[],
  room: RoomData,
): CountertopSurface[] {
  const resolved: CountertopSurface[] = surfaces.map((surface) => ({
    ...surface,
    polygon: surface.polygon?.map((point) => ({ ...point })),
  }));
	  const rootsWithConnectedReturns = new Set<string>();
	  for (const run of room.peninsulaRuns ?? []) {
	    if (!run.parentRunId || (run.turn !== 45 && run.turn !== 90)) continue;
	    rootsWithConnectedReturns.add(peninsulaRootRunId(run, room));
	  }

	  for (const rootRunId of Array.from(rootsWithConnectedReturns)) {
    let merged = true;
    while (merged) {
      merged = false;
      for (let leftIndex = 0; leftIndex < resolved.length && !merged; leftIndex += 1) {
        const left = resolved[leftIndex]!;
        const leftRuns = left.peninsulaRunIds ?? (left.peninsulaRunId ? [left.peninsulaRunId] : []);
        if (!leftRuns.some((id) => {
          const run = room.peninsulaRuns?.find((candidate) => candidate.id === id);
          return run && peninsulaRootRunId(run, room) === rootRunId;
        })) continue;
        for (let rightIndex = leftIndex + 1; rightIndex < resolved.length; rightIndex += 1) {
          const right = resolved[rightIndex]!;
          const rightRuns = right.peninsulaRunIds ?? (right.peninsulaRunId ? [right.peninsulaRunId] : []);
          if (!rightRuns.some((id) => {
            const run = room.peninsulaRuns?.find((candidate) => candidate.id === id);
            return run && peninsulaRootRunId(run, room) === rootRunId;
          })) continue;
          const directUnion = unionCountertopSurfacesAtSharedBoundary(left, right, rootRunId)
            ?? unionCountertopSurfacesAtSharedMiterVertex(left, right, rootRunId, room);
          // Inside 45° returns with a deep seating/bar extension can overlap on
          // more than the front miter vertex. The historic apex walk crosses
          // those physical edges and Three.js then triangulates a pointed spike
          // or omits a countertop triangle. Prefer its concise outline when it
          // is sound, otherwise walk the measured visible boundary instead.
          const union = directUnion && !countertopPolygonSelfIntersects(countertopSurfacePlanPolygon(directUnion))
            ? directUnion
            : unionCountertopSurfacesAtVisibleBoundary(left, right, rootRunId)
              ?? unionCountertopSurfacesAtVertexBridge(left, right, rootRunId);
          if (!union) continue;
          resolved.splice(rightIndex, 1);
          resolved[leftIndex] = union;
          merged = true;
          break;
        }
      }
    }
  }
  return resolved.map((surface) => {
    const runIds = surface.peninsulaRunIds ?? (surface.peninsulaRunId ? [surface.peninsulaRunId] : []);
    if (runIds.length < 2) return surface;
    const firstRun = runIds
      .map((id) => room.peninsulaRuns?.find((candidate) => candidate.id === id))
      .find((run): run is PeninsulaRun => Boolean(run));
    const rootRunId = firstRun ? peninsulaRootRunId(firstRun, room) : undefined;
	    if (!rootRunId || !rootsWithConnectedReturns.has(rootRunId)) return surface;
    const terminal = (room.peninsulaRuns ?? []).find((run) => (
      peninsulaRootRunId(run, room) === rootRunId
      && !(room.peninsulaRuns ?? []).some((candidate) => candidate.parentRunId === run.id)
    ));
    return terminal ? { ...surface, peninsulaTerminalRunId: terminal.id } : surface;
  });
}

/**
 * Compute the visible countertop surfaces for a layout. Every base cabinet gets
 * a slab the width of the cabinet and the standard countertop depth, pinned to
 * the wall the cabinet sits on (so the overhang projects into the room). The
 * island (if any) gets a slab matching its footprint.
 *
 * Pure + deterministic so it can be unit-tested independently of rendering.
 */
// True when a placed item is a real, countertop-BEARING base cabinet: it must
// sit in the base zone AND be a solid box that a slab can rest on. This covers
// standard bases, drawer bases, sink bases (incl. vanity-sink / ADA-sink), and
// blind/corner bases. It deliberately EXCLUDES anything in the base zone that
// does NOT carry a counter:
//   - decorative end panels / refrigerator + dishwasher panels / skins
//     (isPanelItem — 3/4" flat stock, not a box)
//   - loose/manual filler or scribe strips (FILL-* — a sliver, not a cabinet)
// Small-gap fillers installed as part of a confirmed base run are the exception:
// their saved group metadata means the adjacent countertop must continue over
// the installed width even though the filler itself is not a cabinet box.
// Tall cabinets and appliances are already excluded by the placement check.
export function bearsCountertop(p: {
	  placement: Placement;
	  category?: string | null;
	  masterCode?: string | null;
	  description?: string | null;
	  subCategory?: string | null;
	  height?: number | string | null;
	  mountBottom?: number | string | null;
	  applianceRole?: "base-height" | "countertop-opening" | "freestanding" | null;
	  fillerPieceGroupId?: string | null;
	  fillerTotalWidth?: number | null;
	  fillerPlacementMode?: "left" | "right" | "split" | null;
	  fillerTransitionKind?: "angled-wedge" | "corner-provisional" | "front-miter-pair" | null;
}): boolean {
	  if (p.placement !== "base" && !isBaseHeightAppliance(p)) return false;
  // Some legacy plans stored a freestanding stove in the base layer. A stove
  // remains an appliance opening regardless of that stale layer value, so it
	  // must never receive a countertop slab.
	  if (isRangeOrOven(p.masterCode, p.description)) return false;
	  // A 45-degree front-miter pair is finish material between two independently
	  // supported cabinets. It closes the visible face only; it is never allowed
	  // to create or enlarge a countertop support footprint over the rear pocket.
	  if (p.fillerTransitionKind === "front-miter-pair") return false;
	  const installedFillerWidth = Number(p.fillerTotalWidth);
  const isInstalledBaseFiller = Boolean(
    p.fillerPieceGroupId &&
    p.fillerPlacementMode &&
    Number.isFinite(installedFillerWidth) &&
    installedFillerWidth > 0,
  );
  if (isInstalledBaseFiller) return true;
  // Sink bases ARE counter-bearing even though their tops are cut for the sink.
  if (isSinkBaseCabinet(p) || isBaseHeightAppliance(p)) return true;
  // Flat panels / skins carry no counter.
  if (isPanelItem(p)) return false;
  // Filler / scribe strips (FILL-* or a "Filler" sub-category) are non-bearing.
  const code = (p.masterCode ?? "").toUpperCase();
  if (/^FILL[-_ ]?\d/.test(code)) return false;
  const hay = `${p.subCategory ?? ""} ${p.description ?? ""}`.toLowerCase();
  if (/\bfiller\b|\bscribe\b/.test(hay)) return false;
  // Decorative legs such as FLDL / CLDL / SCDL / SQDL are ornamental vertical parts, not
  // cabinet boxes. A legacy base-layer import cannot make them countertop
  // supports or turn the countertop on when they are placed.
  if (/^(?:FLDL|CLDL|SCDL|SQDL)$/.test(code.replace(/[^A-Z0-9]/g, "")) || /\bdecorative\s+leg\b/.test(hay)) return false;
  return true;
}

/**
 * A real base corner cabinet can be centered at a peninsula's 90°/45° bend
 * while retaining ownership of the adjoining run. Its footprint still supports
 * the connected slab at either run endpoint, so do not leave the corner
 * uncovered merely because `wallId` names the other leg.
 */
export function peninsulaCornerCabinetSupportsCountertop(
  cabinet: PlacedCabinet,
  run: PeninsulaRun,
  room: RoomData,
): boolean {
  const isBendSupport = isCornerCabinet(cabinet.masterCode, cabinet.description)
    || isBaseEndCornerCabinet(cabinet)
    || /(?:angle|angled)\s+drawer base/i.test(cabinet.description ?? "");
  if (!bearsCountertop(cabinet) || !isBendSupport) return false;
  const footprint = placedFootprint(cabinet);
  const geometry = peninsulaRunEndpoints(run, room);
  const tolerance = COLLISION_EPSILON_IN + 0.25;
  return [geometry.start, geometry.end].some((point) => (
    point.x >= cabinet.x - tolerance
    && point.x <= cabinet.x + footprint.w + tolerance
    && point.y >= cabinet.y - tolerance
    && point.y <= cabinet.y + footprint.d + tolerance
  ));
}

/**
 * A peninsula slab is one continuous, cabinet-supported run. It deliberately
 * spans released cabinet voids on that run, but an entirely empty peninsula
 * receives no invented countertop. Its standard cabinet-front edge is always
 * 1½ inches and no seating or pony-wall preference can expand that footprint.
 */
export function peninsulaCountertopSurface(
  run: PeninsulaRun,
  room: RoomData,
  requestedStartIn = 0,
  requestedLengthIn = run.length,
): CountertopSurface {
  // A saved design can carry former 12/15-inch seating or pony-wall choices,
  // but countertop geometry now follows only the actual base-cabinet support.
  const ponyWallBarOverhang = 0;
  const ponyWallBackExtension = 0;
  // `wallPlacementAt` anchors the entire depth at the peninsula's cabinet-side
  // face. The standard 25½-inch depth owns the cabinet-facing 1½-inch edge;
  // seating and a pony-wall bar must instead grow away from that face.
  const oppositeSideExtension = peninsulaLowerWorktopOppositeSideExtensionIn(run, room);
  const slabDepth = COUNTERTOP_DEPTH_IN + oppositeSideExtension;
  const runLength = Math.max(0, Number(run.length) || 0);
  const startIn = Math.max(0, Math.min(runLength, Number(requestedStartIn) || 0));
  const lengthIn = Math.max(0, Math.min(runLength - startIn, Number(requestedLengthIn) || 0));
  const spot = wallPlacementAt(startIn, lengthIn, slabDepth, run.id as WallSide, room, run.cabinetSide ?? "left");
  const footprint = placedFootprint({
    uid: `peninsula-countertop-${run.id}-${startIn}`,
    cabinetId: 0,
    masterCode: "PENINSULA-COUNTERTOP",
    description: "Peninsula countertop",
    placement: "base",
    x: spot.x,
    y: spot.y,
    width: lengthIn,
    depth: slabDepth,
    height: STD.COUNTERTOP_THICKNESS,
    rotation: spot.rotation,
  });
  // `wallPlacementAt` correctly returns the screen-space AABB of a rotated
  // object. Surface consumers rotate their own local rectangle, however, so
  // returning that AABB as width/depth makes a 45° slab inflate and rotate a
  // second time. Keep its true local dimensions and preserve the identical
  // world center used by cabinet placement and the 3D slab mesh.
  const faceNormal = countertopRunFaceNormal(
    peninsulaRunEndpoints(run, room).radians,
    run.cabinetSide ?? "left",
  );
  const centerX = spot.x + footprint.w / 2 - faceNormal.x * oppositeSideExtension;
  const centerY = spot.y + footprint.d / 2 - faceNormal.y * oppositeSideExtension;
  return {
    x: centerX - lengthIn / 2,
    y: centerY - slabDepth / 2,
    width: lengthIn,
    depth: slabDepth,
    kind: "base",
    rotation: spot.rotation,
    peninsulaRunId: run.id,
    runStartIn: startIn,
    linearInches: lengthIn,
    runLinearInches: lengthIn,
    areaInches: lengthIn * slabDepth,
    ponyWallBarOverhangIn: ponyWallBarOverhang,
    ponyWallBackExtensionIn: ponyWallBackExtension,
  };
}

/**
 * Separate upper 42-inch bar using the same cabinet-supported countertop
 * footprint as the lower worktop: cabinet depth plus the normal 1½-inch front
 * overhang, with the same 45° miter. It differs only in elevation, never in
 * plan projection, so it cannot float past the cabinet structure.
 */
/**
 * A raised bar built on a straight leg and its 45° return leaves a notch at the
 * outer (back) corner where the two back strips stop short of each other. Fill
 * it with the mitered wedge where the two outer edges meet. Only the back strips
 * are touched; the lower countertop and the Wall Builder are unaffected.
 */
function raisedBarOuterMiterWedges(
  surfaces: CountertopSurface[],
  room: Pick<RoomData, "peninsulaRuns">,
): CountertopSurface[] {
  const raised = surfaces.filter((surface) => surface.raisedBar && surface.peninsulaRunId);
  const wedges: CountertopSurface[] = [];
  for (const child of room.peninsulaRuns ?? []) {
    if (!child.parentRunId) continue;
    const a = raised.find((surface) => surface.peninsulaRunId === child.parentRunId);
    const b = raised.find((surface) => surface.peninsulaRunId === child.id);
    if (!a || !b) continue;
    const pa = countertopSurfacePlanPolygon(a);
    const pb = countertopSurfacePlanPolygon(b);
    if (pa.length < 3 || pb.length < 3) continue;
    const dist = (u: CountertopPlanPoint, v: CountertopPlanPoint) => Math.hypot(u.x - v.x, u.y - v.y);
    // The joining edge is the closest pair of points between the two strips
    // that are not already shared; pick the closest pair that is also outermost.
    const hull = countertopConvexHull([...pa, ...pb]);
    const inA = (pt: CountertopPlanPoint) => pa.some((q) => dist(q, pt) < 1e-6);
    const inB = (pt: CountertopPlanPoint) => pb.some((q) => dist(q, pt) < 1e-6);
    let wedge: CountertopPlanPoint[] | null = null;
    for (let i = 0; i < hull.length && !wedge; i += 1) {
      const h0 = hull[i]!;
      const h1 = hull[(i + 1) % hull.length]!;
      if (!(inA(h0) && !inB(h0) && inB(h1) && !inA(h1))) continue;
      const prev = hull[(i - 1 + hull.length) % hull.length]!;
      const next = hull[(i + 2) % hull.length]!;
      const d1 = { x: h0.x - prev.x, y: h0.y - prev.y };
      const d2 = { x: next.x - h1.x, y: next.y - h1.y };
      const cross = d1.x * d2.y - d1.y * d2.x;
      if (Math.abs(cross) < 1e-6) continue;
      const t = ((h1.x - h0.x) * d2.y - (h1.y - h0.y) * d2.x) / cross;
      const apex = { x: h0.x + d1.x * t, y: h0.y + d1.y * t };
      if (t < -1e-6 || dist(apex, h0) > 40) continue;
      // Inner joint points: the other neighbour of each hull point in its strip.
      const neighbour = (poly: CountertopPlanPoint[], pt: CountertopPlanPoint, avoid: CountertopPlanPoint) => {
        const idx = poly.findIndex((q) => dist(q, pt) < 1e-6);
        const cand = [poly[(idx + 1) % poly.length]!, poly[(idx - 1 + poly.length) % poly.length]!];
        return cand.find((q) => dist(q, avoid) > 1e-6) ?? cand[0]!;
      };
      const innerA = neighbour(pa, h0, prev);
      const innerB = neighbour(pb, h1, next);
      wedge = [innerA, h0, apex, h1, innerB];
    }
    if (!wedge) continue;
    const surface = countertopSurfaceFromWorldPolygon(wedge, child.id);
    if (!surface) continue;
    wedges.push({
      ...surface,
      raisedBar: true,
      raisedBarUsesSharedCountertopOutline: true,
      // Corner filler only: the straight and return strips already carry the corbels.
      raisedBarOverhangIn: 0,
      countertopHeightIn: RAISED_BAR_HEIGHT_IN,
    });
  }
  return wedges;
}
/**
 * Raised-bar strips on a straight leg and its 45-degree return stop short of each other at the
 * outer corner, leaving a notch. Extend BOTH strips along their own outer and cabinet-side edges
 * until those edges meet, so the two strips share one clean mitre line. No extra piece is added.
 */
/**
 * Where a raised bar turns 45 degrees, the lower worktop's outer edge and the raised
 * strips' inner edges leave a small triangle of uncovered lower top (a visible void
 * beside the riser). Fill exactly that triangle at the lower level; nothing else moves.
 */
function raisedBarMiterGapFills(surfaces: readonly CountertopSurface[]): CountertopSurface[] {
  type Pt = CountertopPlanPoint;
  const raised = surfaces.filter((s) => s.raisedBar);
  const lower = surfaces.filter((s) => !s.raisedBar && !s.raisedBar);
  if (raised.length < 2 || lower.length === 0) return [];
  const polys = raised.map((s) => countertopSurfacePlanPolygon(s));
  const lowerPolys = lower.map((s) => countertopSurfacePlanPolygon(s));
  const near = (a: Pt, b: Pt, t = 0.3) => Math.hypot(a.x - b.x, a.y - b.y) < t;
  const onEdges = (pt: Pt, poly: readonly Pt[]) => poly.some((a, i) => {
    const b = poly[(i + 1) % poly.length]!;
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / l2));
    return Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy)) < 0.3;
  });
  const inside = (pt: Pt, poly: readonly Pt[]) => {
    let hit = false;
    for (let k = 0, m = poly.length - 1; k < poly.length; m = k++) {
      const a = poly[k]!, b = poly[m]!;
      if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
    }
    return hit;
  };
  const lowerVerts = lowerPolys.flat();
  const out: CountertopSurface[] = [];
  for (let i = 0; i < polys.length; i += 1) {
    for (let j = i + 1; j < polys.length; j += 1) {
      const A = polys[i]!, B = polys[j]!;
      const shared = A.filter((p1) => B.some((p2) => near(p1, p2)));
      // Only the INNER mitre point (nearest the lower worktop) borders this void; the outer
      // point is the raised bar's own corner and must never get a lower-level fill.
      const nearestLower = (pt: Pt) => Math.min(...lowerVerts.map((v) => Math.hypot(v.x - pt.x, v.y - pt.y)));
      const inner = shared.slice().sort((a, b) => nearestLower(a) - nearestLower(b)).slice(0, 1);
      for (const P of inner) {
        const q1 = lowerVerts.find((v) => !near(v, P) && Math.hypot(v.x - P.x, v.y - P.y) < 30 && onEdges(v, A) && !onEdges(v, B));
        const q2 = lowerVerts.find((v) => !near(v, P) && Math.hypot(v.x - P.x, v.y - P.y) < 30 && onEdges(v, B) && !onEdges(v, A));
        if (!q1 || !q2) continue;
        const tri: Pt[] = [P, q1, q2];
        if (countertopPolygonArea(tri) < 2) continue;
        const c = { x: (P.x + q1.x + q2.x) / 3, y: (P.y + q1.y + q2.y) / 3 };
        if (lowerPolys.some((lp) => inside(c, lp))) continue;
        const signed = tri.reduce((sum, pt, k) => { const n = tri[(k + 1) % 3]!; return sum + pt.x * n.y - n.x * pt.y; }, 0);
        if (signed < 0) tri.reverse();
        const base = surfaces.find((sf) => sf.raisedBar);
        const surface = countertopSurfaceFromWorldPolygon(tri, base?.peninsulaRunId ?? "");
        if (surface) out.push({ ...surface, linearInches: surface.width, peninsulaRunIds: base?.peninsulaRunIds });
      }
    }
  }
  return out;
}

function joinRaisedBarStripsAtMiter(
  surfaces: CountertopSurface[],
  room: Pick<RoomData, "peninsulaRuns">,
): CountertopSurface[] {
  const result = [...surfaces];
  // A run's raised bar can be several separate strips (the straight leg is split by a gap
  // or an appliance opening). Collect every candidate so the join can pick the strip that
  // actually sits at the turn instead of always taking the first one in the list.
  const raisedIndexes = (runId: string) => result.flatMap((surface, index) => (
    surface.raisedBar && surface.peninsulaRunId === runId && countertopSurfacePlanPolygon(surface).length === 4
      ? [index]
      : []
  ));
  const hit = (a: CountertopPlanPoint, b: CountertopPlanPoint, c: CountertopPlanPoint, d: CountertopPlanPoint) => {
    const r = { x: b.x - a.x, y: b.y - a.y };
    const q = { x: d.x - c.x, y: d.y - c.y };
    const det = r.x * q.y - r.y * q.x;
    if (Math.abs(det) < 1e-6) return null;
    const t = ((c.x - a.x) * q.y - (c.y - a.y) * q.x) / det;
    return { x: a.x + r.x * t, y: a.y + r.y * t };
  };
  const mid = (u: CountertopPlanPoint, v: CountertopPlanPoint) => ({ x: (u.x + v.x) / 2, y: (u.y + v.y) / 2 });
  for (const child of room.peninsulaRuns ?? []) {
    if (!child.parentRunId) continue;
    const parentCandidates = raisedIndexes(child.parentRunId);
    const childCandidates = raisedIndexes(child.id);
    if (parentCandidates.length === 0 || childCandidates.length === 0) continue;
    // Strip outline: [outer0, outer1, inner1, inner0]. End edges are (1,2) and (3,0).
    const ends = [
      { outer: 1, inner: 2 },
      { outer: 0, inner: 3 },
    ];
    // Pick the parent strip and child strip whose end edges are closest to each other: those
    // are the two pieces that meet at the 45-degree turn.
    let best: { ia: number; ib: number; ea: number; eb: number; d: number } | null = null;
    for (const candidateA of parentCandidates) {
      const candidatePolyA = countertopSurfacePlanPolygon(result[candidateA]!);
      for (const candidateB of childCandidates) {
        const candidatePolyB = countertopSurfacePlanPolygon(result[candidateB]!);
        for (let ea = 0; ea < 2; ea += 1) {
          for (let eb = 0; eb < 2; eb += 1) {
            const ma = mid(candidatePolyA[ends[ea]!.outer]!, candidatePolyA[ends[ea]!.inner]!);
            const mb = mid(candidatePolyB[ends[eb]!.outer]!, candidatePolyB[ends[eb]!.inner]!);
            const d = Math.hypot(ma.x - mb.x, ma.y - mb.y);
            if (!best || d < best.d) best = { ia: candidateA, ib: candidateB, ea, eb, d };
          }
        }
      }
    }
    if (!best || best.d < 1e-3 || best.d > 60) continue;
    const { ia, ib } = best;
    const pa = countertopSurfacePlanPolygon(result[ia]!);
    const pb = countertopSurfacePlanPolygon(result[ib]!);
    const outerApex = hit(pa[0]!, pa[1]!, pb[0]!, pb[1]!);
    const innerApex = hit(pa[3]!, pa[2]!, pb[3]!, pb[2]!);
    if (!outerApex || !innerApex) continue;
    const reach = (poly: CountertopPlanPoint[], end: { outer: number; inner: number }) => ({
      outer: Math.hypot(outerApex.x - poly[end.outer]!.x, outerApex.y - poly[end.outer]!.y),
      inner: Math.hypot(innerApex.x - poly[end.inner]!.x, innerApex.y - poly[end.inner]!.y),
    });
    const ra = reach(pa, ends[best.ea]!);
    const rb = reach(pb, ends[best.eb]!);
    if (Math.max(ra.outer, ra.inner, rb.outer, rb.inner) > 40) continue;
    const rebuild = (index: number, poly: CountertopPlanPoint[], end: { outer: number; inner: number }) => {
      const next = poly.map((point) => ({ ...point }));
      next[end.outer] = { ...outerApex };
      next[end.inner] = { ...innerApex };
      const rebuilt = countertopSurfaceFromWorldPolygon(next, result[index]!.peninsulaRunId);
      if (!rebuilt) return;
      result[index] = { ...result[index]!, ...rebuilt, rotation: 0, peninsulaRunIds: result[index]!.peninsulaRunIds };
    };
    rebuild(ia, pa, ends[best.ea]!);
    rebuild(ib, pb, ends[best.eb]!);
  }
  return result;
}
export function peninsulaRaisedBarSurface(
  run: PeninsulaRun,
  room: RoomData,
  requestedStartIn = 0,
  requestedLengthIn = run.length,
): CountertopSurface | null {
  if (!peninsulaCountertopRaisedBarEnabled(run, room)) return null;
  const runLength = Math.max(0, Number(run.length) || 0);
  const startIn = Math.max(0, Math.min(runLength, Number(requestedStartIn) || 0));
  const lengthIn = Math.max(0, Math.min(runLength - startIn, Number(requestedLengthIn) || 0));
  if (lengthIn <= COLLISION_EPSILON_IN) return null;
  const worktop = peninsulaCountertopSurface(run, room, startIn, lengthIn);
  const overhang = peninsulaCountertopRaisedBarOverhang(run, room);
  const projected = extendPeninsulaRaisedBarSurface(
    worktop,
    room,
    // Raised bar strip: 12-15in out from the back of the cabinets (never over the lower worktop).
    Math.min(15, Math.max(12, overhang)),
  );
  return {
    ...projected,
    raisedBar: true,
    raisedBarOverhangIn: overhang,
    countertopHeightIn: RAISED_BAR_HEIGHT_IN,
  };
}

/** A monotone-chain hull preserves the one-sided finished overhang on one cabinet leg. */
function countertopConvexHull(points: CountertopPlanPoint[]): CountertopPlanPoint[] {
  const unique = Array.from(new Map(
    points.map((point) => [`${Math.round(point.x * 1e8)},${Math.round(point.y * 1e8)}`, point]),
  ).values()).sort((left, right) => left.x - right.x || left.y - right.y);
  if (unique.length <= 2) return unique;
  const cross = (origin: CountertopPlanPoint, first: CountertopPlanPoint, second: CountertopPlanPoint) => (
    (first.x - origin.x) * (second.y - origin.y) - (first.y - origin.y) * (second.x - origin.x)
  );
  const lower: CountertopPlanPoint[] = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 1e-8) lower.pop();
    lower.push(point);
  }
  const upper: CountertopPlanPoint[] = [];
  for (const point of [...unique].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 1e-8) upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function countertopSurfaceFromWorldPolygon(
  world: CountertopPlanPoint[],
  runId?: string,
): CountertopSurface | null {
  if (world.length < 3) return null;
  const minX = Math.min(...world.map((point) => point.x));
  const maxX = Math.max(...world.map((point) => point.x));
  const minY = Math.min(...world.map((point) => point.y));
  const maxY = Math.max(...world.map((point) => point.y));
  const area = countertopPolygonArea(world);
  if (maxX - minX <= COLLISION_EPSILON_IN || maxY - minY <= COLLISION_EPSILON_IN || area <= COLLISION_EPSILON_IN) return null;
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    depth: maxY - minY,
    kind: "base",
    polygon: world.map((point) => ({ x: point.x - minX, y: point.y - minY })),
    ...(runId ? {
      peninsulaRunId: runId,
      peninsulaCornerSupportExtension: true,
    } : {}),
    areaInches: area,
  };
}

/** Extend only the exposed edge of a resolved peninsula surface. */
function extendPeninsulaRaisedBarSurface(
  surface: CountertopSurface,
  room: RoomData,
  extensionIn: number,
): CountertopSurface {
  if (extensionIn <= COLLISION_EPSILON_IN) return surface;
  const ownerIds = surface.peninsulaRunIds ?? (surface.peninsulaRunId ? [surface.peninsulaRunId] : []);
  const owners = ownerIds
    .map((id) => peninsulaRunById(room, id))
    .filter((run): run is PeninsulaRun => Boolean(run));
  if (owners.length === 0) return surface;

  let points = countertopSurfacePlanPolygon(surface);
  // Offset only each run's own exposed front EDGE (mitered with its neighbours). A convex hull
  // would balloon past the run ends and fill the 45-degree notch.
  const n = points.length;
  const edgeOffset: Array<{ x: number; y: number } | null> = Array.from({ length: n }, () => null);
  for (const run of owners) {
    const frame = peninsulaRunEndpoints(run, room);
    // The bar projects out the BACK of the peninsula (away from the cabinet faces); the cabinet-facing
    // edge never moves past its 1.5in finished edge.
    const faceNormal = countertopRunFaceNormal(frame.radians, run.cabinetSide ?? "left");
    const normal = { x: -faceNormal.x, y: -faceNormal.y };
    const proj = points.map((point) => point.x * normal.x + point.y * normal.y);
    const candidates: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = points[i]!;
      const b = points[(i + 1) % n]!;
      const ex = b.x - a.x, ey = b.y - a.y;
      const len = Math.hypot(ex, ey);
      if (len < 1e-6) continue;
      // Edge must run along this run (perpendicular to its outward normal).
      if (Math.abs(ex * normal.x + ey * normal.y) / len < 0.02) candidates.push(i);
    }
    if (candidates.length === 0) continue;
    const front = Math.max(...candidates.map((i) => proj[i]!));
    for (const i of candidates) {
      if (edgeOffset[i]) continue;
      if (front - proj[i]! <= 1 / 16 && front - proj[(i + 1) % n]! <= 1 / 16) {
        edgeOffset[i] = { x: normal.x * extensionIn, y: normal.y * extensionIn };
      }
    }
  }
  if (edgeOffset.some(Boolean)) {
    const line = (i: number) => {
      const a = points[i]!;
      const b = points[(i + 1) % n]!;
      const o = edgeOffset[i] ?? { x: 0, y: 0 };
      return { x: a.x + o.x, y: a.y + o.y, dx: b.x - a.x, dy: b.y - a.y };
    };
    points = points.map((point, i) => {
      const prev = line((i - 1 + n) % n);
      const next = line(i);
      if (!edgeOffset[(i - 1 + n) % n] && !edgeOffset[i]) return point;
      const det = prev.dx * next.dy - prev.dy * next.dx;
      if (Math.abs(det) < 1e-9) {
        const o = edgeOffset[i] ?? edgeOffset[(i - 1 + n) % n]!;
        return { x: point.x + o.x, y: point.y + o.y };
      }
      const t = ((next.x - prev.x) * next.dy - (next.y - prev.y) * next.dx) / det;
      return { x: prev.x + prev.dx * t, y: prev.y + prev.dy * t };
    });
  }
  // Keep ONLY the new strip behind the cabinets: the raised bar must never lie over the lower worktop.
  const origPoints = countertopSurfacePlanPolygon(surface);
  const moved = edgeOffset.map(Boolean);
  if (moved.some(Boolean) && !moved.every(Boolean)) {
    // Longest cyclic chain of consecutive offset edges.
    let bestStart = -1, bestLen = 0;
    for (let st = 0; st < n; st++) {
      if (!moved[st] || moved[(st - 1 + n) % n]) continue;
      let len = 0;
      while (len < n && moved[(st + len) % n]) len++;
      if (len > bestLen) { bestLen = len; bestStart = st; }
    }
    if (bestStart >= 0) {
      const outer: CountertopPlanPoint[] = [];
      const inner: CountertopPlanPoint[] = [];
      for (let k = 0; k <= bestLen; k++) {
        const idx = (bestStart + k) % n;
        outer.push(points[idx]!);
        inner.push(origPoints[idx]!);
      }
      points = [...outer, ...inner.reverse()];
    }
  }
  const expanded = countertopSurfaceFromWorldPolygon(points, surface.peninsulaRunId);
  // The rebuilt outline is already in world coordinates; keep rotation 0 so Plan/3D do not rotate it twice.
  return expanded ? { ...surface, ...expanded, rotation: 0, peninsulaRunIds: surface.peninsulaRunIds } : surface;
}

function peninsulaRootHasFortyFiveReturn(run: PeninsulaRun, room: RoomData): boolean {
  const rootId = peninsulaRootRunId(run, room);
  return Boolean((room.peninsulaRuns ?? []).some((candidate) => (
    candidate.turn === 45 && peninsulaRootRunId(candidate, room) === rootId
  )));
}

/**
 * A 36-inch ERB/LS/CDB keeps real 24-inch-deep L-shaped cabinet legs. At a
 * 45-degree peninsula return, the continuous run is only 25½ inches deep, so
 * the exterior leg can project beyond it. Preserve precisely that existing
 * cabinet support plus its 1½-inch front overhang, then let the existing
 * miter/union logic incorporate it into the one connected countertop surface.
 * No filler, open gap, diagonal approximation, or extra 90-degree slab is
 * created by this path.
 */
function peninsulaLCornerSupportSurfaces(
  placed: readonly PlacedCabinet[],
  room: RoomData,
): CountertopSurface[] {
  const result: CountertopSurface[] = [];
  for (const cabinet of placed) {
    if (!bearsCountertop(cabinet)) continue;
    const cornerKind = placedCornerGeometryKind(cabinet);
    if (cornerKind !== "l-shape" && cornerKind !== "corner-drawer") continue;
    const run = peninsulaRunById(room, cabinetWall(cabinet, room));
    if (!run || !peninsulaRootHasFortyFiveReturn(run, room)) continue;
    const geometry = peninsulaRunEndpoints(run, room);
    const normal = countertopRunFaceNormal(
      geometry.radians,
      run.cabinetSide ?? "left",
    );
    const finishedFrontOverhang = Math.max(0, COUNTERTOP_DEPTH_IN - STD.BASE_DEPTH);
    for (const body of lCornerBodyPolygons(cabinet)) {
      const extended = countertopConvexHull([
        ...body,
        ...body.map((point) => ({
          x: point.x + normal.x * finishedFrontOverhang,
          y: point.y + normal.y * finishedFrontOverhang,
        })),
      ]);
      // One L leg normally sits entirely inside the ordinary run top. Rendering
      // it again would z-fight the shared slab; retain only the exterior leg
      // that genuinely reaches past the 24" box + 1½" finished front edge.
      const projectsBeyondNormalRunDepth = extended.some((point) => (
        (point.x - geometry.start.x) * normal.x + (point.y - geometry.start.y) * normal.y
      ) > COUNTERTOP_DEPTH_IN + COLLISION_EPSILON_IN);
      if (!projectsBeyondNormalRunDepth) continue;
      const surface = countertopSurfaceFromWorldPolygon(extended, run.id);
      if (surface) result.push(surface);
    }
  }
  return result;
}

/**
 * Island-only exception for a shallow wall cabinet such as W-24-30. The marker
 * is set exclusively by Island-mode placement, leaving ordinary wall cabinets
 * and Wall mode countertop behavior unchanged.
 */
export function isCounterHeightIslandWallCabinet(p: {
  placement?: Placement | null;
  islandFace?: IslandFace | null;
  islandCounterHeightWallCabinet?: boolean | null;
}): boolean {
  return p.placement === "wall" && Boolean(p.islandFace) && p.islandCounterHeightWallCabinet === true;
}

/** Older island plans did not store a treatment; retain the familiar recessed
 * toe kick as their backwards-compatible default. */
export function islandWallCabinetBaseTreatment(p: {
  islandWallCabinetBaseTreatment?: IslandWallCabinetBaseTreatment | null;
}): IslandWallCabinetBaseTreatment {
  return p.islandWallCabinetBaseTreatment === "base-molding" ? "base-molding" : "toe-kick";
}

/** Counter-bearing island members include genuine bases and marked shallow opposing wall faces. */
export function bearsIslandCountertop(p: {
  placement: Placement;
  category?: string | null;
  masterCode?: string | null;
  description?: string | null;
  subCategory?: string | null;
  height?: number | string | null;
  mountBottom?: number | string | null;
  applianceRole?: "base-height" | "countertop-opening" | "freestanding" | null;
  fillerPieceGroupId?: string | null;
  fillerTotalWidth?: number | null;
  fillerPlacementMode?: "left" | "right" | "split" | null;
  islandFace?: IslandFace | null;
  islandCounterHeightWallCabinet?: boolean | null;
}): boolean {
  return bearsCountertop(p) || isCounterHeightIslandWallCabinet(p);
}

/**
 * A BBC may be deliberately moved perpendicular to its owning wall by the
 * Cabinet Attributes depth control. The cabinet body remains pulled forward,
 * but the countertop must bridge the exact rear void back to the wall.
 */
export function blindCornerRearCountertopExtensionIn(
  p: PlacedCabinet,
  room: RoomData,
): number {
  if (!isBlindCorner(p.masterCode, p.description) || p.placement !== "base") return 0;
  const side = cabinetWall(p, room);
  const footprint = placedFootprint(p);
  const rawGap = side === "top"
    ? p.y
    : side === "bottom"
      ? room.depth - (p.y + footprint.d)
      : side === "left"
        ? p.x
        : room.width - (p.x + footprint.w);
  if (!Number.isFinite(rawGap) || rawGap <= COLLISION_EPSILON_IN) return 0;
  const pullMax = blindPullRange(p)?.max ?? BLIND_CORNER_FILLER_WIDTH_IN * 2;
  return Math.round(Math.min(Math.max(0, rawGap), pullMax) * 8) / 8;
}

type SharedCustomWallVertex = {
  vertexId: string;
  firstAt: "start" | "end";
  secondAt: "start" | "end";
};

function sharedCustomWallVertex(
  first: NonNullable<RoomData["customWalls"]>[number],
  second: NonNullable<RoomData["customWalls"]>[number],
): SharedCustomWallVertex | null {
  if (first.startVertexId === second.startVertexId) return { vertexId: first.startVertexId, firstAt: "start", secondAt: "start" };
  if (first.startVertexId === second.endVertexId) return { vertexId: first.startVertexId, firstAt: "start", secondAt: "end" };
  if (first.endVertexId === second.startVertexId) return { vertexId: first.endVertexId, firstAt: "end", secondAt: "start" };
  if (first.endVertexId === second.endVertexId) return { vertexId: first.endVertexId, firstAt: "end", secondAt: "end" };
  return null;
}

/**
 * A diagonal segment is not itself a 45-degree corner. The installation hold
 * belongs only to the *turn* between two measured walls: 45 degrees between
 * their physical tangents. This intentionally uses the measured wall geometry
 * rather than the optional `lockedAngle` authoring hint: a customer-drawn
 * physical 45° turn needs the same two real filler boards and continuous top
 * whether it originated in the Wall Builder or a restored/freehand room.
 * Two diagonal walls meeting at 90 degrees remain a normal flush corner with
 * no 11-inch reservation.
 */
export function customWallJoinTurnsFortyFive(
  first: NonNullable<RoomData["customWalls"]>[number],
  second: NonNullable<RoomData["customWalls"]>[number],
  room: Pick<RoomData, "vertices">,
): boolean {
  if (!room.vertices?.length) return false;
  const firstAngle = polygonWallAngle(first, room.vertices);
  const secondAngle = polygonWallAngle(second, room.vertices);
  const raw = Math.abs(((firstAngle - secondAngle + Math.PI) % (Math.PI * 2)) - Math.PI);
  const interiorTurn = Math.min(raw, Math.abs(Math.PI - raw));
  return Math.abs(interiorTurn - Math.PI / 4) <= 1e-6;
}

/**
 * A 90-degree measured-wall turn is a flush cabinet and countertop corner.
 * Unlike a true 45-degree return it has no 11-inch hold and its two slab edges
 * meet at a square shared seam. This applies equally to two diagonal walls or
 * to one diagonal and one cardinal measured wall.
 */
function customWallJoinTurnsNinety(
  first: NonNullable<RoomData["customWalls"]>[number],
  second: NonNullable<RoomData["customWalls"]>[number],
  room: Pick<RoomData, "vertices">,
): boolean {
  if (!room.vertices?.length) return false;
  const firstAngle = polygonWallAngle(first, room.vertices);
  const secondAngle = polygonWallAngle(second, room.vertices);
  const raw = Math.abs(((firstAngle - secondAngle + Math.PI) % (Math.PI * 2)) - Math.PI);
  const interiorTurn = Math.min(raw, Math.abs(Math.PI - raw));
  return Math.abs(interiorTurn - Math.PI / 2) <= 1e-6;
}

// A fitted 45°-corner filler is source stock cut to at most the 3-inch face
// width. It moves the cabinet body's endpoint slightly beyond the mandatory
// 11-inch hold, but it must not re-open the finished countertop pocket.
const FITTED_FORTY_FIVE_CORNER_FILLER_MAX_IN = 3;

function measuredWallCountertopEndpointCabinet(
  wallId: string,
  at: "start" | "end",
  room: RoomData,
  placed: readonly PlacedCabinet[],
  allowRequiredFortyFiveHold = false,
): PlacedCabinet | null {
  const length = wallLength(wallId as WallSide, room);
  return placed
    .filter((cabinet) => cabinet.placement === "base" && cabinet.wallId === wallId && bearsCountertop(cabinet))
    .map((cabinet) => {
      const start = wallRunOffset(cabinet, wallId, room);
      const end = start + wallRunSpan(cabinet, wallId, room);
      const distance = at === "start" ? Math.abs(start) : Math.abs(length - end);
      return { cabinet, distance };
    })
    .filter(({ distance }) => (
      distance <= COLLISION_EPSILON_IN
      // A true 45° join keeps cabinet faces at the 11-inch hold. A confirmed
      // fitted filler can move the body endpoint up to its source 3-inch face
      // width beyond that datum; its countertop must still close continuously
      // from the mitered cabinet fronts back to the wall. This remains tightly
      // bounded and never applies to a normal 90° corner or a free large gap.
      || (allowRequiredFortyFiveHold
        && distance >= PENINSULA_INSIDE_CORNER_CLEARANCE_IN - COLLISION_EPSILON_IN
        && distance <= PENINSULA_INSIDE_CORNER_CLEARANCE_IN + FITTED_FORTY_FIVE_CORNER_FILLER_MAX_IN + COLLISION_EPSILON_IN)
    ))
    .sort((left, right) => left.distance - right.distance)[0]?.cabinet ?? null;
}

/**
 * Returns the verified true-45 join envelope used as the evidence gate before
 * cutting and filling a measured-wall countertop turn. The final surface pass
 * uses that evidence to add the wall-side corner fill only where two equal
 * elevation base runs have the required 11-inch holds; it never creates stone
 * across a normal 90-degree join or a free gap.
 */
export function measuredWallCountertopMiterSurfaces(
  placed: readonly PlacedCabinet[],
  room: RoomData,
): CountertopSurface[] {
  if (!room.vertices?.length || !room.customWalls?.length) return [];
  const result: CountertopSurface[] = [];
  for (let firstIndex = 0; firstIndex < room.customWalls.length; firstIndex += 1) {
    const first = room.customWalls[firstIndex]!;
    for (let secondIndex = firstIndex + 1; secondIndex < room.customWalls.length; secondIndex += 1) {
      const second = room.customWalls[secondIndex]!;
      if (!customWallJoinTurnsFortyFive(first, second, room)) continue;
      const shared = sharedCustomWallVertex(first, second);
      if (!shared) continue;
      const vertex = room.vertices.find((candidate) => candidate.id === shared.vertexId);
      if (!vertex) continue;
      const firstCabinet = measuredWallCountertopEndpointCabinet(first.id, shared.firstAt, room, placed, true);
      const secondCabinet = measuredWallCountertopEndpointCabinet(second.id, shared.secondAt, room, placed, true);
      if (!firstCabinet || !secondCabinet) continue;
      const firstBox = elevationBox(firstCabinet, room);
      const secondBox = elevationBox(secondCabinet, room);
      if (Math.abs(firstBox.bottom - secondBox.bottom) > COLLISION_EPSILON_IN || Math.abs(firstBox.height - secondBox.height) > COLLISION_EPSILON_IN) continue;

      const firstRadians = polygonWallAngle(first, room.vertices);
      const secondRadians = polygonWallAngle(second, room.vertices);
      const firstDepth = COUNTERTOP_DEPTH_IN + blindCornerRearCountertopExtensionIn(firstCabinet, room);
      const secondDepth = COUNTERTOP_DEPTH_IN + blindCornerRearCountertopExtensionIn(secondCabinet, room);
      const firstOuter = { x: vertex.x - Math.sin(firstRadians) * firstDepth, y: vertex.y + Math.cos(firstRadians) * firstDepth };
      const secondOuter = { x: vertex.x - Math.sin(secondRadians) * secondDepth, y: vertex.y + Math.cos(secondRadians) * secondDepth };
      const worldPolygon = [{ x: vertex.x, y: vertex.y }, firstOuter, secondOuter];
      const area = countertopPolygonArea(worldPolygon);
      if (area <= COLLISION_EPSILON_IN) continue;
      const minX = Math.min(...worldPolygon.map((point) => point.x));
      const maxX = Math.max(...worldPolygon.map((point) => point.x));
      const minY = Math.min(...worldPolygon.map((point) => point.y));
      const maxY = Math.max(...worldPolygon.map((point) => point.y));
      result.push({
        x: minX,
        y: minY,
        width: Math.max(0.1, maxX - minX),
        depth: Math.max(0.1, maxY - minY),
        kind: "base",
        polygon: worldPolygon.map((point) => ({ x: point.x - minX, y: point.y - minY })),
        miteredStart: true,
        miteredEnd: true,
        linearInches: Math.hypot(firstOuter.x - secondOuter.x, firstOuter.y - secondOuter.y),
        areaInches: area,
        customWallMiterWallIds: [first.id, second.id],
        customWallMiterVertexId: shared.vertexId,
      });
    }
  }
  return result;
}

/**
 * Replaces the rectangular outer corner of one measured-wall slab with the
 * shared fabricated 45-degree miter point. This is deliberately the continuous
 * wall equivalent of `countertopSurfaceWithMiterPoint`: both return slabs keep
 * their cabinet-supported areas, meet at one real seam, and never need an
 * overlapping decorative bridge triangle.
 */
function measuredWallSurfaceWithMiterPoint(
  surface: CountertopSurface,
  wall: NonNullable<RoomData["customWalls"]>[number],
  room: RoomData,
  atStart: boolean,
  miterPoint: CountertopPlanPoint,
  miterWallIds: [string, string],
  miterVertexId: string,
): CountertopSurface {
  if (!room.vertices?.length) return surface;
  const start = room.vertices.find((vertex) => vertex.id === wall.startVertexId);
  if (!start) return surface;
  const local = countertopSurfaceLocalPolygon(surface);
  const world = countertopSurfacePlanPolygon(surface);
  const radians = polygonWallAngle(wall, room.vertices);
  const tangent = { x: Math.cos(radians), y: Math.sin(radians) };
  const inward = countertopRunFaceNormal(radians, customWallCabinetSide(room, wall.id));
  const runStart = surface.customWallRunStartIn ?? 0;
  const targetAlong = atStart
    ? runStart
    : runStart + (surface.linearInches ?? surface.width);
  let outerIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  world.forEach((point, index) => {
    const along = (point.x - start.x) * tangent.x + (point.y - start.y) * tangent.y;
    const inwardDistance = (point.x - start.x) * inward.x + (point.y - start.y) * inward.y;
    const score = Math.abs(along - targetAlong) + Math.abs(inwardDistance - surface.depth);
    if (score < bestScore) {
      bestScore = score;
      outerIndex = index;
    }
  });
  local[outerIndex] = countertopSurfaceLocalPointFromWorld(surface, miterPoint);
  return {
    ...surface,
    polygon: local,
    miteredStart: atStart || surface.miteredStart,
    miteredEnd: !atStart || surface.miteredEnd,
    areaInches: countertopPolygonArea(local),
    customWallMiterWallIds: miterWallIds,
    customWallMiterVertexId: miterVertexId,
  };
}

/** Finds the cabinet-side and room-side slab vertices at a measured wall endpoint. */
function measuredWallCountertopSurfaceEndEdge(
  surface: CountertopSurface,
  wall: NonNullable<RoomData["customWalls"]>[number],
  room: RoomData,
  atStart: boolean,
): CountertopRunEndEdge | null {
  if (!room.vertices?.length) return null;
  const wallStart = room.vertices.find((vertex) => vertex.id === wall.startVertexId);
  if (!wallStart) return null;
  const world = countertopSurfacePlanPolygon(surface);
  if (world.length < 3) return null;
  const radians = polygonWallAngle(wall, room.vertices);
  const tangent = { x: Math.cos(radians), y: Math.sin(radians) };
  const inward = countertopRunFaceNormal(radians, customWallCabinetSide(room, wall.id));
  const runStart = surface.customWallRunStartIn ?? 0;
  const targetAlong = atStart ? runStart : runStart + (surface.linearInches ?? surface.width);
  const endpoints = world
    .map((point, index) => ({
      index,
      point,
      along: (point.x - wallStart.x) * tangent.x + (point.y - wallStart.y) * tangent.y,
      inwardDistance: (point.x - wallStart.x) * inward.x + (point.y - wallStart.y) * inward.y,
    }))
    .sort((left, right) => Math.abs(left.along - targetAlong) - Math.abs(right.along - targetAlong))
    .slice(0, 2)
    .sort((left, right) => left.inwardDistance - right.inwardDistance);
  if (endpoints.length !== 2) return null;
  return {
    innerIndex: endpoints[0]!.index,
    outerIndex: endpoints[1]!.index,
    innerPoint: endpoints[0]!.point,
    outerPoint: endpoints[1]!.point,
  };
}

/**
 * Builds the single, cabinet-supported polygon that closes the wall-side void
 * created by the required 11-inch holds at a true 45-degree inside turn. Its
 * two cabinet-facing edges share the two miter-cut slab edges exactly, while
 * its rear corner reaches the actual wall vertex. This is physical countertop
 * support, not a decorative overlap or a countertop bridge over a free gap.
 */
function measuredWallCornerInfillSurface(
  vertex: CountertopPlanPoint,
  firstInner: CountertopPlanPoint,
  miterPoint: CountertopPlanPoint,
  secondInner: CountertopPlanPoint,
  wallIds: [string, string],
  vertexId: string,
): CountertopSurface | null {
  const worldPolygon = [vertex, firstInner, miterPoint, secondInner];
  // Three.js extrudes the authored polygon's back face upward after the plan →
  // 3D rotation. Keep this fill counter-clockwise like every cabinet slab so
  // its finished top—not its underside—is visible from the room. A clockwise
  // infill was mathematically present but could be culled/appear transparent
  // from the camera, leaving the exact triangular visual void in the report.
  const signedArea = worldPolygon.reduce((sum, point, index) => {
    const next = worldPolygon[(index + 1) % worldPolygon.length]!;
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  if (signedArea < 0) worldPolygon.reverse();
  const area = countertopPolygonArea(worldPolygon);
  if (area <= COLLISION_EPSILON_IN) return null;
  const minX = Math.min(...worldPolygon.map((point) => point.x));
  const maxX = Math.max(...worldPolygon.map((point) => point.x));
  const minY = Math.min(...worldPolygon.map((point) => point.y));
  const maxY = Math.max(...worldPolygon.map((point) => point.y));
  return {
    x: minX,
    y: minY,
    width: Math.max(0.1, maxX - minX),
    depth: Math.max(0.1, maxY - minY),
    kind: "base",
    polygon: worldPolygon.map((point) => ({ x: point.x - minX, y: point.y - minY })),
    areaInches: area,
    miteredStart: true,
    miteredEnd: true,
    // The renderer uses this to include the polygon in the same measured-wall
    // countertop pass. It deliberately has no run span: its area is part of
    // the physical corner closure, not a third cabinet run.
    customWallId: wallIds[0],
    customWallMiterWallIds: wallIds,
    customWallMiterVertexId: vertexId,
    customWallCornerInfill: true,
  };
}

/**
 * Turns the two cabinet-supported slabs at a true continuous-wall 45-degree
 * join into the same single-fabrication geometry used by a peninsula: one
 * precise diagonal seam, no rectangular overlap, and an exact wall-side fill
 * where the mandatory 11-inch holds would otherwise leave an exposed void.
 * `measuredWallCountertopMiterSurfaces` remains the evidence gate—it verifies
 * both endpoint bases, their shared elevation, and the explicit 45-degree wall
 * before any slab is cut or corner fill is added.
 */
export function miteredMeasuredWallCountertopSurfaces(
  surfaces: CountertopSurface[],
  placed: readonly PlacedCabinet[],
  room: RoomData,
): CountertopSurface[] {
  const resolved: CountertopSurface[] = surfaces.map((surface) => ({
    ...surface,
    polygon: surface.polygon?.map((point) => ({ ...point })),
  }));
  if (!room.vertices?.length || !room.customWalls?.length) return resolved;
  const verifiedMiters = measuredWallCountertopMiterSurfaces(placed, room);
  for (const miter of verifiedMiters) {
    const wallIds = miter.customWallMiterWallIds;
    const vertexId = miter.customWallMiterVertexId;
    if (!wallIds || !vertexId) continue;
    const [firstId, secondId] = wallIds;
    const firstWall = room.customWalls.find((wall) => wall.id === firstId);
    const secondWall = room.customWalls.find((wall) => wall.id === secondId);
    const vertex = room.vertices.find((candidate) => candidate.id === vertexId);
    if (!firstWall || !secondWall || !vertex) continue;
    const shared = sharedCustomWallVertex(firstWall, secondWall);
    if (!shared) continue;
    const firstLength = polygonWallSegmentLength(firstWall, room.vertices);
    const secondLength = polygonWallSegmentLength(secondWall, room.vertices);
      const endpointSurfaceIndex = (wallId: string, at: "start" | "end", length: number) => resolved.findIndex((surface) => {
        if (surface.customWallId !== wallId) return false;
        const start = surface.customWallRunStartIn ?? 0;
        const end = start + (surface.linearInches ?? surface.width);
        const distance = at === "start" ? Math.abs(start) : Math.abs(length - end);
        return distance <= COLLISION_EPSILON_IN
          || (distance >= PENINSULA_INSIDE_CORNER_CLEARANCE_IN - COLLISION_EPSILON_IN
            && distance <= PENINSULA_INSIDE_CORNER_CLEARANCE_IN + FITTED_FORTY_FIVE_CORNER_FILLER_MAX_IN + COLLISION_EPSILON_IN);
      });
    const firstIndex = endpointSurfaceIndex(firstId, shared.firstAt, firstLength);
    const secondIndex = endpointSurfaceIndex(secondId, shared.secondAt, secondLength);
    if (firstIndex < 0 || secondIndex < 0) continue;
    const firstSurface = resolved[firstIndex]!;
    const secondSurface = resolved[secondIndex]!;
    const firstEndEdge = measuredWallCountertopSurfaceEndEdge(
      firstSurface,
      firstWall,
      room,
      shared.firstAt === "start",
    );
    const secondEndEdge = measuredWallCountertopSurfaceEndEdge(
      secondSurface,
      secondWall,
      room,
      shared.secondAt === "start",
    );
    if (!firstEndEdge || !secondEndEdge) continue;
    const firstRadians = polygonWallAngle(firstWall, room.vertices);
    const secondRadians = polygonWallAngle(secondWall, room.vertices);
    const miterPoint = countertopOffsetEdgeMiterPoint(
      { x: vertex.x, y: vertex.y },
      firstRadians,
      countertopRunFaceNormal(firstRadians, customWallCabinetSide(room, firstWall.id)),
      firstSurface.depth,
      secondRadians,
      countertopRunFaceNormal(secondRadians, customWallCabinetSide(room, secondWall.id)),
      secondSurface.depth,
    );
    resolved[firstIndex] = measuredWallSurfaceWithMiterPoint(
      firstSurface,
      firstWall,
      room,
      shared.firstAt === "start",
      miterPoint,
      wallIds,
      vertexId,
    );
    resolved[secondIndex] = measuredWallSurfaceWithMiterPoint(
      secondSurface,
      secondWall,
      room,
      shared.secondAt === "start",
      miterPoint,
      wallIds,
      vertexId,
    );
    const cornerInfill = measuredWallCornerInfillSurface(
      vertex,
      firstEndEdge.innerPoint,
      miterPoint,
      secondEndEdge.innerPoint,
      wallIds,
      vertexId,
    );
    if (cornerInfill) resolved.push(cornerInfill);
  }

  // The Wall Builder may have two 45-degree wall segments that turn 90 degrees
  // at their shared vertex. That is still a normal flush corner: bases sit to
  // the vertex and the finished tops meet along a square seam. Leaving the two
  // rotated rectangles untrimmed creates the visible spike/overlap from the
  // reported plan. Use the same cabinet-supported square-corner treatment as
  // the standard-room and peninsula paths—never an invented bridge slab.
  for (let firstWallIndex = 0; firstWallIndex < room.customWalls.length; firstWallIndex += 1) {
    const firstWall = room.customWalls[firstWallIndex]!;
    for (let secondWallIndex = firstWallIndex + 1; secondWallIndex < room.customWalls.length; secondWallIndex += 1) {
      const secondWall = room.customWalls[secondWallIndex]!;
      if (!customWallJoinTurnsNinety(firstWall, secondWall, room)) continue;
      const shared = sharedCustomWallVertex(firstWall, secondWall);
      if (!shared) continue;
      const firstCabinet = measuredWallCountertopEndpointCabinet(firstWall.id, shared.firstAt, room, placed);
      const secondCabinet = measuredWallCountertopEndpointCabinet(secondWall.id, shared.secondAt, room, placed);
      if (!firstCabinet || !secondCabinet) continue;
      const firstBox = elevationBox(firstCabinet, room);
      const secondBox = elevationBox(secondCabinet, room);
      if (Math.abs(firstBox.bottom - secondBox.bottom) > COLLISION_EPSILON_IN || Math.abs(firstBox.height - secondBox.height) > COLLISION_EPSILON_IN) continue;

      const endpointSurfaceIndex = (wallId: string, at: "start" | "end") => resolved.findIndex((surface) => {
        if (surface.customWallId !== wallId) return false;
        const start = surface.customWallRunStartIn ?? 0;
        const end = start + (surface.linearInches ?? surface.width);
        const length = wallLength(wallId as WallSide, room);
        return at === "start"
          ? Math.abs(start) <= COLLISION_EPSILON_IN
          : Math.abs(length - end) <= COLLISION_EPSILON_IN;
      });
      const firstIndex = endpointSurfaceIndex(firstWall.id, shared.firstAt);
      const secondIndex = endpointSurfaceIndex(secondWall.id, shared.secondAt);
      if (firstIndex < 0 || secondIndex < 0) continue;
      const firstSurface = resolved[firstIndex]!;
      const secondSurface = resolved[secondIndex]!;
      const firstEdge = measuredWallCountertopSurfaceEndEdge(firstSurface, firstWall, room, shared.firstAt === "start");
      const secondEdge = measuredWallCountertopSurfaceEndEdge(secondSurface, secondWall, room, shared.secondAt === "start");
      if (!firstEdge || !secondEdge) continue;
      const firstRadians = polygonWallAngle(firstWall, room.vertices);
      const secondRadians = polygonWallAngle(secondWall, room.vertices);
      const squareCorner = countertopLineIntersection(
        firstEdge.outerPoint,
        { x: Math.cos(firstRadians), y: Math.sin(firstRadians) },
        secondEdge.outerPoint,
        { x: Math.cos(secondRadians), y: Math.sin(secondRadians) },
      );
      if (!squareCorner) continue;
      const wallIds: [string, string] = [firstWall.id, secondWall.id];
      const trimFirst = countertopSurfaceWithSquareCornerMiter(
        firstSurface,
        firstEdge,
        squareCorner,
        shared.firstAt === "start",
      );
      const trimSecond = countertopSurfaceWithSquareCornerMiter(
        secondSurface,
        secondEdge,
        squareCorner,
        shared.secondAt === "start",
        firstEdge.innerPoint,
      );
      resolved[firstIndex] = {
        ...trimFirst,
        // A square seam is not a fabricated 45-degree miter. Preserve any
        // prior true-miter state without making the 90-degree join a new one.
        miteredStart: firstSurface.miteredStart,
        miteredEnd: firstSurface.miteredEnd,
        customWallSquareCornerWallIds: wallIds,
        customWallSquareCornerVertexId: shared.vertexId,
      };
      resolved[secondIndex] = {
        ...trimSecond,
        miteredStart: secondSurface.miteredStart,
        miteredEnd: secondSurface.miteredEnd,
        customWallSquareCornerWallIds: wallIds,
        customWallSquareCornerVertexId: shared.vertexId,
      };
    }
  }
  return resolved;
}

/**
 * Base countertops are built from physical cabinet runs—not one rectangle per
 * cabinet. Contiguous support on a wall becomes one surface before the 45° miter
 * stage, so Plan, 3D and takeoff share the exact same slab count and footprint.
 * A tall unit, refrigerator bay, appliance break, or real gap has no supporting
 * surface and therefore ends the run without special-case position patches.
 */
function mergeContiguousBaseCountertopRuns(
  surfaces: CountertopSurface[],
  room: RoomData,
  placed: readonly PlacedCabinet[] = [],
): CountertopSurface[] {
  const tolerance = 1 / 16;
  // Void filling: a gap between two counter-bearing pieces on the same wall
  // closes automatically unless a physical non-counter unit (range, fridge,
  // tall pantry, end panel) actually stands in it. Previously ANY gap wider
  // than 1/16" ended the run, so a 1/8" seam, a filler-sized hole or a small
  // depth mismatch left the top starting but never finishing.
  const wallBlockers = (wallKey: string): Array<{ start: number; end: number }> => {
    const id = wallKey.startsWith("custom:") ? wallKey.slice("custom:".length) : wallKey.slice("wall:".length);
    return placed.flatMap((cabinet) => {
      if (cabinet.placement === "wall") return [];
      if (cabinet.placement === "base" && bearsCountertop(cabinet)) return [];
      let wall: string | null = null;
      try { wall = cabinetWall(cabinet, room) as string | null; } catch { wall = null; }
      if (wall !== id) return [];
      const start = wallRunOffset(cabinet, id, room);
      const span = wallRunSpan(cabinet, id, room);
      return Number.isFinite(start) && Number.isFinite(span) && span > 0 ? [{ start, end: start + span }] : [];
    });
  };
  const DEPTH_FILL_TOLERANCE_IN = 2;
  const merged: CountertopSurface[] = [];
  const consumed = new Set<number>();
  const groups = new Map<string, Array<{ index: number; surface: CountertopSurface; start: number; span: number; thickness: number }>>();
  const cardinalSideFor = (surface: CountertopSurface): WallSide | null => {
    if (surface.customWallId || surface.rotation) return null;
    if (Math.abs(surface.y) <= tolerance) return "top";
    if (Math.abs(surface.y + surface.depth - room.depth) <= tolerance) return "bottom";
    if (Math.abs(surface.x) <= tolerance) return "left";
    if (Math.abs(surface.x + surface.width - room.width) <= tolerance) return "right";
    return null;
  };
  surfaces.forEach((surface, index) => {
    if (surface.kind !== "base" || surface.polygon?.length || surface.peninsulaRunId) return;
    const customWall = surface.customWallId;
    // A base at a room corner touches two cardinal boundaries.  Its visual AABB
    // alone cannot decide which wall its 90°-rotated cabinet actually faces.
    // Prefer the original cabinet wall recorded at surface construction so a
    // left-wall run that ends at the bottom corner keeps one continuous top.
    const side = customWall ? null : surface.supportWallId ?? cardinalSideFor(surface);
    if (!customWall && !side) return;
    const key = customWall ? `custom:${customWall}` : `wall:${side}`;
    const start = customWall
      ? Number(surface.customWallRunStartIn ?? Number.NaN)
      : side === "top" || side === "bottom" ? surface.x : surface.y;
    const span = customWall
      ? Number(surface.linearInches ?? surface.width)
      : side === "top" || side === "bottom" ? surface.width : surface.depth;
    // Slab thickness (into the room). A left/right standard wall stores its
    // along-wall span in `depth` and its thickness in `width`, so read the
    // thickness by side rather than assuming `depth` everywhere.
    const thickness = customWall || side === "top" || side === "bottom" ? surface.depth : surface.width;
    if (!Number.isFinite(start) || !Number.isFinite(span) || span <= 0 || !Number.isFinite(thickness) || thickness <= 0) return;
    const entries = groups.get(key) ?? [];
    entries.push({ index, surface, start, span, thickness });
    groups.set(key, entries);
  });
  groups.forEach((entries, key) => {
    entries.sort((left, right) => left.start - right.start || left.index - right.index);
    const blockers = wallBlockers(key);
    let cursor = 0;
    while (cursor < entries.length) {
      const first = entries[cursor]!;
      const start = first.start;
      let end = first.start + first.span;
      let depth = first.thickness;
      const members = [first];
      cursor += 1;
      while (cursor < entries.length) {
        const next = entries[cursor]!;
        const gapStart = end;
        const gapEnd = next.start;
        const gapBlocked = gapEnd > gapStart + tolerance
          && blockers.some((b) => b.start < gapEnd - tolerance && b.end > gapStart + tolerance);
        if ((next.start > end + tolerance && gapBlocked) || Math.abs(next.thickness - depth) > DEPTH_FILL_TOLERANCE_IN) break;
        depth = Math.max(depth, next.thickness);
        end = Math.max(end, next.start + next.span);
        members.push(next);
        cursor += 1;
      }
      members.forEach(({ index }) => consumed.add(index));
      const span = end - start;
      const runId = `${key}:${Math.round(start * 16) / 16}-${Math.round(end * 16) / 16}`;
      const customWallId = first.surface.customWallId;
      if (customWallId) {
        const spot = wallPlacementAt(start, span, depth, customWallId as WallSide, room);
        const radians = spot.rotation * Math.PI / 180;
        const aabbWidth = Math.abs(span * Math.cos(radians)) + Math.abs(depth * Math.sin(radians));
        const aabbDepth = Math.abs(span * Math.sin(radians)) + Math.abs(depth * Math.cos(radians));
        const centerX = spot.x + aabbWidth / 2;
        const centerY = spot.y + aabbDepth / 2;
        merged.push({
          ...first.surface,
          x: centerX - span / 2,
          y: centerY - depth / 2,
          width: span,
          depth,
          rotation: spot.rotation,
          customWallRunStartIn: start,
          linearInches: span,
          areaInches: span * depth,
          cabinetRunId: runId,
        });
        continue;
      }
      const side = key.slice("wall:".length) as WallSide;
      if (side === "top") merged.push({ ...first.surface, x: start, y: 0, width: span, depth, linearInches: span, areaInches: span * depth, cabinetRunId: runId });
      else if (side === "bottom") merged.push({ ...first.surface, x: start, y: room.depth - depth, width: span, depth, linearInches: span, areaInches: span * depth, cabinetRunId: runId });
      else if (side === "left") merged.push({ ...first.surface, x: 0, y: start, width: depth, depth: span, linearInches: span, areaInches: span * depth, cabinetRunId: runId });
      else merged.push({ ...first.surface, x: room.width - depth, y: start, width: depth, depth: span, linearInches: span, areaInches: span * depth, cabinetRunId: runId });
    }
  });
  return [...surfaces.filter((_, index) => !consumed.has(index)), ...merged];
}

/**
 * A peninsula countertop follows actual, touching cabinet support—not an
 * arbitrary configured wall length.  This keeps an incomplete or sparse run
 * from creating a detached slab across the room while retaining one continuous
 * piece wherever base cabinets (including confirmed filler support) meet.
 */
function peninsulaCountertopSupportSegments(
  run: PeninsulaRun,
  placed: readonly PlacedCabinet[],
  room: RoomData,
): Array<{ start: number; end: number }> {
  const tolerance = 1 / 16;
  const intervals = placed.flatMap((cabinet) => {
    if (!bearsCountertop(cabinet)) return [];
    const belongsToRun = cabinetWall(cabinet, room) === run.id;
    const cornerSupportsRun = !belongsToRun && peninsulaCornerCabinetSupportsCountertop(cabinet, run, room);
    if (!belongsToRun && !cornerSupportsRun) return [];

    const span = belongsToRun
      ? wallRunSpan(cabinet, run.id as WallSide, room)
      : Math.min(run.length, Math.max(STD.BASE_DEPTH, Math.min(Number(cabinet.width) || 0, Number(cabinet.depth) || 0)));
    if (!Number.isFinite(span) || span <= COLLISION_EPSILON_IN) return [];

    const offset = belongsToRun
      ? wallRunOffset(cabinet, run.id as WallSide, room)
      // A corner cabinet supports the adjacent return only at its shared start.
      // Its own run still uses its stored wall offset above.
      : 0;
    const start = Math.max(0, Math.min(run.length, offset));
    const end = Math.max(start, Math.min(run.length, start + span));
    return end - start > COLLISION_EPSILON_IN ? [{ start, end }] : [];
  }).sort((left, right) => left.start - right.start || left.end - right.end);

  return intervals.reduce<Array<{ start: number; end: number }>>((segments, interval) => {
    const previous = segments[segments.length - 1];
    if (previous && interval.start <= previous.end + tolerance) {
      previous.end = Math.max(previous.end, interval.end);
    } else {
      segments.push({ ...interval });
    }
    return segments;
  }, []);
}


/**
 * Void fill for a peninsula with a turn: when two slabs of the same connected
 * assembly remain separate (e.g. the inside-corner hold-in leaves an empty
 * wedge between the end of a run and a 45-degree return), bridge them with one
 * quad built from the two longest facing edges. Straight runs and walls are
 * untouched.
 */
function peninsulaVoidFillSurfaces(
  surfaces: readonly CountertopSurface[],
  room: RoomData,
): CountertopSurface[] {
  const runs = room.peninsulaRuns ?? [];
  if (!runs.some((run) => run.parentRunId)) return [];
  const MAX_GAP = 14;
  type Pt = { x: number; y: number };
  const segDist = (a0: Pt, a1: Pt, b0: Pt, b1: Pt) => {
    const pointSeg = (p: Pt, q0: Pt, q1: Pt) => {
      const dx = q1.x - q0.x, dy = q1.y - q0.y;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((p.x - q0.x) * dx + (p.y - q0.y) * dy) / len2));
      return Math.hypot(p.x - (q0.x + t * dx), p.y - (q0.y + t * dy));
    };
    return Math.min(pointSeg(a0, b0, b1), pointSeg(a1, b0, b1), pointSeg(b0, a0, a1), pointSeg(b1, a0, a1));
  };
  const rootOf = (surface: CountertopSurface): string | null => {
    const id = surface.peninsulaRunIds?.[0] || surface.peninsulaRunId;
    const run = id ? runs.find((candidate) => candidate.id === id) : null;
    return run ? peninsulaRootRunId(run, room) : null;
  };
  const items = surfaces
    .map((surface) => ({ surface, root: rootOf(surface), poly: countertopSurfacePlanPolygon(surface) }))
    .filter((item) => item.root && item.poly.length >= 3);
  const fills: CountertopSurface[] = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const A = items[i]!, B = items[j]!;
      if (A.root !== B.root) continue;
      let best: { score: number; area: number; quad: Pt[] } | null = null;
      const inside = (pt: Pt, poly: readonly Pt[]) => {
        let hit = false;
        for (let k = 0, m = poly.length - 1; k < poly.length; m = k++) {
          const a = poly[k]!, b = poly[m]!;
          if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
        }
        return hit;
      };
      for (let ai = 0; ai < A.poly.length; ai += 1) {
        const a0 = A.poly[ai]!, a1 = A.poly[(ai + 1) % A.poly.length]!;
        const aLen = Math.hypot(a1.x - a0.x, a1.y - a0.y);
        for (let bi = 0; bi < B.poly.length; bi += 1) {
          const b0 = B.poly[bi]!, b1 = B.poly[(bi + 1) % B.poly.length]!;
          const bLen = Math.hypot(b1.x - b0.x, b1.y - b0.y);
          const gap = segDist(a0, a1, b0, b1);
          if (gap > MAX_GAP) continue;
          const score = Math.min(aLen, bLen);
          if (score < 6 || (best && score < best.score - 1e-6)) continue;
          // A real miter void joins two edges of comparable length. A long edge
          // paired with a short one would sweep a sliver across open floor with
          // no cabinet beneath it, so it is never a physical countertop.
          if (Math.max(aLen, bLen) > score * 2.5 + 6) continue;
          for (const quad of [[a0, a1, b0, b1], [a0, a1, b1, b0]]) {
            if (countertopPolygonSelfIntersects(quad)) continue;
            // The two sides joining the paired edges must be short. A real miter
            // wedge is closed by sides about one gap long; long joins sweep a slab
            // across open floor between two far-apart faces of the bend.
            const joinA = Math.hypot(quad[2]!.x - quad[1]!.x, quad[2]!.y - quad[1]!.y);
            const joinB = Math.hypot(quad[3]!.x - quad[0]!.x, quad[3]!.y - quad[0]!.y);
            if (Math.max(joinA, joinB) > Math.max(aLen, bLen) + 1) continue;
            const area = countertopPolygonArea(quad);
            if (area < 4) continue;
            const xs = quad.map((q) => q.x), ys = quad.map((q) => q.y);
            let total = 0, covered = 0;
            for (let gx = 0; gx < 12; gx += 1) {
              for (let gy = 0; gy < 12; gy += 1) {
                const pt = { x: Math.min(...xs) + ((gx + 0.5) / 12) * (Math.max(...xs) - Math.min(...xs)), y: Math.min(...ys) + ((gy + 0.5) / 12) * (Math.max(...ys) - Math.min(...ys)) };
                if (!inside(pt, quad)) continue;
                total += 1;
                if (items.some((it) => inside(pt, it.poly)) || fills.some((f) => inside(pt, countertopSurfacePlanPolygon(f)))) covered += 1;
              }
            }
            if (total === 0 || covered / total > 0.1) continue;
            // Long facing edges are preferred, but nearly equal edge lengths
            // (40.50000000000001 vs 40.5) must choose the real, larger void.
            if (!best || score > best.score + 1e-6 || (Math.abs(score - best.score) <= 1e-6 && area > best.area)) {
              best = { score, area, quad };
            }
          }
        }
      }
      if (!best) continue;
      // Keep the fill counter-clockwise like every cabinet slab; a clockwise
      // fill is drawn as its underside and shows the cabinet through the top.
      const fillSignedArea = best.quad.reduce((sum, pt, index) => {
        const next = best.quad[(index + 1) % best.quad.length]!;
        return sum + pt.x * next.y - next.x * pt.y;
      }, 0);
      if (fillSignedArea < 0) best.quad.reverse();
      const surface = countertopSurfaceFromWorldPolygon(best.quad, A.surface.peninsulaRunId ?? B.surface.peninsulaRunId ?? "");
      // The 3D peninsula renderer centers polygon vertices using linearInches.
      // Without it the renderer falls back to the entire parent run length,
      // translating this small infill far away from its actual plan position.
      if (surface) fills.push({
        ...surface,
        linearInches: surface.width,
        peninsulaMiterInfill: true,
        peninsulaRunIds: Array.from(new Set([
          ...(A.surface.peninsulaRunIds ?? []),
          ...(A.surface.peninsulaRunId ? [A.surface.peninsulaRunId] : []),
          ...(B.surface.peninsulaRunIds ?? []),
          ...(B.surface.peninsulaRunId ? [B.surface.peninsulaRunId] : []),
        ])),
      });
    }
  }
  return fills;
}
/**
 * Shared post-merge countertop pass for BOTH the standard rectangle and drawn
 * (Continuous Wall) rooms: (a) closes the square left open where two
 * perpendicular runs meet at an inside 90-degree corner, and (b) trims a slab
 * at the near face of any interior (non-peninsula) pony wall so no top crosses
 * it. It only adds a corner fill or removes stone past a wall; existing
 * slab geometry, 45-degree miters and pricing inputs are left untouched.
 */
function closeInsideCornersAndClipInteriorWalls(
  surfaces: CountertopSurface[],
  room: RoomData,
  placed: readonly PlacedCabinet[],
  ponyWalls: readonly PonyWall[] = [],
): CountertopSurface[] {
  type Pt = CountertopPlanPoint;
  const inside = (pt: Pt, poly: readonly Pt[]) => {
    let hit = false;
    for (let k = 0, m = poly.length - 1; k < poly.length; m = k++) {
      const a = poly[k]!, b = poly[m]!;
      if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
    }
    return hit;
  };
  const wallOf = (surface: CountertopSurface): string | null =>
    surface.peninsulaRunId || surface.raisedBar ? null : surface.customWallId ?? surface.supportWallId ?? null;
  const result = surfaces.slice();
  const frames = roomWallRunFrames(room).filter((frame) => frame.kind !== "peninsula");
  const seen = new Set<string>();
  for (const frame of frames) {
    for (const at of ["start", "end"] as const) {
      const join = wallRunJoinAt(frame, at, room);
      if (!join || join.turnDeg !== 90) continue;
      const key = [frame.id, join.frame.id].sort().join("|") + (at === "start" ? frame.start.x : frame.end.x);
      if (seen.has(key)) continue;
      seen.add(key);
      const V = at === "start" ? frame.start : frame.end;
      const slabA = result.find((surface) => wallOf(surface) === frame.id);
      const slabB = result.find((surface) => wallOf(surface) === join.frame.id);
      if (!slabA || !slabB) continue;
      const polyA = countertopSurfacePlanPolygon(slabA), polyB = countertopSurfacePlanPolygon(slabB);
      const axis = (f: typeof frame, end: "start" | "end") => {
        const far = end === "start" ? f.end : f.start;
        const len = Math.hypot(far.x - V.x, far.y - V.y) || 1;
        return { x: (far.x - V.x) / len, y: (far.y - V.y) / len };
      };
      const uA = axis(frame, at);
      const bAt = Math.hypot(join.frame.start.x - V.x, join.frame.start.y - V.y) <= 0.01 ? "start" : "end";
      const uB = axis(join.frame, bAt);
      const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
      if (Math.abs(dot(uA, uB)) > 0.01) continue;
      const ext = (poly: Pt[], u: Pt) => {
        const values = poly.map((pt) => dot({ x: pt.x - V.x, y: pt.y - V.y }, u));
        return { min: Math.min(...values), max: Math.max(...values) };
      };
      // Each band's thickness is its extent perpendicular to its own wall.
      const thickA = ext(polyA, uB), thickB = ext(polyB, uA);
      const dA = Math.max(Math.abs(thickA.min), Math.abs(thickA.max)), dB = Math.max(Math.abs(thickB.min), Math.abs(thickB.max));
      const reachA = ext(polyA, uA).min, reachB = ext(polyB, uB).min;
      if (dA < 1 || dB < 1 || reachA > dB + 1 || reachB > dA + 1) continue;
      const sA = thickA.max >= -thickA.min ? 1 : -1, sB = thickB.max >= -thickB.min ? 1 : -1;
      const quad: Pt[] = [
        { x: V.x, y: V.y },
        { x: V.x + sB * dB * uA.x, y: V.y + sB * dB * uA.y },
        { x: V.x + sB * dB * uA.x + sA * dA * uB.x, y: V.y + sB * dB * uA.y + sA * dA * uB.y },
        { x: V.x + sA * dA * uB.x, y: V.y + sA * dA * uB.y },
      ];
      // sB/sA are +1 here because uA/uB already point along the run; the band
      // sits on the room side, which is where the cabinets' own slabs are.
      const xs = quad.map((pt) => pt.x), ys = quad.map((pt) => pt.y);
      let total = 0, covered = 0;
      for (let gx = 0; gx < 8; gx += 1) for (let gy = 0; gy < 8; gy += 1) {
        const pt = { x: Math.min(...xs) + ((gx + 0.5) / 8) * (Math.max(...xs) - Math.min(...xs)), y: Math.min(...ys) + ((gy + 0.5) / 8) * (Math.max(...ys) - Math.min(...ys)) };
        if (!inside(pt, quad)) continue;
        total += 1;
        if (inside(pt, polyA) || inside(pt, polyB)) covered += 1;
      }
      if (total === 0 || covered / total > 0.99) continue;
      const blocked = placed.some((cabinet) => {
        if (cabinet.placement === "wall" || bearsCountertop(cabinet)) return false;
        const f = placedFootprint(cabinet);
        return cabinet.x < Math.max(...xs) - 0.1 && cabinet.x + f.w > Math.min(...xs) + 0.1
          && cabinet.y < Math.max(...ys) - 0.1 && cabinet.y + f.d > Math.min(...ys) + 0.1;
      });
      if (blocked) continue;
      const fill = countertopSurfaceFromWorldPolygon(quad);
      if (fill) result.push({ ...fill, linearInches: fill.width, areaInches: countertopPolygonArea(quad), cabinetRunId: `corner-fill:${key}` });
    }
  }
  // (b) trim against interior (non-peninsula) pony walls.
  for (const wall of ponyWalls) {
    if (wall.peninsulaRunId) continue;
    const pf = ponyWallPlanFrame(wall, room);
    const dx = pf.end.x - pf.start.x, dy = pf.end.y - pf.start.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const u = { x: dx / len, y: dy / len }, n = { x: -u.y, y: u.x };
    const half = pf.depth / 2;
    const local = (pt: Pt) => ({ a: (pt.x - pf.start.x) * u.x + (pt.y - pf.start.y) * u.y, b: (pt.x - pf.start.x) * n.x + (pt.y - pf.start.y) * n.y });
    for (let i = 0; i < result.length; i += 1) {
      const surface = result[i]!;
      if (surface.raisedBar || surface.peninsulaRunId) continue;
      const poly = countertopSurfacePlanPolygon(surface);
      const L = poly.map(local);
      const crosses = L.some((q) => q.b > -half) && L.some((q) => q.b < half)
        && Math.max(...L.map((q) => q.a)) > 0 && Math.min(...L.map((q) => q.a)) < len
        && (Math.min(...L.map((q) => q.b)) < half && Math.max(...L.map((q) => q.b)) > -half);
      if (!crosses) continue;
      const cb = L.reduce((t, q) => t + q.b, 0) / L.length;
      const side = cb >= 0 ? 1 : -1;
      const keep = (q: { a: number; b: number }) => side * q.b >= half;
      const out2: Pt[] = [];
      for (let k = 0; k < poly.length; k += 1) {
        const P = poly[k]!, Q = poly[(k + 1) % poly.length]!, lp = L[k]!, lq = L[(k + 1) % L.length]!;
        if (keep(lp)) out2.push(P);
        if (keep(lp) !== keep(lq)) {
          const t = (side * half - lp.b) / (lq.b - lp.b);
          out2.push({ x: P.x + (Q.x - P.x) * t, y: P.y + (Q.y - P.y) * t });
        }
      }
      if (out2.length < 3) { result.splice(i, 1); i -= 1; continue; }
      const clipped = countertopSurfaceFromWorldPolygon(out2);
      if (!clipped) continue;
      const { x: _x, y: _y, width: _w, depth: _d, polygon: _pg, rotation: _r, ...meta } = surface as CountertopSurface & Record<string, unknown>;
      result[i] = { ...(meta as Partial<CountertopSurface>), ...clipped, areaInches: countertopPolygonArea(out2), linearInches: clipped.width } as CountertopSurface;
    }
  }
  return result;
}

export function countertopSurfaces(
  placed: PlacedCabinet[],
  room: RoomData,
  island?: IslandZone | null,
  ponyWalls: readonly PonyWall[] = [],
): CountertopSurface[] {
  const out: CountertopSurface[] = [];
  for (const p of placed) {
    // Countertop-bearing bases and confirmed installed filler pieces get a slab.
    // Loose fillers, tall cabinets, appliances, and panels remain excluded.
    if (!bearsCountertop(p)) continue;
    if (island && isOnIsland(p, island)) continue;
    const side = cabinetWall(p, room);
    const D = countertopDepthForCabinet(p);
    const footprint = placedFootprint(p);
    const peninsula = peninsulaRunById(room, side);
    // Explicit peninsula runs are collected below into a single continuous
    // cabinet-supported slab. That avoids seams and maintains coverage over an
    // intentional void between two cabinets.
    if (peninsula) continue;
    // Free-standing bases in the open room (no wall seat, not against a wall)
    // are collected below into one mitered chain slab, exactly like the
    // Continuous Wall Builder's 45° turn. Their top never snaps onto a wall.
    if (isFreestandingBase(p, room, island)) continue;
    // A Lazy Susan/easy-reach base owns two physical cabinet legs. A drawn
    // room's straight-run branch below cannot replace that physical L with one
    // rectangle, including when its supporting wall is at 45°. Keep the exact
    // cabinet-supported contour before selecting the straight-run path.
    const cornerGeometry = placedCornerGeometryKind(p);
    const customWall = room.customWalls?.find((wall) => wall.id === side);
    if (cornerGeometry === "l-shape" || cornerGeometry === "corner-drawer") {
      const surface = countertopSurfaceFromWorldPolygon(lCornerCountertopWorldPolygon(p));
      if (surface) out.push(customWall ? { ...surface, customWallId: customWall.id } : surface);
      continue;
    }
    if (customWall) {
      const runSpan = wallRunSpan(p, side, room);
      if (runSpan > COLLISION_EPSILON_IN) {
        const rearExtension = blindCornerRearCountertopExtensionIn(p, room);
        const slabDepth = D + rearExtension;
        const spot = wallPlacementAt(
          wallRunOffset(p, side, room),
          runSpan,
          slabDepth,
          side,
          room,
        );
        // `wallPlacementAt` returns the top-left of the rotated rectangle's
        // world-space AABB. `CountertopSurface` stores true local width/depth
        // and its consumers rotate around `x + width / 2, y + depth / 2`.
        // Using the AABB corner as that local origin shifts every non-cardinal
        // measured-wall top sideways (most visibly on a 45° wall) even though
        // the cabinet below uses the correct AABB centre. Preserve the exact
        // world centre, then convert it back to CountertopSurface's local-frame
        // origin so Plan, 3D, miter seams, and takeoff share one footprint.
        const radians = spot.rotation * Math.PI / 180;
        const aabbWidth = Math.abs(runSpan * Math.cos(radians)) + Math.abs(slabDepth * Math.sin(radians));
        const aabbDepth = Math.abs(runSpan * Math.sin(radians)) + Math.abs(slabDepth * Math.cos(radians));
        const centerX = spot.x + aabbWidth / 2;
        const centerY = spot.y + aabbDepth / 2;
        out.push({
          x: centerX - runSpan / 2,
          y: centerY - slabDepth / 2,
          width: runSpan,
          depth: slabDepth,
          kind: "base",
          rotation: spot.rotation,
          customWallId: customWall.id,
          customWallRunStartIn: wallRunOffset(p, side, room),
          linearInches: runSpan,
          areaInches: runSpan * slabDepth,
        });
      }
      continue;
    }
    const horizontalWall = side === "top" || side === "bottom";
    const runSpan = horizontalWall ? footprint.w : footprint.d;
    const rearExtension = blindCornerRearCountertopExtensionIn(p, room);
    // A blind corner may also carry an along-run pull from the room corner.
    // Cover that exact dead-corner distance, rather than blindly adding the
    // manufacturer's maximum pull when the cabinet already touches the corner.
    let cornerGap = 0;
    if (isBlindCorner(p.masterCode, p.description)) {
      const runStart = horizontalWall ? p.x : p.y;
      const runMax = horizontalWall ? room.width : room.depth;
      const nearStart = runStart <= runMax - (runStart + runSpan);
      const actualCornerGap = nearStart ? runStart : runMax - (runStart + runSpan);
      const pullMax = blindPullRange(p)?.max ?? BLIND_CORNER_FILLER_WIDTH_IN * 2;
      if (actualCornerGap > COLLISION_EPSILON_IN && actualCornerGap <= pullMax + COLLISION_EPSILON_IN) {
        cornerGap = Math.round(actualCornerGap * 8) / 8;
      }
    }
    if (side === "top") {
      // Extend toward whichever horizontal end is nearer the corner (the wall).
      const nearLeft = p.x <= room.width - (p.x + runSpan);
      const x = nearLeft ? p.x - cornerGap : p.x;
      out.push({ x: Math.max(0, x), y: 0, width: runSpan + cornerGap, depth: D + rearExtension, kind: "base", supportWallId: side });
    } else if (side === "bottom") {
      const nearLeft = p.x <= room.width - (p.x + runSpan);
      const x = nearLeft ? p.x - cornerGap : p.x;
      out.push({ x: Math.max(0, x), y: room.depth - D - rearExtension, width: runSpan + cornerGap, depth: D + rearExtension, kind: "base", supportWallId: side });
    } else if (side === "left") {
      // Vertical run: slab is D wide into the room and uses the rotated
      // footprint depth as its full along-wall span.
      const nearTop = p.y <= room.depth - (p.y + runSpan);
      const y = nearTop ? p.y - cornerGap : p.y;
      out.push({ x: 0, y: Math.max(0, y), width: D + rearExtension, depth: runSpan + cornerGap, kind: "base", supportWallId: side });
    } else {
      const nearTop = p.y <= room.depth - (p.y + runSpan);
      const y = nearTop ? p.y - cornerGap : p.y;
      out.push({ x: room.width - D - rearExtension, y: Math.max(0, y), width: D + rearExtension, depth: runSpan + cornerGap, kind: "base", supportWallId: side });
    }
  }
  // First collapse cabinet-by-cabinet support into one physical top per
  // contiguous run. Refrigerator bays and appliance gaps have no support, so
  // they remain explicit breaks rather than receiving an accidental bridge slab.
  out.splice(0, out.length, ...mergeContiguousBaseCountertopRuns(out, room, placed));
  // Continuous-wall 45-degree returns use the same two miter-cut slab rule as
  // peninsula returns. Both cabinet-supported pieces meet at one physical seam;
  // do not add a third, decorative bridge triangle over the cabinet geometry.
  out.splice(0, out.length, ...miteredMeasuredWallCountertopSurfaces(out, placed, room));
  // Shared by the standard room and the Continuous Wall Builder: fill any open
  // inside 90-degree corner square and keep every top on its own side of an
  // interior pony wall.
  out.splice(0, out.length, ...closeInsideCornersAndClipInteriorWalls(out, room, placed, ponyWalls));
  // A peninsula follows the same cabinet-run rule as every other wall: touching
  // counter-bearing pieces share one slab, while an actual unsupported gap ends
  // the run. Appliances remain explicit openings inside a supported run.
  for (const run of room.peninsulaRuns ?? []) {
    const supportSegments = peninsulaCountertopSupportSegments(run, placed, room);
    if (supportSegments.length === 0) continue;
    const applianceOpenings = placed
      .filter((cabinet) => isRangeOrOven(cabinet.masterCode, cabinet.description) && cabinetWall(cabinet, room) === run.id)
      .map((cabinet) => {
        const width = Math.max(0, Number(cabinet.width) || 0);
        const footprint = placedFootprint(cabinet);
        const projectedCenter = peninsulaRunOffsetAtPoint(run, room, {
          x: cabinet.x + footprint.w / 2,
          y: cabinet.y + footprint.d / 2,
        });
        const savedStart = typeof cabinet.wallOffset === "number" ? cabinet.wallOffset : Number.NaN;
        const start = Number.isFinite(savedStart) ? savedStart : projectedCenter - width / 2;
        return {
          start: Math.max(0, Math.min(run.length, start)),
          end: Math.max(0, Math.min(run.length, start + width)),
        };
      })
      .filter((opening) => opening.end - opening.start > COLLISION_EPSILON_IN)
      .sort((a, b) => a.start - b.start)
      .reduce<Array<{ start: number; end: number }>>((merged, opening) => {
        const previous = merged[merged.length - 1];
        if (previous && opening.start <= previous.end + COLLISION_EPSILON_IN) {
          previous.end = Math.max(previous.end, opening.end);
        } else {
          merged.push({ ...opening });
        }
        return merged;
      }, []);
    for (const support of supportSegments) {
      let cursor = support.start;
      for (const opening of applianceOpenings) {
        if (opening.end <= cursor + COLLISION_EPSILON_IN) continue;
        if (opening.start >= support.end - COLLISION_EPSILON_IN) break;
        const clippedStart = Math.max(cursor, opening.start);
        if (clippedStart - cursor > COLLISION_EPSILON_IN) {
          out.push(peninsulaCountertopSurface(run, room, cursor, clippedStart - cursor));
        }
        cursor = Math.max(cursor, Math.min(support.end, opening.end));
      }
      if (support.end - cursor > COLLISION_EPSILON_IN) {
        out.push(peninsulaCountertopSurface(run, room, cursor, support.end - cursor));
      }
    }
  }
  // The run slabs above provide the standard 24" cabinet depth plus finished
  // front edge. Add only any real L-corner leg that extends beyond them before
  // the existing 45° miter/union stage assembles the shared countertop.
  out.push(...peninsulaLCornerSupportSurfaces(placed, room));
  const mitered = miteredPeninsulaCountertopSurfaces(out, room);
  out.splice(0, out.length, ...unifiedFortyFivePeninsulaCountertopSurfaces(mitered, room));
  out.push(...peninsulaVoidFillSurfaces(out, room));
  // A split-level bar changes only elevation. Clone the fully resolved lower
  // countertop *after* its physical 45° miter and cabinet-supported infill are
  // complete, rather than rebuilding a second bar shape from pony-wall depth.
  // This makes the 42-inch level exactly match the cabinet structure and its
  // 1½-inch finished edge, including each real 45° seam.
  const raisedBars = out.filter((surface) => {
    // peninsulaVoidFillSurfaces adds a shared lower-level wedge owned by both
    // runs. It must remain at the finished flat-top height, not be cloned into
    // the 42-inch bar. Merged real run slabs also carry both IDs, so ownership
    // alone cannot distinguish them from the lower-only structural infill.
    if (surface.peninsulaMiterInfill) return false;
    const ownerIds = surface.peninsulaRunIds ?? (surface.peninsulaRunId ? [surface.peninsulaRunId] : []);
    return ownerIds.some((id) => {
      const run = peninsulaRunById(room, id);
      return run ? peninsulaCountertopRaisedBarEnabled(run, room) : false;
    });
  });
  out.push(...raisedBars.map((surface) => {
    const owningRun = peninsulaRunById(room, surface.peninsulaRunId);
    const raisedBarOverhang = owningRun
      ? peninsulaCountertopRaisedBarOverhang(owningRun, room)
      : 15;
    const raisedSurface = extendPeninsulaRaisedBarSurface(
      surface,
      room,
      Math.min(15, Math.max(12, raisedBarOverhang)),
    );
    return {
      ...raisedSurface,
      raisedBar: true,
      raisedBarUsesSharedCountertopOutline: true,
      raisedBarOverhangIn: raisedBarOverhang,
      countertopHeightIn: RAISED_BAR_HEIGHT_IN,
    };
  }));
  // The raised bar's outer mitre wedge is intentionally NOT added: it showed as a
  // triangle protruding off the top bar at the 45-degree turn. The two strips end
  // at the turn; the lower countertop is unaffected.
  void raisedBarOuterMiterWedges;
  out.splice(0, out.length, ...joinRaisedBarStripsAtMiter(out, room));
  const hasActiveSplitLevelWizard = (room.peninsulaRuns ?? []).some((run) => (
    !run.parentRunId
    && run.countertopRaisedBar === true
    && run.wizardRecipe?.countertopTreatment === "split-level"
  ));
  out.push(...(hasActiveSplitLevelWizard ? [] : raisedBarMiterGapFills(out)));
  // A tiered Wizard peninsula owns a structural void and a structural raised
  // bar. Rebuild only those non-flat pieces without appliance placements so a
  // cooktop opening can split the flat worktop but can never move, widen, or
  // delete the void or the opposite-side/raised surface.
  if (hasActiveSplitLevelWizard && placed.some((item) => isRangeOrOven(item.masterCode, item.description))) {
    const structural = countertopSurfaces(
      placed.filter((item) => !isRangeOrOven(item.masterCode, item.description)),
      room,
      island,
      ponyWalls,
    );
    out.splice(0, out.length, ...out.filter((surface) => !surface.raisedBar), ...structural.filter((surface) => surface.raisedBar));
  }
  if (island) {
    const supports = placed.filter((item) => isOnIsland(item, island) && bearsCountertop(item));
    if (supports.length > 0) {
      const footprints = supports.map((item) => ({ item, footprint: placedFootprint(item) }));
      const minX = Math.min(...footprints.map(({ item }) => item.x));
      const minY = Math.min(...footprints.map(({ item }) => item.y));
      const maxX = Math.max(...footprints.map(({ item, footprint }) => item.x + footprint.w));
      const maxY = Math.max(...footprints.map(({ item, footprint }) => item.y + footprint.d));
      const width = island.countertopWidth ?? maxX - minX + 3;
      const depth = island.countertopDepth ?? maxY - minY + 3;
      const centerX = (minX + maxX) / 2 + Number(island.countertopOffsetX ?? 0);
      const centerY = (minY + maxY) / 2 + Number(island.countertopOffsetY ?? 0);
      out.push({ x: centerX - width / 2, y: centerY - depth / 2, width, depth, kind: "island" });
    }
  }
  out.push(...freestandingCountertopSurfaces(placed, room, island));
  return out;
}

// ─── Sink & faucet fixtures ───────────────────────────────────────────────────
// Fixtures live on the countertop. We keep them simple: a sink basin (with a
// type) and a faucet point. Positions are room (inch) coordinates of the basin's
// top-left. Stored on the design draft so they persist.
export type SinkType = "single" | "double" | "farmhouse" | "bar";

export interface SinkFixture {
  uid: string;
  type: SinkType;
  x: number;
  y: number;
  width: number;
  depth: number;
  faucet: boolean;
  /** Wall that the fixture faces, used to orient the basin and faucet in plan/3D. */
  wallSide?: WallSide;
  /** Exact clockwise Plan rotation inherited from the owning cabinet. */
  planRotation?: number;
  /** Owning sink-base placement when the fixture is installed in a cabinet. */
  cabinetUid?: string;
  /** Physical product dimensions before the plan footprint is rotated. */
  sourceWidth?: number;
  sourceDepth?: number;
  /** Non-apron sink front setback from the finished countertop front. */
  frontSetbackIn?: number;
  /** Center of the usable rear countertop deck, measured from the sink rear. */
  faucetRearDeckOffsetIn?: number;
  /** Planning conflict when a deck-mounted faucet has no physical rear deck. */
  faucetDeckConflict?: "shallow-countertop-deck";
  /** Pelican product ID (when selected from real inventory) */
  pelicanProductId?: number;
  /** Pelican product name for display */
  pelicanProductName?: string;
  /** Pelican product image URL */
  pelicanProductImage?: string;
  /** Source-verified parametric profile identifier, when a real Pelican fixture has one. */
  pelicanProfileId?: string;
  /** Verified bowl dimensions in inches for the selected Pelican sink profile. */
  bowlWidth?: number;
  bowlDepth?: number;
  bowlHeight?: number;
  /** Source-verified count for a multi-bowl Pelican sink profile. */
  bowlCount?: 1 | 2;
  /** Individually measured bowl widths for asymmetric two-bowl fixture profiles. */
  bowlWidths?: readonly [number, number];
  /** Individually measured bowl depths for asymmetric two-bowl fixture profiles. */
  bowlDepths?: readonly [number, number];
  /** Individually measured bowl heights for stepped two-bowl fixture profiles. */
  bowlHeights?: readonly [number, number];
  /** Source-documented inset from the bowl's right edge to its drain center. */
  drainInsetRight?: number;
  /** Source-documented inset from the bowl's rear edge to its drain center. */
  drainInsetBack?: number;
  /** Verified outer sink height in inches, used by an apron-front sink face. */
  exteriorHeight?: number;
  /** A farmhouse/apron-front sink exposes a measured front below the countertop. */
  apronFront?: boolean;
  /** Source-documented sink surface finish for deterministic physical fixture rendering. */
  surfaceFinish?: "stainless-steel" | "gunmetal-black" | "vitreous-china" | "vitreous-china-black" | "vitreous-china-bone" | "vitreous-china-grey";
  /** Selected Pelican faucet identity and source-verified parametric profile, when present. */
  pelicanFaucetProductId?: number;
  pelicanFaucetProductName?: string;
  pelicanFaucetProductImage?: string;
  pelicanFaucetProfileId?: string;
  /** Published faucet dimensions in inches; only source-verified values are stored here. */
  faucetOverallHeight?: number;
  faucetSpoutLength?: number;
  faucetSpoutHeight?: number;
  faucetFinish?: "brushed-nickel" | "matte-black" | "brushed-gold" | "chrome" | "oil-rubbed-bronze";
  faucetForm?: "pull-down" | "standard-arc" | "pull-out" | "articulated-swing" | "wall-mounted-bridge";
  /** Published valve-center spread for a source-measured wall faucet; never inferred from an image. */
  faucetCenterSpread?: number;
  /** Documented per-project rise from finished countertop to wall-mount datum. */
  faucetWallMountHeightAboveCountertopIn?: number;
  /** Wall mounts cannot use a generic default elevation. */
  requiresProjectSpecificMountHeight?: true;
}

/**
 * A source-measured wall pot filler attached to one physical range/cooktop wall.
 * The manufacturer publishes fixture dimensions, not one universal wall-mount
 * elevation. `mountHeightAboveCooktopIn` is deliberately mandatory so the
 * Designer never manufactures an installation height.
 */
export interface PotFillerFixture {
  uid: string;
  rangeUid: string;
  /** Exact current range/cooktop wall identity, including a custom wall ID. */
  mountingWallId: string;
  pelicanProductId: number;
  pelicanCode: string;
  pelicanProductName: string;
  pelicanProductImage?: string | null;
  pelicanProfileId: string;
  finish: "brushed-nickel" | "matte-black" | "brushed-gold" | "chrome";
  /** Documented per-project distance from finished cooktop to fixture mount datum. */
  mountHeightAboveCooktopIn: number;
  /** Source-measured maximum reach; it is not inferred from a catalog image. */
  spoutReachIn: number;
  overallSpanIn: number;
  armDatumIn: number;
  fixtureHeightIn: number;
  outletDatumIn: number;
  maximumFlowGpmAt60Psi: number;
  installation: "wall-mounted-in-wall-cold-water";
  requiresProjectSpecificMountHeight: true;
}

/** A range/cooktop can receive a wall pot filler; built-in ovens cannot. */
export function isRangeOrCooktop(cabinet: Pick<PlacedCabinet, "masterCode" | "description">): boolean {
  const code = (cabinet.masterCode ?? "").toUpperCase();
  const text = `${cabinet.masterCode ?? ""} ${cabinet.description ?? ""}`.toLowerCase();
  if (/^(?:RANGE|RNG|STOVE|STV|COOKTOP|CT)[\s_-]*(?:\d+)?$/i.test(code)) return true;
  return /\b(?:freestanding\s+)?(?:range|stove|cooktop)\b/i.test(text)
    && !/\b(?:wall|built[-\s]?in|single|double)\s+oven\b/i.test(text);
}

export type CooktopConversionStatus = "converted" | "unresolved-standard-base" | null;

/** Convert legacy SB range-top modes into the same SB plus a first-class opening appliance. */
export function convertLegacyCooktopPlacements(
  placed: readonly PlacedCabinet[],
  _catalogBases: readonly DesignCabinet[],
): { placed: PlacedCabinet[]; convertedCabinetUids: Set<string> } {
  const convertedCabinetUids = new Set<string>();
  const next: PlacedCabinet[] = [];
  for (const cabinet of placed) {
    const type = cabinet.sinkTopType;
    if (!isSinkBaseCabinet(cabinet) || (type !== "gas" && type !== "electric" && type !== "induction" && type !== "smooth-top")) {
      next.push(cabinet);
      continue;
    }
    const width = Number(cabinet.width);
    const baseCabinet: PlacedCabinet = {
      ...cabinet,
      placement: "base",
      width,
      depth: Number(cabinet.depth) || STD.BASE_DEPTH,
      height: Number(cabinet.height) || STD.BASE_HEIGHT,
      mountBottom: null,
      sinkTopType: null,
      sinkTopProductId: null,
      faucetProductId: null,
      faucetImageUrl: null,
      sinkImageUrl: null,
      rangeTopImageUrl: null,
      rangeTopFinish: null,
      cooktopConversionStatus: "converted",
    };
    const productId = cabinet.sinkTopProductId ?? null;
    const label = type === "smooth-top" ? "Smooth-top cooktop" : `${type[0]!.toUpperCase()}${type.slice(1)} cooktop`;
    const applianceCode = cabinet.applianceCatalogCode ?? (productId == null ? `CATALOG-APPLIANCE-${type}` : `CATALOG-APPLIANCE-${productId}`);
    const applianceName = cabinet.applianceCatalogName ?? label;
    const appliance: PlacedCabinet = {
      uid: `${cabinet.uid}:cooktop`,
      cabinetId: 0,
      masterCode: applianceCode,
      description: applianceName,
      category: "Appliance",
      subCategory: "Cooktop",
      placement: "appliance",
      applianceRole: "countertop-opening",
      applianceProductId: productId,
      applianceCatalogCode: applianceCode,
      applianceCatalogName: applianceName,
      applianceCatalogPrice: cabinet.applianceCatalogPrice ?? null,
      x: cabinet.x,
      y: cabinet.y,
      width,
      depth: Number(cabinet.depth) || STD.BASE_DEPTH,
      height: STD.COUNTERTOP_THICKNESS,
      // A countertop-opening appliance is a thin body seated under the
      // finished surface, not a second 34½-inch cabinet box. Its top must
      // meet the 36-inch finished countertop line.
      mountBottom: STD.COUNTERTOP_HEIGHT - STD.COUNTERTOP_THICKNESS,
      rotation: cabinet.rotation,
      wallId: cabinet.wallId,
      wallOffset: cabinet.wallOffset,
      peninsulaSide: cabinet.peninsulaSide,
      islandFace: cabinet.islandFace,
      peninsulaWizardId: cabinet.peninsulaWizardId,
      rangeTopImageUrl: cabinet.rangeTopImageUrl ?? null,
      rangeTopFinish: cabinet.rangeTopFinish ?? null,
      cooktopConversionStatus: "converted",
    };
    next.push(baseCabinet, appliance);
    convertedCabinetUids.add(cabinet.uid);
  }
  return { placed: next, convertedCabinetUids };
}

/**
 * Resolve a fixture only when it remains attached to the same non-island wall
 * behind its source range/cooktop. Invalid saved fixtures are retained for audit
 * but intentionally receive no plan/3D/cart representation.
 */
export function potFillerMountedRange(
  fixture: PotFillerFixture,
  placed: readonly PlacedCabinet[],
  room: RoomData,
  island?: IslandZone | null,
): PlacedCabinet | null {
  const range = placed.find((cabinet) => cabinet.uid === fixture.rangeUid);
  if (!range || !isRangeOrCooktop(range)) return null;
  // Do not infer a mounting wall from a free-standing plan coordinate. A pot
  // filler is admissible only when the range has an explicit persisted wall ID.
  if (!range.wallId) return null;
  if (range.islandFace || (island != null && isOnIsland(range, island))) return null;
  const currentWallId = String(range.wallId);
  return currentWallId === fixture.mountingWallId ? range : null;
}

export const SINK_PRESETS: Record<SinkType, { name: string; width: number; depth: number }> = {
  single:    { name: "Single Bowl Sink", width: 25, depth: 18 },
  double:    { name: "Double Bowl Sink", width: 33, depth: 20 },
  farmhouse: { name: "Farmhouse Sink",   width: 30, depth: 20 },
  bar:       { name: "Bar / Prep Sink",  width: 15, depth: 15 },
};

/** Approved non-apron sink setback range from the finished countertop front. */
export const NON_APRON_SINK_FRONT_SETBACK = {
  minimumIn: 2.5,
  defaultIn: 3,
  maximumIn: 3.5,
} as const;

/**
 * Published faucet profiles do not carry a countertop-hole/base-footprint
 * datum. This documented Designer planning policy reserves a usable rear deck
 * for their actual deck-mounted render, without claiming a source-specific
 * installation clearance.
 */
export const MINIMUM_FAUCET_REAR_DECK_IN = 2.5;

export type NonApronSinkDeckPlacement = {
  applies: boolean;
  ok: boolean;
  x: number;
  y: number;
  planWidth: number;
  planDepth: number;
  frontSetbackIn: number;
  rearDeckIn: number;
  faucetCanFit: boolean;
  faucetRearDeckOffsetIn?: number;
  sinkFitsCountertop: boolean;
  reason?: string;
};

const isCardinalSinkWall = (side: WallSide | undefined): side is "top" | "bottom" | "left" | "right" => (
  side === "top" || side === "bottom" || side === "left" || side === "right"
);

export function sinkPlanDimensions(
  width: number,
  depth: number,
  wallSide?: WallSide,
): { width: number; depth: number } {
  return wallSide === "left" || wallSide === "right"
    ? { width: depth, depth: width }
    : { width, depth };
}

/**
 * Places a standard, non-apron sink on an ordinary cardinal base run. Its long
 * side stays parallel to the cabinet front; its front is three inches behind
 * the finished countertop front by default; and the remaining rear deck is
 * the only allowed deck-mounted faucet location. Part 1 intentionally leaves
 * island, peninsula, angled/custom wall, apron-front, and countertop meshes
 * untouched.
 */
export function nonApronSinkDeckPlacement(
  cabinet: PlacedCabinet,
  room: RoomData,
  dimensions: { width: number; depth: number },
  requestedFrontSetbackIn: number = NON_APRON_SINK_FRONT_SETBACK.defaultIn,
): NonApronSinkDeckPlacement {
  const side = cabinet.islandFace
    ? ({ front: "top", back: "bottom", left: "right", right: "left" } as const)[cabinet.islandFace]
    : cabinetWall(cabinet, room);
  const plan = sinkPlanDimensions(dimensions.width, dimensions.depth, side);
  const footprint = placedFootprint(cabinet);
  const centeredX = Math.max(cabinet.x, Math.min(cabinet.x + footprint.w - plan.width, cabinet.x + footprint.w / 2 - plan.width / 2));
  const centeredY = Math.max(cabinet.y, Math.min(cabinet.y + footprint.d - plan.depth, cabinet.y + footprint.d / 2 - plan.depth / 2));
  const fallback: NonApronSinkDeckPlacement = {
    applies: false,
    ok: true,
    x: centeredX,
    y: centeredY,
    planWidth: plan.width,
    planDepth: plan.depth,
    frontSetbackIn: requestedFrontSetbackIn,
    rearDeckIn: 0,
    faucetCanFit: true,
    sinkFitsCountertop: true,
  };
  if (cabinet.islandFace || !isCardinalSinkWall(side)) return fallback;

  const frontSetbackIn = Number.isFinite(requestedFrontSetbackIn)
    ? requestedFrontSetbackIn
    : NON_APRON_SINK_FRONT_SETBACK.defaultIn;
  if (frontSetbackIn < NON_APRON_SINK_FRONT_SETBACK.minimumIn || frontSetbackIn > NON_APRON_SINK_FRONT_SETBACK.maximumIn) {
    return {
      ...fallback,
      applies: true,
      ok: false,
      frontSetbackIn,
      faucetCanFit: false,
      sinkFitsCountertop: false,
      reason: `Sink front setback must be between ${NON_APRON_SINK_FRONT_SETBACK.minimumIn}″ and ${NON_APRON_SINK_FRONT_SETBACK.maximumIn}″.`,
    };
  }

  const countertopDepthIn = countertopDepthForCabinet(cabinet);
  const rearDeckIn = countertopDepthIn - frontSetbackIn - dimensions.depth;
  const sinkFitsCountertop = rearDeckIn >= -COLLISION_EPSILON_IN;
  const faucetCanFit = rearDeckIn + COLLISION_EPSILON_IN >= MINIMUM_FAUCET_REAR_DECK_IN;
  // Keep the deck-mounted base a tangible 1¼ inches behind the sink's rear
  // edge when the approved deck minimum exists; do not visually drift it to
  // the far rear edge on shallower/deeper sink models.
  const faucetRearDeckOffsetIn = Math.max(0, Math.min(rearDeckIn / 2, 1.25));
  let x = centeredX;
  let y = centeredY;
  if (side === "top") {
    y = cabinet.y + footprint.d + (countertopDepthIn - footprint.d) - frontSetbackIn - plan.depth;
  } else if (side === "bottom") {
    y = cabinet.y - (countertopDepthIn - footprint.d) + frontSetbackIn;
  } else if (side === "left") {
    x = cabinet.x + footprint.w + (countertopDepthIn - footprint.w) - frontSetbackIn - plan.width;
  } else {
    x = cabinet.x - (countertopDepthIn - footprint.w) + frontSetbackIn;
  }
  const reason = !sinkFitsCountertop
    ? `The selected sink is deeper than the finished countertop after its ${frontSetbackIn}″ front setback.`
    : !faucetCanFit
      ? `The selected sink leaves ${Math.max(0, rearDeckIn).toFixed(2)}″ of rear deck; a deck-mounted faucet requires ${MINIMUM_FAUCET_REAR_DECK_IN}″.`
      : undefined;
  return {
    applies: true,
    ok: sinkFitsCountertop,
    x,
    y,
    planWidth: plan.width,
    planDepth: plan.depth,
    frontSetbackIn,
    rearDeckIn: Math.max(0, rearDeckIn),
    faucetCanFit,
    faucetRearDeckOffsetIn,
    sinkFitsCountertop,
    reason,
  };
}

export function makeSink(
  type: SinkType,
  x: number,
  y: number,
  wallSide?: WallSide,
  dimensions?: { width: number; depth: number },
): SinkFixture {
  const preset = SINK_PRESETS[type];
  const sourceWidth = dimensions?.width ?? preset.width;
  const sourceDepth = dimensions?.depth ?? preset.depth;
  const plan = sinkPlanDimensions(sourceWidth, sourceDepth, wallSide);
  return {
    uid: `sink-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    type,
    x,
    y,
    width: plan.width,
    depth: plan.depth,
    faucet: true,
    wallSide,
    sourceWidth,
    sourceDepth,
  };
}

/** Centers a sink fixture within a sink-base footprint and faces it toward the room. */
export function makeSinkForCabinet(
	  type: SinkType,
	  cabinet: PlacedCabinet,
	  room: RoomData,
	  dimensions?: { width: number; depth: number },
	  options?: { frontSetbackIn?: number },
): SinkFixture {
	  const side = cabinet.islandFace
	    ? ({ front: "top", back: "bottom", left: "right", right: "left" } as const)[cabinet.islandFace]
	    : cabinetWall(cabinet, room);
  const rawWidth = dimensions?.width ?? SINK_PRESETS[type].width;
  const rawDepth = dimensions?.depth ?? SINK_PRESETS[type].depth;
  const plan = sinkPlanDimensions(rawWidth, rawDepth, side);
  const footprint = placedFootprint(cabinet);
  const centeredX = Math.max(cabinet.x, Math.min(cabinet.x + footprint.w - plan.width, cabinet.x + footprint.w / 2 - plan.width / 2));
  const centeredY = Math.max(cabinet.y, Math.min(cabinet.y + footprint.d - plan.depth, cabinet.y + footprint.d / 2 - plan.depth / 2));
  // Farmhouse sinks are countertop-mounted but their apron is flush with the
  // room-facing cabinet front. Keep the run axis centered while moving only the
  // wall-normal axis to that front edge.
  const x = type === "farmhouse"
    ? side === "left"
      ? cabinet.x + footprint.w - plan.width
      : side === "right"
        ? cabinet.x
        : centeredX
    : centeredX;
  const y = type === "farmhouse"
    ? side === "top"
      ? cabinet.y + footprint.d - plan.depth
      : side === "bottom"
        ? cabinet.y
        : centeredY
    : centeredY;
	  const deckPlacement = type === "farmhouse"
	    ? null
	    : nonApronSinkDeckPlacement(cabinet, room, { width: rawWidth, depth: rawDepth }, options?.frontSetbackIn);
	  const cardinalWall = isCardinalSinkWall(side);
	  const planRotation = cardinalWall ? 0 : ((Number(cabinet.rotation) % 360) + 360) % 360;
	  return {
	    ...makeSink(type, deckPlacement?.applies ? deckPlacement.x : x, deckPlacement?.applies ? deckPlacement.y : y, side, { width: rawWidth, depth: rawDepth }),
	    cabinetUid: cabinet.uid,
	    planRotation,
	    ...(deckPlacement?.applies ? {
	      frontSetbackIn: deckPlacement.frontSetbackIn,
	      faucetRearDeckOffsetIn: deckPlacement.faucetRearDeckOffsetIn,
	      ...(deckPlacement.faucetCanFit ? {} : { faucetDeckConflict: "shallow-countertop-deck" as const }),
	    } : {}),
	  };
}

/** Default visual-planning sink created with a required sink base. */
export function makeDefaultSinkForCabinet(
  cabinet: PlacedCabinet,
  room: RoomData,
  type: SinkType = cabinet.width >= 33 ? "double" : "single",
): SinkFixture {
  return { ...makeSinkForCabinet(type, cabinet, room), faucet: true };
}

/** Repairs legacy sink fixtures so their plan footprint matches the owning sink-base wall. */
export function normalizeSinkFixturesToBases(
  sinks: SinkFixture[],
  placed: PlacedCabinet[],
  room: RoomData,
): SinkFixture[] {
  let changed = false;
  const normalized = sinks.map((sink) => {
    const owner = placed.find((cabinet) => cabinet.uid === sink.cabinetUid && isSinkBaseCabinet(cabinet))
      ?? placed.find((cabinet) => isSinkBaseCabinet(cabinet) && fixtureIsOnCabinetFootprint(sink, cabinet));
    if (!owner) return sink;
    const sourceWidth = sink.sourceWidth ?? sink.width;
    const sourceDepth = sink.sourceDepth ?? sink.depth;
    const next = makeSinkForCabinet(
      sink.type,
      owner,
      room,
      { width: sourceWidth, depth: sourceDepth },
      { frontSetbackIn: sink.frontSetbackIn },
    );
    const nextDeckConflict = sink.faucet ? next.faucetDeckConflict : undefined;
    const same = sink.x === next.x && sink.y === next.y && sink.width === next.width && sink.depth === next.depth && sink.wallSide === next.wallSide && sink.planRotation === next.planRotation && sink.sourceWidth === next.sourceWidth && sink.sourceDepth === next.sourceDepth && sink.cabinetUid === next.cabinetUid && sink.frontSetbackIn === next.frontSetbackIn && sink.faucetRearDeckOffsetIn === next.faucetRearDeckOffsetIn && sink.faucetDeckConflict === nextDeckConflict;
    if (same) return sink;
    changed = true;
    return {
      ...next,
      uid: sink.uid,
      faucet: sink.faucet,
      faucetDeckConflict: nextDeckConflict,
      pelicanProductId: sink.pelicanProductId,
      pelicanProductName: sink.pelicanProductName,
      pelicanProductImage: sink.pelicanProductImage,
      pelicanProfileId: sink.pelicanProfileId,
      bowlWidth: sink.bowlWidth,
      bowlDepth: sink.bowlDepth,
      bowlHeight: sink.bowlHeight,
      bowlCount: sink.bowlCount,
      bowlWidths: sink.bowlWidths,
      bowlDepths: sink.bowlDepths,
      bowlHeights: sink.bowlHeights,
      drainInsetRight: sink.drainInsetRight,
      drainInsetBack: sink.drainInsetBack,
      exteriorHeight: sink.exteriorHeight,
      apronFront: sink.apronFront,
      surfaceFinish: sink.surfaceFinish,
      pelicanFaucetProductId: sink.pelicanFaucetProductId,
      pelicanFaucetProductName: sink.pelicanFaucetProductName,
      pelicanFaucetProductImage: sink.pelicanFaucetProductImage,
      pelicanFaucetProfileId: sink.pelicanFaucetProfileId,
      faucetOverallHeight: sink.faucetOverallHeight,
      faucetSpoutLength: sink.faucetSpoutLength,
      faucetSpoutHeight: sink.faucetSpoutHeight,
      faucetFinish: sink.faucetFinish,
      faucetForm: sink.faucetForm,
    };
  });
  return changed ? normalized : sinks;
}

// ─── Corner-base conflict detection ──────────────────────────────────────────
// A standard base cabinet placed at a room corner (touching two walls) is only a
// layout problem when a DOOR / cased OPENING sits at that same corner — then the
// cabinet would block the door swing/access and a corner-specific cabinet
// (Blind Corner Base, Easy Reach, Lazy Susan, Corner Sink Base) or clearance is
// needed instead. When the corner is just solid WALL on both sides, a standard
// base in the corner is perfectly valid and must NOT be flagged.
//
// Detection: a base cabinet is "at a corner" when its footprint simultaneously
// touches two perpendicular room walls (within a 2" snap tolerance) AND at least
// one door/opening on either of those two walls reaches that corner.
//
// Exemptions:
//  - Cabinets that ARE corner types (BBC, CSB, ERB, LSB, UV-SBF, diagonal)
//  - Fillers, panels, accessories, appliances, wall/tall cabinets
//  - Island cabinets (they don't sit against room walls)
//  - Corners with no door/opening reaching them (solid wall = OK)
//
// `openingReach` is how close (inches) a door/opening edge must come to the
// corner to count as "at the corner".
//
// Returns the set of UIDs that should be flagged.
export function missingCornerBaseViolations(
  placed: PlacedCabinet[],
  room: RoomData,
  island?: { x: number; y: number; width: number; depth: number } | null,
  openings: WallOpening[] = [],
  tol = 2,
  openingReach = 2
): Set<string> {
  const violations = new Set<string>();

  // Does a door/cased opening reach the given end ("near" = wall start, "far" =
  // wall end) of the wall on `side`? Windows never block floor access, so only
  // doors and cased openings count.
  const openingAtWallEnd = (side: WallSide, end: "near" | "far"): boolean => {
    const len = wallLength(side, room);
    for (const o of openings) {
      if (o.side !== side) continue;
      if (o.kind !== "door" && o.kind !== "opening") continue;
      const start = o.offset;
      const finish = o.offset + o.width;
      if (end === "near" && start <= openingReach) return true;
      if (end === "far" && finish >= len - openingReach) return true;
    }
    return false;
  };

  for (const p of placed) {
    // Only base-placement cabinets can have this violation.
    if (p.placement !== "base") continue;
    // Skip island cabinets.
    if (island && isOnIsland(p, island)) continue;
    // Skip fillers, panels, accessories.
    if (!bearsCountertop(p)) continue;
    // Skip cabinets that ARE corner types — they are the correct solution.
    const code = (p.masterCode ?? "").toUpperCase();
    if (isCornerCabinet(code, p.description ?? undefined)) continue;
    if (isAngledWallCabinet(code, p.description ?? undefined)) continue;
    // UV-SBF (corner sink base filler) and similar specialty corner items.
    if (/^(UV-SBF|CSB|ERB|LSB|BBC)/.test(code)) continue;

    // Check if this cabinet touches two perpendicular walls simultaneously.
    const { w, d } = rotatedSize(p);
    const nearLeft   = p.x <= tol;
    const nearRight  = Math.abs(p.x + w - room.width) <= tol;
    const nearTop    = p.y <= tol;
    const nearBottom = Math.abs(p.y + d - room.depth) <= tol;

    // For each corner the cabinet occupies, only flag it when a door/opening
    // actually reaches that corner on either of the two forming walls. The
    // wall-start/end mapping: top/bottom run left→right (near=left corner),
    // left/right run top→bottom (near=top corner).
    let flag = false;
    if (nearTop && nearLeft) {
      if (openingAtWallEnd("top", "near") || openingAtWallEnd("left", "near")) flag = true;
    }
    if (nearTop && nearRight) {
      if (openingAtWallEnd("top", "far") || openingAtWallEnd("right", "near")) flag = true;
    }
    if (nearBottom && nearLeft) {
      if (openingAtWallEnd("bottom", "near") || openingAtWallEnd("left", "far")) flag = true;
    }
    if (nearBottom && nearRight) {
      if (openingAtWallEnd("bottom", "far") || openingAtWallEnd("right", "far")) flag = true;
    }

    if (flag) {
      violations.add(p.uid);
    }
  }

  return violations;
}

// ─── Gap Intelligence ────────────────────────────────────────────────────────
// Compute all gaps on every wall for a given placement layer, returning each
// gap with its run-axis start, length, center position, and wall side so the
// canvas can render a measurement label and fill-suggestion popover.
export type WallGap = {
  side: WallSide;
  layer: "base" | "wall";
  /** Run-axis start of the gap (inches from the wall's near corner). */
  start: number;
  /** Gap length in inches. */
  length: number;
  /** Run-axis center of the gap (for label placement). */
  center: number;
  /** True if the gap is exactly a standard cabinet width (9"–48" in 3" steps). */
  isStandardSize: boolean;
  /** True if the gap is small enough to be filled with a filler (≤ 6"). */
  isFillerSize: boolean;
};

export type WallGapFitPreview = {
  gap: WallGap;
  containsTarget: boolean;
  requiredSpan: number;
  availableSpan: number;
  shortage: number;
  snapStart: number;
  snapEnd: number;
  before: number;
  after: number;
  status: "valid" | "invalid";
};

export function nearestRectRoomWallAtPoint(room: Pick<RoomData, "width" | "depth" | "peninsulaRuns">, point: { x: number; y: number }): WallSide {
  const x = Math.max(0, Math.min(room.width, point.x));
  const y = Math.max(0, Math.min(room.depth, point.y));
  const terminatedRoom = room as RoomData;
  const topWall = cabinetWallRunSegment("top", terminatedRoom);
  const bottomWall = cabinetWallRunSegment("bottom", terminatedRoom);
  const leftWall = cabinetWallRunSegment("left", terminatedRoom);
  const rightWall = cabinetWallRunSegment("right", terminatedRoom);
  const topOpen = x < topWall.start - COLLISION_EPSILON_IN || x > topWall.start + topWall.length + COLLISION_EPSILON_IN;
  const bottomOpen = x < bottomWall.start - COLLISION_EPSILON_IN || x > bottomWall.start + bottomWall.length + COLLISION_EPSILON_IN;
  const leftOpen = y < leftWall.start - COLLISION_EPSILON_IN || y > leftWall.start + leftWall.length + COLLISION_EPSILON_IN;
  const rightOpen = y < rightWall.start - COLLISION_EPSILON_IN || y > rightWall.start + rightWall.length + COLLISION_EPSILON_IN;
  const distances: Array<{ side: WallSide; distance: number }> = [
    { side: "top", distance: topOpen ? Number.POSITIVE_INFINITY : y },
    { side: "bottom", distance: bottomOpen ? Number.POSITIVE_INFINITY : room.depth - y },
    { side: "left", distance: leftOpen ? Number.POSITIVE_INFINITY : x },
    { side: "right", distance: rightOpen ? Number.POSITIVE_INFINITY : room.width - x },
  ];
  return distances.reduce((best, candidate) => candidate.distance < best.distance ? candidate : best).side;
}

export function wallGapFitPreview(gaps: readonly WallGap[], targetAlong: number, requiredSpan: number): WallGapFitPreview | null {
  const width = Math.max(0, requiredSpan);
  if (gaps.length === 0 || width <= 0) return null;
  const distance = (gap: WallGap) => targetAlong < gap.start ? gap.start - targetAlong : targetAlong > gap.start + gap.length ? targetAlong - gap.start - gap.length : 0;
  const gap = gaps.reduce((best, candidate) => {
    const currentDistance = distance(candidate);
    const bestDistance = distance(best);
    if (currentDistance !== bestDistance) return currentDistance < bestDistance ? candidate : best;
    return Math.abs(candidate.center - targetAlong) < Math.abs(best.center - targetAlong) ? candidate : best;
  });
  const containsTarget = targetAlong >= gap.start - COLLISION_EPSILON_IN && targetAlong <= gap.start + gap.length + COLLISION_EPSILON_IN;
  const valid = containsTarget && gap.length + COLLISION_EPSILON_IN >= width;
  const snapStart = valid ? Math.max(gap.start, Math.min(targetAlong - width / 2, gap.start + gap.length - width)) : gap.start;
  const snapEnd = snapStart + width;
  return { gap, containsTarget, requiredSpan: width, availableSpan: gap.length, shortage: Math.max(0, width - gap.length), snapStart, snapEnd, before: Math.max(0, snapStart - gap.start), after: Math.max(0, gap.start + gap.length - snapEnd), status: valid ? "valid" : "invalid" };
}

const STANDARD_WIDTHS_GAP = [9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48];

export function wallGaps(
  room: RoomData,
  placed: PlacedCabinet[],
  openings: WallOpening[],
  /** Minimum gap size to report (default 1" — show every gap). */
  minLen = 1
): WallGap[] {
  // The 3D catalog drag preview uses this list to describe its highlighted
  // opening. Include every explicit continuous-wall segment as well as the
  // four rectangular-room sides so a DW-24 on a 45° builder wall sees the
  // exact same SB36/DB36 opening that Plan placement and collision checks use.
  const sides = Array.from(new Set<WallSide>([
    "top",
    "bottom",
    "left",
    "right",
    ...(room.customWalls ?? []).map((wall) => wall.id as WallSide),
  ]));
  const layers: Array<"base" | "wall"> = ["base", "wall"];
  const gaps: WallGap[] = [];
  for (const side of sides) {
    for (const layer of layers) {
      const segs = freeSegmentsOnWall(side, room, placed, openings, minLen, 0, layer);
      for (const seg of segs) {
        const len = seg.length;
        gaps.push({
          side,
          layer,
          start: seg.start,
          length: len,
          center: seg.start + len / 2,
          isStandardSize: STANDARD_WIDTHS_GAP.some((w) => Math.abs(w - len) < 0.5),
          isFillerSize: len <= 6,
        });
      }
    }
  }
  return gaps;
}

export interface CabinetWallDragPreview {
  wall: WallSide;
  fit: WallGapFitPreview;
  candidate: PlacedCabinet | null;
  /** True only when the pointer-near position was adjusted to an edge within 3 inches. */
  snapped: boolean;
  /** Proposed snap footprint used by the 3D ghost, including invalid targets. */
  ghostCandidate?: PlacedCabinet | null;
  /** Shift-held mode: exact pointer placement with edge attraction disabled. */
  freehand?: boolean;
}

export interface CabinetWallDragOptions {
  disableSnapping?: boolean;
}

export const RIGHT_DRAG_SNAP_THRESHOLD_IN = 3;

export function isRangeHoodPlacement(moving: Pick<PlacedCabinet, "placement" | "masterCode" | "description">): boolean {
  return moving.placement === "appliance"
    && (/^HOOD[-_]?/i.test(moving.masterCode ?? "") || /range\s+hood/i.test(moving.description ?? ""));
}

/**
 * Right-drag is available to cabinets, floor-seated appliances, and mounted
 * range hoods that occupy a wall run. Other raised appliances (OTR microwaves,
 * sinks, etc.) keep their specialized attachment rules and remain excluded.
 */
export function isWallRunDraggable(
  moving: PlacedCabinet,
  room: RoomData,
): boolean {
  if (moving.placement === "base" || moving.placement === "wall" || moving.placement === "tall") return true;
  if (isRangeHoodPlacement(moving)) return true;
  return moving.placement === "appliance"
    && elevationBox(moving, room).bottom <= COLLISION_EPSILON_IN;
}

/**
 * Resolve a right-button 3D drag along the item's existing wall. The object
 * follows the pointer at 1/8-inch precision while it remains inside a valid free
 * segment. Only an edge within three inches may pull the object into exact
 * contact. This prevents distant occupied-corner jumps while retaining exact
 * zero-overlap seams and bounded-opening placement.
 */
export function cabinetWallDragPreview(
  moving: PlacedCabinet,
  room: RoomData,
  others: PlacedCabinet[],
  openings: WallOpening[],
  targetAlong: number,
  options: CabinetWallDragOptions = {},
): CabinetWallDragPreview | null {
  if (!isWallRunDraggable(moving, room)) return null;
  const wall = cabinetWall(moving, room);
  const frame = wallRunFrame(wall, room);
  if (!frame) return null;
  // ONE run model for every wall: the cabinet's along-run span is its catalog
  // width (never a rotated screen envelope), the run is the frame's length, and
  // peers are measured by projecting their plan bodies onto the same frame.
  const requiredSpan = alongRunSpan(moving);
  const wallSpan = frame.length;
  const runProjection = (body: PlacedCabinet) => {
    const size = placedFootprint(body);
    const corners = [
      { x: body.x, y: body.y },
      { x: body.x + size.w, y: body.y },
      { x: body.x, y: body.y + size.d },
      { x: body.x + size.w, y: body.y + size.d },
    ];
    const along = corners.map((point) => wallRunAlongAtPoint(frame, point));
    const across = corners.map((point) => (point.x - frame.start.x) * frame.inward.x + (point.y - frame.start.y) * frame.inward.y);
    return { start: Math.min(...along), end: Math.max(...along), near: Math.min(...across), far: Math.max(...across) };
  };
  const crossOverlapOnRun = (a: PlacedCabinet, b: PlacedCabinet): number => {
    const pa = runProjection(a);
    const pb = runProjection(b);
    return Math.min(pa.far, pb.far) - Math.max(pa.near, pb.near);
  };
  const dragLayer: "base" | "wall" = moving.placement === "wall" || isRangeHoodPlacement(moving) ? "wall" : "base";
  const peers = others.filter((item) => item.uid !== moving.uid);
  const gaps = wallGaps(room, peers, openings, 0)
    .filter((gap) => gap.side === wall && gap.layer === dragLayer);
  const refrigeratorEnvelope = refrigeratorMagneticSnapEnvelope(moving, others, room);
  if (refrigeratorEnvelope.startExtensionIn > COLLISION_EPSILON_IN || refrigeratorEnvelope.endExtensionIn > COLLISION_EPSILON_IN) {
    // A right-drag preview has its own rich ghost/highlight behaviour, but a
    // refrigerator with selected panels must resolve against the exact same
    // exposed-panel edge as a Floor Plan drag.  Delegate this special physical
    // envelope to the one shared wall-move engine rather than letting the 3D
    // preview snap the refrigerator box through its panel.
    const memberUids = new Set(configuredRefrigeratorAssemblyMembers(others, moving, room)
      .map(({ member }) => member.uid));
    const refrigeratorPeers = others.filter((item) => item.uid !== moving.uid && !memberUids.has(item.uid));
    const requestedStart = Math.max(0, Math.min(Math.max(0, wallSpan - requiredSpan), Math.round((targetAlong - requiredSpan / 2) * 8) / 8));
    const requestedSpot = wallPlacementAt(requestedStart, requiredSpan, Number(moving.depth) || STD.BASE_DEPTH, wall, room);
    const resolved = cabinetWallMovePreview(
      { ...moving, ...requestedSpot, wallId: requestedSpot.wallId ?? wall, wallOffset: requestedSpot.wallOffset ?? requestedStart },
      { x: requestedSpot.x, y: requestedSpot.y },
      room,
      refrigeratorPeers,
      openings,
      {
        magnet: !options.disableSnapping,
        exact: options.disableSnapping === true,
        wallId: wall,
        seamToleranceIn: RIGHT_DRAG_SNAP_THRESHOLD_IN,
        magneticEnvelope: refrigeratorEnvelope,
      },
    );
    const candidate = resolved.candidate;
    const bodyStart = candidate ? wallRunOffset(candidate, wall, room) : requestedStart;
    const envelopeStart = bodyStart - refrigeratorEnvelope.startExtensionIn;
    const envelopeSpan = requiredSpan + refrigeratorEnvelope.startExtensionIn + refrigeratorEnvelope.endExtensionIn;
    const matchingGap = gaps.find((gap) => (
      envelopeStart >= gap.start - COLLISION_EPSILON_IN
      && envelopeStart + envelopeSpan <= gap.start + gap.length + COLLISION_EPSILON_IN
    )) ?? wallGapFitPreview(gaps, targetAlong - refrigeratorEnvelope.startExtensionIn, envelopeSpan)?.gap ?? {
      side: wall,
      layer: dragLayer,
      start: envelopeStart,
      length: 0,
      center: envelopeStart,
      isStandardSize: false,
      isFillerSize: false,
    };
    const fit: WallGapFitPreview = {
      gap: matchingGap,
      containsTarget: candidate != null,
      requiredSpan: envelopeSpan,
      availableSpan: matchingGap.length,
      shortage: Math.max(0, envelopeSpan - matchingGap.length),
      snapStart: bodyStart,
      snapEnd: bodyStart + requiredSpan,
      before: Math.max(0, envelopeStart - matchingGap.start),
      after: Math.max(0, matchingGap.start + matchingGap.length - envelopeStart - envelopeSpan),
      status: candidate ? "valid" : "invalid",
    };
    return {
      wall,
      fit,
      candidate,
      snapped: resolved.snapped,
      ghostCandidate: candidate,
      freehand: options.disableSnapping === true,
    };
  }
  const trueRoomCorner = requiresRoomCornerPlacement(moving);
  if (trueRoomCorner) {
    const roundedPointerStart = Math.round((targetAlong - requiredSpan / 2) * 8) / 8;
    const pointerStart = Math.max(0, Math.min(Math.max(0, wallSpan - requiredSpan), roundedPointerStart));
    const cornerStarts = [0, Math.max(0, wallSpan - requiredSpan)];
    const nearestCornerStart = cornerStarts.reduce((nearest, start) => (
      Math.abs(pointerStart - start) < Math.abs(pointerStart - nearest) ? start : nearest
    ));
	    const cornerDistance = Math.abs(pointerStart - nearestCornerStart);
	    const withinSnapRange = options.disableSnapping
	      ? cornerDistance <= COLLISION_EPSILON_IN
	      : cornerDistance <= RIGHT_DRAG_SNAP_THRESHOLD_IN + COLLISION_EPSILON_IN;
    const cornerSpot = wallPlacementAt(nearestCornerStart, requiredSpan, Number(moving.depth) || requiredSpan, wall, room);
    const unrotatedCornerCandidate = { ...moving, ...cornerSpot };
    const cornerCandidate = {
      ...unrotatedCornerCandidate,
      rotation: cornerRotationForPlaced(unrotatedCornerCandidate, room),
    };
    const fittingCornerGap = gaps.find((gap) => (
      nearestCornerStart >= gap.start - COLLISION_EPSILON_IN
      && nearestCornerStart + requiredSpan <= gap.start + gap.length + COLLISION_EPSILON_IN
    ));
    const cornerIsClear = Boolean(fittingCornerGap) && !hasCollision(cornerCandidate, peers);
    const gap: WallGap = fittingCornerGap ?? {
      side: wall,
      layer: dragLayer,
      start: nearestCornerStart,
      length: 0,
      center: nearestCornerStart,
      isStandardSize: false,
      isFillerSize: false,
    };
    const fit: WallGapFitPreview = {
      gap,
      containsTarget: withinSnapRange,
      requiredSpan,
      availableSpan: gap.length,
      shortage: Math.max(0, requiredSpan - gap.length),
      snapStart: nearestCornerStart,
      snapEnd: nearestCornerStart + requiredSpan,
      before: Math.max(0, nearestCornerStart - gap.start),
      after: Math.max(0, gap.start + gap.length - nearestCornerStart - requiredSpan),
      status: withinSnapRange && cornerIsClear ? "valid" : "invalid",
    };
    return {
      wall,
      fit,
	      candidate: withinSnapRange && cornerIsClear ? cornerCandidate : null,
	      snapped: !options.disableSnapping && withinSnapRange,
	      ghostCandidate: cornerCandidate,
	      freehand: options.disableSnapping === true,
	    };
  }
  const initialFit = wallGapFitPreview(gaps, targetAlong, requiredSpan);
  if (!initialFit) return null;
  const depth = Number(moving.depth) || (moving.placement === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH);
  const candidateAtStart = (start: number): PlacedCabinet => {
    const spot = wallPlacementAt(start, requiredSpan, depth, wall, room);
	    // Carry the measured wall's rotation and authoritative run metadata into
	    // the candidate. Keeping the stale pre-drag x/y-only transform makes a
	    // visually valid W3042-to-WDC2442 seam fail collision after the snap.
	    return { ...moving, ...spot };
  };
  const roundedPointerStart = Math.round((targetAlong - requiredSpan / 2) * 8) / 8;
  const pointerStart = Math.max(0, Math.min(Math.max(0, wallSpan - requiredSpan), roundedPointerStart));
  const fittingGaps = gaps.filter((gap) => gap.length + COLLISION_EPSILON_IN >= requiredSpan);
  const pointerGap = fittingGaps.find((gap) => (
    pointerStart >= gap.start - COLLISION_EPSILON_IN
    && pointerStart + requiredSpan <= gap.start + gap.length + COLLISION_EPSILON_IN
  ));
  const gapEdgeCandidates = fittingGaps.flatMap((gap) => {
    const trailingStart = gap.start + gap.length - requiredSpan;
    return [gap.start, trailingStart].map((start) => ({ gap, start, distance: Math.abs(pointerStart - start) }));
  });
  // A corner item can be oriented to the perpendicular wall and therefore be
  // absent from this wall's free-segment list even though its physical footprint
  // occupies the corner. Its actual plan edges remain valid seam targets.
	  const physicalEdgeCandidates = peers.flatMap((peer) => {
    if (!sharesPlanCollisionZone(moving, peer)) return [];
    const candidateCross = candidateAtStart(pointerStart);
    if (crossOverlapOnRun(candidateCross, peer) <= COLLISION_EPSILON_IN) return [];
    const peerRun = runProjection(peer);
    const peerStart = peerRun.start;
    const peerEnd = peerRun.end;
    const currentGapEnd = initialFit.gap.start + initialFit.gap.length;
    const beforeGapEnd = Math.min(currentGapEnd, peerStart);
    const afterGapStart = Math.max(initialFit.gap.start, peerEnd);
    return [
      {
        gap: { ...initialFit.gap, length: Math.max(0, beforeGapEnd - initialFit.gap.start), center: initialFit.gap.start + Math.max(0, beforeGapEnd - initialFit.gap.start) / 2 },
        start: peerStart - requiredSpan,
      },
      {
        gap: { ...initialFit.gap, start: afterGapStart, length: Math.max(0, currentGapEnd - afterGapStart), center: afterGapStart + Math.max(0, currentGapEnd - afterGapStart) / 2 },
        start: peerEnd,
      },
    ].map((entry) => ({ ...entry, distance: Math.abs(pointerStart - entry.start) }));
	  });
	  const collidesOnThisRun = (candidate: PlacedCabinet): boolean => cabinetPlacementCollisionDetail(candidate, peers, room) !== null;
		  const edgeCandidates = (options.disableSnapping ? [] : [...gapEdgeCandidates, ...physicalEdgeCandidates])
    .filter((entry) => entry.start >= -COLLISION_EPSILON_IN && entry.start + requiredSpan <= wallSpan + COLLISION_EPSILON_IN)
    .filter((entry) => entry.distance <= RIGHT_DRAG_SNAP_THRESHOLD_IN + COLLISION_EPSILON_IN)
    .filter((entry) => !collidesOnThisRun(snapCabinetSeamOverlap(candidateAtStart(entry.start), peers, undefined, room)))
    .sort((left, right) => left.distance - right.distance || left.start - right.start);
  const edgeSnap = edgeCandidates[0] ?? null;
  const snapStart = edgeSnap ? edgeSnap.start : pointerGap ? pointerStart : null;
  const ghostStart = snapStart ?? pointerStart;
  const snapEnd = ghostStart + requiredSpan;
  const ghostCandidate = candidateAtStart(ghostStart);
  const baseGap = edgeSnap?.gap ?? pointerGap ?? initialFit.gap;
  let boundedStart = baseGap.start;
  let boundedEnd = baseGap.start + baseGap.length;
  for (const peer of peers) {
    if (!sharesPlanCollisionZone(moving, peer)) continue;
    if (crossOverlapOnRun(ghostCandidate, peer) <= COLLISION_EPSILON_IN) continue;
    const peerRun = runProjection(peer);
    const peerStart = peerRun.start;
    const peerEnd = peerRun.end;
    if (peerEnd <= ghostStart + COLLISION_EPSILON_IN) boundedStart = Math.max(boundedStart, peerEnd);
    if (peerStart >= snapEnd - COLLISION_EPSILON_IN) boundedEnd = Math.min(boundedEnd, peerStart);
  }
  const chosenGap: WallGap = {
    ...baseGap,
    start: boundedStart,
    length: Math.max(0, boundedEnd - boundedStart),
    center: boundedStart + Math.max(0, boundedEnd - boundedStart) / 2,
  };
  const fit: WallGapFitPreview = {
    ...initialFit,
    gap: chosenGap,
    containsTarget: pointerGap != null || edgeSnap != null,
    availableSpan: chosenGap.length,
    shortage: Math.max(0, requiredSpan - chosenGap.length),
    snapStart: ghostStart,
    snapEnd,
    before: Math.max(0, ghostStart - chosenGap.start),
    after: Math.max(0, chosenGap.start + chosenGap.length - snapEnd),
    status: snapStart == null ? "invalid" : "valid",
  };
  if (snapStart == null) return { wall, fit, candidate: null, snapped: false, ghostCandidate };
  const candidate = options.disableSnapping ? ghostCandidate : snapCabinetSeamOverlap(ghostCandidate, peers, undefined, room);
		  const validCandidate = collidesOnThisRun(candidate) ? null : candidate;
		  return { wall, fit, candidate: validCandidate, snapped: edgeSnap != null, ghostCandidate: candidate, freehand: options.disableSnapping === true };
}

/**
 * Catalog-drop fit at the exact pointer center. Unlike wallGapFitPreview this
 * never pulls to a gap edge. It remains valid only when the entire object fits
 * inside one measured opening, preserving the same zero-overlap blockers.
 */
export function wallGapFreehandPreview(
  gaps: WallGap[],
  targetAlong: number,
  requiredSpan: number,
): WallGapFitPreview | null {
  if (!Number.isFinite(targetAlong) || !Number.isFinite(requiredSpan) || requiredSpan <= 0 || gaps.length === 0) return null;
  const pointerStart = Math.round((targetAlong - requiredSpan / 2) * 8) / 8;
  const containing = gaps.find((gap) => pointerStart >= gap.start - COLLISION_EPSILON_IN && pointerStart + requiredSpan <= gap.start + gap.length + COLLISION_EPSILON_IN);
  const nearest = wallGapFitPreview(gaps, targetAlong, requiredSpan);
  const gap = containing ?? nearest?.gap;
  if (!gap) return null;
  const end = pointerStart + requiredSpan;
  return {
    gap,
    containsTarget: containing != null,
    requiredSpan,
    availableSpan: gap.length,
    shortage: Math.max(0, requiredSpan - gap.length),
    snapStart: pointerStart,
    snapEnd: end,
    before: Math.max(0, pointerStart - gap.start),
    after: Math.max(0, gap.start + gap.length - end),
    status: containing ? "valid" : "invalid",
  };
}

// Build a map of one representative REAL base cabinet per standard width from a
// palette pool. Prefers a plain base box over sink/specialty/corner units so a
// gap suggestion reads like a clean filler-run cabinet. Only widths in the
// [9, 48] standard range are considered. Pure + unit-testable; the Design Tool
// feeds this to the click-to-place gap popover.
export function gapFillCandidatesByWidth(
  pool: Pick<DesignCabinet, "masterCode" | "subCategory" | "width" | "isCornerCabinet">[]
): Map<number, (typeof pool)[number]> {
  const byWidth = new Map<number, (typeof pool)[number]>();
  const rank = (c: (typeof pool)[number]): number => {
    const code = (c.masterCode || "").toUpperCase();
    const sub = (c.subCategory || "").toLowerCase();
    if (c.isCornerCabinet === true || /corner|lazy susan|easy reach/.test(sub)) return 4;
    if (/vanity/.test(sub)) return 4;
    if (/sink/.test(sub) || code.startsWith("SB")) return 2;
    if (/specialty|blind|lazy|susan|trash|waste/.test(sub)) return 3;
    if (code.startsWith("B") || code.startsWith("DB") || sub.includes("base")) return 0;
    return 1;
  };
  for (const c of pool) {
    const w = Math.round(Number(c.width) || 0);
    if (w < 9 || w > 48) continue;
    const existing = byWidth.get(w);
    if (!existing || rank(c) < rank(existing)) byWidth.set(w, c);
  }
  return byWidth;
}

export type SmartGapRecommendation<T> =
  | { kind: "filler"; remaining: number }
  | { kind: "cabinet"; cabinet: T; remaining: number }
  | { kind: "cabinet-with-filler"; cabinet: T; remaining: number };

/**
 * Deterministic, catalog-scoped advice for a short active-wall run. The caller
 * supplies only available cabinets in the selected line/style, so the helper
 * cannot recommend a generic or unsellable cabinet. It intentionally produces
 * advice only; the user must click a suggested action to place anything.
 */
export function smartGapRecommendation<T extends Pick<DesignCabinet, "width">>(
  gap: Pick<WallGap, "length">,
  candidates: Map<number, T>,
  threshold = Number.POSITIVE_INFINITY,
): SmartGapRecommendation<T> | null {
  const length = Math.round(gap.length * 100) / 100;
  if (length <= 0 || length >= threshold) return null;
  if (length <= 6) return { kind: "filler", remaining: length };
  const widths = Array.from(candidates.keys()).filter((width) => width <= length + 0.01).sort((a, b) => b - a);
  const selectedWidth = widths[0];
  if (selectedWidth == null) return null;
  const cabinet = candidates.get(selectedWidth)!;
  const remaining = Math.round((length - selectedWidth) * 100) / 100;
  if (remaining > 0.01 && remaining <= 6) return { kind: "cabinet-with-filler", cabinet, remaining };
  return { kind: "cabinet", cabinet, remaining };
}

export type SmartGapCatalogOption<T> = { cabinet: T; remaining: number; needsFiller: boolean };

/** All fitting catalog choices for a selected active-wall gap, before filtering or ordering. */
export function smartGapCatalogOptions<T extends Pick<DesignCabinet, "masterCode" | "width">>(
  gap: Pick<WallGap, "length">,
  candidates: readonly T[],
  threshold = Number.POSITIVE_INFINITY,
): SmartGapCatalogOption<T>[] {
  const length = Math.round(gap.length * 100) / 100;
  if (length <= 6 || length >= threshold) return [];
  return candidates
    .map((cabinet) => ({ cabinet, width: Number(cabinet.width) || 0 }))
    .filter(({ width }) => width >= 9 && width <= length + 0.01)
    .map(({ cabinet, width }) => {
      const remaining = Math.round((length - width) * 100) / 100;
      return { cabinet, remaining, needsFiller: remaining > 0.01 && remaining <= 6 };
    })
    .sort((a, b) => Number(b.cabinet.width) - Number(a.cabinet.width) || a.cabinet.masterCode.localeCompare(b.cabinet.masterCode));
}

/** The one-action best fit for any selected empty space; never invents a SKU. */
export function bestFitCatalogOption<T extends Pick<DesignCabinet, "masterCode" | "width">>(gap: Pick<WallGap, "length">, candidates: readonly T[]): SmartGapCatalogOption<T> | null {
  return smartGapCatalogOptions(gap, candidates)[0] ?? null;
}

function cabinetFamilyPrefix(masterCode: string): string {
  return (masterCode.toUpperCase().match(/^[A-Z]+/)?.[0] ?? "").trim();
}

/**
 * Catalog-only smaller wall alternatives for a failed placement. Matching the
 * master-code family, height, and depth prevents a deep WR refrigerator upper
 * from being replaced with an unrelated standard-depth W cabinet. Every result
 * either fills the opening exactly or leaves at most one catalog-filler span.
 */
export function compatibleWallCabinetAlternatives<T extends Pick<DesignCabinet, "masterCode" | "width" | "height" | "depth" | "placement">>(
  requested: Pick<PlacedCabinet, "masterCode" | "width" | "height" | "depth" | "placement">,
  availableSpan: number,
  candidates: readonly T[],
): SmartGapCatalogOption<T>[] {
  if (requested.placement !== "wall" || availableSpan <= 0) return [];
  const family = cabinetFamilyPrefix(requested.masterCode);
  const requestedHeight = Number(requested.height) || 0;
  const requestedDepth = Number(requested.depth) || 0;
  const matching: T[] = candidates.flatMap<T>((candidate) => {
    if (candidate.placement !== "wall" || cabinetFamilyPrefix(candidate.masterCode) !== family) return [];
    const skuDimensions = wallCabinetSkuDimensions(candidate.masterCode);
    const width = skuDimensions?.width ?? (Number(candidate.width) || 0);
    const height = skuDimensions?.height ?? (Number(candidate.height) || 0);
    const depth = skuDimensions?.depth ?? (Number(candidate.depth) || 0);
    const compatible = width > 0 && width < requested.width - COLLISION_EPSILON_IN &&
      Math.abs(height - requestedHeight) <= COLLISION_EPSILON_IN &&
      Math.abs(depth - requestedDepth) <= COLLISION_EPSILON_IN;
    return compatible ? [{ ...candidate, width: String(width), height: String(height), depth: String(depth) } as T] : [];
  });
  return smartGapCatalogOptions({ length: availableSpan }, matching, Number.POSITIVE_INFINITY).filter((option) => option.remaining <= 0.01 || option.remaining <= 6);
}

/** Preview layers are derived for rendering only and never mutate saved placements. */
export function withTemporarySmartGapPreview<T>(placed: readonly T[], preview: readonly T[]): T[] {
  return preview.length > 0 ? [...placed, ...preview] : [...placed];
}

/** Wrap-safe navigation for temporary Smart Gap previews. */
export function nextSmartGapPreviewIndex(currentIndex: number, optionCount: number, direction: -1 | 1): number {
  if (optionCount <= 1) return 0;
  return (currentIndex + direction + optionCount) % optionCount;
}

// ─── Dining Furniture ─────────────────────────────────────────────────────────
// Floor-plan-only space planning items (no pricing, no SKU, no elevation view).

export type FurnitureShape = "rect" | "round";

export interface FurnitureDef {
  id: string;
  name: string;
  category: "table" | "chair" | "stool" | "bench" | "other" | "bathroom-fixture" | "bathroom-zone";
  collection?: "classic" | "modern";
  shape: FurnitureShape;
  /** Width in inches (diameter for round items) */
  w: number;
  /** Depth in inches (same as w for round items) */
  d: number;
  /** Recommended clearance around the item in inches */
  clearance: number;
  color: string;
  /** Visual planning height in inches for generic modern props. */
  height?: number;
  /** Exact Pelican source code when this is a measured bathroom fixture. */
  pelicanCode?: string;
}

export const FURNITURE_CATALOG: FurnitureDef[] = [
  { id: "tbl-round-42",  name: "Round Table (4-person)",  category: "table", shape: "round", w: 42, d: 42, clearance: 36, color: "#d4a96a" },
  { id: "tbl-round-54",  name: "Round Table (6-person)",  category: "table", shape: "round", w: 54, d: 54, clearance: 36, color: "#d4a96a" },
  { id: "tbl-rect-4",    name: "Rect Table (4-person)",   category: "table", shape: "rect",  w: 60, d: 36, clearance: 36, color: "#d4a96a" },
  { id: "tbl-rect-6",    name: "Rect Table (6-person)",   category: "table", shape: "rect",  w: 72, d: 36, clearance: 36, color: "#d4a96a" },
  { id: "tbl-rect-8",    name: "Rect Table (8-person)",   category: "table", shape: "rect",  w: 84, d: 42, clearance: 36, color: "#d4a96a" },
  { id: "tbl-square-4",  name: "Square Table (4-person)", category: "table", shape: "rect",  w: 42, d: 42, clearance: 36, color: "#d4a96a" },
  { id: "chair-dining",  name: "Dining Chair",            category: "chair", shape: "rect",  w: 18, d: 20, clearance: 0,  color: "#8b7355" },
  { id: "chair-arm",     name: "Arm Chair",               category: "chair", shape: "rect",  w: 24, d: 24, clearance: 0,  color: "#8b7355" },
  { id: "stool-bar",     name: "Bar Stool",               category: "stool", shape: "round", w: 14, d: 14, clearance: 0,  color: "#6b5b45" },
  { id: "stool-counter", name: "Counter Stool",           category: "stool", shape: "round", w: 16, d: 16, clearance: 0,  color: "#6b5b45" },
  { id: "bench-48",      name: 'Bench 48"',               category: "bench", shape: "rect",  w: 48, d: 14, clearance: 0,  color: "#7a6a50" },
  { id: "bench-60",      name: 'Bench 60"',               category: "bench", shape: "rect",  w: 60, d: 14, clearance: 0,  color: "#7a6a50" },
  // Modern furniture props are visual planning items: movable, saveable, and rendered in plan/3D.
  { id: "modern-sofa-84",       name: 'Modern Sofa 84"',         category: "other", collection: "modern", shape: "rect",  w: 84, d: 36, clearance: 30, color: "#7f8790", height: 32 },
  { id: "modern-lounge-chair",  name: "Modern Lounge Chair",      category: "other", collection: "modern", shape: "rect",  w: 32, d: 34, clearance: 24, color: "#a88f78", height: 31 },
  { id: "modern-coffee-table",  name: "Modern Coffee Table",      category: "table", collection: "modern", shape: "rect",  w: 48, d: 24, clearance: 24, color: "#5c4637", height: 16 },
  { id: "modern-media-console", name: 'Modern Media Console 72"', category: "other", collection: "modern", shape: "rect",  w: 72, d: 18, clearance: 18, color: "#3f454c", height: 24 },
  { id: "modern-floor-lamp",    name: "Modern Floor Lamp",        category: "other", collection: "modern", shape: "round", w: 14, d: 14, clearance: 12, color: "#c09b58", height: 64 },
  { id: "modern-planter",       name: "Modern Planter",            category: "other", collection: "modern", shape: "round", w: 18, d: 18, clearance: 12, color: "#5b7b67", height: 24 },
  // Non-cartable, movable planning zones used only by the Bathroom starter.
  // These are intentionally not substitutes for actual source-priced fixtures.
  { id: "bathroom-zone-vanity-60", name: 'Vanity zone · 60"', category: "bathroom-zone", shape: "rect", w: 60, d: 24, clearance: 0, color: "#2f6690" },
  { id: "bathroom-zone-toilet", name: "Toilet zone", category: "bathroom-zone", shape: "rect", w: 30, d: 54, clearance: 0, color: "#79654d" },
  // Holds the complete source envelope for every supported 60-inch Pelican tub
  // after the placement helper orients its 60-inch length along this zone. It
  // remains a movable visual-planning zone, never an installation opening.
  { id: "bathroom-zone-tub-60", name: 'Tub zone · 60" × 36"', category: "bathroom-zone", shape: "rect", w: 60, d: 36, clearance: 0, color: "#5a879d" },
  ...VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES.map((profile): FurnitureDef => ({
    id: profile.id,
    name: profile.name,
    category: "bathroom-fixture",
    shape: "rect",
    w: profile.widthIn,
    d: profile.depthIn,
    clearance: 0,
    color: ["vitreous-china-matte-black", "matte-black"].includes(profile.finish) ? "#1b1b1b" : profile.finish === "brushed-gold" ? "#b79348" : ["chrome", "brushed-nickel"].includes(profile.finish) ? "#9ea7ad" : "#f4f5f2",
    pelicanCode: profile.pelicanCode,
  })),
];

export interface PlacedFurniture {
  uid: string;
  defId: string;
  x: number;
  y: number;
  rotation: number;
  /** Source catalog identity for a placed, price-locked Pelican bathroom fixture. */
  /** User-sized planning zone only; never a resize of a manufacturer product. */
  planningZoneSize?: { version: 1; widthIn: number; depthIn: number };
  pelicanCode?: string;
  pelicanProductId?: number;
  pelicanProductName?: string;
  pelicanCategory?: string;
  pelicanSellPrice?: number | null;
  pelicanGeometrySource?: { version: 1; mounting: "floor"; footprintBasis: "illustrative-occupancy"; specificationUrl: string };
}

export function makeFurniture(defId: string, x: number, y: number): PlacedFurniture {
  return {
    uid: `furn-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    defId,
    x,
    y,
    rotation: 0,
  };
}

/**
 * Persist a price-locked, source-measured Pelican bathroom fixture as a movable
 * floor-plan fixture. Image-only catalog rows, including the 67-inch
 * freestanding variants, cannot become 3D geometry until Pelican publishes a
 * full width × depth × height technical sheet.
 */
export function makePelicanBathroomFixture(
  product: { id: number; pelicanCode?: string | null; name: string; category: string; sellPrice: number | null },
  x: number,
  y: number,
): PlacedFurniture | null {
  const profile = verifiedPelicanBathroomFixtureProfile(product.pelicanCode);
  if (!profile) return null;
  return {
    ...makeFurniture(profile.id, x, y),
    pelicanCode: profile.pelicanCode,
    pelicanProductId: product.id,
    pelicanProductName: product.name,
    pelicanCategory: product.category,
    pelicanSellPrice: product.sellPrice,
    ...(profile.mounting === "floor" ? { pelicanGeometrySource: { version: 1 as const, mounting: profile.mounting, footprintBasis: "illustrative-occupancy" as const, specificationUrl: profile.specificationUrl } } : {}),
  };
}

export function furnitureFootprint(f: PlacedFurniture, def: FurnitureDef): { w: number; d: number } {
  const size = resolvedFurnitureDimensions(f, def) ?? { w: def.w, d: def.d };
  if (def.shape === "round") return size;
  if (f.rotation === 90 || f.rotation === 270) return { w: size.d, d: size.w };
  return size;
}

/** Zone overrides are local to a placement and cannot alter actual product sizes. */
export function resolvedFurnitureDimensions(f: PlacedFurniture, definition?: FurnitureDef): { w: number; d: number } | null {
  const def = definition ?? FURNITURE_CATALOG.find((item) => item.id === f.defId);
  if (!def) return null;
  const size = f.planningZoneSize;
  if (def.category === "bathroom-zone" && size?.version === 1 && Number.isFinite(size.widthIn) && Number.isFinite(size.depthIn) && size.widthIn > 0 && size.depthIn > 0) {
    return { w: size.widthIn, d: size.depthIn };
  }
  return { w: def.w, d: def.d };
}

/** x/y locate the rotated bounding box; rotate the original local body once. */
export function furniturePlanFrame(f: PlacedFurniture) {
  const def = FURNITURE_CATALOG.find((item) => item.id === f.defId);
  const size = resolvedFurnitureDimensions(f, def);
  if (!def || !size) return null;
  const bounds = furnitureFootprint(f, def);
  return {
    width: size.w, depth: size.d, boundWidth: bounds.w, boundDepth: bounds.d,
    left: f.x + (bounds.w - size.w) / 2,
    top: f.y + (bounds.d - size.d) / 2,
    centerX: f.x + bounds.w / 2, centerY: f.y + bounds.d / 2,
    rotation: f.rotation,
  };
}

// ─── Plan Annotations (text notes) ──────────────────────────────────────────
// User-placed text labels on the floor plan. They carry position (inches from
// room origin) and a short text string. Persisted in the draft.
export interface PlanAnnotation {
  uid: string;
  x: number; // inches from left edge of room
  y: number; // inches from top edge of room
  text: string;
}

export function makeAnnotation(x: number, y: number, text: string): PlanAnnotation {
  return { uid: crypto.randomUUID(), x, y, text };
}

// ─── Backsplash Materials ─────────────────────────────────────────────────────
export interface BacksplashMaterial {
  id: string;
  name: string;
  /** CSS background for the backsplash area in elevation view */
  fill: string;
  /** Grout/outline color */
  grout: string;
  /** Tile pattern type for rendering hints */
  pattern: "solid" | "subway" | "hexagon" | "mosaic" | "large-format" | "herringbone";
}

export const BACKSPLASH_MATERIALS: BacksplashMaterial[] = [
  { id: "white-subway",     name: "White Subway Tile",    fill: "#f5f5f5", grout: "#c8c8c8", pattern: "subway" },
  { id: "gray-subway",      name: "Gray Subway Tile",     fill: "#b0b8c1", grout: "#8a9099", pattern: "subway" },
  { id: "marble-hex",       name: "Marble Hexagon",       fill: "#e8e8e8", grout: "#d0d0d0", pattern: "hexagon" },
  { id: "white-hex",        name: "White Hexagon",        fill: "#f0f0f0", grout: "#cccccc", pattern: "hexagon" },
  { id: "black-mosaic",     name: "Black Mosaic",         fill: "#2a2a2a", grout: "#444444", pattern: "mosaic" },
  { id: "blue-zellige",     name: "Blue Zellige",         fill: "#4a7fa5", grout: "#2d5f80", pattern: "mosaic" },
  { id: "terracotta",       name: "Terracotta",           fill: "#c0714a", grout: "#8a4e30", pattern: "large-format" },
  { id: "white-large",      name: "White Large Format",   fill: "#f8f8f8", grout: "#e0e0e0", pattern: "large-format" },
  { id: "herringbone-wood", name: "Wood Herringbone",     fill: "#b08050", grout: "#8a6038", pattern: "herringbone" },
  { id: "stainless",        name: "Stainless Steel",      fill: "#c0c4c8", grout: "#a0a4a8", pattern: "solid" },
  { id: "none",             name: "None (Painted Wall)",  fill: "#f0ece4", grout: "#f0ece4", pattern: "solid" },
];

export function backsplashMaterial(id: string | null | undefined): BacksplashMaterial {
  return BACKSPLASH_MATERIALS.find((m) => m.id === id) ?? BACKSPLASH_MATERIALS[0];
}

// ─── Flooring Materials ───────────────────────────────────────────────────────
export interface FlooringMaterial {
  id: string;
  name: string;
  /** Primary fill color for plan view */
  fill: string;
  /** Grout/joint color */
  grout: string;
  /** Pattern type for plan-view rendering */
  pattern: "hardwood" | "tile-grid" | "tile-diagonal" | "tile-stagger" | "herringbone" | "chevron" | "solid" | "plank";
  /** Plank/tile width in inches (for scale rendering) */
  tileW: number;
  /** Plank/tile height in inches */
  tileH: number;
}

export const FLOORING_MATERIALS: FlooringMaterial[] = [
  { id: "oak-hardwood",      name: "Oak Hardwood",         fill: "#c8a060", grout: "#a07840", pattern: "hardwood",     tileW: 3,  tileH: 36 },
  { id: "walnut-hardwood",   name: "Walnut Hardwood",      fill: "#7a5030", grout: "#5a3820", pattern: "hardwood",     tileW: 4,  tileH: 48 },
  { id: "white-oak",         name: "White Oak",            fill: "#d8c090", grout: "#b09060", pattern: "hardwood",     tileW: 5,  tileH: 48 },
  { id: "white-tile",        name: "White Ceramic Tile",   fill: "#f2f2f2", grout: "#d0d0d0", pattern: "tile-grid",    tileW: 12, tileH: 12 },
  { id: "gray-tile",         name: "Gray Porcelain Tile",  fill: "#b8bec4", grout: "#8a9099", pattern: "tile-grid",    tileW: 24, tileH: 24 },
  { id: "black-tile",        name: "Black Slate Tile",     fill: "#2a2e32", grout: "#444850", pattern: "tile-grid",    tileW: 12, tileH: 12 },
  { id: "herringbone-tile",  name: "Herringbone Tile",     fill: "#e0d8cc", grout: "#c0b8a8", pattern: "herringbone",  tileW: 4,  tileH: 12 },
  { id: "brick-lay-tile",    name: "Brick-Lay Porcelain",  fill: "#e8e0d8", grout: "#c0b8a8", pattern: "tile-stagger", tileW: 24, tileH: 12 },
  { id: "chevron-wood",      name: "Chevron Wood",         fill: "#b89060", grout: "#907040", pattern: "chevron",      tileW: 3,  tileH: 18 },
  { id: "luxury-vinyl",      name: "Luxury Vinyl Plank",   fill: "#c0a870", grout: "#a08050", pattern: "plank",        tileW: 7,  tileH: 48 },
  { id: "concrete",          name: "Polished Concrete",    fill: "#9a9ea2", grout: "#9a9ea2", pattern: "solid",        tileW: 24, tileH: 24 },
  { id: "none",              name: "No Flooring",          fill: "#f5f3ef", grout: "#f5f3ef", pattern: "solid",        tileW: 12, tileH: 12 },
];

export function flooringMaterial(id: string | null | undefined): FlooringMaterial {
  return FLOORING_MATERIALS.find((m) => m.id === id) ?? FLOORING_MATERIALS[10];
}

// ─── LVP Flooring Layout Patterns ─────────────────────────────────────────────
// When the user selects a plank/hardwood-type flooring, they can also choose
// how the planks are laid out. This affects the plan-view SVG tile rendering.
export type FlooringLayoutPattern = "random-stagger" | "third-offset" | "diagonal" | "herringbone";

export const FLOORING_LAYOUT_PATTERNS: { id: FlooringLayoutPattern; name: string; description: string }[] = [
  { id: "random-stagger", name: "Random Stagger", description: "Natural look, minimal waste" },
  { id: "third-offset", name: "1/3 Offset", description: "Clean geometric flow" },
  { id: "diagonal", name: "Diagonal", description: "45° angle, makes rooms feel larger" },
  { id: "herringbone", name: "Herringbone", description: "Classic V-shape zigzag" },
];

// ─── Pony Wall ────────────────────────────────────────────────────────────────
// A half-wall / peninsula divider placed freely on the floor plan.
// Height defaults to 34.5" (counter height) so base cabinets sit flush on top.
export type DrywallPonyWallTexture = "smooth" | "orange-peel" | "light-plaster";

export const DEFAULT_DRYWALL_PONY_WALL_COLOR = "#e7e1d5";

export const DRYWALL_PONY_WALL_TEXTURE_OPTIONS: Array<{
  id: DrywallPonyWallTexture;
  label: string;
  description: string;
  roughness: number;
}> = [
  { id: "smooth", label: "Smooth drywall", description: "Clean painted-wall finish", roughness: 0.78 },
  { id: "orange-peel", label: "Orange peel", description: "Fine sprayed wall texture", roughness: 0.9 },
  { id: "light-plaster", label: "Light plaster", description: "Subtle hand-troweled texture", roughness: 0.96 },
];

function validDrywallColor(value: string | null | undefined): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

/** Resolves legacy drywall walls safely and supplies a single Plan/3D appearance contract. */
export function drywallPonyWallAppearance(ponyWall: Pick<PonyWall, "drywallColor" | "drywallTexture">): {
  color: string;
  texture: DrywallPonyWallTexture;
  roughness: number;
} {
  const texture = DRYWALL_PONY_WALL_TEXTURE_OPTIONS.some((option) => option.id === ponyWall.drywallTexture)
    ? ponyWall.drywallTexture as DrywallPonyWallTexture
    : "smooth";
  const option = DRYWALL_PONY_WALL_TEXTURE_OPTIONS.find((candidate) => candidate.id === texture)!;
  return {
    color: validDrywallColor(ponyWall.drywallColor) ? ponyWall.drywallColor : DEFAULT_DRYWALL_PONY_WALL_COLOR,
    texture,
    roughness: option.roughness,
  };
}

/**
 * Reusable CSS paint-and-texture swatch for the edit dialog and Plan. This is
 * deliberately procedural rather than an image asset: the thumbnail updates
 * immediately for any chosen paint color and uses the same texture cue that
 * appears on the measured 2D pony wall.
 */
export function drywallPonyWallPreviewBackground(ponyWall: Pick<PonyWall, "drywallColor" | "drywallTexture">): string {
  const appearance = drywallPonyWallAppearance(ponyWall);
  if (appearance.texture === "orange-peel") {
    return `radial-gradient(circle at 2px 2px, rgba(78,70,59,0.15) 0 1px, transparent 1.4px), ${appearance.color}`;
  }
  if (appearance.texture === "light-plaster") {
    return `repeating-linear-gradient(135deg, rgba(78,70,59,0.12) 0 1px, transparent 1px 5px), ${appearance.color}`;
  }
  return appearance.color;
}

/**
 * Resolves the single paint finish shared by the physical room shell. Reusing
 * the pony-wall appearance contract guarantees the Apply to all walls action
 * cannot make Plan and 3D disagree about color or texture defaults.
 */
export function roomWallAppearance(room: Pick<RoomData, "wallAppearance"> | null | undefined): {
  color: string;
  texture: DrywallPonyWallTexture;
  roughness: number;
} {
  return drywallPonyWallAppearance({
    drywallColor: room?.wallAppearance?.color,
    drywallTexture: room?.wallAppearance?.texture,
  });
}

export interface PonyWall {
  uid: string;
  x: number;      // inches from room left
  y: number;      // inches from room top
  width: number;  // inches (horizontal span)
  depth: number;  // inches (wall thickness)
  height: number; // inches tall — default 34.5 (counter height)
  label?: string;
  /**
   * Optional live attachment to a peninsula endpoint. Attached pony walls are
   * evaluated from the peninsula's measured geometry on every render, so moving
   * the peninsula attachment or changing its length keeps the half wall snapped.
   */
  peninsulaRunId?: string;
  peninsulaEnd?: "start" | "end";
  /** A pony wall can continue straight or take the same locked 45° turn selected in the peninsula builder. */
  peninsulaTurn?: 0 | 45;
  peninsulaDirection?: PeninsulaDirection;
  /** A full-length drywall pony wall centered immediately behind the cabinet face of its peninsula run. */
  peninsulaPlacement?: "endpoint" | "behind-cabinets";
  /** Finish note used by the plan and 3D renderer; structural geometry remains a true pony wall. */
  finish?: "drywall";
  /** Customer-selected painted drywall color for a behind-cabinet peninsula wall. */
  drywallColor?: string;
  /** Customer-selected wall surface texture for a behind-cabinet peninsula wall. */
  drywallTexture?: DrywallPonyWallTexture;
  /** Legacy/free-standing pony walls may keep an explicit plan rotation. */
  rotation?: number;
  /** Wizard transaction that created this optional support or endpoint wall. */
  peninsulaWizardId?: string | null;
}

export interface PonyWallPlanFrame {
  start: { x: number; y: number };
  end: { x: number; y: number };
  radians: number;
  width: number;
  depth: number;
  height: number;
  attachedToPeninsula: boolean;
}

/**
 * Resolve the actual plan frame for both free-standing and peninsula-attached
 * pony walls. The persisted x/y fallback keeps older plans intact, while a
 * peninsula owner always wins for a new builder-created pony wall.
 */
export function ponyWallPlanFrame(
  ponyWall: PonyWall,
  room: Pick<RoomData, "width" | "depth" | "peninsulaRuns">,
): PonyWallPlanFrame {
  const run = ponyWall.peninsulaRunId
    ? room.peninsulaRuns?.find((candidate) => candidate.id === ponyWall.peninsulaRunId)
    : undefined;
  const width = Math.max(6, Number(ponyWall.width) || 6);
  const depth = Math.max(1, Number(ponyWall.depth) || 6);
  const height = Math.max(1, Number(ponyWall.height) || 34.5);
  if (!run) {
    const radians = ((Number(ponyWall.rotation) || 0) * Math.PI) / 180;
    const start = { x: Number(ponyWall.x) || 0, y: Number(ponyWall.y) || 0 };
    return {
      start,
      end: { x: start.x + Math.cos(radians) * width, y: start.y + Math.sin(radians) * width },
      radians,
      width,
      depth,
      height,
      attachedToPeninsula: false,
    };
  }
  const geometry = peninsulaRunEndpoints(run, room);
  const behindCabinets = ponyWall.peninsulaPlacement === "behind-cabinets";
  const leftNormal = { x: -Math.sin(geometry.radians), y: Math.cos(geometry.radians) };
  const cabinetFaceNormal = run.cabinetSide === "right"
    ? { x: -leftNormal.x, y: -leftNormal.y }
    : leftNormal;
  // The wall's cabinet-side edge meets the peninsula centerline exactly. This
  // keeps the drywall pony wall physically behind the selected cabinet face
  // instead of running through cabinet boxes on both sides of the line.
  const rawStart = behindCabinets
    ? geometry.start
    : ponyWall.peninsulaEnd === "start" ? geometry.start : geometry.end;
  const start = behindCabinets
    ? {
        x: rawStart.x - cabinetFaceNormal.x * depth / 2,
        y: rawStart.y - cabinetFaceNormal.y * depth / 2,
      }
    : rawStart;
  const turn = ponyWall.peninsulaTurn === 45 ? Math.PI / 4 : 0;
  const radians = geometry.radians + (turn === 0 ? 0 : ponyWall.peninsulaDirection === "left" ? -turn : turn);
  const resolvedWidth = behindCabinets ? Math.max(6, Number(run.length) || 6) : width;
  return {
    start,
    end: { x: start.x + Math.cos(radians) * resolvedWidth, y: start.y + Math.sin(radians) * resolvedWidth },
    radians,
    width: resolvedWidth,
    depth,
    height,
    attachedToPeninsula: true,
  };
}

export interface PonyWallMiteredFootprint {
  frame: PonyWallPlanFrame;
  /** Local plan points in perimeter order: start/left, start/right, end/right, end/left. */
  corners: Array<{ x: number; z: number }>;
  miteredStart: boolean;
  miteredEnd: boolean;
}

type PonyWallJoinAnchor = {
  endpoint: "start" | "end";
  point: { x: number; y: number };
};

const PONY_WALL_JOIN_TOLERANCE_IN = 0.125;

function ponyWallJoinAnchors(
  ponyWall: PonyWall,
  room: Pick<RoomData, "width" | "depth" | "peninsulaRuns">,
): PonyWallJoinAnchor[] {
  const run = ponyWall.peninsulaRunId
    ? room.peninsulaRuns?.find((candidate) => candidate.id === ponyWall.peninsulaRunId)
    : undefined;
  if (!run) return [];
  const endpoints = peninsulaRunEndpoints(run, room);
  if (ponyWall.peninsulaPlacement === "behind-cabinets") {
    return [
      { endpoint: "start", point: endpoints.start },
      { endpoint: "end", point: endpoints.end },
    ];
  }
  return [{
    endpoint: "start",
    point: ponyWall.peninsulaEnd === "start" ? endpoints.start : endpoints.end,
  }];
}

function crossPlan(left: { x: number; y: number }, right: { x: number; y: number }) {
  return left.x * right.y - left.y * right.x;
}

function planLineIntersection(
  origin: { x: number; y: number },
  direction: { x: number; y: number },
  otherOrigin: { x: number; y: number },
  otherDirection: { x: number; y: number },
) {
  const denominator = crossPlan(direction, otherDirection);
  if (Math.abs(denominator) <= 1e-6) return null;
  const offset = { x: otherOrigin.x - origin.x, y: otherOrigin.y - origin.y };
  const distance = crossPlan(offset, otherDirection) / denominator;
  return { x: origin.x + direction.x * distance, y: origin.y + direction.y * distance };
}

/**
 * Produces the exact miter footprint for a pony wall when it meets another
 * same-thickness, same-height peninsula wall. The joint plane bisects the two
 * wall directions, so both cut faces share the same physical edge instead of
 * leaving the triangular gap produced by two square-ended boxes.
 */
export function ponyWallMiteredFootprint(
  ponyWall: PonyWall,
  ponyWalls: PonyWall[],
  room: Pick<RoomData, "width" | "depth" | "peninsulaRuns">,
): PonyWallMiteredFootprint {
  const frame = ponyWallPlanFrame(ponyWall, room);
  const halfDepth = frame.depth / 2;
  let startNeg = 0;
  let startPos = 0;
  let endNeg = frame.width;
  let endPos = frame.width;
  let miteredStart = false;
  let miteredEnd = false;
  if (!frame.attachedToPeninsula) {
    return {
      frame,
      corners: [{ x: startNeg, z: -halfDepth }, { x: startPos, z: halfDepth }, { x: endPos, z: halfDepth }, { x: endNeg, z: -halfDepth }],
      miteredStart,
      miteredEnd,
    };
  }

  const tangent = { x: Math.cos(frame.radians), y: Math.sin(frame.radians) };
  const normal = { x: -tangent.y, y: tangent.x };
  const ownAnchors = ponyWallJoinAnchors(ponyWall, room);
  for (const anchor of ownAnchors) {
    const neighbor = ponyWalls.find((candidate) => {
      if (candidate.uid === ponyWall.uid) return false;
      const candidateFrame = ponyWallPlanFrame(candidate, room);
      if (!candidateFrame.attachedToPeninsula) return false;
      if (Math.abs(candidateFrame.depth - frame.depth) > PONY_WALL_JOIN_TOLERANCE_IN) return false;
      if (Math.abs(candidateFrame.height - frame.height) > PONY_WALL_JOIN_TOLERANCE_IN) return false;
      return ponyWallJoinAnchors(candidate, room).some((candidateAnchor) => (
        Math.hypot(candidateAnchor.point.x - anchor.point.x, candidateAnchor.point.y - anchor.point.y) <= PONY_WALL_JOIN_TOLERANCE_IN
      ));
    });
    if (!neighbor) continue;
    const neighborFrame = ponyWallPlanFrame(neighbor, room);
    const neighborAnchor = ponyWallJoinAnchors(neighbor, room).find((candidateAnchor) => (
      Math.hypot(candidateAnchor.point.x - anchor.point.x, candidateAnchor.point.y - anchor.point.y) <= PONY_WALL_JOIN_TOLERANCE_IN
    ));
    if (!neighborAnchor) continue;
    const neighborTangent = { x: Math.cos(neighborFrame.radians), y: Math.sin(neighborFrame.radians) };
    const incoming = anchor.endpoint === "end" ? tangent : { x: -tangent.x, y: -tangent.y };
    const outgoing = neighborAnchor.endpoint === "start" ? neighborTangent : { x: -neighborTangent.x, y: -neighborTangent.y };
    const bisectorLength = Math.hypot(incoming.x + outgoing.x, incoming.y + outgoing.y);
    if (bisectorLength <= 1e-6) continue;
    let seamDirection = { x: (incoming.x + outgoing.x) / bisectorLength, y: (incoming.y + outgoing.y) / bisectorLength };
    // Drywall pony walls sit behind their cabinet runs, so their centerlines are
    // deliberately offset at a turn. The miter must therefore start at the
    // shared cabinet-side vertex and finish at the *outer-face* intersection,
    // not at a generic centerline bisector. This gives both boards the same cut.
    if (ponyWall.peninsulaPlacement === "behind-cabinets" && neighbor.peninsulaPlacement === "behind-cabinets") {
      const ownCenterAtAnchor = {
        x: frame.start.x + tangent.x * (anchor.endpoint === "end" ? frame.width : 0),
        y: frame.start.y + tangent.y * (anchor.endpoint === "end" ? frame.width : 0),
      };
      const neighborCenterAtAnchor = {
        x: neighborFrame.start.x + neighborTangent.x * (neighborAnchor.endpoint === "end" ? neighborFrame.width : 0),
        y: neighborFrame.start.y + neighborTangent.y * (neighborAnchor.endpoint === "end" ? neighborFrame.width : 0),
      };
      const ownFaceNormal = {
        x: (anchor.point.x - ownCenterAtAnchor.x) / (frame.depth / 2),
        y: (anchor.point.y - ownCenterAtAnchor.y) / (frame.depth / 2),
      };
      const neighborFaceNormal = {
        x: (neighborAnchor.point.x - neighborCenterAtAnchor.x) / (neighborFrame.depth / 2),
        y: (neighborAnchor.point.y - neighborCenterAtAnchor.y) / (neighborFrame.depth / 2),
      };
      const outerJoin = planLineIntersection(
        { x: anchor.point.x - ownFaceNormal.x * frame.depth, y: anchor.point.y - ownFaceNormal.y * frame.depth },
        tangent,
        { x: neighborAnchor.point.x - neighborFaceNormal.x * neighborFrame.depth, y: neighborAnchor.point.y - neighborFaceNormal.y * neighborFrame.depth },
        neighborTangent,
      );
      if (outerJoin) {
        const seamLength = Math.hypot(outerJoin.x - anchor.point.x, outerJoin.y - anchor.point.y);
        if (seamLength > 1e-6) {
          seamDirection = {
            x: (outerJoin.x - anchor.point.x) / seamLength,
            y: (outerJoin.y - anchor.point.y) / seamLength,
          };
        }
      }
    }
    const denominator = crossPlan(tangent, seamDirection);
    if (Math.abs(denominator) <= 1e-6) continue;
    const jointLocalX = (anchor.point.x - frame.start.x) * tangent.x + (anchor.point.y - frame.start.y) * tangent.y;
    const jointLocalZ = (anchor.point.x - frame.start.x) * normal.x + (anchor.point.y - frame.start.y) * normal.y;
    const slope = -crossPlan(normal, seamDirection) / denominator;
    const at = (z: number) => jointLocalX + slope * (z - jointLocalZ);
    const neg = at(-halfDepth);
    const pos = at(halfDepth);
    if (![neg, pos].every(Number.isFinite) || Math.max(Math.abs(neg - jointLocalX), Math.abs(pos - jointLocalX)) > frame.depth * 6) continue;
    if (anchor.endpoint === "start") {
      startNeg = neg;
      startPos = pos;
      miteredStart = true;
    } else {
      endNeg = neg;
      endPos = pos;
      miteredEnd = true;
    }
  }
  return {
    frame,
    corners: [{ x: startNeg, z: -halfDepth }, { x: startPos, z: halfDepth }, { x: endPos, z: halfDepth }, { x: endNeg, z: -halfDepth }],
    miteredStart,
    miteredEnd,
  };
}

/** Creates a measured pony-wall continuation that stays snapped to a peninsula endpoint. */
export function makePeninsulaPonyWall(
  run: PeninsulaRun,
  room: Pick<RoomData, "width" | "depth" | "peninsulaRuns">,
  options: {
    width?: number;
    depth?: number;
    height?: number;
    turn?: 0 | 45;
    direction?: PeninsulaDirection;
    label?: string;
  } = {},
): PonyWall {
  const turn = options.turn === 45 ? 45 : 0;
  const direction = options.direction ?? "right";
  const anchor = peninsulaRunEndpoints(run, room).end;
  return {
    uid: `pw-peninsula-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    x: anchor.x,
    y: anchor.y,
    width: Math.max(6, Math.round((options.width ?? 36) * 8) / 8),
    depth: Math.max(1, Math.round((options.depth ?? 6) * 8) / 8),
    height: Math.max(1, Math.round((options.height ?? run.height) * 8) / 8),
    label: options.label ?? (turn === 45 ? `Pony wall · 45° ${direction} follow` : "Pony wall · peninsula follow"),
    peninsulaRunId: run.id,
    peninsulaEnd: "end",
    peninsulaTurn: turn,
    peninsulaDirection: direction,
  };
}

/**
 * Creates the optional half-height, drywall-finished pony wall directly behind
 * a peninsula cabinet run. Its visible length always resolves from the run, so
 * editing that run cannot leave a loose or mismatched divider in the room.
 */
export function makePeninsulaDrywallBackPonyWall(
  run: PeninsulaRun,
  room: Pick<RoomData, "width" | "depth" | "peninsulaRuns">,
  options: { depth?: number; height?: number; color?: string; texture?: DrywallPonyWallTexture } = {},
): PonyWall {
  const anchor = peninsulaRunEndpoints(run, room).start;
  const appearance = drywallPonyWallAppearance({ drywallColor: options.color, drywallTexture: options.texture });
  return {
    uid: `pw-peninsula-back-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    x: anchor.x,
    y: anchor.y,
    width: Math.max(6, Math.round((Number(run.length) || 6) * 8) / 8),
    depth: Math.max(1, Math.round((options.depth ?? 4.5) * 8) / 8),
    height: Math.max(1, Math.round((options.height ?? run.height) * 8) / 8),
    label: "Drywall pony wall · behind peninsula",
    peninsulaRunId: run.id,
    peninsulaEnd: "start",
    peninsulaTurn: 0,
    peninsulaDirection: run.direction,
    peninsulaPlacement: "behind-cabinets",
    finish: "drywall",
    drywallColor: appearance.color,
    drywallTexture: appearance.texture,
  };
}

/** A rotated/attached pony wall must remain inside the measured room outline. */
export function ponyWallFitsRoom(ponyWall: PonyWall, room: Pick<RoomData, "width" | "depth" | "peninsulaRuns">): boolean {
  const frame = ponyWallPlanFrame(ponyWall, room);
  const tangent = { x: Math.cos(frame.radians), y: Math.sin(frame.radians) };
  const normal = { x: -tangent.y, y: tangent.x };
  const halfDepth = frame.depth / 2;
  const corners = [
    { along: 0, side: -halfDepth },
    { along: 0, side: halfDepth },
    { along: frame.width, side: -halfDepth },
    { along: frame.width, side: halfDepth },
  ];
  return corners.every(({ along, side }) => {
    const x = frame.start.x + tangent.x * along + normal.x * side;
    const y = frame.start.y + tangent.y * along + normal.y * side;
    return x >= -COLLISION_EPSILON_IN && x <= room.width + COLLISION_EPSILON_IN && y >= -COLLISION_EPSILON_IN && y <= room.depth + COLLISION_EPSILON_IN;
  });
}

export function makePonyWall(room: RoomData): PonyWall {
  return {
    uid: `pw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    x: Math.max(6, room.width / 2 - 24),
    y: Math.max(6, room.depth / 2 - 3),
    width: Math.min(48, room.width - 12),
    depth: 6,
    height: 34.5,
  };
}

/** Clamp a pony wall so it stays inside the room bounds. */
export function clampPonyWall(pw: PonyWall, room: RoomData): PonyWall {
  const x = Math.max(0, Math.min(pw.x, room.width - pw.width));
  const y = Math.max(0, Math.min(pw.y, room.depth - pw.depth));
  return { ...pw, x, y };
}

/**
 * Explain why a Wizard cabinet could not be seated on a peninsula run: name the cabinet in the way at
 * the requested start and find the nearest start offset (inches along the run) where it does fit.
 */
export function explainPeninsulaSeatFailure(
  runId: WallSide,
  room: RoomData,
  placed: PlacedCabinet[],
  width: number,
  depth: number,
  placement: "base" | "appliance",
  range: { start: number; end: number },
  maxScanIn = 240,
): { blocker: PlacedCabinet | null; suggestedStart: number | null } {
  const probe = (offset: number): PlacedCabinet => {
    const spot = wallPlacementAt(offset, width, depth, runId, room);
    return {
      uid: "__seat_probe__", cabinetId: -1, masterCode: "PROBE", description: "probe", placement,
      x: spot.x, y: spot.y, width, depth, rotation: spot.rotation, wallId: spot.wallId,
      wallOffset: spot.wallOffset, peninsulaSide: spot.peninsulaSide,
    } as PlacedCabinet;
  };
  const blocker = cabinetPlacementCollisionDetail(probe(range.start), placed, room)?.cabinet ?? null;
  let best: number | null = null;
  for (let step = 0; step <= maxScanIn; step += 1) {
    for (const offset of step === 0 ? [range.start] : [range.start + step, range.start - step]) {
      if (offset < 0) continue;
      if (firstCollisionFreePeninsulaPlacement(runId, room, placed, width, depth, placement, { start: offset, end: offset })) {
        best = offset;
        break;
      }
    }
    if (best !== null) break;
  }
  return { blocker, suggestedStart: best };
}

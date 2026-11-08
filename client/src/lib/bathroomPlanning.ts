import {
  FURNITURE_CATALOG,
  furnitureFootprint,
  furniturePlanFrame,
  isSinkBaseCabinet,
  type PlacedCabinet,
  type PlacedFurniture,
  type RoomData,
  type SinkFixture,
} from "./design";
import { floorRectsOverlap, nearestClearFloorPosition, occupiedFloor, type FloorRect } from "./floorOccupancy";
import { isPelicanVanityFaucetSku } from "@shared/pelicanBathroomFixtures";
import { placeTubFiller } from "./tubFillerFloor";
import { isVanityFaucetProfileId, isVanitySinkProfileId } from "./pelicanFixtureProfiles";
import {
  verifiedPelicanBathroomFixtureProfile,
  type VerifiedPelicanBathroomFixtureProfile,
} from "./pelicanBathroomFixtureProfiles";

export type BathroomPlanningGuidance = {
  title: string;
  text: string;
  sourceUrl: string;
};

/**
 * Advisory planning notes based on NKBA's published bathroom-planning guide.
 * They do not replace locally applicable code, accessibility requirements, or
 * a supplier installation drawing, so the Designer never silently moves or
 * rejects a fixture based on them.
 */
export function bathroomPlanningGuidance(
  profile: Pick<VerifiedPelicanBathroomFixtureProfile, "kind" | "specificationUrl"> | null | undefined,
): BathroomPlanningGuidance | null {
  if (!profile) return null;
  if (profile.kind === "floor-tub-filler") return {
    title: "Floor-mounted tub filler · visual planning only",
    text: "Source height and spout reach are retained. The footprint, hose position, and tube details are illustrative—not mounting, plumbing, service clearance, or a verified spout-to-basin fit. Move and rotate beside the tub, then confirm the exact rough-in and installation with Pelican and your plumber.",
    sourceUrl: profile.specificationUrl,
  };
  if (profile.kind === "toilet" || profile.kind === "bidet") {
    return {
      title: "Toilet / bidet planning check",
      text: "Advisory: check at least 15 in. from the fixture centerline to each side obstruction and at least 21 in. clear in front; a 30 in. clear front space is NKBA’s recommended target. Confirm local code and accessibility requirements.",
      sourceUrl: "https://media.nkba.org/uploads/2022/05/Bath-Planning-Guidelines.pdf",
    };
  }
  if (profile.kind === "freestanding-tub" || profile.kind === "alcove-tub" || profile.kind === "tub-door") {
    return {
      title: "Tub access planning check",
      text: "Advisory: keep at least 21 in. clear at the access side and keep any door swing out of the fixture zone. Confirm the exact tub, deck, surround, drain, and local-code requirements before installation.",
      sourceUrl: "https://media.nkba.org/uploads/2022/05/Bath-Planning-Guidelines.pdf",
    };
  }
  if (profile.kind === "shower-door" || profile.kind === "shower-wall") {
    return {
      title: "Shower enclosure planning check",
      text: "Nominal visual envelope only. Verify the finished opening, wall condition, curb, hardware clearances, panel overlap, and installation requirements against Pelican’s technical sheet before ordering or installing.",
      sourceUrl: profile.specificationUrl,
    };
  }
  return null;
}

export type BathroomChecklistStep = {
  id: "vanity-base" | "vanity-basin" | "vanity-faucet" | "toilet" | "tub" | "shower";
  label: string;
  detail: string;
  complete: boolean;
  optional?: boolean;
};

/** Keep the physical center on a quarter turn; clamp only to the room boundary.
 * A turn that would intersect another floor footprint is refused. */
export function rotateBathroomFurniture(
  item: PlacedFurniture,
  room: Pick<RoomData, "width" | "depth">,
  peers?: { furniture?: readonly PlacedFurniture[]; cabinets?: readonly PlacedCabinet[] },
): PlacedFurniture {
  const def = FURNITURE_CATALOG.find((candidate) => candidate.id === item.defId);
  const rotation = ((item.rotation + 90) % 360 + 360) % 360;
  if (!def || def.category !== "bathroom-fixture") return { ...item, rotation };
  const before = furniturePlanFrame(item)!;
  const rotated = { ...item, rotation };
  const footprint = furnitureFootprint(rotated, def);
  const next = { ...rotated,
    x: Math.max(0, Math.min(before.centerX - footprint.w / 2, Math.max(0, room.width - footprint.w))),
    y: Math.max(0, Math.min(before.centerY - footprint.d / 2, Math.max(0, room.depth - footprint.d))),
  };
  const occupied = occupiedFloor(peers?.furniture ?? [], peers?.cabinets ?? [], item.uid);
  const body = { uid: item.uid, x: next.x, y: next.y, w: footprint.w, d: footprint.d, label: def.name };
  const fillerProfile = verifiedPelicanBathroomFixtureProfile(item.pelicanCode ?? def.pelicanCode);
  const mayShareTub = fillerProfile?.kind === "floor-tub-filler";
  const blocked = occupied.some((other) => {
    if (!floorRectsOverlap(body, other)) return false;
    if (!mayShareTub) return true;
    // A tub filler may turn while sharing the tub's floor envelope.
    const otherItem = (peers?.furniture ?? []).find((entry) => entry.uid === other.uid);
    const otherDef = FURNITURE_CATALOG.find((entry) => entry.id === otherItem?.defId);
    const otherProfile = verifiedPelicanBathroomFixtureProfile(otherItem?.pelicanCode ?? otherDef?.pelicanCode);
    return !(otherProfile?.kind === "freestanding-tub" || otherProfile?.kind === "alcove-tub");
  });
  if (blocked) return item;
  return next;
}

export function isBathroomTubFurniture(item: PlacedFurniture): boolean {
  const definition = FURNITURE_CATALOG.find((entry) => entry.id === item.defId);
  const profile = verifiedPelicanBathroomFixtureProfile(item.pelicanCode ?? definition?.pelicanCode);
  return profile?.kind === "freestanding-tub" || profile?.kind === "alcove-tub";
}

function tubFootprintFits(
  item: PlacedFurniture,
  room: Pick<RoomData, "width" | "depth">,
  occupied: readonly FloorRect[],
): boolean {
  const definition = FURNITURE_CATALOG.find((entry) => entry.id === item.defId);
  if (!definition) return false;
  const footprint = furnitureFootprint(item, definition);
  if (item.x < -0.01 || item.y < -0.01) return false;
  if (item.x + footprint.w > room.width + 0.01 || item.y + footprint.d > room.depth + 0.01) return false;
  const body: FloorRect = { uid: item.uid, x: item.x, y: item.y, w: footprint.w, d: footprint.d, label: definition.name };
  return !occupied.some((other) => floorRectsOverlap(body, other));
}

/**
 * The fixture browser selects one tub for the room. A later choice replaces
 * that tub at the same spot and drops any extras a previous click had added.
 * Nothing else on the floor is moved. A second tub is added only when the
 * caller explicitly asks for one, and only in a spot that is already clear.
 */
export function placeBathroomTubSelection(
  furniture: readonly PlacedFurniture[],
  draft: PlacedFurniture,
  room: Pick<RoomData, "width" | "depth">,
  cabinets: readonly PlacedCabinet[] = [],
  options: { addAnother?: boolean } = {},
): { furniture: PlacedFurniture[]; replaced: boolean } | null {
  const tubs = furniture.filter(isBathroomTubFurniture);
  const others = furniture.filter((item) => !isBathroomTubFurniture(item));
  if (tubs.length > 0 && !options.addAnother) {
    const current = tubs[0]!;
    const inPlace = { ...draft, uid: current.uid, x: current.x, y: current.y, rotation: current.rotation };
    const occupied = occupiedFloor(others, cabinets, inPlace.uid);
    if (tubFootprintFits(inPlace, room, occupied)) return { furniture: [...others, inPlace], replaced: true };
    const spot = bathroomFixtureFreePlacement(inPlace, others, room, cabinets);
    if (!spot) return null;
    return { furniture: [...others, { ...inPlace, ...spot }], replaced: true };
  }
  const spot = bathroomFixtureFreePlacement(draft, furniture, room, cabinets);
  if (!spot) return null;
  return { furniture: [...furniture, { ...draft, ...spot }], replaced: false };
}

/** Default long tub axis parallel to the nearest room wall, even without a fit. */
export function bathroomTubWallParallelPlacement(item: PlacedFurniture, room: Pick<RoomData, "width" | "depth">): PlacedFurniture {
  const def = FURNITURE_CATALOG.find((candidate) => candidate.id === item.defId);
  const profile = verifiedPelicanBathroomFixtureProfile(item.pelicanCode ?? def?.pelicanCode);
  if (!def || !profile || !["freestanding-tub", "alcove-tub"].includes(profile.kind)) return item;
  const before = furniturePlanFrame(item)!;
  const horizontalDistance = Math.min(before.centerY, Math.abs(room.depth - before.centerY));
  const verticalDistance = Math.min(before.centerX, Math.abs(room.width - before.centerX));
  const rotation = horizontalDistance <= verticalDistance ? 90 : 0;
  const candidate = { ...item, rotation };
  const bounds = furnitureFootprint(candidate, def);
  return { ...candidate, x: Math.max(0, Math.min(before.centerX - bounds.w / 2, room.width - bounds.w)), y: Math.max(0, Math.min(before.centerY - bounds.d / 2, room.depth - bounds.d)) };
}

/**
 * Places a source-measured fixture in the nearest open spot. The footprint is
 * the supplier width × depth. It may touch another floor item and may not
 * intersect a fixture, vanity, tall cabinet, or other floor body. There are
 * no planning zones.
 */
export function bathroomFixtureFreePlacement(
  fixture: PlacedFurniture,
  furniture: readonly PlacedFurniture[],
  room: Pick<RoomData, "width" | "depth">,
  cabinets: readonly PlacedCabinet[] = [],
): { x: number; y: number; rotation: 0 | 90 | 180 | 270 } | null {
  const fixtureDefinition = FURNITURE_CATALOG.find((item) => item.id === fixture.defId);
  if (!fixtureDefinition) return null;
  const occupied = occupiedFloor(furniture, cabinets, fixture.uid);
  let best: { x: number; y: number; rotation: 0 | 90 | 180 | 270; distance: number } | null = null;
  const prefer = { x: room.width / 2, y: room.depth / 2 };
  for (const rotation of [0, 90, 180, 270] as const) {
    const candidate = { ...fixture, rotation };
    const footprint = furnitureFootprint(candidate, fixtureDefinition);
    const position = nearestClearFloorPosition(footprint, occupied, room);
    if (!position) continue;
    const distance = (position.x + footprint.w / 2 - prefer.x) ** 2 + (position.y + footprint.d / 2 - prefer.y) ** 2;
    if (!best || distance < best.distance - 1e-6) best = { ...position, rotation, distance };
  }
  return best ? { x: best.x, y: best.y, rotation: best.rotation } : null;
}

/** Tub fillers follow their own floor-space rule in `lib/tubFillerFloor`. */
export { tubFillerSpoutTip, tubFillerSpoutReachIn, isTubFillerFurniture, isTubFurniture } from "./tubFillerFloor";

/**
 * Place a floor-mounted tub filler so its spout reaches the tub.
 * The rule lives in `lib/tubFillerFloor`; this is the bathroom-planning entry.
 */
export function bathroomTubFillerPlacement(
  filler: PlacedFurniture,
  furniture: readonly PlacedFurniture[],
  room: Pick<RoomData, "width" | "depth">,
  cabinets: readonly PlacedCabinet[] = [],
): PlacedFurniture | null {
  return placeTubFiller(filler, furniture, room, occupiedFloor(furniture, cabinets, filler.uid));
}

/** A compact, non-blocking guide for a Bathroom plan. */
export function bathroomFixtureChecklist(input: {
  cabinets: readonly Pick<PlacedCabinet, "description" | "masterCode" | "subCategory">[];
  sinks: readonly Pick<SinkFixture, "pelicanProfileId" | "pelicanFaucetProfileId">[];
  selectedSurfaceCodes: readonly (string | null | undefined)[];
  furniture: readonly PlacedFurniture[];
}): BathroomChecklistStep[] {
  const placedKinds = input.furniture.flatMap((item) => {
    const definition = FURNITURE_CATALOG.find((candidate) => candidate.id === item.defId);
    const profile = verifiedPelicanBathroomFixtureProfile(item.pelicanCode ?? definition?.pelicanCode);
    return profile ? [profile.kind] : [];
  });
  // Sink fixtures persist their verified profile ID, whereas material rows retain
  // the source code. Both are resolved through the same catalog the pickers use,
  // so a basin or faucet this checklist counts is exactly one the picker offers.
  const hasVanityBasin = input.sinks.some((sink) => isVanitySinkProfileId(sink.pelicanProfileId ?? ""));
  const hasVanityFaucet = input.sinks.some((sink) => isVanityFaucetProfileId(sink.pelicanFaucetProfileId ?? ""))
    || input.selectedSurfaceCodes.some((code) => isPelicanVanityFaucetSku(code));
  return [
    { id: "vanity-base", label: "Place a vanity sink base", detail: "Choose a bathroom vanity cabinet sized for the wall.", complete: input.cabinets.some(isSinkBaseCabinet) },
    { id: "vanity-basin", label: "Choose a Pelican vanity basin", detail: "Install it through the compatible vanity base.", complete: hasVanityBasin },
    { id: "vanity-faucet", label: "Choose a Pelican vanity faucet", detail: "Confirm the faucet with the selected basin and vanity top.", complete: hasVanityFaucet },
    { id: "toilet", label: "Place a toilet or bidet", detail: "Drop it anywhere on the plan and review the advisory clearance note.", complete: placedKinds.some((kind) => kind === "toilet" || kind === "bidet") },
    { id: "tub", label: "Place a tub", detail: "Use a source-measured Pelican tub envelope for visual planning.", complete: placedKinds.some((kind) => kind === "freestanding-tub" || kind === "alcove-tub") },
    { id: "shower", label: "Add a shower door or wall, if needed", detail: "Pelican enclosure graphics are visual planning envelopes; verify the technical sheet before ordering.", complete: placedKinds.some((kind) => kind === "shower-door" || kind === "tub-door" || kind === "shower-wall"), optional: true },
  ];
}

export const BATHROOM_STARTER_TEMPLATE = {
  id: "bathroom-blank-10x8-v1",
  label: "Bathroom starter · empty 10 ft × 8 ft room",
  description: "Starts a blank 10 ft × 8 ft bathroom plan. Add cabinets, a vanity, or source-priced Pelican fixtures yourself; no zones or placeholder shapes are added.",
  room: { width: 120, depth: 96, ceilingHeight: 96 } satisfies RoomData,
} as const;

/** Starts a blank bathroom room. Every item is added by the user and moves freely. */
export function makeBathroomStarterTemplate(): { room: RoomData; furniture: PlacedFurniture[] } {
  return {
    room: { ...BATHROOM_STARTER_TEMPLATE.room },
    furniture: [],
  };
}

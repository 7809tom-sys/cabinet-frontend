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
import { floorRectsOverlap, nearestClearFloorPosition, occupiedFloor } from "./floorOccupancy";
import { isPelicanVanityFaucetSku } from "@shared/pelicanBathroomFixtures";
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
  if (occupied.some((other) => floorRectsOverlap(body, other))) return item;
  return next;
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

/** Returns a non-overlapping illustrative filler position beside the latest tub.
 * The 14-inch occupancy is NOT a manufacturer clearance or verified reach.
 * If no candidate fits, do not silently commit a filler inside the tub or on
 * another floor footprint. */
export function bathroomTubFillerPlacement(
  filler: PlacedFurniture,
  furniture: readonly PlacedFurniture[],
  room: Pick<RoomData, "width" | "depth">,
  cabinets: readonly PlacedCabinet[] = [],
): PlacedFurniture | null {
  const def = FURNITURE_CATALOG.find((entry) => entry.id === filler.defId);
  const profile = verifiedPelicanBathroomFixtureProfile(filler.pelicanCode ?? def?.pelicanCode);
  if (!def || profile?.kind !== "floor-tub-filler") return null;
  const occupied = occupiedFloor(furniture, cabinets, filler.uid);
  const tub = [...furniture].reverse().map((item) => {
    const definition = FURNITURE_CATALOG.find((entry) => entry.id === item.defId);
    const itemProfile = verifiedPelicanBathroomFixtureProfile(item.pelicanCode ?? definition?.pelicanCode);
    const rect = occupied.find((body) => body.uid === item.uid);
    return rect && (itemProfile?.kind === "freestanding-tub" || itemProfile?.kind === "alcove-tub") ? rect : null;
  }).find((entry): entry is NonNullable<typeof entry> => entry != null);
  const w = def.w, d = def.d;
  const candidates = tub ? [
    { x: tub.x + (tub.w - w) / 2, y: tub.y - d, rotation: 180 as const },
    { x: tub.x + (tub.w - w) / 2, y: tub.y + tub.d, rotation: 0 as const },
    { x: tub.x - w, y: tub.y + (tub.d - d) / 2, rotation: 90 as const },
    { x: tub.x + tub.w, y: tub.y + (tub.d - d) / 2, rotation: 270 as const },
  ] : [{ x: (room.width - w) / 2, y: (room.depth - d) / 2, rotation: 0 as const }];
  const candidate = candidates.find((position) => position.x >= -0.01 && position.y >= -0.01
    && position.x + w <= room.width + 0.01 && position.y + d <= room.depth + 0.01
    && !occupied.some((body) => floorRectsOverlap({ uid: filler.uid, ...position, w, d, label: "" }, body)));
  if (candidate) return { ...filler, x: Math.max(0, candidate.x), y: Math.max(0, candidate.y), rotation: candidate.rotation };
  const fallback = nearestClearFloorPosition({ w, d }, occupied, room);
  return fallback ? { ...filler, ...fallback, rotation: 0 } : null;
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

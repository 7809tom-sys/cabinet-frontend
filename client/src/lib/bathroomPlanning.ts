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

/** Keep the physical center on a quarter turn; clamp only to the room boundary. */
export function rotateBathroomFurniture(item: PlacedFurniture, room: Pick<RoomData, "width" | "depth">): PlacedFurniture {
  const def = FURNITURE_CATALOG.find((candidate) => candidate.id === item.defId);
  const rotation = ((item.rotation + 90) % 360 + 360) % 360;
  if (!def || def.category !== "bathroom-fixture") return { ...item, rotation };
  const before = furniturePlanFrame(item)!;
  const rotated = { ...item, rotation };
  const footprint = furnitureFootprint(rotated, def);
  return { ...rotated,
    x: Math.max(0, Math.min(before.centerX - footprint.w / 2, Math.max(0, room.width - footprint.w))),
    y: Math.max(0, Math.min(before.centerY - footprint.d / 2, Math.max(0, room.depth - footprint.d))),
  };
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
 * Places a source-measured fixture in an open spot: the first rotation whose
 * envelope fits the room without overlapping another fixture. There are no
 * planning zones; every fixture moves freely.
 */
export function bathroomFixtureFreePlacement(
  fixture: PlacedFurniture,
  furniture: readonly PlacedFurniture[],
  room: Pick<RoomData, "width" | "depth">,
): { x: number; y: number; rotation: 0 | 90 | 180 | 270 } | null {
  const fixtureDefinition = FURNITURE_CATALOG.find((item) => item.id === fixture.defId);
  if (!fixtureDefinition) return null;
  const occupied = furniture.flatMap((item) => {
    const definition = FURNITURE_CATALOG.find((candidate) => candidate.id === item.defId);
    if (!definition) return [];
    const footprint = furnitureFootprint(item, definition);
    return [{ x: item.x, y: item.y, w: footprint.w, d: footprint.d }];
  });
  for (const rotation of [0, 90, 180, 270] as const) {
    const candidate = { ...fixture, rotation };
    const footprint = furnitureFootprint(candidate, fixtureDefinition);
    if (footprint.w > room.width + 0.01 || footprint.d > room.depth + 0.01) continue;
    const centered = {
      x: Math.max(0, (room.width - footprint.w) / 2),
      y: Math.max(0, (room.depth - footprint.d) / 2),
      w: footprint.w,
      d: footprint.d,
    };
    if (!occupied.some((body) => rectanglesOverlap(centered, body))) return { x: centered.x, y: centered.y, rotation };
    for (const position of freePositions(footprint, room)) {
      if (!occupied.some((body) => rectanglesOverlap({ ...position, w: footprint.w, d: footprint.d }, body))) {
        return { x: position.x, y: position.y, rotation };
      }
    }
  }
  return null;
}

/** Room corners and wall centers, in inches, as fallback open positions. */
function freePositions(footprint: { w: number; d: number }, room: Pick<RoomData, "width" | "depth">) {
  const maxX = Math.max(0, room.width - footprint.w);
  const maxY = Math.max(0, room.depth - footprint.d);
  return [
    { x: 0, y: 0 }, { x: maxX, y: 0 }, { x: 0, y: maxY }, { x: maxX, y: maxY },
    { x: (room.width - footprint.w) / 2, y: 0 }, { x: (room.width - footprint.w) / 2, y: maxY },
    { x: 0, y: (room.depth - footprint.d) / 2 }, { x: maxX, y: (room.depth - footprint.d) / 2 },
  ].map((position) => ({ x: Math.max(0, position.x), y: Math.max(0, position.y) }));
}

function rectanglesOverlap(
  a: { x: number; y: number; w: number; d: number },
  b: { x: number; y: number; w: number; d: number },
): boolean {
  const epsilon = 0.01;
  return a.x < b.x + b.w - epsilon
    && a.x + a.w > b.x + epsilon
    && a.y < b.y + b.d - epsilon
    && a.y + a.d > b.y + epsilon;
}

/** Returns a non-overlapping illustrative filler position beside the latest tub.
 * The 14-inch occupancy is NOT a manufacturer clearance or verified reach.
 * If no candidate fits, do not silently commit a filler inside the tub. */
export function bathroomTubFillerPlacement(filler: PlacedFurniture, furniture: readonly PlacedFurniture[], room: Pick<RoomData, "width" | "depth">): PlacedFurniture | null {
  const def = FURNITURE_CATALOG.find((entry) => entry.id === filler.defId);
  const profile = verifiedPelicanBathroomFixtureProfile(filler.pelicanCode ?? def?.pelicanCode);
  if (!def || profile?.kind !== "floor-tub-filler") return null;
  const occupied = furniture.flatMap((item) => {
    const definition = FURNITURE_CATALOG.find((entry) => entry.id === item.defId);
    if (!definition || definition.category !== "bathroom-fixture") return [];
    const footprint = furnitureFootprint(item, definition);
    return [{ item, profile: verifiedPelicanBathroomFixtureProfile(item.pelicanCode ?? definition.pelicanCode), x: item.x, y: item.y, ...footprint }];
  });
  const tub = [...occupied].reverse().find((entry) => entry.profile?.kind === "freestanding-tub" || entry.profile?.kind === "alcove-tub");
  const w = def.w, d = def.d;
  const candidates = tub ? [
    { x: tub.x + (tub.w - w) / 2, y: tub.y - d, rotation: 180 },
    { x: tub.x + (tub.w - w) / 2, y: tub.y + tub.d, rotation: 0 },
    { x: tub.x - w, y: tub.y + (tub.d - d) / 2, rotation: 90 },
    { x: tub.x + tub.w, y: tub.y + (tub.d - d) / 2, rotation: 270 },
  ] : [{ x: (room.width - w) / 2, y: (room.depth - d) / 2, rotation: 0 }];
  const candidate = candidates.find((position) => position.x >= 0 && position.y >= 0
    && position.x + w <= room.width && position.y + d <= room.depth
    && !occupied.some((body) => rectanglesOverlap({ ...position, w, d }, body)));
  return candidate ? { ...filler, ...candidate } : null;
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

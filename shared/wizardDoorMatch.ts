/**
 * Door-editor match. Stored colors are a suggestion only.
 * The owner picks the hex and the grain; that pick is what gets saved.
 * Nothing here auto-selects or auto-applies.
 *
 * Saved through the existing door style update:
 * renderHex (the hex), woodSpecies (which grain), grainDirection (orientation).
 * finishCategory, grainLightHex, and grainDarkHex are not on that update, so
 * they are not sent. Light and dark ends are computed for the card only.
 */
import manifest from "./fixtures/uscd-frameless/manifest.json";
import { resolveDoorColor, type DoorColorDecision, type DoorColorInput } from "./doorColorResolve";
import { isHickoryDoor } from "./shakerDoorBlueprint";

export type GrainOrientation = "horizontal" | "vertical";

export type FramelessGrain = {
  code: string;
  name: string;
  collection: string;
  /** Null when the manual says this door is a solid, with no grain. */
  orientation: GrainOrientation | null;
  hasGrain: boolean;
  /** Real door photo, when that file is in the repo. Not a DL stand-in. */
  photoUrl: string | null;
};

type ManifestStyle = {
  code: string;
  name: string;
  collection: string;
  grain_direction: string;
};

/** Photos shipped under client/public/walzcraft/doors/. */
const PHOTO_CODES = new Set(["lsa", "lsc", "lsp", "pgw", "scr", "ssn", "tdw", "tgw", "zcc", "zck", "zsi", "zsw"]);

function orientationOf(value: string): GrainOrientation | null {
  const text = value.toLowerCase();
  if (text.startsWith("none")) return null;
  if (text.includes("horizontal")) return "horizontal";
  if (text.includes("vertical")) return "vertical";
  return null;
}

export function framelessGrains(): FramelessGrain[] {
  return (manifest.styles as ManifestStyle[]).map((style) => {
    const orientation = orientationOf(style.grain_direction);
    const code = style.code.toLowerCase();
    return {
      code: style.code,
      name: style.name,
      collection: style.collection,
      orientation,
      hasGrain: orientation != null,
      photoUrl: PHOTO_CODES.has(code) ? `/walzcraft/doors/altaeuro-${code}.webp` : null,
    };
  });
}

export function grainByCode(code: string | null | undefined): FramelessGrain | null {
  if (!code) return null;
  return framelessGrains().find((grain) => grain.code.toLowerCase() === code.toLowerCase()) ?? null;
}

/** 0 unless the owner has chosen the other direction. The photo is never spun on its own. */
export function previewRotationDegrees(native: GrainOrientation | null, chosen: GrainOrientation | null): number {
  if (!native || !chosen || native === chosen) return 0;
  return 90;
}

export type WizardSuggestion = {
  finish: "paint" | "stain";
  hex: string;
  source: DoorColorDecision["appliedSource"];
  needsColorReview: boolean;
  keptBecause: DoorColorDecision["review"]["keptBecause"];
  /** Hickory stays on its catalog photo. The suggestion does not swap in another grain. */
  hickoryPhoto: boolean;
  note: string;
};

export function suggestWizardMatch(style: DoorColorInput | null | undefined): WizardSuggestion {
  const decision = resolveDoorColor(style);
  const hickoryPhoto = isHickoryDoor(style ?? {});
  const finish = hickoryPhoto || decision.appliedCategory === "stain" ? "stain" : "paint";
  const note = hickoryPhoto
    ? `Suggestion only: hickory keeps its door photo. A hex reading is ${decision.appliedHex}. Not applied.`
    : finish === "paint"
      ? `Suggestion only: solid paint ${decision.appliedHex} from ${decision.appliedSource}. Not applied.`
      : `Suggestion only: wood grain, treatment ${decision.appliedHex} from ${decision.appliedSource}. Not applied.`;
  return {
    finish,
    hex: decision.appliedHex,
    source: decision.appliedSource,
    needsColorReview: decision.review.needsColorReview,
    keptBecause: decision.review.keptBecause,
    hickoryPhoto,
    note,
  };
}

/** Same hue, lighter and darker. Not stored. There is no grainLightHex column on the save. */
export function grainEnds(hex: string): { light: string; dark: string } | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const raw = match[1]!;
  const channels = [0, 2, 4].map((index) => Number.parseInt(raw.slice(index, index + 2), 16));
  const scale = (factor: number) => `#${channels.map((channel) => Math.max(0, Math.min(255, Math.round(channel * factor))).toString(16).padStart(2, "0")).join("")}`;
  return { light: scale(1.25), dark: scale(0.72) };
}

export type OwnerPick = {
  hex: string;
  /** A frameless code, including a solid (no grain). */
  grainCode: string;
  orientation: GrainOrientation;
};

export type MatchSavePatch = {
  renderHex: string;
  woodSpecies: string | null;
  grainDirection: "horizontal" | "vertical" | "none";
};

/** The fields the existing doorStyles update already accepts. */
export function matchSavePatch(pick: OwnerPick): MatchSavePatch | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(pick.hex.trim());
  const grain = grainByCode(pick.grainCode);
  if (!hex || !grain) return null;
  return {
    renderHex: `#${hex[1]!.toLowerCase()}`,
    woodSpecies: grain.hasGrain ? grain.name : null,
    grainDirection: grain.hasGrain ? pick.orientation : "none",
  };
}

export type ReplicateDoor = {
  id: number;
  distributorId?: number | null;
  ourName?: string | null;
  styleCode?: string | null;
};

/** Same distributor first. Nothing is dropped. */
export function sortDoorsForReplicate<T extends ReplicateDoor>(doors: readonly T[], currentId: number, distributorId: number | null | undefined): T[] {
  return doors.filter((door) => door.id !== currentId).slice().sort((left, right) => {
    const leftSame = left.distributorId === distributorId ? 0 : 1;
    const rightSame = right.distributorId === distributorId ? 0 : 1;
    if (leftSame !== rightSame) return leftSame - rightSame;
    return (left.ourName ?? "").localeCompare(right.ourName ?? "");
  });
}

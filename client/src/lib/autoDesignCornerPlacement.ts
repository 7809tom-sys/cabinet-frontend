import { seatAutoDesignCorner, type AutoDesignApplianceMove } from "./autoDesignCornerSeating";
import {
  autoDesignCornerFamily,
  autoDesignMissingCornerMessage,
  isAutoDesignBlindCornerOption,
  type AutoBuildCornerCandidate,
  type AutoDesignCornerSlot,
} from "./autoDesignCornerStage";
import type { CatalogFillerCandidate } from "./catalogFiller";
import { preferredBlindRunWallId } from "./cornerFit";
import {
  blindPullRange,
  isSinkBaseCabinet,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
} from "./design";

export type AutoDesignCornerSeatChoice = {
  placed: PlacedCabinet[];
  corner: PlacedCabinet;
  source: AutoBuildCornerCandidate;
  moves: AutoDesignApplianceMove[];
  /** Set when the seated cabinet is not the first cabinet the chain tried. */
  fallbackNote: string | null;
  blindRunWallId: string | null;
};

export type AutoDesignCornerSeatFromCatalogResult =
  | ({ ok: true } & AutoDesignCornerSeatChoice)
  | { ok: false; message: string };

function widthOf(option: { width?: string | number | null }): number {
  const parsed = Number.parseFloat(String(option.width ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function byWidthDesc<T extends AutoBuildCornerCandidate>(options: readonly T[]): T[] {
  return [...options].sort((left, right) => widthOf(right) - widthOf(left) || left.masterCode.localeCompare(right.masterCode));
}

/**
 * Diagonal corners first, then lazy Susans, then blind corners, largest first
 * inside each family. A corner sink base is not a diagonal corner cabinet.
 * `preferred` is tried before that chain when a review dialog names one.
 */
export function autoDesignCornerSeatOrder<T extends AutoBuildCornerCandidate>(
  options: readonly T[],
  preferred?: T | null,
): T[] {
  const usable = options.filter((option) => !isSinkBaseCabinet(option));
  const rest = preferred ? usable.filter((option) => option.id !== preferred.id) : usable;
  const of = (family: ReturnType<typeof autoDesignCornerFamily>) => byWidthDesc(rest.filter((option) => autoDesignCornerFamily(option) === family));
  return [
    ...(preferred && !isSinkBaseCabinet(preferred) ? [preferred] : []),
    ...of("diagonal"),
    ...of("lazy-susan"),
    ...of("blind"),
    ...of("other"),
  ];
}

function fallbackNote(slotLabel: string, seated: AutoBuildCornerCandidate, tried: readonly AutoBuildCornerCandidate[]): string | null {
  const first = tried[0];
  if (!first || first.id === seated.id) return null;
  if (autoDesignCornerFamily(first) === "lazy-susan" && autoDesignCornerFamily(seated) === "lazy-susan") {
    return `Lazy Susan reduced to ${seated.width ?? seated.masterCode}" to fit`;
  }
  if (autoDesignCornerFamily(seated) === "blind") {
    return `${first.masterCode} does not fit at ${slotLabel}. ${seated.masterCode} is placed instead, with the blind side on the wall with more room.`;
  }
  return `${first.masterCode} does not fit at ${slotLabel}. ${seated.masterCode} is placed instead.`;
}

/**
 * Seats one required corner before any straight run on the adjoining walls.
 * Tries a source-priced diagonal, then the largest lazy Susan, then a blind
 * corner whose blind side runs along the wall with more room. The blind
 * corner keeps its configured pull and its required filler. The error is
 * returned only when no blind corner in the line can be seated.
 */
export function seatAutoDesignCornerFromCatalog(input: {
  slot: AutoDesignCornerSlot;
  options: readonly AutoBuildCornerCandidate[];
  pool: readonly DesignCabinet[];
  /** Tried first when a review choice names a specific cabinet. */
  preferred?: AutoBuildCornerCandidate | null;
  target: { x: number; y: number; firstWallId: string };
  cornerWallIds: readonly string[];
  working: PlacedCabinet[];
  room: RoomData;
  openings: WallOpening[];
  measuredApplianceUids?: readonly string[];
  /** Pull chosen in a review dialog. Omitted callers use Cabinet Config's max pull. */
  blindPullIn?: number;
  catalogFillers: readonly CatalogFillerCandidate[];
  makeUid: () => string;
  styleId: number | null;
  excludedWallIds?: readonly string[];
}): AutoDesignCornerSeatFromCatalogResult {
  const order = autoDesignCornerSeatOrder(input.options, input.preferred);
  if (!order.length) return { ok: false, message: autoDesignMissingCornerMessage(input.slot) };
  const excluded = new Set(input.excludedWallIds ?? []);
  const allowedWalls = input.cornerWallIds.filter((wallId) => !excluded.has(wallId));
  let blindMessage: string | null = null;
  let lastMessage = `${input.slot.label}: no corner cabinet fits.`;
  for (const attempt of order) {
    const source = input.pool.find((row) => row.id === attempt.id) ?? (attempt as unknown as DesignCabinet);
    const blind = isAutoDesignBlindCornerOption(attempt);
    const pull = blindPullRange({ pullMin: attempt.pullMin, pullMax: attempt.pullMax });
    const blindPullIn = blind
      ? (input.blindPullIn != null && pull && input.blindPullIn >= pull.min && input.blindPullIn <= pull.max
        ? input.blindPullIn
        : pull?.max ?? 6)
      : undefined;
    const blindWalls = blind
      ? (() => {
        const preferred = preferredBlindRunWallId({
          room: input.room,
          placed: input.working,
          corner: input.target,
          wallIds: allowedWalls,
          openings: input.openings,
          excludedWallIds: input.excludedWallIds,
        });
        const rest = allowedWalls.filter((wallId) => wallId !== preferred);
        return [preferred, ...rest].filter((wallId): wallId is string => Boolean(wallId));
      })()
      : [undefined];
    for (const blindRunWallId of blindWalls) {
      const trial = seatAutoDesignCorner({
        source,
        slotLabel: input.slot.label,
        target: blindRunWallId ? { ...input.target, firstWallId: blindRunWallId } : input.target,
        cornerWallIds: allowedWalls.length ? allowedWalls : input.cornerWallIds,
        working: input.working,
        room: input.room,
        openings: input.openings,
        blindPullIn,
        blindRunWallId,
        isBlindOption: blind,
        catalogFillers: input.catalogFillers,
        makeUid: input.makeUid,
        styleId: input.styleId,
        measuredApplianceUids: input.measuredApplianceUids,
      });
      if (!trial.ok) {
        lastMessage = trial.message;
        if (blind) blindMessage = trial.message;
        continue;
      }
      return {
        ok: true,
        placed: trial.placed,
        corner: trial.corner,
        source: attempt,
        moves: trial.moves,
        fallbackNote: fallbackNote(input.slot.label, attempt, order),
        blindRunWallId: blindRunWallId ?? null,
      };
    }
  }
  return { ok: false, message: blindMessage ?? lastMessage };
}

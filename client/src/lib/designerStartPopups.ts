/**
 * Which popup Start from scratch shows, and when the sink/faucet picker may open.
 *
 * Start from scratch is an empty designer: cabinet style and color first, then
 * the room-layout picker after that choice is confirmed. The faucet and sink
 * picker is not part of that opening chain. It opens later, once, when a sink
 * base is placed and that base does not already have a chosen sink.
 */
import { isSinkBaseCabinet } from "./design";

export type OpeningPopup = "cabinet-style" | "room-layout";

export function initialDesignerPopup(input: {
  /** Nothing was restored: no saved design and no designed draft. */
  freshEmptyStart: boolean;
  /** A saved design or a draft that already has a plan. */
  restoredDesign: boolean;
  /** A door style is already chosen (restored draft or a style deep link). */
  styleChosen: boolean;
}): OpeningPopup | null {
  if (!input.freshEmptyStart || input.restoredDesign) return null;
  return input.styleChosen ? "room-layout" : "cabinet-style";
}

/**
 * Confirming the Start-from-scratch style popup is what opens the room layout.
 * Dismissing it (Not now, Escape, or the X) does not.
 * A style popup opened for another reason (a cabinet add with no style, or a
 * layout chosen before any style) does not chain forward.
 */
export function followUpAfterCabinetStyle(input: {
  action: "confirm" | "dismiss";
  chainRoomLayout: boolean;
}): "room-layout" | null {
  if (input.action === "confirm" && input.chainRoomLayout) return "room-layout";
  return null;
}

export type FixturePickCabinet = {
  uid: string;
  masterCode?: string | null;
  description?: string | null;
  subCategory?: string | null;
  category?: string | null;
  placement?: string | null;
  sinkTopProductId?: number | null;
  faucetProductId?: number | null;
};

export type FixturePickSink = {
  cabinetUid?: string | null;
  pelicanProductId?: number | null;
  pelicanFaucetProductId?: number | null;
};

function hasChosenProductId(id: number | null | undefined): boolean {
  return typeof id === "number" && id > 0;
}

/**
 * True when placing this cabinet should open the faucet and sink picker.
 * A sink base is recognized by the catalog helper (description, subcategory,
 * or an unambiguous sink-base code), not by a fixed SKU list. Each base is
 * asked once. A base that already has a catalog sink, faucet, or cooktop
 * product is not asked again, so reloading a saved room does not reopen it.
 */
export function shouldPromptFixturePick(input: {
  cabinet: FixturePickCabinet;
  existingSink?: FixturePickSink | null;
  /** The shopper dropped a specific sink onto this base as they placed it. */
  explicitSinkProduct?: boolean;
  promptedUids: ReadonlySet<string>;
}): boolean {
  const cabinet = input.cabinet;
  if (cabinet.placement != null && cabinet.placement !== "base") return false;
  if (!isSinkBaseCabinet(cabinet)) return false;
  if (input.promptedUids.has(cabinet.uid)) return false;
  if (input.explicitSinkProduct) return false;
  if (hasChosenProductId(input.existingSink?.pelicanProductId)) return false;
  if (hasChosenProductId(cabinet.sinkTopProductId)) return false;
  if (hasChosenProductId(cabinet.faucetProductId)) return false;
  if (hasChosenProductId(input.existingSink?.pelicanFaucetProductId)) return false;
  return true;
}

/**
 * A version refresh reloads the page and restores the local draft. Bases already
 * in that draft are not new placements, so none of the opening popups run, and
 * those bases stay in the "already asked" set. A sink base placed after the
 * restore has a new uid and is still asked once.
 * Older drafts have no saved set; every sink base in the restored plan is
 * treated as already asked.
 */
export function popupsForRestoredDraft(input: {
  restoredSnapshot: boolean;
  placed: readonly FixturePickCabinet[];
  sinks: readonly FixturePickSink[];
  promptedUids?: readonly string[] | null;
}): {
  openingPopup: null;
  openFixturePick: false;
  /** True when style, room layout, and the faucet/sink popup must stay closed. */
  suppressOpeningPopups: boolean;
  promptedUids: string[];
} {
  const prompted = new Set(
    (input.promptedUids ?? []).filter((uid): uid is string => typeof uid === "string" && uid.length > 0),
  );
  if (!input.restoredSnapshot) {
    return { openingPopup: null, openFixturePick: false, suppressOpeningPopups: false, promptedUids: [...prompted] };
  }
  for (const cabinet of input.placed) {
    if (cabinet.placement != null && cabinet.placement !== "base") continue;
    if (!isSinkBaseCabinet(cabinet)) continue;
    prompted.add(cabinet.uid);
  }
  const hasPlan = input.placed.length > 0
    || input.sinks.length > 0
    || prompted.size > 0;
  return {
    openingPopup: null,
    openFixturePick: false,
    suppressOpeningPopups: hasPlan,
    promptedUids: [...prompted],
  };
}

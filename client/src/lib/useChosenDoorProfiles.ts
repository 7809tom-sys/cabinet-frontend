/**
 * The Designer's side of "Choose as official".
 *
 * The door editor writes the chosen profile into a browser draft keyed by style
 * id (`shared/aiDoorChosenProfile.ts`). This hook puts that draft onto the style
 * rows the Designer already holds, so the 3D door and the elevation redraw from
 * the choice immediately — no refetch, no save, no reload.
 *
 * It only ever ADDS what the choice stated. A style with no draft is returned
 * unchanged, the color is never touched (an accepted render still wins), and the
 * draft is dropped from the answer as soon as the saved row agrees with it, so a
 * later catalog change is not shadowed by an old draft.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AI_DOOR_CHOSEN_PROFILE_STORAGE_KEY,
  chosenProfileAlreadySaved,
  readChosenDoorProfile,
  withChosenDoorProfile,
  type ChosenDoorProfile,
} from "@shared/aiDoorChosenProfile";

/** Fired in the same tab after a choice, since `storage` only fires in other tabs. */
export const AI_DOOR_CHOSEN_PROFILE_EVENT = "cabinetdealz:door-profile-chosen";

/** Notify the current tab that a profile was chosen or cleared. */
export function announceChosenDoorProfile(styleId: number | string | null | undefined) {
  if (typeof window === "undefined" || styleId == null) return;
  window.dispatchEvent(new CustomEvent(AI_DOOR_CHOSEN_PROFILE_EVENT, { detail: { styleId: String(styleId) } }));
}

/**
 * Every style's live draft, read once per change and memoized by id.
 *
 * Re-reads when another tab writes the draft, when this tab announces a choice,
 * and when the tab becomes visible again (the editor is a different page, so
 * coming back from it is the common path).
 */
export function useChosenDoorProfiles(): (styleId: number | null | undefined) => ChosenDoorProfile | null {
  // Focus and visibility fire constantly; only a changed draft store may give
  // the Designer a new lookup, or every return to the tab rebuilds the 3D room.
  const [storedDrafts, setStoredDrafts] = useState(readChosenProfileStore);
  const bump = useCallback(() => setStoredDrafts(readChosenProfileStore()), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== AI_DOOR_CHOSEN_PROFILE_STORAGE_KEY) return;
      bump();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") bump();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(AI_DOOR_CHOSEN_PROFILE_EVENT, bump);
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(AI_DOOR_CHOSEN_PROFILE_EVENT, bump);
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [bump]);

  const byId = useMemo(() => {
    const map = new Map<number, ChosenDoorProfile>();
    // A read of one id at a time keeps this module unaware of the store's shape.
    for (const id of chosenProfileStyleIds()) {
      const profile = readChosenDoorProfile(id);
      if (profile) map.set(id, profile);
    }
    return map;
  }, [storedDrafts]);

  return useCallback((styleId: number | null | undefined) => {
    if (styleId == null) return null;
    return byId.get(styleId) ?? null;
  }, [byId]);
}

function readChosenProfileStore(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(AI_DOOR_CHOSEN_PROFILE_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Style ids with a draft, read from the store's own key. */
function chosenProfileStyleIds(): number[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(AI_DOOR_CHOSEN_PROFILE_STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    return Object.keys(parsed as Record<string, unknown>)
      .map((key) => Number(key))
      .filter((id) => Number.isInteger(id) && id > 0);
  } catch {
    return [];
  }
}

/**
 * Merge one row with its draft.
 *
 * Returns the row untouched when there is no draft, or when the saved row already
 * carries every value the draft states — in that case the draft has served its
 * purpose and must not keep overriding the live record.
 */
export function styleWithChosenProfile<T extends object>(
  style: T & { id?: number | null },
  draftFor: (styleId: number | null | undefined) => ChosenDoorProfile | null,
): T {
  const draft = draftFor(style.id);
  if (!draft) return style;
  if (chosenProfileAlreadySaved(draft, style as never)) return style;
  return (withChosenDoorProfile(style, draft) as T) ?? style;
}

/** `styleWithChosenProfile` over a whole list, keeping the list's own element type. */
export function withChosenProfiles<T extends { id?: number | null }>(
  styles: readonly T[],
  draftFor: (styleId: number | null | undefined) => ChosenDoorProfile | null,
): T[] {
  const merged = styles.map((style) => styleWithChosenProfile(style, draftFor));
  return merged.every((style, index) => style === styles[index]) ? (styles as T[]) : merged;
}

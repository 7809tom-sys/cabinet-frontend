/** Per-door-style skin need. skinNeeded already exists on the style (backend); skinThicknessIn has no column → browser draft. */
export type SkinThicknessIn = 0.25 | 0.75 | null;
export interface DoorSkin { skinNeeded: boolean; skinThicknessIn: SkinThicknessIn }
const KEY = "walzcraftDoorSkin.v1";
type Store = Pick<Storage, "getItem" | "setItem">;
const ls = (): Store | null => (typeof localStorage !== "undefined" ? localStorage : null);
function all(store: Store | null): Record<string, DoorSkin> { try { return JSON.parse(store?.getItem(KEY) ?? "{}") ?? {}; } catch { return {}; } }
export function readDoorSkin(styleId: number, catalogSkinNeeded?: boolean | number | null, store: Store | null = ls()): DoorSkin {
  const v = all(store)[String(styleId)];
  if (v) return { skinNeeded: !!v.skinNeeded, skinThicknessIn: v.skinNeeded && (v.skinThicknessIn === 0.25 || v.skinThicknessIn === 0.75) ? v.skinThicknessIn : null };
  return { skinNeeded: Boolean(catalogSkinNeeded), skinThicknessIn: null };
}
export function saveDoorSkin(styleId: number, v: DoorSkin, store: Store | null = ls()) {
  store?.setItem(KEY, JSON.stringify({ ...all(store), [String(styleId)]: { skinNeeded: v.skinNeeded, skinThicknessIn: v.skinNeeded ? v.skinThicknessIn : null } }));
}
/** Checked "Skin needed?" requires a size; returns an error message or null. */
export function doorSkinError(v: DoorSkin): string | null {
  return v.skinNeeded && v.skinThicknessIn == null ? "Choose a skin size (1/4 in or 3/4 in)" : null;
}

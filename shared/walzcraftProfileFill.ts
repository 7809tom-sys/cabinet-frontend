/**
 * Pure "Approve → fill the door style form" logic. Only values stated in WalzCraft / distributor source data
 * are proposed; anything else is listed as "not in WalzCraft data" and the form field stays unchanged.
 * Nothing here persists; the admin must press the normal Save.
 */
import { WALZCRAFT_CATALOG_PROFILES, type WalzCraftCatalogProfile } from "./walzcraftCatalogProfiles";
import type { DistributorDoorMatch } from "./walzcraftDistributorMatchTypes";

export type GlazeColorChoice = "" | "gold" | "black" | "other";
export interface ProfileFormValues {
  railWidth: string;
  stileWidth: string;
  panelConstruction: string;
  bevelWidth: string;
  bevelDepth: string;
  insideEdgeProfile: string;
  drawerFrontType: string;
  finishSheen: string;
  profileNotes: string;
  sourceSpecification: string;
  glazed: "" | "yes" | "no";
  glazeColor: GlazeColorChoice;
  glazeColorOther: string;
}
export type ProfileField = keyof ProfileFormValues;
export const PROFILE_FIELD_LABELS: Record<ProfileField, string> = {
  railWidth: "Rail width",
  stileWidth: "Stile width",
  panelConstruction: "Center panel construction",
  bevelWidth: "Bevel width",
  bevelDepth: "Bevel depth",
  insideEdgeProfile: "Inside-edge profile",
  drawerFrontType: "Door front type",
  finishSheen: "Finish sheen",
  profileNotes: "Profile notes",
  sourceSpecification: "Official frame source citation",
  glazed: "Glazed",
  glazeColor: "Glazing color",
  glazeColorOther: "Glazing color name",
};
export interface FillChange { field: ProfileField; label: string; from: string; to: string; source: string }
export interface FillPlan { changes: FillChange[]; missing: string[]; catalog: WalzCraftCatalogProfile | null; styleCode: string | null }

const known = (v: string | undefined | null) => !!v && v.trim() !== "" && !/^unknown$|^not found$/i.test(v.trim());

/** Parses an inch value like `1 1/2"` or `3"` — only when the CSV states one. */
export function parseInches(text: string): number | null {
  const m = text.match(/(\d+)(?:\s+(\d+)\/(\d+))?\s*"/) ?? text.match(/^(\d+)\/(\d+)\s*"/);
  if (!m) return null;
  if (m.length === 3) return Number(m[1]) / Number(m[2]);
  return Number(m[1]) + (m[2] ? Number(m[2]) / Number(m[3]) : 0);
}

export function catalogForDoor(door: DistributorDoorMatch): { code: string | null; row: WalzCraftCatalogProfile | null } {
  const top = door.matches[0];
  if (!top) return { code: null, row: null };
  const code = top.walzcraft.match(/^(S\d+)\b/)?.[1] ?? top.templateId ?? null;
  return { code, row: code ? WALZCRAFT_CATALOG_PROFILES[code] ?? null : null };
}

export function isSlabDoor(door: DistributorDoorMatch): boolean {
  return /slab/i.test(door.group) || /slab/i.test(door.geometry);
}

export function planProfileFill(door: DistributorDoorMatch, current: ProfileFormValues): FillPlan {
  const { code, row } = catalogForDoor(door);
  const proposed: Partial<Record<ProfileField, { to: string; source: string }>> = {};
  const missing: string[] = [];
  const src = (col: string) => `walzcraft_door_catalog.csv ${row?.style ?? code} · ${col}`;
  const slab = isSlabDoor(door);

  // Frame width → rail/stile.
  const fw = row?.frame_width ?? "";
  const inches = known(fw) ? parseInches(fw) : null;
  if (inches != null && /stile/i.test(fw)) {
    proposed.stileWidth = { to: String(inches), source: src(`frame_width "${fw}"`) };
    missing.push(PROFILE_FIELD_LABELS.railWidth);
  } else if (inches != null) {
    proposed.railWidth = { to: String(inches), source: src(`frame_width "${fw}"`) };
    proposed.stileWidth = { to: String(inches), source: src(`frame_width "${fw}"`) };
  } else if (!slab) {
    missing.push(PROFILE_FIELD_LABELS.railWidth, PROFILE_FIELD_LABELS.stileWidth);
  }

  // Panel construction + door front type.
  if (slab) {
    proposed.panelConstruction = { to: "slab", source: `${door.distributor} ${door.code} geometry "${door.geometry}"` };
    proposed.drawerFrontType = { to: "slab", source: `${door.distributor} ${door.code} geometry "${door.geometry}"` };
  } else {
    const pt = row?.panel_type ?? "";
    if (/^raised panel$/i.test(pt)) proposed.panelConstruction = { to: "raised", source: src(`panel_type "${pt}"`) };
    else if (/^flat\/recessed$/i.test(pt)) proposed.panelConstruction = { to: "flat", source: src(`panel_type "${pt}"`) };
    else missing.push(PROFILE_FIELD_LABELS.panelConstruction);
    missing.push(PROFILE_FIELD_LABELS.drawerFrontType);
  }

  // Bevel (bevel_reveal) — only when the CSV states inches.
  const br = row?.bevel_reveal ?? "";
  const bevel = known(br) ? parseInches(br) : null;
  if (bevel != null) proposed.bevelWidth = { to: String(bevel), source: src(`bevel_reveal "${br}"`) };
  else if (!slab) missing.push(PROFILE_FIELD_LABELS.bevelWidth);
  if (!slab) missing.push(PROFILE_FIELD_LABELS.bevelDepth);

  // Inside edge profile + profile notes: verbatim profile names.
  const sr = row?.stile_rail_profile ?? "";
  const pp = row?.panel_profile ?? "";
  if (known(sr)) proposed.insideEdgeProfile = { to: sr, source: src("stile_rail_profile") };
  else if (!slab) missing.push(PROFILE_FIELD_LABELS.insideEdgeProfile);
  const names = [known(sr) ? `Stile/rail profile: ${sr}` : null, known(pp) ? `Panel profile: ${pp}` : null, row && known(row.thickness) ? `Thickness: ${row.thickness}` : null].filter(Boolean);
  if (names.length) proposed.profileNotes = { to: `WalzCraft ${row!.style} — ${names.join("; ")}`, source: src("stile_rail_profile / panel_profile / thickness") };
  else missing.push(PROFILE_FIELD_LABELS.profileNotes);

  // Finish sheen: only an explicit matte / satin / gloss word in the finish column.
  const sheen = row?.finish.match(/\b(matte|satin|gloss)\b/i)?.[1]?.toLowerCase();
  if (sheen) proposed.finishSheen = { to: sheen, source: src(`finish "${row!.finish}"`) };
  else missing.push(PROFILE_FIELD_LABELS.finishSheen);

  // Frame source citation: distributor name + WalzCraft drawing.
  if (door.distributor && code) {
    proposed.sourceSpecification = { to: `${door.distributor} · WalzCraft ${code} (published profile drawing)`, source: `distributor + WalzCraft ${code}` };
  } else if (door.distributor) {
    proposed.sourceSpecification = { to: door.distributor, source: "distributor" };
  } else missing.push(`${PROFILE_FIELD_LABELS.sourceSpecification} (distributor missing)`);

  // Glaze: distributor color text, then catalog finish "Glaze Color X".
  const colorText = door.walzcraftColor ?? "";
  const glazeColorText = row?.finish.match(/Glaze Color\s+([A-Za-z]+)/)?.[1] ?? null;
  if (/no glaze/i.test(colorText)) proposed.glazed = { to: "no", source: `${door.distributor} CSV color "${colorText}"` };
  else if (/glaze/i.test(colorText)) proposed.glazed = { to: "yes", source: `${door.distributor} CSV color "${colorText}"` };
  else missing.push(PROFILE_FIELD_LABELS.glazed);
  const glazeWord = (colorText.match(/\b(gold|black)\s+glaze/i)?.[1] ?? (proposed.glazed?.to === "yes" ? glazeColorText : null))?.toLowerCase();
  if (glazeWord === "gold" || glazeWord === "black") proposed.glazeColor = { to: glazeWord, source: "match data" };
  else missing.push(glazeWord ? `${PROFILE_FIELD_LABELS.glazeColor} (source says "${glazeWord}", only Gold/Black are auto-filled)` : PROFILE_FIELD_LABELS.glazeColor);

  const changes: FillChange[] = [];
  for (const [field, p] of Object.entries(proposed) as [ProfileField, { to: string; source: string }][]) {
    if (current[field] !== p.to) changes.push({ field, label: PROFILE_FIELD_LABELS[field], from: current[field], to: p.to, source: p.source });
  }
  return { changes, missing: missing.map((m) => `${m}: not in WalzCraft data`), catalog: row, styleCode: code };
}

export function applyFill(current: ProfileFormValues, plan: FillPlan): ProfileFormValues {
  const next = { ...current };
  for (const c of plan.changes) (next as Record<string, string>)[c.field] = c.to;
  return next;
}

/** Glazing has no backend column yet: kept per style in localStorage ("not saved yet"). */
const GLAZE_KEY = "walzcraftStyleGlazing.v1";
type Store = Pick<Storage, "getItem" | "setItem">;
export interface Glazing { glazed: "" | "yes" | "no"; glazeColor: GlazeColorChoice; glazeColorOther: string }
export function readGlazing(styleId: number | string, store: Store | null = typeof localStorage !== "undefined" ? localStorage : null): Glazing {
  try { const all = JSON.parse(store?.getItem(GLAZE_KEY) ?? "{}"); return all[styleId] ?? { glazed: "", glazeColor: "", glazeColorOther: "" }; } catch { return { glazed: "", glazeColor: "", glazeColorOther: "" }; }
}
export function saveGlazing(styleId: number | string, g: Glazing, store: Store | null = typeof localStorage !== "undefined" ? localStorage : null) {
  if (!store) return;
  let all: Record<string, Glazing> = {};
  try { all = JSON.parse(store.getItem(GLAZE_KEY) ?? "{}"); } catch { /* reset */ }
  all[styleId] = g;
  store.setItem(GLAZE_KEY, JSON.stringify(all));
}

import { WALZCRAFT_SHADE_COLORS, WALZCRAFT_SHADE_FAMILIES, type ShadeColor } from "./walzcraftDoorTemplates";
import { WALZCRAFT_DISTRIBUTOR_DOORS, type DistributorDoorMatch } from "./walzcraftDistributorMatches";

// Seeded only from the CSV closest_finish values and the picker's per-family shade list.
// Every hex comes from WALZCRAFT_SHADE_FAMILIES (all hexEstimated) and no CSV carries a
// per-color %, so matchPct is "estimated" on every seeded candidate.

export interface ColorCandidate {
  name: string;
  hex: string | null;
  matchPct: number | "estimated";
  hexEstimated: boolean;
  source: "csv closest_finish" | "same WalzCraft family";
}

export interface ColorPatternRecord {
  doorId: string;
  distributor: string;
  doorName: string | null;
  code: string;
  candidates: ColorCandidate[];
  glaze: "none" | "glaze" | "unknown";
  samplePhoto: string | null;
  slab: "Slab · 100%" | null;
  approval: "approved" | "rejected" | null;
  /** Door COLOR type (never used by profile matching). */
  colorType: "paint" | "stain" | "woodGrain";
  /** Species stated in the source (distributor door name/group/geometry or WalzCraft catalog species), else null. */
  woodSpecies: string | null;
  /** "horizontal" only when the source text says so; otherwise null (leave grain as-is). */
  grainDirection: "horizontal" | null;
}

const SPECIES = ["hickory", "oak", "cherry", "walnut", "maple", "alder", "ash", "birch", "pine"];
/** Classifies the door color type from source text only. */
export function colorTypeFor(door: DistributorDoorMatch, catalogSpecies?: string | null): Pick<ColorPatternRecord, "colorType" | "woodSpecies" | "grainDirection"> {
  const text = [door.doorName, door.geometry].filter(Boolean).join(" "); // color names like "English Oak V4" are stains, not species
  const species = SPECIES.find((w) => new RegExp(`\\b${w}\\b`, "i").test(text)) ?? null;
  const grainy = /wood ?grain|rustic|\bgrain\b|\bwood\b/i.test(text) || species !== null;
  const grainDirection = /horizontal(ly)? grain|grain[^.;]*horizontal/i.test(text) ? "horizontal" : null;
  if (grainy) {
    const sp = species ?? (catalogSpecies && SPECIES.find((w) => new RegExp(`\\b${w}\\b`, "i").test(catalogSpecies))) ?? null;
    return { colorType: "woodGrain", woodSpecies: sp ? sp[0].toUpperCase() + sp.slice(1) : null, grainDirection };
  }
  const shade = shadeByName(door.walzcraftColor);
  if (shade && /stain/i.test(shade.finish ?? "")) return { colorType: "stain", woodSpecies: null, grainDirection };
  return { colorType: "paint", woodSpecies: null, grainDirection };
}

export type GrainDirectionLabel = "Horizontal" | "Vertical" | "grain direction missing";
/** Direction from the style's existing grainDirection field first, else a source-stated horizontal grain; never guessed. */
export function grainDirectionLabel(styleGrainDirection?: string | null, sourceDirection?: "horizontal" | null): GrainDirectionLabel {
  if (styleGrainDirection === "horizontal") return "Horizontal";
  if (styleGrainDirection === "vertical" || styleGrainDirection === "vertical-stiles-horizontal-rails") return "Vertical";
  if (sourceDirection === "horizontal") return "Horizontal";
  return "grain direction missing";
}
/** Badge text for wood-grain colors: "Wood grain · <species> · <Horizontal|Vertical|grain direction missing>". */
export function woodGrainBadge(r: Pick<ColorPatternRecord, "colorType" | "woodSpecies"> & { grainDirection?: "horizontal" | null }, styleGrainDirection?: string | null): string | null {
  if (r.colorType !== "woodGrain") return null;
  const dir = grainDirectionLabel(styleGrainDirection, r.grainDirection ?? null);
  return `Wood grain · ${r.woodSpecies ?? "species not in source"} · ${dir}`;
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function shadeByName(name: string | null | undefined): ShadeColor | null {
  const n = norm(name);
  if (!n) return null;
  return WALZCRAFT_SHADE_COLORS.find((s) => n.startsWith(norm(s.name))) ?? null;
}

function glazeOf(colorText: string | null): ColorPatternRecord["glaze"] {
  if (!colorText) return "unknown";
  if (/no glaze/i.test(colorText)) return "none";
  if (/glaze/i.test(colorText)) return "glaze";
  return "none";
}

export function colorPatternFor(door: DistributorDoorMatch): ColorPatternRecord {
  const candidates: ColorCandidate[] = [];
  if (door.walzcraftColor) {
    const shade = shadeByName(door.walzcraftColor);
    candidates.push({ name: door.walzcraftColor, hex: shade?.hex ?? null, matchPct: "estimated", hexEstimated: true, source: "csv closest_finish" });
    if (shade) {
      const fam = WALZCRAFT_SHADE_FAMILIES.find((f) => f.id === shade.familyId);
      for (const s of fam?.shades ?? []) {
        if (candidates.length >= 4) break;
        if (s.id === shade.id) continue;
        candidates.push({ name: s.name, hex: s.hex, matchPct: "estimated", hexEstimated: true, source: "same WalzCraft family" });
      }
    }
  }
  return {
    doorId: door.id,
    distributor: door.distributor,
    doorName: door.doorName,
    code: door.code,
    candidates,
    glaze: glazeOf(door.walzcraftColor),
    samplePhoto: door.photo,
    slab: /slab/i.test(door.group) ? "Slab · 100%" : null,
    approval: null,
    ...colorTypeFor(door),
  };
}

export const WALZCRAFT_COLOR_PATTERNS: ColorPatternRecord[] = WALZCRAFT_DISTRIBUTOR_DOORS.map(colorPatternFor);

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as [number, number, number];
}

const MAX_DIST = Math.sqrt(3 * 255 * 255);
/** Nearest named WalzCraft shade by RGB distance; matchPct = 100 * (1 - distance / max distance). */
export function nearestShade(hex: string): { shade: ShadeColor; matchPct: number } {
  const [r, g, b] = hexToRgb(hex);
  let best = WALZCRAFT_SHADE_COLORS[0];
  let bestD = Infinity;
  for (const s of WALZCRAFT_SHADE_COLORS) {
    const [r2, g2, b2] = hexToRgb(s.hex);
    const d = Math.hypot(r - r2, g - g2, b - b2);
    if (d < bestD) { bestD = d; best = s; }
  }
  return { shade: best, matchPct: Math.round(100 * (1 - bestD / MAX_DIST)) };
}

export interface ColorSelection { shadeName: string; hex: string; matchPct: number | "estimated"; pickedHex?: string }
export const COLOR_PATTERN_STORAGE_KEY = "walzcraftColorPatterns.v1";
type Store = Pick<Storage, "getItem" | "setItem">;
export function readColorSelections(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): Record<string, ColorSelection> {
  try { return JSON.parse(storage?.getItem(COLOR_PATTERN_STORAGE_KEY) ?? "{}") ?? {}; } catch { return {}; }
}
export function saveColorSelection(doorId: string, sel: ColorSelection, storage: Store | undefined = globalThis.localStorage) {
  const all = readColorSelections(storage);
  all[doorId] = sel;
  storage?.setItem(COLOR_PATTERN_STORAGE_KEY, JSON.stringify(all));
  return all;
}

export function colorPatternsCsv(records: ColorPatternRecord[]): string {
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ["distributor", "code", "door_name", "slab", "glaze", "sample_photo", "color_type", "wood_species", "grain_direction"];
  for (let i = 1; i <= 4; i++) head.push(`color${i}_name`, `color${i}_hex`, `color${i}_match`, `color${i}_source`);
  const lines = [head.join(",")];
  for (const r of records) {
    const row: unknown[] = [r.distributor, r.code, r.doorName ?? "(name not in source)", r.slab ?? "", r.glaze, r.samplePhoto ?? "No brochure photo found", r.colorType, r.woodSpecies ?? "", r.grainDirection ?? ""];
    for (let i = 0; i < 4; i++) {
      const c = r.candidates[i];
      row.push(c?.name ?? "", c?.hex ? `${c.hex}${c.hexEstimated ? " (estimated)" : ""}` : "", c ? (c.matchPct === "estimated" ? "estimated" : `${c.matchPct}%`) : "", c?.source ?? "");
    }
    lines.push(row.map(esc).join(","));
  }
  return lines.join("\n") + "\n";
}

/**
 * Audit a new door against the WalzCraft sheets. Used only by the door editor.
 * Profile confidence comes from the sheet. Color and feature percents are
 * estimated here when the sheet does not publish them. No door_styles columns
 * are read, so a database without finishCategory or grain hexes still audits.
 */
import { deltaE2000Hex } from "./ciede2000";
import { resolveDoorColor, type DoorColorInput } from "./doorColorResolve";
import { shadeByName } from "./walzcraftColorPatterns";
import {
  bestCandidateDoor,
  doorForStyle,
  type DistributorDoorMatch,
  type FeatureKey,
} from "./walzcraftDistributorMatches";

export type AuditStyle = DoorColorInput & {
  supplierBrandName?: string | null;
  distributorName?: string | null;
  manufacturer?: string | null;
  distributor?: string | null;
  sku?: string | null;
  railWidth?: string | number | null;
};

export type ProfileChoice = {
  rank: number;
  name: string;
  code: string | null;
  /** Sheet confidence. This is the profile match probability. */
  pct: number;
};

export type PercentNote = {
  label: string;
  pct: number | null;
  estimated: boolean;
  note: string;
};

export type WalzcraftDoorAudit = {
  door: DistributorDoorMatch | null;
  exact: boolean;
  profiles: ProfileChoice[];
  color: PercentNote;
  features: PercentNote[];
};

/** How many profile suggestions the door editor always shows. */
export const WALZ_AUDIT_PROFILE_SLOTS = 4 as const;

/**
 * One slot in the door editor's suggested-profiles list.
 *
 * `library-default` means the sheet did not rank enough profiles for this door,
 * so the slot is filled from the WalzCraft catalog data. It is still a real
 * catalog profile with its published name and code; nothing is invented and no
 * match percentage is claimed for it.
 */
export type ProfileSlot =
  | { kind: "match"; rank: number; name: string; code: string | null; pct: number }
  | { kind: "library-default"; rank: number; name: string; code: string; pct: null };

/**
 * The four slots the door editor always renders.
 *
 * Sheet-ranked matches come first, in rank order. Any remaining slot is filled
 * from `catalogDefaults`, a caller-supplied list of real WalzCraft catalog
 * profiles. The same profile is never listed twice, and a caller that supplies
 * too few catalog profiles gets empty slots rather than invented ones.
 */
export function auditProfileSlots(
  audit: Pick<WalzcraftDoorAudit, "profiles">,
  catalogDefaults: ReadonlyArray<{ name: string; code: string }>,
): ProfileSlot[] {
  const slots: ProfileSlot[] = [];
  const seen = new Set<string>();
  const key = (name: string, code: string | null) => `${name.trim().toLowerCase()}|${(code ?? "").trim().toLowerCase()}`;

  for (const match of audit.profiles) {
    if (slots.length >= WALZ_AUDIT_PROFILE_SLOTS) break;
    const identity = key(match.name, match.code);
    if (seen.has(identity)) continue;
    seen.add(identity);
    slots.push({ kind: "match", rank: match.rank, name: match.name, code: match.code, pct: match.pct });
  }

  for (const entry of catalogDefaults) {
    if (slots.length >= WALZ_AUDIT_PROFILE_SLOTS) break;
    const identity = key(entry.name, entry.code);
    if (seen.has(identity)) continue;
    seen.add(identity);
    slots.push({
      kind: "library-default",
      rank: slots.length + 1,
      name: entry.name,
      code: entry.code,
      pct: null,
    });
  }

  return slots;
}

function parsedInches(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** 100 when the two hexes match. About 80 at ΔE 10. 0 at ΔE 50. */
export function colorMatchPercent(doorHex: string, referenceHex: string): { pct: number; deltaE: number } | null {
  const deltaE = deltaE2000Hex(doorHex, referenceHex);
  if (deltaE == null) return null;
  const pct = Math.max(0, Math.min(100, Math.round(100 - deltaE * 2)));
  return { pct, deltaE: Math.round(deltaE * 10) / 10 };
}

function featureNote(door: DistributorDoorMatch, feature: FeatureKey): string | null {
  const pattern = feature === "frame width" ? /frame|width|stile/i : feature === "edge/bevel" ? /edge|bevel|profile|step/i : /panel|raise|construction|slab/i;
  return (door.unknowns ?? []).find((line) => pattern.test(line)) ?? null;
}

function featurePercent(style: AuditStyle, door: DistributorDoorMatch, feature: FeatureKey, profilePct: number): PercentNote {
  const unpublished = featureNote(door, feature);
  const text = `${style.doorStyle ?? ""} ${style.ourName ?? ""} ${door.geometry} ${door.group}`.toLowerCase();
  if (feature === "frame width") {
    const rail = parsedInches(style.railWidth);
    if (rail != null) {
      const aim = /slim/.test(text) ? 2.25 : 2.75;
      const gap = Math.abs(rail - aim);
      const pct = Math.max(0, Math.min(100, Math.round(100 - gap * 40)));
      return { label: "Frame width", pct, estimated: true, note: `Compared with a ${aim} in shaker rail. The sheet does not publish a measured width.` };
    }
  }
  if (unpublished) {
    return {
      label: feature === "frame width" ? "Frame width" : feature === "edge/bevel" ? "Edge / bevel" : "Panel",
      pct: Math.max(0, Math.min(100, Math.round(profilePct * 0.5))),
      estimated: true,
      note: `Estimated from the profile match. The sheet says: ${unpublished}.`,
    };
  }
  const agrees = feature === "panel"
    ? (/shaker|recess|flat/.test(text) && /shaker|recess|flat/.test(door.geometry.toLowerCase()))
      || (/raised/.test(text) && /rais/.test(door.geometry.toLowerCase()))
    : /shaker|square|recess/.test(text);
  const pct = agrees ? Math.min(100, profilePct + 20) : Math.max(0, profilePct - 15);
  return {
    label: feature === "edge/bevel" ? "Edge / bevel" : "Panel",
    pct,
    estimated: true,
    note: agrees ? "The door words agree with the sheet geometry." : "The door words do not line up with the sheet geometry.",
  };
}

export function auditWalzcraftDoor(style: AuditStyle | null | undefined): WalzcraftDoorAudit {
  const input = style ?? {};
  const exactDoor = doorForStyle(input);
  const found = exactDoor ? { door: exactDoor, exact: true } : bestCandidateDoor(input);
  const door = found?.door ?? null;
  const profiles: ProfileChoice[] = (door?.matches ?? []).map((match) => ({
    rank: match.rank,
    name: match.walzcraft,
    code: match.profileCode,
    pct: match.confidencePct,
  }));
  const top = profiles[0]?.pct ?? 0;
  const own = resolveDoorColor(input);
  const shade = door ? shadeByName(door.walzcraftColor) : null;
  const compared = shade?.hex ? colorMatchPercent(own.appliedHex, shade.hex) : null;
  const color: PercentNote = compared
    ? {
        label: "Color",
        pct: compared.pct,
        estimated: true,
        note: `Door ${own.appliedHex} against ${door?.walzcraftColor ?? "the sheet color"} ${shade?.hex}. ΔE ${compared.deltaE}. The sheet does not publish a color percent.`,
      }
    : {
        label: "Color",
        pct: door?.colorMatchPct ?? null,
        estimated: true,
        note: door ? "No shade hex to compare." : "No WalzCraft door to compare.",
      };
  const features = door
    ? (["frame width", "edge/bevel", "panel"] as FeatureKey[]).map((feature) => featurePercent(input, door, feature, top))
    : [];
  return { door, exact: found?.exact ?? false, profiles, color, features };
}

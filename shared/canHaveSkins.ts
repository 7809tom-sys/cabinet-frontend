/**
 * Hard rule: only hickory frameless cabinets get skins.
 *
 * Hickory is the door-style species or a name that contains the word hickory.
 * Frameless is the same construction signal the Designer already uses for US
 * Cabinet Depot / AltaEuro (style code, box construction, overlay, or an
 * explicit frameless flag). A catalog flag, saved design, Auto-Design result,
 * or a checked "Skin needed" box cannot turn skins on for any other style.
 *
 * "Finished end needed" is a separate owner choice. It is not a skin.
 */
import { isFramelessDoorStyle, type DoorStyleFaceInput } from "./doorFaceRecognition";

export const SKIN_NEEDED_LOCKED_TOOLTIP = "Only hickory frameless gets skins";

const HICKORY_WORD = /\bhickory\b/i;

export type SkinEligibilityStyle = DoorStyleFaceInput & {
  name?: string | null;
  woodSpecies?: string | null;
  doorStyle?: string | null;
  finish?: string | null;
  color?: string | null;
  isFrameless?: boolean | null;
  frameless?: boolean | null;
  constructionMethod?: string | null;
  /** Owner checkbox. Null or absent uses the hickory-frameless default. */
  skinNeeded?: boolean | number | null;
  /** Owner checkbox. Null or absent means No. */
  finishedEndNeeded?: boolean | number | null;
};

/** A cabinet can carry its own construction when the style row is separate. */
export type SkinEligibilityInput =
  | SkinEligibilityStyle
  | null
  | undefined
  | {
      style?: SkinEligibilityStyle | null;
      cabinet?: { constructionMethod?: string | null } | null;
    };

function asStyle(input: SkinEligibilityInput): SkinEligibilityStyle | null {
  if (!input) return null;
  if ("style" in input || "cabinet" in input) return input.style ?? null;
  return input;
}

function asCabinet(input: SkinEligibilityInput): { constructionMethod?: string | null } | null {
  if (!input || !("cabinet" in input)) return null;
  return input.cabinet ?? null;
}

function joinedText(parts: Array<string | null | undefined>): string {
  return parts.filter((part) => part && String(part).trim()).join(" ");
}

/** Species or any style name contains the word hickory. "Rustic" alone does not. */
export function isHickoryDoorStyle(input: SkinEligibilityInput): boolean {
  const style = asStyle(input);
  if (!style) return false;
  return HICKORY_WORD.test(joinedText([
    style.woodSpecies,
    style.ourName,
    style.name,
    style.aliasName,
    style.distributorName,
    style.doorStyle,
    style.finish,
    style.color,
  ]));
}

/** USCD / AltaEuro frameless, or construction text that says frameless. */
export function isFramelessConstruction(input: SkinEligibilityInput): boolean {
  const style = asStyle(input);
  const cabinet = asCabinet(input);
  if (style?.isFrameless === true || style?.frameless === true) return true;
  if (style && isFramelessDoorStyle(style)) return true;
  const text = joinedText([
    style?.boxConstruction,
    style?.overlayType,
    style?.constructionMethod,
    style?.distributorName,
    style?.supplierBrandName,
    style?.supplierName,
    cabinet?.constructionMethod,
  ]);
  return /frameless|altaeuro|alta euro|\baef\b|us cabinet depot/i.test(text);
}

/**
 * True only for hickory AND frameless. Every skin assignment, suggestion,
 * price line, and render decision must call this (or skinsAreNeeded).
 */
export function canHaveSkins(input: SkinEligibilityInput): boolean {
  return isHickoryDoorStyle(input) && isFramelessConstruction(input);
}

/** null means the column or field is absent and the default applies. */
export function readOptionalBoolean(value: boolean | number | string | null | undefined): boolean | null {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  return null;
}

/**
 * The skin decision that cannot be overridden.
 * Ineligible styles are always No, even when skinNeeded is forced on.
 * Hickory frameless defaults to Yes until the owner stores an explicit No.
 */
export function skinsAreNeeded(input: SkinEligibilityInput): boolean {
  if (!canHaveSkins(input)) return false;
  return readOptionalBoolean(asStyle(input)?.skinNeeded) !== false;
}

/** Finished ends default to No. The owner can check this on any style. */
export function finishedEndIsNeeded(input: SkinEligibilityInput): boolean {
  return readOptionalBoolean(asStyle(input)?.finishedEndNeeded) === true;
}

export type DoorStyleNeedView = {
  skinNeeded: boolean;
  skinNeededDisabled: boolean;
  skinNeededTooltip: string | null;
  finishedEndNeeded: boolean;
};

export function doorStyleNeedView(input: SkinEligibilityInput): DoorStyleNeedView {
  const allowed = canHaveSkins(input);
  return {
    skinNeeded: allowed && skinsAreNeeded(input),
    skinNeededDisabled: !allowed,
    skinNeededTooltip: allowed ? null : SKIN_NEEDED_LOCKED_TOOLTIP,
    finishedEndNeeded: finishedEndIsNeeded(input),
  };
}

const SKIN_CODE = /^(?:HICKORY-?SKIN(?:-|$)|WSV-?\d+|BSV$)/i;

/** A placed or catalog product that is a skin, not a finished end panel. */
export function isSkinProduct(item: {
  masterCode?: string | null;
  description?: string | null;
  subCategory?: string | null;
  category?: string | null;
} | null | undefined): boolean {
  if (!item) return false;
  const code = String(item.masterCode ?? "").trim();
  if (SKIN_CODE.test(code.replace(/\s+/g, ""))) return true;
  const text = `${item.description ?? ""} ${item.subCategory ?? ""} ${item.category ?? ""}`;
  return /\bskins?\b/i.test(text);
}

/**
 * Drop skin products when the style is not allowed to have them.
 * Returns the same array when nothing changes.
 */
export function dropIneligibleSkins<T extends {
  masterCode?: string | null;
  description?: string | null;
  subCategory?: string | null;
  category?: string | null;
}>(placed: readonly T[], input: SkinEligibilityInput): T[] {
  if (skinsAreNeeded(input)) return placed as T[];
  const kept = placed.filter((item) => !isSkinProduct(item));
  return kept.length === placed.length ? placed as T[] : kept;
}

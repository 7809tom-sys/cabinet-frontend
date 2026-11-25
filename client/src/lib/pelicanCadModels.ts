/**
 * Which Pelican CAD drawing belongs to a catalog SKU, and which of those
 * drawings is safe to draw in the designer.
 *
 * The designer still places a sink from its measured profile. When this module
 * returns a model, the 3D view uses that mesh. When it returns nothing, the
 * parametric basin stays.
 */

import {
  PELICAN_CAD_ASSETS,
  type PelicanCadAsset,
  type PelicanCadVariant,
} from "./pelicanCadCatalog";

export type ResolvedPelicanCad = {
  sku: string;
  /** Null when the code does not name a corner radius or an ADA bowl. */
  variant: PelicanCadVariant | null;
};

const SKUS = Array.from(new Set(PELICAN_CAD_ASSETS.map((asset) => asset.sku)))
  .filter((sku) => sku !== "WS-STRAINER")
  .sort((a, b) => b.length - a.length);

function normalizeCode(value: string | null | undefined): string {
  return (value ?? "")
    .toUpperCase()
    .replace(/[“”″]/g, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The CAD pack names the 8 inch bowl `PL-VS3018-8`. The live catalog sells that
 * same bowl as `PL-VS3018 8" Deep`. The mesh is 8.07 inches tall.
 */
function isVs3018EightInch(code: string): boolean {
  return /PL-VS3018\b/.test(code) && /8\s*"/.test(code) && /DEEP/.test(code);
}

export function resolvePelicanCadCode(value: string | null | undefined): ResolvedPelicanCad | null {
  const code = normalizeCode(value);
  if (!code) return null;
  if (isVs3018EightInch(code)) return { sku: "PL-VS3018-8", variant: "standard" };
  for (const sku of SKUS) {
    if (code !== sku && !code.startsWith(`${sku} `) && !code.startsWith(`${sku}-`)) continue;
    // `PL-VS3018 8" Deep` shares the shorter prefix but is a different drawing.
    if (sku === "PL-VS3018" && isVs3018EightInch(code)) continue;
    const rest = code.slice(sku.length);
    const variant: PelicanCadVariant | null = /\bADA\b/.test(code)
      ? "ada"
      : /\bR15\b/.test(rest)
        ? "r15"
        : /\bR0\b/.test(rest)
          ? "r0"
          : null;
    return { sku, variant };
  }
  return null;
}

function variantFromProfileId(profileId: string): PelicanCadVariant | null {
  const id = profileId.toLowerCase();
  if (id.includes("-ada")) return "ada";
  if (id.includes("r15")) return "r15";
  if (id.includes("r0")) return "r0";
  return null;
}

function skuFromProfileId(profileId: string): string | null {
  const id = profileId.toLowerCase();
  for (const sku of SKUS) {
    if (id.includes(sku.toLowerCase())) return sku;
  }
  return null;
}

export function resolvePelicanCadIdentity(input: {
  pelicanCode?: string | null;
  pelicanProfileId?: string | null;
  pelicanProductName?: string | null;
}): ResolvedPelicanCad | null {
  const fromCode = resolvePelicanCadCode(input.pelicanCode) ?? resolvePelicanCadCode(input.pelicanProductName);
  const profileId = input.pelicanProfileId ?? "";
  const sku = fromCode?.sku ?? skuFromProfileId(profileId);
  if (!sku) return null;
  const variant = fromCode?.variant ?? variantFromProfileId(profileId);
  return { sku, variant };
}

function readyModels(sku: string): PelicanCadAsset[] {
  return PELICAN_CAD_ASSETS.filter((asset) => asset.sku === sku && asset.designerReady && asset.glbUrl);
}

/**
 * The mesh the designer should draw, or null when the parametric basin is the
 * right picture (no drawing, a bad conversion, or the wrong bowl depth).
 */
export function designerPelicanCadModel(input: {
  pelicanCode?: string | null;
  pelicanProfileId?: string | null;
  pelicanProductName?: string | null;
}): PelicanCadAsset | null {
  const identity = resolvePelicanCadIdentity(input);
  if (!identity) return null;
  const files = readyModels(identity.sku);
  if (identity.variant === "ada") return files.find((asset) => asset.variant === "ada") ?? null;
  if (identity.variant === "r15") return files.find((asset) => asset.variant === "r15") ?? null;
  if (identity.variant === "r0") {
    return files.find((asset) => asset.variant === "r0")
      ?? files.find((asset) => asset.variant === "standard")
      ?? null;
  }
  return files.find((asset) => asset.variant === "standard")
    ?? files.find((asset) => asset.variant === "r0")
    ?? null;
}

/** Every manufacturer file for this product, including drawings the designer does not draw. */
export function pelicanCadDownloads(value: string | null | undefined): readonly PelicanCadAsset[] {
  const identity = resolvePelicanCadCode(value);
  if (!identity) return [];
  return PELICAN_CAD_ASSETS.filter((asset) => asset.sku === identity.sku);
}

export function pelicanCadInchesPerUnit(unit: "mm" | "m"): number {
  return unit === "mm" ? 1 / 25.4 : 39.37007874015748;
}

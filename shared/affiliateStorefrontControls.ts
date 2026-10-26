/**
 * Pure helpers for the affiliate portal sidebar, per-product catalog
 * visibility, and white-label storefront branding. No database access.
 */

export const BODY_FONT_PRESETS = [
  { value: "Inter", label: "Inter (Modern Sans-serif)" },
  { value: "Lato", label: "Lato (Clean & Friendly)" },
  { value: "Open Sans", label: "Open Sans (Neutral)" },
  { value: "Merriweather", label: "Merriweather (Serif)" },
  { value: "Roboto", label: "Roboto (Google Default)" },
  { value: "Source Sans 3", label: "Source Sans (Professional)" },
] as const;

export const HEADING_FONT_PRESETS = [
  { value: "Playfair Display", label: "Playfair Display (Elegant Serif)" },
  { value: "Montserrat", label: "Montserrat (Bold Sans)" },
  { value: "Raleway", label: "Raleway (Geometric)" },
  { value: "Oswald", label: "Oswald (Condensed)" },
  { value: "Lora", label: "Lora (Literary Serif)" },
  { value: "Nunito", label: "Nunito (Rounded)" },
] as const;

export const SECTION_LABEL_KEYS = ["catalog", "surfaces", "closet", "designer", "quote", "cart"] as const;
export type SectionLabelKey = (typeof SECTION_LABEL_KEYS)[number];

export const DEFAULT_SECTION_LABELS: Record<SectionLabelKey, string> = {
  catalog: "Catalog",
  surfaces: "Surfaces & Fixtures",
  closet: "Closet Studio",
  designer: "3D Designer",
  quote: "Get a Quote",
  cart: "Cart",
};

export const DEFAULT_BRAND_BACKGROUND = "#ffffff";
export const DEFAULT_BRAND_TEXT = "#1a1a1a";
export const DEFAULT_BRAND_PRIMARY = "#1a2b4a";

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export type CatalogKind = "cabinet" | "hardware" | "surface" | "closet";

export type CatalogVendor = {
  key: string;
  label: string;
  kind: CatalogKind;
};

export type DistributorNavSource = {
  id: number;
  name: string;
  publicName?: string | null;
  selected?: boolean;
};

/** Hardware, Pelican, and Closet Studio ship on every affiliate storefront. */
export const PLATFORM_CATALOG_VENDORS: CatalogVendor[] = [
  { key: "hardware", label: "Hardware Resources", kind: "hardware" },
  { key: "pelican", label: "Pelican", kind: "surface" },
  { key: "closet", label: "Closets (Closet Studio)", kind: "closet" },
];

export function cabinetProductKey(distributorId: number, masterCode: string): string {
  return `${distributorId}:${masterCode.trim()}`;
}

export function parseCatalogVendorKey(key: string):
  | { kind: "cabinet"; distributorId: number }
  | { kind: "hardware" | "surface" | "closet" }
  | null {
  if (key === "hardware" || key === "pelican" || key === "closet") {
    return { kind: key === "pelican" ? "surface" : key };
  }
  const match = /^distributor:(\d+)$/.exec(key);
  if (!match) return null;
  const distributorId = Number(match[1]);
  if (!Number.isInteger(distributorId) || distributorId <= 0) return null;
  return { kind: "cabinet", distributorId };
}

/**
 * Cabinet lines come from the affiliate's distributor selections (the same
 * data as My Catalog). An empty selection keeps the legacy "all active lines"
 * behavior. Platform catalogs are always offered because no per-affiliate
 * assignment query exists for them.
 */
export function buildAffiliateCatalogVendors(
  distributors: DistributorNavSource[] | null,
): { vendors: CatalogVendor[]; source: "affiliate-catalog" | "platform-catalogs-only" } {
  if (!distributors) {
    return { vendors: [...PLATFORM_CATALOG_VENDORS], source: "platform-catalogs-only" };
  }
  const selected = distributors.filter((row) => row.selected);
  const lines = selected.length > 0 ? selected : distributors;
  const cabinetVendors = lines
    .map((row) => ({
      key: `distributor:${row.id}`,
      label: (row.publicName || row.name || `Line ${row.id}`).trim(),
      kind: "cabinet" as const,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return {
    vendors: [...cabinetVendors, ...PLATFORM_CATALOG_VENDORS],
    source: "affiliate-catalog",
  };
}

export function customerLinkVisibility(access: {
  isAffiliateOwner: boolean;
  isAdmin: boolean;
  canAccessCrm: boolean;
  canAccessDesigner: boolean;
}) {
  const full = access.isAffiliateOwner || access.isAdmin;
  const catalog = full || access.canAccessCrm || access.canAccessDesigner;
  return {
    showSection: catalog,
    catalog,
    designer: full || access.canAccessDesigner,
    closet: full || access.canAccessDesigner,
    quote: full || access.canAccessCrm,
    storefront: catalog,
  };
}

export function visibleProducts<T>(items: readonly T[], hidden: ReadonlySet<string>, keyOf: (item: T) => string): T[] {
  if (hidden.size === 0) return [...items];
  return items.filter((item) => !hidden.has(keyOf(item)));
}

export type StorefrontEditAccess = {
  affiliateId: number;
  isOwner: boolean;
  accessDesigner: boolean;
};

export function storefrontEditDecision(input: {
  role: string;
  access: StorefrontEditAccess | null;
  requestedAffiliateId?: number;
}): { ok: true; affiliateId: number } | { ok: false; message: string } {
  if (input.role === "admin") {
    if (input.requestedAffiliateId !== undefined) return { ok: true, affiliateId: input.requestedAffiliateId };
    if (input.access) return { ok: true, affiliateId: input.access.affiliateId };
    return { ok: false, message: "Choose an affiliate before editing." };
  }
  if (!input.access) return { ok: false, message: "No affiliate account linked to you." };
  if (input.requestedAffiliateId !== undefined && input.requestedAffiliateId !== input.access.affiliateId) {
    return { ok: false, message: "You can only edit your own storefront." };
  }
  if (!input.access.isOwner && !input.access.accessDesigner) {
    return { ok: false, message: "You do not have permission to edit this storefront." };
  }
  return { ok: true, affiliateId: input.access.affiliateId };
}

function expandHex(hex: string): string | null {
  const match = HEX_COLOR.exec(hex.trim());
  if (!match) return null;
  const raw = match[0].slice(1);
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  return full.toLowerCase();
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const full = expandHex(hex);
  if (!full) return null;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function channelLuminance(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function contrastRatio(foreground: string, background: string): number | null {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  if (!fg || !bg) return null;
  const l1 = 0.2126 * channelLuminance(fg.r) + 0.7152 * channelLuminance(fg.g) + 0.0722 * channelLuminance(fg.b);
  const l2 = 0.2126 * channelLuminance(bg.r) + 0.7152 * channelLuminance(bg.g) + 0.0722 * channelLuminance(bg.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isPresetFont(value: string, kind: "body" | "heading"): boolean {
  const list = kind === "body" ? BODY_FONT_PRESETS : HEADING_FONT_PRESETS;
  return list.some((font) => font.value === value);
}

export function cleanSectionLabels(input: Partial<Record<SectionLabelKey, string>> | null | undefined): Record<SectionLabelKey, string> {
  const next = { ...DEFAULT_SECTION_LABELS };
  if (!input) return next;
  for (const key of SECTION_LABEL_KEYS) {
    const value = input[key]?.trim();
    if (value) next[key] = value.slice(0, 40);
  }
  return next;
}

export function parseSectionLabels(json: string | null | undefined): Record<SectionLabelKey, string> {
  if (!json) return { ...DEFAULT_SECTION_LABELS };
  try {
    const parsed = JSON.parse(json) as Partial<Record<SectionLabelKey, string>>;
    return cleanSectionLabels(parsed);
  } catch {
    return { ...DEFAULT_SECTION_LABELS };
  }
}

export type WhiteLabelPatch = {
  primaryColor?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  fontFamily?: string | null;
  headingFont?: string | null;
};

/** Returns an error message when a branding patch is unsafe to store. */
export function validateWhiteLabelPatch(patch: WhiteLabelPatch): string | null {
  for (const key of ["primaryColor", "accentColor", "backgroundColor", "textColor"] as const) {
    const value = patch[key];
    if (value == null || value === "") continue;
    if (!HEX_COLOR.test(value.trim())) return `${key} must be a hex color like #1a2b4a.`;
  }
  if (patch.fontFamily) {
    if (!isPresetFont(patch.fontFamily, "body")) return "Choose a body font from the preset list.";
  }
  if (patch.headingFont) {
    if (!isPresetFont(patch.headingFont, "heading")) return "Choose a heading font from the preset list.";
  }
  const colorTouched = patch.primaryColor !== undefined || patch.backgroundColor !== undefined || patch.textColor !== undefined;
  if (!colorTouched) return null;
  const background = patch.backgroundColor || DEFAULT_BRAND_BACKGROUND;
  const primary = patch.primaryColor || DEFAULT_BRAND_PRIMARY;
  if (patch.primaryColor || patch.backgroundColor) {
    const primaryContrast = contrastRatio(primary, background);
    if (primaryContrast != null && primaryContrast < 3) {
      return "Primary color does not have enough contrast against the background. Choose a darker or lighter primary.";
    }
  }
  if (patch.textColor || patch.backgroundColor) {
    const text = patch.textColor || DEFAULT_BRAND_TEXT;
    const textContrast = contrastRatio(text, background);
    if (textContrast != null && textContrast < 4.5) {
      return "Text color does not have enough contrast against the background (need at least 4.5:1).";
    }
  }
  return null;
}

export function publicContactForStorefront(row: {
  publicEmail?: string | null;
  publicPhone?: string | null;
  publicAddress?: string | null;
  showPublicEmail?: boolean | null;
  showPublicPhone?: boolean | null;
  showPublicAddress?: boolean | null;
  serviceArea?: string | null;
}) {
  return {
    email: row.showPublicEmail ? (row.publicEmail?.trim() || null) : null,
    phone: row.showPublicPhone ? (row.publicPhone?.trim() || null) : null,
    address: row.showPublicAddress ? (row.publicAddress?.trim() || null) : null,
    serviceArea: row.serviceArea?.trim() || null,
  };
}

export function storefrontCssVars(brand: {
  primaryColor?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  fontFamily?: string | null;
  headingFont?: string | null;
  buttonRadius?: string | null;
}): Record<string, string> {
  const vars: Record<string, string> = {
    "--sf-primary": brand.primaryColor || DEFAULT_BRAND_PRIMARY,
    "--sf-accent": brand.accentColor || "#c9a227",
  };
  if (brand.backgroundColor) vars["--sf-bg"] = brand.backgroundColor;
  if (brand.textColor) vars["--sf-text"] = brand.textColor;
  if (brand.fontFamily) vars["--sf-font-body"] = `"${brand.fontFamily}", sans-serif`;
  if (brand.headingFont) vars["--sf-font-heading"] = `"${brand.headingFont}", serif`;
  if (brand.buttonRadius) vars["--sf-btn-radius"] = brand.buttonRadius;
  return vars;
}

export const WHITE_LABEL_RESET = {
  primaryColor: null,
  accentColor: null,
  backgroundColor: null,
  textColor: null,
  fontFamily: null,
  headingFont: null,
  buttonRadius: "0.375rem",
  logoUrl: null,
  logoDarkUrl: null,
  faviconUrl: null,
  heroImageUrl: null,
  footerText: null,
  hidePlatformBranding: false,
  showPublicEmail: false,
  showPublicPhone: false,
  showPublicAddress: false,
  publicEmail: null,
  publicPhone: null,
  publicAddress: null,
  sectionLabels: { ...DEFAULT_SECTION_LABELS },
} as const;

/**
 * Products & Catalog navigation.
 *
 * Top-level sections group the old flat tabs. Every historical `?tab=` value
 * stays a leaf so existing links open the same editor inside its new section.
 * A section id (for example `door-styles`) opens that section's first editor.
 */

export type CatalogLeaf = {
  value: string;
  label: string;
  /** Component names that must stay mounted for this editor. */
  editors: readonly string[];
  /** AdminTabHelp `tab` prop, when this editor already had help text. */
  help: string | null;
  /** AdminTabErrorBoundary `tabName`. */
  boundary: string;
};

export type CatalogSubgroup = {
  /** Visible cluster label. Empty when the section has a single row of sub-tabs. */
  label: string;
  leaves: readonly CatalogLeaf[];
};

export type CatalogSection = {
  id: string;
  label: string;
  groups: readonly CatalogSubgroup[];
};

export type ResolvedCatalogTab = {
  sectionId: string;
  sectionLabel: string;
  tabValue: string;
  tabLabel: string;
  editors: readonly string[];
  help: string | null;
  boundary: string;
};

export const CATALOG_SECTIONS: readonly CatalogSection[] = [
  {
    id: "cabinets",
    label: "Catalog",
    groups: [{
      label: "",
      leaves: [{
        value: "cabinets",
        label: "Catalog",
        editors: ["GenericCabinetsAdmin", "CabinetSpreadsheetAdmin", "CabinetLineDownload"],
        help: "cabinets",
        boundary: "Catalog",
      }],
    }],
  },
  {
    id: "door-styles",
    label: "Door styles",
    groups: [{
      label: "",
      leaves: [
        { value: "featured", label: "Featured Styles", editors: ["FeaturedStylesAdmin"], help: "featured", boundary: "Featured Styles" },
        { value: "door-corrections", label: "Door Corrections", editors: ["DoorCorrectionsAdmin"], help: "door-corrections", boundary: "Door Corrections" },
        { value: "door-rendering-audit", label: "Door Rendering Audit", editors: ["DoorRenderingAuditAdmin"], help: "door-rendering-audit", boundary: "Door Rendering Audit" },
      ],
    }],
  },
  {
    id: "catalog-images",
    label: "Images",
    groups: [{
      label: "",
      leaves: [
        { value: "images", label: "Product Images", editors: ["SkuImageManager"], help: "images", boundary: "Product Images" },
        { value: "media-library", label: "📁 Media Library", editors: ["MediaLibraryAdmin"], help: null, boundary: "📁 Media Library" },
        { value: "generated-design-images", label: "✨ Generated Design Images", editors: ["GeneratedDesignImagesAdmin"], help: null, boundary: "✨ Generated Design Images" },
      ],
    }],
  },
  {
    id: "suppliers",
    label: "Suppliers",
    groups: [{
      label: "",
      leaves: [
        {
          value: "distributors",
          label: "Distributors",
          editors: ["LineBrandingEditor", "DistributorFulfillmentEditor", "DistributorImport"],
          help: "distributors",
          boundary: "Distributors",
        },
        { value: "glass-policy", label: "Glass Policy", editors: ["DistributorFulfillmentEditor"], help: "glass-policy", boundary: "Glass Policy" },
        { value: "catalog-importer", label: "📥 Catalog Importer", editors: ["CatalogImporterTab"], help: null, boundary: "📥 Catalog Importer" },
        { value: "pending-distributor-connections", label: "✎ Supplier Products", editors: ["PendingDistributorConnectionsAdmin"], help: null, boundary: "✎ Supplier Products" },
        { value: "vendor-onboarding", label: "Vendor Onboarding", editors: ["VendorOnboardingAdmin"], help: "vendor-onboarding", boundary: "Vendor Onboarding" },
      ],
    }],
  },
  {
    id: "cabinet-config",
    label: "Cabinet Config",
    groups: [{
      label: "",
      leaves: [{ value: "cabinet-config", label: "Cabinet Config", editors: ["CabinetConfigAdmin"], help: null, boundary: "Cabinet Config" }],
    }],
  },
  {
    id: "categories",
    label: "Categories",
    groups: [{
      label: "",
      leaves: [{ value: "categories", label: "Categories", editors: ["CategoriesAdmin"], help: null, boundary: "Categories" }],
    }],
  },
  {
    id: "package-data",
    label: "📦 Package Data & Parcel",
    groups: [{
      label: "",
      leaves: [{ value: "package-data", label: "📦 Package Data & Parcel", editors: ["BulkDimensionsAdmin"], help: null, boundary: "📦 Package Data & Parcel" }],
    }],
  },
  {
    id: "pelican-catalog",
    label: "Pelican Catalog",
    groups: [{
      label: "",
      leaves: [{ value: "pelican-catalog", label: "Pelican Catalog", editors: ["PelicanCatalogAdmin"], help: null, boundary: "Pelican Catalog" }],
    }],
  },
  {
    id: "bundle-deals",
    label: "📦 Kitchen Packages",
    groups: [{
      label: "",
      leaves: [{ value: "bundle-deals", label: "📦 Kitchen Packages", editors: ["BundleDealsAdmin"], help: null, boundary: "📦 Kitchen Packages" }],
    }],
  },
  {
    id: "price-shop-10x10",
    label: "10×10 Price Shop",
    groups: [{
      label: "",
      leaves: [{ value: "price-shop-10x10", label: "10×10 Price Shop", editors: ["PriceShop10x10"], help: null, boundary: "10×10 Price Shop" }],
    }],
  },
  {
    id: "catalog-quality",
    label: "Data quality",
    groups: [
      {
        label: "Duplicates & identity",
        leaves: [
          { value: "conflicts", label: "Conflicts", editors: ["ConflictsAdmin"], help: "conflicts", boundary: "Conflicts" },
          { value: "merge-suggestions", label: "Merge Suggestions", editors: ["PotentialMergesAdmin"], help: null, boundary: "Merge Suggestions" },
          { value: "master-sku", label: "Master SKU Aliases", editors: ["MasterSkuAdmin"], help: null, boundary: "Master SKU Aliases" },
          { value: "master-changes", label: "Master Changes", editors: ["MasterChangesAdmin"], help: null, boundary: "Master Changes" },
        ],
      },
      {
        label: "Price & publish",
        leaves: [
          { value: "unpriced-items", label: "⚠ Unpriced Items", editors: ["UnpricedCabinetsAdmin"], help: null, boundary: "⚠ Unpriced Items" },
          { value: "designer-price-flags", label: "🚩 Designer Price Flags", editors: ["DesignerPriceFlagsAdmin"], help: null, boundary: "🚩 Designer Price Flags" },
          { value: "pending-review", label: "⏳ Pending Review", editors: ["PendingReviewAdmin"], help: null, boundary: "⏳ Pending Review" },
        ],
      },
      {
        label: "Review & recovery",
        leaves: [
          { value: "cabinet-attention", label: "⚠ Cabinet Attention", editors: ["CabinetConfigReviewQueueAdmin"], help: null, boundary: "⚠ Cabinet Attention" },
          { value: "data-recovery", label: "🛟 Data Recovery", editors: ["DataRecoveryAdmin"], help: null, boundary: "🛟 Data Recovery" },
        ],
      },
    ],
  },
];

export function catalogLeaves(section?: CatalogSection): CatalogLeaf[] {
  const sections = section ? [section] : CATALOG_SECTIONS;
  return sections.flatMap((item) => item.groups.flatMap((group) => [...group.leaves]));
}

const leafIndex = new Map<string, { section: CatalogSection; leaf: CatalogLeaf }>();
const sectionIndex = new Map<string, CatalogSection>();

for (const section of CATALOG_SECTIONS) {
  sectionIndex.set(section.id, section);
  for (const leaf of catalogLeaves(section)) {
    if (leafIndex.has(leaf.value)) {
      throw new Error(`Duplicate Products & Catalog tab value: ${leaf.value}`);
    }
    leafIndex.set(leaf.value, { section, leaf });
  }
}

function toResolved(section: CatalogSection, leaf: CatalogLeaf): ResolvedCatalogTab {
  return {
    sectionId: section.id,
    sectionLabel: section.label,
    tabValue: leaf.value,
    tabLabel: leaf.label,
    editors: leaf.editors,
    help: leaf.help,
    boundary: leaf.boundary,
  };
}

/**
 * Map a `?tab=` value to the editor it must open.
 * Leaf values stay on that editor. A section id opens the section's first editor.
 * Any other value is not a catalog tab.
 */
export function resolveCatalogTab(value: string | null | undefined): ResolvedCatalogTab | null {
  if (!value) return null;
  const direct = leafIndex.get(value);
  if (direct) return toResolved(direct.section, direct.leaf);
  const section = sectionIndex.get(value);
  const first = section ? catalogLeaves(section)[0] : undefined;
  if (!section || !first) return null;
  return toResolved(section, first);
}

/** Tab value stored in the URL and in admin tab state. */
export function canonicalAdminTab(value: string): string {
  return resolveCatalogTab(value)?.tabValue ?? value;
}

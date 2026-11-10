/**
 * Admin Legal tab: each distributor's shipping, return, and warranty wording,
 * captured unaltered, plus Cabinet Deals' own return rules kept beside them.
 *
 * The captured paragraphs live in distributorLegalTerms.captures.ts. This file
 * does not rewrite them. A saved admin edit replaces what the tab shows for
 * that one section; it never copies Cabinet Deals' rules into a distributor
 * section, and it never copies a warranty into a return section.
 */
import { LEGAL_CAPTURE_TEXT } from "./distributorLegalTerms.captures";

export const LEGAL_CAPTURED_ON = "2026-11-10";

/** Empty distributor section. Admins paste the distributor's own wording here. */
export const PASTE_DISTRIBUTOR_TERMS = "paste distributor terms here";

export const CABINET_DEALS_DISTRIBUTOR_KEY = "cabinet-deals";
export const CABINET_DEALS_RETURN_SECTION = "return-rules";

/** Two Cabinet Deals return rules. They sit on top of each distributor's own return wording. */
export const CABINET_DEALS_RETURN_RULES = [
  "No product may be returned without prior approval.",
  "Any product that has been opened is not returnable.",
] as const;

/**
 * Cabinet Deals restocking fee. Its own line. Spelled the way Tom stated it.
 * Applies to returns, cancellations after loading, and unclaimed orders.
 * It is not written into any distributor's shipping, return, or warranty text.
 */
export const CABINET_DEALS_RESTOCKING_FEE =
  "A restocking fee of thirty percent (30%) applies to returns, cancellations after loading, and unclaimed orders.";

export const CABINET_DEALS_RETURN_RULES_TEXT = [
  ...CABINET_DEALS_RETURN_RULES,
  CABINET_DEALS_RESTOCKING_FEE,
].join("\n");

export type LegalSectionKey = "shipping" | "returns" | "warranty";

export const LEGAL_SECTION_KEYS: readonly LegalSectionKey[] = ["shipping", "returns", "warranty"];

export const LEGAL_SECTION_LABEL: Record<LegalSectionKey, string> = {
  shipping: "Shipping Terms",
  returns: "Return Terms",
  warranty: "Warranty",
};

export type LegalCapture = {
  sourceUrl: string;
  capturedOn: string;
  /** The distributor's own words. Not a summary. */
  text: string;
};

export type DistributorLegalSeed = {
  key: string;
  name: string;
  /** Faircrest is Clark and Son. Null when the distributor has no second legal name. */
  legalName: string | null;
  /** Tom's badge. Null when he did not name one. The warranty text is never rewritten to match a badge. */
  warrantyBadge: string | null;
  warrantyBadgeDetail: string | null;
  /**
   * Set when the distributor publishes shipping and returns as one page.
   * Both sections then show that page, unaltered.
   */
  combinedPageNote: string | null;
  sections: Record<LegalSectionKey, readonly LegalCapture[]>;
};

function capture(sourceUrl: string, text: string): LegalCapture {
  return { sourceUrl, capturedOn: LEGAL_CAPTURED_ON, text: text.trim() };
}

const USCD_TERMS = "https://www.uscabinetdepot.com/terms-and-conditions";
const USCD_WARRANTY = "https://www.uscabinetdepot.com/warranty";
const FAIRCREST_SHIPPING = "https://www.faircrestcabinets.com/shipping-policy/";
const FAIRCREST_FAQ = "https://www.faircrestcabinets.com/faqs";
const FAIRCREST_RETURNS = "https://www.faircrestcabinets.com/return-refund-policy/";
const FAIRCREST_WARRANTY = "https://www.faircrestcabinets.com/media/catalog/Clark-Son-Catalog-2023.pdf";
const SKYLINE_PAGE = "https://shop.skylinecabinetry.com/shipping-returns";
const SKYLINE_WARRANTY = "https://shop.skylinecabinetry.com/warranty";
const MILESTONE_PAGE = "https://shop.milestonecabinetry.com/shipping-returns";
const MILESTONE_WARRANTY = "https://shop.milestonecabinetry.com/warranty";
const PELICAN_RETURNS = "https://buildpelican.com/pages/returns";
const PELICAN_SALE_TERMS = "https://buildpelican.com/pages/terms-of-service";
const PELICAN_TERMS = "https://buildpelican.com/pages/terms-conditions";

export const DISTRIBUTOR_LEGAL_SEEDS: readonly DistributorLegalSeed[] = [
  {
    key: "us-cabinet-depot",
    name: "U.S. Cabinet Depot",
    legalName: null,
    warrantyBadge: "Lifetime",
    warrantyBadgeDetail: "Limited Lifetime warranty, from Brothers Global Inc.",
    combinedPageNote: null,
    sections: {
      shipping: [capture(USCD_TERMS, LEGAL_CAPTURE_TEXT.uscd_ship)],
      returns: [capture(USCD_TERMS, LEGAL_CAPTURE_TEXT.uscd_return)],
      warranty: [capture(USCD_WARRANTY, LEGAL_CAPTURE_TEXT.uscd_warr)],
    },
  },
  {
    key: "skyline",
    name: "Skyline",
    legalName: null,
    warrantyBadge: "One year",
    warrantyBadgeDetail: "The distributor's page is titled Limited 12 Month Warranty and says twelve months. That page is shown unaltered.",
    combinedPageNote: "Skyline publishes shipping and returns as one page. Both sections show that page unaltered.",
    sections: {
      shipping: [capture(SKYLINE_PAGE, LEGAL_CAPTURE_TEXT.sky_ship)],
      returns: [capture(SKYLINE_PAGE, LEGAL_CAPTURE_TEXT.sky_ship)],
      warranty: [capture(SKYLINE_WARRANTY, LEGAL_CAPTURE_TEXT.sky_w)],
    },
  },
  {
    key: "faircrest",
    name: "Faircrest",
    legalName: "Clark and Son",
    warrantyBadge: null,
    warrantyBadgeDetail: null,
    combinedPageNote: null,
    sections: {
      shipping: [
        capture(FAIRCREST_SHIPPING, LEGAL_CAPTURE_TEXT.fair_ship),
        capture(FAIRCREST_FAQ, LEGAL_CAPTURE_TEXT.fair_faq),
      ],
      returns: [capture(FAIRCREST_RETURNS, LEGAL_CAPTURE_TEXT.fair_ret)],
      warranty: [capture(FAIRCREST_WARRANTY, LEGAL_CAPTURE_TEXT.fair_w)],
    },
  },
  {
    key: "milestone",
    name: "Milestone Cabinetry",
    legalName: null,
    warrantyBadge: "12 months",
    warrantyBadgeDetail: "The distributor's page is titled Limited 12 Month Warranty and says twelve months. That page is shown unaltered.",
    combinedPageNote: "Milestone Cabinetry publishes shipping and returns as one page. Both sections show that page unaltered.",
    sections: {
      shipping: [capture(MILESTONE_PAGE, LEGAL_CAPTURE_TEXT.mil_ship)],
      returns: [capture(MILESTONE_PAGE, LEGAL_CAPTURE_TEXT.mil_ship)],
      warranty: [capture(MILESTONE_WARRANTY, LEGAL_CAPTURE_TEXT.mil_w)],
    },
  },
  {
    key: "pelican",
    name: "Pelican",
    legalName: "Pelican Int'l",
    warrantyBadge: null,
    warrantyBadgeDetail: null,
    combinedPageNote: null,
    sections: {
      shipping: [
        capture(PELICAN_SALE_TERMS, LEGAL_CAPTURE_TEXT.pel_delivery),
        capture(PELICAN_TERMS, LEGAL_CAPTURE_TEXT.pel_quote),
      ],
      returns: [
        capture(PELICAN_RETURNS, LEGAL_CAPTURE_TEXT.pel_ret),
        capture(PELICAN_SALE_TERMS, LEGAL_CAPTURE_TEXT.pel_returning),
        capture(PELICAN_TERMS, LEGAL_CAPTURE_TEXT.pel_quote),
      ],
      warranty: [capture(PELICAN_SALE_TERMS, LEGAL_CAPTURE_TEXT.pel_guarantee)],
    },
  },
];

/** Pages and files already in this repo. None of them is used as a distributor's unaltered text. */
export const LEGAL_REPO_REFERENCES: readonly {
  path: string;
  route: string | null;
  note: string;
}[] = [
  {
    path: "client/src/pages/ShippingPolicy.tsx",
    route: "/shipping-policy",
    note: "Cabinet Deals shipping page. It paraphrases U.S. Cabinet Depot and does not match the lead times on the page captured 2026-11-10. Not used as the distributor text.",
  },
  {
    path: "client/src/pages/ReturnPolicy.tsx",
    route: "/return-policy",
    note: "Cabinet Deals return page. The Clark & Son section is a shortened copy of the Faircrest return page, and it also carries a Forevermark warranty. Forevermark is not a distributor on this tab. The official Faircrest pages were captured instead.",
  },
  {
    path: "client/src/pages/Terms.tsx",
    route: "/terms",
    note: "Cabinet Deals Terms & Conditions. It points at the shipping and return pages. It is not a distributor's terms.",
  },
  {
    path: "client/src/lib/pelicanSinkCatalogDescriptions.ts",
    route: null,
    note: "Per-sink marketing lines that mention a limited lifetime warranty. Not Pelican's warranty policy, so not used as the warranty section.",
  },
  {
    path: "shared/pelicanComparablePackaging.ts",
    route: null,
    note: "Pelican Clearwater warehouse address used for freight quotes. Not shipping terms.",
  },
];

export type StoredLegalTerm = {
  distributorKey: string;
  sectionKey: string;
  bodyText: string | null;
  updatedByName: string | null;
  updatedAt: string | null;
};

export function distributorLegalSeed(key: string): DistributorLegalSeed | undefined {
  return DISTRIBUTOR_LEGAL_SEEDS.find((seed) => seed.key === key);
}

/** Join every capture for a section. Nothing is added between them except a blank line. */
export function capturedSectionText(captures: readonly LegalCapture[]): string {
  return captures.map((item) => item.text.trim()).filter(Boolean).join("\n\n");
}

export function storedLegalTerm(
  rows: readonly StoredLegalTerm[] | null | undefined,
  distributorKey: string,
  sectionKey: string,
): StoredLegalTerm | undefined {
  return rows?.find((row) => row.distributorKey === distributorKey && row.sectionKey === sectionKey);
}

export type ResolvedLegalSection = {
  text: string;
  empty: boolean;
  /** True once an admin has saved this section, including a save that clears it. */
  edited: boolean;
  updatedByName: string | null;
  updatedAt: string | null;
};

/**
 * A null stored body means "show the capture". A saved string, including an
 * empty one, is what the admin pasted and replaces the capture on screen.
 */
export function resolveLegalSection(
  seedText: string,
  stored: StoredLegalTerm | undefined,
): ResolvedLegalSection {
  if (stored && stored.bodyText != null) {
    return {
      text: stored.bodyText,
      empty: stored.bodyText.trim() === "",
      edited: true,
      updatedByName: stored.updatedByName,
      updatedAt: stored.updatedAt,
    };
  }
  return {
    text: seedText,
    empty: seedText.trim() === "",
    edited: false,
    updatedByName: null,
    updatedAt: null,
  };
}

export function resolveDistributorSection(
  seed: DistributorLegalSeed,
  section: LegalSectionKey,
  rows: readonly StoredLegalTerm[] | null | undefined,
): ResolvedLegalSection {
  return resolveLegalSection(capturedSectionText(seed.sections[section]), storedLegalTerm(rows, seed.key, section));
}

export function resolveCabinetDealsReturnRules(
  rows: readonly StoredLegalTerm[] | null | undefined,
): ResolvedLegalSection {
  return resolveLegalSection(
    CABINET_DEALS_RETURN_RULES_TEXT,
    storedLegalTerm(rows, CABINET_DEALS_DISTRIBUTOR_KEY, CABINET_DEALS_RETURN_SECTION),
  );
}

/** Split the shared block so the restocking fee stays its own line. */
export function splitCabinetDealsReturnRules(text: string): { rules: string[]; restockingFee: string | null } {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const restockingFee = lines.find((line) => line.includes("thirty percent (30%)")) ?? null;
  return {
    rules: lines.filter((line) => line !== restockingFee),
    restockingFee,
  };
}

/** Cabinet Deals' spelled-out fee must not be pasted into a distributor section. */
export function distributorTextContainsCabinetDealsFee(text: string): boolean {
  return text.includes("thirty percent (30%)");
}

/**
 * Faircrest (Clark & Son) description replacements.
 *
 * Source: Faircrest Cabinets Product Specification Guide, November 2026
 * Edition. Read from the pages Kitchen agent bc-042661fc extracted while
 * loading that guide. That agent had not pushed a branch. The companion
 * brochure (Faircrest Cabinets Kitchen & Bath Cabinetry, November 2026
 * Edition) was not used: its SKU tables were not in the extract.
 *
 * Each `from` string is the description on the cabinet snapshot Auto Design
 * and the door-style catalog preview share (style 330011 in
 * autoDesignRealCatalog.json). `to` is the guide's DESCRIPTION cell,
 * copied exactly. Codes the guide names but the snapshot does not contain
 * are omitted. No code is deleted.
 */

export type FaircrestDescriptionReplacement = {
  masterCode: string;
  from: string;
  to: string;
  section: string;
  source: string;
};

export const FAIRCREST_NOV_2026_DESCRIPTION_SOURCE =
  "Faircrest Cabinets Product Specification Guide, November 2026 Edition";

export const FAIRCREST_NOV_2026_DESCRIPTION_REPLACEMENTS: readonly FaircrestDescriptionReplacement[] = [
  {
    masterCode: "WBC2730",
    from: "27\" × 30\" × 12\" Wall Blind Corner Cabinet — 1 Door, 2 Shelves",
    to: "27\" x 30\" Blind Corner Wall Cabinet",
    section: "Blind Corner Wall Cabinets",
    source: FAIRCREST_NOV_2026_DESCRIPTION_SOURCE,
  },
  {
    masterCode: "WBC2736",
    from: "27\" × 36\" × 12\" Wall Blind Corner Cabinet — 1 Door, 2 Shelves",
    to: "27\" x 36\" Blind Corner Wall Cabinet",
    section: "Blind Corner Wall Cabinets",
    source: FAIRCREST_NOV_2026_DESCRIPTION_SOURCE,
  },
  {
    masterCode: "WBC2742",
    from: "27\" × 42\" × 12\" Wall Blind Corner Cabinet — 1 Door, 3 Shelves",
    to: "27\" x 42\" Blind Corner Wall Cabinet",
    section: "Blind Corner Wall Cabinets",
    source: FAIRCREST_NOV_2026_DESCRIPTION_SOURCE,
  },
  {
    masterCode: "W2412PG",
    from: "24\" W x 12\" H x 12\" D Wall Stacker Cabinet — Plain Glass (PG) Door(s), glass included; door count TBD",
    to: "24\" x 12\" Wall Cabinet w/Plain Glass Doors",
    section: "Double Door Glass Stacker Cabinets",
    source: FAIRCREST_NOV_2026_DESCRIPTION_SOURCE,
  },
  {
    masterCode: "W2712PG",
    from: "27\" W x 12\" H x 12\" D Wall Stacker Cabinet — 2 Plain Glass (PG) Doors, glass included",
    to: "27\" x 12\" Wall Cabinet w/Plain Glass Doors",
    section: "Double Door Glass Stacker Cabinets",
    source: FAIRCREST_NOV_2026_DESCRIPTION_SOURCE,
  },
  {
    masterCode: "W3012PG",
    from: "30\" W x 12\" H x 12\" D Wall Stacker Cabinet — 2 Plain Glass (PG) Doors, glass included",
    to: "30\" x 12\" Wall Cabinet w/Plain Glass Doors",
    section: "Double Door Glass Stacker Cabinets",
    source: FAIRCREST_NOV_2026_DESCRIPTION_SOURCE,
  },
  {
    masterCode: "W3312PG",
    from: "33\" W x 12\" H x 12\" D Wall Stacker Cabinet — 2 Plain Glass (PG) Doors, glass included",
    to: "33\" x 12\" Wall Cabinet w/Plain Glass Doors",
    section: "Double Door Glass Stacker Cabinets",
    source: FAIRCREST_NOV_2026_DESCRIPTION_SOURCE,
  },
  {
    masterCode: "W3612PG",
    from: "36\" W x 12\" H x 12\" D Wall Stacker Cabinet — 2 Plain Glass (PG) Doors, glass included",
    to: "36\" x 12\" Wall Cabinet w/Plain Glass Doors",
    section: "Double Door Glass Stacker Cabinets",
    source: FAIRCREST_NOV_2026_DESCRIPTION_SOURCE,
  },
  {
    masterCode: "MW3030",
    from: "30\" Microwave Wall Cabinet",
    to: "30\" x 30\" Microwave Cabinet",
    section: "Microwave Wall Cabinets",
    source: FAIRCREST_NOV_2026_DESCRIPTION_SOURCE,
  },
  {
    masterCode: "MW3036",
    from: "30\" Microwave Wall Cabinet",
    to: "30\" x 36\" Microwave Cabinet",
    section: "Microwave Wall Cabinets",
    source: FAIRCREST_NOV_2026_DESCRIPTION_SOURCE,
  },
  {
    masterCode: "MW3042",
    from: "30\" Microwave Wall Cabinet",
    to: "30\" x 42\" Microwave Cabinet",
    section: "Microwave Wall Cabinets",
    source: FAIRCREST_NOV_2026_DESCRIPTION_SOURCE,
  },
  {
    masterCode: "AG2418",
    from: "24\" x 18\" Single Door Appliance Garage Cabinet",
    to: "Appliance Garage",
    section: "Appliance Garage",
    source: FAIRCREST_NOV_2026_DESCRIPTION_SOURCE,
  },
  {
    masterCode: "WEP1542",
    from: "Wall End Panel — 15\" W x 42\" H; thickness TBD",
    to: "15\" x 42\" Wall End Panels",
    section: "End Panels",
    source: FAIRCREST_NOV_2026_DESCRIPTION_SOURCE,
  },
  {
    masterCode: "LCM8",
    from: "Crown Molding - 96\"",
    to: "8\" Crown Moulding",
    section: "Crown Mouldings",
    source: FAIRCREST_NOV_2026_DESCRIPTION_SOURCE,
  },
];

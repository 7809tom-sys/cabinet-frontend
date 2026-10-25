export type AefFramelessSpec = {
  boxConstruction: string;
  drawerConstruction: string;
  hardware: string;
  overlayType: string | null;
  doorPanelType: string;
  finishSheen: "matte" | "gloss" | "satin";
  profileNotes: string;
  profileDescription: string;
  sourceSpecification: string;
};

const COMMON_BOX = "18mm plywood composite cabinet box";
const COMMON_DRAWERS = "altamax full-extension soft-close drawers";
const COMMON_HINGES = "Adjustable 110° soft-close hinges";
const COMMON_GEOMETRY = "SKU dims: bases 30-1/4\" H × 24\" D; walls 13-1/2\" D.";
const COMMON_EMISSIONS = "CARB II emissions compliant";

export function aefFramelessSpec(styleCode: string): AefFramelessSpec | null {
  if (["TWP", "TGW", "TDW"].includes(styleCode)) {
    return {
      boxConstruction: COMMON_BOX,
      drawerConstruction: `${COMMON_DRAWERS} (Orion Grey drawer box)`,
      hardware: COMMON_HINGES,
      overlayType: null,
      doorPanelType: "Textured melamine woodgrain slab front; matching back",
      finishSheen: "satin",
      profileNotes: `${COMMON_GEOMETRY} ${COMMON_EMISSIONS} Easylevel adjustable leg system. Overall base height and leg height are not stated in the supplied sheet.`,
      profileDescription: "Torino: textured melamine woodgrain slab front with matching back; 18mm plywood composite box; altamax soft-close drawers; adjustable 110° soft-close hinges.",
      sourceSpecification: "altaeuro Collection Full Spec Book V8.2 — Torino door-style specification; base/wall dimension tables",
    };
  }
  if (styleCode === "PGW") {
    return {
      boxConstruction: COMMON_BOX,
      drawerConstruction: `${COMMON_DRAWERS} (Orion Grey drawer box)`,
      hardware: COMMON_HINGES,
      overlayType: null,
      doorPanelType: "High-gloss PET laminate slab front; white melamine back",
      finishSheen: "gloss",
      profileNotes: `${COMMON_GEOMETRY} ${COMMON_EMISSIONS} Easylevel adjustable leg system. Overall base height and leg height are not stated in the supplied sheet.`,
      profileDescription: "Palermo Gloss White: high-gloss PET laminate slab front with white melamine back; 18mm plywood composite box; altamax soft-close drawers; adjustable 110° soft-close hinges.",
      sourceSpecification: "altaeuro Collection Full Spec Book V8.2 — Palermo door-style specification; base/wall dimension tables",
    };
  }
  const isZenit = styleCode.startsWith("Z");
  const isLuxe = styleCode.startsWith("LS");
  const isSyncron = styleCode.startsWith("SS") || styleCode.startsWith("SC");
  if (!isZenit && !isLuxe && !isSyncron) return null;
  const slimCava = styleCode.startsWith("SC") || styleCode.startsWith("ZC");
  const family = isZenit ? "Zenit" : isLuxe ? "Luxe" : "Syncron";
  const finishType = isZenit ? "supermatte" : isLuxe ? "high-gloss" : "textured";
  const core = isSyncron ? "engineered wood core made from 70% recycled material" : "MDF core";
  const thickness = isLuxe ? "Slab: 3/4\"" : slimCava ? "Slim Cava: 7/8\"" : "Slab: 3/4\"";
  return {
    boxConstruction: "18mm plywood composite cabinet box; standard altaeuro frameless box",
    drawerConstruction: "altamax soft-close drawers",
    hardware: "110° soft-close hinges",
    overlayType: null,
    doorPanelType: `${slimCava ? "Slim Cava" : "Slab"} door, ${thickness}; edge banded`,
    finishSheen: isZenit ? "matte" : isLuxe ? "gloss" : "satin",
    profileNotes: `${COMMON_GEOMETRY} ${COMMON_EMISSIONS} Made-to-order; lead time 18–20 business days. ${family} ${finishType}; ${core}. Overall base/leg height not stated.`,
    profileDescription: `${family} ${finishType} ${slimCava ? "Slim Cava" : "Slab"}: ${core}; ${finishType} surface; ${thickness}; edge banded; CARB II; 18mm plywood composite box; altamax soft-close drawers; 110° hinges.`,
    sourceSpecification: "altaeuro Studio Series Spec Sheet V1 / V10.2026; altaeuro Collection Full Spec Book V8.2 — base/wall dimension tables",
  };
}

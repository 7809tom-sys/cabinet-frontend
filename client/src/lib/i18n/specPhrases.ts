/**
 * Deterministic Spanish translator for structured cabinet/door spec text.
 *
 * Catalog descriptions are short, highly patterned product-spec phrases
 * (e.g. `36x42 Double Door Wall Cabinet with 4 Adjustable Shelves`). Rather
 * than send every row through an LLM, we translate the known vocabulary with
 * an ordered list of phrase replacements. This is:
 *   - instant + offline (no network, no cost),
 *   - stable across renders (pure function),
 *   - safe: anything we don't recognize is simply left in English.
 *
 * Order matters — longer / multi-word phrases are listed before the shorter
 * tokens they contain so we don't partially translate them.
 *
 * Dimensions, inch marks, SKU codes in parentheses, and numbers are preserved
 * verbatim. Only language tokens are swapped.
 */

type Rule = [RegExp, string];

// Built once at module load. Each rule is case-insensitive and global.
// Multi-word phrases first, then qualifiers, then single nouns/adjectives.
const RAW_RULES: Array<[string, string]> = [
  // ---- Compound / multi-word phrases (must precede their sub-tokens) ----
  ["Microwave/Oven Combo Cabinet", "Gabinete Combo Microondas/Horno"],
  ["Microwave/Oven Combo", "Combo Microondas/Horno"],
  ["Base Waste Basket Cabinet", "Gabinete de Base para Bote de Basura"],
  ["Trash Can Pull-Out", "Extraíble para Bote de Basura"],
  ["Pull-Out Waste Bin", "Bote de Basura Extraíble"],
  ["Waste Basket", "Bote de Basura"],
  ["Easy Reach with Lazy Susan", "de Fácil Alcance con Bandeja Giratoria"],
  ["Lazy Susan", "Bandeja Giratoria"],
  ["Blind Corner", "Esquina Ciega"],
  ["Diagonal Corner", "Esquina Diagonal"],
  ["Angle Crown Molding", "Moldura de Corona Angular"],
  ["Crown Molding", "Moldura de Corona"],
  ["Tall Decorative End Panel", "Panel Lateral Decorativo Alto"],
  ["Decorative End Panel", "Panel Lateral Decorativo"],
  ["Open End Shelf", "Repisa de Extremo Abierto"],
  ["Base End Shelf", "Repisa de Extremo de Base"],
  ["Microwave Shelf", "Repisa para Microondas"],
  ["Roll Out Shelf", "Repisa Extraíble"],
  ["Roll-Out Shelf", "Repisa Extraíble"],
  ["Roll-Out Tray", "Bandeja Extraíble"],
  ["Roll Out Tray", "Bandeja Extraíble"],
  ["Tray Divider Insert", "Inserto Divisor de Bandejas"],
  ["Tray Divider", "Divisor de Bandejas"],
  ["Range Hood Cabinet", "Gabinete para Campana de Estufa"],
  ["Range Hood", "Campana de Estufa"],
  ["Refrigerator Wall Cabinet", "Gabinete de Pared para Refrigerador"],
  ["Wall Microwave Shelf", "Repisa de Pared para Microondas"],
  ["Bridge Wall Cabinet", "Gabinete de Pared Puente"],
  ["Stacker Wall Cabinet", "Gabinete de Pared Apilable"],
  ["Single Door Wall Cabinet", "Gabinete de Pared de Una Puerta"],
  ["Double Door Wall Cabinet", "Gabinete de Pared de Dos Puertas"],
  ["Wall Cabinet", "Gabinete de Pared"],
  ["Tall Utility Cabinet", "Gabinete Alto de Servicio"],
  ["Tall Decorative End Panel", "Panel Lateral Decorativo Alto"],
  ["Single Tall Door Vanity Cabinet", "Gabinete de Tocador de Una Puerta Alta"],
  ["Vanity Base Cabinet", "Gabinete de Base de Tocador"],
  ["Vanity Cabinet", "Gabinete de Tocador"],
  ["Sink Base Cabinet", "Gabinete de Base para Fregadero"],
  ["Sink Base", "Base para Fregadero"],
  ["Full Height Single Door Base Cabinet", "Gabinete de Base de Una Puerta de Altura Completa"],
  ["Full Height", "de Altura Completa"],
  ["Microwave Base Cabinet", "Gabinete de Base para Microondas"],
  ["Base Microwave Cabinet", "Gabinete de Base para Microondas"],
  ["Three Drawer Base Cabinet", "Gabinete de Base de Tres Cajones"],
  ["Two Drawer Base Cabinet", "Gabinete de Base de Dos Cajones"],
  ["Single Drawer Base Cabinet", "Gabinete de Base de Un Cajón"],
  ["Tray Base Cabinet", "Gabinete de Base para Bandejas"],
  ["Base Cabinet", "Gabinete de Base"],
  ["Single Door", "de Una Puerta"],
  ["Double Door", "de Dos Puertas"],
  ["Three Drawer", "de Tres Cajones"],
  ["Two Drawer", "de Dos Cajones"],
  ["Single Drawer", "de Un Cajón"],
  ["Glass Door", "Puerta de Vidrio"],
  ["Adjustable Shelves", "Repisas Ajustables"],
  ["Adjustable Shelf", "Repisa Ajustable"],
  ["Fixed Shelf", "Repisa Fija"],
  ["Fixed Shelves", "Repisas Fijas"],
  ["Soft-Close", "Cierre Suave"],
  ["Soft Close", "Cierre Suave"],
  ["Wall Filler", "Relleno de Pared"],
  ["Tall Filler", "Relleno Alto"],
  ["Base Filler", "Relleno de Base"],
  ["Pull-Out", "Extraíble"],
  ["Pull Out", "Extraíble"],
  // ---- Qualifier / adjective tokens ----
  ["Refrigerator", "Refrigerador"],
  ["Microwave", "Microondas"],
  ["Vanity", "Tocador"],
  ["Cabinet", "Gabinete"],
  ["Drawer", "Cajón"],
  ["Shelves", "Repisas"],
  ["Shelf", "Repisa"],
  ["Doors", "Puertas"],
  ["Door", "Puerta"],
  ["Filler", "Relleno"],
  ["Corner", "Esquina"],
  ["Mini", "Mini"],
  ["Tall", "Alto"],
  ["Base", "Base"],
  ["Wall", "Pared"],
  ["Left", "Izquierda"],
  ["Right", "Derecha"],
  ["Deep", "de Profundidad"],
  ["long", "de largo"],
  ["wide", "de ancho"],
  ["high", "de alto"],
  ["deep", "de profundidad"],
  ["with", "con"],
  ["and", "y"],
  ["actual", "real"],
];

// "ADA" is a proper acronym (Americans with Disabilities Act) — keep verbatim.
// Numbers like "4 Adjustable Shelves" -> "4 Repisas Ajustables" handled by tokens above.

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Use word boundaries where the phrase begins/ends with a word char, so we
// don't translate inside a longer token (e.g. SKU codes).
function buildRule([from, to]: [string, string]): Rule {
  const startsWord = /^\w/.test(from);
  const endsWord = /\w$/.test(from);
  const pattern =
    (startsWord ? "\\b" : "") + escapeRegExp(from) + (endsWord ? "\\b" : "");
  return [new RegExp(pattern, "gi"), to];
}

const RULES: Rule[] = RAW_RULES.map(buildRule);

/**
 * Translate a single structured spec/description string to Spanish.
 * Returns the original string unchanged when `lang` is not "es".
 * Unknown vocabulary is preserved verbatim.
 */
export function translateSpec(text: string | null | undefined, lang: string): string {
  if (!text) return text ?? "";
  if (lang !== "es") return text;
  let out = text;
  for (const [re, replacement] of RULES) {
    out = out.replace(re, replacement);
  }
  return out;
}

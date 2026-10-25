import { FLOORING_LAYOUT_PATTERNS, type FlooringLayoutPattern } from "@/lib/design";

/** Standard installed-floor waste. Herringbone cuts substantially more offcuts. */
export const FLOORING_STANDARD_OVERAGE = 0.1;
export const FLOORING_HERRINGBONE_OVERAGE = 0.2;

export const FLOORING_INSTALLATION_RULES = [
  {
    id: "acclimate",
    title: "Acclimate for 3 days",
    body: "Flooring has to sit at the job site for three days before installation so it matches the room's temperature.",
  },
  {
    id: "stage",
    title: "Cut and lay out first",
    body: "Cut the pieces ahead of time and lay them out before they are installed.",
  },
] as const;

export function flooringOverageRate(pattern: FlooringLayoutPattern | null | undefined): number {
  return pattern === "herringbone" ? FLOORING_HERRINGBONE_OVERAGE : FLOORING_STANDARD_OVERAGE;
}

export function flooringOverageLabel(pattern: FlooringLayoutPattern | null | undefined): string {
  return `${Math.round(flooringOverageRate(pattern) * 100)}%`;
}

export function flooringLayoutName(pattern: FlooringLayoutPattern | null | undefined): string | null {
  if (!pattern) return null;
  return FLOORING_LAYOUT_PATTERNS.find((entry) => entry.id === pattern)?.name ?? null;
}

function svgUrl(markup: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(markup)}")`;
}

/**
 * Plan-view plank seams for a layout the customer actually chose.
 * No pattern is drawn until they click one, so the floor is not a silent stagger.
 */
export function flooringPlanPatternStyle(
  pattern: FlooringLayoutPattern | null | undefined,
  grout: string,
  tileW: number,
  tileH: number,
): { backgroundImage?: string; backgroundSize?: string } {
  if (!pattern) return {};
  const g = grout;
  const tw = tileW;
  const th = tileH;
  if (pattern === "herringbone") {
    return {
      backgroundImage: `repeating-linear-gradient(45deg, ${g} 0px, ${g} 1px, transparent 1px, transparent ${th}px), repeating-linear-gradient(-45deg, ${g} 0px, ${g} 1px, transparent 1px, transparent ${th}px)`,
      backgroundSize: `${tw}px ${th}px`,
    };
  }
  if (pattern === "straight-lay") {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${tw}' height='${th}'>`
      + `<rect x='0' y='0' width='${tw}' height='${th}' fill='none'/>`
      + `<line x1='0' y1='0' x2='${tw}' y2='0' stroke='${g}' stroke-width='1'/>`
      + `<line x1='0' y1='0' x2='0' y2='${th}' stroke='${g}' stroke-width='1'/>`
      + `</svg>`;
    return { backgroundImage: svgUrl(svg), backgroundSize: `${tw}px ${th}px` };
  }
  if (pattern === "brick-lay") {
    const h2 = th * 2;
    const offset = Math.round(tw / 2);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${tw}' height='${h2}'>`
      + `<rect x='0' y='0' width='${tw}' height='${h2}' fill='none'/>`
      + `<line x1='0' y1='0' x2='${tw}' y2='0' stroke='${g}' stroke-width='1'/>`
      + `<line x1='0' y1='${th}' x2='${tw}' y2='${th}' stroke='${g}' stroke-width='1'/>`
      + `<line x1='0' y1='0' x2='0' y2='${th}' stroke='${g}' stroke-width='1'/>`
      + `<line x1='${offset}' y1='${th}' x2='${offset}' y2='${h2}' stroke='${g}' stroke-width='1'/>`
      + `</svg>`;
    return { backgroundImage: svgUrl(svg), backgroundSize: `${tw}px ${h2}px` };
  }
  if (pattern === "diagonal") {
    const h2 = th * 2;
    const offset = Math.round(tw / 3);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${tw}' height='${h2}'>`
      + `<rect x='0' y='0' width='${tw}' height='${h2}' fill='none'/>`
      + `<line x1='0' y1='0' x2='${tw}' y2='0' stroke='${g}' stroke-width='1'/>`
      + `<line x1='0' y1='${th}' x2='${tw}' y2='${th}' stroke='${g}' stroke-width='1'/>`
      + `<line x1='0' y1='0' x2='0' y2='${th}' stroke='${g}' stroke-width='1'/>`
      + `<line x1='${offset}' y1='${th}' x2='${offset}' y2='${h2}' stroke='${g}' stroke-width='1'/>`
      + `</svg>`;
    return { backgroundImage: svgUrl(svg), backgroundSize: `${tw}px ${h2}px` };
  }
  if (pattern === "third-offset") {
    const h3 = th * 3;
    const off1 = Math.round(tw / 3);
    const off2 = Math.round((tw * 2) / 3);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${tw}' height='${h3}'>`
      + `<rect x='0' y='0' width='${tw}' height='${h3}' fill='none'/>`
      + `<line x1='0' y1='0' x2='${tw}' y2='0' stroke='${g}' stroke-width='1'/>`
      + `<line x1='0' y1='${th}' x2='${tw}' y2='${th}' stroke='${g}' stroke-width='1'/>`
      + `<line x1='0' y1='${th * 2}' x2='${tw}' y2='${th * 2}' stroke='${g}' stroke-width='1'/>`
      + `<line x1='0' y1='0' x2='0' y2='${th}' stroke='${g}' stroke-width='1'/>`
      + `<line x1='${off1}' y1='${th}' x2='${off1}' y2='${th * 2}' stroke='${g}' stroke-width='1'/>`
      + `<line x1='${off2}' y1='${th * 2}' x2='${off2}' y2='${h3}' stroke='${g}' stroke-width='1'/>`
      + `</svg>`;
    return { backgroundImage: svgUrl(svg), backgroundSize: `${tw}px ${h3}px` };
  }
  const offset = Math.round(tw / 3);
  const h2 = th * 2;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${tw}' height='${h2}'>`
    + `<rect x='0' y='0' width='${tw}' height='${h2}' fill='none'/>`
    + `<line x1='0' y1='0' x2='${tw}' y2='0' stroke='${g}' stroke-width='1'/>`
    + `<line x1='0' y1='${th}' x2='${tw}' y2='${th}' stroke='${g}' stroke-width='1'/>`
    + `<line x1='0' y1='0' x2='0' y2='${th}' stroke='${g}' stroke-width='1'/>`
    + `<line x1='${offset}' y1='${th}' x2='${offset}' y2='${h2}' stroke='${g}' stroke-width='1'/>`
    + `</svg>`;
  return { backgroundImage: svgUrl(svg), backgroundSize: `${tw}px ${h2}px` };
}

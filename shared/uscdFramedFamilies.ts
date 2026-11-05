/**
 * US Cabinet Depot framed door families, from their published framed spec manual.
 *
 * Why this file exists: a style row can carry no construction fields and a name
 * that says nothing the generic matcher understands ("Haven Harbor", "Harbor").
 * The AI door-description preview then reported "no library entry (family not
 * stated)" and every card fell back to the same generic shaker drawing. These
 * entries name the real family from the style's own name or code and carry only
 * what the manual states.
 *
 * Source: US Cabinet Depot framed spec manual V8, p8–9 (door styles and frame
 * details) and p16 (frame widths). Values below are copied from those pages.
 * Anything the manual does not state stays null. Nothing is guessed, and no
 * color, sheen, or undertone is derived from a family name.
 *
 * Every entry is a framed five-piece build, so all four take the raised-panel
 * library blueprint geometry with their own frame width and center panel.
 */

export type UscdFramedFamilyId = "haven" | "oxford" | "edgeline" | "casselberry";

/** How the center panel sits inside the frame. */
export type UscdCenterPanel = "flat-recessed" | "raised";

/** The inside edge profile the manual states for the frame opening. */
export type UscdInsideEdge = "pillowed-bevel" | "wide-angled-bevel";

export type UscdFramedFamily = {
  id: UscdFramedFamilyId;
  /** Family name as the manual and the catalog name it. */
  name: string;
  /** Style codes this family is sold under, when they differ from the name. */
  codes: readonly string[];
  /** Words that identify the family inside a style name such as "Haven Harbor". */
  nameWords: readonly string[];
  /** Five-piece mortise-and-tenon frame. True for every framed USCD build. */
  fivePieceFrame: true;
  frameJoint: "mortise-and-tenon" | "mitered";
  railIn: number;
  stileIn: number;
  insideEdge: UscdInsideEdge;
  /** Plain-words description of the inside edge, for the UI. */
  insideEdgeLabel: string;
  centerPanel: UscdCenterPanel;
  /** Where in the manual this entry comes from. */
  citation: string;
  /** Never inferred: the manual states no sheen or undertone for these families. */
  sheen: null;
  undertone: null;
};

const CAPITAL_MANUAL = "US Cabinet Depot framed spec manual V8 p8-9, p16";

export const USCD_FRAMED_FAMILIES: readonly UscdFramedFamily[] = [
  {
    id: "haven",
    name: "Haven",
    codes: ["HH"],
    nameWords: ["haven"],
    fivePieceFrame: true,
    frameJoint: "mortise-and-tenon",
    railIn: 2.75,
    stileIn: 2.75,
    insideEdge: "pillowed-bevel",
    insideEdgeLabel: "pillowed inside bevel",
    centerPanel: "flat-recessed",
    citation: `${CAPITAL_MANUAL}`,
    sheen: null,
    undertone: null,
  },
  {
    id: "oxford",
    name: "Oxford",
    codes: ["OX"],
    nameWords: ["oxford"],
    fivePieceFrame: true,
    frameJoint: "mortise-and-tenon",
    railIn: 2.75,
    stileIn: 2.75,
    insideEdge: "wide-angled-bevel",
    insideEdgeLabel: "wide angled inside bevel",
    centerPanel: "flat-recessed",
    citation: `${CAPITAL_MANUAL}`,
    sheen: null,
    undertone: null,
  },
  {
    id: "edgeline",
    name: "Edgeline",
    codes: ["EL"],
    nameWords: ["edgeline", "edge line"],
    fivePieceFrame: true,
    frameJoint: "mortise-and-tenon",
    railIn: 2.75,
    stileIn: 2.75,
    insideEdge: "pillowed-bevel",
    insideEdgeLabel: "narrow shaker inside edge",
    centerPanel: "flat-recessed",
    citation: `${CAPITAL_MANUAL}`,
    sheen: null,
    undertone: null,
  },
  {
    id: "casselberry",
    name: "Casselberry",
    codes: ["CB"],
    nameWords: ["casselberry"],
    fivePieceFrame: true,
    frameJoint: "mitered",
    railIn: 3,
    stileIn: 3,
    insideEdge: "pillowed-bevel",
    insideEdgeLabel: "pillowed bevel",
    centerPanel: "raised",
    citation: `${CAPITAL_MANUAL}`,
    sheen: null,
    undertone: null,
  },
] as const;

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * The USCD framed family a style belongs to, from its name or its style code.
 *
 * Only an explicit family word counts, so "Haven Harbor" is Haven and a style
 * whose name says nothing returns null instead of borrowing a family.
 */
export function uscdFramedFamilyForStyle(style: {
  ourName?: string | null;
  aliasName?: string | null;
  name?: string | null;
  doorStyle?: string | null;
  styleCode?: string | null;
  code?: string | null;
} | null | undefined): UscdFramedFamily | null {
  if (!style) return null;
  const names = [style.ourName, style.aliasName, style.name, style.doorStyle].map(normalize).filter(Boolean);
  for (const family of USCD_FRAMED_FAMILIES) {
    if (names.some((name) => family.nameWords.some((word) => name.includes(word)))) return family;
  }
  const code = normalize(style.styleCode ?? style.code).toUpperCase();
  if (code) {
    const byCode = USCD_FRAMED_FAMILIES.find((family) => family.codes.includes(code));
    if (byCode) return byCode;
    // Codes are often prefixed or suffixed with a color: "HH-Harbor", "OXF-W".
    const embedded = USCD_FRAMED_FAMILIES.find((family) =>
      family.codes.some((candidate) => new RegExp(`(^|[^a-z])${candidate}([^a-z]|$)`).test(code)),
    );
    if (embedded) return embedded;
  }
  return null;
}

/**
 * The library family a family belongs to, for the raised-panel preview.
 *
 * Every USCD framed entry is a five-piece frame, so all of them draw with the
 * raised-panel blueprint; the entry's own panel setting decides whether the
 * center is raised or flat-recessed.
 */
export function uscdFramedLibraryFamily(family: UscdFramedFamily): "raised-panel" {
  return "raised-panel";
}

/** Human label for the entry, e.g. `Haven — 5-piece mortise and tenon frame, 2¾ in`. */
export function uscdFramedFamilyLabel(family: UscdFramedFamily): string {
  return `${family.name} — 5-piece ${family.frameJoint.replace(/-/g, " ")} frame, ${family.railIn} in rails and stiles`;
}

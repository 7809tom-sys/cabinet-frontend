/**
 * Deep link from a cabinet in the 3D design view straight to the door style that
 * is coloring it, and back again.
 *
 * Owner rule: on any selected cabinet or door (and on any wrong-door warning)
 * there is an Edit button that opens THAT door style in the door style editor —
 * its color and its style — and saves return the person to the same spot in the
 * design they left.
 *
 * This follows the deep-link shape the admin screens already use
 * (`cabinetConfigQuickEditUrl` / `cabinetDesignerCoverageGapEditUrl` in
 * `shared/cabinetConfigReview.ts`): named query parameters plus a `from` marker so
 * the destination knows where to send the person back.
 *
 * Nothing here writes anything. It only builds a URL and reads one back.
 */

/** Where the door style editor lives, and which section shows the style list. */
export const DOOR_STYLE_EDITOR_PATH = "/admin";
export const DOOR_STYLE_EDITOR_TAB = "featured";

/** The `from` marker the editor uses to offer "back to the design". */
export const DOOR_STYLE_EDIT_FROM_DESIGNER = "designer-door";

export type DoorStyleEditTarget = {
  styleId: number;
  styleCode?: string | null;
  styleName?: string | null;
  /** The cabinet this was opened from, so the design can reselect it on return. */
  cabinetUid?: string | null;
  cabinetCode?: string | null;
  /** Where the design was, verbatim, so returning is exact. */
  returnTo?: string | null;
  /** Which slot of the design the style was in, when the design uses slots. */
  slot?: string | null;
};

export type DoorStyleEditLinkInput = {
  styleId: number | null | undefined;
  styleCode?: string | null;
  styleName?: string | null;
  cabinetUid?: string | null;
  cabinetCode?: string | null;
  /** The current design URL including its query, used as the return path. */
  returnTo?: string | null;
  slot?: string | null;
};

/**
 * The editor URL for one door style.
 *
 * Returns null when there is no style to open, so a caller renders no button
 * rather than a dead link. A non-admin must never be handed this link; the caller
 * gates on the role, and `shouldOfferDoorStyleEdit` below is the one test for it.
 */
export function doorStyleEditUrl(input: DoorStyleEditLinkInput): string | null {
  if (input.styleId == null || !Number.isFinite(input.styleId) || input.styleId <= 0) return null;
  const params = new URLSearchParams({
    tab: DOOR_STYLE_EDITOR_TAB,
    editStyle: String(input.styleId),
    from: DOOR_STYLE_EDIT_FROM_DESIGNER,
  });
  if (input.cabinetUid) params.set("cabinet", input.cabinetUid);
  if (input.cabinetCode) params.set("cabinetCode", input.cabinetCode);
  if (input.styleCode) params.set("styleCode", input.styleCode);
  if (input.styleName) params.set("styleName", input.styleName);
  if (input.slot) params.set("slot", input.slot);
  // A return path is only honoured when it is a same-origin absolute path. An
  // absolute URL or a protocol-relative "//host" is dropped, so the link can never
  // be used to bounce somebody off the site.
  const returnTo = safeReturnPath(input.returnTo);
  if (returnTo) params.set("returnTo", returnTo);
  return `${DOOR_STYLE_EDITOR_PATH}?${params.toString()}`;
}

/** A same-origin path, or null. Never an absolute URL and never "//host". */
export function safeReturnPath(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  if (!text.startsWith("/")) return null;
  if (text.startsWith("//")) return null;
  return text;
}

/** Parse the design URL the editor hands back, so the design can return exactly. */
export function readDoorStyleEditRequest(search: string | null | undefined): DoorStyleEditTarget | null {
  const query = (search ?? "").trim();
  if (!query) return null;
  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  if (params.get("from") !== DOOR_STYLE_EDIT_FROM_DESIGNER) return null;
  const styleId = Number(params.get("editStyle"));
  if (!Number.isFinite(styleId) || styleId <= 0) return null;
  return {
    styleId,
    styleCode: params.get("styleCode"),
    styleName: params.get("styleName"),
    cabinetUid: params.get("cabinet"),
    cabinetCode: params.get("cabinetCode"),
    returnTo: safeReturnPath(params.get("returnTo")),
    slot: params.get("slot"),
  };
}

/**
 * Whether the Edit affordance is offered at all: an admin, on a cabinet that has a
 * real style. A shopper never sees it, and a cabinet with no style has nowhere to
 * go.
 */
export function shouldOfferDoorStyleEdit(input: {
  isAdmin: boolean;
  styleId?: number | null;
}): boolean {
  return input.isAdmin && input.styleId != null && Number(input.styleId) > 0;
}

/**
 * The design URL to return to, keeping the design's own state.
 *
 * The design keeps its selection in the URL where it can. When the caller has the
 * cabinet it came from, that is re-selected on return so the person lands back on
 * the same cabinet rather than at the top of the plan.
 */
export function designReturnUrl(input: {
  designPath?: string | null;
  returnTo?: string | null;
  cabinetUid?: string | null;
}): string {
  const base = safeReturnPath(input.returnTo) ?? safeReturnPath(input.designPath) ?? "/design";
  if (!input.cabinetUid) return base;
  const [path, rawQuery = ""] = base.split("?");
  const params = new URLSearchParams(rawQuery);
  params.set("selectCabinet", input.cabinetUid);
  return `${path}?${params.toString()}`;
}

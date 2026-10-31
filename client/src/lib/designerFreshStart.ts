import { DEFAULT_ROOM, type RoomData } from "@/lib/design";
import { designerDraftStorageKey, type StoreScope } from "@/lib/affiliateContext";

/**
 * Deep link that starts a brand-new Designer session on the floor plan.
 * `new=1` keeps this session off the visitor's existing draft key.
 * `doorStyleId` reuses the same style id the Designer already understands
 * from `?style=`, and `view=plan` is the existing floor-plan workspace switch.
 */
export const FRESH_DESIGN_FLAG = "new";
export const FRESH_DESIGN_STYLE_PARAM = "doorStyleId";
export const FRESH_DESIGN_DISTRIBUTOR_PARAM = "distributorId";
export const FRESH_DESIGN_VIEW = "plan";

/** Layout id the Designer already uses when no starter layout has been chosen. */
export const DEFAULT_FRESH_LAYOUT_PRESET_ID = "kitchen_l_standard";

const STAFF_DESIGNER_ROLES = new Set(["admin", "designer", "sales_rep", "distributor"]);

export type FreshDesignRequest = {
  fresh: boolean;
  doorStyleId: number | null;
  distributorId: number | null;
};

function positiveInt(value: string | null): number | null {
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function searchParams(search: string): URLSearchParams {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(raw);
}

/** App-relative Designer URL. Store-subdomain rewrites stay on the normal /design path. */
export function designerWorkspaceHref(input: {
  doorStyleId?: number | null;
  distributorId?: number | null;
} = {}): string {
  const params = new URLSearchParams();
  params.set(FRESH_DESIGN_FLAG, "1");
  params.set("view", FRESH_DESIGN_VIEW);
  if (input.doorStyleId != null && input.doorStyleId > 0) {
    params.set(FRESH_DESIGN_STYLE_PARAM, String(input.doorStyleId));
  }
  if (input.distributorId != null && input.distributorId > 0) {
    params.set(FRESH_DESIGN_DISTRIBUTOR_PARAM, String(input.distributorId));
  }
  return `/design?${params.toString()}`;
}

/**
 * Reads a fresh-start request. `doorStyleId` is preferred; `style` is accepted
 * so an older "design with this" link can start the same new session.
 * A bare `?style=` without `new=1` is left to the existing preselect path.
 */
export function readFreshDesignRequest(search: string): FreshDesignRequest {
  const params = searchParams(search);
  const fresh = params.get(FRESH_DESIGN_FLAG) === "1";
  if (!fresh) return { fresh: false, doorStyleId: null, distributorId: null };
  return {
    fresh: true,
    doorStyleId: positiveInt(params.get(FRESH_DESIGN_STYLE_PARAM)) ?? positiveInt(params.get("style")),
    distributorId: positiveInt(params.get(FRESH_DESIGN_DISTRIBUTOR_PARAM)) ?? positiveInt(params.get("distributor")),
  };
}

/**
 * Separate from the one canonical draft per person. Writing here cannot replace
 * the draft they already had open in the Designer.
 */
export function freshDesignDraftStorageKey(
  scope: StoreScope,
  email: string | null | undefined,
  doorStyleId: number | null,
  distributorId: number | null,
): string {
  const stylePart = doorStyleId != null ? String(doorStyleId) : "none";
  const linePart = distributorId != null ? String(distributorId) : "none";
  return `${designerDraftStorageKey(scope, email)}:fresh:style-${stylePart}:line-${linePart}`;
}

/** Standard 12 ft × 10 ft kitchen rectangle used as the new-design footprint. */
export function defaultFreshKitchenFootprint(): RoomData {
  return {
    width: DEFAULT_ROOM.width,
    depth: DEFAULT_ROOM.depth,
    ceilingHeight: DEFAULT_ROOM.ceilingHeight,
  };
}

/**
 * Signed-in staff, admins, and vendor (distributor) accounts already bypass the
 * email form. They must not also submit a lead just by opening the Designer.
 */
export function skipsDesignerLeadGate(role: string | null | undefined): boolean {
  return role != null && STAFF_DESIGNER_ROLES.has(role);
}

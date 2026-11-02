/** Fronts the room-scene bake must show: at least one door front and one drawer front. */
export const SMALL_DRAWER_MAX_IN = 7;
export const FRAME_WIDTH_IN = 2.75;
export interface BakeFront { kind: "door" | "drawer"; heightIn: number; construction: "slab" | "frame"; frameWidthIn: number | null; colorSource: "door" }
export function drawerFrontConstruction(heightIn: number): Pick<BakeFront, "construction" | "frameWidthIn"> {
  return heightIn < SMALL_DRAWER_MAX_IN ? { construction: "slab", frameWidthIn: null } : { construction: "frame", frameWidthIn: FRAME_WIDTH_IN };
}
/** Base cabinet sample: drawer over door (standard 34.5in base: 6in drawer + 24in door unless told otherwise). */
export function bakeSampleLayout(opts: { drawerHeightIn?: number; doorHeightIn?: number; doorIsSlab?: boolean } = {}): BakeFront[] {
  const d = opts.drawerHeightIn ?? 6, h = opts.doorHeightIn ?? 24;
  return [
    { kind: "drawer", heightIn: d, colorSource: "door", ...(opts.doorIsSlab ? { construction: "slab", frameWidthIn: null } : drawerFrontConstruction(d)) },
    { kind: "door", heightIn: h, colorSource: "door", ...(opts.doorIsSlab ? { construction: "slab", frameWidthIn: null } : { construction: "frame", frameWidthIn: FRAME_WIDTH_IN }) },
  ];
}
export function bakeLayoutHasDoorAndDrawer(l: BakeFront[]) { return l.some((f) => f.kind === "door") && l.some((f) => f.kind === "drawer"); }

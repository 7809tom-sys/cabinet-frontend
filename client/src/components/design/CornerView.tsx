import {
  PlacedCabinet, RoomData, WallOpening, FinishColors, DEFAULT_FINISH_COLORS,
  type DoorPanelKind, type WallSide,
  isCornerCabinet, cabinetWall, cornerRotationForPlaced,
} from "@/lib/design";
import { type HardwareStyleId } from "@/lib/hardware";
import { ElevationView } from "./ElevationView";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/useMobile";
import type { SiteStringKey } from "@/lib/i18n/site";

// The four kitchen corners, each defined by the two walls that meet there.
// `left` is the wall drawn on the LEFT half (mirrored so its corner end faces
// the seam in the middle); `right` is drawn on the RIGHT half (normal
// orientation, corner end against the seam). This produces the "standing in the
// corner looking out" effect, showing both adjoining walls at once.
export type CornerId = "top-left" | "top-right" | "bottom-right" | "bottom-left";

const CORNERS: Record<CornerId, { label: string; labelKey: SiteStringKey; left: WallSide; right: WallSide }> = {
  "top-left": { label: "Back / Left", labelKey: "dt_corner_back_left", left: "left", right: "top" },
  "top-right": { label: "Back / Right", labelKey: "dt_corner_back_right", left: "top", right: "right" },
  "bottom-right": { label: "Front / Right", labelKey: "dt_corner_front_right", left: "right", right: "bottom" },
  "bottom-left": { label: "Front / Left", labelKey: "dt_corner_front_left", left: "bottom", right: "left" },
};

const CORNER_ORDER: CornerId[] = ["top-left", "top-right", "bottom-right", "bottom-left"];

interface Props {
  room: RoomData;
  cabinets: PlacedCabinet[];
  selectedUid: string | null;
  attributesTargetUid?: string | null;
  onSelect: (uid: string | null) => void;
  corner: CornerId;
  onCornerChange: (c: CornerId) => void;
  countertopMaterialId?: string | null;
  openings?: WallOpening[];
  finish?: FinishColors;
  crown?: boolean;
  toeKick?: boolean;
  batten?: boolean;
  lightRail?: boolean;
  panelKind?: DoorPanelKind;
  hardwareStyleId?: HardwareStyleId | null;
  hardwareAccent?: string;
  finishFor?: (cab: PlacedCabinet) => FinishColors;
  panelKindFor?: (cab: PlacedCabinet) => DoorPanelKind;
  doorSampleUrlFor?: (cab: PlacedCabinet) => string | null;
  drawerSampleUrlFor?: (cab: PlacedCabinet) => string | null;
}

export function CornerView({
  room, cabinets, selectedUid, attributesTargetUid = null, onSelect, corner, onCornerChange,
  countertopMaterialId = null, openings = [],
  finish = DEFAULT_FINISH_COLORS, crown = false, toeKick = false, batten = false, lightRail = false,
  panelKind = "shaker", hardwareStyleId = null, hardwareAccent,
  finishFor, panelKindFor, doorSampleUrlFor, drawerSampleUrlFor,
}: Props) {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const { left, right } = CORNERS[corner];

  // The plan rotation (0/90/180/270) that maps to each of the four corners,
  // matching cornerRotationForPlaced (back-left=0, back-right=90,
  // front-right=180, front-left=270).
  const CORNER_ROTATION: Record<CornerId, number> = {
    "top-left": 0, "top-right": 90, "bottom-right": 180, "bottom-left": 270,
  };

  // Corner cabinets (lazy-Susan / diagonal / blind) that physically sit in the
  // corner currently being viewed. A corner cabinet wraps BOTH walls, but it is
  // "owned" by just one wall via cabinetWall(); we draw it in place on its owning
  // half and as a seam ghost on the other half so it visibly spans the corner.
  const cornerCabsHere = cabinets.filter(
    (c) =>
      isCornerCabinet(c.masterCode, c.description) &&
      cornerRotationForPlaced(c, room) === CORNER_ROTATION[corner]
  );
  // For each half, the seam ghosts are the corner cabinets NOT owned by that
  // half's wall (the owning wall already draws them in their real position).
  const seamForLeft = cornerCabsHere.filter((c) => cabinetWall(c, room) !== left);
  const seamForRight = cornerCabsHere.filter((c) => cabinetWall(c, room) !== right);

  const sharedProps = {
    room, cabinets, selectedUid, attributesTargetUid, onSelect,
    countertopMaterialId, openings, finish, crown, toeKick, batten, lightRail, panelKind, hardwareStyleId, hardwareAccent,
    finishFor, panelKindFor, doorSampleUrlFor, drawerSampleUrlFor,
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-gradient-to-b from-[#c3d0e0] via-[#dde6f0] to-[#eef1f5]">
      {/* ── TRUE 3D CORNER (CSS perspective) ───────────────────────────────
          The two wall halves are rotated inward around the vertical seam with
          real CSS 3D rotateY, so they physically recede toward a vanishing
          point at the center — "standing in the corner looking out". Floor and
          ceiling planes are tilted with rotateX to close the box. Genuine 3D
          transform (GPU-composited, still cheap — no 3D engine). */}
      <div className="absolute inset-0" style={{ perspective: "1100px", perspectiveOrigin: isMobile ? "50% 38%" : "50% 48%" }}>
        <div className="absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
          {/* Left wall — anchored at the seam (right edge), receding to the left. */}
          <div
            className="absolute inset-y-0 left-0 w-1/2 origin-right overflow-hidden"
            style={{ transform: "rotateY(38deg)", backfaceVisibility: "hidden" }}
          >
            <div className="absolute inset-0" style={{ transform: "scaleX(-1)" }}>
              <ElevationView {...sharedProps} wall={left} mirror hideSwitcher seamCabinets={seamForLeft} />
            </div>
            {/* Distance shade: wall darkens toward the far (left) edge so faces
                read as receding. */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-transparent via-[#1a2744]/12 to-[#1a2744]/40" />
            {/* Ambient-occlusion at the seam edge (right) where the two walls meet. */}
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#1a2744]/30 to-transparent" />
            {/* Floor-contact shadow: soft dark band at the base so cabinets sit
                on the floor instead of floating. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#1a2744]/45 to-transparent" />
          </div>

          {/* Right wall — anchored at the seam (left edge), receding to the right. */}
          <div
            className="absolute inset-y-0 right-0 w-1/2 origin-left overflow-hidden"
            style={{ transform: "rotateY(-38deg)", backfaceVisibility: "hidden" }}
          >
            <ElevationView {...sharedProps} wall={right} hideSwitcher seamCabinets={seamForRight} />
            {/* Distance shade: lit near the seam, darkening toward far (right) edge. */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-[#1a2744]/28" />
            {/* Ambient-occlusion at the seam edge (left) where the two walls meet. */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#1a2744]/30 to-transparent" />
            {/* Floor-contact shadow at the base of the wall. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#1a2744]/45 to-transparent" />
          </div>

          {/* Floor plane — tilted back so it reads as ground receding into the corner. */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] origin-bottom"
            style={{
              transform: "rotateX(72deg)",
              background:
                "linear-gradient(to top, rgba(26,39,68,0.34), rgba(26,39,68,0.12) 55%, rgba(26,39,68,0.02))",
            }}
          />
          {/* Ceiling plane — tilted the opposite way to close the top of the box. */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[22%] origin-top"
            style={{
              transform: "rotateX(-68deg)",
              background:
                "linear-gradient(to bottom, rgba(26,39,68,0.22), rgba(26,39,68,0.04) 70%, transparent)",
            }}
          />
        </div>
      </div>

      {/* Seam — the vertical corner line nearest the viewer, with a soft
          contact shadow on either side. */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-px -translate-x-1/2 bg-[#1a2744]/55" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-24 -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(26,39,68,0.30),transparent_70%)]" />

      {/* The mirrored ElevationView also flips its wall-switcher pill text, so we
          hide those and provide our own corner picker on top. */}
      <div
        className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white/90 px-1.5 py-1 rounded-full shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="px-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("dt_corner")}</span>
        {CORNER_ORDER.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onCornerChange(c)}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
              c === corner ? "bg-[#1a2744] text-white" : "text-[#1a2744] hover:bg-[#1a2744]/10"
            }`}
          >
            {t(CORNERS[c].labelKey)}
          </button>
        ))}
      </div>

      {/* Cycle button for quick rotation through all four corners. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const idx = CORNER_ORDER.indexOf(corner);
          onCornerChange(CORNER_ORDER[(idx + 1) % CORNER_ORDER.length]);
        }}
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 rounded-full bg-[#1a2744] text-white px-3 py-1.5 text-[11px] font-medium shadow hover:bg-[#243456]"
      >
        {t("dt_rotate_next_corner")} ↻
      </button>
    </div>
  );
}

export { CORNERS, CORNER_ORDER };

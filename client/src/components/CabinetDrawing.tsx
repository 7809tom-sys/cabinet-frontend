import { useMemo } from "react";
import {
  cabinetDrawingType,
  cabinetAltText,
  resolveDoorDrawerCounts,
  threeDrawerBaseRowHeights,
  type CabinetLike,
  type CabinetDrawingType,
} from "@/lib/cabinetGraphics";
import { parseCatalogNomenclature } from "@shared/catalogNomenclature";

interface CabinetDrawingProps {
  cabinet: CabinetLike;
  /** Optional override of the door/finish color (e.g. selected style finish). */
  finishColor?: string;
  className?: string;
}

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// Stroke + fill palette (kept neutral so the selected door finish can override fill).
const STROKE = "#334155"; // slate-700
const STROKE_LIGHT = "#94a3b8"; // slate-400
const DEFAULT_FILL = "#e2e8f0"; // slate-200
const PANEL_FILL = "#f1f5f9"; // slate-100

/**
 * Renders an accurate, to-scale 2D front-elevation line drawing of a cabinet.
 * The box proportions come from the model's real width/height, so a 12" base
 * looks narrow and a 30" base looks wide. The front detail is drawn per type.
 */
export function CabinetDrawing({ cabinet, finishColor, className }: CabinetDrawingProps) {
  const type = useMemo(() => cabinetDrawingType(cabinet), [cabinet]);
  const alt = useMemo(() => cabinetAltText(cabinet), [cabinet]);

  // Real dimensions with sensible fallbacks per placement. Chrome trays are
  // specified by compatible ERB corner cabinet size, not a cabinet-box size.
  const isChromeTray = type === "lazy-susan-tray";
  const w = toNum(cabinet.width) ?? (isChromeTray ? 33 : 24);
  const placement = (cabinet.placementType ?? cabinet.category ?? "").toLowerCase();
  const fallbackH =
    isChromeTray ? 12 : placement.includes("wall") ? 30 : placement.includes("tall") ? 84 : 34.5;
  const h = toNum(cabinet.height) ?? fallbackH;

  // Use a tight viewBox that matches the cabinet's real aspect ratio so the
  // drawing fills the container edge-to-edge with no surrounding whitespace.
  const SCALE = 100; // arbitrary internal unit — only the ratio matters
  const ratio = Math.max(0.25, Math.min(w / h, 3.2)); // width/height, clamped
  const vbW = ratio >= 1 ? SCALE : SCALE * ratio;
  const vbH = ratio >= 1 ? SCALE / ratio : SCALE;
  const x0 = 0;
  const y0 = 0;
  const boxW = vbW;
  const boxH = vbH;

  const fill = finishColor ?? DEFAULT_FILL;

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className={className}
      role="img"
      aria-label={alt}
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{alt}</title>
      <FrontByType type={type} x={x0} y={y0} w={boxW} h={boxH} fill={fill} cabinet={cabinet} />
    </svg>
  );
}

interface FrontProps {
  type: CabinetDrawingType;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  cabinet: CabinetLike;
}

function FrontByType({ type, x, y, w, h, fill, cabinet }: FrontProps) {
  switch (type) {
    case "drawer-base":
      return <DrawerBaseFront x={x} y={y} w={w} h={h} fill={fill} cabinet={cabinet} />;
    case "microwave-base":
      return <MicrowaveBaseFront x={x} y={y} w={w} h={h} fill={fill} cabinet={cabinet} />;
    case "sink-base":
      return <SinkBaseFront x={x} y={y} w={w} h={h} fill={fill} />;
    case "appliance-garage":
      return <ApplianceGarageFront x={x} y={y} w={w} h={h} fill={fill} />;
    case "blind-corner":
      return <BlindCornerFront x={x} y={y} w={w} h={h} fill={fill} />;
    case "diagonal-corner":
      return <DiagonalCornerFront x={x} y={y} w={w} h={h} fill={fill} cabinet={cabinet} />;
    case "wall-end-angle":
      return <DiagonalCornerFront x={x} y={y} w={w} h={h} fill={fill} cabinet={cabinet} />;
    case "end-angle":
      return <BaseEndAngleFront x={x} y={y} w={w} h={h} fill={fill} />;
    case "l-corner":
      return <LCornerFront x={x} y={y} w={w} h={h} fill={fill} cabinet={cabinet} />;
    case "corner-drawer-base":
      return <CornerDrawerBaseFront x={x} y={y} w={w} h={h} fill={fill} cabinet={cabinet} />;
    case "lazy-susan-tray":
      return <LazySusanTrayFront x={x} y={y} w={w} h={h} fill={fill} />;
    case "wall-microwave-kit":
      return <WallMicrowaveShelfFront x={x} y={y} w={w} h={h} fill={fill} />;
    case "shelf-insert":
      return <ShelfInsertFront x={x} y={y} w={w} h={h} fill={fill} />;
    case "range-hood-front":
      return <RangeHoodFront x={x} y={y} w={w} h={h} fill={fill} />;
    case "accessory-strip":
      return <AccessoryStrip x={x} y={y} w={w} h={h} fill={fill} />;
    case "panel":
      return <FlatPanelFront x={x} y={y} w={w} h={h} fill={fill} cabinet={cabinet} />;
    case "glass-door":
      return <GlassDoorFront x={x} y={y} w={w} h={h} fill={fill} cabinet={cabinet} />;
    case "pantry":
      return <PantryFront x={x} y={y} w={w} h={h} fill={fill} cabinet={cabinet} />;
    case "oven-tall":
      return <OvenTallFront x={x} y={y} w={w} h={h} fill={fill} cabinet={cabinet} />;
    case "face-pattern":
      return <FacePatternFront x={x} y={y} w={w} h={h} fill={fill} cabinet={cabinet} />;
    case "vanity":
    case "ada":
    case "standard-door":
    default:
      return <StandardDoorFront x={x} y={y} w={w} h={h} fill={fill} cabinet={cabinet} />;
  }
}

function Box({ x, y, w, h, fill }: { x: number; y: number; w: number; h: number; fill: string }) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={2}
      fill={fill}
      stroke={STROKE}
      strokeWidth={1.6}
    />
  );
}

/**
 * RHF30/RHF36 use the supplied catalog form: a shallow wood hood front with a
 * lower fascia and two doors that lean back toward the wall. It is deliberately
 * not the freestanding stainless `HOOD-*` appliance silhouette.
 */
function RangeHoodFront({ x, y, w, h, fill }: Omit<FrontProps, "type" | "cabinet">) {
  const inset = Math.max(3, Math.min(6, w * 0.08));
  const fasciaTop = y + h * 0.72;
  const topInset = Math.max(inset + 2, w * 0.15);
  const upperY = y + h * 0.06;
  const lowerY = fasciaTop - 2;
  const center = x + w / 2;
  const leftTop = x + topInset;
  const rightTop = x + w - topInset;
  const leftBottom = x + inset;
  const rightBottom = x + w - inset;
  return (
    <g data-cabinet-drawing="range-hood-front">
      <Box x={x} y={y} w={w} h={h} fill={fill} />
      <rect x={x + inset} y={fasciaTop} width={w - inset * 2} height={Math.max(2, y + h - fasciaTop - inset)} fill={fill} stroke={STROKE} strokeWidth={1.3} />
      <polygon points={`${leftTop},${upperY} ${center - 1},${upperY} ${center - 1},${lowerY} ${leftBottom},${lowerY}`} fill={fill} stroke={STROKE} strokeWidth={1.3} />
      <polygon points={`${center + 1},${upperY} ${rightTop},${upperY} ${rightBottom},${lowerY} ${center + 1},${lowerY}`} fill={fill} stroke={STROKE} strokeWidth={1.3} />
      <line x1={x + inset} y1={fasciaTop} x2={x + w - inset} y2={fasciaTop} stroke={STROKE} strokeWidth={1.5} />
      <line x1={center} y1={upperY} x2={center} y2={lowerY} stroke={STROKE} strokeWidth={1.2} />
      <line x1={x + inset / 2} y1={y + 2} x2={x + w - inset / 2} y2={y + 2} stroke={STROKE} strokeWidth={1.4} />
    </g>
  );
}

/**
 * BEC24 is a 30-inch base end cabinet: one standard door box and one exposed
 * 45-degree end panel. The end panel is structural, not a second door or a
 * room-corner footprint. This neutral technical elevation mirrors the source
 * specification rather than a finish-specific vendor image.
 */
function BaseEndAngleFront({ x, y, w, h, fill }: Omit<FrontProps, "type" | "cabinet">) {
  const inset = 4;
  const angleW = Math.max(8, w * 0.24);
  const faceX = x + angleW;
  const faceW = w - angleW;
  const bevel = Math.min(h * 0.12, 12);
  return (
    <g data-base-end-angle-front="true">
      <polygon
        points={`${x + angleW},${y} ${x + w},${y} ${x + w},${y + h} ${x + angleW},${y + h} ${x},${y + h - bevel} ${x},${y + bevel}`}
        fill={fill}
        stroke={STROKE}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <polygon
        points={`${x + angleW},${y} ${x + angleW},${y + h} ${x},${y + h - bevel} ${x},${y + bevel}`}
        fill={PANEL_FILL}
        stroke={STROKE_LIGHT}
        strokeWidth={1}
        strokeLinejoin="round"
        data-base-end-angle-panel="true"
      />
      <rect
        x={faceX + inset}
        y={y + inset}
        width={faceW - inset * 2}
        height={h - inset * 2}
        rx={1.5}
        fill={PANEL_FILL}
        stroke={STROKE_LIGHT}
        strokeWidth={1}
        data-base-end-single-door="true"
      />
      <circle cx={faceX + faceW - inset * 2.4} cy={y + h / 2} r={1.35} fill={STROKE} />
    </g>
  );
}

// Standard door cabinet: outer box + 1..N door panels, optional top drawer row.
function StandardDoorFront({ x, y, w, h, fill, cabinet }: Omit<FrontProps, "type">) {
  const counts = resolveDoorDrawerCounts(cabinet ?? {});
  const doors = Math.max(1, counts.doors || (w > 21 ? 2 : 1));
  const drawers = counts.drawers;
  const rollOutShelfCount = parseCatalogNomenclature(cabinet.masterCode ?? "").rollOutShelfCount ?? 0;
  const inset = 4;
  const hasTopDrawer = drawers > 0;
  const drawerH = hasTopDrawer ? Math.min(14, h * 0.18) : 0;
  const doorTop = y + inset + (hasTopDrawer ? drawerH + inset : 0);
  const doorBottom = y + h - inset;
  const doorAreaH = doorBottom - doorTop;
  const innerW = w - inset * 2;
  const doorW = (innerW - (doors - 1) * 3) / doors;
  return (
    <g>
      <Box x={x} y={y} w={w} h={h} fill={fill} />
      {hasTopDrawer && (
        <rect
          x={x + inset}
          y={y + inset}
          width={innerW}
          height={drawerH}
          rx={1.5}
          fill={PANEL_FILL}
          stroke={STROKE_LIGHT}
          strokeWidth={1}
        />
      )}
      {Array.from({ length: doors }).map((_, i) => (
        <g key={i}>
          <rect
            x={x + inset + i * (doorW + 3)}
            y={doorTop}
            width={doorW}
            height={doorAreaH}
            rx={1.5}
            fill={PANEL_FILL}
            stroke={STROKE_LIGHT}
            strokeWidth={1}
          />
          {/* handle */}
          <circle
            cx={x + inset + i * (doorW + 3) + (i === doors - 1 && doors > 1 ? 4 : doorW - 4)}
            cy={doorTop + doorAreaH / 2}
            r={1.4}
            fill={STROKE}
          />
        </g>
      ))}
      {rollOutShelfCount > 0 && (
        <RollOutShelfIndicator x={x} y={y} w={w} h={h} count={rollOutShelfCount} />
      )}
    </g>
  );
}

/**
 * A compact neutral technical badge at the lower edge of a code-keyed base
 * drawing. Three shelf rails make the symbol recognizable and the numeral gives
 * the exact included count without changing the cabinet door or finish art.
 */
function RollOutShelfIndicator({ x, y, w, h, count }: { x: number; y: number; w: number; h: number; count: number }) {
  const inset = Math.max(2, Math.min(w, h) * 0.06);
  const badgeW = Math.max(12, Math.min(w * 0.36, 19));
  const badgeH = Math.max(9, Math.min(h * 0.18, 13));
  const badgeX = x + w - badgeW - inset;
  const badgeY = y + h - badgeH - inset;
  const railLeft = badgeX + badgeW * 0.16;
  const railRight = badgeX + badgeW * 0.52;
  const railTop = badgeY + badgeH * 0.3;
  const railGap = badgeH * 0.18;
  const label = `${count} included roll-out ${count === 1 ? "shelf" : "shelves"}`;
  return (
    <g data-rollout-shelf-indicator="true" data-rollout-shelf-count={count} aria-label={label}>
      <title>{label}</title>
      <rect x={badgeX} y={badgeY} width={badgeW} height={badgeH} rx={2} fill="#ffffff" fillOpacity={0.94} stroke={STROKE} strokeWidth={1} />
      {[0, 1, 2].map((index) => (
        <line
          key={index}
          x1={railLeft}
          y1={railTop + index * railGap}
          x2={railRight}
          y2={railTop + index * railGap}
          stroke={STROKE_LIGHT}
          strokeWidth={0.9}
          strokeLinecap="round"
        />
      ))}
      <text x={badgeX + badgeW * 0.74} y={badgeY + badgeH * 0.69} textAnchor="middle" fontSize={badgeH * 0.58} fontWeight="700" fill={STROKE}>{count}</text>
    </g>
  );
}

// Drawer base: stack of drawer fronts (count from data, default 3).
function DrawerBaseFront({ x, y, w, h, fill, cabinet }: Omit<FrontProps, "type">) {
  const n = Math.max(1, resolveDoorDrawerCounts(cabinet ?? {}).drawers || 3);
  const inset = 4;
  const gap = 3;
  const innerW = w - inset * 2;
  const innerH = h - inset * 2;
  const drawableHeight = innerH - (n - 1) * gap;
  const physicalFaceHeight = Math.max(1, (toNum(cabinet.height) ?? 34.5) - 4.5);
  const verifiedThreeDrawerRows = threeDrawerBaseRowHeights(cabinet, physicalFaceHeight, n);
  const physicalTotal = verifiedThreeDrawerRows?.reduce((sum, row) => sum + row, 0) ?? physicalFaceHeight;
  const rowHeights = verifiedThreeDrawerRows
    ? verifiedThreeDrawerRows.map((row) => (row / physicalTotal) * drawableHeight)
    : Array.from({ length: n }, () => drawableHeight / n);
  const rowTop = (index: number) => rowHeights.slice(0, index).reduce((sum, row) => sum + row + gap, 0);
  return (
    <g data-cabinet-drawing="drawer-base">
      <Box x={x} y={y} w={w} h={h} fill={fill} />
      {Array.from({ length: n }).map((_, i) => (
        <g key={i}>
          <rect
            data-drawer-front="true"
            data-drawer-front-height={rowHeights[i]}
            x={x + inset}
            y={y + inset + rowTop(i)}
            width={innerW}
            height={rowHeights[i]}
            rx={1.5}
            fill={PANEL_FILL}
            stroke={STROKE_LIGHT}
            strokeWidth={1}
          />
          {/* bar pull */}
          <rect
            x={x + w / 2 - innerW * 0.18}
            y={y + inset + rowTop(i) + rowHeights[i] / 2 - 0.8}
            width={innerW * 0.36}
            height={1.6}
            rx={0.8}
            fill={STROKE}
          />
        </g>
      ))}
    </g>
  );
}

// Microwave base: the Cabinet Config controls the layout. A zero-door record
// such as BMC30 is a top microwave opening plus its configured drawer fronts;
// it must never fall through to StandardDoorFront and gain invented doors.
function MicrowaveBaseFront({ x, y, w, h, fill, cabinet }: Omit<FrontProps, "type">) {
  const counts = resolveDoorDrawerCounts(cabinet ?? {});
  const doors = Math.max(0, counts.doors);
  const drawers = Math.max(0, counts.drawers);
  const inset = 4;
  const innerW = w - inset * 2;
  const configuredDrawerHeight = toNum(cabinet.drawerHeight) ?? 0;
  const configuredCabinetHeight = toNum(cabinet.height) ?? h;
  const drawerH = drawers > 0
    ? Math.min(h * 0.42, Math.max(10, configuredDrawerHeight > 0 ? (configuredDrawerHeight / configuredCabinetHeight) * h : h * 0.24))
    : 0;
  const openingH = h - inset * 2 - drawerH - (drawers > 0 ? 3 : 0);
  const doorH = doors > 0 ? Math.max(0, h * 0.22) : 0;
  const openingTop = y + inset;
  const doorTop = openingTop + openingH + 3;
  const drawerTop = doorTop + doorH + (doors > 0 && drawers > 0 ? 3 : 0);
  const doorW = doors > 0 ? (innerW - (doors - 1) * 3) / doors : 0;
  const perDrawerH = drawers > 0 ? drawerH / drawers : 0;
  return (
    <g data-cabinet-drawing="microwave-base">
      <Box x={x} y={y} w={w} h={h} fill={fill} />
      <rect data-config-microwave-opening="true" x={x + inset} y={openingTop} width={innerW} height={openingH} rx={1.5} fill="#1a1a1a" stroke={STROKE_LIGHT} strokeWidth={1} />
      {Array.from({ length: doors }).map((_, i) => (
        <g key={`mw-door-${i}`} data-config-microwave-door="true">
          <rect x={x + inset + i * (doorW + 3)} y={doorTop} width={doorW} height={doorH} rx={1.5} fill={PANEL_FILL} stroke={STROKE_LIGHT} strokeWidth={1} />
        </g>
      ))}
      {Array.from({ length: drawers }).map((_, i) => (
        <g key={`mw-drawer-${i}`} data-config-microwave-drawer="true">
          <rect x={x + inset} y={drawerTop + i * perDrawerH} width={innerW} height={perDrawerH} rx={1.5} fill={PANEL_FILL} stroke={STROKE_LIGHT} strokeWidth={1} />
          <rect x={x + w / 2 - innerW * 0.18} y={drawerTop + i * perDrawerH + perDrawerH / 2 - 0.8} width={innerW * 0.36} height={1.6} rx={0.8} fill={STROKE} />
        </g>
      ))}
    </g>
  );
}

// Sink base: false (non-functional) tilt-out top panel + doors below, with a
// sink-cutout indication on the top edge — explicitly NOT a plain straight top.
function SinkBaseFront({ x, y, w, h, fill }: Omit<FrontProps, "type" | "cabinet">) {
  const inset = 4;
  const innerW = w - inset * 2;
  const falseFrontH = Math.min(12, h * 0.16);
  const doorTop = y + inset + falseFrontH + inset;
  const doorBottom = y + h - inset;
  const doorAreaH = doorBottom - doorTop;
  const doorW = (innerW - 3) / 2;
  return (
    <g>
      <Box x={x} y={y} w={w} h={h} fill={fill} />
      {/* sink cutout indication: dashed basin arc above the cabinet top */}
      <path
        d={`M ${x + w * 0.3} ${y + 2.5} a ${w * 0.2} ${4} 0 0 0 ${w * 0.4} 0`}
        fill="none"
        stroke={STROKE_LIGHT}
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      {/* false tilt-out front (tilt hinge line at bottom) */}
      <rect
        x={x + inset}
        y={y + inset}
        width={innerW}
        height={falseFrontH}
        rx={1.5}
        fill={PANEL_FILL}
        stroke={STROKE_LIGHT}
        strokeWidth={1}
      />
      <line
        x1={x + inset + 3}
        y1={y + inset + falseFrontH}
        x2={x + inset + innerW - 3}
        y2={y + inset + falseFrontH}
        stroke={STROKE_LIGHT}
        strokeWidth={1}
      />
      {/* two doors below */}
      {[0, 1].map((i) => (
        <rect
          key={i}
          x={x + inset + i * (doorW + 3)}
          y={doorTop}
          width={doorW}
          height={doorAreaH}
          rx={1.5}
          fill={PANEL_FILL}
          stroke={STROKE_LIGHT}
          strokeWidth={1}
        />
      ))}
    </g>
  );
}

// Appliance garage: countertop unit with a tambour (roll-up) door = horizontal slats.
function ApplianceGarageFront({ x, y, w, h, fill }: Omit<FrontProps, "type" | "cabinet">) {
  const inset = 4;
  const innerW = w - inset * 2;
  const innerH = h - inset * 2;
  const slats = Math.max(4, Math.round(innerH / 4));
  const sh = innerH / slats;
  return (
    <g>
      <Box x={x} y={y} w={w} h={h} fill={fill} />
      <rect
        x={x + inset}
        y={y + inset}
        width={innerW}
        height={innerH}
        rx={1.5}
        fill={PANEL_FILL}
        stroke={STROKE_LIGHT}
        strokeWidth={1}
      />
      {Array.from({ length: slats - 1 }).map((_, i) => (
        <line
          key={i}
          x1={x + inset}
          y1={y + inset + (i + 1) * sh}
          x2={x + inset + innerW}
          y2={y + inset + (i + 1) * sh}
          stroke={STROKE_LIGHT}
          strokeWidth={0.9}
        />
      ))}
    </g>
  );
}

// Diagonal corner: pentagon/hexagon shape with 45° angled front face.
// Shows the cabinet as seen from above (plan-view-like) with the angled front
// containing door panel(s). Matches catalog drawings like DCW, WDC, DCB.
function DiagonalCornerFront({ x, y, w, h, fill, cabinet }: Omit<FrontProps, "type">) {
  const doors = Math.max(1, resolveDoorDrawerCounts(cabinet ?? {}).doors || 1);
  // Pentagon shape: two short sides along walls + angled front face
  // The angled front cuts across the corner at 45°
  const legDepth = w * 0.35; // how far it extends along each wall
  const path = `
    M ${x} ${y}
    L ${x + w} ${y}
    L ${x + w} ${y + legDepth}
    L ${x + legDepth} ${y + h}
    L ${x} ${y + h}
    Z`;
  // The angled face runs from (x+w, y+legDepth) to (x+legDepth, y+h)
  // Door panels are drawn on this angled face
  const faceStartX = x + w;
  const faceStartY = y + legDepth;
  const faceEndX = x + legDepth;
  const faceEndY = y + h;
  // Door panel inset from the angled face
  const faceLen = Math.sqrt((faceEndX - faceStartX) ** 2 + (faceEndY - faceStartY) ** 2);
  const angle = Math.atan2(faceEndY - faceStartY, faceEndX - faceStartX);
  // Draw door panel(s) as rotated rectangles on the angled face
  const doorInset = faceLen * 0.08;
  const doorLen = (faceLen - doorInset * 2 - (doors - 1) * 3) / doors;
  const doorDepth = Math.min(w * 0.22, h * 0.22);
  // Normal vector pointing inward (perpendicular to face, toward interior)
  const nx = Math.cos(angle + Math.PI / 2);
  const ny = Math.sin(angle + Math.PI / 2);
  return (
    <g>
      <path d={path} fill={fill} stroke={STROKE} strokeWidth={1.6} strokeLinejoin="round" />
      {/* Door panel(s) on the angled face */}
      {Array.from({ length: doors }).map((_, i) => {
        const startOffset = doorInset + i * (doorLen + 3);
        // Position along the face direction
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const px = faceStartX + dx * (startOffset + doorLen / 2);
        const py = faceStartY + dy * (startOffset + doorLen / 2);
        // Offset inward from face
        const cx = px + nx * (doorDepth / 2 + 2);
        const cy = py + ny * (doorDepth / 2 + 2);
        const angleDeg = (angle * 180) / Math.PI;
        return (
          <g key={i} transform={`rotate(${angleDeg} ${cx} ${cy})`}>
            <rect
              x={cx - doorLen / 2}
              y={cy - doorDepth / 2}
              width={doorLen}
              height={doorDepth}
              rx={1.5}
              fill={PANEL_FILL}
              stroke={STROKE_LIGHT}
              strokeWidth={1}
            />
            {/* handle */}
            <circle
              cx={cx + (i === 0 ? doorLen * 0.35 : -doorLen * 0.35)}
              cy={cy}
              r={1.2}
              fill={STROKE}
            />
          </g>
        );
      })}
    </g>
  );
}

// L-shaped corner: square footprint with L-notch at interior corner.
// Shows doors on the exposed face (lazy Susan, easy-reach corner).
function LCornerFront({ x, y, w, h, fill, cabinet }: Omit<FrontProps, "type">) {
  const doors = Math.max(1, resolveDoorDrawerCounts(cabinet ?? {}).doors || 2);
  const inset = 4;
  // L-shape: full width top, full height left, notch cut from bottom-right
  const legW = w * 0.65; // leg width (how far along each wall)
  const legH = h * 0.65;
  const path = `
    M ${x} ${y}
    L ${x + w} ${y}
    L ${x + w} ${y + legH}
    L ${x + legW} ${y + legH}
    L ${x + legW} ${y + h}
    L ${x} ${y + h}
    Z`;
  // Door panels on the front face (bottom-left portion)
  const doorAreaX = x + inset;
  const doorAreaY = y + inset;
  const doorAreaW = legW - inset * 2;
  const doorAreaH = h - inset * 2;
  const doorW = (doorAreaW - (doors - 1) * 3) / doors;
  return (
    <g>
      <path d={path} fill={fill} stroke={STROKE} strokeWidth={1.6} strokeLinejoin="round" />
      {/* Door panels on the accessible front face */}
      {Array.from({ length: doors }).map((_, i) => (
        <g key={i}>
          <rect
            x={doorAreaX + i * (doorW + 3)}
            y={doorAreaY}
            width={doorW}
            height={doorAreaH}
            rx={1.5}
            fill={PANEL_FILL}
            stroke={STROKE_LIGHT}
            strokeWidth={1}
          />
          {/* handle */}
          <circle
            cx={doorAreaX + i * (doorW + 3) + (i === doors - 1 ? 4 : doorW - 4)}
            cy={doorAreaY + doorAreaH / 2}
            r={1.2}
            fill={STROKE}
          />
        </g>
      ))}
      {/* Hatched area indicating the L-notch / hidden portion */}
      <rect
        x={x + legW + 2}
        y={y + legH + 2}
        width={w - legW - 4}
        height={h - legH - 4}
        rx={1}
        fill="none"
        stroke={STROKE_LIGHT}
        strokeWidth={0.8}
        strokeDasharray="2 2"
      />
    </g>
  );
}

// Blind corner: L-shaped footprint (one door face + a returning blind section).
function BlindCornerFront({ x, y, w, h, fill }: Omit<FrontProps, "type" | "cabinet">) {
  const inset = 4;
  const notch = w * 0.32;
  const path = `
    M ${x} ${y}
    L ${x + w} ${y}
    L ${x + w} ${y + h}
    L ${x + notch} ${y + h}
    L ${x + notch} ${y + h * 0.55}
    L ${x} ${y + h * 0.55}
    Z`;
  return (
    <g>
      <path d={path} fill={fill} stroke={STROKE} strokeWidth={1.6} strokeLinejoin="round" />
      {/* door on the accessible face */}
      <rect
        x={x + notch + inset}
        y={y + inset}
        width={w - notch - inset * 2}
        height={h - inset * 2}
        rx={1.5}
        fill={PANEL_FILL}
        stroke={STROKE_LIGHT}
        strokeWidth={1}
      />
      {/* blind (inaccessible) panel hint */}
      <rect
        x={x + inset}
        y={y + inset}
        width={notch - inset}
        height={h * 0.55 - inset * 2}
        rx={1}
        fill="none"
        stroke={STROKE_LIGHT}
        strokeWidth={0.8}
        strokeDasharray="2 2"
      />
    </g>
  );
}

// Corner drawer base (CDB-36): front elevation as seen in the product photo.
// The cabinet sits in a corner. Viewed from the front:
//   LEFT side:  24" wide BLANK side panel — full height, no drawers/doors (wall-facing)
//   RIGHT side: 12" wide drawer stack — full height, 3 stacked drawers with bar pulls
// Total width = 36" (24" side panel + 12" drawer face)
function CornerDrawerBaseFront({ x, y, w, h, fill, cabinet }: Omit<FrontProps, "type">) {
  const n = Math.max(2, resolveDoorDrawerCounts(cabinet ?? {}).drawers || 3);
  const inset = 3;
  const gap = 2;
  // Side panel is 24" of 36" = 67% of total width; drawer face is 12" = 33%.
  const sidePanelW = w * 0.67;
  const drawerFaceW = w - sidePanelW;
  return (
    <g>
      {/* Outer box — full rectangle */}
      <Box x={x} y={y} w={w} h={h} fill={fill} />
      {/* Vertical divider between side panel and drawer face */}
      <line
        x1={x + sidePanelW}
        y1={y}
        x2={x + sidePanelW}
        y2={y + h}
        stroke={STROKE_LIGHT}
        strokeWidth={1}
      />
      {/* LEFT: blank side panel — just a subtle inset rect to show it's a panel */}
      <rect
        x={x + inset}
        y={y + inset}
        width={sidePanelW - inset * 2}
        height={h - inset * 2}
        rx={1.5}
        fill={PANEL_FILL}
        stroke={STROKE_LIGHT}
        strokeWidth={0.8}
        strokeDasharray="0"
      />
      {/* RIGHT: 3 stacked drawers on the 12" drawer face */}
      {Array.from({ length: n }).map((_, i) => {
        const dzTop = y + inset;
        const dzH = h - inset * 2;
        const dh = Math.max(5, (dzH - (n - 1) * gap) / n);
        const dX = x + sidePanelW + inset;
        const dW = drawerFaceW - inset * 2;
        const pullCx = dX + dW / 2;
        return (
          <g key={i}>
            <rect
              x={dX}
              y={dzTop + i * (dh + gap)}
              width={dW}
              height={dh}
              rx={1.5}
              fill={PANEL_FILL}
              stroke={STROKE_LIGHT}
              strokeWidth={1}
            />
            {/* bar pull */}
            <rect
              x={pullCx - dW * 0.25}
              y={dzTop + i * (dh + gap) + dh / 2 - 0.8}
              width={dW * 0.5}
              height={1.6}
              rx={0.8}
              fill={STROKE}
            />
          </g>
        );
      })}
    </g>
  );
}

// Glass-front wall cabinet: door(s) with a glass pane + mullion cross.
function GlassDoorFront({ x, y, w, h, fill, cabinet }: Omit<FrontProps, "type">) {
  const doors = Math.max(1, resolveDoorDrawerCounts(cabinet ?? {}).doors || (w > 21 ? 2 : 1));
  const inset = 4;
  const innerW = w - inset * 2;
  const innerH = h - inset * 2;
  const doorW = (innerW - (doors - 1) * 3) / doors;
  return (
    <g>
      <Box x={x} y={y} w={w} h={h} fill={fill} />
      {Array.from({ length: doors }).map((_, i) => {
        const dx = x + inset + i * (doorW + 3);
        return (
          <g key={i}>
            <rect
              x={dx}
              y={y + inset}
              width={doorW}
              height={innerH}
              rx={1.5}
              fill="#eef6fb"
              stroke={STROKE_LIGHT}
              strokeWidth={1}
            />
            {/* mullion cross */}
            <line
              x1={dx + doorW / 2}
              y1={y + inset}
              x2={dx + doorW / 2}
              y2={y + inset + innerH}
              stroke={STROKE_LIGHT}
              strokeWidth={0.7}
            />
            <line
              x1={dx}
              y1={y + inset + innerH / 2}
              x2={dx + doorW}
              y2={y + inset + innerH / 2}
              stroke={STROKE_LIGHT}
              strokeWidth={0.7}
            />
          </g>
        );
      })}
    </g>
  );
}

// Chrome tray: a shelf-mounted wire insert for the matching ERB easy-reach
// corner cabinet. The nested quarter-round rails show a neutral technical
// silhouette without pretending it is a cabinet door, filler, or turntable.
function LazySusanTrayFront({ x, y, w, h, fill }: Omit<FrontProps, "type" | "cabinet">) {
  const pad = Math.min(w, h) * 0.08;
  const arcX = x + pad;
  const arcY = y + h - pad;
  const radius = Math.min(w - pad * 2, h * 1.8);
  const trayPath = `M ${arcX} ${arcY} L ${arcX + radius} ${arcY} A ${radius} ${radius} 0 0 0 ${arcX} ${arcY - radius} Z`;
  const railFractions = [0.36, 0.6, 0.82];
  return (
    <g data-cabinet-drawing="lazy-susan-tray">
      <path d={trayPath} fill={fill} stroke={STROKE} strokeWidth={1.6} strokeLinejoin="round" />
      {railFractions.map((fraction) => {
        const rail = radius * fraction;
        return (
          <path
            key={fraction}
            d={`M ${arcX + pad} ${arcY - rail} A ${rail} ${rail} 0 0 1 ${arcX + rail} ${arcY - pad}`}
            fill="none"
            stroke={STROKE_LIGHT}
            strokeWidth={1.1}
            strokeLinecap="round"
          />
        );
      })}
      <line x1={arcX + pad} y1={arcY - pad} x2={arcX + radius - pad} y2={arcY - pad} stroke={STROKE_LIGHT} strokeWidth={1} />
      <line x1={arcX + pad} y1={arcY - pad} x2={arcX + pad} y2={arcY - radius + pad} stroke={STROKE_LIGHT} strokeWidth={1} />
    </g>
  );
}

// WMS cabinet kit: an open wall frame with its lower shelf platform. This remains
// a fallback for when an approved WMS code-keyed technical image is not present,
// so it must never resemble a closed two-door wall cabinet.
function WallMicrowaveShelfFront({ x, y, w, h, fill }: Omit<FrontProps, "type" | "cabinet">) {
  const inset = Math.max(4, Math.min(8, w * 0.1));
  const frame = Math.max(2, Math.min(5, w * 0.055));
  const shelfY = y + h * 0.66;
  const trayH = Math.max(8, h * 0.2);
  const trayW = w - inset * 2;
  return (
    <g data-cabinet-drawing="wall-microwave-kit">
      <Box x={x} y={y} w={w} h={h} fill={fill} />
      <rect x={x + inset} y={y + inset} width={w - inset * 2} height={Math.max(2, shelfY - y - inset)} fill={PANEL_FILL} stroke={STROKE_LIGHT} strokeWidth={1} />
      <line x1={x + frame} y1={shelfY} x2={x + w - frame} y2={shelfY} stroke={STROKE} strokeWidth={1.6} />
      <rect x={x + inset} y={shelfY + frame} width={trayW} height={trayH} rx={Math.min(3, trayH / 3)} fill="#94a3b8" stroke={STROKE} strokeWidth={1.4} />
      <line x1={x + inset + frame} y1={shelfY + trayH * 0.55} x2={x + w - inset - frame} y2={shelfY + trayH * 0.55} stroke="#e2e8f0" strokeWidth={1} />
      <line x1={x + frame} y1={y + frame} x2={x + frame} y2={y + h - frame} stroke={STROKE} strokeWidth={1.2} />
      <line x1={x + w - frame} y1={y + frame} x2={x + w - frame} y2={y + h - frame} stroke={STROKE} strokeWidth={1.2} />
    </g>
  );
}

// Stand-alone WMSSHELF insert: a shallow framed shelf/pull-out platform. It
// deliberately has no cabinet sides or doors, so it cannot be mistaken for the
// full WMS3018 microwave cabinet kit.
function ShelfInsertFront({ x, y, w, h, fill }: Omit<FrontProps, "type" | "cabinet">) {
  const inset = Math.max(3, Math.min(7, w * 0.06));
  const railH = Math.max(1.3, h * 0.22);
  return (
    <g data-cabinet-drawing="shelf-insert">
      <rect x={x + inset} y={y + inset} width={w - inset * 2} height={h - inset * 2} rx={1.5} fill={PANEL_FILL} stroke={STROKE} strokeWidth={1.4} />
      <rect x={x + inset} y={y + h - inset - railH} width={w - inset * 2} height={railH} rx={1} fill={fill} stroke={STROKE} strokeWidth={1.2} />
      <line x1={x + inset * 2} y1={y + inset * 2} x2={x + w - inset * 2} y2={y + inset * 2} stroke={STROKE_LIGHT} strokeWidth={1} />
      <line x1={x + inset * 2} y1={y + h * 0.52} x2={x + w - inset * 2} y2={y + h * 0.52} stroke={STROKE_LIGHT} strokeWidth={1} />
    </g>
  );
}

// Plate racks are intentionally open-front. PR/WPR codes draw plate slots,
// while the existing face-pattern type remains reusable for wine/lattice units.
function FacePatternFront({ x, y, w, h, fill, cabinet }: Omit<FrontProps, "type">) {
  const code = String(cabinet.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const isPlateRack = /^(?:PR|WPR)\d/.test(code);
  const inset = 5;
  const innerW = w - inset * 2;
  const innerH = h - inset * 2;
  const pattern = cabinet.facePattern ?? (isPlateRack ? "slats" : "open");
  const slotCount = isPlateRack ? Math.max(4, Math.min(7, Math.round(w / 14))) : 4;
  return (
    <g data-cabinet-drawing={isPlateRack ? "plate-rack" : "face-pattern"}>
      <Box x={x} y={y} w={w} h={h} fill={fill} />
      <rect x={x + inset} y={y + inset} width={innerW} height={innerH} rx={1.5} fill={PANEL_FILL} stroke={STROKE_LIGHT} strokeWidth={1} />
      {isPlateRack && Array.from({ length: slotCount }).map((_, index) => {
        const ratio = (index + 0.5) / slotCount;
        const slotX = x + inset + innerW * ratio;
        return <line key={index} x1={slotX} y1={y + inset + 3} x2={slotX} y2={y + inset + innerH - 3} stroke={STROKE_LIGHT} strokeWidth={1.3} strokeLinecap="round" />;
      })}
      {!isPlateRack && pattern === "criss-cross" && (
        <>
          <line x1={x + inset} y1={y + inset} x2={x + inset + innerW} y2={y + inset + innerH} stroke={STROKE_LIGHT} strokeWidth={1} />
          <line x1={x + inset + innerW} y1={y + inset} x2={x + inset} y2={y + inset + innerH} stroke={STROKE_LIGHT} strokeWidth={1} />
        </>
      )}
      {!isPlateRack && pattern === "slats" && Array.from({ length: 5 }).map((_, index) => {
        const lineY = y + inset + ((index + 1) / 6) * innerH;
        return <line key={index} x1={x + inset + 3} y1={lineY} x2={x + inset + innerW - 3} y2={lineY} stroke={STROKE_LIGHT} strokeWidth={1} />;
      })}
    </g>
  );
}

// Accessory / molding / filler / panel / shelf: thin strip representation.
function AccessoryStrip({ x, y, w, h, fill }: Omit<FrontProps, "type" | "cabinet">) {
  // Represent as a narrow vertical strip centered in the viewBox.
  const stripW = Math.max(10, Math.min(w, 22));
  const sx = x + (w - stripW) / 2;
  return (
    <g>
      <rect
        x={sx}
        y={y}
        width={stripW}
        height={h}
        rx={2}
        fill={fill}
        stroke={STROKE}
        strokeWidth={1.6}
      />
      <line
        x1={sx + stripW / 2}
        y1={y + 4}
        x2={sx + stripW / 2}
        y2={y + h - 4}
        stroke={STROKE_LIGHT}
        strokeWidth={0.8}
        strokeDasharray="3 3"
      />
    </g>
  );
}

// Flat skin/end/veneer panel: a clean structural elevation. Unlike a door box,
// it never renders handles, drawers, doors, or a finish-specific appearance.
function FlatPanelFront({ x, y, w, h, fill, cabinet }: Omit<FrontProps, "type">) {
  const verticalGrain = cabinet.grainDirection !== "horizontal";
  const grainCount = Math.max(3, Math.min(7, Math.round((verticalGrain ? w : h) / 18)));
  return (
    <g data-cabinet-drawing="flat-panel">
      <Box x={x} y={y} w={w} h={h} fill={fill} />
      {Array.from({ length: grainCount }).map((_, index) => {
        const ratio = (index + 1) / (grainCount + 1);
        return verticalGrain ? (
          <line
            key={index}
            x1={x + w * ratio}
            y1={y + 4}
            x2={x + w * ratio}
            y2={y + h - 4}
            stroke={STROKE_LIGHT}
            strokeWidth={0.65}
            opacity={0.55}
          />
        ) : (
          <line
            key={index}
            x1={x + 4}
            y1={y + h * ratio}
            x2={x + w - 4}
            y2={y + h * ratio}
            stroke={STROKE_LIGHT}
            strokeWidth={0.65}
            opacity={0.55}
          />
        );
      })}
    </g>
  );
}

// Pantry / tall cabinet: outer box split into 2 stacked sections at ~54% height.
// Each section has 1 or 2 doors side-by-side (2 for wide cabinets >= 24").
// NO drawer band — pantry cabinets are all-door, top to bottom.
function PantryFront({ x, y, w, h, fill, cabinet }: Omit<FrontProps, "type">) {
  const inset = 4;
  const gap = 3; // gap between upper and lower door sections
  const innerW = w - inset * 2;

  // Determine doors per section based on width (narrow = 1 door, wide = 2 doors).
  const doorsPerSection: number = (() => {
    if (cabinet.doorsPerRow && cabinet.doorsPerRow > 0) return cabinet.doorsPerRow;
    return w > 21 ? 2 : 1;
  })();

  // Split height: lower section is ~54% of total height (matches the 54" lower
  // section of a standard 84" pantry). Upper section takes the remaining ~46%.
  const lowerFrac = 0.54;
  const dividerY = y + inset + (h - inset * 2) * lowerFrac;

  const upperTop = y + inset;
  const upperH = dividerY - upperTop - gap / 2;
  const lowerTop = dividerY + gap / 2;
  const lowerH = y + h - inset - lowerTop;

  const doorW = (innerW - (doorsPerSection - 1) * 3) / doorsPerSection;

  const renderSection = (sectionTop: number, sectionH: number) =>
    Array.from({ length: doorsPerSection }).map((_, i) => {
      const dx = x + inset + i * (doorW + 3);
      const handleX =
        doorsPerSection > 1
          ? i === 0
            ? dx + doorW - 4
            : dx + 4
          : dx + doorW / 2;
      return (
        <g key={i}>
          <rect
            x={dx}
            y={sectionTop}
            width={doorW}
            height={sectionH}
            rx={1.5}
            fill={PANEL_FILL}
            stroke={STROKE_LIGHT}
            strokeWidth={1}
          />
          <circle cx={handleX} cy={sectionTop + sectionH / 2} r={1.4} fill={STROKE} />
        </g>
      );
    });

  return (
    <g>
      <Box x={x} y={y} w={w} h={h} fill={fill} />
      {/* Horizontal divider line between upper and lower sections */}
      <line
        x1={x + inset}
        y1={dividerY}
        x2={x + w - inset}
        y2={dividerY}
        stroke={STROKE_LIGHT}
        strokeWidth={1}
      />
      {renderSection(upperTop, upperH)}
      {renderSection(lowerTop, lowerH)}
    </g>
  );
}

// Oven tall cabinet: 2 upper doors + appliance opening (single or double oven)
// + optional drawers at the bottom.
function OvenTallFront({ x, y, w, h, fill, cabinet }: Omit<FrontProps, "type">) {
  const inset = 4;
  const innerW = w - inset * 2;
  const gap = 2;

  const isDouble = cabinet.ovenType === "double";

  // Layout proportions (based on standard 84" oven tall cabinet):
  //   Upper doors: ~21% of height (~18")
  //   Oven opening: ~35% single / ~63% double
  //   Lower drawers: remaining
  const upperDoorFrac = 0.21;
  const ovenFrac = isDouble ? 0.63 : 0.35;
  const drawerFrac = 1 - upperDoorFrac - ovenFrac;

  const innerH = h - inset * 2;
  const upperDoorH = innerH * upperDoorFrac;
  const ovenH = innerH * ovenFrac;
  const drawerH = innerH * drawerFrac;

  const upperDoorTop = y + inset;
  const ovenTop = upperDoorTop + upperDoorH + gap;
  const drawerTop = ovenTop + ovenH + gap;

  const upperDoors = w > 21 ? 2 : 1;
  const upperDoorW = (innerW - (upperDoors - 1) * 3) / upperDoors;

  const lowerDrawers = Math.max(1, Math.round(drawerH / (innerH * 0.12)));
  const singleDrawerH = Math.max(4, (drawerH - (lowerDrawers - 1) * gap) / lowerDrawers);

  return (
    <g>
      <Box x={x} y={y} w={w} h={h} fill={fill} />

      {/* Upper door panels */}
      {Array.from({ length: upperDoors }).map((_, i) => {
        const dx = x + inset + i * (upperDoorW + 3);
        const handleX =
          upperDoors > 1 ? (i === 0 ? dx + upperDoorW - 4 : dx + 4) : dx + upperDoorW / 2;
        return (
          <g key={`ud-${i}`}>
            <rect
              x={dx}
              y={upperDoorTop}
              width={upperDoorW}
              height={upperDoorH}
              rx={1.5}
              fill={PANEL_FILL}
              stroke={STROKE_LIGHT}
              strokeWidth={1}
            />
            <circle cx={handleX} cy={upperDoorTop + upperDoorH / 2} r={1.4} fill={STROKE} />
          </g>
        );
      })}

      {/* Oven opening — grey fill with dashed border to indicate appliance cavity */}
      {isDouble ? (
        <>
          <rect
            x={x + inset}
            y={ovenTop}
            width={innerW}
            height={ovenH / 2 - gap / 2}
            rx={1.5}
            fill="#d1d5db"
            stroke={STROKE_LIGHT}
            strokeWidth={1}
            strokeDasharray="3 2"
          />
          <rect
            x={x + inset}
            y={ovenTop + ovenH / 2 + gap / 2}
            width={innerW}
            height={ovenH / 2 - gap / 2}
            rx={1.5}
            fill="#d1d5db"
            stroke={STROKE_LIGHT}
            strokeWidth={1}
            strokeDasharray="3 2"
          />
        </>
      ) : (
        <rect
          x={x + inset}
          y={ovenTop}
          width={innerW}
          height={ovenH}
          rx={1.5}
          fill="#d1d5db"
          stroke={STROKE_LIGHT}
          strokeWidth={1}
          strokeDasharray="3 2"
        />
      )}

      {/* Lower drawer fronts */}
      {Array.from({ length: lowerDrawers }).map((_, i) => (
        <g key={`dr-${i}`}>
          <rect
            x={x + inset}
            y={drawerTop + i * (singleDrawerH + gap)}
            width={innerW}
            height={singleDrawerH}
            rx={1.5}
            fill={PANEL_FILL}
            stroke={STROKE_LIGHT}
            strokeWidth={1}
          />
          <rect
            x={x + w / 2 - innerW * 0.18}
            y={drawerTop + i * (singleDrawerH + gap) + singleDrawerH / 2 - 0.8}
            width={innerW * 0.36}
            height={1.6}
            rx={0.8}
            fill={STROKE}
          />
        </g>
      ))}
    </g>
  );
}

export default CabinetDrawing;

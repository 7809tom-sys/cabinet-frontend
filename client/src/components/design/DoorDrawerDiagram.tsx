/**
 * DoorDrawerDiagram
 *
 * A compact SVG front-elevation schematic that visually shows WHERE doors and
 * drawers are positioned on a cabinet face.  It mirrors the same layout logic
 * used by ElevationView / DoorFront so the diagram always agrees with the
 * actual rendered elevation.
 *
 * Supported layouts:
 *   • Standard base     – top drawer band (26 %) + N side-by-side doors below
 *   • All-drawer        – N stacked drawer fronts, no doors
 *   • Door-only         – N side-by-side doors (wall cabinets, single-door base)
 *   • Pantry (tall)     – 2 doors top + 2 doors bottom split at ~54 / totalH
 *   • Oven/tall-oven    – 2 small doors top + oven opening + drawers bottom
 *   • Open / noDoor     – empty box (no panels)
 */

import React from "react";
import { cabinetDrawingType, isEqualHeightTwoDrawerBase, resolveDoorDrawerCounts, threeDrawerBaseRowHeights } from "@/lib/cabinetGraphics";
import type { CabinetLike } from "@/lib/cabinetGraphics";
import { pantryDrawerFrontLayout } from "@/lib/pantryDrawerLayout";

// ─── Palette ────────────────────────────────────────────────────────────────
const CLR = {
  box: "#334155",          // cabinet outline
  door: "#3b82f6",         // door fill (blue)
  doorStroke: "#1d4ed8",
  drawer: "#f59e0b",       // drawer fill (amber)
  drawerStroke: "#b45309",
  oven: "#6b7280",         // oven opening fill (gray)
  ovenStroke: "#374151",
  label: "#ffffff",        // text on panels
  subLabel: "#e2e8f0",     // secondary text
  ovenLabel: "#d1d5db",    // text on oven opening
  rail: "#475569",         // horizontal rail between zones
  bg: "transparent",
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface Props {
  cabinet: CabinetLike;
  /** Width of the rendered SVG in pixels (height is auto-calculated). */
  width?: number;
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toNum(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(v as string);
  return Number.isFinite(n) ? n : null;
}

function lc(s: string | null | undefined) {
  return (s ?? "").toLowerCase();
}

const WORD_NUM: Record<string, number> = {
  one: 1, single: 1, two: 2, double: 2, three: 3, triple: 3, four: 4, five: 5, six: 6,
};

/** Parse door count from a description string. */
function parseDoors(desc: string): number {
  const num = desc.match(/(\d+)\s*[- ]?door/);
  if (num) return parseInt(num[1], 10);
  const word = desc.match(/\b(single|two|double|three|triple|four)\s*[- ]?door/);
  if (word) return WORD_NUM[word[1]] ?? 0;
  return 0;
}

/** Parse drawer count from a description string. */
function parseDrawers(desc: string): number {
  const num = desc.match(/(\d+)\s*[- ]?drawer/);
  if (num) return parseInt(num[1], 10);
  const word = desc.match(/\b(single|two|double|three|triple|four|five|six)\s*[- ]?drawer/);
  if (word) return WORD_NUM[word[1]] ?? 0;
  return 0;
}

/** Detect oven / tall-oven cabinets by DB openingType field, code prefix, or description. */
function isOvenCabinet(cab: CabinetLike): boolean {
  // DB field takes priority — if admin explicitly set openingType, trust it
  if (cab.openingType === 'top' || cab.openingType === 'middle' || cab.openingType === 'bottom') return true;
  const code = lc(cab.masterCode);
  const desc = lc(cab.description);
  const sub  = lc(cab.subCategory);
  // Code prefixes used in catalog: O30/O33 (oven tall), UOC (utility oven combo)
  if (/^(?:o3[0-9]|uoc)/.test(code)) return true;
  // Description contains "oven" (but not "microwave oven" which is a base)
  if (/oven(?:\s+cabinet|\s+tower|\s+tall|\s+utility)?/.test(desc) && !/microwave/.test(desc)) return true;
  if (/oven/.test(sub)) return true;
  return false;
}

/** Get the opening position for a cabinet: 'top' | 'middle' | 'bottom'. Defaults to 'middle'. */
function getOpeningPosition(cab: CabinetLike): 'top' | 'middle' | 'bottom' {
  if (cab.openingType === 'top' || cab.openingType === 'middle' || cab.openingType === 'bottom') {
    return cab.openingType;
  }
  // Default: oven opening is in the middle (doors on top, drawers on bottom)
  return 'middle';
}

/** Render a single rectangular zone with fill + label centred inside. */
function Zone({
  x, y, w, h,
  fill, stroke,
  label, subLabel,
  fontSize = 11,
  subFontSize = 9,
  pantryUpperDoor,
  pantryBottomDrawer,
  pantryDrawerHeightIn,
}: {
  x: number; y: number; w: number; h: number;
  fill: string; stroke: string;
  label: string; subLabel?: string;
  fontSize?: number; subFontSize?: number;
  pantryUpperDoor?: boolean;
  pantryBottomDrawer?: boolean;
  pantryDrawerHeightIn?: number;
}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const showSub = subLabel && h > 28;
  return (
    <g>
      <rect
        x={x + 1} y={y + 1} width={w - 2} height={h - 2}
        rx={3} ry={3}
        fill={fill} stroke={stroke} strokeWidth={1.5}
        data-pantry-upper-doors={pantryUpperDoor ? "true" : undefined}
        data-pantry-bottom-drawer={pantryBottomDrawer ? "true" : undefined}
        data-pantry-drawer-height-in={pantryDrawerHeightIn}
      />
      <text
        x={cx} y={showSub ? cy - 5 : cy}
        textAnchor="middle" dominantBaseline="middle"
        fill={CLR.label} fontSize={fontSize} fontWeight="600"
        fontFamily="system-ui, sans-serif"
      >
        {label}
      </text>
      {showSub && (
        <text
          x={cx} y={cy + 8}
          textAnchor="middle" dominantBaseline="middle"
          fill={CLR.subLabel} fontSize={subFontSize}
          fontFamily="system-ui, sans-serif"
        >
          {subLabel}
        </text>
      )}
    </g>
  );
}

// ─── Drawer Layout Helpers ───────────────────────────────────────────────────

/** Parse the drawerLayout JSON string into an array of row specs. */
function parseDrawerLayout(
  json: string | null | undefined,
  _totalDrawers: number,
): Array<{ count: number; height?: number }> {
  if (!json) return [];
  try {
    const rows = JSON.parse(json);
    if (!Array.isArray(rows) || rows.length === 0) return [];
    // Validate each row has at least a count
    return rows.filter(
      (r: unknown) => typeof r === "object" && r !== null && typeof (r as any).count === "number" && (r as any).count > 0,
    ) as Array<{ count: number; height?: number }>;
  } catch {
    return [];
  }
}

/**
 * Push drawer zones and rails for a row-based drawer layout.
 * Each row splits width equally among `count` drawers.
 * Heights split equally among rows if not specified.
 */
function renderDrawerRows(
  rows: Array<{ count: number; height?: number }>,
  zones: Array<{
    x: number; y: number; w: number; h: number;
    fill: string; stroke: string;
    label: string; subLabel?: string;
  }>,
  rails: Array<{ y: number }>,
  padX: number,
  startY: number,
  totalW: number,
  totalH: number,
): void {
  // Calculate row heights: specified heights proportionally, unspecified split remaining
  const specifiedSum = rows.reduce((s, r) => s + (r.height ?? 0), 0);
  const unspecifiedCount = rows.filter((r) => !r.height).length;

  // Simpler approach: if any heights specified, use them as proportional weights
  // If none specified, split equally
  let rowHeights: number[];
  if (specifiedSum > 0 && unspecifiedCount === 0) {
    // All heights specified — use as proportions
    rowHeights = rows.map((r) => (r.height! / specifiedSum) * totalH);
  } else if (specifiedSum > 0 && unspecifiedCount > 0) {
    // Mixed: specified heights take their proportion, unspecified split the rest
    const specPx = (specifiedSum / (specifiedSum + unspecifiedCount * (specifiedSum / rows.length))) * totalH;
    const unspecPx = totalH - specPx;
    const autoH = unspecPx / unspecifiedCount;
    rowHeights = rows.map((r) => (r.height ? (r.height / specifiedSum) * specPx : autoH));
  } else {
    // No heights specified — equal split
    rowHeights = rows.map(() => totalH / rows.length);
  }

  let drawerIndex = 0;
  let y = startY;
  rows.forEach((row, rowIdx) => {
    const rowH = rowHeights[rowIdx];
    const colW = totalW / row.count;
    for (let col = 0; col < row.count; col++) {
      drawerIndex++;
      zones.push({
        x: padX + col * colW,
        y,
        w: colW,
        h: rowH,
        fill: CLR.drawer,
        stroke: CLR.drawerStroke,
        label: `Drawer ${drawerIndex}`,
      });
    }
    if (rowIdx < rows.length - 1) {
      rails.push({ y: y + rowH });
    }
    y += rowH;
  });
}

// ─── Main component ──────────────────────────────────────────────────────────
export function DoorDrawerDiagram({ cabinet, width = 180, className }: Props) {
  const type = cabinetDrawingType(cabinet);
  const { doors, drawers } = resolveDoorDrawerCounts(cabinet);
  const cabinetH = toNum(cabinet.height) ?? 34.5;

  // Aspect ratio: use real cabinet proportions, clamped to a reasonable range
  const cabinetW = toNum(cabinet.width) ?? 24;
  const rawRatio = cabinetH / cabinetW;
  const ratio = Math.min(Math.max(rawRatio, 0.6), 3.0);
  const svgH = Math.round(width * ratio);

  // Interior drawing area (leave margin for box outline + labels)
  const PAD = 8;
  const iW = width - PAD * 2;   // interior width
  const iH = svgH - PAD * 2;    // interior height

  // ── Build zone list ──────────────────────────────────────────────────────
  type ZoneSpec = {
    x: number; y: number; w: number; h: number;
    fill: string; stroke: string;
    label: string; subLabel?: string;
    pantryUpperDoor?: boolean;
    pantryBottomDrawer?: boolean;
    pantryDrawerHeightIn?: number;
  };
  const zones: ZoneSpec[] = [];
  const rails: { y: number }[] = [];  // horizontal rails between zones

  const DRAWER_BAND_PCT = 0.26; // matches ElevationView

  const isOven = isOvenCabinet(cabinet);

  // Only legacy records with no authored counts may fall back to description or
  // width parsing. An explicit zero in Cabinet Config is authoritative.
  let effectiveDoors = doors;
  let effectiveDrawers = drawers;
  const hasExplicitCounts = cabinet.numberOfDoors != null || cabinet.numberOfDrawers != null;
  if (doors === 0 && drawers === 0 && !cabinet.noDoor && !hasExplicitCounts) {
    const desc = lc(cabinet.description);
    effectiveDrawers = parseDrawers(desc);
    effectiveDoors   = parseDoors(desc);
    // If still 0 and description doesn't mention doors/drawers, fall back to width heuristic
    // (same logic as resolveDoorDrawerCounts step 4: >=24" = 2 doors, else 1)
    if (effectiveDoors === 0 && effectiveDrawers === 0 && !isOven) {
      const w = toNum(cabinet.width);
      effectiveDoors = w !== null && w >= 24 ? 2 : 1;
    }
  }

  const pantryDrawerLayout = pantryDrawerFrontLayout({
    masterCode: cabinet.masterCode,
    graphicType: cabinet.graphicType,
    category: cabinet.category,
    placementType: cabinet.placementType,
    description: cabinet.description,
    numberOfDoors: effectiveDoors,
    numberOfDrawers: effectiveDrawers,
    doorHeight: toNum(cabinet.doorHeight),
    drawerHeight: toNum(cabinet.drawerHeight),
    drawerLayout: cabinet.drawerLayout,
    openingType: cabinet.openingType,
    ovenType: cabinet.ovenType,
  }, cabinetH);

  // ── Panel / Decorative Door rendering ─────────────────────────────────────────
  // Panels render as a simple flat rectangle with measurements and grain/door indicator
  if (type === "panel" || type === "decorative-door") {
    const panelW = toNum(cabinet.width) ?? 36;
    const panelH = toNum(cabinet.height) ?? 96;
    const grain = (cabinet.grainDirection ?? "").toLowerCase();
    const isDecorative = type === "decorative-door";

    // Determine label
    const desc = lc(cabinet.description);
    let panelLabel = "Flat Panel";
    if (isDecorative) panelLabel = "Decorative Door";
    else if (/skin/.test(desc)) panelLabel = "Skin Panel";
    else if (/end panel/.test(desc)) panelLabel = "End Panel";
    else if (/refrigerator/.test(desc)) panelLabel = "Fridge Panel";

    // Measurement string
    const measLabel = `${panelW}" × ${panelH}"`;

    // Colors for panel
    const panelFill = isDecorative ? "#e0e7ff" : "#f1f5f9"; // light indigo for decorative, light slate for flat
    const panelStroke = isDecorative ? "#6366f1" : "#64748b";
    const textColor = isDecorative ? "#4338ca" : "#334155";

    const totalSvgH = svgH + 24; // extra space for label below

    return (
      <svg
        viewBox={`0 0 ${width} ${totalSvgH}`}
        width={width}
        height={totalSvgH}
        className={className}
        aria-label={`${panelLabel} ${measLabel}`}
        role="img"
      >
        {/* Panel rectangle */}
        <rect
          x={PAD} y={PAD} width={iW} height={iH}
          rx={3} ry={3}
          fill={panelFill} stroke={panelStroke} strokeWidth={2}
        />

        {/* Grain direction indicator (for flat panels) */}
        {!isDecorative && (grain === "vertical" || grain === "horizontal" || !grain) && (
          <g>
            {/* Grain lines */}
            {(grain === "horizontal" ? [0.3, 0.5, 0.7] : [0.3, 0.5, 0.7]).map((pct, i) => {
              if (grain === "horizontal") {
                const ly = PAD + iH * pct;
                return <line key={i} x1={PAD + 10} y1={ly} x2={PAD + iW - 10} y2={ly} stroke={panelStroke} strokeWidth={0.5} strokeDasharray="4 3" opacity={0.5} />;
              } else {
                const lx = PAD + iW * pct;
                return <line key={i} x1={lx} y1={PAD + 10} x2={lx} y2={PAD + iH - 10} stroke={panelStroke} strokeWidth={0.5} strokeDasharray="4 3" opacity={0.5} />;
              }
            })}
            {/* Grain direction arrow */}
            <g transform={`translate(${width / 2}, ${PAD + iH * 0.5})`}>
              <text
                x={0} y={-14}
                textAnchor="middle" dominantBaseline="middle"
                fill={textColor} fontSize={9} fontFamily="system-ui, sans-serif"
              >
                GRAIN
              </text>
              {/* Arrow pointing up/down for vertical, left/right for horizontal */}
              {grain === "horizontal" ? (
                <>
                  <line x1={-12} y1={0} x2={12} y2={0} stroke={textColor} strokeWidth={1.5} />
                  <polygon points="12,0 7,-3 7,3" fill={textColor} />
                  <polygon points="-12,0 -7,-3 -7,3" fill={textColor} />
                </>
              ) : (
                <>
                  <line x1={0} y1={-8} x2={0} y2={8} stroke={textColor} strokeWidth={1.5} />
                  <polygon points="0,-8 -3,-3 3,-3" fill={textColor} />
                  <polygon points="0,8 -3,3 3,3" fill={textColor} />
                </>
              )}
            </g>
          </g>
        )}

        {/* Decorative door checkmark indicator */}
        {isDecorative && (
          <g transform={`translate(${width / 2}, ${PAD + iH * 0.45})`}>
            {/* Checkmark circle */}
            <circle cx={0} cy={0} r={14} fill="#4f46e5" opacity={0.15} />
            <path
              d="M-6,0 L-2,4 L6,-4"
              stroke="#4f46e5" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round"
            />
            <text
              x={0} y={22}
              textAnchor="middle" dominantBaseline="middle"
              fill={textColor} fontSize={8} fontFamily="system-ui, sans-serif"
            >
              DOOR IMAGE
            </text>
          </g>
        )}

        {/* Measurement label (width × height) */}
        <text
          x={width / 2} y={PAD + iH - 12}
          textAnchor="middle" dominantBaseline="middle"
          fill={textColor} fontSize={11} fontWeight="600"
          fontFamily="system-ui, sans-serif"
        >
          {measLabel}
        </text>

        {/* Panel type label below */}
        <text
          x={width / 2} y={svgH + 12}
          textAnchor="middle" dominantBaseline="middle"
          fill="#64748b" fontSize={10} fontWeight="500"
          fontFamily="system-ui, sans-serif"
        >
          {panelLabel}
        </text>
      </svg>
    );
  }

  // ── Diagonal/L-corner special rendering ─────────────────────────────────────
  // These types get a completely different SVG shape (not the standard rectangular box)
  const isDiagonal = type === "diagonal-corner";
  const isLCorner = type === "l-corner";
  const isEndReturn = type === "end-return";

  if (isDiagonal || isLCorner || isEndReturn) {
    // Render a custom SVG for diagonal/L-corner cabinets instead of the zone-based approach
    const cornerLegend: { color: string; label: string }[] = [];
    if (effectiveDoors > 0) cornerLegend.push({ color: CLR.door, label: `${effectiveDoors} Door${effectiveDoors > 1 ? "s" : ""}` });
    if (effectiveDrawers > 0) cornerLegend.push({ color: CLR.drawer, label: `${effectiveDrawers} Drawer${effectiveDrawers > 1 ? "s" : ""}` });
    if (cornerLegend.length === 0) cornerLegend.push({ color: "#64748b", label: isDiagonal ? "Diagonal Corner" : "L-Corner" });

    const cLegendY = svgH + 6;
    const cTotalSvgH = svgH + 24;

    if (isEndReturn) {
      // BEC/BA cabinets are a 24×24 end return: two separate 12-inch faces
      // meet at the outer return seam. They are not a flat diagonal front.
      const faceInset = Math.min(iW * 0.13, 24);
      const faceRise = Math.min(iH * 0.13, 28);
      const doorInset = 7;
      const seamX = PAD + iW / 2;
      const leftFacePts = [
        `${seamX},${PAD}`,
        `${PAD + faceInset},${PAD + faceRise}`,
        `${PAD + faceInset},${PAD + iH - faceInset}`,
        `${seamX},${PAD + iH}`,
      ].join(" ");
      const rightFacePts = [
        `${seamX},${PAD}`,
        `${PAD + iW - faceInset},${PAD + faceRise}`,
        `${PAD + iW - faceInset},${PAD + iH - faceInset}`,
        `${seamX},${PAD + iH}`,
      ].join(" ");
      const leftDoorPts = [
        `${seamX - doorInset},${PAD + doorInset}`,
        `${PAD + faceInset + doorInset},${PAD + faceRise + doorInset}`,
        `${PAD + faceInset + doorInset},${PAD + iH - faceInset - doorInset}`,
        `${seamX - doorInset},${PAD + iH - doorInset}`,
      ].join(" ");
      const rightDoorPts = [
        `${seamX + doorInset},${PAD + doorInset}`,
        `${PAD + iW - faceInset - doorInset},${PAD + faceRise + doorInset}`,
        `${PAD + iW - faceInset - doorInset},${PAD + iH - faceInset - doorInset}`,
        `${seamX + doorInset},${PAD + iH - doorInset}`,
      ].join(" ");
      const doorLabelY = PAD + iH / 2;
      const leftLabelX = (seamX + PAD + faceInset) / 2;
      const rightLabelX = (seamX + PAD + iW - faceInset) / 2;

      return (
        <svg
          viewBox={`0 0 ${width} ${cTotalSvgH}`}
          width={width}
          height={cTotalSvgH}
          className={className}
          aria-label="BEC-24 two-face 24-by-24 end-return diagram"
          role="img"
          data-bec-end-return-detail="true"
        >
          <polygon
            points={leftFacePts}
            fill="#dbeafe"
            stroke={CLR.box}
            strokeWidth={2}
            strokeLinejoin="round"
            data-bec-left-return-face="true"
          />
          <polygon
            points={rightFacePts}
            fill="#bfdbfe"
            stroke={CLR.box}
            strokeWidth={2}
            strokeLinejoin="round"
            data-bec-right-return-face="true"
          />
          <polygon
            points={leftDoorPts}
            fill={CLR.door}
            stroke={CLR.doorStroke}
            strokeWidth={1.5}
            strokeLinejoin="round"
            data-bec-angled-door="left"
          />
          <polygon
            points={rightDoorPts}
            fill={CLR.door}
            stroke={CLR.doorStroke}
            strokeWidth={1.5}
            strokeLinejoin="round"
            data-bec-angled-door="right"
          />
          <line
            x1={seamX}
            y1={PAD}
            x2={seamX}
            y2={PAD + iH}
            stroke={CLR.box}
            strokeWidth={2}
            data-bec-center-seam="true"
          />
          <text x={leftLabelX} y={doorLabelY} textAnchor="middle" dominantBaseline="middle" fill={CLR.label} fontSize={9} fontWeight="600" fontFamily="system-ui, sans-serif">Left 12&quot; Door</text>
          <text x={rightLabelX} y={doorLabelY} textAnchor="middle" dominantBaseline="middle" fill={CLR.label} fontSize={9} fontWeight="600" fontFamily="system-ui, sans-serif">Right 12&quot; Door</text>
          <text x={width / 2} y={cLegendY + 5} textAnchor="middle" dominantBaseline="middle" fill="#64748b" fontSize={9} fontFamily="system-ui, sans-serif">24×24 end return · two 12&quot; faces</text>
        </svg>
      );
    }

    if (isDiagonal) {
      // Pentagon shape: two wall-facing backs + 45° angled front face
      const legFrac = 0.38; // fraction of box used by each wall-facing leg
      const legW = iW * legFrac;
      const legH = iH * legFrac;
      // Pentagon points: top-left corner is the wall corner
      // Legs go along top and left walls, front face cuts diagonally
      const pts = [
        `${PAD},${PAD}`,                    // top-left (wall corner)
        `${PAD + iW},${PAD}`,               // top-right
        `${PAD + iW},${PAD + legH}`,        // right leg end
        `${PAD + legW},${PAD + iH}`,        // bottom leg end
        `${PAD},${PAD + iH}`,               // bottom-left
      ].join(" ");

      // Door panels on the angled face (from right-leg-end to bottom-leg-end)
      const fsx = PAD + iW;
      const fsy = PAD + legH;
      const fex = PAD + legW;
      const fey = PAD + iH;
      const faceLen = Math.sqrt((fex - fsx) ** 2 + (fey - fsy) ** 2);
      const faceAngle = Math.atan2(fey - fsy, fex - fsx);
      const doorInset = faceLen * 0.1;
      const doorCount = Math.max(1, effectiveDoors);
      const doorGap = 4;
      const doorLen = (faceLen - doorInset * 2 - (doorCount - 1) * doorGap) / doorCount;
      const doorDepth = Math.min(iW * 0.2, iH * 0.2);
      const ndx = Math.cos(faceAngle + Math.PI / 2);
      const ndy = Math.sin(faceAngle + Math.PI / 2);

      return (
        <svg viewBox={`0 0 ${width} ${cTotalSvgH}`} width={width} height={cTotalSvgH} className={className} aria-label="Diagonal corner cabinet diagram" role="img">
          {/* Pentagon outline */}
          <polygon points={pts} fill="none" stroke={CLR.box} strokeWidth={2} strokeLinejoin="round" />
          {/* Door panels on angled face */}
          {Array.from({ length: doorCount }).map((_, i) => {
            const offset = doorInset + i * (doorLen + doorGap) + doorLen / 2;
            const cx = fsx + Math.cos(faceAngle) * offset + ndx * (doorDepth / 2 + 4);
            const cy = fsy + Math.sin(faceAngle) * offset + ndy * (doorDepth / 2 + 4);
            const angleDeg = (faceAngle * 180) / Math.PI;
            return (
              <g key={i} transform={`rotate(${angleDeg} ${cx} ${cy})`}>
                <rect
                  x={cx - doorLen / 2} y={cy - doorDepth / 2}
                  width={doorLen} height={doorDepth}
                  rx={3} ry={3}
                  fill={CLR.door} stroke={CLR.doorStroke} strokeWidth={1.5}
                />
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill={CLR.label} fontSize={9} fontWeight="600" fontFamily="system-ui, sans-serif">
                  {doorCount === 1 ? "Door" : `Door ${i + 1}`}
                </text>
              </g>
            );
          })}
          {/* Legend */}
          {cornerLegend.map((item, idx) => (
            <g key={`leg-${idx}`}>
              <rect x={PAD + idx * (width / cornerLegend.length)} y={cLegendY} width={10} height={10} rx={2} fill={item.color} />
              <text x={PAD + idx * (width / cornerLegend.length) + 13} y={cLegendY + 5} dominantBaseline="middle" fill="#64748b" fontSize={9} fontFamily="system-ui, sans-serif">{item.label}</text>
            </g>
          ))}
        </svg>
      );
    } else {
      // L-corner: square box with L-notch cut from interior corner
      const legFrac = 0.6; // fraction of box occupied by each leg
      const legW = iW * legFrac;
      const legH = iH * legFrac;
      // L-shape: wall corner at top-left, notch cut from bottom-right
      const pts = [
        `${PAD},${PAD}`,                     // top-left
        `${PAD + iW},${PAD}`,                // top-right
        `${PAD + iW},${PAD + legH}`,         // right side down to leg
        `${PAD + legW},${PAD + legH}`,       // notch inner corner
        `${PAD + legW},${PAD + iH}`,         // down to bottom
        `${PAD},${PAD + iH}`,                // bottom-left
      ].join(" ");

      // Door panels on the front face (the left/bottom portion)
      const doorCount = Math.max(1, effectiveDoors);
      const doorAreaX = PAD + 4;
      const doorAreaY = PAD + legH + 4;
      const doorAreaW = legW - 8;
      const doorAreaH = iH - legH - 8;
      const doorColW = (doorAreaW - (doorCount - 1) * 4) / doorCount;

      return (
        <svg viewBox={`0 0 ${width} ${cTotalSvgH}`} width={width} height={cTotalSvgH} className={className} aria-label="L-corner cabinet diagram" role="img">
          {/* L-shape outline */}
          <polygon points={pts} fill="none" stroke={CLR.box} strokeWidth={2} strokeLinejoin="round" />
          {/* Door panels on the accessible face (bottom-left area) */}
          {Array.from({ length: doorCount }).map((_, i) => {
            const dx = doorAreaX + i * (doorColW + 4);
            return (
              <Zone key={i}
                x={dx} y={doorAreaY} w={doorColW} h={doorAreaH}
                fill={CLR.door} stroke={CLR.doorStroke}
                label={doorCount === 1 ? "Door" : doorCount === 2 ? (i === 0 ? "Left" : "Right") : `Door ${i + 1}`}
              />
            );
          })}
          {/* Top/right area: second face (side doors or shelves) */}
          <Zone
            x={PAD + legW + 4} y={PAD + 4}
            w={iW - legW - 8} h={legH - 8}
            fill={CLR.door} stroke={CLR.doorStroke}
            label={doorCount >= 2 ? "Side" : "Door"}
            subLabel="return face"
          />
          {/* Hatched notch area */}
          <rect
            x={PAD + legW + 2} y={PAD + legH + 2}
            width={iW - legW - 4} height={iH - legH - 4}
            rx={2}
            fill="none" stroke={CLR.rail} strokeWidth={1} strokeDasharray="3 3"
          />
          {/* Legend */}
          {cornerLegend.map((item, idx) => (
            <g key={`leg-${idx}`}>
              <rect x={PAD + idx * (width / cornerLegend.length)} y={cLegendY} width={10} height={10} rx={2} fill={item.color} />
              <text x={PAD + idx * (width / cornerLegend.length) + 13} y={cLegendY + 5} dominantBaseline="middle" fill="#64748b" fontSize={9} fontFamily="system-ui, sans-serif">{item.label}</text>
            </g>
          ))}
        </svg>
      );
    }
  }

  if (effectiveDoors === 0 && effectiveDrawers === 0 && !isOven) {
    // Open cabinet (noDoor flag or genuinely no doors/drawers) — nothing to draw inside

  } else if (isOven) {
    // ── Appliance opening cabinet layout ───────────────────────────────────────────────────────────────────────────
    // Layout depends on openingType:
    //   'top'    — opening on top, doors/drawers below
    //   'middle' — doors on top, opening in middle, drawers at bottom (default)
    //   'bottom' — doors on top, drawers in middle, opening at bottom
    const openingPos = getOpeningPosition(cabinet);
    const doorCount = effectiveDoors; // respect admin setting: 0 doors means no door zone
    const hasDoors = doorCount > 0;
    const hasDrawers = effectiveDrawers > 0;
    const openingLabel = "Appliance Opening";
    const openingSubLabel = "cutout";

    // Use doorHeight and drawerHeight from admin config if available to calculate proportions
    const cabTotalH = toNum(cabinet.height) ?? 84;
    const adminDoorH = cabinet.doorHeight ? Number(cabinet.doorHeight) : null;
    const adminDrawerH = cabinet.drawerHeight ? Number(cabinet.drawerHeight) : null;

    if (openingPos === 'top') {
      // Opening at top, doors/drawers below
      let openingPct: number, doorPct: number, drawerPct: number;
      if (!hasDoors) {
        // No doors: just opening + drawers
        doorPct = 0;
        if (adminDrawerH && adminDrawerH > 0 && hasDrawers) {
          const drawerInches = adminDrawerH * effectiveDrawers;
          drawerPct = drawerInches / cabTotalH;
        } else {
          drawerPct = hasDrawers ? Math.max(0.20, 0.10 * effectiveDrawers) : 0;
        }
        openingPct = Math.max(0.15, 1 - drawerPct);
      } else if (adminDoorH && adminDoorH > 0) {
        doorPct = adminDoorH / cabTotalH;
        const drawerInches = adminDrawerH && adminDrawerH > 0 ? adminDrawerH * effectiveDrawers : effectiveDrawers * 5;
        drawerPct = hasDrawers ? drawerInches / cabTotalH : 0;
        openingPct = Math.max(0.15, 1 - doorPct - drawerPct);
      } else if (adminDrawerH && adminDrawerH > 0 && hasDrawers) {
        const drawerInches = adminDrawerH * effectiveDrawers;
        drawerPct = drawerInches / cabTotalH;
        doorPct = doorCount > 0 ? 0.30 : 0;
        openingPct = Math.max(0.15, 1 - doorPct - drawerPct);
      } else {
        openingPct = 0.45;
        doorPct    = hasDrawers ? 0.30 : (1 - openingPct);
        drawerPct  = hasDrawers ? Math.max(0.10 * effectiveDrawers, 1 - openingPct - doorPct) : 0;
      }
      const openingH = Math.round(iH * openingPct);
      const doorH    = Math.round(iH * doorPct);
      const drawerH  = iH - openingH - doorH;

      // Opening at top
      zones.push({ x: PAD, y: PAD, w: iW, h: openingH, fill: CLR.oven, stroke: CLR.ovenStroke, label: openingLabel, subLabel: openingSubLabel });
      rails.push({ y: PAD + openingH });

      // Doors below opening (only if doors > 0)
      if (hasDoors) {
        const doorColW = iW / doorCount;
        for (let i = 0; i < doorCount; i++) {
          const doorLabel = doorCount === 1 ? "Door" : doorCount === 2 ? (i === 0 ? "Left Door" : "Right Door") : `Door ${i + 1}`;
          zones.push({ x: PAD + i * doorColW, y: PAD + openingH, w: doorColW, h: doorH, fill: CLR.door, stroke: CLR.doorStroke, label: doorLabel });
        }
      }

      // Drawers at bottom
      if (hasDrawers) {
        if (hasDoors) rails.push({ y: PAD + openingH + doorH });
        const sliceH = drawerH / effectiveDrawers;
        for (let i = 0; i < effectiveDrawers; i++) {
          zones.push({ x: PAD, y: PAD + openingH + doorH + i * sliceH, w: iW, h: sliceH, fill: CLR.drawer, stroke: CLR.drawerStroke, label: `Drawer ${i + 1}`, subLabel: i === effectiveDrawers - 1 ? "bottom" : undefined });
        }
      }

    } else if (openingPos === 'bottom') {
      // Doors on top, opening at bottom (no drawers below opening)
      let doorPct: number, drawerPct: number, openingPct: number;
      if (!hasDoors) {
        doorPct = 0;
        if (adminDrawerH && adminDrawerH > 0 && hasDrawers) {
          const drawerInches = adminDrawerH * effectiveDrawers;
          drawerPct = drawerInches / cabTotalH;
        } else {
          drawerPct = hasDrawers ? Math.max(0.20, 0.10 * effectiveDrawers) : 0;
        }
        openingPct = Math.max(0.15, 1 - drawerPct);
      } else if (adminDoorH && adminDoorH > 0) {
        doorPct = adminDoorH / cabTotalH;
        const drawerInches = adminDrawerH && adminDrawerH > 0 ? adminDrawerH * effectiveDrawers : effectiveDrawers * 5;
        drawerPct = hasDrawers ? drawerInches / cabTotalH : 0;
        openingPct = Math.max(0.15, 1 - doorPct - drawerPct);
      } else if (adminDrawerH && adminDrawerH > 0 && hasDrawers) {
        const drawerInches = adminDrawerH * effectiveDrawers;
        drawerPct = drawerInches / cabTotalH;
        doorPct = doorCount > 0 ? 0.30 : 0;
        openingPct = Math.max(0.15, 1 - doorPct - drawerPct);
      } else {
        doorPct    = 0.30;
        drawerPct  = hasDrawers ? Math.max(0.10 * effectiveDrawers, 0.25) : 0;
        openingPct = Math.max(0.20, 1 - doorPct - drawerPct);
      }
      const doorH    = Math.round(iH * doorPct);
      const drawerH  = Math.round(iH * drawerPct);
      const openingH = iH - doorH - drawerH;

      // Doors at top (only if doors > 0)
      if (hasDoors) {
        const doorColW = iW / doorCount;
        for (let i = 0; i < doorCount; i++) {
          const doorLabel = doorCount === 1 ? "Door" : doorCount === 2 ? (i === 0 ? "Left Door" : "Right Door") : `Door ${i + 1}`;
          zones.push({ x: PAD + i * doorColW, y: PAD, w: doorColW, h: doorH, fill: CLR.door, stroke: CLR.doorStroke, label: doorLabel, subLabel: "upper" });
        }
        rails.push({ y: PAD + doorH });
      }

      // Drawers in middle (if any)
      if (hasDrawers) {
        const sliceH = drawerH / effectiveDrawers;
        for (let i = 0; i < effectiveDrawers; i++) {
          zones.push({ x: PAD, y: PAD + doorH + i * sliceH, w: iW, h: sliceH, fill: CLR.drawer, stroke: CLR.drawerStroke, label: `Drawer ${i + 1}` });
        }
        rails.push({ y: PAD + doorH + drawerH });
      }

      // Opening at bottom
      zones.push({ x: PAD, y: PAD + doorH + drawerH, w: iW, h: openingH, fill: CLR.oven, stroke: CLR.ovenStroke, label: openingLabel, subLabel: openingSubLabel });

    } else {
      // Default 'middle': doors on top, opening in middle, drawers at bottom
      let topDoorPct: number, drawerPct: number, ovenPct: number;
      if (!hasDoors) {
        topDoorPct = 0;
        if (adminDrawerH && adminDrawerH > 0 && hasDrawers) {
          const drawerInches = adminDrawerH * effectiveDrawers;
          drawerPct = drawerInches / cabTotalH;
        } else {
          drawerPct = hasDrawers ? Math.max(0.20, 0.10 * effectiveDrawers) : 0;
        }
        ovenPct = Math.max(0.15, 1 - drawerPct);
      } else if (adminDoorH && adminDoorH > 0) {
        topDoorPct = adminDoorH / cabTotalH;
        const drawerInches = adminDrawerH && adminDrawerH > 0 ? adminDrawerH * effectiveDrawers : effectiveDrawers * 5;
        drawerPct = hasDrawers ? drawerInches / cabTotalH : 0;
        ovenPct = Math.max(0.15, 1 - topDoorPct - drawerPct);
      } else if (adminDrawerH && adminDrawerH > 0 && hasDrawers) {
        const drawerInches = adminDrawerH * effectiveDrawers;
        drawerPct = drawerInches / cabTotalH;
        topDoorPct = doorCount > 0 ? 0.20 : 0;
        ovenPct = Math.max(0.15, 1 - topDoorPct - drawerPct);
      } else {
        topDoorPct  = 0.20;
        drawerPct   = hasDrawers ? Math.max(0.10 * effectiveDrawers, 0.25) : 0;
        ovenPct     = Math.max(0.20, 1 - topDoorPct - drawerPct);
      }
      const topDoorH = Math.round(iH * topDoorPct);
      const drawerH  = Math.round(iH * drawerPct);
      const ovenH    = iH - topDoorH - drawerH;

      // Top doors (side-by-side) — only if doors > 0
      if (hasDoors) {
        const doorColW = iW / doorCount;
        for (let i = 0; i < doorCount; i++) {
          const doorLabel = doorCount === 1 ? "Door" : doorCount === 2 ? (i === 0 ? "Left Door" : "Right Door") : `Door ${i + 1}`;
          zones.push({ x: PAD + i * doorColW, y: PAD, w: doorColW, h: topDoorH, fill: CLR.door, stroke: CLR.doorStroke, label: doorLabel, subLabel: "upper" });
        }
        rails.push({ y: PAD + topDoorH });
      }

      // Opening in middle
      zones.push({ x: PAD, y: PAD + topDoorH, w: iW, h: ovenH, fill: CLR.oven, stroke: CLR.ovenStroke, label: openingLabel, subLabel: openingSubLabel });

      // Drawers at bottom
      if (hasDrawers) {
        rails.push({ y: PAD + topDoorH + ovenH });
        const sliceH = drawerH / effectiveDrawers;
        for (let i = 0; i < effectiveDrawers; i++) {
          zones.push({ x: PAD, y: PAD + topDoorH + ovenH + i * sliceH, w: iW, h: sliceH, fill: CLR.drawer, stroke: CLR.drawerStroke, label: `Drawer ${i + 1}`, subLabel: i === effectiveDrawers - 1 ? "bottom" : undefined });
        }
      }
    }

  } else if (pantryDrawerLayout || type === "pantry") {
    if (pantryDrawerLayout) {
      const drawerAreaIn = pantryDrawerLayout.rows.reduce((sum, row) => sum + row.height, 0);
      const doorH = Math.max(0, Math.min(iH, (pantryDrawerLayout.doorHeight / cabinetH) * iH));
      const drawerAreaH = Math.max(0, Math.min(iH - doorH, (drawerAreaIn / cabinetH) * iH));
      const doorColW = iW / pantryDrawerLayout.doorCount;

      for (let index = 0; index < pantryDrawerLayout.doorCount; index++) {
        const label = pantryDrawerLayout.doorCount === 1 ? "Door" : index === 0 ? "Left Door" : "Right Door";
        zones.push({
          x: PAD + index * doorColW,
          y: PAD,
          w: doorColW,
          h: doorH,
          fill: CLR.door,
          stroke: CLR.doorStroke,
          label,
          subLabel: "upper",
          pantryUpperDoor: true,
        });
      }
      rails.push({ y: PAD + doorH });

      let rowY = PAD + doorH;
      let drawerIndex = 0;
      pantryDrawerLayout.rows.forEach((row, rowIndex) => {
        const rowH = drawerAreaIn > 0 ? (row.height / drawerAreaIn) * drawerAreaH : 0;
        const drawerColW = iW / row.count;
        for (let columnIndex = 0; columnIndex < row.count; columnIndex++) {
          drawerIndex += 1;
          zones.push({
            x: PAD + columnIndex * drawerColW,
            y: rowY,
            w: drawerColW,
            h: rowH,
            fill: CLR.drawer,
            stroke: CLR.drawerStroke,
            label: `Drawer ${drawerIndex}`,
            pantryBottomDrawer: true,
            pantryDrawerHeightIn: row.height,
          });
        }
        if (rowIndex < pantryDrawerLayout.rows.length - 1) rails.push({ y: rowY + rowH });
        rowY += rowH;
      });
    } else {
    // Pantry: split at ~54" from floor into upper and lower sections.
    // Use actual door count from admin config to determine layout:
    //   - 2 doors total → 1 top + 1 bottom (stacked, for narrow pantries like 18")
    //   - 4 doors total → 2 top + 2 bottom (side-by-side, for wider pantries like 24"+)
    //   - fallback: use width heuristic (>=24" = 2 per section, else 1 per section)
    const totalH = cabinetH;
    const splitIn = 54;
    const splitPct = Math.min(0.8, Math.max(0.2, splitIn / totalH));
    const botH = Math.round(iH * splitPct);
    const topH = iH - botH;

    // Determine doors per section based on total door count
    const totalDoors = effectiveDoors > 0 ? effectiveDoors : 4; // fallback to 4 for classic pantry
    const doorsPerSection = Math.max(1, Math.round(totalDoors / 2));
    const dW = Math.round(iW / doorsPerSection);

    // Bottom doors
    for (let i = 0; i < doorsPerSection; i++) {
      const label = doorsPerSection === 1 ? "Door" : (i === 0 ? "Left Door" : "Right Door");
      zones.push({
        x: PAD + i * dW, y: PAD + topH,
        w: dW, h: botH,
        fill: CLR.door, stroke: CLR.doorStroke,
        label,
        subLabel: "lower",
      });
    }
    // Rail between top and bottom
    rails.push({ y: PAD + topH });
    // Top doors
    for (let i = 0; i < doorsPerSection; i++) {
      const label = doorsPerSection === 1 ? "Door" : (i === 0 ? "Left Door" : "Right Door");
      zones.push({
        x: PAD + i * dW, y: PAD,
        w: dW, h: topH,
        fill: CLR.door, stroke: CLR.doorStroke,
        label,
        subLabel: "upper",
      });
    }
    }

  } else if (effectiveDrawers > 0 && effectiveDoors > 0) {
    // Standard base: drawer rows stacked on top, doors side-by-side below
    // Parse drawerLayout JSON for row-based grid rendering
    const drawerRows = parseDrawerLayout(cabinet.drawerLayout, effectiveDrawers);

    const drawerBandH = Math.min(
      Math.round(iH * DRAWER_BAND_PCT * effectiveDrawers),
      Math.round(iH * 0.55) // never take more than 55% of height
    );
    const doorH = iH - drawerBandH;
    // doorsPerRow: explicit admin override; fallback = all doors side-by-side in one row
    const doorsPerRow = (cabinet as CabinetLike & { doorsPerRow?: number | null }).doorsPerRow;
    const colsPerRow = doorsPerRow != null && doorsPerRow >= 1 ? doorsPerRow : effectiveDoors;
    const numDoorRows = Math.ceil(effectiveDoors / colsPerRow);
    const doorRowH = doorH / numDoorRows;

    // Render drawers per-row using drawerLayout
    if (drawerRows.length > 0) {
      renderDrawerRows(drawerRows, zones, rails, PAD, PAD, iW, drawerBandH);
    } else {
      // Fallback: all drawers full-width stacked
      const drawerSliceH = drawerBandH / effectiveDrawers;
      for (let i = 0; i < effectiveDrawers; i++) {
        const drawerLabel = effectiveDrawers === 1 ? "Drawer" : `Drawer ${i + 1}`;
        zones.push({
          x: PAD, y: PAD + i * drawerSliceH,
          w: iW, h: drawerSliceH,
          fill: CLR.drawer, stroke: CLR.drawerStroke,
          label: drawerLabel,
        });
        if (i < effectiveDrawers - 1) rails.push({ y: PAD + (i + 1) * drawerSliceH });
      }
    }
    // Rail between drawer band and doors
    rails.push({ y: PAD + drawerBandH });
    // Doors (bottom region, rendered in rows of colsPerRow)
    let doorIdx = 0;
    for (let row = 0; row < numDoorRows; row++) {
      const doorsInThisRow = Math.min(colsPerRow, effectiveDoors - doorIdx);
      const colW = iW / doorsInThisRow;
      const rowY = PAD + drawerBandH + row * doorRowH;
      if (row > 0) rails.push({ y: rowY });
      for (let col = 0; col < doorsInThisRow; col++) {
        const globalIdx = doorIdx + col;
        const doorLabel =
          effectiveDoors === 1 ? "Door" :
          (doorsInThisRow === 2 && col === 0) ? "Left Door" :
          (doorsInThisRow === 2 && col === 1) ? "Right Door" :
          `Door ${globalIdx + 1}`;
        zones.push({
          x: PAD + col * colW, y: rowY,
          w: colW, h: doorRowH,
          fill: CLR.door, stroke: CLR.doorStroke,
          label: doorLabel,
        });
      }
      doorIdx += doorsInThisRow;
    }
  } else if (effectiveDrawers > 0 && effectiveDoors === 0) {
    // 2-DB products always have two equal fronts. Legacy or supplier-authored
    // drawerLayout rows must not turn them into a short top and tall bottom.
    const parsedDrawerRows = isEqualHeightTwoDrawerBase(cabinet, effectiveDrawers)
      ? []
      : parseDrawerLayout(cabinet.drawerLayout, effectiveDrawers);
    const verifiedThreeDrawerRows = parsedDrawerRows.length === 0
      ? threeDrawerBaseRowHeights(cabinet, Math.max(1, (toNum(cabinet.height) ?? 34.5) - 4.5), effectiveDrawers)
      : null;
    const drawerRows = parsedDrawerRows.length > 0
      ? parsedDrawerRows
      : verifiedThreeDrawerRows?.map((height) => ({ count: 1, height })) ?? [];

    if (drawerRows.length > 0) {
      renderDrawerRows(drawerRows, zones, rails, PAD, PAD, iW, iH);
    } else {
      // Fallback: all drawers full-width stacked
      const sliceH = iH / effectiveDrawers;
      for (let i = 0; i < effectiveDrawers; i++) {
        zones.push({
          x: PAD, y: PAD + i * sliceH,
          w: iW, h: sliceH,
          fill: CLR.drawer, stroke: CLR.drawerStroke,
          label: `Drawer ${i + 1}`,
          subLabel: i === 0 ? "top" : i === effectiveDrawers - 1 ? "bottom" : undefined,
        });
      }
    }

  } else if (effectiveDoors > 0 && effectiveDrawers === 0) {
    // Door-only (wall cabinets, single/double door base with no drawers)
    // doorsPerRow: explicit admin override; fallback = all doors side-by-side in one row
    const doorsPerRowOnly = (cabinet as CabinetLike & { doorsPerRow?: number | null }).doorsPerRow;
    const colsPerRowOnly = doorsPerRowOnly != null && doorsPerRowOnly >= 1 ? doorsPerRowOnly : effectiveDoors;
    const numDoorRowsOnly = Math.ceil(effectiveDoors / colsPerRowOnly);
    const doorRowHOnly = iH / numDoorRowsOnly;
    let doorIdxOnly = 0;
    for (let row = 0; row < numDoorRowsOnly; row++) {
      const doorsInThisRow = Math.min(colsPerRowOnly, effectiveDoors - doorIdxOnly);
      const colW = iW / doorsInThisRow;
      const rowY = PAD + row * doorRowHOnly;
      if (row > 0) rails.push({ y: rowY });
      for (let col = 0; col < doorsInThisRow; col++) {
        const globalIdx = doorIdxOnly + col;
        const doorLabel =
          effectiveDoors === 1 ? "Door" :
          (doorsInThisRow === 2 && col === 0) ? "Left Door" :
          (doorsInThisRow === 2 && col === 1) ? "Right Door" :
          `Door ${globalIdx + 1}`;
        zones.push({
          x: PAD + col * colW, y: rowY,
          w: colW, h: doorRowHOnly,
          fill: CLR.door, stroke: CLR.doorStroke,
          label: doorLabel,
        });
      }
      doorIdxOnly += doorsInThisRow;
    }
  }

  // ── Legend items ─────────────────────────────────────────────────
  // Always use effectiveDoors/effectiveDrawers (they include description fallback).
  const legendDoors   = effectiveDoors;
  const legendDrawers = effectiveDrawers;
  const legendItems: { color: string; label: string }[] = [];
  if (legendDoors > 0) legendItems.push({ color: CLR.door, label: `${legendDoors} Door${legendDoors > 1 ? "s" : ""}` });
  if (legendDrawers > 0) legendItems.push({ color: CLR.drawer, label: `${legendDrawers} Drawer${legendDrawers > 1 ? "s" : ""}` });
  if (isOven) legendItems.push({ color: CLR.oven, label: "Appliance Opening" });
  if (legendDoors === 0 && legendDrawers === 0 && !isOven) legendItems.push({ color: "#64748b", label: "Open / No Doors" });

  const legendY = svgH + 6;
  const totalSvgH = svgH + 24; // extra space for legend

  return (
    <svg
      viewBox={`0 0 ${width} ${totalSvgH}`}
      width={width}
      height={totalSvgH}
      className={className}
      aria-label="Door and drawer location diagram"
      role="img"
    >
      {/* Cabinet box outline */}
      <rect
        x={PAD} y={PAD} width={iW} height={iH}
        rx={2} ry={2}
        fill="none" stroke={CLR.box} strokeWidth={2}
      />

      {/* Zones */}
      {zones.map((z, idx) => (
        <Zone key={idx} {...z} />
      ))}

      {/* Horizontal rails between zones */}
      {rails.map((r, idx) => (
        <line
          key={`rail-${idx}`}
          x1={PAD} y1={r.y} x2={PAD + iW} y2={r.y}
          stroke={CLR.rail} strokeWidth={2}
        />
      ))}

      {/* Vertical dividers between side-by-side zones */}
      {zones.filter((z, i, arr) =>
        arr.some((other, j) => j !== i && other.x === z.x + z.w && Math.abs(other.y - z.y) < 2)
      ).map((z, idx) => (
        <line
          key={`vdiv-${idx}`}
          x1={z.x + z.w} y1={z.y} x2={z.x + z.w} y2={z.y + z.h}
          stroke={CLR.rail} strokeWidth={1.5}
        />
      ))}

      {/* Legend */}
      {legendItems.map((item, idx) => {
        const lx = PAD + idx * (width / legendItems.length);
        return (
          <g key={`leg-${idx}`}>
            <rect x={lx} y={legendY} width={10} height={10} rx={2} fill={item.color} />
            <text
              x={lx + 13} y={legendY + 5}
              dominantBaseline="middle"
              fill="#64748b" fontSize={9}
              fontFamily="system-ui, sans-serif"
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default DoorDrawerDiagram;

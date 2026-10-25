import { useMemo } from "react";
import { doorPanelKind, type DoorPanelKind } from "@/lib/design";
import { resolveSwatch, type DoorStyleLike } from "@/components/DoorStyleSwatch";

// ─────────────────────────────────────────────────────────────────────────────
// RoomScenePreview
// Renders a small kitchen elevation vignette (wall + backsplash + upper cabinet
// row + countertop + base cabinet row) colored to a door style's real finish and
// panel treatment. This is a generated, on-brand "room scene" that replaces the
// non-existent /room-scenes/*.jpg photo fields — no distributor/dealer watermark.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  style: DoorStyleLike;
  className?: string;
}

// Draw one cabinet door face with the correct panel treatment.
function Door({
  x, y, w, h, face, edge, kind,
}: {
  x: number; y: number; w: number; h: number;
  face: string; edge: string; kind: DoorPanelKind;
}) {
  const inset = Math.min(w, h) * 0.12;
  const common = (
    <rect x={x} y={y} width={w} height={h} fill={face} stroke={edge} strokeWidth={1} rx={1} />
  );
  switch (kind) {
    case "slab":
      return <g>{common}</g>;
    case "double-shaker":
      return (
        <g>
          {common}
          <rect x={x + inset} y={y + inset} width={w - inset * 2} height={(h - inset * 3) / 2} fill="none" stroke={edge} strokeWidth={0.8} />
          <rect x={x + inset} y={y + inset * 2 + (h - inset * 3) / 2} width={w - inset * 2} height={(h - inset * 3) / 2} fill="none" stroke={edge} strokeWidth={0.8} />
        </g>
      );
    case "raised":
      return (
        <g>
          {common}
          <rect x={x + inset} y={y + inset} width={w - inset * 2} height={h - inset * 2} fill={face} stroke={edge} strokeWidth={0.8} />
        </g>
      );
    case "beaded":
      return (
        <g>
          {common}
          {Array.from({ length: Math.max(2, Math.floor((w - inset * 2) / 3)) }).map((_, i) => (
            <line
              key={i}
              x1={x + inset + i * 3} y1={y + inset}
              x2={x + inset + i * 3} y2={y + h - inset}
              stroke={edge} strokeWidth={0.4} opacity={0.5}
            />
          ))}
        </g>
      );
    case "inset":
      return (
        <g>
          {common}
          <rect x={x + inset * 0.6} y={y + inset * 0.6} width={w - inset * 1.2} height={h - inset * 1.2} fill="none" stroke={edge} strokeWidth={0.6} />
        </g>
      );
    case "slim-shaker": {
      // Narrow ~1/2" rail: pull the panel frame much closer to the edge.
      const slim = inset * 0.45;
      return (
        <g>
          {common}
          <rect x={x + slim} y={y + slim} width={w - slim * 2} height={h - slim * 2} fill="none" stroke={edge} strokeWidth={0.8} />
        </g>
      );
    }
    case "shaker":
    default:
      return (
        <g>
          {common}
          <rect x={x + inset} y={y + inset} width={w - inset * 2} height={h - inset * 2} fill="none" stroke={edge} strokeWidth={0.8} />
        </g>
      );
  }
}

export function RoomScenePreview({ style, className }: Props) {
  const sw = useMemo(() => resolveSwatch(style), [style]);
  const kind = useMemo(() => doorPanelKind(style.doorStyle), [style.doorStyle]);

  // viewBox: a wide kitchen elevation, 300 x 200
  const W = 300;
  const H = 200;

  // Upper cabinet row
  const upperY = 14;
  const upperH = 52;
  const upperDoors = 6;
  const upperDoorW = (W - 16) / upperDoors;

  // Countertop
  const counterY = 108;
  const counterH = 8;

  // Base cabinet row
  const baseY = counterY + counterH;
  const baseH = H - baseY - 10;
  const baseDoors = 5;
  const baseDoorW = (W - 16) / baseDoors;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label={`${style.ourName || style.styleCode || "Door style"} shown in a kitchen scene`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Wall */}
      <rect x={0} y={0} width={W} height={H} fill="#eceae4" />
      {/* Backsplash band between counter and uppers */}
      <rect x={0} y={upperY + upperH} width={W} height={counterY - (upperY + upperH)} fill="#dcd8cf" />
      <rect x={0} y={upperY + upperH} width={W} height={counterY - (upperY + upperH)} fill="url(#tile)" opacity={0.5} />
      <defs>
        <pattern id="tile" width="14" height="10" patternUnits="userSpaceOnUse">
          <rect width="14" height="10" fill="none" stroke="#c9c5ba" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* Upper cabinet row */}
      {Array.from({ length: upperDoors }).map((_, i) => (
        <Door
          key={`u-${i}`}
          x={8 + i * upperDoorW} y={upperY} w={upperDoorW - 2} h={upperH}
          face={sw.face} edge={sw.edge} kind={kind}
        />
      ))}

      {/* Countertop */}
      <rect x={0} y={counterY} width={W} height={counterH} fill="#3a3a3a" />
      <rect x={0} y={counterY} width={W} height={2} fill="#555" />

      {/* Base cabinet row */}
      {Array.from({ length: baseDoors }).map((_, i) => (
        <Door
          key={`b-${i}`}
          x={8 + i * baseDoorW} y={baseY} w={baseDoorW - 2} h={baseH}
          face={sw.face} edge={sw.edge} kind={kind}
        />
      ))}

      {/* Toe kick */}
      <rect x={0} y={H - 10} width={W} height={10} fill="#2a2a2a" />
    </svg>
  );
}
